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

// ─── Personal note — TWO variants per spec ────────────────────────────────
//
// Layout config:
//   Half height        147mm (locked)
//   Footer strip       22mm (inside the half, locked at y:125-147)
//   Left / right margin 18mm
//   Top padding        16mm
//   Bottom padding     10mm before footer
//   Max text width     174mm
//
// Content order (locked, identical across variants):
//   1. Title ("Karibu —")
//   2. Body paragraph
//   3. Closing lines (signOffLead / signOff)
//   4. Signature image
//   5. Name + role
//   6. Footer strip — profile image · email · whatsapp · company logo
//
// Vertical accent line: 0.3mm wide hairline at x:18, runs from title
// top to signature bottom. Both variants. Variant B additionally
// renders a large decorative quotation mark and adds 1px separators
// between footer items.

const NOTE_LEFT = 18;        // left content edge (= accent line position)
const NOTE_RIGHT = 192;      // right content edge (= page 210 - 18mm)
const TEXT_X = 24;           // text starts 6mm right of accent line
const TEXT_W = NOTE_RIGHT - TEXT_X; // 168mm
const FOOTER_Y = 125;        // footer band start (22mm tall, ends at y:147)

// Build one personal-note variant. Variant B layers an additional
// quotation mark and footer separators on top of the same skeleton.
function buildPersonalNoteVariant(
  id: string,
  isLuxury: boolean,
): LayoutManifest {
  // Spacing per spec — Luxury adds breathing room. Combined budget
  // (top pad 16 + content + bottom pad 10) must fit in y:16-115 so
  // the spec'd 10mm gap to the footer (which starts at y:125) is
  // honoured.
  const TITLE_TO_BODY = isLuxury ? 10 : 8;
  const BODY_TO_CLOSING = isLuxury ? 10 : 8;
  const CLOSING_TO_SIG = isLuxury ? 8 : 6;
  const SIG_TO_NAME = 4;
  const SIG_W = isLuxury ? 45 : 40;

  // Vertical rhythm — body sized for ~5 lines (35mm A / 32mm B at
  // body × 1.625 leading ≈ 7mm/line). Luxury trades a touch of body
  // height for the larger spacing rhythm + bigger signature so the
  // role line still lands above the footer at y:125.
  const TITLE_Y = 16;
  const TITLE_H = 8;
  const BODY_H = isLuxury ? 30 : 35;
  const CLOSING_H = 11; // single block, two lines at body × 1.35 leading
  const SIG_H = isLuxury ? 12 : 10;
  const NAME_H = 5;
  const ROLE_H = 4;

  const BODY_Y = TITLE_Y + TITLE_H + TITLE_TO_BODY;
  const CLOSING_Y = BODY_Y + BODY_H + BODY_TO_CLOSING;
  const SIG_Y = CLOSING_Y + CLOSING_H + CLOSING_TO_SIG;
  const NAME_Y = SIG_Y + SIG_H + SIG_TO_NAME;
  const ROLE_Y = NAME_Y + NAME_H + 1;
  const ACCENT_BOTTOM = SIG_Y + SIG_H; // accent line ends at signature bottom

  const footerSlots: Slot[] = [
    // Left — profile image (18mm square) + (no caption per spec; name
    // is in the body block above).
    {
      type: "image",
      name: "note_advisor_image",
      content_key: "advisorImageUrl",
      x_mm: NOTE_LEFT, y_mm: FOOTER_Y + 2, w_mm: 18, h_mm: 18,
      object_fit: "cover",
    },
    // Middle — Email + WhatsApp stacked, label above value.
    {
      type: "text",
      name: "note_email_label",
      x_mm: 60, y_mm: FOOTER_Y + 3, w_mm: 60, h_mm: 4,
      style: "eyebrow",
      color_role: "mutedText",
      max_chars: 12,
    },
    {
      type: "text",
      name: "note_email_value",
      content_key: "emailValue",
      x_mm: 60, y_mm: FOOTER_Y + 8, w_mm: 60, h_mm: 5,
      style: "caption",
      color_role: "bodyText",
      max_chars: 60,
      overflow_behavior: "scale_down",
    },
    {
      type: "text",
      name: "note_whatsapp_label",
      x_mm: 60, y_mm: FOOTER_Y + 13, w_mm: 60, h_mm: 4,
      style: "eyebrow",
      color_role: "mutedText",
      max_chars: 12,
    },
    {
      type: "text",
      name: "note_whatsapp_value",
      content_key: "whatsappValue",
      x_mm: 60, y_mm: FOOTER_Y + 18, w_mm: 60, h_mm: 4,
      style: "caption",
      color_role: "bodyText",
      max_chars: 40,
      overflow_behavior: "scale_down",
    },
    // Right — company logo (max 22mm tall).
    {
      type: "image",
      name: "note_company_logo",
      content_key: "operatorLogoUrl",
      x_mm: 162, y_mm: FOOTER_Y + 4, w_mm: 30, h_mm: 14,
      object_fit: "contain",
      image_role: "logo",
    },
  ];

  // Variant B adds 1px separators between footer items (between left
  // image and middle stack, and between middle and right logo).
  const footerSeparators: Slot[] = isLuxury
    ? [
        {
          type: "line",
          name: "footer_sep_left",
          x_mm: 50, y_mm: FOOTER_Y + 4, w_mm: 0.2, h_mm: 14,
          color_role: "border",
        },
        {
          type: "line",
          name: "footer_sep_right",
          x_mm: 152, y_mm: FOOTER_Y + 4, w_mm: 0.2, h_mm: 14,
          color_role: "border",
        },
      ]
    : [];

  // Variant B also adds a large decorative quotation mark above the
  // title, low opacity (the quote glyph itself is the content; we
  // pin it via slot content in the consumer so the variant manifest
  // stays content-free).
  const quoteSlot: Slot[] = isLuxury
    ? [
        {
          type: "text",
          name: "note_quote_mark",
          x_mm: TEXT_X, y_mm: 6, w_mm: 18, h_mm: 14,
          style: "h1",
          color_role: "mutedText",
          alignment: "left",
          max_chars: 4,
        },
      ]
    : [];

  return {
    id,
    section: "personal_note",
    page_count: 1,
    description: isLuxury
      ? "Variant B — Editorial Luxury (decorative quote, more whitespace, footer separators)"
      : "Variant A — Refined Minimal (clean accent line, tight rhythm)",
    slots: [
      // Half background — sectionSurface so the operator's section
      // bg picker repaints just this half.
      {
        type: "fill",
        name: "note_panel_bg",
        x_mm: 0, y_mm: 0, w_mm: 210, h_mm: 147,
        fill: "sectionSurface",
        z_index: 0,
      },
      // Vertical accent line — title top → signature bottom.
      {
        type: "line",
        name: "note_accent_line",
        x_mm: NOTE_LEFT, y_mm: TITLE_Y,
        w_mm: 0.3, h_mm: ACCENT_BOTTOM - TITLE_Y,
        color_role: "border",
      },
      ...quoteSlot,
      // Title — Karibu —
      {
        type: "text",
        name: "note_greeting",
        content_key: "greeting",
        x_mm: TEXT_X, y_mm: TITLE_Y, w_mm: TEXT_W, h_mm: TITLE_H,
        style: "h3",
        color_role: "headingText",
        max_chars: 80,
        overflow_behavior: "truncate",
        line_height: 1.2,
      },
      // Body paragraph.
      {
        type: "text",
        name: "note_body",
        content_key: "body",
        x_mm: TEXT_X, y_mm: BODY_Y, w_mm: TEXT_W, h_mm: BODY_H,
        style: "body",
        color_role: "bodyText",
        max_chars: 560,
        overflow_behavior: "truncate",
      },
      // Closing — two lines on one slot ("Thanks again...\nBest regards,")
      // at slightly tighter leading so they read as a stanza.
      {
        type: "text",
        name: "note_closing",
        content_key: "closing",
        x_mm: TEXT_X, y_mm: CLOSING_Y, w_mm: TEXT_W, h_mm: CLOSING_H,
        style: "body",
        color_role: "bodyText",
        max_chars: 200,
        overflow_behavior: "truncate",
        line_height: 1.35,
      },
      // Signature image — no background box.
      {
        type: "image",
        name: "note_signature",
        content_key: "signatureUrl",
        x_mm: TEXT_X, y_mm: SIG_Y, w_mm: SIG_W, h_mm: SIG_H,
        object_fit: "contain",
        image_role: "signature",
      },
      // Name (semi-bold body) + Role (caption tracked).
      {
        type: "text",
        name: "note_advisor_name",
        content_key: "advisorName",
        x_mm: TEXT_X, y_mm: NAME_Y, w_mm: 110, h_mm: NAME_H,
        style: "body",
        color_role: "headingText",
        max_chars: 50,
        overflow_behavior: "truncate",
      },
      {
        type: "text",
        name: "note_advisor_role",
        content_key: "advisorRole",
        x_mm: TEXT_X, y_mm: ROLE_Y, w_mm: 110, h_mm: ROLE_H,
        style: "eyebrow",
        color_role: "mutedText",
        max_chars: 60,
        overflow_behavior: "truncate",
      },
      // Footer slots last so they sit above the bg fill.
      ...footerSlots,
      ...footerSeparators,
    ],
    rules: [
      "Half height locked at 147mm; footer locked at y:125–147",
      "Vertical accent line runs title top → signature bottom",
      "Content order: title → body → closing → signature → name+role → footer",
      isLuxury
        ? "Variant B — large decorative quote mark, +2mm spacing rhythm, footer separators"
        : "Variant A — clean accent line, tight rhythm",
    ],
  };
}

