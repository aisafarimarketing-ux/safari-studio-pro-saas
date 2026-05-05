import type { LayoutManifest, Slot } from "../types";

// ─── Trip summary / "Itinerary at a glance" — three variants ─────────────
//
// Section locked at 149mm total for all variants:
//   Top content (itinerary + map):   y:0   → 122  (122mm)
//   Stats bar:                       y:122 → 142  (20mm)
//   Summary line:                    y:142 → 149  (7mm)
//
// Variants:
//   trip-summary-canvas  (default) — Map full width as canvas;
//                                    floating itinerary panel left.
//   trip-summary-split             — 84/126 left strip + map column.
//   trip-summary-hero              — Hero map top, horizontal day
//                                    strip below.

const PAGE_W = 210;
const SECTION_H = 149;
const STATS_H = 20;
const SUMMARY_H = 7;
const TOP_CONTENT_H = SECTION_H - STATS_H - SUMMARY_H; // 122

const STATS_Y = TOP_CONTENT_H;        // 122
const SUMMARY_Y = STATS_Y + STATS_H;  // 142

const CONTENT_X = 18;
const CONTENT_W = 174;
const TEXT_INSET_W = 66; // splits + canvas: text inside left strip

// ─── Shared sub-builders ─────────────────────────────────────────────────

