import type { LayoutManifest, Slot } from "../types";

// ─── Trip summary / "Itinerary at a glance" — full-page editorial ────────
//
// Section fills the entire A4 page (297mm). Spec proportions kept:
//   Top content (itinerary + map):   y:0   → 270  (270mm, 90.9%)
//   Stats bar:                       y:270 → 290  (20mm)
//   Summary line:                    y:290 → 297  (7mm)
//
// Top-content split (270mm height):
//   Left column (itinerary)  x:0   w:84  (40%)
//   Right column (map)       x:84  w:126 (60%)
//
// Left column (text inset x:18, w:66):
//   ITINERARY AT A GLANCE      y:14   9pt eyebrow / 0.18em
//   Section title              y:24   28pt h2 / 1.05
//   Subtitle                   y:48   10pt eyebrow / 0.14em
//   Day blocks (max 6)         y:60 → 270 (6 × 32mm + 5 × 3mm gap)
//
// Each day block (32mm tall, full 84mm column):
//   Day number  x:6  y:8  w:12 h:14   18pt bold
//   Image       x:18 y:0  w:66 h:22   object-fit cover
//   LOCATION    x:18 y:23 w:66 h:4    12pt bold
//   Property    x:18 y:27 w:66 h:3    9pt
//   Day text    x:18 y:30 w:66 h:2    8pt muted
//
// Stats bar (4 equal columns at 43.5mm each, vertical separators):
//   Number 26pt bold · Label 9pt uppercase 0.14em
//
// Summary: centered italic 9pt across the 174mm content band

const PAGE_W = 210;
const SECTION_H = 297;
const STATS_H = 20;
const SUMMARY_H = 7;
const TOP_CONTENT_H = SECTION_H - STATS_H - SUMMARY_H; // 270

const LEFT_COL_W = 84;
const RIGHT_COL_W = PAGE_W - LEFT_COL_W;
const RIGHT_COL_X = LEFT_COL_W;

const TEXT_INSET_X = 18;
const TEXT_INSET_W = LEFT_COL_W - TEXT_INSET_X;

// Day block geometry — 6 blocks, 32mm tall, 3mm spacing.
const DAY_BLOCKS_MAX = 6;
const DAY_BLOCK_H = 32;
const DAY_BLOCK_GAP = 3;
const DAY_BLOCK_FIRST_Y = 60;

const STATS_Y = TOP_CONTENT_H;        // 270
const SUMMARY_Y = STATS_Y + STATS_H;  // 290

function buildDayBlock(index: number): Slot[] {
  const y = DAY_BLOCK_FIRST_Y + index * (DAY_BLOCK_H + DAY_BLOCK_GAP);
  const dayNumX = TEXT_INSET_X - 12;
  const imageX = TEXT_INSET_X;
  const imageW = TEXT_INSET_W;
  const imageH = 22;
  const textBelowY = y + imageH + 1;

  return [
    {
      type: "text",
      name: `day_${index + 1}_number`,
      content_key: `day${index + 1}Number`,
      x_mm: dayNumX, y_mm: y + 4, w_mm: 12, h_mm: 14,
      style: "h2",
      color_role: "headingText",
      size_pt: 18,
      line_height: 1.0,
      font_weight: 700,
      max_chars: 4,
    },
    {
      type: "image",
      name: `day_${index + 1}_image`,
      content_key: `day${index + 1}ImageUrl`,
      x_mm: imageX, y_mm: y, w_mm: imageW, h_mm: imageH,
      object_fit: "cover",
    },
    {
      type: "text",
      name: `day_${index + 1}_location`,
      content_key: `day${index + 1}Location`,
      x_mm: imageX, y_mm: textBelowY, w_mm: imageW, h_mm: 4,
      style: "body",
      color_role: "headingText",
      size_pt: 12,
      line_height: 1.1,
      font_weight: 700,
      letter_spacing_em: 0.02,
      max_chars: 30,
      overflow_behavior: "truncate",
    },
    {
      type: "text",
      name: `day_${index + 1}_property`,
      content_key: `day${index + 1}Property`,
      x_mm: imageX, y_mm: textBelowY + 4, w_mm: imageW, h_mm: 3,
      style: "body",
      color_role: "bodyText",
      size_pt: 9,
      line_height: 1.1,
      max_chars: 40,
      overflow_behavior: "truncate",
    },
    {
      type: "text",
      name: `day_${index + 1}_caption`,
      content_key: `day${index + 1}Caption`,
      x_mm: imageX, y_mm: textBelowY + 7, w_mm: imageW, h_mm: 3,
      style: "caption",
      color_role: "mutedText",
      size_pt: 8,
      line_height: 1.1,
      max_chars: 40,
      overflow_behavior: "truncate",
    },
  ];
}

function buildStatsColumn(
  index: number,
  valueKey: string,
  labelKey: string,
): Slot[] {
  const colW = 174 / 4;
  const x = 18 + index * colW;
  return [
    {
      type: "text",
      name: `stats_${index}_value`,
      content_key: valueKey,
      x_mm: x, y_mm: STATS_Y + 4, w_mm: colW, h_mm: 9,
      style: "h2",
      color_role: "headingText",
      size_pt: 26,
      line_height: 1.0,
      font_weight: 700,
      alignment: "center",
      max_chars: 6,
    },
    {
      type: "text",
      name: `stats_${index}_label`,
      content_key: labelKey,
      x_mm: x, y_mm: STATS_Y + 14, w_mm: colW, h_mm: 4,
      style: "eyebrow",
      color_role: "mutedText",
      alignment: "center",
      size_pt: 9,
      letter_spacing_em: 0.14,
      uppercase: true,
      max_chars: 12,
    },
  ];
}

