// Lead momentum — pre-proposal funnel signal.
//
// The deal-side classifier (lib/dealMomentum.ts) reads
// ProposalActivitySummary, which only exists once a proposal has been
// drafted. Leads — Request rows with no Proposal yet — need their own
// time-based bucketing so Inspector AI can suggest the right next
// action at the start of the funnel.
//
// Three buckets, deliberately fewer than the deal side because the
// pre-proposal stage has fewer meaningful states:
//
//   VERY_ACTIVE — bumped within the last hour. Operator just touched
//                 the lead, or it just came in. Highest-leverage
//                 moment to send a sample itinerary.
//   NEW         — received in the last 24h, no operator reply yet
//                 (firstReplyAt is null) AND no recent activity.
//                 The classic "fresh enquiry" state.
//   QUIET       — last activity > 24h ago. Conversation has gone
//                 cold pre-proposal — a preview re-opens it.
//
// Pure function; no IO; safe to call per-lead at read time inside
// /api/dashboard/activity.

export type LeadMomentum = "VERY_ACTIVE" | "NEW" | "QUIET";

export type LeadMomentumInput = {
  receivedAt: Date;
  lastActivityAt: Date;
  firstReplyAt: Date | null;
  /** Caller-supplied "now" for testability. */
  now?: Date;
};

export type LeadMomentumResult = {
  momentum: LeadMomentum;
  /** Short, operator-readable reason — fits on a lead-row line. */
  reason: string;
};

const VERY_ACTIVE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const QUIET_WINDOW_MS = 24 * 60 * 60 * 1000;   // 24 hours

export function classifyLeadMomentum(input: LeadMomentumInput): LeadMomentumResult {
  const now = input.now ?? new Date();
  const sinceActivity = now.getTime() - input.lastActivityAt.getTime();
  const sinceReceived = now.getTime() - input.receivedAt.getTime();

  if (sinceActivity < VERY_ACTIVE_WINDOW_MS) {
    return {
      momentum: "VERY_ACTIVE",
      reason: `Active ${formatRelativeMin(sinceActivity)}`,
    };
  }
  if (sinceActivity > QUIET_WINDOW_MS) {
    return {
      momentum: "QUIET",
      reason: `Quiet for ${formatRelativeLong(sinceActivity)}`,
    };
  }
  // Mid-band: 1h–24h since last activity. Treat as NEW when the lead
  // is still young AND no firstReply yet; otherwise call it WARM-ish
  // (still "NEW" bucket — we keep three states for v1 simplicity).
  if (sinceReceived < QUIET_WINDOW_MS && !input.firstReplyAt) {
    return {
      momentum: "NEW",
      reason: `New · received ${formatRelativeLong(sinceReceived)}`,
    };
  }
  return {
    momentum: "NEW",
    reason: `Touched ${formatRelativeLong(sinceActivity)}`,
  };
}

function formatRelativeMin(ms: number): string {
  if (ms < 60_000) return "just now";
  const mins = Math.floor(ms / 60_000);
  if (mins === 1) return "1 min ago";
  return `${mins} min ago`;
}

function formatRelativeLong(ms: number): string {
  if (ms < 60 * 60_000) return formatRelativeMin(ms);
  const hours = Math.floor(ms / (60 * 60_000));
  if (hours < 24) return hours === 1 ? "1 h ago" : `${hours} h ago`;
  const days = Math.floor(ms / (24 * 60 * 60_000));
  return days === 1 ? "1 day" : `${days} days`;
}

// ─── Presentation helpers ───────────────────────────────────────────────

export const LEAD_MOMENTUM_LABEL: Record<LeadMomentum, string> = {
  VERY_ACTIVE: "Active",
  NEW: "New",
  QUIET: "Quiet",
};

// Tailwind-free token bag — same shape as MOMENTUM_COLORS in
// dealMomentum.ts so leads + deals can share UI helpers if needed.
export const LEAD_MOMENTUM_COLORS: Record<
  LeadMomentum,
  { bg: string; fg: string; accent: string }
> = {
  VERY_ACTIVE: { bg: "rgba(22,163,74,0.10)", fg: "#15803d", accent: "#16a34a" },
  NEW:         { bg: "rgba(202,138,4,0.10)", fg: "#a16207", accent: "#ca8a04" },
  QUIET:       { bg: "rgba(0,0,0,0.06)",       fg: "rgba(0,0,0,0.55)", accent: "rgba(0,0,0,0.4)" },
};