// ─── Variant B — Editorial Luxury (exact spec measurements) ──────────────
//
// Geometry per the operator's reference measurement diagram. Every
// value below is verbatim — do not adjust without an updated spec.
//
//   Section       147mm tall
//   Footer        22mm at y:125–147 (top border line at y:125)
//   Main content  x:18 y:12 w:174 h:108
//
//   Quote        x:18  y:4   24pt opacity 0.18
//   V-line       x:24  y:20  h:82  width 1px opacity 0.18
//   Title        x:38  y:14  16pt 1.1 leading
//   Body         x:38  y:30  h:44  8.5pt 1.38 leading
//   Closing      x:38  y:78  h:12  8.5pt 1.35 leading
//   Signature    x:38  y:94  w:38  h:12 (no box)
//   Name         x:38  y:108 8pt weight 600
//   Role         x:38  y:114 6.5pt 0.14em uppercase
//
//   Footer base (y:125 inside section):
//     Profile    x:18  y:128 18×18
//     Email      x:60  y:129 48×14   labels 6.5pt / values 7pt
//     WhatsApp   x:114 y:129 48×14
//     Logo       x:170 y:130 22×12
//     Sep1       x:52  y:129 h:14
//     Sep2       x:108 y:129 h:14
//     Sep3       x:164 y:129 h:14

