import type { TypographyStyle, ColorRole, LayoutSection } from "./types";

// ─── PDF-Fit variant system ────────────────────────────────────────────────
//
// Variants are visual TREATMENTS layered on top of a base layout.
// They never change slot positions (x/y/w/h are locked); they only
// adjust typography, color emphasis, image treatment, and visual
// weight within each slot.
//
// The operator's variant spec (cinematic / editorial / image_lead /
// etc.) maps to the per-slot adjustment table below. Each variant
// has a default + per-slot overrides; the applyer merges them at
// render time.
//
// Why this layer exists at all: 7 sections × 3 variants = 21 looks
// from one set of structural manifests. Without variants we'd be
// duplicating layouts just to get a "softer" or "bolder" version
// of the same arrangement.

export type SlotAdjustment = {
  /** Replace the slot's typography style entirely. */
  styleOverride?: TypographyStyle;
  /** Replace the slot's color role entirely. */
  colorOverride?: ColorRole;
  /** Multiplier on font-size. 1.1 = +10% larger. */
  sizeScale?: number;
  /** Multiplier on line-height. 0.95 = tighter leading. */
  leadingScale?: number;
  /** Letter-spacing delta in em (added to base). */
  letterSpacingDelta?: number;
  /** Multiplier on font-weight. 1.1 nudges 400 → 440 (clamped to
   *  100 / 200 / .. / 900 grid). */
  weightScale?: number;
  /** Slot-level opacity (0–1). Useful for "subtle" / "subdued"
   *  treatments without dragging the color picker through every
   *  variant. */
  opacity?: number;
  /** CSS filter() string for image slots. e.g.
   *  "saturate(1.15) contrast(1.05)" for "rich, high contrast". */
  imageFilter?: string;
  /** Replaces the slot's `fill` value entirely. Use for variants
   *  that need a stronger / softer gradient (gradient_overlay etc.). */
  fillOverride?: string;
};

export type Variant = {
  id: string;
  /** Default adjustment applied to every slot in the layout. */
  defaults?: SlotAdjustment;
  /** Per-slot overrides keyed by slot.name. */
  perSlot?: Record<string, SlotAdjustment>;
};

// ─── Variant registry ──────────────────────────────────────────────────────
//
// Concrete numerical adjustments derived from the operator's qualitative
// rules. The translations:
//
//   "stronger gradient overlay"     → fillOverride with darker stops
//   "tight leading"                 → leadingScale: 0.95
//   "subtle"                        → opacity: 0.7 OR colorOverride
//   "high contrast image"           → imageFilter: contrast(1.1) saturate(1.1)
//   "softer image"                  → imageFilter: saturate(0.85)
//   "wider letterSpacing"           → letterSpacingDelta: +0.02
//   "typography dominant"           → sizeScale on title, opacity on accents
//   "darker"                        → weightScale: 1.1, colorOverride: headingText
//
// Sections that don't have shipped layouts yet still get registered
// here so the editor can already store a variantId on the section —
// when the layout ships, the variant table is already wired.

