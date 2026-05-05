import type { LayoutManifest, Slot } from "../types";

// ─── Combined cover + personal note (single A4 page) ─────────────────────
//
// Per spec: ONE A4 page with TWO fixed sections.
//   COVER         y 0 → 150mm    (height 150mm)
//   PERSONAL NOTE y 150 → 297mm  (height 147mm)
//
// Typography matches the magazine layout's type scale exactly (see
// lib/pdfFit/typography.ts). Title uses h1 (30pt / 1.2 leading,
// -0.015em); destinations use the eyebrow style with 0.18em tracking.
// Spacing rhythm tightened per the brief — meta values sit 7mm below
// labels, meta rows are 14mm apart, gaps reduced ~15% from prior pass.

const HALF_H = 150;
const PAGE_W = 210;
const PAD = 12;

// Build the meta-grid + title slots for a text-panel geometry. Same
// internal structure for all 7 cover layouts; only the (x, w) of the
// panel changes between split layouts and the geometry of the meta
// columns adjusts to the panel's inner width.
function textPanelSlots(
  panel: { x: number; w: number },
  isOverlay: boolean,
): Slot[] {
  const innerX = panel.x + PAD;
  const innerW = Math.max(40, panel.w - PAD * 2);

  // Title is dominant — h1 size, scale_down on overflow. 3-line cap
  // at h1 (30pt × 1.2 leading = 36pt → ~12.7mm/line) → 38mm slot
  // for splits; tighter for overlay so the meta still fits inside
  // 150mm.
  const titleH = isOverlay ? 28 : 38;
  const titleY = isOverlay ? 70 : 32;
  const destY = titleY + titleH + 4;
  const dividerY = destY + 8;
  const metaTopY = dividerY + 6;
  const metaBottomY = metaTopY + 14;

  // Two-column meta grid — 4mm gutter so the labels don't crowd.
  const colW = (innerW - 4) / 2;
  const col1X = innerX;
  const col2X = innerX + colW + 4;

  const titleRole = isOverlay ? "white" : "headingText";
  const metaValueRole = isOverlay ? "white" : "headingText";
  const metaLabelRole = isOverlay ? "white" : "mutedText";
  const accentRole = isOverlay ? "white" : "mutedText";
  const dividerRole = isOverlay ? "white" : "border";

  return [
    {
      type: "image",
      name: "operator_logo",
      content_key: "operatorLogoUrl",
      x_mm: innerX, y_mm: 14, w_mm: 38, h_mm: 12,
      object_fit: "contain",
      image_role: "logo",
      z_index: 2,
    },
    {
      type: "text",
      name: "trip_title",
      content_key: "tripTitle",
      x_mm: innerX, y_mm: titleY, w_mm: innerW, h_mm: titleH,
      style: "h1",
      color_role: titleRole,
      max_chars: 90,
      overflow_behavior: "scale_down",
      z_index: 2,
    },
    {
      type: "text",
      name: "trip_destinations",
      content_key: "tripDestinations",
      x_mm: innerX, y_mm: destY, w_mm: innerW, h_mm: 5,
      style: "eyebrow",
      color_role: accentRole,
      max_chars: 120,
      overflow_behavior: "scale_down",
      z_index: 2,
    },
    {
      type: "line",
      name: "header_divider",
      x_mm: innerX, y_mm: dividerY, w_mm: innerW, h_mm: 0.4,
      color_role: dividerRole,
      z_index: 2,
    },
    // Meta row 1 — FOR | DATES
    {
      type: "text",
      name: "meta_for_label",
      x_mm: col1X, y_mm: metaTopY, w_mm: colW, h_mm: 4,
      style: "eyebrow",
      color_role: metaLabelRole,
      max_chars: 12,
      z_index: 2,
    },
    {
      type: "text",
      name: "meta_for_value",
      x_mm: col1X, y_mm: metaTopY + 5, w_mm: colW, h_mm: 7,
      style: "body",
      color_role: metaValueRole,
      max_chars: 60,
      overflow_behavior: "scale_down",
      z_index: 2,
    },
    {
      type: "text",
      name: "meta_dates_label",
      x_mm: col2X, y_mm: metaTopY, w_mm: colW, h_mm: 4,
      style: "eyebrow",
      color_role: metaLabelRole,
      max_chars: 12,
      z_index: 2,
    },
    {
      type: "text",
      name: "meta_dates_value",
      x_mm: col2X, y_mm: metaTopY + 5, w_mm: colW, h_mm: 7,
      style: "body",
      color_role: metaValueRole,
      max_chars: 60,
      overflow_behavior: "scale_down",
      z_index: 2,
    },
    // Meta row 2 — DURATION | PARTY
    {
      type: "text",
      name: "meta_duration_label",
      x_mm: col1X, y_mm: metaBottomY, w_mm: colW, h_mm: 4,
      style: "eyebrow",
      color_role: metaLabelRole,
      max_chars: 12,
      z_index: 2,
    },
    {
      type: "text",
      name: "meta_duration_value",
      x_mm: col1X, y_mm: metaBottomY + 5, w_mm: colW, h_mm: 7,
      style: "body",
      color_role: metaValueRole,
      max_chars: 60,
      overflow_behavior: "scale_down",
      z_index: 2,
    },
    {
      type: "text",
      name: "meta_party_label",
      x_mm: col2X, y_mm: metaBottomY, w_mm: colW, h_mm: 4,
      style: "eyebrow",
      color_role: metaLabelRole,
      max_chars: 12,
      z_index: 2,
    },
    {
      type: "text",
      name: "meta_party_value",
      x_mm: col2X, y_mm: metaBottomY + 5, w_mm: colW, h_mm: 7,
      style: "body",
      color_role: metaValueRole,
      max_chars: 60,
      overflow_behavior: "scale_down",
      z_index: 2,
    },
  ];
}

