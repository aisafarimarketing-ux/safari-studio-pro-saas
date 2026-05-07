import type { LayoutManifest, Slot } from "../types";

// ─── Property card — magazine layout (single A4) ─────────────────────────
//
// Mirrors the legacy on-screen Magazine layout (PropertyShowcaseSection)
// but locked to one printed page:
//
//   y:0–100   Hero image (full content bleed, 174×100mm)
//   y:108     PROPERTY N OF M eyebrow
//   y:116     Property name (h1)
//   y:140     Location · Tier
//   y:148     "Why we chose this" italic editorial line
//   y:170     Hairline divider
//   y:178     LEFT COL  YOUR STAY stats   |  RIGHT COL  Description
//   y:235     LEFT COL  AT A GLANCE       |
//   y:266     Hairline
//   y:272     Thumbs (3 × 56mm wide)
//
// All content binds to backend Property fields — name, location, tier,
// whyWeChoseThis, roomType, mealPlan, checkInTime, checkOutTime,
// totalRooms, amenities[], description, leadImageUrl, galleryUrls[].

const PAGE_W = 210;
const CONTENT_X = 18;
const CONTENT_W = 174;

// ─── Helper — one "Your Stay" fact row (label left, value right). ───────
function buildStatRow(
  index: number,
  baseY: number,
  rowH: number,
): Slot[] {
  const y = baseY + index * rowH;
  // Inside the 80mm left column starting at x:18.
  const labelX = CONTENT_X;
  const valueX = CONTENT_X + 30;
  return [
    {
      type: "text",
      name: `stay_row_${index + 1}_label`,
      x_mm: labelX, y_mm: y, w_mm: 30, h_mm: rowH,
      style: "eyebrow",
      color_role: "mutedText",
      size_pt: 7.5,
      letter_spacing_em: 0.16,
      uppercase: true,
      max_chars: 16,
    },
    {
      type: "text",
      name: `stay_row_${index + 1}_value`,
      content_key: `stayRow${index + 1}Value`,
      x_mm: valueX, y_mm: y, w_mm: 50, h_mm: rowH,
      style: "body",
      color_role: "headingText",
      size_pt: 10,
      line_height: 1.2,
      max_chars: 60,
      overflow_behavior: "truncate",
    },
  ];
}

const STAY_ROW_FIRST_Y = 184;
const STAY_ROW_H = 6;

