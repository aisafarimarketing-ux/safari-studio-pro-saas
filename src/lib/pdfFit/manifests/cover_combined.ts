import type { LayoutManifest, Slot } from "../types";

// ─── Combined cover + personal note (single A4 page) ─────────────────────
//
// Per spec: ONE A4 page with TWO fixed sections.
//   COVER         y 0 → 150mm    (height 150mm)
//   PERSONAL NOTE y 150 → 297mm  (height 147mm)
//
// The cover half exposes the seven spec layouts. Each is a 150mm-tall
// variant of the standalone cover layout and shares the identical text
// content (logo / title / destinations / divider / meta 2×2 grid).
//
//   FULL_BLEED  image fills the whole half; text overlays a gradient
//   S64L        text 64% LEFT, image 36% RIGHT
//   S64R        text 64% RIGHT, image 36% LEFT
//   S55L        text 55% LEFT, image 45% RIGHT
//   S55R        text 55% RIGHT, image 45% LEFT
//   S46L        text 46% LEFT, image 54% RIGHT
//   S46R        text 46% RIGHT, image 54% LEFT

const HALF_H = 150;
const PAGE_W = 210;
const PAD = 12;

// Build the meta-grid + title slots given a text-panel geometry. All
// 7 layouts share this internal structure.
function textPanelSlots(
  panel: { x: number; w: number },
  isOverlay: boolean,
): Slot[] {
  const innerX = panel.x + PAD;
  const innerW = Math.max(40, panel.w - PAD * 2);
  // Pull title down to make room for the logo on top; tighten when the
  // panel is the whole page (FULL_BLEED) by anchoring text low so the
  // image breathes.
  const titleY = isOverlay ? 78 : 38;
  const destY = isOverlay ? 116 : 80;
  const dividerY = isOverlay ? 124 : 92;
  const metaTopY = isOverlay ? 130 : 102;
  const metaBottomY = isOverlay ? 140 : 124;

  const colW = (innerW - 4) / 2; // tiny gutter between meta cols
  const col1X = innerX;
  const col2X = innerX + colW + 4;

  // Colour roles: text panel uses "headingText"/"mutedText"; full-bleed
  // overlay flips title + meta to white for legibility on imagery.
  const titleRole = isOverlay ? "white" : "headingText";
  const metaValueRole = isOverlay ? "white" : "headingText";
  const metaLabelRole = isOverlay ? "white" : "mutedText";
  const accentRole = isOverlay ? "white" : "accent";
  const dividerRole = isOverlay ? "white" : "border";

  return [
    {
      type: "image",
      name: "operator_logo",
      content_key: "operatorLogoUrl",
      x_mm: innerX, y_mm: PAD, w_mm: 38, h_mm: 14,
      object_fit: "contain",
      image_role: "logo",
      z_index: 2,
    },
    {
      type: "text",
      name: "trip_title",
      content_key: "tripTitle",
      x_mm: innerX, y_mm: titleY, w_mm: innerW, h_mm: 36,
      style: "h2",
      color_role: titleRole,
      max_chars: 90,
      overflow_behavior: "scale_down",
      z_index: 2,
    },
    {
      type: "text",
      name: "trip_destinations",
      content_key: "tripDestinations",
      x_mm: innerX, y_mm: destY, w_mm: innerW, h_mm: 6,
      style: "eyebrow",
      color_role: accentRole,
      max_chars: 120,
      overflow_behavior: "scale_down",
      z_index: 2,
    },
    {
      type: "line",
      name: "header_divider",
      x_mm: innerX, y_mm: dividerY, w_mm: innerW, h_mm: 1,
      color_role: dividerRole,
      z_index: 2,
    },
    // Meta row 1 — FOR | DATES
    {
      type: "text",
      name: "meta_for_label",
      x_mm: col1X, y_mm: metaTopY, w_mm: colW, h_mm: 5,
      style: "eyebrow",
      color_role: metaLabelRole,
      max_chars: 12,
      z_index: 2,
    },
    {
      type: "text",
      name: "meta_for_value",
      x_mm: col1X, y_mm: metaTopY + 7, w_mm: colW, h_mm: 7,
      style: "body",
      color_role: metaValueRole,
      max_chars: 60,
      overflow_behavior: "scale_down",
      z_index: 2,
    },
    {
      type: "text",
      name: "meta_dates_label",
      x_mm: col2X, y_mm: metaTopY, w_mm: colW, h_mm: 5,
      style: "eyebrow",
      color_role: metaLabelRole,
      max_chars: 12,
      z_index: 2,
    },
    {
      type: "text",
      name: "meta_dates_value",
      x_mm: col2X, y_mm: metaTopY + 7, w_mm: colW, h_mm: 7,
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
      x_mm: col1X, y_mm: metaBottomY, w_mm: colW, h_mm: 5,
      style: "eyebrow",
      color_role: metaLabelRole,
      max_chars: 12,
      z_index: 2,
    },
    {
      type: "text",
      name: "meta_duration_value",
      x_mm: col1X, y_mm: metaBottomY + 7, w_mm: colW, h_mm: 7,
      style: "body",
      color_role: metaValueRole,
      max_chars: 60,
      overflow_behavior: "scale_down",
      z_index: 2,
    },
    {
      type: "text",
      name: "meta_party_label",
      x_mm: col2X, y_mm: metaBottomY, w_mm: colW, h_mm: 5,
      style: "eyebrow",
      color_role: metaLabelRole,
      max_chars: 12,
      z_index: 2,
    },
    {
      type: "text",
      name: "meta_party_value",
      x_mm: col2X, y_mm: metaBottomY + 7, w_mm: colW, h_mm: 7,
      style: "body",
      color_role: metaValueRole,
      max_chars: 60,
      overflow_behavior: "scale_down",
      z_index: 2,
    },
  ];
}

