// ─── Deal scoring + priority labels + next-best-action ───────────────────
//
// Pure logic — no I/O. The /api/dashboard/priorities route gathers the
// raw signals (proposal views, message counts, last-activity timestamps,
// proposal value) and feeds them through this module.
//
// Three sub-scores combine into a single 0–100 priority:
//   - engagement (50% weight): views, dwell, inbound replies, pricing seen
//   - recency    (30% weight): how fresh the last meaningful action is
//   - value      (20% weight): log-scaled monetary value of the deal
//
// Labels are derived from the priority score AND recency — a deal with
// a great score but no movement in two weeks is COLD even if engagement
// was once high. That stops "the report from yesterday" from leading
// today's queue.

// ── Inputs ───────────────────────────────────────────────────────────────

export type ScoringSignals = {
  /** Status of the underlying Request. Booked / completed / not_booked
   *  return null from `score()` so they fall out of the priority list. */
  status: string;

  /** Whether a proposal has been drafted. */
  hasProposal: boolean;
  /** Whether the most-recent linked proposal has been shared (status === "sent"). */
  proposalSent: boolean;

  /** Aggregate engagement on the proposal share view. */
  totalViews: number;
  totalDwellSeconds: number;
  /** Whether the pricing section was viewed in any session. Strong intent signal. */
  pricingViewed: boolean;

  /** Inbound + outbound message counts from our DB. */
  inboundMessages: number;
  outboundMessages: number;
  /** Inbound messages that haven't been read yet — drives the
   *  "Reply" next-best-action. */
  unreadInboundMessages: number;

  /** Most recent meaningful activity (any of: message in/out, view,
   *  status change, deposit, reservation update). ISO string. */
  lastActivityIso: string;
  /** When the proposal was first sent. Lets us reason about "they
   *  haven't opened it yet — nudge after 48h". Null if never sent. */
  proposalSentIso: string | null;
  /** Most recent inbound message timestamp. Null if no replies. */
  lastInboundIso: string | null;

  /** Deposit + booking signals. */
  depositPaid: boolean;
  hasReservation: boolean;

  /** Estimated deal value in CENTS (currency-agnostic — caller supplies
   *  currency for display only). 0 when no proposal yet. */
  valueCents: number;
};

// ── Outputs ──────────────────────────────────────────────────────────────

export type PriorityLabel = "hot" | "warm" | "cold";

export type NextActionType =
  | "draft_quote"
  | "send_proposal"
  | "reply"
  | "nudge"
  | "ask_for_booking"
  | "follow_up"
  | "confirm_reservation"
  | "stay_in_touch"
  | "wait";

export type NextAction = {
  type: NextActionType;
  /** Operator-facing label. Short, action-first verb. */
  label: string;
  /** Why this action is next. One line, shown in the card hover tip. */
  reason: string;
  /** Whether the action is time-sensitive (drives the "needs followup"
   *  filter and the at-risk pipeline metric). */
  urgent: boolean;
};

export type PriorityScore = {
  total: number;            // 0–100
  engagement: number;       // 0–100 sub-score
  recency: number;          // 0–100 sub-score
  value: number;            // 0–100 sub-score
  label: PriorityLabel;
  nextAction: NextAction;
};

// ── Constants ────────────────────────────────────────────────────────────

const TERMINAL_STATUSES = new Set(["booked", "completed", "not_booked"]);

// Sub-score weights — must sum to 1.0.
const W_ENGAGEMENT = 0.5;
const W_RECENCY = 0.3;
const W_VALUE = 0.2;

// Recency decay window — past this many days old, recency = 0.
const RECENCY_DAYS = 14;

// Value scoring — log curve so $50k doesn't dwarf $5k.
// log10(60_000 + 100) ≈ 4.78 → score 100, so $60k saturates the value sub-score.
const VALUE_LOG_MULT = 100 / Math.log10(60_100);

// Label thresholds.
const HOT_TOTAL = 60;
const HOT_RECENCY_FLOOR = 50;
const WARM_TOTAL = 30;

// Stale thresholds for the at-risk pipeline metric and "needs followup" filter.
const FOLLOWUP_DAYS = 2;
const STALE_DAYS = 5;

// ── Public API ───────────────────────────────────────────────────────────

/** Returns null when the request is in a terminal state and shouldn't
 *  appear in the priority queue. */
export function score(signals: ScoringSignals, nowIso?: string): PriorityScore | null {
  if (TERMINAL_STATUSES.has(signals.status)) return null;

  const now = nowIso ? new Date(nowIso) : new Date();
  const lastActivity = parseDate(signals.lastActivityIso) ?? now;
  const hoursSince = Math.max(0, (now.getTime() - lastActivity.getTime()) / 3_600_000);
  const daysSinceLastActivity = hoursSince / 24;

  const engagement = scoreEngagement(signals);
  const recency = scoreRecency(daysSinceLastActivity);
  const value = scoreValue(signals.valueCents);

  const total = clamp01(
    W_ENGAGEMENT * engagement + W_RECENCY * recency + W_VALUE * value,
  );

  const label = labelFor(total, recency);
  const nextAction = pickNextAction(signals, now);

  return {
    total: round(total),
    engagement: round(engagement),
    recency: round(recency),
    value: round(value),
    label,
    nextAction,
  };
}

/** True when the deal should appear under the "needs follow-up" filter:
 *  warm-or-better score AND at least 2 days since last activity, OR an
 *  unread inbound message regardless of recency. */
export function needsFollowup(s: PriorityScore, signals: ScoringSignals, nowIso?: string): boolean {
  if (signals.unreadInboundMessages > 0) return true;
  if (s.label === "cold") return false;
  const days = daysSince(signals.lastActivityIso, nowIso);
  return days >= FOLLOWUP_DAYS;
}

