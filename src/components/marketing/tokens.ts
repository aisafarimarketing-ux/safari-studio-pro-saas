// ─── Marketing tokens ────────────────────────────────────────────────────
//
// Shared design constants for the public landing page. The dashboard
// (operator-facing) uses its own DashboardTheme tokens — these are
// kept separate so a tweak on one surface never accidentally re-skins
// the other.
//
// Light page bg + brand greens + warm gold + dark hero gradient. The
// dark hero/footer gradient is a 180° linear stop from HERO_TOP →
// HERO_BOTTOM. CTAs use a brighter green (GREEN_BRIGHT) at the top of
// their gradient and the brand GREEN at the bottom for a tactile
// "lit" feel.

export const BG = "#F7F5F0";
export const HERO_TOP = "#04130E";
export const HERO_BOTTOM = "#0E2A20";

export const GREEN = "#2F8F46";
export const GREEN_BRIGHT = "#34a04c";
export const GOLD = "#E0B85C";

export const INK = "#0a1411";
export const INK_2 = "rgba(10,20,17,0.72)";
export const CARD_BORDER = "rgba(0,0,0,0.08)";

export const SERIF = "'Playfair Display', Georgia, serif";
export const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
