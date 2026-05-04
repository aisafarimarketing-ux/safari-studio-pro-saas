// Inspector AI — read-only "what to do next" suggester.
//
// Pure deterministic heuristics over the existing data we already
// have on each deal: momentum, engagement signals, sent-suggestion
// history. Returns at most ONE suggestion per deal, or null when
// the dashboard should stay quiet.
//
// Spec is explicit: no automation, no AI generation, no schema
// changes, no charts. This module is the "why don't I just ask the
// model what to do next?" temptation deliberately resisted. The
// rules below are the operator's playbook codified — they're easy
// to extend, easy to reason about, and easy to silence if a bucket
// ever feels noisy.

import type { DealMomentum } from "@/lib/dealMomentum";
import type { LeadMomentum } from "@/lib/leadMomentum";

export type InspectorSuggestion = {
  /** Operator-readable line. Already includes the why. */
  message: string;
  /** Button label when the suggestion has an actionable next step.
   *  Omit when the suggestion is purely informational. */
  actionLabel?: string;
  /** Command-bar prefill — the literal string we drop into the ⌘K
   *  input when the operator clicks the action button. Lets one
   *  click flow into the existing Execution AI pipeline without
   *  duplicating any send logic. */
  actionCommand?: string;
};

// Aggregated behaviour signals for the share-view tracker. Sourced from
// /api/dashboard/activity which rolls up ProposalViewEvent.dwellSeconds
// (bucketed by sectionType) + ProposalView.scrollDepthPct across all
// anonymous viewer sessions of one proposal.
//
// Inspector AI uses these to upgrade VERY_HOT suggestions from "they
// engaged" (boolean signals like priceViewed) to "they engaged for X
// minutes" — the dwell signal is what tells "casual glance" from "they
// keep coming back".
export type InspectorBehaviorStats = {
  pricingDwellSeconds: number;
  dayDwellSeconds: number;
  totalDwellSeconds: number;
  /** Max scroll depth observed across sessions, 0–100. 0 means the
   *  viewer never scrolled (cover-only view) or no sessions exist
   *  yet. Used as a "did they reach later days?" signal — anything
   *  below ~40 means the client bounced before the heart of the
   *  proposal. */
  maxScrollPct: number;
  sessionCount: number;
};

export type InspectorInput = {
  momentum: DealMomentum;
  lastEventType: string | null;
  priceViewed: boolean;
  clickedReservation: boolean;
  reservationCompleted: boolean;
  /** Most recent sentAt across ANY operator-side suggestion for this
   *  deal — covers both the auto-send / follow-up surface and the
   *  Execution AI command-bar surface. Null when no message has
   *  ever been sent. */
  lastSentAt: Date | null;
  /** Unique sorted list of day numbers the operator has previously
   *  sent via the Execution AI (extracted from
   *  AISuggestion.input.resolved.days). Empty when no execution
   *  snippet has fired for this deal. */
  priorDaysSent: number[];
  /** Most recent sentAt for any preview-itinerary the operator has
   *  sent to this client (any itinerary type, any channel). Null
   *  when none has ever been sent. Used to gate the COOLING / COLD
   *  preview-suggestion branches: don't suggest sending another
   *  preview if one went out in the last 24h. */
  lastPreviewSentAt: Date | null;
  /** Used in the action-command prefill so the operator's ⌘K input
   *  reads naturally ("send Jennifer day 3"). Null falls back to
   *  the literal "client". */
  clientFirstName: string | null;
  /** Aggregated share-view behaviour signals. Null when no view
   *  sessions exist yet. The VERY_HOT branch reads these to lead
   *  with the strongest dwell signal (pricing > day > scroll); the
   *  other momentum buckets ignore them in v1. */
  behaviorStats: InspectorBehaviorStats | null;
  /** For testability. Defaults to current time. */
  now?: Date;
};

