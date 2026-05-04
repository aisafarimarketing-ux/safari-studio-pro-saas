// Inspector AI — read-only "what to do next" suggester.
//
// Pure deterministic heuristics over the existing data we already
// have on each deal: momentum, engagement signals, sent-suggestion
// history. Returns at most ONE suggestion per deal, or null when
// the dashboard should stay quiet.
//
// ─── Decision rubric ──────────────────────────────────────────────────
//
// One question drives every branch: "what is the client trying to
// figure out right now?" — NOT what was sent last, NOT what step
// comes next in a fixed sequence.
//
// Four actions, exactly one chosen per call:
//
//   1. PREVIEW   → send a sample itinerary (no proposal needed).
//                  Use for new / cold leads to make the trip feel real.
//
//   2. SNIPPET   → send a focused piece of the trip. Strict rule: only
//                  fires as the canonical opener (Day 1+2) BEFORE a
//                  full proposal exists. Once priorDaysSent.length > 0
//                  we never auto-suggest "Day N+1" — the operator
//                  picks the specific snippet that answers a real
//                  question via the Command Bar instead.
//
//   3. PRICING   → send a clear pricing breakdown. Triggered by any
//                  price-evaluation signal (price_viewed flag, sustained
//                  pricing dwell).
//
//   4. NONE      → return null. The default whenever nothing clearly
//                  moves the client closer to booking.
//
// After a full proposal is sent, the rubric is intentionally narrow:
// only PRICING (clarification) fires automatically. Everything else
// becomes NONE — we trust the operator to drive specific snippets
// from inbound questions, not autosuggest from behavioural noise.
//
// Spec is explicit: no automation, no AI generation, no schema
// changes. This module is the "why don't I just ask the model what
// to do next?" temptation deliberately resisted.

import type { DealMomentum } from "@/lib/dealMomentum";
import type { LeadMomentum } from "@/lib/leadMomentum";

/** Coarse-grained discriminator on what the suggestion is asking the
 *  operator to do. Mirrors the four-action decision rubric documented
 *  at the top of this file. Callers can switch on it for richer
 *  rendering; the existing chip render still uses message + actionLabel
 *  + actionCommand directly. */
export type DecisionAction = "preview" | "snippet" | "pricing" | "none";

export type InspectorSuggestion = {
  /** Coarse action category. Always set going forward; older callers
   *  that don't read it remain unaffected. */
  action: DecisionAction;
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

  const cmdName = (input.clientFirstName?.trim() || "client").toLowerCase();
  const proposalAlreadySent = input.priorDaysSent.length > 0;
  const stats = input.behaviorStats;

  // Two strong "client is evaluating price" signals — sustained
  // dwell on the pricing section, or the priceViewed flag firing
  // even without dwell data. Either lights up the PRICING branch.
  const pricingSignal =
    (stats && stats.pricingDwellSeconds >= 60) ||
    input.lastEventType === "price_viewed" ||
    input.priceViewed;

  // Preview-suggestion guard: if we've already sent a preview in
  // the last 24h, the operator's playbook says give the client time.
  const previewRecentlySent =
    input.lastPreviewSentAt !== null &&
    now.getTime() - input.lastPreviewSentAt.getTime() < PREVIEW_QUIET_WINDOW_MS;

  // ─── PRICING — fires across momentum buckets ─────────────────────
  // Strongest pre-buy signal we have, regardless of how warm or cold
  // the deal is overall. If the client is sitting on the price page
  // (or the boolean flag fired), the right thing is the pricing
  // breakdown — not a snippet, not a preview.
  if (pricingSignal) {
    return {
      action: "pricing",
      message: "They're evaluating pricing. Sharing the breakdown helps here.",
      actionLabel: "Send pricing",
      actionCommand: `send pricing to ${cmdName}`,
    };
  }

  // ─── STRICT RULE — proposal already sent, no auto SNIPPET ───────
  // Once a full proposal exists, we never auto-suggest "Day N+1"
  // off behavioural signals. The operator picks specific snippets
  // from real client questions via the Command Bar. Anything else
  // here is NONE — silence beats pestering.
  if (proposalAlreadySent) {
    return null;
  }

  // ─── No proposal yet — the SNIPPET / PREVIEW band ────────────────

  // VERY_HOT without a proposal: the client is actively engaging
  // with no formal itinerary in front of them yet. The canonical
  // opener (Day 1 + 2) gives them a tangible feel for the trip
  // without pretending it's a personalised plan.
  if (input.momentum === "VERY_HOT") {
    if (input.clickedReservation) {
      // They went straight to the reservation form on a deck without
      // an itinerary — usually means a curious returning client.
      // Stay quiet here; the operator handles this directly.
      return null;
    }
    return {
      action: "snippet",
      message: "Active right now — sharing the first couple of days fits here.",
      actionLabel: "Send Day 1 and 2",
      actionCommand: `send ${cmdName} day 1 and 2`,
    };
  }

  // WARM, no proposal: low-information state. Stay silent rather
  // than nudging. The deal card's other affordances cover this.
  if (input.momentum === "WARM") {
    return null;
  }

  // COOLING / COLD: re-engage with a sample safari. Suppressed when
  // a preview already went out recently so we don't pile on.
  if (input.momentum === "COOLING" || input.momentum === "COLD") {
    if (previewRecentlySent) return null;
    return {
      action: "preview",
      message:
        input.momentum === "COLD"
          ? "No engagement yet — a sample safari restarts the conversation."
          : "Quiet for a day — a sample safari often re-opens this.",
      actionLabel: "Send preview",
      actionCommand: `send a 5 day safari to ${cmdName}`,
    };
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
    return {
      action: "preview",
      message: "Lead is active right now — a sample safari fits the moment.",
      actionLabel: "Send preview",
      actionCommand: `send a 5 day safari to ${cmdName}`,
    };
  }
  if (input.momentum === "QUIET") {
    return {
      action: "preview",
      message: "Quiet lead — a short safari preview can re-open the conversation.",
      actionLabel: "Send preview",
      actionCommand: `send a 5 day safari to ${cmdName}`,
    };
  }
  // NEW
  return {
    action: "preview",
    message: "New lead — a sample safari starts the conversation.",
    actionLabel: "Send preview",
    actionCommand: `send a 5 day safari to ${cmdName}`,
  };
}

