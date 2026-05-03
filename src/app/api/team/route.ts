import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";

// GET /api/team — live performance command center for the operator
// roster. Returns per-member metrics, derived action score, badges,
// suggested actions, last activity, plus org-level rankings.
//
// Builds on top of /api/team's original presence + workload data —
// proposalActive / hotDeals / needsFollowup / atRisk pulled from
// ProposalActivitySummary; bookings from ProposalReservation; latest
// activity from ActivityEvent.
//
// Members can read this; write paths live on /api/team/[userId] and
// stay admin-only.

const ACTIVE_STAGES = ["new", "working", "open"];
const ACTIVE_PROPOSAL_STATUSES = ["draft", "sent"];
const ONLINE_WINDOW_MS = 2 * 60 * 1000;

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ctx.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }

  const orgId = ctx.organization.id;
  const monthStart = startOfMonth();

  const [
    memberships,
    presences,
    stageCounts,
    firstReplyStats,
    bookedThisMonth,
    proposalCounts,
    summaries,
    reservations,
    activities,
  ] = await Promise.all([
    prisma.orgMembership.findMany({
      where: { organizationId: orgId },
      include: {
        user: { select: { id: true, name: true, email: true, createdAt: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.presence.findMany({
      where: { organizationId: orgId },
      select: {
        userId: true,
        currentView: true,
        currentAction: true,
        lastActiveAt: true,
      },
    }),
    prisma.request.groupBy({
      by: ["assignedToUserId", "status"],
      where: { organizationId: orgId, status: { in: ACTIVE_STAGES } },
      _count: { _all: true },
    }),
    prisma.request.findMany({
      where: {
        organizationId: orgId,
        firstReplyAt: { not: null },
        receivedAt: { gte: daysAgo(30) },
        assignedToUserId: { not: null },
      },
      select: { assignedToUserId: true, receivedAt: true, firstReplyAt: true },
    }),
    prisma.request.groupBy({
      by: ["assignedToUserId"],
      where: {
        organizationId: orgId,
        status: "booked",
        lastActivityAt: { gte: monthStart },
        assignedToUserId: { not: null },
      },
      _count: { _all: true },
    }),
    // Active proposals per member (draft + sent).
    prisma.proposal.groupBy({
      by: ["userId", "status"],
      where: {
        organizationId: orgId,
        status: { in: ACTIVE_PROPOSAL_STATUSES },
      },
      _count: { _all: true },
    }),
    // Activity summaries with their proposal owner so we can group by
    // userId. Filter to only the statuses we render so the row count
    // stays small even on chatty orgs.
    prisma.proposalActivitySummary.findMany({
      where: {
        organizationId: orgId,
        status: { in: ["hot", "warm", "needs_followup"] },
      },
      select: {
        status: true,
        priceViewed: true,
        proposal: { select: { userId: true } },
      },
    }),
    // Reservations — both this-month and all-time bookings, fetched
    // as one query that we bucket in JS.
    prisma.proposalReservation.findMany({
      where: { organizationId: orgId, assignedUserId: { not: null } },
      select: { assignedUserId: true, createdAt: true, status: true },
    }),
    // Last 50 activity events, used to surface "last activity" per
    // member. Doing it as one query + reduce in JS is cheaper than N
    // per-user queries.
    prisma.activityEvent.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { userId: true, type: true, targetType: true, createdAt: true },
    }),
  ]);

  // ── Lookups ─────────────────────────────────────────────────────────────
  const presenceByUser = new Map(presences.map((p) => [p.userId, p]));

  const stageByUser = new Map<string, { new: number; working: number; open: number; total: number }>();
  for (const c of stageCounts) {
    if (!c.assignedToUserId) continue;
    const row = stageByUser.get(c.assignedToUserId) ?? { new: 0, working: 0, open: 0, total: 0 };
    if (c.status === "new") row.new = c._count._all;
    else if (c.status === "working") row.working = c._count._all;
    else if (c.status === "open") row.open = c._count._all;
    row.total += c._count._all;
    stageByUser.set(c.assignedToUserId, row);
  }

  const replyDeltasByUser = new Map<string, number[]>();
  for (const r of firstReplyStats) {
    if (!r.assignedToUserId || !r.firstReplyAt) continue;
    const deltaMin = (r.firstReplyAt.getTime() - r.receivedAt.getTime()) / 60000;
    if (deltaMin < 0) continue;
    const arr = replyDeltasByUser.get(r.assignedToUserId) ?? [];
    arr.push(deltaMin);
    replyDeltasByUser.set(r.assignedToUserId, arr);
  }
  const medianByUser = new Map<string, number | null>();
  for (const [userId, deltas] of replyDeltasByUser.entries()) {
    medianByUser.set(userId, median(deltas));
  }

  const requestBookedByUser = new Map(
    bookedThisMonth
      .filter((b) => b.assignedToUserId)
      .map((b) => [b.assignedToUserId as string, b._count._all]),
  );

  // Proposals — count active per user (draft + sent combined).
  const proposalsActiveByUser = new Map<string, number>();
  for (const p of proposalCounts) {
    proposalsActiveByUser.set(
      p.userId,
      (proposalsActiveByUser.get(p.userId) ?? 0) + p._count._all,
    );
  }

  // Activity-summary buckets per user.
  const hotByUser = new Map<string, number>();
  const followupByUser = new Map<string, number>();
  const atRiskByUser = new Map<string, number>(); // subset: needs_followup AND priceViewed
  for (const s of summaries) {
    const uid = s.proposal?.userId;
    if (!uid) continue;
    if (s.status === "hot") hotByUser.set(uid, (hotByUser.get(uid) ?? 0) + 1);
    if (s.status === "needs_followup") {
      followupByUser.set(uid, (followupByUser.get(uid) ?? 0) + 1);
      if (s.priceViewed) atRiskByUser.set(uid, (atRiskByUser.get(uid) ?? 0) + 1);
    }
  }

  // Reservations per user — split into this-month and all-time so the
  // player card can show "Bookings (this month) · all-time".
  const reservationsThisMonthByUser = new Map<string, number>();
  const reservationsAllTimeByUser = new Map<string, number>();
  for (const r of reservations) {
    if (!r.assignedUserId) continue;
    reservationsAllTimeByUser.set(
      r.assignedUserId,
      (reservationsAllTimeByUser.get(r.assignedUserId) ?? 0) + 1,
    );
    if (r.createdAt.getTime() >= monthStart.getTime()) {
      reservationsThisMonthByUser.set(
        r.assignedUserId,
        (reservationsThisMonthByUser.get(r.assignedUserId) ?? 0) + 1,
      );
    }
  }

  // Last activity per user — first occurrence wins (events are sorted
  // newest first).
  const lastActivityByUser = new Map<string, { type: string; targetType: string | null; createdAt: Date }>();
  for (const e of activities) {
    if (!lastActivityByUser.has(e.userId)) {
      lastActivityByUser.set(e.userId, {
        type: e.type,
        targetType: e.targetType,
        createdAt: e.createdAt,
      });
    }
  }

  const now = Date.now();

  // ── Per-member rollup ─────────────────────────────────────────────────
  const teamPre = memberships.map((m) => {
    const presence = presenceByUser.get(m.userId);
    const lastActiveAt = presence?.lastActiveAt ?? null;
    const onlineStatus =
      lastActiveAt && now - lastActiveAt.getTime() < ONLINE_WINDOW_MS
        ? "online"
        : lastActiveAt && now - lastActiveAt.getTime() < 15 * 60 * 1000
          ? "idle"
          : "offline";

    const proposalsActive = proposalsActiveByUser.get(m.userId) ?? 0;
    const hotDeals = hotByUser.get(m.userId) ?? 0;
    const needsFollowup = followupByUser.get(m.userId) ?? 0;
    const atRisk = atRiskByUser.get(m.userId) ?? 0;
    const bookingsThisMonth =
      (reservationsThisMonthByUser.get(m.userId) ?? 0)
      + (requestBookedByUser.get(m.userId) ?? 0);
    const bookingsAllTime = reservationsAllTimeByUser.get(m.userId) ?? 0;
    const medianResponseMinutes = medianByUser.get(m.userId) ?? null;

    const lastEvent = lastActivityByUser.get(m.userId);

    return {
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
      roleTitle: m.roleTitle,
      profilePhotoUrl: m.profilePhotoUrl,
      memberSince: m.createdAt,
      presence: {
        status: onlineStatus,
        currentView: presence?.currentView ?? null,
        currentAction: presence?.currentAction ?? null,
        lastActiveAt,
      },
      workload: stageByUser.get(m.userId) ?? { new: 0, working: 0, open: 0, total: 0 },
      medianResponseMinutes,
      bookedThisMonth: requestBookedByUser.get(m.userId) ?? 0, // legacy field — kept for back-compat
      metrics: {
        proposalsActive,
        hotDeals,
        needsFollowup,
        atRisk,
        bookingsThisMonth,
        bookingsAllTime,
        medianResponseMinutes,
        actionScore: computeActionScore({
          bookingsThisMonth,
          hotDeals,
          needsFollowup,
          atRisk,
          medianResponseMinutes,
        }),
      },
      suggestedActions: suggestActions({
        hotDeals,
        needsFollowup,
        atRisk,
        proposalsActive,
        bookingsThisMonth,
      }),
      lastActivity: lastEvent
        ? {
            description: describeActivity(lastEvent.type, lastEvent.targetType),
            at: lastEvent.createdAt.toISOString(),
          }
        : null,
    };
  });

  // ── Org-level rankings (top 3 each) ──────────────────────────────────
  const topByBookings = [...teamPre]
    .filter((m) => m.metrics.bookingsThisMonth > 0)
    .sort((a, b) => b.metrics.bookingsThisMonth - a.metrics.bookingsThisMonth)
    .slice(0, 3)
    .map((m) => ({ userId: m.userId, name: m.name, value: m.metrics.bookingsThisMonth }));

  const topByPipeline = [...teamPre]
    .filter((m) => m.metrics.proposalsActive > 0)
    .sort((a, b) => b.metrics.proposalsActive - a.metrics.proposalsActive)
    .slice(0, 3)
    .map((m) => ({ userId: m.userId, name: m.name, value: m.metrics.proposalsActive }));

  const fastestResponse = [...teamPre]
    .filter(
      (m) =>
        typeof m.metrics.medianResponseMinutes === "number"
        && m.metrics.medianResponseMinutes > 0
        && (replyDeltasByUser.get(m.userId)?.length ?? 0) >= 3,
    )
    .sort(
      (a, b) =>
        (a.metrics.medianResponseMinutes as number)
        - (b.metrics.medianResponseMinutes as number),
    )
    .slice(0, 3)
    .map((m) => ({
      userId: m.userId,
      name: m.name,
      value: Math.round(m.metrics.medianResponseMinutes as number),
    }));

  // ── Badges (assigned per-user via the rankings + simple thresholds) ──
  const badgesByUser = new Map<string, string[]>();
  if (topByBookings[0]) push(badgesByUser, topByBookings[0].userId, "Most bookings");
  if (topByPipeline[0]) push(badgesByUser, topByPipeline[0].userId, "Most pipeline");
  if (fastestResponse[0]) push(badgesByUser, fastestResponse[0].userId, "Fast responder");

  // Best conversion — most hotDeals per active proposal (need >= 3
  // proposals so a member with 1 deal that's hot doesn't win it).
  const bestConversion = [...teamPre]
    .filter((m) => m.metrics.proposalsActive >= 3 && m.metrics.hotDeals > 0)
    .sort(
      (a, b) =>
        b.metrics.hotDeals / b.metrics.proposalsActive
        - a.metrics.hotDeals / a.metrics.proposalsActive,
    )[0];
  if (bestConversion) push(badgesByUser, bestConversion.userId, "Best conversion");

  const team = teamPre.map((m) => ({
    ...m,
    badges: badgesByUser.get(m.userId) ?? [],
  }));

  return NextResponse.json({
    team,
    rankings: {
      topByBookings,
      topByPipeline,
      fastestResponse,
    },
    orgId,
    you: { userId: ctx.user.id, role: ctx.role },
  });
}

// ─── Derived helpers ──────────────────────────────────────────────────────

// Action score — 0-100. Rewards the things that matter (bookings,
// hot deals, fast response) and penalises a follow-up backlog. Caller
// renders this as a single number so a manager can scan the team.
function computeActionScore(input: {
  bookingsThisMonth: number;
  hotDeals: number;
  needsFollowup: number;
  atRisk: number;
  medianResponseMinutes: number | null;
}): number {
  let score = 40; // baseline so a member with no data isn't at 0
  score += Math.min(60, input.bookingsThisMonth * 15);
  score += Math.min(30, input.hotDeals * 5);
  if (typeof input.medianResponseMinutes === "number") {
    if (input.medianResponseMinutes < 30) score += 20;
    else if (input.medianResponseMinutes < 120) score += 10;
  }
  score -= Math.min(40, input.needsFollowup * 2);
  score -= Math.min(30, input.atRisk * 3);
  return Math.max(0, Math.min(100, Math.round(score)));
}

// Up to 3 suggested actions ordered by urgency. Empty when nothing
// pressing — UI then nudges with a generic line.
function suggestActions(input: {
  hotDeals: number;
  needsFollowup: number;
  atRisk: number;
  proposalsActive: number;
  bookingsThisMonth: number;
}): { label: string; tone: "hot" | "warn" | "info" }[] {
  const out: { label: string; tone: "hot" | "warn" | "info" }[] = [];
  if (input.atRisk > 0) {
    out.push({
      label: `Recover ${input.atRisk} at-risk deal${input.atRisk === 1 ? "" : "s"}`,
      tone: "hot",
    });
  }
  if (input.hotDeals > 0) {
    out.push({
      label: `Reach out to ${input.hotDeals} hot deal${input.hotDeals === 1 ? "" : "s"}`,
      tone: "hot",
    });
  }
  if (input.needsFollowup > 0 && out.length < 3) {
    out.push({
      label: `Follow up on ${input.needsFollowup} quiet proposal${input.needsFollowup === 1 ? "" : "s"}`,
      tone: "warn",
    });
  }
  if (out.length === 0 && input.proposalsActive === 0) {
    out.push({ label: "Pick up a request from the inbox", tone: "info" });
  }
  if (out.length === 0 && input.bookingsThisMonth === 0) {
    out.push({ label: "Send a follow-up to your active proposals", tone: "info" });
  }
  return out.slice(0, 3);
}

// Tiny english-ifier for ActivityEvent.type so the player card can
// show "Sent a quote · 32m ago" instead of "sendQuote · …".
function describeActivity(type: string, targetType: string | null): string {
  switch (type) {
    case "signin":         return "Signed in";
    case "signout":        return "Signed out";
    case "viewRequest":    return "Opened a request";
    case "createRequest":  return "Created a request";
    case "createQuote":    return "Drafted a quote";
    case "sendQuote":      return "Sent a quote";
    case "assignRequest":  return "Assigned a request";
    case "changeStatus":   return "Moved a deal";
    case "postNote":       return "Left a note";
    case "editProposal":   return "Edited a proposal";
    case "archiveProperty": return "Archived a property";
    case "editBrandDNA":   return "Updated Brand DNA";
    default:               return targetType ? `Touched a ${targetType}` : "Worked on a deal";
  }
}

function push<T>(map: Map<string, T[]>, key: string, value: T) {
  const arr = map.get(key) ?? [];
  arr.push(value);
  map.set(key, arr);
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function startOfMonth(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}