export const PROPERTY_CARD_STANDARD: LayoutManifest = {
  id: "property-card-standard",
  section: "property_card",
  page_count: 1,
  description:
    "Magazine property layout — hero / name / facts / amenities / description / thumbs",
  slots: [
    // Section bg.
    {
      type: "fill",
      name: "section_bg",
      x_mm: 0, y_mm: 0, w_mm: PAGE_W, h_mm: 297,
      fill: "sectionSurface",
      z_index: 0,
    },

    // ─── Hero image — primary anchor ──────────────────────────────────
    {
      type: "image",
      name: "main_image",
      content_key: "mainImageUrl",
      x_mm: CONTENT_X, y_mm: 0, w_mm: CONTENT_W, h_mm: 100,
      object_fit: "cover",
      image_role: "hero",
    },

    // ─── Property identity ────────────────────────────────────────────
    {
      type: "text",
      name: "section_title",
      content_key: "sectionTitle",
      x_mm: CONTENT_X, y_mm: 108, w_mm: CONTENT_W, h_mm: 5,
      style: "eyebrow",
      color_role: "mutedText",
      size_pt: 9,
      letter_spacing_em: 0.18,
      uppercase: true,
      max_chars: 60,
    },
    {
      type: "text",
      name: "property_name",
      content_key: "propertyName",
      x_mm: CONTENT_X, y_mm: 116, w_mm: CONTENT_W, h_mm: 22,
      style: "h1",
      color_role: "headingText",
      size_pt: 28,
      line_height: 1.05,
      font_weight: 700,
      letter_spacing_em: -0.01,
      max_chars: 60,
      overflow_behavior: "scale_down",
    },
    {
      type: "text",
      name: "location_meta",
      content_key: "locationMeta",
      x_mm: CONTENT_X, y_mm: 140, w_mm: CONTENT_W, h_mm: 5,
      style: "eyebrow",
      color_role: "accent",
      size_pt: 10,
      letter_spacing_em: 0.14,
      uppercase: true,
      max_chars: 80,
      overflow_behavior: "truncate",
    },
    {
      type: "text",
      name: "why_we_chose_this",
      content_key: "whyWeChoseThis",
      x_mm: CONTENT_X, y_mm: 150, w_mm: CONTENT_W, h_mm: 14,
      style: "body",
      color_role: "bodyText",
      size_pt: 13,
      line_height: 1.4,
      max_chars: 200,
      overflow_behavior: "scale_down",
    },
    {
      type: "fill",
      name: "header_divider",
      x_mm: CONTENT_X, y_mm: 170, w_mm: CONTENT_W, h_mm: 0.3,
      fill: "border",
      opacity: 0.5,
    },

    // ─── LEFT COLUMN — YOUR STAY stats ────────────────────────────────
    {
      type: "text",
      name: "stay_label",
      x_mm: CONTENT_X, y_mm: 176, w_mm: 80, h_mm: 5,
      style: "eyebrow",
      color_role: "mutedText",
      size_pt: 9,
      letter_spacing_em: 0.18,
      uppercase: true,
      max_chars: 24,
    },
    ...buildStatRow(0, STAY_ROW_FIRST_Y, STAY_ROW_H),
    ...buildStatRow(1, STAY_ROW_FIRST_Y, STAY_ROW_H),
    ...buildStatRow(2, STAY_ROW_FIRST_Y, STAY_ROW_H),
    ...buildStatRow(3, STAY_ROW_FIRST_Y, STAY_ROW_H),
    ...buildStatRow(4, STAY_ROW_FIRST_Y, STAY_ROW_H),

    // ─── LEFT COLUMN — AT A GLANCE amenities ──────────────────────────
    {
      type: "text",
      name: "amenities_label",
      x_mm: CONTENT_X, y_mm: 224, w_mm: 80, h_mm: 5,
      style: "eyebrow",
      color_role: "mutedText",
      size_pt: 9,
      letter_spacing_em: 0.18,
      uppercase: true,
      max_chars: 24,
    },
    {
      type: "text",
      name: "amenities_list",
      content_key: "amenitiesList",
      x_mm: CONTENT_X, y_mm: 232, w_mm: 80, h_mm: 30,
      style: "body",
      color_role: "headingText",
      size_pt: 10,
      line_height: 1.5,
      max_chars: 200,
      overflow_behavior: "truncate",
    },

    // ─── RIGHT COLUMN — Description ───────────────────────────────────
    {
      type: "text",
      name: "description",
      content_key: "description",
      x_mm: 108, y_mm: 176, w_mm: 84, h_mm: 88,
      style: "body",
      color_role: "bodyText",
      size_pt: 10.5,
      line_height: 1.55,
      max_chars: 800,
      overflow_behavior: "truncate",
    },

    // ─── Footer — hairline + thumbs ───────────────────────────────────
    {
      type: "fill",
      name: "footer_divider",
      x_mm: CONTENT_X, y_mm: 268, w_mm: CONTENT_W, h_mm: 0.3,
      fill: "border",
      opacity: 0.5,
    },
    {
      type: "image",
      name: "thumb_1",
      content_key: "thumbUrl1",
      x_mm: CONTENT_X, y_mm: 274, w_mm: 56, h_mm: 20,
      object_fit: "cover",
      image_role: "thumb",
    },
    {
      type: "image",
      name: "thumb_2",
      content_key: "thumbUrl2",
      x_mm: 77, y_mm: 274, w_mm: 56, h_mm: 20,
      object_fit: "cover",
      image_role: "thumb",
    },
    {
      type: "image",
      name: "thumb_3",
      content_key: "thumbUrl3",
      x_mm: 136, y_mm: 274, w_mm: 56, h_mm: 20,
      object_fit: "cover",
      image_role: "thumb",
    },
  ],
  rules: [
    "Section fills full A4 (297mm) with 18mm L/R margins",
    "Hero y:0–100 — primary visual anchor at 174mm wide",
    "Identity y:108–164: property eyebrow / name / location / why",
    "Left col 80mm — Your Stay (5 rows) + At a glance amenities",
    "Right col 84mm — Description body up to 800 chars",
    "Footer thumbs y:274 — 3 × 56mm × 20mm thumbnails",
  ],
};