// ─── "Right now" insight — read-only narrative ───────────────────────────
//
// One observational line per deal card, rendered between the live-
// activity strip and the momentum reason. Distinct from
// suggestNextStep: no button, no metric quoted, no timestamp — just
// what the client is doing, framed in a way the operator can act on
// without thinking. Same Inspector AI playbook, different surface.
//
// Signal priority (only one fires per card; never stacks):
//   1. Pricing dwell ≥10s     → "comparing options"
//   2. Day-card dwell ≥15s    → "imagining the trip"
//   3. Scroll <40% w/ session → "haven't seen the full itinerary"
//   4. Idle (60s–5min after a real session) → "paused here"
//
// Guards:
//   - reservationCompleted    → null (closed deals stay quiet)
//   - lastSentAt < 2h ago     → null (suppress after a recent send)
//   - sessionCount === 0      → null (no view data yet)
//
// 10–15s thresholds enforce "sustained behaviour" — a casual
// scroll-through never triggers an insight.

export type RightNowInsight = {
  message: string;
};

export type RightNowInput = {
  reservationCompleted: boolean;
  lastSentAt: Date | null;
  /** Last engagement event timestamp on the proposal — used by the
   *  idle branch to detect "they were here, then went quiet" within
   *  the live-activity 5-minute window. */
  lastEventAt: Date | null;
  behaviorStats: InspectorBehaviorStats | null;
  /** For testability. */
  now?: Date;
};

const RIGHT_NOW_PRICING_DWELL_S = 10;
const RIGHT_NOW_DAY_DWELL_S = 15;
const RIGHT_NOW_SCROLL_THRESHOLD = 40;
const RIGHT_NOW_IDLE_MIN_MS = 60_000;
const RIGHT_NOW_IDLE_MAX_MS = 5 * 60_000;
const RIGHT_NOW_IDLE_DWELL_S = 10;

export function deriveRightNowInsight(input: RightNowInput): RightNowInsight | null {
  const now = input.now ?? new Date();
  if (input.reservationCompleted) return null;
  if (
    input.lastSentAt &&
    now.getTime() - input.lastSentAt.getTime() < RECENT_SEND_WINDOW_MS
  ) {
    return null;
  }

  const stats = input.behaviorStats;
  if (!stats || stats.sessionCount === 0) return null;

  if (stats.pricingDwellSeconds >= RIGHT_NOW_PRICING_DWELL_S) {
    return {
      message: "They’re comparing options — a quick clarification helps here.",
    };
  }
  if (stats.dayDwellSeconds >= RIGHT_NOW_DAY_DWELL_S) {
    return {
      message: "They’re imagining the trip — sending the next day keeps momentum.",
    };
  }
  if (stats.maxScrollPct > 0 && stats.maxScrollPct < RIGHT_NOW_SCROLL_THRESHOLD) {
    return {
      message: "They haven’t seen the full itinerary — a short highlight can re-engage.",
    };
  }
  // Idle: someone engaged earlier (real session + non-trivial dwell)
  // but the last event landed 1–5 min ago. Outside that window the
  // live-activity strip disappears anyway, so this insight only
  // surfaces in the same recency band.
  if (input.lastEventAt) {
    const ms = now.getTime() - input.lastEventAt.getTime();
    if (
      ms >= RIGHT_NOW_IDLE_MIN_MS &&
      ms <= RIGHT_NOW_IDLE_MAX_MS &&
      stats.totalDwellSeconds >= RIGHT_NOW_IDLE_DWELL_S
    ) {
      return {
        message: "They paused here — a gentle nudge can restart the conversation.",
      };
    }
  }
  return null;
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
