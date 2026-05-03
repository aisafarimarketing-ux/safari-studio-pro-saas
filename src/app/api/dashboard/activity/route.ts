import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { refreshStatusForRead, type ProposalStatus } from "@/lib/proposalActivity";
import { displayTrackingId } from "@/lib/proposalTracking";
import {
  canAutoSend,
  classifyMomentum,
  type DealMomentum,
  type SuggestedAction,
} from "@/lib/dealMomentum";

// GET /api/dashboard/activity
//
// Grouped activity feed for the dashboard's read paths. Reads from the
// precomputed ProposalActivitySummary so the response stays cheap even
// at scale: status / score / next-action are denormalised columns
// updated alongside every ProposalEvent write. The only read-time
// recomputation is the "needs_followup" status flip (lastEventAt vs
// now), handled by refreshStatusForRead.
//
// Response shape:
//   {
//     hot:            [Card],   // status === "hot"
//     needsFollowup:  [Card],   // status === "needs_followup"
//     recentActivity: [EventRow],
//     reservations:   [Reservation],
//     scope: "mine" | "all",
//     canViewAll: boolean,
//   }
//
// Default scope is "mine" (assignedUserId or createdBy = caller).
// Owners and admins can pass ?scope=all; plain members get silently
// downgraded to "mine" so the UI toggle stays honest.

const RECENT_LIMIT = 20;
const GROUP_LIMIT = 10;

type Card = {
  proposalId: string;
  trackingId: string;
  title: string | null;
  status: ProposalStatus | string;
  engagementScore: number;
  nextAction: string;
  lastEventAt: string | null;
  lastEventType: string | null;
  // Deal Momentum System — operator-facing time-based bucket + the
  // suggested next action. Computed at read time from
  // ProposalActivitySummary + last operator dispatch on the same deal.
  momentum: DealMomentum;
  momentumReason: string;
  suggestedAction: SuggestedAction;
  /** Most recent draft (whatsapp/email) the operator can dispatch with
   *  one click. Null when no draft has been generated yet — the dashboard
   *  pre-warms drafts for VERY_HOT deals when it loads. */
  draft:
    | {
        id: string;
        channel: "whatsapp" | "email";
        text: string;
        createdAt: string;
        sentAt: string | null;
        /** ISO timestamp when the auto-send timer fires. Null when no
         *  schedule is set. The dashboard renders a countdown when this
         *  is in the future and clears it when conditions change. */
        autoSendScheduledFor: string | null;
        /** True after the auto-send route has actually dispatched. Used
         *  by the card to flip from "Auto-follow-up in X:XX" to
         *  "Auto-follow-up sent" without a manual reload. */
        autoSent: boolean;
      }
    | null;
  /** Pre-validated guard for the dashboard. When false, the
   *  "Schedule auto-send" button is disabled with the reason as a
   *  tooltip — same logic the /schedule route enforces server-side. */
  autoSendEligibility: { ok: true } | { ok: false; reason: string };
  client: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  consultant: { id: string; name: string | null; email: string | null } | null;
};