// Don't fire a suggestion when the operator just sent something —
// the spec treats anything in the last 2 hours as "already in
// motion". Mirrors the canAutoSend "don't double-tap" rule.
const RECENT_SEND_WINDOW_MS = 2 * 60 * 60 * 1000;
// Tighter "don't pile on previews" window — once a sample itinerary
// goes out, the next preview suggestion stays muted for 24h. The
// operator can still send another preview manually via the Command
// Bar; this only suppresses the chip's nudge.
const PREVIEW_QUIET_WINDOW_MS = 24 * 60 * 60 * 1000;

export function suggestNextStep(input: InspectorInput): InspectorSuggestion | null {
  const now = input.now ?? new Date();

  // Booked: closing surface is the operator's job, not ours.
  if (input.reservationCompleted) return null;

  // Recently sent: hold off so we don't feel pushy.
  if (
    input.lastSentAt &&
    now.getTime() - input.lastSentAt.getTime() < RECENT_SEND_WINDOW_MS
  ) {
    return null;
  }

  const name = input.clientFirstName?.trim() || "this client";
  const cmdName = (input.clientFirstName?.trim() || "client").toLowerCase();
  const lastDay = input.priorDaysSent.length > 0 ? Math.max(...input.priorDaysSent) : null;
  const nextDay = lastDay !== null ? lastDay + 1 : null;
  const sentSomethingBefore = lastDay !== null;

  // ─── VERY_HOT ────────────────────────────────────────────────────
  // Highest-leverage moment. The operator should act now. Bias toward
  // a buying-signal-aware suggestion (pricing → clarification) over
  // a pitch. Behaviour-signal branches run BEFORE the boolean ones —
  // dwell time is a stronger intent signal than the one-shot
  // priceViewed / itinerary_clicked flags.
  if (input.momentum === "VERY_HOT") {
    const stats = input.behaviorStats;

    // Pricing dwell — they're sitting on the price page. The
    // strongest pre-buy signal we have. Threshold tuned to filter
    // out scroll-throughs (a client glancing past pricing on the
    // way down rarely lingers more than 30s on the section).
    if (stats && stats.pricingDwellSeconds >= 60) {
      return {
        message: `They've spent ${formatDwell(stats.pricingDwellSeconds)} on pricing — they're evaluating. A clarifying note often unsticks this.`,
        actionLabel: "Open command",
      };
    }
    if (input.lastEventType === "price_viewed" || input.priceViewed) {
      // Pricing-stuck moments deserve a clarifying message, not a
      // next-day push. Pricing answers tend to be bespoke, so the
      // CTA opens the command bar without a prefilled snippet —
      // operator types the actual clarification.
      return {
        message: "They're evaluating — a quick clarification helps here.",
        actionLabel: "Open command",
      };
    }
    if (input.clickedReservation) {
      return {
        message: "They opened the reservation form — a short nudge with arrival logistics often closes from here.",
        actionLabel: "Open command",
      };
    }
    // Day dwell — sustained time on the day cards. Same intent as
    // an itinerary click, but stronger: they've been reading, not
    // just tapping. Suggest the next day to keep the picture moving.
    if (stats && stats.dayDwellSeconds >= 90) {
      if (sentSomethingBefore && nextDay !== null) {
        return {
          message: `${formatDwell(stats.dayDwellSeconds)} on the day cards — Day ${nextDay} keeps the picture moving while it's fresh.`,
          actionLabel: `Send Day ${nextDay}`,
          actionCommand: `send ${cmdName} day ${nextDay}`,
        };
      }
      return {
        message: `${formatDwell(stats.dayDwellSeconds)} on the day cards — share Day 1 and 2 to keep momentum.`,
        actionLabel: "Send Day 1 and 2",
        actionCommand: `send ${cmdName} day 1 and 2`,
      };
    }
    if (input.lastEventType === "itinerary_clicked") {
      // Itinerary engagement = client is imagining the trip. A
      // next-day snippet (or first day if nothing sent) keeps that
      // visualisation fresh.
      if (sentSomethingBefore && nextDay !== null) {
        return {
          message: "They're imagining the trip — share the next day to keep it vivid.",
          actionLabel: `Send Day ${nextDay}`,
          actionCommand: `send ${cmdName} day ${nextDay}`,
        };
      }
      return {
        message: "They're imagining the trip — a snippet of the first couple of days helps them see it.",
        actionLabel: "Send Day 1 and 2",
        actionCommand: `send ${cmdName} day 1 and 2`,
      };
    }
    // Low scroll depth — they're VERY_HOT (recent activity) but
    // never reached past the cover/intro area. Different play from
    // the day-by-day pitch: a tight highlight pulls them back into
    // the proposal. Skip when no scroll data exists yet (sessionless
    // VERY_HOT happens when the only activity is a click on the
    // reservation form, which other branches already cover).
    if (
      stats &&
      stats.sessionCount > 0 &&
      stats.maxScrollPct > 0 &&
      stats.maxScrollPct < 40
    ) {
      return {
        message: `They opened the proposal but only scrolled to ${stats.maxScrollPct}% — a tight highlight pulls them back in.`,
        actionLabel: "Send preview",
        actionCommand: `send a 5 day safari to ${cmdName}`,
      };
    }
    if (sentSomethingBefore && nextDay !== null) {
      return {
        message: `You sent Day ${lastDay} earlier — Day ${nextDay} often works next while attention is fresh.`,
        actionLabel: `Send Day ${nextDay}`,
        actionCommand: `send ${cmdName} day ${nextDay}`,
      };
    }
    // No prior send. Suggest the opening salvo: days 1 and 2 give the
    // client a feel for the trip without overwhelming.
    return {
      message: `${name} is active right now — a snippet of the first couple of days often lands well.`,
      actionLabel: "Send Day 1 and 2",
      actionCommand: `send ${cmdName} day 1 and 2`,
    };
  }

  // ─── WARM ────────────────────────────────────────────────────────
  // Activity in the last 24h but not red-hot. Worth nudging only
  // when we have a clear "next thing" to send.
  if (input.momentum === "WARM") {
    if (sentSomethingBefore && nextDay !== null) {
      return {
        message: `Momentum's still moving — Day ${nextDay} keeps the conversation going.`,
        actionLabel: `Send Day ${nextDay}`,
        actionCommand: `send ${cmdName} day ${nextDay}`,
      };
    }
    // Warm but no prior send: stay quiet. The dashboard's existing
    // "Send now" button on the deal card already covers this.
    return null;
  }

  // Preview-suggestion guard: if we've already sent a preview in the
  // last 24h, the operator's playbook says give the client time —
  // don't pile on another preview right away. Falls through to the
  // existing day-pattern branches when applicable.
  const previewRecentlySent =
    input.lastPreviewSentAt !== null &&
    now.getTime() - input.lastPreviewSentAt.getTime() < PREVIEW_QUIET_WINDOW_MS;

  // Was the deal sent something within the last day, regardless of
  // the 2h "don't double-tap" window above? Used by the COOLING
  // branch to decide between "Day N+1" follow-ups and a fresh
  // preview to restart the conversation.
  const longQuietGate =
    input.lastSentAt === null ||
    now.getTime() - input.lastSentAt.getTime() > 24 * 60 * 60 * 1000;
  // Two-day-plus quiet — beyond a normal weekend, the conversation
  // is genuinely stalled. Triggers a softer "check-in" copy variant
  // rather than another preview push.
  const veryLongQuiet =
    input.lastSentAt !== null &&
    now.getTime() - input.lastSentAt.getTime() > 48 * 60 * 60 * 1000;

  // ─── COOLING ─────────────────────────────────────────────────────
  // Quiet for a day or two. Two flavours of nudge:
  //   - When the operator's mid-conversation (sent days before),
  //     suggest the next day to keep momentum.
  //   - When it's been quiet for >24h AND no preview has gone out
  //     in the last day, suggest a preview as a softer re-opener.
  if (input.momentum === "COOLING") {
    if (sentSomethingBefore && nextDay !== null) {
      return {
        message: `Quiet for a day or two — sending Day ${nextDay} reopens the conversation without sounding like a chase.`,
        actionLabel: `Send Day ${nextDay}`,
        actionCommand: `send ${cmdName} day ${nextDay}`,
      };
    }
    // Two-day-plus stall: drop the preview push, suggest a plain
    // check-in. Operator usually knows the right line at this stage.
    if (veryLongQuiet) {
      return {
        message: "A quick check-in can restart this.",
        actionLabel: "Open command",
      };
    }
    if (longQuietGate && !previewRecentlySent) {
      return {
        message: "Quiet for a day — a short safari preview often reopens the conversation.",
        actionLabel: "Send preview",
        actionCommand: `send a 5 day safari to ${cmdName}`,
      };
    }
    return {
      message: "Quiet for a day or two — a brief check-in often re-opens the conversation.",
      actionLabel: "Open command",
    };
  }

  // ─── COLD ────────────────────────────────────────────────────────
  // No engagement, nothing sent. The textbook "start a conversation"
  // play is a sample itinerary — gives the client something to react
  // to without committing to a full proposal yet.
  if (input.momentum === "COLD") {
    if (!sentSomethingBefore && !previewRecentlySent) {
      return {
        message: `No engagement yet — share a sample safari to start the conversation.`,
        actionLabel: "Send preview",
        actionCommand: `send a 5 day safari to ${cmdName}`,
      };
    }
    // Sent days before but went cold, or a preview already went out
    // recently — stay quiet so we don't pile on.
    return null;
  }

  return null;
}