// Build a split half-cover layout. textPercent = how much horizontal
// space the TEXT panel takes; textOnLeft picks which side gets the text.
// Per spec: "S64L (64% text LEFT, 36% image RIGHT)" so L → text-on-left.
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
      // Image first (z:0).
      {
        type: "image",
        name: "hero_image",
        content_key: "heroImageUrl",
        x_mm: imagePanelX, y_mm: 0, w_mm: imageW, h_mm: HALF_H,
        object_fit: "cover",
        image_role: "hero",
        z_index: 0,
      },
      // Text panel surface — sectionSurface so the operator's section
      // bg picker repaints just the text panel.
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
      `Image panel locked to ${100 - textPercent}% width on the ${textOnLeft ? "right" : "left"}`,
      "Cover half height fixed at 150mm",
      "Destinations single line, no wrap",
    ],
  };
}

// Full-bleed half — image fills 0–150mm; text overlays a gradient.
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
      "Cover half height fixed at 150mm",
    ],
  };
}

// ─── Cover half layouts (the seven spec variants) ─────────────────────────

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

export const PERSONAL_NOTE_HALF: LayoutManifest = {
  id: "personal-note-half",
  section: "personal_note",
  page_count: 1,
  description: "Combined-page personal note half (bottom 147mm)",
  slots: [
    {
      type: "fill",
      name: "note_panel_bg",
      x_mm: 0, y_mm: 0, w_mm: 210, h_mm: 147,
      fill: "sectionSurface",
      z_index: 0,
    },
    {
      type: "text",
      name: "note_greeting",
      content_key: "greeting",
      x_mm: 18, y_mm: 15, w_mm: 174, h_mm: 8,
      style: "h3",
      color_role: "headingText",
      max_chars: 80,
      overflow_behavior: "truncate",
    },
    {
      type: "text",
      name: "note_body",
      content_key: "body",
      x_mm: 18, y_mm: 30, w_mm: 174, h_mm: 60,
      style: "body",
      color_role: "bodyText",
      max_chars: 700,
      overflow_behavior: "truncate",
    },
    {
      type: "image",
      name: "note_signature",
      content_key: "signatureUrl",
      x_mm: 18, y_mm: 95, w_mm: 50, h_mm: 12,
      object_fit: "contain",
      image_role: "signature",
    },
    {
      type: "text",
      name: "note_advisor_name",
      content_key: "advisorName",
      x_mm: 18, y_mm: 110, w_mm: 110, h_mm: 6,
      style: "body",
      color_role: "headingText",
      max_chars: 50,
      overflow_behavior: "truncate",
    },
    {
      type: "text",
      name: "note_advisor_role",
      content_key: "advisorRole",
      x_mm: 18, y_mm: 117, w_mm: 110, h_mm: 5,
      style: "caption",
      color_role: "mutedText",
      max_chars: 60,
      overflow_behavior: "truncate",
    },
    {
      type: "fill",
      name: "note_footer_bg",
      x_mm: 0, y_mm: 125, w_mm: 210, h_mm: 22,
      fill: "sectionBg",
    },
    {
      type: "image",
      name: "note_advisor_image",
      content_key: "advisorImageUrl",
      x_mm: 18, y_mm: 128, w_mm: 20, h_mm: 16,
      object_fit: "cover",
    },
    {
      type: "text",
      name: "note_email_label",
      x_mm: 48, y_mm: 129, w_mm: 50, h_mm: 5,
      style: "eyebrow",
      color_role: "mutedText",
      max_chars: 12,
    },
    {
      type: "text",
      name: "note_email_value",
      x_mm: 48, y_mm: 135, w_mm: 50, h_mm: 9,
      style: "caption",
      color_role: "bodyText",
      max_chars: 60,
      overflow_behavior: "scale_down",
    },
    {
      type: "text",
      name: "note_whatsapp_label",
      x_mm: 104, y_mm: 129, w_mm: 50, h_mm: 5,
      style: "eyebrow",
      color_role: "mutedText",
      max_chars: 12,
    },
    {
      type: "text",
      name: "note_whatsapp_value",
      x_mm: 104, y_mm: 135, w_mm: 50, h_mm: 9,
      style: "caption",
      color_role: "bodyText",
      max_chars: 40,
      overflow_behavior: "scale_down",
    },
    {
      type: "image",
      name: "note_company_logo",
      content_key: "operatorLogoUrl",
      x_mm: 162, y_mm: 130, w_mm: 30, h_mm: 12,
      object_fit: "contain",
      image_role: "logo",
    },
  ],
  rules: [
    "Personal note height is exactly 147mm",
    "Body truncates after 700 chars (60mm slot height)",
    "Footer band locked to y:125-147 within the half",
  ],
};
