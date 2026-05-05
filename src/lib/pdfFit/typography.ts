import type { TypographyStyle, ColorRole } from "./types";
import type { ThemeTokens } from "@/lib/types";

// ─── PDF-Fit typography tokens ─────────────────────────────────────────────
//
// The operator's layout spec references styles like "h1" / "body" /
// "eyebrow" but doesn't define what those styles ARE. This file is the
// canonical token table: size in pt (print-native unit), leading,
// weight, letter-spacing.
//
// Print uses pt directly. Web uses pt × 1.333 ≈ px for rough
// equivalence at 96dpi. We render in pt so the same component prints
// at the right size and screens approximately match.
//
// Char-count guidance comes from operator spec — these tokens are
// tuned so a 174mm-wide slot at the listed point size + leading
// holds the character counts the spec promises (~50 chars per line
// at 11pt body in a serif).

export type StyleSpec = {
  /** Font family stack — picks from the proposal's brand fonts when
   *  the role suggests display vs body. */
  fontRole: "display" | "body";
  /** Point size at print resolution. Print CSS reads pt directly;
   *  web preview converts to px at 1pt = 1.333px. */
  size_pt: number;
  /** Line-height multiplier (unitless). */
  leading: number;
  /** CSS font-weight. */
  weight: number;
  /** em-relative tracking. 0.18em = "uppercase eyebrow" tracking. */
  letterSpacing_em?: number;
  /** Force uppercase rendering (for eyebrow / button_primary). */
  uppercase?: boolean;
};

// Pulled from src/app/globals.css :root tokens (the magazine layout's
// canonical type scale). Conversions: 1rem = 16px = 12pt at 96 dpi
// (px ÷ 1.333), so the print pt sizes here are exact analogues of
// the on-screen rem sizes the working system uses.
//
//   Display 64/72/-0.02   → 48pt/54/1.125 leading  (cover hero)
//   H1      40/48/-0.015  → 30pt/36/1.2  leading
//   H2      28/36/-0.01   → 21pt/27/1.286 leading
//   H3      20/28         → 15pt/21/1.4  leading
//   BodyLg  18/28         → 13.5pt/21/1.556 leading
//   Body    16/26         → 12pt/19.5/1.625 leading
//   Small   14/22         → 10.5pt/16.5/1.571 leading
//   Label   12/18/0.18    → 9pt/13.5/1.5 leading, uppercase, +0.18em

export const TYPOGRAPHY_STYLES: Record<TypographyStyle, StyleSpec> = {
  h1: {
    fontRole: "display",
    size_pt: 30,
    leading: 1.2,
    weight: 700,
    letterSpacing_em: -0.015,
  },
  h2: {
    fontRole: "display",
    size_pt: 21,
    leading: 1.286,
    weight: 700,
    letterSpacing_em: -0.01,
  },
  h3: {
    fontRole: "display",
    size_pt: 15,
    leading: 1.4,
    weight: 600,
  },
  body: {
    fontRole: "body",
    size_pt: 12,
    leading: 1.625,
    weight: 400,
  },
  eyebrow: {
    fontRole: "body",
    size_pt: 9,
    leading: 1.5,
    weight: 600,
    letterSpacing_em: 0.18,
    uppercase: true,
  },
  // Slightly larger eyebrow — used for the cover destinations line
  // where the small-caps feel needs more presence than a 9pt label.
  eyebrow_lg: {
    fontRole: "body",
    size_pt: 10.5,
    leading: 1.4,
    weight: 600,
    letterSpacing_em: 0.16,
    uppercase: true,
  },
  caption: {
    fontRole: "body",
    size_pt: 10.5,
    leading: 1.571,
    weight: 400,
  },
  button_primary: {
    fontRole: "body",
    size_pt: 11,
    leading: 1.2,
    weight: 600,
    letterSpacing_em: 0.04,
    uppercase: true,
  },
  button_secondary: {
    fontRole: "body",
    size_pt: 10,
    leading: 1.2,
    weight: 500,
    letterSpacing_em: 0.04,
    uppercase: true,
  },
};

// ─── Color role resolution ─────────────────────────────────────────────────
//
// Layouts reference colors via roles ("accent", "headingText", etc.).
// At render time we resolve those roles against the proposal's
// ThemeTokens (brand-customised) — falling back to sensible defaults
// for roles the theme doesn't carry (white, darkBg).

export function resolveColor(role: ColorRole, tokens: ThemeTokens): string {
  switch (role) {
    case "pageBg":         return tokens.pageBg;
    case "sectionBg":      return tokens.sectionSurface;
    case "accent":         return tokens.accent;
    case "secondaryAccent": return tokens.secondaryAccent;
    case "headingText":    return tokens.headingText;
    case "bodyText":       return tokens.bodyText;
    case "mutedText":      return tokens.mutedText;
    case "border":         return tokens.border;
    case "white":          return "#FFFFFF";
    case "darkBg":         return "rgba(10, 20, 17, 0.88)";
  }
}

// ─── Style → CSS conversion ────────────────────────────────────────────────
//
// Apply a typography style spec onto a React.CSSProperties object,
// resolving fontRole against the proposal's display / body fonts.
// Returns ONLY typography props — caller layers in color / alignment /
// positioning at the slot level.

export function styleCss(
  style: TypographyStyle,
  fonts: { displayFont: string; bodyFont: string },
): React.CSSProperties {
  const spec = TYPOGRAPHY_STYLES[style];
  const family = spec.fontRole === "display" ? fonts.displayFont : fonts.bodyFont;
  return {
    fontFamily: `'${family}', ${spec.fontRole === "display" ? "Georgia, serif" : "system-ui, sans-serif"}`,
    fontSize: `${spec.size_pt}pt`,
    lineHeight: spec.leading,
    fontWeight: spec.weight,
    ...(spec.letterSpacing_em ? { letterSpacing: `${spec.letterSpacing_em}em` } : {}),
    ...(spec.uppercase ? { textTransform: "uppercase" as const } : {}),
  };
}