// Pure check: do the executed days match what suggestNextStep would
// have suggested *at the time of this send*, given the prior sent days?
//
// Used by the booking-attribution surface to detect "the operator
// followed Inspector AI's suggestion and the deal closed." Strict by
// design — we only credit a clean match (exact next adjacent day, or
// the canonical opener Day 1+2 when there were no priors). Anything
// else falls through to the generic "Booked after X" line so we
// never overstate the system's role.
//
// Pure; no IO; no LLM. Called server-side per credit.
export function matchesNextStepHeuristic(
  executedDays: number[],
  priorDaysSent: number[],
): boolean {
  if (executedDays.length === 0) return false;
  const sortedExecuted = Array.from(new Set(executedDays))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
  if (sortedExecuted.length === 0) return false;
  const sortedPrior = Array.from(new Set(priorDaysSent))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);

  if (sortedPrior.length === 0) {
    // Heuristic with no priors → "Send Day 1 and 2".
    // Treat any subset of {1, 2} as a match — sending Day 1 alone
    // still represents "the operator took the suggested opening
    // path", and Day 1+2 is the canonical match.
    if (sortedExecuted.length === 2 && sortedExecuted[0] === 1 && sortedExecuted[1] === 2) {
      return true;
    }
    if (sortedExecuted.length === 1 && (sortedExecuted[0] === 1 || sortedExecuted[0] === 2)) {
      return true;
    }
    return false;
  }

  // Heuristic with priors → "Send Day {max(prior) + 1}".
  const lastPriorMax = sortedPrior[sortedPrior.length - 1];
  return sortedExecuted.length === 1 && sortedExecuted[0] === lastPriorMax + 1;
}

