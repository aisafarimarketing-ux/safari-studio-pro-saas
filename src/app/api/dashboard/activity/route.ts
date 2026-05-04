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
import { normaliseFollowUpMode } from "@/lib/followUpMode";
import {
  aggregateBookedStats,
  extractDaysFromInput,
  matchesNextStepHeuristic,
  suggestNextStepWithStats,
  type InspectorSuggestion,
} from "@/lib/inspectorAI";

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
  /** Inspector AI's "what to do next" line. Pure heuristic over the
   *  card's momentum + engagement signals + prior-sent history.
   *  Null when the dashboard should stay quiet (booked, just sent,
   *  cold). The dashboard renders this as a small chip below the
   *  momentum reason. */
  nextSuggestion: InspectorSuggestion | null;
  /** Channel the dashboard should default to for this card. Mirrors
   *  the spec's priority order: WhatsApp when client.phone exists,
   *  Email otherwise. Null when neither contact method is available
   *  — the inline contact-capture UI uses this signal to prompt for
   *  the missing field. */
  preferredChannel: "whatsapp" | "email" | null;
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

  // Pull the org's follow-up mode + premium flag so the dashboard can
  // adapt without a second round-trip. Both default to safe values
  // when the row is older than the migration that added the columns.
  const orgRow = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { followUpMode: true, isPremium: true },
  });
  const followUpMode = normaliseFollowUpMode(orgRow?.followUpMode);
  const isPremium = orgRow?.isPremium ?? false;

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

  // ── Booked-suggestion history — feeds Inspector AI v2 stats ─────
  // Org-wide aggregation over every AISuggestion that was sent and
  // ultimately booked. Bounded by the org's booking volume (small
  // for early-stage operators; the index on outcome+org keeps it
  // fast). Aggregation runs in JS — see lib/inspectorAI.ts. The
  // resulting BookedStats is shared across every card in this
  // request, so the cost is one query per dashboard load, not per
  // card.
  const bookedHistoryRaw = await prisma.aISuggestion.findMany({
    where: {
      organizationId: orgId,
      outcome: "booked",
      sentAt: { not: null },
      bookedAt: { not: null },
    },
    select: {
      channel: true,
      sentAt: true,
      bookedAt: true,
      input: true,
    },
    take: 500, // hard cap defends against runaway old data
  });
  const bookedStats = aggregateBookedStats(bookedHistoryRaw);

  // ── Execution AI history — feeds Inspector AI's "next day" rule ──
  // Pull every sent execution snippet for the visible proposals so we
  // know which day numbers the operator has already covered. Mostly
  // small (one or two rows per proposal in practice); the take cap
  // keeps it bounded. Best-effort — a query failure here just means
  // Inspector AI falls back to its no-history suggestions.
  const executionRaw = proposalIds.length
    ? await prisma.aISuggestion.findMany({
        where: {
          organizationId: orgId,
          kind: "execution",
          targetType: "proposal",
          targetId: { in: proposalIds },
          sentAt: { not: null },
        },
        orderBy: { sentAt: "desc" },
        select: { targetId: true, sentAt: true, input: true },
        take: proposalIds.length * 4,
      })
    : [];
  const priorDaysByProposal = new Map<string, number[]>();
  for (const row of executionRaw) {
    const days = extractDaysFromInput(row.input);
    if (days.length === 0) continue;
    // Roll the latest sent timestamp into lastSentByProposal too so
    // execution snippets count toward the "don't double-tap" guard
    // alongside follow-ups.
    if (row.sentAt) {
      const existing = lastSentByProposal.get(row.targetId);
      if (!existing || row.sentAt > existing) {
        lastSentByProposal.set(row.targetId, row.sentAt);
      }
    }
    const list = priorDaysByProposal.get(row.targetId) ?? [];
    for (const d of days) if (!list.includes(d)) list.push(d);
    priorDaysByProposal.set(row.targetId, list);
  }
  for (const [k, v] of priorDaysByProposal.entries()) {
    priorDaysByProposal.set(k, v.slice().sort((a, b) => a - b));
  }

  // ── Preview-itinerary history — gates Inspector AI's "send a
  //    preview" suggestions on COOLING / COLD deals. We pull every
  //    preview send for the org and group by client id (extracted
  //    from input.resolved.clientId). Bounded by the org's preview
  //    volume; in practice tiny.
  const previewsRaw = await prisma.aISuggestion.findMany({
    where: {
      organizationId: orgId,
      kind: "preview-itinerary",
      sentAt: { not: null },
    },
    orderBy: { sentAt: "desc" },
    select: { input: true, sentAt: true },
    take: 200,
  });
  const lastPreviewByClient = new Map<string, Date>();
  for (const row of previewsRaw) {
    if (!row.sentAt) continue;
    const clientId = extractResolvedClientId(row.input);
    if (!clientId) continue;
    if (!lastPreviewByClient.has(clientId)) {
      lastPreviewByClient.set(clientId, row.sentAt);
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
    // Inspector AI — read-only "what to do next" suggester. v2 is
    // outcome-aware: when the heuristic suggests an actionable day
    // AND the org has at least 3 booked AISuggestions for that day,
    // the message is upgraded from rule-based ("Day 3 often works
    // next") to data-grounded ("3 similar bookings closed within
    // 25 min after sending Day 3 via WhatsApp"). Below the sample
    // threshold the suggester falls back to the v1 heuristic copy
    // — never invents a stat off thin data.
    const nextSuggestion = suggestNextStepWithStats(
      {
        momentum: momentum.momentum,
        lastEventType: row.lastEventType,
        priceViewed: row.priceViewed,
        clickedReservation: row.clickedReservation,
        reservationCompleted: row.reservationCompleted,
        lastSentAt: lastSentByProposal.get(row.proposalId) ?? null,
        priorDaysSent: priorDaysByProposal.get(row.proposalId) ?? [],
        lastPreviewSentAt: row.client?.id
          ? lastPreviewByClient.get(row.client.id) ?? null
          : null,
        clientFirstName: row.client?.firstName ?? null,
        now,
      },
      bookedStats,
    );
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
      nextSuggestion,
      preferredChannel: row.client?.phone
        ? "whatsapp"
        : row.client?.email
          ? "email"
          : null,
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

  // Today's Opportunities — daily closing feed. The dashboard's main
  // workflow surface: 5-second answer to "who needs me, why now,
  // what do I send?". Includes:
  //   - VERY_HOT (priority 0) — fresh activity, strike now
  //   - COOLING (priority 1) — went quiet, gentle nudge
  //   - WARM with a non-WAIT action (priority 2) — momentum still
  //     moving but the operator hasn't pinged in
  // Excludes:
  //   - COLD (not actionable enough to be an "opportunity")
  //   - WARM with WAIT (booked deals + recently-touched, no urgent
  //     action needed)
  // Within the same momentum bucket, sort by engagementScore desc so
  // the highest-intent deal lands at the top.
  const opportunityFiltered = summaries.filter((s) => {
    if (s.momentum === "VERY_HOT") return true;
    if (s.momentum === "COOLING") return true;
    if (s.momentum === "WARM" && s.suggestedAction !== "WAIT") return true;
    return false;
  });
  const momentumPriority: Record<string, number> = {
    VERY_HOT: 0,
    COOLING: 1,
    WARM: 2,
    COLD: 3,
  };
  const opportunitiesSorted = [...opportunityFiltered].sort((a, b) => {
    const pa = momentumPriority[a.momentum] ?? 4;
    const pb = momentumPriority[b.momentum] ?? 4;
    if (pa !== pb) return pa - pb;
    return b.engagementScore - a.engagementScore;
  });
  const opportunitiesTotal = opportunitiesSorted.length;
  const opportunities = opportunitiesSorted.slice(0, 5);

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

  // ── Booking attribution — credited AISuggestions ─────────────────────
  // For each visible reservation, find the most recent AISuggestion
  // that was sent for the same proposal AND whose outcome flipped to
  // "booked" (Phase 2 wiring fires this when reservation_completed
  // lands). Surfaces as a small "Booked after WhatsApp · Day 3 snippet
  // sent 12 min before" line under the booking row — the operator's
  // first cause-and-effect signal that the system is closing deals.
  // Single batched query bounded by the visible reservation set.
  const reservationProposalIds = reservationsRaw
    .map((r) => r.proposal?.id)
    .filter((id): id is string => Boolean(id));
  const creditedRaw = reservationProposalIds.length
    ? await prisma.aISuggestion.findMany({
        where: {
          organizationId: orgId,
          kind: { in: ["follow-up", "execution"] },
          targetType: "proposal",
          targetId: { in: reservationProposalIds },
          outcome: "booked",
          sentAt: { not: null },
          bookedAt: { not: null },
        },
        orderBy: { sentAt: "desc" },
        select: {
          id: true,
          targetId: true,
          kind: true,
          channel: true,
          sentAt: true,
          bookedAt: true,
          input: true,
        },
      })
    : [];
  // Group by proposal id, keep the first (most-recent sentAt) per
  // proposal — that's the row we display credit for. Also bucket
  // every execution row per proposal so we can look up "what was
  // sent before this credit's sentAt" when computing the
  // followedSuggestion flag (see below).
  const creditedByProposal = new Map<string, (typeof creditedRaw)[number]>();
  const allExecutionsByProposal = new Map<string, (typeof creditedRaw)[number][]>();
  for (const row of creditedRaw) {
    if (!creditedByProposal.has(row.targetId)) {
      creditedByProposal.set(row.targetId, row);
    }
    if (row.kind === "execution") {
      const list = allExecutionsByProposal.get(row.targetId) ?? [];
      list.push(row);
      allExecutionsByProposal.set(row.targetId, list);
    }
  }

  const reservations = reservationsRaw.map((r) => {
    const credited = r.proposal?.id ? creditedByProposal.get(r.proposal.id) : null;
    // Decide if the credited send matches what Inspector AI's v1
    // heuristic would have suggested at the time. Only fires for
    // execution-kind credits — follow-up messages aren't day-
    // pattern actions and shouldn't claim "you followed the
    // suggested step". When matched, look up the org's booked-
    // stats bucket for the same day(s) — when ≥3 prior bookings
    // back the pattern, surface a stronger "consistently works"
    // claim; otherwise stay with the calmer "right move" copy.
    let followedSuggestion = false;
    let confidenceTier: "high" | "neutral" = "neutral";
    let creditedDayLabel: string | null = null;
    if (credited && credited.kind === "execution" && credited.sentAt) {
      const executedDays = extractDaysFromInput(credited.input);
      if (executedDays.length > 0) {
        const proposalExecutions = allExecutionsByProposal.get(credited.targetId) ?? [];
        const priorDays: number[] = [];
        for (const exec of proposalExecutions) {
          if (exec.id === credited.id) continue;
          if (!exec.sentAt) continue;
          if (exec.sentAt >= credited.sentAt) continue;
          for (const d of extractDaysFromInput(exec.input)) {
            if (!priorDays.includes(d)) priorDays.push(d);
          }
        }
        followedSuggestion = matchesNextStepHeuristic(executedDays, priorDays);
        if (followedSuggestion) {
          // Compact day phrase used inside the reinforcement
          // parens — "Day 3" / "Days 1 and 2" — distinct from the
          // longer label ("Day 3 snippet") which still drives the
          // off-script line.
          creditedDayLabel = formatExecutedDayPhrase(executedDays);
          // Confidence is "high" when the org has booked this exact
          // day pattern at least 3 times before. Single-day matches
          // check stats.byDay; multi-day matches require all days
          // to clear the threshold to qualify.
          const allBackByStats = executedDays.every((d) => {
            const stat = bookedStats.byDay.get(d);
            return stat ? stat.count >= 3 : false;
          });
          if (allBackByStats) confidenceTier = "high";
        }
      }
    }
    return {
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
      creditedSuggestion: credited
        ? {
            id: credited.id,
            kind: credited.kind,
            channel: credited.channel === "email" ? ("email" as const) : ("whatsapp" as const),
            sentAt: credited.sentAt!.toISOString(),
            bookedAt: credited.bookedAt!.toISOString(),
            label: deriveCreditLabel(credited.kind, credited.input),
            followedSuggestion,
            confidenceTier: followedSuggestion ? confidenceTier : ("neutral" as const),
            dayLabel: creditedDayLabel,
          }
        : null,
    };
  });

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
    opportunities,
    opportunitiesTotal,
    recentActivity,
    reservations,
    pipeline,
    scope,
    canViewAll,
    followUpMode,
    isPremium,
  });
}

