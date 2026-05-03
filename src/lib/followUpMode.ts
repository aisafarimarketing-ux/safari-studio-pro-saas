// Follow-up Mode — operator-selected "power level" for the dashboard's
// AI follow-up surfaces. Lives on Organization.followUpMode and is
// returned with every /api/dashboard/activity response so the UI can
// adapt without a second fetch.
//
// Behaviour summary:
//   "assisted"     — AI drafts and surfaces suggestions, operator
//                    sends manually. No countdown, no auto-send chip.
//   "smart_assist" — Same as assisted, plus a "Recommended — client
//                    is active" hint and a one-click Send-now action.
//                    No auto-send timer.
//   "auto"         — Adds the safe auto-send pipeline. Eligible
//                    deals show a countdown; firing it dispatches via
//                    the channel-aware /auto-send route.
//
// Premium-readiness:
// canUseMode(mode, isPremium) is the single gate. Today it always
// returns { ok: true } — the spec explicitly says we should NOT
// enforce yet. When we wire payment, restricting smart_assist /
// auto to isPremium === true is a single-line change here. Every
// call site already routes through this function so the change
// propagates automatically.

export type FollowUpMode = "assisted" | "smart_assist" | "auto";

export const FOLLOW_UP_MODES: FollowUpMode[] = [
  "assisted",
  "smart_assist",
  "auto",
];

export const FOLLOW_UP_MODE_LABEL: Record<FollowUpMode, string> = {
  assisted: "Assisted",
  smart_assist: "Smart Assist",
  auto: "Auto",
};

export const FOLLOW_UP_MODE_BLURB: Record<FollowUpMode, string> = {
  assisted: "Drafts ready, you decide when to send.",
  smart_assist: "Drafts plus active-client recommendations.",
  auto: "Auto-follow-up on hot deals — cancel any time.",
};

export const FOLLOW_UP_MODE_DEFAULT: FollowUpMode = "assisted";

export function isFollowUpMode(v: unknown): v is FollowUpMode {
  return typeof v === "string" && (FOLLOW_UP_MODES as string[]).includes(v);
}

export function normaliseFollowUpMode(raw: string | null | undefined): FollowUpMode {
  return isFollowUpMode(raw) ? raw : FOLLOW_UP_MODE_DEFAULT;
}

// ─── Mode capability matrix ─────────────────────────────────────────────
//
// What features each mode unlocks. Read from this rather than
// switch-casing on the mode name in render code, so adding a future
// mode (e.g. "self-driving") only touches this one map.

export type ModeCapabilities = {
  /** Show the per-card "suggested action" chip (👉 Send follow-up now). */
  showSuggestedAction: boolean;
  /** Show a "Recommended — client is active" hint on VERY_HOT deals. */
  showRecommendedHint: boolean;
  /** Show the Wait button next to Send / Edit. (Smart Assist + Auto.) */
  showWaitButton: boolean;
  /** Allow scheduling auto-send + render the countdown UI. */
  allowAutoSend: boolean;
};

export const MODE_CAPABILITIES: Record<FollowUpMode, ModeCapabilities> = {
  assisted: {
    showSuggestedAction: false,
    showRecommendedHint: false,
    showWaitButton: false,
    allowAutoSend: false,
  },
  smart_assist: {
    showSuggestedAction: true,
    showRecommendedHint: true,
    showWaitButton: true,
    allowAutoSend: false,
  },
  auto: {
    showSuggestedAction: true,
    showRecommendedHint: true,
    showWaitButton: true,
    allowAutoSend: true,
  },
};

export function modeCapabilities(mode: FollowUpMode): ModeCapabilities {
  return MODE_CAPABILITIES[mode];
}

// ─── Premium guard (placeholder) ────────────────────────────────────────
//
// Returns { ok: true } for every mode today. When billing lands, flip
// the body to:
//   if (mode !== "assisted" && !isPremium) {
//     return { ok: false, reason: "Upgrade to use Smart Assist or Auto." };
//   }
// Every consumer already routes through this — no other code touches
// the gate.

export type ModeGuardDecision = { ok: true } | { ok: false; reason: string };

export function canUseMode(
  mode: FollowUpMode,
  isPremium: boolean,
): ModeGuardDecision {
  // Intentional pass-through during the unrestricted preview window.
  // The args are referenced via void so future implementations don't
  // have to re-add them and so eslint sees them as used. Replace
  // this body with the real check when billing is live, e.g.:
  //   if (mode !== "assisted" && !isPremium) {
  //     return { ok: false, reason: "Upgrade to use Smart Assist or Auto." };
  //   }
  void mode;
  void isPremium;
  return { ok: true };
}
