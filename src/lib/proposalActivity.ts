import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

// ─── Proposal activity layer ─────────────────────────────────────────────
//
// One write path for every event that lands on a proposal:
//   recordProposalEvent(...)
// → inserts a ProposalEvent row (append-only org-level log)
// → upserts the per-proposal ProposalActivitySummary
// → recomputes engagementScore + status + nextAction
// All inside a single $transaction so a slow read on the summary can't
// race a write and clobber the counters.
//
// Read path: dashboard endpoints select ProposalActivitySummary rows
// directly. The score / status / next-action columns are precomputed,
// so "what's hot today" answers without scanning the event log.
// "needs_followup" is the one status that's still derived at read time
// from lastEventAt vs now (so it doesn't go stale waiting on a cron).

export const PROPOSAL_EVENT_TYPES = [
  "proposal_viewed",
  "proposal_scrolled",
  "itinerary_clicked",
  "price_viewed",
  "reservation_started",
  "reservation_completed",
] as const;

export type ProposalEventType = (typeof PROPOSAL_EVENT_TYPES)[number];

export function isProposalEventType(v: unknown): v is ProposalEventType {
  return typeof v === "string" && (PROPOSAL_EVENT_TYPES as readonly string[]).includes(v);
}

// Score weights. Spec-driven; bookings dominate so a single completion
// guarantees hot status regardless of prior activity.
export const EVENT_SCORES: Record<ProposalEventType, number> = {
  proposal_viewed: 20,
  proposal_scrolled: 10,
  itinerary_clicked: 15,
  price_viewed: 15,
  reservation_started: 30,
  reservation_completed: 100,
};

// Status thresholds.
const HOT_THRESHOLD = 70;
const WARM_THRESHOLD = 40;

// Followup window for the "viewed but no action" rule.
const FOLLOWUP_AFTER_HOURS = 48;

export type ProposalStatus =
  | "watching"
  | "warm"
  | "hot"
  | "needs_followup"
  | "booked";

// ─── Public API ─────────────────────────────────────────────────────────

export async function recordProposalEvent(input: {
  organizationId: string;
  proposalId: string;
  clientId?: string | null;
  userId?: string | null;
  eventType: ProposalEventType;
  metadata?: Record<string, unknown> | null;
  /** Optional override for the event's createdAt — defaults to now.
   *  Useful when backfilling or replaying events; production callers
   *  should leave this unset. */
  occurredAt?: Date;
}): Promise<void> {
  const occurredAt = input.occurredAt ?? new Date();

  // Single transaction so the event row + summary upsert can't drift.
  await prisma.$transaction(async (tx) => {
    await tx.proposalEvent.create({
      data: {
        organizationId: input.organizationId,
        proposalId: input.proposalId,
        clientId: input.clientId ?? null,
        userId: input.userId ?? null,
        eventType: input.eventType,
        metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        createdAt: occurredAt,
      },
    });

    const existing = await tx.proposalActivitySummary.findUnique({
      where: { proposalId: input.proposalId },
    });

    // Compute the new state. We read existing flags so booleans stay
    // monotonic (once true, never false) and the score doesn't double-
    // count flag-style events on repeat fires.
    const next = applyEventToSummary(existing, input.eventType, occurredAt);

    await tx.proposalActivitySummary.upsert({
      where: { proposalId: input.proposalId },
      create: {
        organizationId: input.organizationId,
        proposalId: input.proposalId,
        clientId: input.clientId ?? null,
        ...next,
      },
      update: {
        // organizationId never changes after create; clientId can be
        // backfilled from the event when the row had none.
        clientId: input.clientId ?? existing?.clientId ?? null,
        ...next,
      },
    });
  });

  // ── Outcome wiring (Phase 2) ────────────────────────────────────────
  // When a reservation completes, every operator-side AI suggestion
  // that was sent for this proposal is retroactively flagged as
  // having helped close the deal. Powers the future "what kinds of
  // follow-ups actually convert?" analytics, and surfaces a clean
  // sent → opened → replied → BOOKED state on suggestion rows that
  // would otherwise stop at "sent".
  //
  // Best-effort + outside the main transaction: a failure here must
  // never block the booking from being recorded. We log + continue.
  if (input.eventType === "reservation_completed") {
    try {
      const result = await prisma.aISuggestion.updateMany({
        where: {
          organizationId: input.organizationId,
          // Operator-to-client outbound surfaces. Reservation summaries
          // and any future internal-only kinds stay out of this loop.
          kind: { in: ["follow-up", "execution"] },
          targetType: "proposal",
          targetId: input.proposalId,
          // Only credit suggestions that actually went out, and only
          // those still pending an outcome — this keeps the function
          // idempotent if reservation_completed fires twice.
          sentAt: { not: null },
          bookedAt: null,
        },
        data: {
          bookedAt: occurredAt,
          outcome: "booked",
        },
      });
      if (result.count > 0) {
        console.log(
          `[proposalActivity] reservation_completed · proposal=${input.proposalId} · credited ${result.count} sent suggestion(s) as booked`,
        );
      }
    } catch (err) {
      console.warn(
        "[proposalActivity] outcome backfill failed (non-blocking):",
        err,
      );
    }
  }
}

// ─── Pure transform — easier to reason about + unit-testable ─────────────

type SummaryShape = {
  lastEventType: string | null;
  lastEventAt: Date | null;
  viewedCount: number;
  scrolledCount: number;
  itineraryClicked: boolean;
  priceViewed: boolean;
  clickedReservation: boolean;
  reservationCompleted: boolean;
  engagementScore: number;
  nextAction: string;
  status: ProposalStatus;
};