// ─── Property card — Editorial Look ──────────────────────────────────────
//
// INVARIANT: ONE PROPERTY = ONE PAGE. Non-paginating; long content
// truncates, never splits. Inherits the same architectural guarantees
// as PROPERTY_CARD_STANDARD (see day_card.ts for the full invariant
// rationale).
//
// Companion to DAY_CARD_EDITORIAL_SPLIT — same Look family, different
// emotional center. Day Editorial spotlights the photograph; Property
// Editorial spotlights the sentence (the promoted whyWeChoseThis
// pullquote at y:173).
//
// Composition (top → bottom, calm Editorial pacing):
//   y: 18-42  IDENTITY  — propertyClass eyebrow / name / location-suitability
//   y: 45     hairline divider (0.3mm, opacity 0.4)
//   y: 50-165 HERO 174×115 (≈1.51:1, framed within margins, never bleed)
//   y:173-197 PULLQUOTE 162×24 — italic 17pt, left-inset 30mm (asymmetric)
//   y:203-233 ATMOSPHERE PARAGRAPH 174×30 — single column 11pt × 1.55
//   y:241-269 SUPPORTING IMAGE 100×28 — right-inset panoramic
//   y:273-278 PRACTICAL STRIP — single composed line, 9pt eyebrow
//   y:280-284 CLOSURE — tiny "Property N of M" right-aligned
//   y:284-297 13mm intentional editorial whitespace
//
// Three slot names diverge from the Standard layout so this Look can
// carry distinct content shaping without affecting Standard's output:
//   - property_class_eyebrow      (vs section_title)
//   - location_suitability        (vs location_meta)
//   - why_we_chose_this_pullquote (vs why_we_chose_this)
//   - atmosphere_paragraph        (vs description)
//   - supporting_image            (vs thumb_1/2/3)
//   - practical_strip             (NEW — composed inline replacement for stay grid)
//   - closure                     (NEW — tiny footer, replaces top section_title)
// The renderer in PdfFitPropertyPage.tsx populates these as additive
// contents-map entries; Standard ignores them.

const E_MARGIN_LR = 18;
const E_CONTENT_W = 174;
const E_PULLQUOTE_INSET_LEFT = 30;
const E_PULLQUOTE_W = 162;
const E_SUPPORTING_W = 100;
const E_SUPPORTING_X = 92;          // 192 − 100 (right-inset)
const E_CLOSURE_W = 60;
const E_CLOSURE_X = 132;            // 192 − 60 (right-aligned)

