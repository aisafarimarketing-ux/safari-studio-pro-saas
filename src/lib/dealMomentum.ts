// Deal momentum — second-pass classifier on top of ProposalActivitySummary.
//
// proposalActivity.ts already gives us a multi-state ProposalStatus
// ("watching"/"warm"/"hot"/"needs_followup"/"booked") driven by a score.
// The Deal Momentum System needs a *time-based* read with a sharper
// next-action signal: how recent is the activity, and what should the
// operator do right now?
//
// Pure function, no IO — easy to test, runs cheaply per row at read
// time inside /api/dashboard/activity.

export type DealMomentum = "VERY_HOT" | "WARM" | "COOLING" | "COLD";

export type SuggestedAction = "SEND_NOW" | "ASK_QUESTION" | "WAIT";

export type MomentumInput = {
  /** Wall-clock of the most recent client-side event on this proposal. */
  lastEventAt: Date | null;
  /** Type of that event — used to bias the "very hot" trigger toward
   *  pricing / reservation activity. */
  lastEventType: string | null;
  /** Most recent operator-side dispatch on this deal (sentAt on the
   *  latest applied AISuggestion). Null when no follow-up has been sent
   *  yet. Used to suppress "send now" suggestions when the operator
   *  has already reached out and is waiting for a reply. */
  lastOperatorMessageAt: Date | null;
  /** True if the proposal has a completed reservation. Booked deals
   *  short-circuit to WARM (the operator's job has shifted from "land
   *  the booking" to "confirm logistics"). */
  reservationCompleted: boolean;
  /** "Did they touch the pricing section?" — pulled from
   *  ProposalActivitySummary.priceViewed. Used to decide whether the
   *  current activity counts as a buying signal. */
  priceViewed: boolean;
  clickedReservation: boolean;
  /** Caller-supplied "now" for testability. Defaults to current time. */
  now?: Date;
};

export type MomentumResult = {
  momentum: DealMomentum;
  /** Short, operator-readable reason — fits on one line of a deal card. */
  reason: string;
  /** What the operator should do RIGHT NOW. Matches the v1 action set:
   *   SEND_NOW    — draft is hot, ship the follow-up
   *   ASK_QUESTION — buying-signal moment, don't pitch, ask
   *   WAIT        — recent message already sent, give it air */
  suggestedAction: SuggestedAction;
};

const HOT_WINDOW_MIN = 60;        // VERY_HOT trigger: any signal in last 60min
const WARM_WINDOW_HOURS = 24;     // WARM trigger:    activity in last 24h
const COOLING_WINDOW_HOURS = 72;  // COOLING upper:   24–72h since last activity
// Beyond COOLING_WINDOW_HOURS → COLD.

// "Don't re-ping" window. If the operator already sent a follow-up in
// the last 6 hours, suggestedAction stays WAIT regardless of the
// momentum bucket — the client hasn't had time to reply yet.
const RECENT_OP_MESSAGE_HOURS = 6;

export function classifyMomentum(input: MomentumInput): MomentumResult {
  const now = input.now ?? new Date();

  // Booked deals: already won. The dashboard cares about logistics
  // confirmation, not chasing — surface as WARM with a "booking
  // confirmed" reason and WAIT action.
  if (input.reservationCompleted) {
    return {
      momentum: "WARM",
      reason: "Booking confirmed",
      suggestedAction: "WAIT",
    };
  }

  if (!input.lastEventAt) {
    return {
      momentum: "COLD",
      reason: "No activity yet",
      suggestedAction: "SEND_NOW",
    };
  }

  const diffMs = now.getTime() - input.lastEventAt.getTime();
  const diffMin = Math.max(0, Math.floor(diffMs / 60_000));
  const diffHrs = Math.floor(diffMs / 3_600_000);

  let momentum: DealMomentum;
  let reasonHead: string;

  if (diffMin <= HOT_WINDOW_MIN) {
    momentum = "VERY_HOT";
    reasonHead = describeEvent(input.lastEventType, "fresh");
  } else if (diffHrs <= WARM_WINDOW_HOURS) {
    momentum = "WARM";
    reasonHead = describeEvent(input.lastEventType, "recent");
  } else if (diffHrs <= COOLING_WINDOW_HOURS) {
    momentum = "COOLING";
    reasonHead = describeEvent(input.lastEventType, "stale");
  } else {
    momentum = "COLD";
    reasonHead = "Quiet for a while";
  }

  const reason = `${reasonHead} • ${formatRelative(diffMin, diffHrs)}`;
  const suggestedAction = pickAction(momentum, input, now);

  return { momentum, reason, suggestedAction };
}