function buildStatsColumn(
  index: number,
  valueKey: string,
  labelKey: string,
): Slot[] {
  const colW = CONTENT_W / 4;
  const x = CONTENT_X + index * colW;
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

function statsBar(): Slot[] {
  const colW = CONTENT_W / 4;
  return [
    {
      type: "fill",
      name: "stats_top_border",
      x_mm: CONTENT_X, y_mm: STATS_Y, w_mm: CONTENT_W, h_mm: 0.3,
      fill: "border",
    },
    ...buildStatsColumn(0, "statsNightsValue", "statsNightsLabel"),
    ...buildStatsColumn(1, "statsStopsValue", "statsStopsLabel"),
    ...buildStatsColumn(2, "statsLodgesValue", "statsLodgesLabel"),
    ...buildStatsColumn(3, "statsParksValue", "statsParksLabel"),
    {
      type: "fill",
      name: "stats_sep_1",
      x_mm: CONTENT_X + colW, y_mm: STATS_Y + 3, w_mm: 0.3, h_mm: STATS_H - 6,
      fill: "border",
      opacity: 0.5,
    },
    {
      type: "fill",
      name: "stats_sep_2",
      x_mm: CONTENT_X + colW * 2, y_mm: STATS_Y + 3, w_mm: 0.3, h_mm: STATS_H - 6,
      fill: "border",
      opacity: 0.5,
    },
    {
      type: "fill",
      name: "stats_sep_3",
      x_mm: CONTENT_X + colW * 3, y_mm: STATS_Y + 3, w_mm: 0.3, h_mm: STATS_H - 6,
      fill: "border",
      opacity: 0.5,
    },
    {
      type: "fill",
      name: "stats_bottom_border",
      x_mm: CONTENT_X, y_mm: STATS_Y + STATS_H - 0.3, w_mm: CONTENT_W, h_mm: 0.3,
      fill: "border",
    },
  ];
}

function summaryLine(): Slot {
  return {
    type: "text",
    name: "summary_line",
    content_key: "summary",
    x_mm: CONTENT_X, y_mm: SUMMARY_Y, w_mm: CONTENT_W, h_mm: SUMMARY_H,
    style: "caption",
    color_role: "mutedText",
    size_pt: 9,
    line_height: 1.2,
    alignment: "center",
    max_chars: 200,
    overflow_behavior: "truncate",
  };
}

// Vertical day block — used by Canvas + Split variants.
function buildVerticalDayBlock(
  index: number,
  origin: { x: number; y: number },
  panelW: number,
  blockH: number,
): Slot[] {
  const baseY = origin.y + index * blockH;
  const dayNumX = origin.x;
  const imageX = origin.x + 12;
  const imageW = panelW - 12;
  const imageH = Math.max(12, blockH - 10);
  const textBelowY = baseY + imageH + 1;

  return [
    {
      type: "text",
      name: `day_${index + 1}_number`,
      content_key: `day${index + 1}Number`,
      x_mm: dayNumX, y_mm: baseY + 2, w_mm: 12, h_mm: 12,
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
      x_mm: imageX, y_mm: baseY, w_mm: imageW, h_mm: imageH,
      object_fit: "cover",
    },
    {
      type: "text",
      name: `day_${index + 1}_location`,
      content_key: `day${index + 1}Location`,
      x_mm: imageX, y_mm: textBelowY, w_mm: imageW, h_mm: 4,
      style: "body",
      color_role: "headingText",
      size_pt: 11,
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
      size_pt: 8.5,
      line_height: 1.1,
      max_chars: 40,
      overflow_behavior: "truncate",
    },
  ];
}

// Horizontal day card — used by Hero variant's bottom strip.
function buildHorizontalDayCard(
  index: number,
  cardX: number,
  cardY: number,
  cardW: number,
  cardH: number,
): Slot[] {
  const padding = 2;
  const imageW = Math.min(cardW - padding * 2, 50);
  const imageH = cardH - 14;
  return [
    {
      type: "image",
      name: `day_${index + 1}_image`,
      content_key: `day${index + 1}ImageUrl`,
      x_mm: cardX + padding, y_mm: cardY, w_mm: imageW, h_mm: imageH,
      object_fit: "cover",
    },
    {
      type: "text",
      name: `day_${index + 1}_number`,
      content_key: `day${index + 1}Number`,
      x_mm: cardX + padding + imageW + 3, y_mm: cardY + 2, w_mm: 12, h_mm: 5,
      style: "eyebrow",
      color_role: "mutedText",
      size_pt: 8,
      letter_spacing_em: 0.14,
      uppercase: true,
      max_chars: 6,
    },
    {
      type: "text",
      name: `day_${index + 1}_location`,
      content_key: `day${index + 1}Location`,
      x_mm: cardX + padding + imageW + 3,
      y_mm: cardY + 6, w_mm: cardW - imageW - padding * 2 - 3, h_mm: 5,
      style: "body",
      color_role: "headingText",
      size_pt: 10,
      line_height: 1.1,
      font_weight: 700,
      max_chars: 18,
      overflow_behavior: "truncate",
    },
    {
      type: "text",
      name: `day_${index + 1}_property`,
      content_key: `day${index + 1}Property`,
      x_mm: cardX + padding + imageW + 3,
      y_mm: cardY + 11, w_mm: cardW - imageW - padding * 2 - 3, h_mm: 4,
      style: "caption",
      color_role: "bodyText",
      size_pt: 8,
      line_height: 1.1,
      max_chars: 30,
      overflow_behavior: "truncate",
    },
  ];
}

// ─── Header — ITINERARY AT A GLANCE / Title / Subtitle ───────────────────

function headerSlots(
  origin: { x: number; y: number },
  width: number,
  titlePt = 24,
): Slot[] {
  return [
    {
      type: "text",
      name: "section_label",
      x_mm: origin.x, y_mm: origin.y, w_mm: width, h_mm: 5,
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
      x_mm: origin.x, y_mm: origin.y + 8, w_mm: width, h_mm: 14,
      style: "h2",
      color_role: "headingText",
      size_pt: titlePt,
      line_height: 1.05,
      font_weight: 700,
      max_chars: 60,
      overflow_behavior: "scale_down",
    },
    {
      type: "text",
      name: "section_subtitle",
      content_key: "sectionSubtitle",
      x_mm: origin.x, y_mm: origin.y + 25, w_mm: width, h_mm: 5,
      style: "eyebrow",
      color_role: "mutedText",
      size_pt: 10,
      letter_spacing_em: 0.14,
      uppercase: true,
      max_chars: 60,
      overflow_behavior: "truncate",
    },
  ];
}

// ─── VARIANT 1 — EDITORIAL CANVAS (default) ──────────────────────────────
//
// Map fills the full content width as a canvas; floating panel on
// the left holds the itinerary list. Map is desaturated and slightly
// transparent so the panel reads cleanly above it.

const CANVAS_PANEL_X = CONTENT_X;
const CANVAS_PANEL_Y = 8;
const CANVAS_PANEL_W = 78;

function buildCanvasVariant(): LayoutManifest {
  // Day blocks inside the panel — 3 max, 22mm each + 2mm gap.
  const headerOriginY = CANVAS_PANEL_Y + 4;
  const dayOriginY = headerOriginY + 36;
  const dayBlockH = 22 + 2;

  return {
    id: "trip-summary-canvas",
    section: "trip_summary",
    page_count: 1,
    description: "Editorial Canvas — map full-width with floating itinerary panel",
    slots: [
      // Section bg.
      {
        type: "fill",
        name: "section_bg",
        x_mm: 0, y_mm: 0, w_mm: PAGE_W, h_mm: SECTION_H,
        fill: "sectionSurface",
        z_index: 0,
      },
      // Map canvas — full content width, slightly transparent.
      {
        type: "vector",
        name: "map_image",
        payload_key: "routeMap",
        x_mm: CONTENT_X, y_mm: 0, w_mm: CONTENT_W, h_mm: TOP_CONTENT_H,
        opacity: 0.82,
        z_index: 1,
      },
      // Subtle desaturating wash over the map.
      {
        type: "fill",
        name: "map_wash",
        x_mm: CONTENT_X, y_mm: 0, w_mm: CONTENT_W, h_mm: TOP_CONTENT_H,
        fill: "linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 60%)",
        z_index: 2,
      },
      // Floating panel — very subtle backdrop so text reads against
      // varied map content; transparent enough to feel editorial.
      {
        type: "fill",
        name: "canvas_panel_bg",
        x_mm: CANVAS_PANEL_X, y_mm: CANVAS_PANEL_Y,
        w_mm: CANVAS_PANEL_W, h_mm: TOP_CONTENT_H - 16,
        fill: "sectionSurface",
        opacity: 0.85,
        z_index: 3,
      },
      // Header inside panel.
      ...headerSlots(
        { x: CANVAS_PANEL_X + 6, y: headerOriginY },
        CANVAS_PANEL_W - 12,
        18,
      ).map((s) => ({ ...s, z_index: 4 })),
      // Day blocks.
      ...buildVerticalDayBlock(
        0,
        { x: CANVAS_PANEL_X + 6, y: dayOriginY },
        CANVAS_PANEL_W - 12,
        dayBlockH,
      ).map((s) => ({ ...s, z_index: 4 })),
      ...buildVerticalDayBlock(
        1,
        { x: CANVAS_PANEL_X + 6, y: dayOriginY },
        CANVAS_PANEL_W - 12,
        dayBlockH,
      ).map((s, i) => (i === 0 ? s : s)).map((s) => ({ ...s, z_index: 4 })),
      ...buildVerticalDayBlock(
        2,
        { x: CANVAS_PANEL_X + 6, y: dayOriginY },
        CANVAS_PANEL_W - 12,
        dayBlockH,
      ).map((s) => ({ ...s, z_index: 4 })),
      // Stats + summary.
      ...statsBar(),
      summaryLine(),
    ],
    rules: [
      "Section locked at 149mm",
      "Map fills full content width as a canvas",
      "Floating panel left at x:18 w:78 with subtle backdrop",
      "Map washed at 0.82 opacity for a desaturated editorial feel",
    ],
  };
}

// ─── VARIANT 2 — SOFT SPLIT EDITORIAL ────────────────────────────────────
//
// Classic 84/126 split. Left column itinerary, right column map.

const SPLIT_LEFT_W = 84;
const SPLIT_RIGHT_X = SPLIT_LEFT_W;
const SPLIT_RIGHT_W = PAGE_W - SPLIT_LEFT_W; // 126

function buildSplitVariant(): LayoutManifest {
  const headerOriginY = 14;
  const dayOriginY = 50;
  const dayBlockH = 22 + 2;

  return {
    id: "trip-summary-split",
    section: "trip_summary",
    page_count: 1,
    description: "Soft Split Editorial — 84mm itinerary strip + 126mm map column",
    slots: [
      {
        type: "fill",
        name: "section_bg",
        x_mm: 0, y_mm: 0, w_mm: PAGE_W, h_mm: SECTION_H,
        fill: "sectionSurface",
        z_index: 0,
      },
      // Map fills right column edge to edge.
      {
        type: "vector",
        name: "map_image",
        payload_key: "routeMap",
        x_mm: SPLIT_RIGHT_X, y_mm: 0, w_mm: SPLIT_RIGHT_W, h_mm: TOP_CONTENT_H,
        opacity: 0.92,
      },
      // Hairline divider on the seam.
      {
        type: "fill",
        name: "column_divider",
        x_mm: SPLIT_RIGHT_X - 0.15, y_mm: 14,
        w_mm: 0.3, h_mm: TOP_CONTENT_H - 28,
        fill: "border",
        opacity: 0.4,
      },
      // Header inside left column (text inset 18mm from page edge).
      ...headerSlots({ x: CONTENT_X, y: headerOriginY }, TEXT_INSET_W, 24),
      // 3 day blocks in left column.
      ...buildVerticalDayBlock(
        0, { x: CONTENT_X, y: dayOriginY }, TEXT_INSET_W, dayBlockH,
      ),
      ...buildVerticalDayBlock(
        1, { x: CONTENT_X, y: dayOriginY }, TEXT_INSET_W, dayBlockH,
      ),
      ...buildVerticalDayBlock(
        2, { x: CONTENT_X, y: dayOriginY }, TEXT_INSET_W, dayBlockH,
      ),
      ...statsBar(),
      summaryLine(),
    ],
    rules: [
      "Section locked at 149mm",
      "Left strip 84mm; right map column 126mm",
      "Map fills right column edge to edge",
    ],
  };
}

// ─── VARIANT 3 — HERO MAP + STORY STRIP ──────────────────────────────────
//
// Top: map dominates as a hero (174mm × 90mm).
// Bottom: horizontal day strip 32mm — 3 cards inline.

function buildHeroVariant(): LayoutManifest {
  const HERO_MAP_H = 90;
  const STRIP_Y = HERO_MAP_H;
  const STRIP_H = TOP_CONTENT_H - HERO_MAP_H; // 32
  const cardCount = 3;
  const cardGap = 4;
  const cardW = (CONTENT_W - cardGap * (cardCount - 1)) / cardCount; // ~55.3
  return {
    id: "trip-summary-hero",
    section: "trip_summary",
    page_count: 1,
    description: "Hero Map + Story Strip — full-width map on top, horizontal day cards below",
    slots: [
      {
        type: "fill",
        name: "section_bg",
        x_mm: 0, y_mm: 0, w_mm: PAGE_W, h_mm: SECTION_H,
        fill: "sectionSurface",
        z_index: 0,
      },
      // Hero map — full content width.
      {
        type: "vector",
        name: "map_image",
        payload_key: "routeMap",
        x_mm: CONTENT_X, y_mm: 0, w_mm: CONTENT_W, h_mm: HERO_MAP_H,
      },
      // Tiny eyebrow over the map (top-left, low opacity backdrop).
      {
        type: "fill",
        name: "hero_eyebrow_bg",
        x_mm: CONTENT_X, y_mm: 6, w_mm: 60, h_mm: 12,
        fill: "sectionSurface",
        opacity: 0.85,
        z_index: 2,
      },
      {
        type: "text",
        name: "section_label",
        x_mm: CONTENT_X + 4, y_mm: 9, w_mm: 56, h_mm: 4,
        style: "eyebrow",
        color_role: "mutedText",
        size_pt: 8,
        letter_spacing_em: 0.18,
        uppercase: true,
        max_chars: 30,
        z_index: 3,
      },
      {
        type: "text",
        name: "section_title",
        content_key: "sectionTitle",
        x_mm: CONTENT_X + 4, y_mm: 13, w_mm: 56, h_mm: 5,
        style: "h3",
        color_role: "headingText",
        size_pt: 11,
        line_height: 1.1,
        font_weight: 700,
        max_chars: 30,
        overflow_behavior: "truncate",
        z_index: 3,
      },
      // Horizontal strip — 3 day cards.
      ...buildHorizontalDayCard(
        0, CONTENT_X + (cardW + cardGap) * 0, STRIP_Y + 2, cardW, STRIP_H - 4,
      ),
      ...buildHorizontalDayCard(
        1, CONTENT_X + (cardW + cardGap) * 1, STRIP_Y + 2, cardW, STRIP_H - 4,
      ),
      ...buildHorizontalDayCard(
        2, CONTENT_X + (cardW + cardGap) * 2, STRIP_Y + 2, cardW, STRIP_H - 4,
      ),
      // Top border line above the strip.
      {
        type: "fill",
        name: "strip_top_border",
        x_mm: CONTENT_X, y_mm: STRIP_Y, w_mm: CONTENT_W, h_mm: 0.3,
        fill: "border",
      },
      ...statsBar(),
      summaryLine(),
    ],
    rules: [
      "Section locked at 149mm",
      "Hero map y:0–90 (90mm tall, full content width)",
      "Story strip y:90–122 (32mm) with 3 horizontal day cards",
    ],
  };
}

export const TRIP_SUMMARY_CANVAS = buildCanvasVariant();
export const TRIP_SUMMARY_SPLIT = buildSplitVariant();
export const TRIP_SUMMARY_HERO = buildHeroVariant();

// Default alias — Canvas per spec.
export const TRIP_SUMMARY_EDITORIAL = TRIP_SUMMARY_CANVAS;

export const TRIP_SUMMARY_LAYOUTS = [
  TRIP_SUMMARY_CANVAS,
  TRIP_SUMMARY_SPLIT,
  TRIP_SUMMARY_HERO,
];

export const TRIP_SUMMARY_GEOMETRY = {
  SECTION_H,
  TOP_CONTENT_H,
  STATS_H,
  SUMMARY_H,
  DAY_BLOCKS_MAX: 3,
};
