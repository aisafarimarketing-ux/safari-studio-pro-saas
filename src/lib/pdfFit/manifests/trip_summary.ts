import type { LayoutManifest, Slot } from "../types";

// ─── Trip summary / "Itinerary at a glance" ───────────────────────────────
//
// Locked editorial layout per the operator's reference measurement
// diagram. Print-first; no responsiveness; mm units only.
//
// Section total height: 149mm
//   Top content (itinerary + map): y:0 → 122  (122mm)
//   Stats bar:                     y:122 → 142 (20mm)
//   Summary line:                  y:142 → 149 (7mm)
//
// Top-content split (122mm height):
//   Left column (itinerary)  x:0   w:84  (40%)
//   Right column (map)       x:84  w:126 (60%)

const PAGE_W = 210;
const SECTION_H = 149;
const TOP_CONTENT_H = 122;
const STATS_H = 20;
const SUMMARY_H = 7;

const LEFT_COL_W = 84;
const RIGHT_COL_W = PAGE_W - LEFT_COL_W; // 126
const RIGHT_COL_X = LEFT_COL_W;          // 84

const TEXT_INSET_X = 18;
const TEXT_INSET_W = LEFT_COL_W - TEXT_INSET_X; // 66

const DAY_BLOCK_H = 22;
const DAY_BLOCK_GAP = 3;
const DAY_BLOCK_FIRST_Y = 50;

const STATS_Y = TOP_CONTENT_H;        // 122
const SUMMARY_Y = STATS_Y + STATS_H;  // 142

function buildDayBlock(index: number): Slot[] {
  const y = DAY_BLOCK_FIRST_Y + index * (DAY_BLOCK_H + DAY_BLOCK_GAP);
  const dayNumX = TEXT_INSET_X - 12;
  const imageX = TEXT_INSET_X;
  const imageW = TEXT_INSET_W;
  const imageH = 14;
  const textBelowY = y + imageH + 1;

  return [
    {
      type: "text",
      name: `day_${index + 1}_number`,
      content_key: `day${index + 1}Number`,
      x_mm: dayNumX, y_mm: y + 2, w_mm: 12, h_mm: 14,
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
  const colW = 174 / 4; // 43.5mm
  const x = 18 + index * colW;
  return [
    {
      type: "text",
      name: `stats_${index}_value`,
      content_key: valueKey,
      x_mm: x, y_mm: STATS_Y + 4, w_mm: colW, h_mm: 9,
      style: "h2",
      color_role: "headingText",
      size_pt: 22,
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
      size_pt: 8,
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
    "Editorial 'Itinerary at a glance' — left strip + map + stats + summary",
  slots: [
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
      x_mm: TEXT_INSET_X, y_mm: 22, w_mm: TEXT_INSET_W, h_mm: 14,
      style: "h2",
      color_role: "headingText",
      size_pt: 26,
      line_height: 1.05,
      font_weight: 700,
      max_chars: 60,
      overflow_behavior: "scale_down",
    },
    {
      type: "text",
      name: "section_subtitle",
      content_key: "sectionSubtitle",
      x_mm: TEXT_INSET_X, y_mm: 40, w_mm: TEXT_INSET_W, h_mm: 5,
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
      x_mm: 18 + 43.5 * 1, y_mm: STATS_Y + 3, w_mm: 0.3, h_mm: STATS_H - 6,
      fill: "border",
      opacity: 0.5,
    },
    {
      type: "fill",
      name: "stats_sep_2",
      x_mm: 18 + 43.5 * 2, y_mm: STATS_Y + 3, w_mm: 0.3, h_mm: STATS_H - 6,
      fill: "border",
      opacity: 0.5,
    },
    {
      type: "fill",
      name: "stats_sep_3",
      x_mm: 18 + 43.5 * 3, y_mm: STATS_Y + 3, w_mm: 0.3, h_mm: STATS_H - 6,
      fill: "border",
      opacity: 0.5,
    },
    {
      type: "fill",
      name: "stats_bottom_border",
      x_mm: 18, y_mm: STATS_Y + STATS_H - 0.3, w_mm: 174, h_mm: 0.3,
      fill: "border",
    },
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
    "Section locked at 149mm total (top 122 + stats 20 + summary 7)",
    "Left column 84mm; right column 126mm — no overlap",
    "Day blocks max 3 (truncate to fit; never overflow)",
    "Stats bar 4 equal columns with vertical separators",
    "Summary centered italic 9pt across full 174mm band",
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
  DAY_BLOCKS_MAX: 3,
};