// ─── Lead-side suggester ────────────────────────────────────────────────
//
// Sibling of suggestNextStep for the pre-proposal funnel. Reads
// LeadMomentum + send/preview history; returns the same
// InspectorSuggestion shape so the dashboard can render lead chips
// with the existing render code. The CTA always opens the Command
// Bar with a preview-prefilled command — leads have no proposal, so
// preview-itinerary is the only execution path that fits.
//
// Same guards as the deal suggester:
//   - sent in last 2h → silent (don't double-tap)
//   - preview sent in last 24h → silent (don't pile on previews)
// Plus: if a lead is somehow in a state where no preview makes sense
// (no contact method, etc.), the caller filters before calling us;
// we don't try to handle those cases here.

export type LeadInspectorInput = {
  momentum: LeadMomentum;
  /** Most recent operator-side outbound (any kind / channel) for
   *  this lead. Null when nothing's been sent. */
  lastSentAt: Date | null;
  /** Most recent preview-itinerary send for this lead's client. Null
   *  when no preview has gone out. */
  lastPreviewSentAt: Date | null;
  clientFirstName: string | null;
  /** For testability. */
  now?: Date;
};

export function suggestNextStepForLead(
  input: LeadInspectorInput,
): InspectorSuggestion | null {
  const now = input.now ?? new Date();

  // Same recent-send guard as deals — don't suggest sending another
  // message right after an outbound went.
  if (
    input.lastSentAt &&
    now.getTime() - input.lastSentAt.getTime() < RECENT_SEND_WINDOW_MS
  ) {
    return null;
  }
  // Don't pile on previews — once a sample itinerary went out, give
  // it 24h to land before the chip nudges another one.
  if (
    input.lastPreviewSentAt &&
    now.getTime() - input.lastPreviewSentAt.getTime() < PREVIEW_QUIET_WINDOW_MS
  ) {
    return null;
  }

  const cmdName = (input.clientFirstName?.trim() || "client").toLowerCase();

  if (input.momentum === "VERY_ACTIVE") {
    // The "warm now, send while attention is fresh" moment. Spec
    // example: "Send Day 1 and 2 preview". Our canonical previews
    // are whole-itinerary (3/5/7-day), so the prefill stays a
    // 5-day preview — but the chip copy leans into the urgency.
    return {
      message: "Lead is active right now — sharing a sample safari while attention is fresh lands well.",
      actionLabel: "Send preview",
      actionCommand: `send a 5 day safari to ${cmdName}`,
    };
  }
  if (input.momentum === "QUIET") {
    return {
      message: "Quiet lead — a short safari preview can re-open the conversation.",
      actionLabel: "Send preview",
      actionCommand: `send a 5 day safari to ${cmdName}`,
    };
  }
  // NEW
  return {
    message: "New lead — share a sample safari to start the conversation.",
    actionLabel: "Send preview",
    actionCommand: `send a 5 day safari to ${cmdName}`,
  };
}