export const PERSONAL_NOTE_VARIANT_B: LayoutManifest = {
  id: "personal-note-variant-b",
  section: "personal_note",
  page_count: 1,
  description:
    "Variant B — Editorial Luxury (exact spec geometry: quote ornament, accent line, gridded footer with separators)",
  slots: [
    // Half background.
    {
      type: "fill",
      name: "note_panel_bg",
      x_mm: 0, y_mm: 0, w_mm: 210, h_mm: 147,
      fill: "sectionSurface",
      z_index: 0,
    },

    // ─── Decorative ornaments (low opacity) ────────────────────────────
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
    {
      type: "fill",
      name: "note_accent_line",
      x_mm: 24, y_mm: 20, w_mm: 0.3, h_mm: 82,
      fill: "headingText",
      opacity: 0.18,
    },

    // ─── Title ─────────────────────────────────────────────────────────
    {
      type: "text",
      name: "note_greeting",
      content_key: "greeting",
      x_mm: 38, y_mm: 14, w_mm: 135, h_mm: 8,
      style: "h3",
      color_role: "headingText",
      size_pt: 16,
      line_height: 1.1,
      max_chars: 80,
      overflow_behavior: "truncate",
    },

    // ─── Body ──────────────────────────────────────────────────────────
    {
      type: "text",
      name: "note_body",
      content_key: "body",
      x_mm: 38, y_mm: 30, w_mm: 135, h_mm: 44,
      style: "body",
      color_role: "bodyText",
      size_pt: 8.5,
      line_height: 1.38,
      max_chars: 700,
      overflow_behavior: "truncate",
    },

    // ─── Closing valediction ───────────────────────────────────────────
    {
      type: "text",
      name: "note_closing",
      content_key: "closing",
      x_mm: 38, y_mm: 78, w_mm: 135, h_mm: 12,
      style: "body",
      color_role: "bodyText",
      size_pt: 8.5,
      line_height: 1.35,
      max_chars: 200,
      overflow_behavior: "truncate",
    },

    // ─── Signature image ───────────────────────────────────────────────
    {
      type: "image",
      name: "note_signature",
      content_key: "signatureUrl",
      x_mm: 38, y_mm: 94, w_mm: 38, h_mm: 12,
      object_fit: "contain",
      image_role: "signature",
    },

    // ─── Advisor name + role ───────────────────────────────────────────
    {
      type: "text",
      name: "note_advisor_name",
      content_key: "advisorName",
      x_mm: 38, y_mm: 108, w_mm: 70, h_mm: 5,
      style: "body",
      color_role: "headingText",
      size_pt: 8,
      font_weight: 600,
      max_chars: 50,
      overflow_behavior: "truncate",
    },
    {
      type: "text",
      name: "note_advisor_role",
      content_key: "advisorRole",
      x_mm: 38, y_mm: 114, w_mm: 70, h_mm: 5,
      style: "eyebrow",
      color_role: "mutedText",
      size_pt: 6.5,
      letter_spacing_em: 0.14,
      uppercase: true,
      max_chars: 60,
      overflow_behavior: "truncate",
    },

    // ─── Footer band — top border line at y:125 ───────────────────────
    {
      type: "fill",
      name: "note_footer_top_border",
      x_mm: 18, y_mm: 125, w_mm: 174, h_mm: 0.3,
      fill: "border",
    },

    // Footer profile image — left.
    {
      type: "image",
      name: "note_advisor_image",
      content_key: "advisorImageUrl",
      x_mm: 18, y_mm: 128, w_mm: 18, h_mm: 18,
      object_fit: "cover",
    },

    // Footer separator 1 — between profile and email.
    {
      type: "fill",
      name: "note_footer_sep_1",
      x_mm: 52, y_mm: 129, w_mm: 0.3, h_mm: 14,
      fill: "border",
    },

    // Email block — label + value.
    {
      type: "text",
      name: "note_email_label",
      x_mm: 60, y_mm: 130, w_mm: 48, h_mm: 4,
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
      x_mm: 60, y_mm: 135, w_mm: 48, h_mm: 8,
      style: "body",
      color_role: "bodyText",
      size_pt: 7,
      line_height: 1.3,
      max_chars: 80,
      overflow_behavior: "scale_down",
    },

    // Footer separator 2 — between email and whatsapp.
    {
      type: "fill",
      name: "note_footer_sep_2",
      x_mm: 108, y_mm: 129, w_mm: 0.3, h_mm: 14,
      fill: "border",
    },

    // WhatsApp block.
    {
      type: "text",
      name: "note_whatsapp_label",
      x_mm: 114, y_mm: 130, w_mm: 48, h_mm: 4,
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
      x_mm: 114, y_mm: 135, w_mm: 48, h_mm: 8,
      style: "body",
      color_role: "bodyText",
      size_pt: 7,
      line_height: 1.3,
      max_chars: 60,
      overflow_behavior: "scale_down",
    },

    // Footer separator 3 — between whatsapp and logo.
    {
      type: "fill",
      name: "note_footer_sep_3",
      x_mm: 164, y_mm: 129, w_mm: 0.3, h_mm: 14,
      fill: "border",
    },

    // Company logo — right.
    {
      type: "image",
      name: "note_company_logo",
      content_key: "operatorLogoUrl",
      x_mm: 170, y_mm: 130, w_mm: 22, h_mm: 12,
      object_fit: "contain",
      image_role: "logo",
    },
  ],
  rules: [
    "Section height locked at 147mm; footer locked at y:125–147",
    "Main content area locked at y:12–120 (h:108mm)",
    "Body slot is 44mm — operator must keep text within ~8 lines",
    "Footer is an absolute grid (no flex) with 3 separator lines",
    "Quote glyph and accent line render at 0.18 opacity",
  ],
};

// Variant A (Refined Minimal) keeps the previous clean rhythm — no
// quote ornament, no footer separators. Built via the helper.
export const PERSONAL_NOTE_VARIANT_A = buildPersonalNoteVariant(
  "personal-note-variant-a",
  false,
);

// Backwards-compat alias used by the consumer when it needs a default.
export const PERSONAL_NOTE_HALF = PERSONAL_NOTE_VARIANT_A;

export const PERSONAL_NOTE_LAYOUTS = [
  PERSONAL_NOTE_VARIANT_A,
  PERSONAL_NOTE_VARIANT_B,
];
