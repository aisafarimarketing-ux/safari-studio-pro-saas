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

export const PROPERTY_CARD_LAYOUTS = [PROPERTY_CARD_STANDARD];