function applyEventToSummary(
  existing:
    | {
        viewedCount: number;
        scrolledCount: number;
        itineraryClicked: boolean;
        priceViewed: boolean;
        clickedReservation: boolean;
        reservationCompleted: boolean;
        engagementScore: number;
      }
    | null,
  eventType: ProposalEventType,
  occurredAt: Date,
): SummaryShape {
  const base = existing ?? {
    viewedCount: 0,
    scrolledCount: 0,
    itineraryClicked: false,
    priceViewed: false,
    clickedReservation: false,
    reservationCompleted: false,
    engagementScore: 0,
  };

  let viewedCount = base.viewedCount;
  let scrolledCount = base.scrolledCount;
  let itineraryClicked = base.itineraryClicked;
  let priceViewed = base.priceViewed;
  let clickedReservation = base.clickedReservation;
  let reservationCompleted = base.reservationCompleted;
  let score = base.engagementScore;

  switch (eventType) {
    case "proposal_viewed":
      // Count every view but only the first contributes to score.
      // (Repeat views on the same /p/[id] add to engagement via the
      // existing ProposalView session metrics already.)
      viewedCount += 1;
      if (viewedCount === 1) score += EVENT_SCORES.proposal_viewed;
      break;
    case "proposal_scrolled":
      scrolledCount += 1;
      if (scrolledCount === 1) score += EVENT_SCORES.proposal_scrolled;
      break;
    case "itinerary_clicked":
      if (!itineraryClicked) score += EVENT_SCORES.itinerary_clicked;
      itineraryClicked = true;
      break;
    case "price_viewed":
      if (!priceViewed) score += EVENT_SCORES.price_viewed;
      priceViewed = true;
      break;
    case "reservation_started":
      if (!clickedReservation) score += EVENT_SCORES.reservation_started;
      clickedReservation = true;
      break;
    case "reservation_completed":
      if (!reservationCompleted) score += EVENT_SCORES.reservation_completed;
      reservationCompleted = true;
      break;
  }

  // Clamp the score so a chatty client can't push a single proposal
  // into the high hundreds via repeat events that bypass the dedupe
  // (e.g. multiple sessions). Hot threshold is 70; cap at 200 so the
  // sort within "hot" still has some room to breathe.
  if (score > 200) score = 200;

  return {
    lastEventType: eventType,
    lastEventAt: occurredAt,
    viewedCount,
    scrolledCount,
    itineraryClicked,
    priceViewed,
    clickedReservation,
    reservationCompleted,
    engagementScore: score,
    nextAction: deriveNextAction({
      reservationCompleted,
      clickedReservation,
      priceViewed,
      itineraryClicked,
      lastEventAt: occurredAt,
    }),
    status: deriveStatus({
      reservationCompleted,
      score,
      lastEventAt: occurredAt,
      viewedCount,
    }),
  };
}

// ─── Status / next-action derivation ─────────────────────────────────────
//
// Exposed so dashboard read paths can re-derive `needs_followup` at read
// time (the only status that depends on wall-clock staleness).

export function deriveStatus(input: {
  reservationCompleted: boolean;
  score: number;
  lastEventAt: Date | null;
  viewedCount: number;
  /** Pass `now` from the caller for testability; defaults to current time. */
  now?: Date;
}): ProposalStatus {
  const now = input.now ?? new Date();
  if (input.reservationCompleted) return "booked";

  // Followup rule overrides plain score-based status: any proposal
  // that's been viewed and gone quiet for 48h+ becomes a follow-up.
  if (
    input.viewedCount > 0 &&
    input.lastEventAt &&
    now.getTime() - input.lastEventAt.getTime() > FOLLOWUP_AFTER_HOURS * 3_600_000
  ) {
    return "needs_followup";
  }

  if (input.score >= HOT_THRESHOLD) return "hot";
  if (input.score >= WARM_THRESHOLD) return "warm";
  return "watching";
}

export function deriveNextAction(input: {
  reservationCompleted: boolean;
  clickedReservation: boolean;
  priceViewed: boolean;
  itineraryClicked: boolean;
  lastEventAt: Date | null;
  /** Pass `now` from the caller for testability; defaults to current time. */
  now?: Date;
}): string {
  // Order matters — most-actionable signal wins.
  if (input.reservationCompleted) return "Booking confirmed";
  if (input.clickedReservation) return "Help client finish reservation";
  if (input.priceViewed) return "Answer pricing questions";
  if (input.itineraryClicked) return "Send personal note";

  const now = input.now ?? new Date();
  if (
    input.lastEventAt &&
    now.getTime() - input.lastEventAt.getTime() > FOLLOWUP_AFTER_HOURS * 3_600_000
  ) {
    return "Follow up now";
  }

  return "Keep watching";
}

// ─── Read-time staleness recheck ─────────────────────────────────────────
//
// Reads of ProposalActivitySummary go through this so a row whose
// underlying status went stale since the last write (e.g. nobody's
// touched it for 49h) flips to needs_followup at read time without
// needing a periodic job.
export function refreshStatusForRead<
  T extends {
    status: ProposalStatus | string;
    reservationCompleted: boolean;
    engagementScore: number;
    lastEventAt: Date | null;
    viewedCount: number;
    nextAction: string;
    priceViewed: boolean;
    itineraryClicked: boolean;
    clickedReservation: boolean;
  },
>(row: T, now: Date = new Date()): T {
  const status = deriveStatus({
    reservationCompleted: row.reservationCompleted,
    score: row.engagementScore,
    lastEventAt: row.lastEventAt,
    viewedCount: row.viewedCount,
    now,
  });
  const nextAction = deriveNextAction({
    reservationCompleted: row.reservationCompleted,
    clickedReservation: row.clickedReservation,
    priceViewed: row.priceViewed,
    itineraryClicked: row.itineraryClicked,
    lastEventAt: row.lastEventAt,
    now,
  });
  return { ...row, status, nextAction };
}
