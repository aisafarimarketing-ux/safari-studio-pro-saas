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

  // Vertical rhythm per the brief — every gap is intentional and
  // the elements read as one composed group, not floating items:
  //   LOGO (12mm) + 6mm gap
  //   TITLE (h1, ~3 lines) + 6mm gap
  //   DESTINATIONS (eyebrow_lg) + 6mm gap
  //   DIVIDER (0.4mm) + 8mm gap
  //   META (2x2 grid)
  //
  // Title slot 38mm in splits ≈ 3 lines of h1 at 12.7mm/line.
  // Overlay (full-bleed) compresses the title slot to 28mm so meta
  // still fits inside the 150mm half.
  const logoY = 14;
  const logoH = 12;
  const titleY = logoY + logoH + 6;
  const titleH = isOverlay ? 28 : 38;
  const destY = titleY + titleH + 6;
  const destH = 6;
  const dividerY = destY + destH + 6;
  const metaTopY = dividerY + 8;
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
      x_mm: innerX, y_mm: logoY, w_mm: 38, h_mm: logoH,
      object_fit: "contain",
      image_role: "logo",
      z_index: 2,
    },
    {
      type: "text",
      name: "trip_title",
      content_key: "tripTitle",
      // Title narrowed to ~85% of the inner column per spec so the
      // line break lands on natural word boundaries; tight ~1.1
      // leading per the editorial brief.
      x_mm: innerX, y_mm: titleY, w_mm: innerW * 0.85, h_mm: titleH,
      style: "h1",
      color_role: titleRole,
      max_chars: 90,
      overflow_behavior: "scale_down",
      line_height: 1.1,
      z_index: 2,
    },
    {
      type: "text",
      name: "trip_destinations",
      content_key: "tripDestinations",
      x_mm: innerX, y_mm: destY, w_mm: innerW, h_mm: destH,
      style: "eyebrow_lg",
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

// ─── Personal note — exactly TWO variants per spec ───────────────────────
//
// Both variants share the same content geometry; Luxury layers a
// decorative quote glyph + footer separators on top.
//
// Section budget (locked):
//   147mm tall · footer 22mm at y:125-147 · main content y:12-120
//   Vertical accent line at x:24mm (both variants), 0.18 opacity
//   Text column max-width 110mm, offset 6mm from accent (text x:30)
//
// Content stack (message block):
//   Title (Karibu)  x:30 y:14 w:110 h:9   16pt 1.1 leading
//   Body            x:30 y:30 w:110 h:44  9pt 1.55 leading
//   Closing         x:30 y:78 w:110 h:12  9pt 1.5 leading
//
// Signature block (no background, quiet):
//   Sig image  x:30 y:94  w:45 h:12 (object-fit contain)
//   Name       x:30 y:110 w:80 h:5  10.5pt weight 600
//   Role       x:30 y:117 w:80 h:5  7.5pt 0.14em uppercase muted
//
// Footer strip (equal column distribution across 174mm):
//   Profile (18x18)  x:18  y:128
//   Sep1 (h:14)      x:42  y:129
//   Email block      x:48  y:130 (label) / y:135 (value 7pt)
//   Sep2             x:102 y:129
//   WhatsApp block   x:108 y:130
//   Sep3             x:162 y:129
//   Logo (22x12)     x:168 y:130
//
// Luxury extras (Variant B only):
//   Quote glyph  x:18 y:4 16x16 24pt opacity 0.18
//   Footer separators (Sep1/2/3 above) — Variant A omits them.

const NOTE_TEXT_X = 30;
const NOTE_TEXT_W = 110;

function noteContentSlots(): Slot[] {
  return [
    // Vertical accent line — subtle editorial anchor (both variants).
    {
      type: "fill",
      name: "note_accent_line",
      x_mm: 24, y_mm: 20, w_mm: 0.3, h_mm: 82,
      fill: "headingText",
      opacity: 0.18,
    },
    // Title — Karibu, Playfair (display) at 16pt / 1.1.
    {
      type: "text",
      name: "note_greeting",
      content_key: "greeting",
      x_mm: NOTE_TEXT_X, y_mm: 14, w_mm: NOTE_TEXT_W, h_mm: 9,
      style: "h3",
      color_role: "headingText",
      size_pt: 16,
      line_height: 1.1,
      max_chars: 80,
      overflow_behavior: "truncate",
    },
    // Body — wider line-height (1.55) for editorial reading rhythm;
    // bumped from 8.5pt to 9pt for the density boost (Option A).
    {
      type: "text",
      name: "note_body",
      content_key: "body",
      x_mm: NOTE_TEXT_X, y_mm: 30, w_mm: NOTE_TEXT_W, h_mm: 44,
      style: "body",
      color_role: "bodyText",
      size_pt: 9,
      line_height: 1.55,
      max_chars: 720,
      overflow_behavior: "truncate",
    },
    // Closing valediction (Thanks again / Best regards) as one stanza.
    {
      type: "text",
      name: "note_closing",
      content_key: "closing",
      x_mm: NOTE_TEXT_X, y_mm: 78, w_mm: NOTE_TEXT_W, h_mm: 12,
      style: "body",
      color_role: "bodyText",
      size_pt: 9,
      line_height: 1.5,
      max_chars: 200,
      overflow_behavior: "truncate",
    },
    // Signature image — no background box.
    {
      type: "image",
      name: "note_signature",
      content_key: "signatureUrl",
      x_mm: NOTE_TEXT_X, y_mm: 94, w_mm: 45, h_mm: 12,
      object_fit: "contain",
      image_role: "signature",
    },
    // Name — semibold at 10.5pt; sits 4mm under signature.
    {
      type: "text",
      name: "note_advisor_name",
      content_key: "advisorName",
      x_mm: NOTE_TEXT_X, y_mm: 110, w_mm: 80, h_mm: 5,
      style: "body",
      color_role: "headingText",
      size_pt: 10.5,
      font_weight: 600,
      max_chars: 50,
      overflow_behavior: "truncate",
    },
    // Role — uppercase tracked, 7.5pt, lighter (mutedText).
    {
      type: "text",
      name: "note_advisor_role",
      content_key: "advisorRole",
      x_mm: NOTE_TEXT_X, y_mm: 117, w_mm: 80, h_mm: 5,
      style: "eyebrow",
      color_role: "mutedText",
      size_pt: 7.5,
      letter_spacing_em: 0.14,
      uppercase: true,
      max_chars: 60,
      overflow_behavior: "truncate",
    },
  ];
}

function noteFooterSlots(includeSeparators: boolean): Slot[] {
  const base: Slot[] = [
    {
      type: "fill",
      name: "note_footer_top_border",
      x_mm: 18, y_mm: 125, w_mm: 174, h_mm: 0.3,
      fill: "border",
    },
    {
      type: "image",
      name: "note_advisor_image",
      content_key: "advisorImageUrl",
      x_mm: 18, y_mm: 128, w_mm: 18, h_mm: 18,
      object_fit: "cover",
    },
    {
      type: "text",
      name: "note_email_label",
      x_mm: 48, y_mm: 130, w_mm: 48, h_mm: 4,
      style: "eyebrow",
      color_role: "mutedText",
      size_pt: 6.5,
      letter_spacing_em: 0.14,
      uppercase: true,
      max_chars: 12,
    },
    {
      type: "text",
      name: "note_email_value",
      content_key: "emailValue",
      x_mm: 48, y_mm: 135, w_mm: 48, h_mm: 8,
      style: "body",
      color_role: "bodyText",
      size_pt: 7,
      line_height: 1.3,
      max_chars: 80,
      overflow_behavior: "scale_down",
    },
    {
      type: "text",
      name: "note_whatsapp_label",
      x_mm: 108, y_mm: 130, w_mm: 48, h_mm: 4,
      style: "eyebrow",
      color_role: "mutedText",
      size_pt: 6.5,
      letter_spacing_em: 0.14,
      uppercase: true,
      max_chars: 12,
    },
    {
      type: "text",
      name: "note_whatsapp_value",
      content_key: "whatsappValue",
      x_mm: 108, y_mm: 135, w_mm: 48, h_mm: 8,
      style: "body",
      color_role: "bodyText",
      size_pt: 7,
      line_height: 1.3,
      max_chars: 60,
      overflow_behavior: "scale_down",
    },
    {
      type: "image",
      name: "note_company_logo",
      content_key: "operatorLogoUrl",
      x_mm: 168, y_mm: 130, w_mm: 22, h_mm: 12,
      object_fit: "contain",
      image_role: "logo",
    },
  ];
  if (!includeSeparators) return base;
  const SEP_H = 14;
  const SEP_Y = 129;
  const sep: Slot[] = [
    {
      type: "fill",
      name: "note_footer_sep_1",
      x_mm: 42, y_mm: SEP_Y, w_mm: 0.3, h_mm: SEP_H,
      fill: "border",
      opacity: 0.5,
    },
    {
      type: "fill",
      name: "note_footer_sep_2",
      x_mm: 102, y_mm: SEP_Y, w_mm: 0.3, h_mm: SEP_H,
      fill: "border",
      opacity: 0.5,
    },
    {
      type: "fill",
      name: "note_footer_sep_3",
      x_mm: 162, y_mm: SEP_Y, w_mm: 0.3, h_mm: SEP_H,
      fill: "border",
      opacity: 0.5,
    },
  ];
  return [...base, ...sep];
}

function buildPersonalNoteManifest(
  id: string,
  isLuxury: boolean,
): LayoutManifest {
  const decorations: Slot[] = isLuxury
    ? [
        {
          type: "text",
          name: "note_quote_mark",
          x_mm: 18, y_mm: 4, w_mm: 16, h_mm: 16,
          style: "h1",
          color_role: "headingText",
          size_pt: 24,
          line_height: 1,
          opacity: 0.18,
          max_chars: 4,
        },
      ]
    : [];

  return {
    id,
    section: "personal_note",
    page_count: 1,
    description: isLuxury
      ? "Variant B — Editorial Luxury (decorative quote, footer separators)"
      : "Variant A — Refined Minimal (clean rhythm, no ornaments)",
    slots: [
      {
        type: "fill",
        name: "note_panel_bg",
        x_mm: 0, y_mm: 0, w_mm: 210, h_mm: 147,
        fill: "sectionSurface",
        z_index: 0,
      },
      ...decorations,
      ...noteContentSlots(),
      ...noteFooterSlots(isLuxury),
    ],
    rules: [
      "Section height locked at 147mm; footer locked at y:125-147",
      "Main content area locked at y:12-120",
      "Body slot 44mm — operator must keep text within ~9 lines",
      "Footer is an absolute grid (no flex)",
      isLuxury
        ? "Luxury — quote glyph at 0.18 opacity, footer separators visible"
        : "Minimal — no quote, no footer separators",
    ],
  };
}

export const PERSONAL_NOTE_VARIANT_A = buildPersonalNoteManifest(
  "personal-note-variant-a",
  false,
);
export const PERSONAL_NOTE_VARIANT_B = buildPersonalNoteManifest(
  "personal-note-variant-b",
  true,
);

export const PERSONAL_NOTE_HALF = PERSONAL_NOTE_VARIANT_A;

export const PERSONAL_NOTE_LAYOUTS = [
  PERSONAL_NOTE_VARIANT_A,
  PERSONAL_NOTE_VARIANT_B,
];