// ─── Live activity interpretation ───────────────────────────────────────
//
// Surfaces a short "what's happening right now" string for the deal
// card's live-activity strip. Reads from the engagement events the
// share-view tracker is already firing (lastEventAt + lastEventType
// on every ProposalActivitySummary). No new tracking needed — recency
// thresholds give the live feel.
//
// State tiers:
//   "viewing"     — last event within 60s. Present-tense label
//                   ("Viewing pricing"). Used when the operator might
//                   literally be watching the client right now.
//   "just-acted"  — last event 60s–5min ago. Past-tense label
//                   ("Just viewed pricing · 2 min ago").
//   null          — older than 5 min, or no events at all. Strip
//                   suppressed entirely.

export type LiveActivity = {
  state: "viewing" | "just-acted";
  /** One-line operator-readable label. Already includes timing
   *  context for the "just-acted" state. */
  label: string;
};

const LIVE_VIEWING_WINDOW_MS = 60 * 1000;
const LIVE_RECENT_WINDOW_MS = 5 * 60 * 1000;

export function deriveLiveActivity(input: {
  lastEventAt: Date | null;
  lastEventType: string | null;
  reservationCompleted: boolean;
  now?: Date;
}): LiveActivity | null {
  if (input.reservationCompleted) return null;
  if (!input.lastEventAt) return null;
  const now = input.now ?? new Date();
  const diffMs = now.getTime() - input.lastEventAt.getTime();
  if (diffMs > LIVE_RECENT_WINDOW_MS) return null;

  const isViewing = diffMs <= LIVE_VIEWING_WINDOW_MS;
  if (isViewing) {
    return {
      state: "viewing",
      label: presentLabel(input.lastEventType),
    };
  }
  const minsAgo = Math.max(1, Math.round(diffMs / 60_000));
  return {
    state: "just-acted",
    label: `${pastLabel(input.lastEventType)} · ${minsAgo} min ago`,
  };
}

