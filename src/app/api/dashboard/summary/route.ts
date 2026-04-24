import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";

// ─── GET /api/dashboard/summary ────────────────────────────────────────────
//
// One-shot aggregation that powers the modern dashboard. Rolls up:
//   • 30-day proposal activity sparkline
//   • Deposits this month vs last month (in cents)
//   • Requests funnel + counts
//   • Engagement signal — median session seconds across the org's
//     proposals over the last 30 days
//   • Recent activity feed (last 12 events across proposals /
//     deposits / reservations) for the sidebar activity list
//
// Tenant-scoped. All members see the same view; admin-only metrics
// (per-specialist comparisons) live on /api/analytics.

const SPARKLINE_DAYS = 30;
const FUNNEL_WINDOW_DAYS = 90;
const ACTIVITY_LIMIT = 12;

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
  const lastMonthEnd = monthStart;
  const sparkCutoff = new Date(now);
  sparkCutoff.setDate(sparkCutoff.getDate() - SPARKLINE_DAYS);
  const funnelCutoff = new Date(now);
  funnelCutoff.setDate(funnelCutoff.getDate() - FUNNEL_WINDOW_DAYS);
  const engagementCutoff = new Date(now);
  engagementCutoff.setDate(engagementCutoff.getDate() - 30);

  // Parallel fetches.
  const [
    proposalsRecent,
    proposalsThisMonth,
    proposalsLastMonth,
    deposits,
    requestsInWindow,
    views,
    activeProposals,
    recentDeposits,
    recentReservations,
  ] = await Promise.all([
    // Last 30 days of proposal creation — drives the sparkline
    prisma.proposal.findMany({
      where: { organizationId: orgId, createdAt: { gte: sparkCutoff } },
      select: { id: true, createdAt: true, title: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.proposal.count({
      where: { organizationId: orgId, createdAt: { gte: monthStart } },
    }),
    prisma.proposal.count({
      where: {
        organizationId: orgId,
        createdAt: { gte: lastMonthStart, lt: lastMonthEnd },
      },
    }),
    // Paid deposits only; grouped client-side for this-month vs last.
    prisma.proposalDeposit.findMany({
      where: {
        proposal: { organizationId: orgId },
        status: "paid",
        paidAt: { gte: lastMonthStart },
      },
      select: { amountInCents: true, currency: true, paidAt: true, proposalId: true },
    }),
    prisma.request.findMany({
      where: { organizationId: orgId, receivedAt: { gte: funnelCutoff } },
      select: { id: true, status: true, receivedAt: true },
    }),
    // Engagement — section events only, for median dwell computation
    prisma.proposalViewEvent.findMany({
      where: {
        view: { proposal: { organizationId: orgId } },
        kind: "section",
        dwellSeconds: { gt: 0 },
        createdAt: { gte: engagementCutoff },
      },
      select: { dwellSeconds: true, view: { select: { totalSeconds: true } } },
      take: 2000,
    }),
    // Pipeline value — contentJson has pricing. Cap to a manageable
    // number of recent proposals so this endpoint stays fast.
    prisma.proposal.findMany({
      where: {
        organizationId: orgId,
        status: { in: ["draft", "sent", "accepted"] },
      },
      select: { id: true, title: true, contentJson: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 40,
    }),
    // Recent paid deposits for the activity feed
    prisma.proposalDeposit.findMany({
      where: { proposal: { organizationId: orgId }, status: "paid" },
      select: {
        id: true, amountInCents: true, currency: true, paidAt: true,
        payerName: true, proposalId: true,
        proposal: { select: { title: true } },
      },
      orderBy: { paidAt: "desc" },
      take: 6,
    }),
    // Recent reservation status changes for the activity feed
    prisma.reservation.findMany({
      where: { organizationId: orgId },
      select: {
        id: true, campName: true, status: true, updatedAt: true,
        guestName: true, confirmedAt: true, sentAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 6,
    }),
  ]);

  // ── Sparkline — bucket by day ─────────────────────────────────────
  const sparkline: number[] = new Array(SPARKLINE_DAYS).fill(0);
  const sparkBase = new Date(sparkCutoff);
  sparkBase.setHours(0, 0, 0, 0);
  for (const p of proposalsRecent) {
    const diff = Math.floor(
      (p.createdAt.getTime() - sparkBase.getTime()) / 86400000,
    );
    if (diff >= 0 && diff < SPARKLINE_DAYS) sparkline[diff] += 1;
  }

  // ── Deposits split by window ─────────────────────────────────────
  let depositsThisMonthCents = 0;
  let depositsLastMonthCents = 0;
  for (const d of deposits) {
    if (!d.paidAt) continue;
    if (d.paidAt >= monthStart) depositsThisMonthCents += d.amountInCents;
    else if (d.paidAt >= lastMonthStart) depositsLastMonthCents += d.amountInCents;
  }

  // ── Funnel ───────────────────────────────────────────────────────
  const funnel = { new: 0, working: 0, open: 0, booked: 0, completed: 0, notBooked: 0 };
  for (const r of requestsInWindow) {
    if (r.status === "new") funnel.new += 1;
    else if (r.status === "working") funnel.working += 1;
    else if (r.status === "open") funnel.open += 1;
    else if (r.status === "booked") funnel.booked += 1;
    else if (r.status === "completed") funnel.completed += 1;
    else if (r.status === "not_booked") funnel.notBooked += 1;
  }
  const requestsTotal = requestsInWindow.length;
  const conversionRate = requestsTotal > 0
    ? (funnel.booked + funnel.completed) / requestsTotal
    : 0;

  // ── Engagement — median session seconds across section events ────
  const sessionSeconds = views
    .map((v) => v.view.totalSeconds)
    .filter((s): s is number => typeof s === "number" && s > 0);
  const medianSessionSeconds = median(sessionSeconds);

  // ── Pipeline value ───────────────────────────────────────────────
  // Rough estimate: active-proposals × premier-tier price × pax.
  // Useful as a directional number, not accounting.
  let pipelineValueCents = 0;
  for (const p of activeProposals) {
    const content = p.contentJson as {
      pricing?: { premier?: { pricePerPerson?: string; currency?: string } };
      client?: { adults?: number; children?: number };
    } | null;
    const pricing = content?.pricing?.premier;
    if (!pricing?.pricePerPerson) continue;
    const price = parseFloat(pricing.pricePerPerson.replace(/,/g, "")) || 0;
    const pax = (content?.client?.adults ?? 2) + 0.5 * (content?.client?.children ?? 0);
    pipelineValueCents += Math.round(price * pax * 100);
  }

  // ── Activity feed ────────────────────────────────────────────────
  type ActivityEvt = {
    at: string;
    kind: "deposit" | "reservation-confirmed" | "reservation-sent" | "proposal-created";
    label: string;
    detail?: string;
    link: string;
  };
  const activity: ActivityEvt[] = [];

  for (const d of recentDeposits) {
    if (!d.paidAt) continue;
    activity.push({
      at: d.paidAt.toISOString(),
      kind: "deposit",
      label: `Deposit received${d.payerName ? ` from ${d.payerName}` : ""}`,
      detail: `${d.currency} ${(d.amountInCents / 100).toLocaleString()} · ${d.proposal?.title ?? "proposal"}`,
      link: `/studio/${d.proposalId}`,
    });
  }
  for (const r of recentReservations) {
    if (r.status === "confirmed" && r.confirmedAt) {
      activity.push({
        at: r.confirmedAt.toISOString(),
        kind: "reservation-confirmed",
        label: `${r.campName} confirmed hold`,
        detail: r.guestName,
        link: "/reservations",
      });
    } else if (r.status === "sent" && r.sentAt) {
      activity.push({
        at: r.sentAt.toISOString(),
        kind: "reservation-sent",
        label: `Hold request sent to ${r.campName}`,
        detail: r.guestName,
        link: "/reservations",
      });
    }
  }
  for (const p of proposalsRecent.slice(-3)) {
    activity.push({
      at: p.createdAt.toISOString(),
      kind: "proposal-created",
      label: `New proposal drafted`,
      detail: p.title,
      link: `/studio/${p.id}`,
    });
  }
  activity.sort((a, b) => (a.at < b.at ? 1 : -1));
  const trimmedActivity = activity.slice(0, ACTIVITY_LIMIT);

  return NextResponse.json({
    proposals: {
      thisMonth: proposalsThisMonth,
      lastMonth: proposalsLastMonth,
      sparkline30d: sparkline,
    },
    deposits: {
      thisMonthCents: depositsThisMonthCents,
      lastMonthCents: depositsLastMonthCents,
      currency: "USD",
    },
    requests: {
      windowDays: FUNNEL_WINDOW_DAYS,
      total: requestsTotal,
      funnel,
      conversionRate,
    },
    engagement: {
      medianSessionSeconds,
      sampledViews: sessionSeconds.length,
    },
    pipeline: {
      valueCents: pipelineValueCents,
      currency: "USD",
      activeProposalCount: activeProposals.length,
    },
    activity: trimmedActivity,
  });
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}