export const PROPERTY_CARD_EDITORIAL: LayoutManifest = {
  id: "property-card-editorial",
  section: "property_card",
  page_count: 1,
  description:
    "Editorial property page — calm, story-led, restrained. Identity above hero, promoted whyWeChoseThis pullquote as the page's emotional center, asymmetric supporting image, composed practical strip. ONE PROPERTY = ONE PAGE.",
  slots: [
    // ─── Background ──────────────────────────────────────────────────
    {
      type: "fill",
      name: "section_bg",
      x_mm: 0, y_mm: 0, w_mm: PAGE_W, h_mm: 297,
      fill: "sectionSurface",
      z_index: 0,
    },

    // ─── Identity (y:18–42) ──────────────────────────────────────────
    // propertyClass → name → location · suitability, composed as one
    // unit with tight 1mm inner gaps.
    {
      type: "text",
      name: "property_class_eyebrow",
      content_key: "propertyClassEyebrow",
      x_mm: E_MARGIN_LR, y_mm: 18, w_mm: E_CONTENT_W, h_mm: 5,
      style: "eyebrow",
      color_role: "mutedText",
      size_pt: 9,
      letter_spacing_em: 0.18,
      uppercase: true,
      max_chars: 24,
      overflow_behavior: "truncate",
    },
    {
      type: "text",
      name: "property_name",
      content_key: "propertyName",
      x_mm: E_MARGIN_LR, y_mm: 24, w_mm: E_CONTENT_W, h_mm: 12,
      style: "h1",
      color_role: "headingText",
      size_pt: 26,
      line_height: 1.05,
      font_weight: 700,
      letter_spacing_em: -0.005,
      max_chars: 60,
      overflow_behavior: "scale_down",
    },
    {
      type: "text",
      name: "location_suitability",
      content_key: "locationSuitability",
      x_mm: E_MARGIN_LR, y_mm: 37, w_mm: E_CONTENT_W, h_mm: 5,
      style: "eyebrow",
      color_role: "mutedText",
      size_pt: 10,
      letter_spacing_em: 0.14,
      uppercase: true,
      max_chars: 60,
      overflow_behavior: "truncate",
    },

    // ─── Identity divider (subtle hairline) ──────────────────────────
    {
      type: "fill",
      name: "identity_divider",
      x_mm: E_MARGIN_LR, y_mm: 45, w_mm: E_CONTENT_W, h_mm: 0.3,
      fill: "border",
      opacity: 0.4,
    },

    // ─── Hero (y:50–165) — framed within margins, NEVER bleed ────────
    {
      type: "image",
      name: "main_image",
      content_key: "mainImageUrl",
      x_mm: E_MARGIN_LR, y_mm: 50, w_mm: E_CONTENT_W, h_mm: 115,
      object_fit: "cover",
      image_role: "hero",
    },

    // ─── Pullquote (y:173–197) — the page's emotional center ─────────
    // Italic display, left-inset 12mm beyond standard margin for
    // editorial asymmetry. Promoted whyWeChoseThis content.
    {
      type: "text",
      name: "why_we_chose_this_pullquote",
      content_key: "whyWeChoseThisPullquote",
      x_mm: E_PULLQUOTE_INSET_LEFT, y_mm: 173, w_mm: E_PULLQUOTE_W, h_mm: 24,
      style: "body",
      color_role: "headingText",
      size_pt: 17,
      line_height: 1.4,
      font_weight: 400,
      font_style: "italic",
      max_chars: 200,
      overflow_behavior: "scale_down",
    },

    // ─── Atmosphere paragraph (y:203–233) — single column ────────────
    {
      type: "text",
      name: "atmosphere_paragraph",
      content_key: "atmosphereParagraph",
      x_mm: E_MARGIN_LR, y_mm: 203, w_mm: E_CONTENT_W, h_mm: 30,
      style: "body",
      color_role: "bodyText",
      size_pt: 11,
      line_height: 1.55,
      max_chars: 480,
      overflow_behavior: "truncate",
    },

    // ─── Supporting image (y:241–269) — right-inset panoramic ────────
    // Single image; never a thumbnail filmstrip. Asymmetric placement
    // leaves 74mm of compositional whitespace to its left.
    {
      type: "image",
      name: "supporting_image",
      content_key: "supportingImageUrl",
      x_mm: E_SUPPORTING_X, y_mm: 241, w_mm: E_SUPPORTING_W, h_mm: 28,
      object_fit: "cover",
      image_role: "thumb",
    },

    // ─── Practical strip (y:273–278) — single composed line ──────────
    // No row grid. Composed inline by the renderer:
    //   "5 nights · Family Suite · full board · arrive 14:00"
    {
      type: "text",
      name: "practical_strip",
      content_key: "practicalStrip",
      x_mm: E_MARGIN_LR, y_mm: 273, w_mm: E_CONTENT_W, h_mm: 5,
      style: "eyebrow",
      color_role: "mutedText",
      size_pt: 9,
      letter_spacing_em: 0.16,
      uppercase: true,
      max_chars: 80,
      overflow_behavior: "truncate",
    },

    // ─── Closure (y:280–284) — tiny "Property N of M", right-aligned ─
    {
      type: "text",
      name: "closure",
      content_key: "closure",
      x_mm: E_CLOSURE_X, y_mm: 280, w_mm: E_CLOSURE_W, h_mm: 4,
      style: "eyebrow",
      color_role: "mutedText",
      size_pt: 7.5,
      letter_spacing_em: 0.18,
      uppercase: true,
      alignment: "right",
      opacity: 0.7,
      max_chars: 24,
      overflow_behavior: "truncate",
    },
  ],
  rules: [
    "ONE PROPERTY = ONE PAGE — non-paginating by construction; long content truncates, never splits",
    "A4 print-safe — 18mm L/R margins, 18mm top, 13mm bottom whitespace",
    "Identity above hero (eyebrow → name → location, with hairline divider)",
    "Hero 174×115 framed within margins — never full-bleed",
    "Promoted whyWeChoseThis pullquote (17pt italic serif, left-inset 30mm) is the page's emotional center",
    "Atmosphere paragraph single column 174×30 at 11pt × 1.55 (~480 char cap)",
    "Single right-inset panoramic supporting image (100×28); never a thumbnail filmstrip",
    "Composed practical strip — single line, no row grid",
    "Tiny closure (Property N of M) bottom-right at 7.5pt opacity 0.7",
  ],
};

export const PROPERTY_CARD_LAYOUTS = [PROPERTY_CARD_STANDARD, PROPERTY_CARD_EDITORIAL];
