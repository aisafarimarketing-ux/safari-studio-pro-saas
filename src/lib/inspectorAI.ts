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
