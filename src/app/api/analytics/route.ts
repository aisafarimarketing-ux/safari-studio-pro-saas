import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { extractProposalValueCents } from "@/lib/proposalValue";

// GET /api/analytics — the admin dashboard rollup.
//
// Returns everything the admin dashboard needs in one call:
//   - funnel: counts at each pipeline stage for the window
//   - bySource: { source, received, booked, winRate } — lets the admin
//     see which channels actually turn into bookings
//   - bySpecialist: { userId, name, received, booked, winRate,
//     medianResponseMinutes } — per-member leaderboard
//   - byDay: receivedAt grouped into a 30-point sparkline series
//   - totals: received, booked, conversion, median response
//
// Window is always last 90 days for now — a selector can be added on
// the client if we later need shorter/longer views.

const WINDOW_DAYS = 90;

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ctx.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const orgId = ctx.organization.id;
  const since = new Date();
  since.setDate(since.getDate() - WINDOW_DAYS);

  // Pull requests, proposals, and reservations in parallel. Each
  // table is the source of one column in the analytics rollup:
  //   Request               → CRM inbox funnel + bySource/bySpecialist
  //   Proposal              → drafts / sent / accepted activity
  //   ProposalReservation   → bookings funnel + by-status counts
  // Most operators ship 100s of rows per quarter — these are cheap.
  const [requests, proposals, reservations, memberships, viewedSummaries] = await Promise.all([
    prisma.request.findMany({
      where: { organizationId: orgId, receivedAt: { gte: since } },
      select: {
        id: true,
        status: true,
        source: true,
        assignedToUserId: true,
        receivedAt: true,
        firstReplyAt: true,
      },
    }),
    prisma.proposal.findMany({
      where: { organizationId: orgId, createdAt: { gte: since } },
      select: {
        id: true,
        status: true,
        createdAt: true,
        // contentJson — used by extractProposalValueCents to roll up
        // pipeline $ across the org. Pulled per-proposal once; cheap
        // for the typical 100-300 proposals/quarter range.
        contentJson: true,
        // Pulls every reservation's status so we can split "booking
        // requested" from "confirmed" in the unified funnel.
        proposalReservations: {
          select: { id: true, status: true },
        },
      },
    }),
    prisma.proposalReservation.findMany({
      where: { organizationId: orgId, createdAt: { gte: since } },
      select: {
        id: true,
        status: true,
        createdAt: true,
      },
    }),
    prisma.orgMembership.findMany({
      where: { organizationId: orgId },
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    // ProposalActivitySummary — drives the "Viewed" stage of the
    // unified funnel. We only care about whether the proposal has
    // been opened at all (viewedCount > 0); status is used for
    // proposals that may have been viewed but never moved further.
    prisma.proposalActivitySummary.findMany({
      where: {
        organizationId: orgId,
        viewedCount: { gt: 0 },
        proposal: { createdAt: { gte: since } },
      },
      select: { proposalId: true, viewedCount: true },
    }),
  ]);

  // Members lookup so bySpecialist rows have names.
  const memberById = new Map(memberships.map((m) => [m.userId, m.user]));

  // Split requests for double-count protection. Proposal-origin
  // Requests (source="proposal") are auto-created by ensureRequestForProposal
  // when an operator drafts a proposal directly — they exist purely
  // to give the proposal a slot in the inbox journey, not as inbound
  // leads. Counting them as "inbound" would double-count the proposal
  // pipeline. The funnel + bySpecialist still see all rows so the
  // pipeline-stage view stays honest.
  const inboundRequests = requests.filter((r) => r.source !== "proposal");

  // ── Funnel ──────────────────────────────────────────────────────────────
  const funnel: Record<string, number> = {
    new: 0, working: 0, open: 0, booked: 0, completed: 0, not_booked: 0,
  };
  for (const r of requests) {
    if (r.status in funnel) funnel[r.status] += 1;
  }

  // ── Overall totals (INBOUND requests only) ────────────────────────────
  // Built off inboundRequests so proposal-origin auto-Requests don't
  // inflate the inbound lead count or pull median-response down.
  const received = inboundRequests.length;
  const booked = inboundRequests.filter(
    (r) => r.status === "booked" || r.status === "completed",
  ).length;
  const conversion = received > 0 ? booked / received : 0;
  const responseDeltas = inboundRequests
    .filter((r) => r.firstReplyAt)
    .map((r) => ((r.firstReplyAt as Date).getTime() - r.receivedAt.getTime()) / 60000)
    .filter((m) => m >= 0);
  const medianResponseMinutes = responseDeltas.length > 0 ? median(responseDeltas) : null;

  // ── By source ───────────────────────────────────────────────────────────
  // Includes ALL requests (proposal-origin too) so the operator can
  // see how much of the pipeline is proposal-led vs. inbound-channel-led.
  const sourceTally = new Map<string, { received: number; booked: number }>();
  for (const r of requests) {
    const key = r.source?.trim() || "Unknown";
    const row = sourceTally.get(key) ?? { received: 0, booked: 0 };
    row.received += 1;
    if (r.status === "booked" || r.status === "completed") row.booked += 1;
    sourceTally.set(key, row);
  }
  const bySource = Array.from(sourceTally.entries())
    .map(([source, v]) => ({
      source,
      received: v.received,
      booked: v.booked,
      winRate: v.received > 0 ? v.booked / v.received : 0,
    }))
    .sort((a, b) => b.received - a.received);

  // ── By specialist ───────────────────────────────────────────────────────
  const specTally = new Map<string, { received: number; booked: number; deltas: number[] }>();
  for (const r of requests) {
    const key = r.assignedToUserId ?? "__unassigned__";
    const row = specTally.get(key) ?? { received: 0, booked: 0, deltas: [] };
    row.received += 1;
    if (r.status === "booked" || r.status === "completed") row.booked += 1;
    if (r.firstReplyAt) {
      const d = (r.firstReplyAt.getTime() - r.receivedAt.getTime()) / 60000;
      if (d >= 0) row.deltas.push(d);
    }
    specTally.set(key, row);
  }
  const bySpecialist = Array.from(specTally.entries())
    .map(([userId, v]) => {
      const user = userId === "__unassigned__" ? null : memberById.get(userId) ?? null;
      return {
        userId,
        name: user?.name ?? user?.email ?? (userId === "__unassigned__" ? "Unassigned" : "Unknown"),
        received: v.received,
        booked: v.booked,
        winRate: v.received > 0 ? v.booked / v.received : 0,
        medianResponseMinutes: v.deltas.length > 0 ? median(v.deltas) : null,
      };
    })
    .sort((a, b) => b.booked - a.booked || b.received - a.received);

  // ── By day (30-point sparkline of received count) ───────────────────────
  // Bucket the last 30 days inclusive so the right edge is today.
  const byDay: { date: string; received: number; booked: number }[] = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 29);
  const buckets = new Map<string, { received: number; booked: number }>();
  for (let i = 0; i < 30; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    buckets.set(isoDate(d), { received: 0, booked: 0 });
  }
  // Sparkline counts inbound only — matches the inbound totals at the
  // top of the page so the trend line and the headline number tell
  // the same story.
  for (const r of inboundRequests) {
    const key = isoDate(r.receivedAt);
    const b = buckets.get(key);
    if (b) {
      b.received += 1;
      if (r.status === "booked" || r.status === "completed") b.booked += 1;
    }
  }
  for (const [date, v] of buckets.entries()) byDay.push({ date, ...v });
  byDay.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  // ── Proposal rollups (independent of Request) ─────────────────────────
  // Counts every proposal created in the window — captures drafts the
  // operator made directly from "+ New proposal" without an inbound
  // Request to back them. Without this, those proposals were
  // invisible to analytics and the dashboard showed 0s.
  const proposalsTotal = proposals.length;
  const proposalsByStatus: Record<string, number> = { draft: 0, sent: 0, accepted: 0 };
  for (const p of proposals) {
    if (p.status in proposalsByStatus) proposalsByStatus[p.status] += 1;
  }
  // Proposals that received at least one client booking via the
  // share view, and the subset that have a confirmed reservation.
  const proposalsWithReservation = proposals.filter(
    (p) => p.proposalReservations.length > 0,
  ).length;
  const proposalsWithConfirmed = proposals.filter((p) =>
    p.proposalReservations.some((r) => r.status === "confirmed"),
  ).length;

  // Pipeline $ — sum of value across active proposals (draft + sent).
  // Currency is last-wins across the rollup; mixed-currency orgs land
  // on whichever currency the most-recent active proposal uses, which
  // is "wrong but not misleading" for the headline. A per-currency
  // breakdown is a follow-up if it ever matters.
  let pipelineValueCents = 0;
  let pipelineCurrency = "USD";
  for (const p of proposals) {
    if (p.status === "draft" || p.status === "sent") {
      const v = extractProposalValueCents(p.contentJson);
      if (v.cents > 0) {
        pipelineValueCents += v.cents;
        pipelineCurrency = v.currency;
      }
    }
  }

  // Unified five-stage funnel that traces a deal across the linked
  // tables. Each stage counts proposals (the unit of journey)
  // currently sitting in that stage:
  //   Draft             — proposal created, never sent
  //   Sent              — operator hit Send (or the proposal reached
  //                       "accepted")
  //   Viewed            — guest opened /p/[id] (ProposalActivitySummary
  //                       with viewedCount > 0)
  //   Booking requested — guest submitted the reservation form
  //                       (proposal has >= 1 ProposalReservation)
  //   Confirmed         — operator marked the booking confirmed
  //                       (reservation status = "confirmed")
  const viewedProposalIds = new Set(viewedSummaries.map((s) => s.proposalId));
  const unifiedFunnel = {
    draft: proposals.filter((p) => p.status === "draft").length,
    sent: proposals.filter(
      (p) => p.status === "sent" || p.status === "accepted",
    ).length,
    viewed: proposals.filter((p) => viewedProposalIds.has(p.id)).length,
    bookingRequested: proposalsWithReservation,
    confirmed: proposalsWithConfirmed,
  };

  // Journey conversion headline — "X proposals → Y bookings (Z%)".
  // Y = proposals that received any booking (not raw reservation count
  // — same proposal twice would double-count). Floor at 0 so a 0/0
  // edge case shows 0% rather than NaN.
  const journeyConversion = {
    proposals: proposalsTotal,
    bookings: proposalsWithReservation,
    rate:
      proposalsTotal > 0 ? proposalsWithReservation / proposalsTotal : 0,
  };

  // ── Reservation rollups (the real "bookings" pipeline) ─────────────────
  const reservationsTotal = reservations.length;
  const reservationsByStatus: Record<string, number> = {
    new: 0,
    contacted: 0,
    confirmed: 0,
    lost: 0,
  };
  for (const r of reservations) {
    if (r.status in reservationsByStatus) reservationsByStatus[r.status] += 1;
  }

  // Proposal → booking conversion. The operator's actual win rate when
  // they're sending proposals directly (not via the CRM inbox).
  const proposalConversion =
    proposalsTotal > 0 ? proposalsWithReservation / proposalsTotal : 0;

  return NextResponse.json({
    windowDays: WINDOW_DAYS,
    totals: {
      received,
      booked,
      conversion,
      medianResponseMinutes,
    },
    funnel,
    bySource,
    bySpecialist,
    byDay,
    // New rollups — populated by the proposal/reservation pipelines
    // that the legacy Request-based analytics didn't see.
    proposals: {
      total: proposalsTotal,
      byStatus: proposalsByStatus,
      withReservation: proposalsWithReservation,
      withConfirmed: proposalsWithConfirmed,
      conversion: proposalConversion,
      pipelineValueCents,
      pipelineCurrency,
    },
    reservations: {
      total: reservationsTotal,
      byStatus: reservationsByStatus,
    },
    // Unified-journey rollups — Draft → Sent → Viewed → Booking
    // requested → Confirmed, plus the headline conversion ("X
    // proposals → Y bookings (Z%)") that operators read first.
    unifiedFunnel,
    journeyConversion,
  });
}

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