function buildSplitHalf(
  id: string,
  textPercent: number,
  textOnLeft: boolean,
): LayoutManifest {
  const textW = (PAGE_W * textPercent) / 100;
  const imageW = PAGE_W - textW;
  const textPanelX = textOnLeft ? 0 : imageW;
  const imagePanelX = textOnLeft ? textW : 0;

  return {
    id,
    section: "cover",
    page_count: 1,
    description: `Cover half — text ${textPercent}% on the ${textOnLeft ? "left" : "right"}, image ${100 - textPercent}% on the ${textOnLeft ? "right" : "left"}`,
    slots: [
      {
        type: "image",
        name: "hero_image",
        content_key: "heroImageUrl",
        x_mm: imagePanelX, y_mm: 0, w_mm: imageW, h_mm: HALF_H,
        object_fit: "cover",
        image_role: "hero",
        z_index: 0,
      },
      {
        type: "fill",
        name: "text_panel_bg",
        x_mm: textPanelX, y_mm: 0, w_mm: textW, h_mm: HALF_H,
        fill: "sectionSurface",
        z_index: 0,
      },
      ...textPanelSlots({ x: textPanelX, w: textW }, false),
    ],
    rules: [
      `Text panel locked to ${textPercent}% width on the ${textOnLeft ? "left" : "right"}`,
      "Title h1 / 30pt / max 3 lines, scale_down on overflow",
      "Destinations single line, no wrap",
      "Meta grid 2x2, tightened label-to-value spacing",
    ],
  };
}

function buildFullBleedHalf(): LayoutManifest {
  return {
    id: "cover-full-bleed",
    section: "cover",
    page_count: 1,
    description: "Cover half — full-bleed cinematic photograph with text overlay",
    slots: [
      {
        type: "image",
        name: "hero_image",
        content_key: "heroImageUrl",
        x_mm: 0, y_mm: 0, w_mm: PAGE_W, h_mm: HALF_H,
        object_fit: "cover",
        image_role: "hero",
        z_index: 0,
      },
      {
        type: "fill",
        name: "gradient_overlay",
        x_mm: 0, y_mm: 60, w_mm: PAGE_W, h_mm: HALF_H - 60,
        fill: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.62) 100%)",
        z_index: 1,
      },
      ...textPanelSlots({ x: 0, w: PAGE_W }, true),
    ],
    rules: [
      "Image fills the cover half",
      "Text overlays a bottom gradient for legibility",
    ],
  };
}

export const COVER_HALF_FULL_BLEED = buildFullBleedHalf();
export const COVER_HALF_S64L = buildSplitHalf("cover-s64l", 64, true);
export const COVER_HALF_S64R = buildSplitHalf("cover-s64r", 64, false);
export const COVER_HALF_S55L = buildSplitHalf("cover-s55l", 55, true);
export const COVER_HALF_S55R = buildSplitHalf("cover-s55r", 55, false);
export const COVER_HALF_S46L = buildSplitHalf("cover-s46l", 46, true);
export const COVER_HALF_S46R = buildSplitHalf("cover-s46r", 46, false);

export const COVER_HALF_LAYOUTS = [
  COVER_HALF_FULL_BLEED,
  COVER_HALF_S64L,
  COVER_HALF_S64R,
  COVER_HALF_S55L,
  COVER_HALF_S55R,
  COVER_HALF_S46L,
  COVER_HALF_S46R,
];

