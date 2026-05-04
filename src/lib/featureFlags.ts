// ─── Feature flags — visibility gates for advanced surfaces ────────────────
//
// The product's core demo flow is three actions:
//   1. Send preview itinerary  ("send a 5 day safari to Lilian")
//   2. Send proposal day snippet ("send Jennifer day 2 and 3")
//   3. Send pricing breakdown  ("send pricing to Lilian")
//
// Everything else — live behavioural CTAs, booking attribution chips,
// supplier orchestration panel, advanced follow-up states — is
// internal or secondary until each is reliably stable. This module
// gives every advanced surface a single named flag so we can hide /
// re-enable without touching the underlying APIs, schemas, or
// suggestion logic.
//
// Reading the values:
//   • Reads NEXT_PUBLIC_FEATURE_* env vars at build time so the
//     bundle stays static (Next.js inlines NEXT_PUBLIC_* at compile).
//   • Defaults are deliberately CONSERVATIVE — anything with `true`
//     here is what the operator sees on a fresh deploy. Flip to
//     "1" / "true" in env to re-enable an advanced surface.
//   • Demo / sales context: leave all advanced flags off. The
//     dashboard stays focused on the three send actions.
//
// Adding a new flag: add to `FEATURES` below, document the gate
// criteria in the comment, wrap the conditional render at the
// callsite. Don't sneak feature work past this gate — if it's not
// stable, leave the flag off and ship the gate too.
//
// Re-enabling a flag in production:
//   • Set NEXT_PUBLIC_FEATURE_<name>=1 in the deployment env
//   • Redeploy (NEXT_PUBLIC_* are inlined at build, not runtime)

function readFlag(envName: string): boolean {
  const raw = process.env[envName];
  if (!raw) return false;
  const norm = raw.trim().toLowerCase();
  return norm === "1" || norm === "true" || norm === "yes" || norm === "on";
}

export const FEATURES = {
  /** Live activity strip + "right now" insight line on deal cards.
   *  Behaviour-tracking based; reads cleanly when the share view is
   *  active, but adds visual noise on a quiet dashboard. Off until
   *  the signal-to-suggestion loop has been validated with a real
   *  pipeline of leads. */
  liveBehavior: readFlag("NEXT_PUBLIC_FEATURE_LIVE_BEHAVIOR"),

  /** Booking attribution chip on reservation rows ("Booked after
   *  WhatsApp · Day 3 snippet sent 12 min before"). Powerful
   *  reinforcement copy when accurate, but the credit logic relies
   *  on Phase 2 wiring being healthy end-to-end — until then,
   *  hide rather than risk a misattribution feeling. */
  bookingAttribution: readFlag("NEXT_PUBLIC_FEATURE_BOOKING_ATTRIBUTION"),

  /** Booking Operations panel on the reservation summary dialog
   *  (per-property availability checks, alternatives, escalation).
   *  Internally rich but a lot of state for a first-time viewer.
   *  Off until the supplier orchestration has shipped to a couple
   *  of pilot operators and the cadence is calibrated. */
  bookingOps: readFlag("NEXT_PUBLIC_FEATURE_BOOKING_OPS"),

  /** PDF-Fit layout system — reverse-engineered print layouts where
   *  every slot has explicit mm coordinates and content has explicit
   *  caps. Replaces the legacy "render the web layout into A4" path
   *  with one designed for paper first. Pilot stage: only the cover
   *  section uses the new system; everything else still goes through
   *  the legacy SectionRenderer. Flip this on per-deploy to A/B
   *  against the legacy path. */
  pdfFitLayouts: readFlag("NEXT_PUBLIC_FEATURE_PDF_FIT_LAYOUTS"),
} as const;

export type FeatureFlag = keyof typeof FEATURES;
