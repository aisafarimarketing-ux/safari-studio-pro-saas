import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";

// ─── GET /api/team/performance ─────────────────────────────────────────────
//
// Per-member output metrics for the Team page's performance panel.
// Distinct from /api/team (which is about inbound workload) — this one
// is about OUTPUT: what each member is producing and how well it's
// converting. Tenant-scoped.
//
// Per member:
//   • proposalsThisMonth   — drafts they created since month start
//   • proposalsLastMonth   — for the MoM delta
//   • depositsThisMonthCents — revenue captured on their proposals
//   • engagementMedianSeconds — median session time on their proposals
//   • pipelineValueCents    — premier-tier × pax across their active
//                              proposals (directional, not accounting)

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ctx.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }

  const orgId = ctx.organization.id;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [
    memberships,
    proposalCountsThisMonth,
    proposalCountsLastMonth,
    paidDeposits,
    engagementEvents,
    activeProposals,
  ] = await Promise.all([
    prisma.orgMembership.findMany({
      where: { organizationId: orgId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.proposal.groupBy({
      by: ["userId"],
      where: { organizationId: orgId, createdAt: { gte: monthStart } },
      _count: { _all: true },
    }),
    prisma.proposal.groupBy({
      by: ["userId"],
      where: {
        organizationId: orgId,
        createdAt: { gte: lastMonthStart, lt: monthStart },
      },
      _count: { _all: true },
    }),
    // Deposits joined via proposal to resolve the drafter.
    prisma.proposalDeposit.findMany({
      where: {
        status: "paid",
        paidAt: { gte: monthStart },
        proposal: { organizationId: orgId },
      },
      select: {
        amountInCents: true,
        proposal: { select: { userId: true } },
      },
    }),
    // Session dwell samples attributed to each drafter.
    prisma.proposalViewEvent.findMany({
      where: {
        kind: "section",
        dwellSeconds: { gt: 0 },
        createdAt: { gte: daysAgo(30) },
        view: { proposal: { organizationId: orgId } },
      },
      select: {
        view: {
          select: {
            totalSeconds: true,
            proposal: { select: { userId: true } },
          },
        },
      },
      take: 5000,
    }),
    // Pipeline value — active proposals with pricing.
    prisma.proposal.findMany({
      where: {
        organizationId: orgId,
        status: { in: ["draft", "sent", "accepted"] },
      },
      select: { userId: true, contentJson: true },
      take: 200,
    }),
  ]);

  const proposalsThisMonthByUser = mapFromCounts(proposalCountsThisMonth);
  const proposalsLastMonthByUser = mapFromCounts(proposalCountsLastMonth);

  const depositsByUser = new Map<string, number>();
  for (const d of paidDeposits) {
    const uid = d.proposal?.userId;
    if (!uid) continue;
    depositsByUser.set(uid, (depositsByUser.get(uid) ?? 0) + d.amountInCents);
  }

  const sessionSecondsByUser = new Map<string, number[]>();
  for (const e of engagementEvents) {
    const uid = e.view?.proposal?.userId;
    const s = e.view?.totalSeconds;
    if (!uid || typeof s !== "number" || s <= 0) continue;
    const arr = sessionSecondsByUser.get(uid) ?? [];
    arr.push(s);
    sessionSecondsByUser.set(uid, arr);
  }

  const pipelineByUser = new Map<string, number>();
  for (const p of activeProposals) {
    const content = p.contentJson as {
      pricing?: { premier?: { pricePerPerson?: string } };
      client?: { adults?: number; children?: number };
    } | null;
    const price = parseFloat(content?.pricing?.premier?.pricePerPerson?.replace(/,/g, "") ?? "") || 0;
    const pax = (content?.client?.adults ?? 2) + 0.5 * (content?.client?.children ?? 0);
    const cents = Math.round(price * pax * 100);
    pipelineByUser.set(p.userId, (pipelineByUser.get(p.userId) ?? 0) + cents);
  }

  const members = memberships.map((m) => {
    const uid = m.user.id;
    const sessions = sessionSecondsByUser.get(uid) ?? [];
    return {
      userId: uid,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
      roleTitle: m.roleTitle,
      profilePhotoUrl: m.profilePhotoUrl,
      metrics: {
        proposalsThisMonth: proposalsThisMonthByUser.get(uid) ?? 0,
        proposalsLastMonth: proposalsLastMonthByUser.get(uid) ?? 0,
        depositsThisMonthCents: depositsByUser.get(uid) ?? 0,
        engagementMedianSeconds: median(sessions),
        engagementSampleSize: sessions.length,
        pipelineValueCents: pipelineByUser.get(uid) ?? 0,
      },
    };
  });

  // Sort by output: most proposals this month first. Owners still
  // appear first within the same bucket by virtue of prior createdAt ordering.
  members.sort((a, b) => b.metrics.proposalsThisMonth - a.metrics.proposalsThisMonth);

  return NextResponse.json({ members });
}

function mapFromCounts(rows: Array<{ userId: string; _count: { _all: number } }>): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.userId, r._count._all);
  return m;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}