// ─── Personal note half (147mm tall) ──────────────────────────────────────
//
// Refined per the brief — top space reduced, body wider and capped to
// ~6 lines, signature moved closer, footer rebuilt as a flat
// text-only contact strip (no card / no shadow).
//
//   y:6    greeting (h3)
//   y:18   body (h:48mm, ~6 lines at 12pt × 1.625 leading)
//   y:70   signature image
//   y:90   footer band (no fill)
//     Left   advisor image (28mm) + name (caption) + role
//     Centre Email label + value, WhatsApp label + value (text only)
//     Right  small subtle company logo

export const PERSONAL_NOTE_HALF: LayoutManifest = {
  id: "personal-note-half",
  section: "personal_note",
  page_count: 1,
  description: "Personal note half — editorial letter with text-only footer",
  slots: [
    // Half background — sectionSurface so the operator's section bg
    // picker repaints just this half.
    {
      type: "fill",
      name: "note_panel_bg",
      x_mm: 0, y_mm: 0, w_mm: 210, h_mm: 147,
      fill: "sectionSurface",
      z_index: 0,
    },
    // Greeting — h3, sits close to the top edge.
    {
      type: "text",
      name: "note_greeting",
      content_key: "greeting",
      x_mm: 18, y_mm: 8, w_mm: 174, h_mm: 7,
      style: "h3",
      color_role: "headingText",
      max_chars: 80,
      overflow_behavior: "truncate",
    },
    // Body — wider (174mm) and ~6 lines visible. Body is 12pt × 1.625
    // leading = ~7mm/line. 50mm = ~7 lines visible; truncate beyond.
    {
      type: "text",
      name: "note_body",
      content_key: "body",
      x_mm: 18, y_mm: 20, w_mm: 174, h_mm: 50,
      style: "body",
      color_role: "bodyText",
      max_chars: 560,
      overflow_behavior: "truncate",
    },
    // Signature image — moved up close to the body.
    {
      type: "image",
      name: "note_signature",
      content_key: "signatureUrl",
      x_mm: 18, y_mm: 73, w_mm: 50, h_mm: 12,
      object_fit: "contain",
      image_role: "signature",
    },
    // ─── Footer band (text-only, no surface fill) ────────────────────
    // Left — advisor image with caption name underneath.
    {
      type: "image",
      name: "note_advisor_image",
      content_key: "advisorImageUrl",
      x_mm: 18, y_mm: 96, w_mm: 28, h_mm: 28,
      object_fit: "cover",
    },
    {
      type: "text",
      name: "note_advisor_name",
      content_key: "advisorName",
      x_mm: 18, y_mm: 127, w_mm: 56, h_mm: 5,
      style: "caption",
      color_role: "headingText",
      max_chars: 40,
      overflow_behavior: "truncate",
    },
    {
      type: "text",
      name: "note_advisor_role",
      content_key: "advisorRole",
      x_mm: 18, y_mm: 133, w_mm: 56, h_mm: 4,
      style: "eyebrow",
      color_role: "mutedText",
      max_chars: 40,
      overflow_behavior: "truncate",
    },
    // Centre — email + whatsapp text blocks (no buttons, no chips).
    {
      type: "text",
      name: "note_email_label",
      x_mm: 80, y_mm: 96, w_mm: 64, h_mm: 4,
      style: "eyebrow",
      color_role: "mutedText",
      max_chars: 12,
    },
    {
      type: "text",
      name: "note_email_value",
      content_key: "emailValue",
      x_mm: 80, y_mm: 102, w_mm: 64, h_mm: 6,
      style: "caption",
      color_role: "bodyText",
      max_chars: 60,
      overflow_behavior: "scale_down",
    },
    {
      type: "text",
      name: "note_whatsapp_label",
      x_mm: 80, y_mm: 114, w_mm: 64, h_mm: 4,
      style: "eyebrow",
      color_role: "mutedText",
      max_chars: 12,
    },
    {
      type: "text",
      name: "note_whatsapp_value",
      content_key: "whatsappValue",
      x_mm: 80, y_mm: 120, w_mm: 64, h_mm: 6,
      style: "caption",
      color_role: "bodyText",
      max_chars: 40,
      overflow_behavior: "scale_down",
    },
    // Right — small subtle company logo.
    {
      type: "image",
      name: "note_company_logo",
      content_key: "operatorLogoUrl",
      x_mm: 162, y_mm: 100, w_mm: 32, h_mm: 12,
      object_fit: "contain",
      image_role: "logo",
    },
  ],
  rules: [
    "Greeting top edge at 8mm — minimal whitespace above",
    "Body 174mm wide, capped at ~6 visible lines (truncate beyond 560 chars)",
    "Signature sits 73mm — close to body bottom",
    "Footer band is flat text only (no fills, no cards, no shadows)",
  ],
};