/** True when a HOT deal has gone stale — drives the "pipeline at risk"
 *  metric. Cold/warm don't count: at-risk is for the deals worth saving. */
export function atRisk(s: PriorityScore, signals: ScoringSignals, nowIso?: string): boolean {
  if (s.label !== "hot") return false;
  return daysSince(signals.lastActivityIso, nowIso) >= STALE_DAYS;
}

// ── Sub-scores ───────────────────────────────────────────────────────────

function scoreEngagement(s: ScoringSignals): number {
  // Each component caps independently so a single very long session
  // doesn't pin the score by itself.
  const viewPoints = clamp(s.totalViews * 5, 0, 30);
  const dwellPoints = clamp(s.totalDwellSeconds * 0.5, 0, 30);
  const inboundPoints = clamp(s.inboundMessages * 10, 0, 40);
  const pricingBonus = s.pricingViewed ? 15 : 0;
  return clamp01(viewPoints + dwellPoints + inboundPoints + pricingBonus);
}

function scoreRecency(daysSinceLastActivity: number): number {
  // 100 if in the last 24h, linear decay to 0 at RECENCY_DAYS, then 0.
  if (daysSinceLastActivity <= 1) return 100;
  if (daysSinceLastActivity >= RECENCY_DAYS) return 0;
  const frac = (daysSinceLastActivity - 1) / (RECENCY_DAYS - 1);
  return clamp01(100 * (1 - frac));
}

function scoreValue(cents: number): number {
  if (cents <= 0) return 0;
  const dollars = cents / 100;
  const raw = Math.log10(dollars + 100) * VALUE_LOG_MULT;
  return clamp01(raw);
}

// ── Labels ───────────────────────────────────────────────────────────────

function labelFor(total: number, recency: number): PriorityLabel {
  if (total >= HOT_TOTAL && recency >= HOT_RECENCY_FLOOR) return "hot";
  if (total >= WARM_TOTAL) return "warm";
  return "cold";
}

// ── Next best action ─────────────────────────────────────────────────────

function pickNextAction(s: ScoringSignals, now: Date): NextAction {
  // Inbound messages waiting for a reply trump everything else — the
  // client made a move, the operator responds. (Fast response time is
  // the single biggest predictor of conversion in safari sales.)
  if (s.unreadInboundMessages > 0) {
    return {
      type: "reply",
      label: "Reply to client",
      reason: `${s.unreadInboundMessages} unread message${s.unreadInboundMessages === 1 ? "" : "s"} waiting for you.`,
      urgent: true,
    };
  }

  // No proposal yet — draft one (any status).
  if (!s.hasProposal) {
    return {
      type: "draft_quote",
      label: "Draft quote",
      reason: "Nothing has been quoted to this client yet.",
      urgent: s.status === "new",
    };
  }

  // Have a proposal but it's still a draft — send it.
  if (!s.proposalSent) {
    return {
      type: "send_proposal",
      label: "Send proposal",
      reason: "The quote is drafted but hasn't been shared with the client.",
      urgent: true,
    };
  }

  // Past the booking gate.
  if (s.depositPaid) {
    return s.hasReservation
      ? {
          type: "stay_in_touch",
          label: "Stay in touch",
          reason: "Deposit paid and reservations in motion. Send pre-trip notes when ready.",
          urgent: false,
        }
      : {
          type: "confirm_reservation",
          label: "Confirm reservation",
          reason: "Deposit paid — lock in the camp holds before they release.",
          urgent: true,
        };
  }

  // Proposal is sent, deal is open. Reason about engagement + timing.
  const sentAt = parseDate(s.proposalSentIso);
  const daysSinceSent = sentAt ? (now.getTime() - sentAt.getTime()) / 86_400_000 : null;

  if (s.totalViews === 0) {
    if (daysSinceSent !== null && daysSinceSent >= 2) {
      return {
        type: "nudge",
        label: "Nudge — they haven't opened it",
        reason: `Sent ${Math.floor(daysSinceSent)} days ago, no opens yet. A short reminder usually reactivates.`,
        urgent: true,
      };
    }
    return {
      type: "wait",
      label: "Give it a day",
      reason: "Just sent. Most clients open within 24h.",
      urgent: false,
    };
  }

  // Viewed but no reply — the strong-intent path.
  if (s.pricingViewed && s.totalDwellSeconds >= 60 && s.inboundMessages === 0) {
    return {
      type: "ask_for_booking",
      label: "Ask for the booking",
      reason: "They've read the proposal and lingered on pricing. Time to move them to deposit.",
      urgent: true,
    };
  }

  // Engaged but going quiet — follow up.
  const daysSinceActivity = daysSince(s.lastActivityIso, now.toISOString());
  if (daysSinceActivity >= STALE_DAYS) {
    return {
      type: "follow_up",
      label: "Follow up",
      reason: `No activity for ${Math.floor(daysSinceActivity)} days. A check-in keeps the deal warm.`,
      urgent: true,
    };
  }
  if (daysSinceActivity >= FOLLOWUP_DAYS && s.totalViews > 0) {
    return {
      type: "follow_up",
      label: "Check in",
      reason: "They've engaged but gone quiet. A short note re-opens the door.",
      urgent: false,
    };
  }

  return {
    type: "stay_in_touch",
    label: "Stay in touch",
    reason: "Deal is moving. Keep the cadence light.",
    urgent: false,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────

function parseDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysSince(iso: string | null | undefined, nowIso?: string): number {
  const d = parseDate(iso);
  if (!d) return Number.POSITIVE_INFINITY;
  const now = nowIso ? new Date(nowIso) : new Date();
  return (now.getTime() - d.getTime()) / 86_400_000;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function clamp01(n: number): number {
  return clamp(n, 0, 100);
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}