function presentLabel(eventType: string | null): string {
  switch (eventType) {
    case "price_viewed":
      return "Viewing pricing";
    case "itinerary_clicked":
      return "Tapping the itinerary";
    case "proposal_scrolled":
      return "Reading proposal";
    case "proposal_viewed":
      return "Reading proposal";
    case "reservation_started":
      return "On the reservation form";
    case "reservation_completed":
      return "Completing reservation";
    default:
      return "Active on the proposal";
  }
}

function pastLabel(eventType: string | null): string {
  switch (eventType) {
    case "price_viewed":
      return "Just viewed pricing";
    case "itinerary_clicked":
      return "Just tapped the itinerary";
    case "proposal_scrolled":
      return "Just read through the proposal";
    case "proposal_viewed":
      return "Just opened the proposal";
    case "reservation_started":
      return "Just opened the reservation form";
    case "reservation_completed":
      return "Just submitted reservation";
    default:
      return "Just active on the proposal";
  }
}

// Helper for callers that have a raw input JSON blob (the same shape
// /api/ai/execute writes into AISuggestion.input). Extracts the days
// safely; returns [] on any malformed shape.
export function extractDaysFromInput(input: unknown): number[] {
  if (!input || typeof input !== "object") return [];
  const obj = input as Record<string, unknown>;
  const resolved = obj.resolved;
  if (!resolved || typeof resolved !== "object") return [];
  const d = (resolved as Record<string, unknown>).days;
  if (!Array.isArray(d)) return [];
  return d.filter(
    (n): n is number => typeof n === "number" && Number.isFinite(n) && n > 0,
  );
}

// ─── Outcome-aware aggregation (Inspector AI v2) ────────────────────────
//
// Cheap aggregation over the org's booked AISuggestion history so the
// per-card suggestion can lead with what's actually worked instead of
// a static rule. Computed once per dashboard load (single bounded
// query, JS-side rollup) and shared across every card the suggester
// processes.
//
// Sample-size discipline: only surface a stat when the bucket has at
// least STATS_MIN_SAMPLE bookings (default 3). Below that, the
// suggester falls back to the v1 heuristic message — a noisy stat
// ("1 deal closed after Day 7") would feel arbitrary.

export type BookedDayStat = {
  /** How many booked AISuggestions had this day in their resolved.days. */
  count: number;
  /** Median minutes between sentAt and bookedAt across those bookings. */
  medianMinutes: number;
  whatsappCount: number;
  emailCount: number;
};

export type BookedStats = {
  totalBooked: number;
  byDay: Map<number, BookedDayStat>;
};

const STATS_MIN_SAMPLE = 3;