function describeEvent(eventType: string | null, freshness: "fresh" | "recent" | "stale"): string {
  // Map raw event types to operator-readable phrases. Falls back to a
  // generic "Last activity" so a brand-new event type doesn't render
  // a junk reason.
  const map: Record<string, string> = {
    proposal_viewed: "Reopened proposal",
    proposal_scrolled: "Read through proposal",
    itinerary_clicked: "Tapped the itinerary",
    price_viewed: "Viewed pricing",
    reservation_started: "Started reservation",
    reservation_completed: "Submitted reservation",
  };
  const phrase = (eventType && map[eventType]) || "Last activity";
  // Slight bias on freshness — same phrase, different urgency framing.
  if (freshness === "fresh") return phrase;
  if (freshness === "recent") return phrase;
  return phrase;
}

function pickAction(
  momentum: DealMomentum,
  input: MomentumInput,
  now: Date,
): SuggestedAction {
  // If the operator already messaged the client in the last few hours,
  // hold — let the client reply first. This is the "don't double-tap"
  // rule that prevents the system from feeling overbearing.
  if (
    input.lastOperatorMessageAt &&
    now.getTime() - input.lastOperatorMessageAt.getTime() < RECENT_OP_MESSAGE_HOURS * 3_600_000
  ) {
    return "WAIT";
  }

  // VERY_HOT with a buying signal (pricing / reservation) → ASK_QUESTION
  // is more graceful than a pitch ("Anything I can clear up about the
  // numbers?"). Pure pricing/reservation moments deserve a question,
  // not a sell.
  if (momentum === "VERY_HOT") {
    if (input.lastEventType === "price_viewed" || input.clickedReservation) {
      return "ASK_QUESTION";
    }
    return "SEND_NOW";
  }

  if (momentum === "COOLING" || momentum === "COLD") return "SEND_NOW";

  // WARM with recent but no buying signal → let it breathe.
  return "WAIT";
}

function formatRelative(diffMin: number, diffHrs: number): string {
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHrs < 24) return `${diffHrs} h ago`;
  const days = Math.floor(diffHrs / 24);
  return `${days} d ago`;
}

// ─── Status presentation helpers ────────────────────────────────────────

export const MOMENTUM_LABEL: Record<DealMomentum, string> = {
  VERY_HOT: "Very hot",
  WARM: "Warm",
  COOLING: "Cooling",
  COLD: "Cold",
};

export const MOMENTUM_ICON: Record<DealMomentum, string> = {
  VERY_HOT: "🔥",
  WARM: "🟡",
  COOLING: "🧊",
  COLD: "⚫",
};

// Tailwind-free token bag — read by both the dealcard and the side
// panel so the status colour stays consistent across surfaces.
export const MOMENTUM_COLORS: Record<
  DealMomentum,
  { bg: string; fg: string; accent: string }
> = {
  VERY_HOT: { bg: "rgba(220,38,38,0.10)", fg: "#b91c1c", accent: "#dc2626" },
  WARM:     { bg: "rgba(202,138,4,0.10)", fg: "#a16207", accent: "#ca8a04" },
  COOLING:  { bg: "rgba(37,99,235,0.10)", fg: "#1d4ed8", accent: "#2563eb" },
  COLD:     { bg: "rgba(0,0,0,0.06)",      fg: "rgba(0,0,0,0.55)", accent: "rgba(0,0,0,0.4)" },
};

export const ACTION_LABEL: Record<SuggestedAction, string> = {
  SEND_NOW: "Send follow-up now",
  ASK_QUESTION: "Ask a question",
  WAIT: "Wait for reply",
};