// Pre-render the operator-facing label for a credited suggestion. We
// keep the database-side input JSON internal — the dashboard only sees
// a clean string ("Day 3 snippet" / "Days 2 and 3 snippet" / "Follow-up
// message"). Defensive against malformed input shapes — falls back to
// a generic "Follow-up message" if the days array can't be extracted.
function deriveCreditLabel(kind: string, input: unknown): string {
  if (kind === "execution") {
    const days = extractDaysFromInput(input);
    if (days.length === 1) return `Day ${days[0]} snippet`;
    if (days.length === 2) return `Day ${days[0]} and ${days[1]} snippet`;
    if (days.length > 2) {
      const head = days.slice(0, -1).join(", ");
      return `Days ${head} and ${days[days.length - 1]} snippet`;
    }
    return "Itinerary snippet";
  }
  if (kind === "follow-up") return "Follow-up message";
  return "Message";
}

// Pull a client id from an AISuggestion.input blob (the same shape
// /api/ai/execute writes for both proposal-days and preview-
// itinerary intents). Used to group preview history by client so the
// Inspector AI's "don't pile on previews" guard can fire per-client
// rather than per-org.
function extractResolvedClientId(input: unknown): string | null {
  if (!input || typeof input !== "object") return null;
  const obj = input as Record<string, unknown>;
  const resolved = obj.resolved;
  if (!resolved || typeof resolved !== "object") return null;
  const id = (resolved as Record<string, unknown>).clientId;
  return typeof id === "string" && id.trim().length > 0 ? id : null;
}

// Compact phrase used inside the reinforcement parens. Drops the
// "snippet" suffix from the credit label since the surrounding copy
// ("that was the right move (Day 3 worked here)") is more natural
// without it.
function formatExecutedDayPhrase(days: number[]): string {
  const sorted = [...days].sort((a, b) => a - b);
  if (sorted.length === 1) return `Day ${sorted[0]}`;
  if (sorted.length === 2) return `Days ${sorted[0]} and ${sorted[1]}`;
  const head = sorted.slice(0, -1).join(", ");
  return `Days ${head} and ${sorted[sorted.length - 1]}`;
}