// Aggregate raw booked-suggestion rows into a queryable stat shape.
// Pure function; deterministic; bounded by rows.length × max days
// per row (in practice tiny). The caller filters to outcome="booked"
// + sentAt + bookedAt set; we re-check defensively.
export function aggregateBookedStats(
  rows: Array<{
    channel: string | null;
    sentAt: Date | null;
    bookedAt: Date | null;
    input: unknown;
  }>,
): BookedStats {
  type Bucket = {
    count: number;
    totals: number[];
    whatsappCount: number;
    emailCount: number;
  };
  const buckets = new Map<number, Bucket>();
  let totalBooked = 0;

  for (const row of rows) {
    if (!row.sentAt || !row.bookedAt) continue;
    totalBooked += 1;
    const days = extractDaysFromInput(row.input);
    if (days.length === 0) continue;
    const dtMin = Math.max(
      0,
      (row.bookedAt.getTime() - row.sentAt.getTime()) / 60_000,
    );
    for (const d of days) {
      const e = buckets.get(d) ?? {
        count: 0,
        totals: [],
        whatsappCount: 0,
        emailCount: 0,
      };
      e.count += 1;
      e.totals.push(dtMin);
      if (row.channel === "whatsapp") e.whatsappCount += 1;
      else if (row.channel === "email") e.emailCount += 1;
      buckets.set(d, e);
    }
  }

  const byDay = new Map<number, BookedDayStat>();
  for (const [d, v] of buckets.entries()) {
    v.totals.sort((a, b) => a - b);
    const median = v.totals.length > 0 ? v.totals[Math.floor(v.totals.length / 2)] : 0;
    byDay.set(d, {
      count: v.count,
      medianMinutes: Math.round(median),
      whatsappCount: v.whatsappCount,
      emailCount: v.emailCount,
    });
  }
  return { totalBooked, byDay };
}

// Inspector AI v2 — outcome-aware. Calls suggestNextStep first
// (the v1 rules) to get the candidate next action, then tries to
// upgrade the message with real stats when the bucket has enough
// data to be trustworthy. Falls back cleanly to v1 when stats are
// missing or below the sample threshold.
export function suggestNextStepWithStats(
  input: InspectorInput,
  stats: BookedStats | null | undefined,
): InspectorSuggestion | null {
  const base = suggestNextStep(input);
  if (!base || !stats || stats.totalBooked === 0) return base;

  // Only the day-pattern suggestions can be data-validated. The
  // open-ended ones ("answer a pricing question") don't have a
  // matching aggregation bucket; leave them as heuristic copy.
  const dayMatch = base.actionCommand?.match(/day (\d+)/i);
  if (!dayMatch) return base;

  const day = parseInt(dayMatch[1], 10);
  const stat = stats.byDay.get(day);
  if (!stat || stat.count < STATS_MIN_SAMPLE) return base;

  const timePhrase = formatMinutes(stat.medianMinutes);
  const channelPhrase = dominantChannelPhrase(stat);
  const message =
    `${stat.count} similar bookings closed within ${timePhrase} after sending Day ${day}${channelPhrase}.`;
  return { ...base, message };
}

function formatMinutes(min: number): string {
  if (min < 1) return "<1 min";
  if (min < 60) return `${min} min`;
  if (min < 24 * 60) {
    const hours = Math.round(min / 60);
    return `${hours} h`;
  }
  const days = Math.round(min / (24 * 60));
  return `${days} d`;
}

// Operator-facing dwell formatting. Distinct from formatMinutes —
// dwell is in seconds and we want sub-minute granularity ("45s on
// pricing" reads better than "<1 min on pricing"). Above a minute we
// round down to whole minutes so the chip stays compact.
function formatDwell(seconds: number): string {
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))}s`;
  const min = Math.round(seconds / 60);
  if (min < 60) return `${min} min`;
  const hours = Math.round(min / 60);
  return `${hours} h`;
}

// Surface a channel hint only when one channel clearly dominates
// (≥70% share AND at least 2 bookings on that channel). Avoids
// claiming "via WhatsApp" off a 2-vs-1 split that's basically noise.
function dominantChannelPhrase(stat: BookedDayStat): string {
  const total = stat.whatsappCount + stat.emailCount;
  if (total < 3) return "";
  const waRatio = stat.whatsappCount / total;
  if (waRatio >= 0.7 && stat.whatsappCount >= 2) return " via WhatsApp";
  if (waRatio <= 0.3 && stat.emailCount >= 2) return " via Email";
  return "";
}