export const VARIANT_REGISTRY: Record<LayoutSection, Variant[]> = {
  cover: [
    {
      id: "cinematic",
      perSlot: {
        hero_image: {
          imageFilter: "saturate(1.15) contrast(1.08) brightness(1.02)",
        },
        gradient_overlay: {
          fillOverride: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.78) 100%)",
        },
        trip_title: { sizeScale: 1.05, leadingScale: 0.95, weightScale: 1.05 },
        trip_meta: { opacity: 0.78 },
      },
    },
    {
      id: "editorial",
      perSlot: {
        hero_image: { imageFilter: "saturate(0.88) contrast(1.0)" },
        trip_title: { sizeScale: 0.92 },
        trip_meta: { letterSpacingDelta: 0.03, opacity: 0.85 },
      },
    },
    {
      id: "minimal_luxury",
      perSlot: {
        hero_image: { imageFilter: "brightness(0.88) saturate(0.9)" },
        trip_title: { sizeScale: 1.0, letterSpacingDelta: 0.005 },
        trip_meta: { letterSpacingDelta: 0.04, sizeScale: 0.95 },
      },
    },
  ],
  trip_summary: [
    {
      id: "map_focus",
      perSlot: {
        map_image: { imageFilter: "saturate(1.1) contrast(1.05)" },
        left_itinerary_panel: { opacity: 0.72 },
        stats_days: { opacity: 0.7 },
        stats_stops: { opacity: 0.7 },
        stats_lodges: { opacity: 0.7 },
        stats_parks: { opacity: 0.7 },
      },
    },
    {
      id: "list_focus",
      perSlot: {
        map_image: { imageFilter: "saturate(0.7) brightness(0.92)" },
        left_itinerary_panel: { weightScale: 1.1 },
        stats_days: { sizeScale: 1.1, weightScale: 1.1 },
        stats_stops: { sizeScale: 1.1, weightScale: 1.1 },
        stats_lodges: { sizeScale: 1.1, weightScale: 1.1 },
        stats_parks: { sizeScale: 1.1, weightScale: 1.1 },
      },
    },
    { id: "balanced" /* no overrides — base styling */ },
  ],
  day_card: [
    { id: "balanced" },
    {
      id: "image_lead",
      perSlot: {
        main_image: { imageFilter: "saturate(1.12) contrast(1.06)" },
        body_text: { opacity: 0.82 },
        intro_text: { weightScale: 1.05 },
      },
    },
    {
      id: "narrative",
      perSlot: {
        main_image: { imageFilter: "saturate(0.9) contrast(0.96)" },
        body_text: { leadingScale: 1.08 },
        intro_text: { styleOverride: "h2", sizeScale: 0.95, letterSpacingDelta: 0.005 },
      },
    },
  ],
  property_card: [
    {
      id: "image_luxury",
      perSlot: {
        main_image: { imageFilter: "saturate(1.12) contrast(1.05)" },
        thumb_1: { opacity: 0.82 },
        thumb_2: { opacity: 0.82 },
        thumb_3: { opacity: 0.82 },
        description: { opacity: 0.82 },
      },
    },
    {
      id: "info_rich",
      perSlot: {
        main_image: { imageFilter: "saturate(0.92)" },
        property_name: { weightScale: 1.05 },
        description: { weightScale: 1.05 },
        stay_details: { weightScale: 1.05 },
        features_list: { weightScale: 1.05 },
      },
    },
    { id: "balanced" },
  ],
  pricing: [
    {
      id: "clean_financial",
      perSlot: {
        grand_total: { weightScale: 1.1 },
      },
    },
    {
      id: "highlight_total",
      perSlot: {
        pricing_table_bg: { opacity: 0.55 },
        grand_total: { sizeScale: 1.15, weightScale: 1.1 },
        row_1_calc: { opacity: 0.78 },
        row_2_calc: { opacity: 0.78 },
      },
    },
    {
      id: "editorial",
      perSlot: {
        section_intro: { letterSpacingDelta: 0.005, opacity: 0.85 },
        included_list: { leadingScale: 1.05 },
        excluded_list: { leadingScale: 1.05 },
      },
    },
  ],
  practical_info: [
    { id: "clean_cards" },
    {
      id: "feature_highlight",
      perSlot: {
        card_1: { weightScale: 1.05 },
        card_2: { weightScale: 1.05 },
        card_3: { opacity: 0.88 },
        card_4: { opacity: 0.88 },
        card_5: { opacity: 0.88 },
        card_6: { opacity: 0.88 },
      },
    },
    {
      id: "editorial_soft",
      defaults: { opacity: 0.92 },
      perSlot: {
        section_title: { letterSpacingDelta: 0.005 },
      },
    },
  ],
  closing: [
    {
      id: "bold_cta",
      perSlot: {
        primary_cta: { sizeScale: 1.05, weightScale: 1.1 },
        secondary_cta_1: { opacity: 0.78 },
        secondary_cta_2: { opacity: 0.78 },
        secondary_cta_3: { opacity: 0.78 },
      },
    },
    {
      id: "calm_luxury",
      perSlot: {
        hero_image: { imageFilter: "saturate(0.92) brightness(0.96)" },
        primary_cta: { weightScale: 0.96, sizeScale: 0.96 },
      },
    },
    {
      id: "editorial_end",
      perSlot: {
        hero_image: { imageFilter: "saturate(0.88)" },
        headline: { letterSpacingDelta: 0.005 },
      },
    },
  ],
  // Sections without their own variant axis — registered for symmetry
  // with the LayoutSection union; consumers fall back to the base
  // styling when no variants are listed.
  personal_note: [{ id: "default" }],
  footer: [{ id: "default" }],
};

// ─── Resolver ──────────────────────────────────────────────────────────────
//
// Given a section + variantId + slot.name, return the merged
// SlotAdjustment that should apply at render time. Returns an empty
// object when no variant matches (so the caller can spread safely).

export function resolveVariantAdjustment(
  section: LayoutSection,
  variantId: string | undefined,
  slotName: string,
): SlotAdjustment {
  if (!variantId) return {};
  const variants = VARIANT_REGISTRY[section];
  const variant = variants?.find((v) => v.id === variantId);
  if (!variant) return {};
  const slotOverride = variant.perSlot?.[slotName] ?? {};
  // Per-slot overrides win over defaults — same merge order as CSS.
  return { ...variant.defaults, ...slotOverride };
}

// Snap a font-weight scale to the nearest valid CSS weight (100..900).
export function snapWeight(base: number, scale: number): number {
  const target = base * scale;
  const grid = [100, 200, 300, 400, 500, 600, 700, 800, 900];
  let nearest = grid[0];
  let bestDelta = Math.abs(target - nearest);
  for (const w of grid) {
    const d = Math.abs(target - w);
    if (d < bestDelta) {
      bestDelta = d;
      nearest = w;
    }
  }
  return nearest;
}
