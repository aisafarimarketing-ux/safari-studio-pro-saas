// ─── PDF-Fit layout system — types ─────────────────────────────────────────
//
// The "PDF-Fit" layout system is a reverse-engineered approach to print:
// every layout is purpose-built for the A4 page (210×297mm). Slots have
// explicit mm coordinates, content has explicit caps, no flow / clip
// surprises. The web view scales the same slot definitions; print
// renders them at exact mm.
//
// Operator brief: "we don't bend pages around content; we bend content
// around pages." Each section type ships with multiple layout variants
// the operator picks from — the layout decides where things go, the
// content fills the slots within their caps.
//
// This file defines the data shape only — components in
// src/components/proposal-share/PdfFit/ consume these manifests.

export type ColorRole =
  | "pageBg"
  | "sectionBg"
  | "accent"
  | "secondaryAccent"
  | "headingText"
  | "bodyText"
  | "mutedText"
  | "border"
  | "white"
  | "darkBg";

export type TypographyStyle =
  | "h1"
  | "h2"
  | "h3"
  | "body"
  | "eyebrow"
  | "eyebrow_lg"
  | "caption"
  | "button_primary"
  | "button_secondary";

export type OverflowBehavior =
  | "truncate"     // ellipsis when content exceeds slot
  | "scale_down"   // shrink font-size proportionally
  | "warn";        // log a warning but render anyway

export type ImageRole = "hero" | "thumb" | "logo" | "signature";

// Common positioning fields shared across every slot type.
type SlotBox = {
  x_mm: number;
  y_mm: number;
  w_mm: number;
  h_mm: number;
  z_index?: number;
};

export type TextSlot = SlotBox & {
  type: "text";
  name: string;
  /** Logical content slot — caller maps proposal data to these names. */
  content_key?: string;
  style?: TypographyStyle;
  color_role?: ColorRole;
  alignment?: "left" | "center" | "right";
  max_chars?: number;
  /** Compound content like "{destinations} · {dates} · {duration}".
   *  Caller substitutes from the proposal at render time. */
  content_pattern?: string;
  overflow_behavior?: OverflowBehavior;
  /** Override the resolved style's line-height. Useful for editorial
   *  title slots that need tighter leading (~1.1) than the global
   *  h1 token (1.2 from the magazine type scale). */
  line_height?: number;
};

export type ImageSlot = SlotBox & {
  type: "image";
  name: string;
  content_key?: string;
  image_role?: ImageRole;
  object_fit?: "cover" | "contain";
  /** Recommended aspect ratio used by the editor's content-fit warning. */
  aspect_ratio?: string;
  /** Operator's editor flags an image as oversized when below this. */
  min_resolution_px?: [number, number];
  /** Center / focal-point hint for cropping. */
  focal_recommendation?: string;
  alignment?: "left" | "center" | "right";
};

export type FillSlot = SlotBox & {
  type: "fill";
  name: string;
  /** Either a ColorRole token or a raw CSS string (gradient, hex). */
  fill: ColorRole | string;
};

export type LineSlot = SlotBox & {
  type: "line";
  name: string;
  color_role?: ColorRole;
};

export type GroupSlot = SlotBox & {
  type: "group";
  name: string;
  /** Sub-slots positioned RELATIVE to the group's top-left. */
  slots?: Slot[];
};

export type VectorSlot = SlotBox & {
  type: "vector";
  name: string;
  /** Reserved for SVG-rendered route overlays etc. */
  payload_key?: string;
};

export type Slot =
  | TextSlot
  | ImageSlot
  | FillSlot
  | LineSlot
  | GroupSlot
  | VectorSlot;

export type LayoutSection =
  | "cover"
  | "personal_note"
  | "trip_summary"
  | "day_card"
  | "property_card"
  | "pricing"
  | "practical_info"
  | "closing"
  | "footer";

export type LayoutManifest = {
  id: string;
  section: LayoutSection;
  page_count: number;
  description?: string;
  slots: Slot[];
  rules?: string[];
  design_notes?: string;
};

// ─── Page meta — shared across every layout ─────────────────────────────────
//
// Mirrors the operator's spec meta block. Stored as a constant so layout
// components can resolve mm → percentage / px without each one redoing the
// math.

export const PAGE_META = {
  width_mm: 210,
  height_mm: 297,
  safe_margins_mm: { top: 18, bottom: 18, left: 18, right: 18 },
  grid: { columns: 12, gutter_mm: 4, baseline_mm: 4 },
  dpi_print: 300,
  dpi_web: 144,
  pixel_dimensions_print: [2480, 3508] as const,
  pixel_dimensions_retina: [4960, 7016] as const,
} as const;

// Convert a mm value to a CSS string. We use mm units directly because the
// .pdf-page container is sized in mm — Playwright respects mm in print
// CSS. Web preview also honours mm at any DPR.
export function mm(value: number): string {
  return `${value}mm`;
}
