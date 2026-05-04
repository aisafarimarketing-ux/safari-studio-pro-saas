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
  /** Used in the action-command prefill so the operator's ⌘K input
   *  reads naturally ("send Jennifer day 3"). Null falls back to
   *  the literal "client". */
  clientFirstName: string | null;
  /** For testability. Defaults to current time. */
  now?: Date;
};

// Don't fire a suggestion when the operator just sent something —
// the spec treats anything in the last 2 hours as "already in
// motion". Mirrors the canAutoSend "don't double-tap" rule.
const RECENT_SEND_WINDOW_MS = 2 * 60 * 60 * 1000;

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
  // a pitch.
  if (input.momentum === "VERY_HOT") {
    if (input.lastEventType === "price_viewed" || input.priceViewed) {
      // Pricing-stuck moments deserve a clarifying message, not a
      // next-day push. We don't auto-pre-fill a specific snippet
      // here because pricing answers tend to be bespoke; just open
      // the command bar empty.
      return {
        message: `${name} just looked at pricing — a quick clarification often unlocks the booking.`,
        actionLabel: "Open command",
      };
    }
    if (input.clickedReservation) {
      return {
        message: `${name} opened the reservation form — a short nudge with arrival logistics often closes from here.`,
        actionLabel: "Open command",
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

  // ─── COOLING ─────────────────────────────────────────────────────
  // Quiet for a day or two. A single re-engagement message is the
  // textbook play here.
  if (input.momentum === "COOLING") {
    if (sentSomethingBefore && nextDay !== null) {
      return {
        message: `Quiet for a day or two — sending Day ${nextDay} reopens the conversation without sounding like a chase.`,
        actionLabel: `Send Day ${nextDay}`,
        actionCommand: `send ${cmdName} day ${nextDay}`,
      };
    }
    return {
      message: `Quiet for a day or two — a brief check-in often re-opens the conversation.`,
      actionLabel: "Open command",
    };
  }

  // ─── COLD ────────────────────────────────────────────────────────
  // Already represented in the dashboard's COLD opportunities. We
  // don't add a second nudge here — that's noise.
  return null;
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