export const TRIP_SUMMARY_EDITORIAL: LayoutManifest = {
  id: "trip-summary-editorial",
  section: "trip_summary",
  page_count: 1,
  description:
    "Editorial 'Itinerary at a glance' — full-page magazine spread with map dominance",
  slots: [
    // Section bg — fills the page so the map column doesn't expose
    // the page background where it might mismatch the section.
    {
      type: "fill",
      name: "section_bg",
      x_mm: 0, y_mm: 0, w_mm: PAGE_W, h_mm: SECTION_H,
      fill: "sectionSurface",
      z_index: 0,
    },

    // ─── LEFT COLUMN — itinerary strip ────────────────────────────────
    {
      type: "text",
      name: "section_label",
      x_mm: TEXT_INSET_X, y_mm: 14, w_mm: TEXT_INSET_W, h_mm: 5,
      style: "eyebrow",
      color_role: "mutedText",
      size_pt: 9,
      letter_spacing_em: 0.18,
      uppercase: true,
      max_chars: 30,
    },
    {
      type: "text",
      name: "section_title",
      content_key: "sectionTitle",
      x_mm: TEXT_INSET_X, y_mm: 24, w_mm: TEXT_INSET_W, h_mm: 18,
      style: "h2",
      color_role: "headingText",
      size_pt: 28,
      line_height: 1.05,
      font_weight: 700,
      max_chars: 60,
      overflow_behavior: "scale_down",
    },
    {
      type: "text",
      name: "section_subtitle",
      content_key: "sectionSubtitle",
      x_mm: TEXT_INSET_X, y_mm: 48, w_mm: TEXT_INSET_W, h_mm: 5,
      style: "eyebrow",
      color_role: "mutedText",
      size_pt: 10,
      letter_spacing_em: 0.14,
      uppercase: true,
      max_chars: 60,
      overflow_behavior: "truncate",
    },
    ...buildDayBlock(0),
    ...buildDayBlock(1),
    ...buildDayBlock(2),
    ...buildDayBlock(3),
    ...buildDayBlock(4),
    ...buildDayBlock(5),

    // ─── RIGHT COLUMN — full-height map ───────────────────────────────
    {
      type: "vector",
      name: "map_image",
      payload_key: "routeMap",
      x_mm: RIGHT_COL_X, y_mm: 0, w_mm: RIGHT_COL_W, h_mm: TOP_CONTENT_H,
    },
    {
      type: "fill",
      name: "column_divider",
      x_mm: RIGHT_COL_X - 0.15, y_mm: 14, w_mm: 0.3, h_mm: TOP_CONTENT_H - 28,
      fill: "border",
      opacity: 0.4,
    },

    // ─── STATS BAR ────────────────────────────────────────────────────
    {
      type: "fill",
      name: "stats_top_border",
      x_mm: 18, y_mm: STATS_Y, w_mm: 174, h_mm: 0.3,
      fill: "border",
    },
    ...buildStatsColumn(0, "statsNightsValue", "statsNightsLabel"),
    ...buildStatsColumn(1, "statsStopsValue", "statsStopsLabel"),
    ...buildStatsColumn(2, "statsLodgesValue", "statsLodgesLabel"),
    ...buildStatsColumn(3, "statsParksValue", "statsParksLabel"),
    {
      type: "fill",
      name: "stats_sep_1",
      x_mm: 18 + 43.5, y_mm: STATS_Y + 3, w_mm: 0.3, h_mm: STATS_H - 6,
      fill: "border",
      opacity: 0.5,
    },
    {
      type: "fill",
      name: "stats_sep_2",
      x_mm: 18 + 87, y_mm: STATS_Y + 3, w_mm: 0.3, h_mm: STATS_H - 6,
      fill: "border",
      opacity: 0.5,
    },
    {
      type: "fill",
      name: "stats_sep_3",
      x_mm: 18 + 130.5, y_mm: STATS_Y + 3, w_mm: 0.3, h_mm: STATS_H - 6,
      fill: "border",
      opacity: 0.5,
    },
    {
      type: "fill",
      name: "stats_bottom_border",
      x_mm: 18, y_mm: STATS_Y + STATS_H - 0.3, w_mm: 174, h_mm: 0.3,
      fill: "border",
    },

    // ─── SUMMARY LINE ─────────────────────────────────────────────────
    {
      type: "text",
      name: "summary_line",
      content_key: "summary",
      x_mm: 18, y_mm: SUMMARY_Y, w_mm: 174, h_mm: SUMMARY_H,
      style: "caption",
      color_role: "mutedText",
      size_pt: 9,
      line_height: 1.2,
      alignment: "center",
      max_chars: 200,
      overflow_behavior: "truncate",
    },
  ],
  rules: [
    "Section fills the full A4 page (297mm)",
    "Top content y:0–270, stats y:270–290, summary y:290–297",
    "Left column 84mm; right column 126mm — no overlap, no gap",
    "Map fills 270mm tall edge-to-edge",
    "Day blocks max 6 (truncate beyond), evenly spaced 32mm + 3mm",
    "No empty space below summary",
  ],
};

export const TRIP_SUMMARY_LAYOUTS = [TRIP_SUMMARY_EDITORIAL];

export const TRIP_SUMMARY_GEOMETRY = {
  SECTION_H,
  TOP_CONTENT_H,
  STATS_H,
  SUMMARY_H,
  LEFT_COL_W,
  RIGHT_COL_W,
  RIGHT_COL_X,
  DAY_BLOCKS_MAX,
};