export async function GET(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ctx.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }

  const url = new URL(req.url);
  const requestedScope = url.searchParams.get("scope") === "all" ? "all" : "mine";
  const canViewAll = ctx.role === "owner" || ctx.role === "admin";
  const scope: "mine" | "all" =
    requestedScope === "all" && canViewAll ? "all" : "mine";

  const orgId = ctx.organization.id;
  const myUserId = ctx.user.id;
  const now = new Date();

  // Base where for proposal-summary reads. Scope = "mine" filters by
  // proposal.userId (the consultant who owns the proposal). Scope =
  // "all" only filters by org.
  const proposalScopeWhere = scope === "mine"
    ? { proposal: { userId: myUserId } }
    : {};

  // ── Pull all summaries for the org+scope, refresh status at read
  //    time, then split into hot / needs_followup. Single query keeps
  //    this fast — counts are bounded by the proposal count which
  //    is low for solo operators and capped by the plan otherwise.
  const summariesRaw = await prisma.proposalActivitySummary.findMany({
    where: {
      organizationId: orgId,
      ...proposalScopeWhere,
    },
    orderBy: [{ engagementScore: "desc" }, { lastEventAt: "desc" }],
    select: {
      proposalId: true,
      lastEventAt: true,
      lastEventType: true,
      viewedCount: true,
      itineraryClicked: true,
      priceViewed: true,
      clickedReservation: true,
      reservationCompleted: true,
      engagementScore: true,
      status: true,
      nextAction: true,
      client: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      proposal: {
        select: {
          id: true,
          title: true,
          trackingId: true,
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  // Pull every operator-facing follow-up draft for the proposals in
  // the summary set in one round trip. We map them back to their
  // proposal afterwards and pick the most recent. This both lights up
  // the per-card "draft" slot and feeds lastOperatorMessageAt into the
  // momentum classifier so we don't suggest re-pinging a client we
  // just messaged.
  const proposalIds = summariesRaw.map((s) => s.proposalId);
  const followUpRaw = proposalIds.length
    ? await prisma.aISuggestion.findMany({
        where: {
          organizationId: orgId,
          kind: "follow-up",
          targetType: "proposal",
          targetId: { in: proposalIds },
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          targetId: true,
          input: true,
          output: true,
          channel: true,
          sentAt: true,
          createdAt: true,
          autoSendScheduledFor: true,
          autoSent: true,
        },
      })
    : [];
  const latestFollowUpByProposal = new Map<string, (typeof followUpRaw)[number]>();
  const lastSentByProposal = new Map<string, Date>();
  for (const row of followUpRaw) {
    if (!latestFollowUpByProposal.has(row.targetId)) {
      latestFollowUpByProposal.set(row.targetId, row);
    }
    if (row.sentAt && !lastSentByProposal.has(row.targetId)) {
      lastSentByProposal.set(row.targetId, row.sentAt);
    }
  }

  const summaries = summariesRaw.map((row) => {
    const refreshed = refreshStatusForRead(
      {
        status: row.status,
        reservationCompleted: row.reservationCompleted,
        engagementScore: row.engagementScore,
        lastEventAt: row.lastEventAt,
        viewedCount: row.viewedCount,
        nextAction: row.nextAction,
        priceViewed: row.priceViewed,
        itineraryClicked: row.itineraryClicked,
        clickedReservation: row.clickedReservation,
      },
      now,
    );
    const momentum = classifyMomentum({
      lastEventAt: row.lastEventAt,
      lastEventType: row.lastEventType,
      lastOperatorMessageAt: lastSentByProposal.get(row.proposalId) ?? null,
      reservationCompleted: row.reservationCompleted,
      priceViewed: row.priceViewed,
      clickedReservation: row.clickedReservation,
      now,
    });
    const latestDraft = latestFollowUpByProposal.get(row.proposalId) ?? null;
    const draft: Card["draft"] = latestDraft
      ? {
          id: latestDraft.id,
          channel: latestDraft.channel === "email" ? "email" : "whatsapp",
          text: latestDraft.output,
          createdAt: latestDraft.createdAt.toISOString(),
          sentAt: latestDraft.sentAt?.toISOString() ?? null,
          autoSendScheduledFor: latestDraft.autoSendScheduledFor?.toISOString() ?? null,
          autoSent: latestDraft.autoSent,
        }
      : null;
    const autoSendEligibility = canAutoSend({
      momentum: momentum.momentum,
      lastEventAt: row.lastEventAt,
      lastEventType: row.lastEventType,
      priceViewed: row.priceViewed,
      clickedReservation: row.clickedReservation,
      reservationCompleted: row.reservationCompleted,
      lastOperatorMessageAt: lastSentByProposal.get(row.proposalId) ?? null,
      lastClientReplyAt: null,
      channel: latestDraft?.channel === "email"
        ? "email"
        : latestDraft?.channel === "whatsapp"
          ? "whatsapp"
          : null,
      now,
    });
    const card: Card = {
      proposalId: row.proposalId,
      trackingId: displayTrackingId({
        id: row.proposal.id,
        trackingId: row.proposal.trackingId,
      }),
      title: row.proposal.title ?? null,
      status: refreshed.status,
      engagementScore: refreshed.engagementScore,
      nextAction: refreshed.nextAction,
      lastEventAt: row.lastEventAt?.toISOString() ?? null,
      lastEventType: row.lastEventType,
      momentum: momentum.momentum,
      momentumReason: momentum.reason,
      suggestedAction: momentum.suggestedAction,
      draft,
      autoSendEligibility,
      client: row.client
        ? {
            id: row.client.id,
            name:
              [row.client.firstName, row.client.lastName].filter(Boolean).join(" ") ||
              row.client.email ||
              null,
            email: row.client.email ?? null,
            phone: row.client.phone ?? null,
          }
        : null,
      consultant: row.proposal.user
        ? {
            id: row.proposal.user.id,
            name: row.proposal.user.name,
            email: row.proposal.user.email,
          }
        : null,
    };
    return card;
  });

  const hot = summaries.filter((s) => s.status === "hot").slice(0, GROUP_LIMIT);
  const needsFollowup = summaries
    .filter((s) => s.status === "needs_followup")
    .slice(0, GROUP_LIMIT);
  // Hot Deals Bar — proposals that need attention NOW. Distinct from
  // "hot" status (engagement-score driven): these are time-based
  // VERY_HOT/COOLING/COLD with a SEND_NOW or ASK_QUESTION action.
  const needsAttention = summaries
    .filter((s) =>
      (s.momentum === "VERY_HOT" || s.momentum === "COOLING" || s.momentum === "COLD") &&
      (s.suggestedAction === "SEND_NOW" || s.suggestedAction === "ASK_QUESTION"),
    )
    .slice(0, GROUP_LIMIT);

  // ── Recent activity — append-only ProposalEvent log, freshest first.
  const recentEventsRaw = await prisma.proposalEvent.findMany({
    where: {
      organizationId: orgId,
      ...(scope === "mine" ? { proposal: { userId: myUserId } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: RECENT_LIMIT,
    select: {
      id: true,
      eventType: true,
      createdAt: true,
      metadata: true,
      proposal: {
        select: {
          id: true,
          title: true,
          trackingId: true,
        },
      },
      client: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });

  const recentActivity = recentEventsRaw.map((e) => ({
    id: e.id,
    eventType: e.eventType,
    at: e.createdAt.toISOString(),
    proposal: e.proposal
      ? {
          id: e.proposal.id,
          title: e.proposal.title ?? null,
          trackingId: displayTrackingId({
            id: e.proposal.id,
            trackingId: e.proposal.trackingId,
          }),
        }
      : null,
    client: e.client
      ? {
          id: e.client.id,
          name:
            [e.client.firstName, e.client.lastName].filter(Boolean).join(" ") ||
            e.client.email ||
            null,
        }
      : null,
  }));

  // ── Reservations — join through ProposalReservation. Scope by
  //    assignedUserId (the consultant the booking was routed to) so
  //    the activity surface stays consistent with the existing
  //    /api/dashboard/reservations endpoint.
  const reservationsRaw = await prisma.proposalReservation.findMany({
    where: {
      organizationId: orgId,
      ...(scope === "mine" ? { assignedUserId: myUserId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: GROUP_LIMIT,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      arrivalDate: true,
      departureDate: true,
      status: true,
      emailStatus: true,
      createdAt: true,
      proposal: { select: { id: true, title: true, trackingId: true } },
      assignedUser: { select: { id: true, name: true, email: true } },
    },
  });

  const reservations = reservationsRaw.map((r) => ({
    id: r.id,
    clientName: `${r.firstName} ${r.lastName}`.trim() || "—",
    arrivalDate: r.arrivalDate.toISOString(),
    departureDate: r.departureDate.toISOString(),
    status: r.status,
    emailStatus: r.emailStatus,
    createdAt: r.createdAt.toISOString(),
    proposal: r.proposal
      ? {
          id: r.proposal.id,
          title: r.proposal.title ?? null,
          trackingId: displayTrackingId({
            id: r.proposal.id,
            trackingId: r.proposal.trackingId,
          }),
        }
      : null,
    assignedTo: r.assignedUser
      ? { id: r.assignedUser.id, name: r.assignedUser.name, email: r.assignedUser.email }
      : null,
  }));

  // ── Pipeline strip data ────────────────────────────────────────────────
  // Five-stage live pipeline: Draft → Sent → Viewed → Booking requested
  // → Confirmed. Counts the actual rows in each stage right now (not a
  // window — the dashboard cares about current state, not historical
  // funnel). Hot deals attached so the strip can flag them inline.
  // Reservation totals (all + confirmed) are computed from a separate
  // count query because the reservationsRaw above is capped at
  // GROUP_LIMIT for the rendered list.
  const [proposalCounts, totalReservationsRaw, confirmedReservationsRaw] = await Promise.all([
    prisma.proposal.groupBy({
      by: ["status"],
      where: {
        organizationId: orgId,
        ...(scope === "mine" ? { userId: myUserId } : {}),
      },
      _count: { _all: true },
    }),
    prisma.proposalReservation.count({
      where: {
        organizationId: orgId,
        ...(scope === "mine" ? { assignedUserId: myUserId } : {}),
      },
    }),
    prisma.proposalReservation.count({
      where: {
        organizationId: orgId,
        status: "confirmed",
        ...(scope === "mine" ? { assignedUserId: myUserId } : {}),
      },
    }),
  ]);

  const proposalsByStatus = Object.fromEntries(
    proposalCounts.map((p) => [p.status, p._count._all]),
  );
  const draftCount = proposalsByStatus.draft ?? 0;
  // "Sent" includes accepted — once a proposal is sent it stays in
  // that bucket until it accumulates a booking, regardless of whether
  // the operator later flipped its status to "accepted".
  const sentCount = (proposalsByStatus.sent ?? 0) + (proposalsByStatus.accepted ?? 0);
  // "Viewed" reads from the full unfiltered summaries (already pulled
  // above) — count rows with at least one view.
  const viewedCount = summariesRaw.filter((s) => s.viewedCount > 0).length;
  const hotDealsCount = hot.length;

  // Conversion lines between adjacent stages. Floor at 0 so a 0/0
  // edge case shows 0% rather than NaN. Each percentage is forward-
  // looking: how much of the previous stage made it to the next.
  const conv = (curr: number, prev: number): number =>
    prev > 0 ? Math.min(1, curr / prev) : 0;

  const pipeline = {
    draft: draftCount,
    sent: sentCount,
    viewed: viewedCount,
    bookingRequested: totalReservationsRaw,
    confirmed: confirmedReservationsRaw,
    hotDeals: hotDealsCount,
    conversion: {
      draftToSent: conv(sentCount, draftCount + sentCount),
      sentToViewed: conv(viewedCount, sentCount),
      viewedToBooking: conv(totalReservationsRaw, viewedCount),
      bookingToConfirmed: conv(confirmedReservationsRaw, totalReservationsRaw),
    },
  };

  return NextResponse.json({
    hot,
    needsFollowup,
    needsAttention,
    recentActivity,
    reservations,
    pipeline,
    scope,
    canViewAll,
  });
}
