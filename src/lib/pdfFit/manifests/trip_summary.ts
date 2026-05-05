import type { LayoutManifest, Slot } from "../types";

// ─── Trip summary / "Itinerary at a glance" — 3 variants ────────────────
//
// Section fills the full A4 page (297mm). Locked vertical zones:
//   TOP BLOCK   y:0   → 244  (82%)  — itinerary + map
//   STATS BAR   y:244 → 280  (12%)  — 4 columns
//   SUMMARY     y:280 → 297  (6%)   — centered line
//
// No unused vertical space. Map height === left-column height === 244mm.

const PAGE_W = 210;
const PAGE_H = 297;

const TOP_H = Math.round(PAGE_H * 0.82);   // 244
const STATS_H = Math.round(PAGE_H * 0.12); // 36
const SUMMARY_H = PAGE_H - TOP_H - STATS_H; // 17

const STATS_Y = TOP_H;
const SUMMARY_Y = STATS_Y + STATS_H;

const CONTENT_X = 18;
const CONTENT_W = 174;

// 40 / 60 horizontal split inside the top block.
const LEFT_COL_W = Math.round(PAGE_W * 0.4);  // 84
const RIGHT_COL_W = PAGE_W - LEFT_COL_W;       // 126
const RIGHT_COL_X = LEFT_COL_W;

// Inside left column the text content insets from page edge.
const TEXT_INSET_W = LEFT_COL_W - CONTENT_X;   // 66

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
      x_mm: x, y_mm: STATS_Y + 8, w_mm: colW, h_mm: 14,
      style: "h2",
      color_role: "headingText",
      size_pt: 30,
      line_height: 1.0,
      font_weight: 700,
      alignment: "center",
      max_chars: 6,
    },
    {
      type: "text",
      name: `stats_${index}_label`,
      content_key: labelKey,
      x_mm: x, y_mm: STATS_Y + 24, w_mm: colW, h_mm: 5,
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
      x_mm: CONTENT_X + colW, y_mm: STATS_Y + 5, w_mm: 0.3, h_mm: STATS_H - 10,
      fill: "border",
      opacity: 0.5,
    },
    {
      type: "fill",
      name: "stats_sep_2",
      x_mm: CONTENT_X + colW * 2, y_mm: STATS_Y + 5, w_mm: 0.3, h_mm: STATS_H - 10,
      fill: "border",
      opacity: 0.5,
    },
    {
      type: "fill",
      name: "stats_sep_3",
      x_mm: CONTENT_X + colW * 3, y_mm: STATS_Y + 5, w_mm: 0.3, h_mm: STATS_H - 10,
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
    x_mm: CONTENT_X, y_mm: SUMMARY_Y + 4, w_mm: CONTENT_W, h_mm: SUMMARY_H - 4,
    style: "caption",
    color_role: "mutedText",
    size_pt: 9,
    line_height: 1.2,
    alignment: "center",
    max_chars: 200,
    overflow_behavior: "truncate",
  };
}

// Header (label + title + subtitle) — used by Canvas + Split.
function headerSlots(
  origin: { x: number; y: number },
  width: number,
  titlePt = 28,
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
      x_mm: origin.x, y_mm: origin.y + 8, w_mm: width, h_mm: 18,
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
      x_mm: origin.x, y_mm: origin.y + 28, w_mm: width, h_mm: 5,
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

// Vertical day block — used by Canvas + Split.
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
  const imageH = Math.max(14, blockH - 14);
  const textBelowY = baseY + imageH + 1;

  return [
    {
      type: "text",
      name: `day_${index + 1}_number`,
      content_key: `day${index + 1}Number`,
      x_mm: dayNumX, y_mm: baseY + 4, w_mm: 12, h_mm: 12,
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
      x_mm: imageX, y_mm: textBelowY, w_mm: imageW, h_mm: 5,
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
      x_mm: imageX, y_mm: textBelowY + 5, w_mm: imageW, h_mm: 4,
      style: "body",
      color_role: "bodyText",
      size_pt: 9,
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
  const imageH = Math.max(20, cardH - 4);
  const imageW = Math.min(cardW * 0.45, 60);
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
      x_mm: cardX + padding + imageW + 3, y_mm: cardY + 2, w_mm: 16, h_mm: 5,
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
      x_mm: cardX + padding + imageW + 3, y_mm: cardY + 8,
      w_mm: cardW - imageW - padding * 2 - 3, h_mm: 7,
      style: "body",
      color_role: "headingText",
      size_pt: 12,
      line_height: 1.1,
      font_weight: 700,
      max_chars: 18,
      overflow_behavior: "truncate",
    },
    {
      type: "text",
      name: `day_${index + 1}_property`,
      content_key: `day${index + 1}Property`,
      x_mm: cardX + padding + imageW + 3, y_mm: cardY + 16,
      w_mm: cardW - imageW - padding * 2 - 3, h_mm: 5,
      style: "caption",
      color_role: "bodyText",
      size_pt: 9,
      line_height: 1.1,
      max_chars: 32,
      overflow_behavior: "truncate",
    },
  ];
}

// ─── VARIANT 1 — EDITORIAL CANVAS (default) ──────────────────────────────

function buildCanvasVariant(): LayoutManifest {
  // Floating panel inside the top block.
  const panelX = CONTENT_X;
  const panelY = 14;
  const panelW = 80;
  const panelH = TOP_H - 28;
  const headerOriginY = panelY + 8;
  const dayOriginY = headerOriginY + 40;
  const dayCount = 5;
  const daysAvailableH = panelH - (dayOriginY - panelY) - 8;
  const dayBlockH = Math.floor(daysAvailableH / dayCount);

  const dayBlocks = Array.from({ length: dayCount }, (_, i) =>
    buildVerticalDayBlock(
      i,
      { x: panelX + 6, y: dayOriginY },
      panelW - 12,
      dayBlockH,
    ).map((s) => ({ ...s, z_index: 4 })),
  ).flat();

  return {
    id: "trip-summary-canvas",
    section: "trip_summary",
    page_count: 1,
    description: "Editorial Canvas — map full-width with floating itinerary panel",
    slots: [
      {
        type: "fill",
        name: "section_bg",
        x_mm: 0, y_mm: 0, w_mm: PAGE_W, h_mm: PAGE_H,
        fill: "sectionSurface",
        z_index: 0,
      },
      // Map canvas — fills the entire 244mm top block.
      {
        type: "vector",
        name: "map_image",
        payload_key: "routeMap",
        x_mm: CONTENT_X, y_mm: 0, w_mm: CONTENT_W, h_mm: TOP_H,
        opacity: 0.82,
        z_index: 1,
      },
      // Subtle wash for legibility.
      {
        type: "fill",
        name: "map_wash",
        x_mm: CONTENT_X, y_mm: 0, w_mm: CONTENT_W, h_mm: TOP_H,
        fill: "linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 60%)",
        z_index: 2,
      },
      // Floating panel.
      {
        type: "fill",
        name: "canvas_panel_bg",
        x_mm: panelX, y_mm: panelY, w_mm: panelW, h_mm: panelH,
        fill: "sectionSurface",
        opacity: 0.85,
        z_index: 3,
      },
      ...headerSlots(
        { x: panelX + 6, y: headerOriginY },
        panelW - 12,
        20,
      ).map((s) => ({ ...s, z_index: 4 })),
      ...dayBlocks,
      ...statsBar(),
      summaryLine(),
    ],
    rules: [
      "Section fills full A4 (297mm)",
      "Top block 244mm (82%); stats 36mm (12%); summary 17mm (6%)",
      "Map fills entire 174×244mm top block edge-to-edge",
      "Floating panel evenly distributes 5 day blocks vertically",
    ],
  };
}

// ─── VARIANT 2 — SOFT SPLIT EDITORIAL ────────────────────────────────────

function buildSplitVariant(): LayoutManifest {
  const headerOriginY = 14;
  const dayOriginY = headerOriginY + 44;
  const dayCount = 6;
  const daysAvailableH = TOP_H - dayOriginY - 4;
  const dayBlockH = Math.floor(daysAvailableH / dayCount);

  const dayBlocks = Array.from({ length: dayCount }, (_, i) =>
    buildVerticalDayBlock(
      i,
      { x: CONTENT_X, y: dayOriginY },
      TEXT_INSET_W,
      dayBlockH,
    ),
  ).flat();

  return {
    id: "trip-summary-split",
    section: "trip_summary",
    page_count: 1,
    description: "Soft Split Editorial — 84mm itinerary strip + 126mm map column",
    slots: [
      {
        type: "fill",
        name: "section_bg",
        x_mm: 0, y_mm: 0, w_mm: PAGE_W, h_mm: PAGE_H,
        fill: "sectionSurface",
        z_index: 0,
      },
      // Map fills right column completely (126×244).
      {
        type: "vector",
        name: "map_image",
        payload_key: "routeMap",
        x_mm: RIGHT_COL_X, y_mm: 0, w_mm: RIGHT_COL_W, h_mm: TOP_H,
        opacity: 0.92,
      },
      {
        type: "fill",
        name: "column_divider",
        x_mm: RIGHT_COL_X - 0.15, y_mm: 14,
        w_mm: 0.3, h_mm: TOP_H - 28,
        fill: "border",
        opacity: 0.4,
      },
      ...headerSlots({ x: CONTENT_X, y: headerOriginY }, TEXT_INSET_W, 26),
      ...dayBlocks,
      ...statsBar(),
      summaryLine(),
    ],
    rules: [
      "Section fills full A4 (297mm)",
      "Left strip 84mm; right map column 126mm",
      "Map fills right column edge-to-edge at 244mm height",
      "6 day blocks evenly distributed across left column",
    ],
  };
}

// ─── VARIANT 3 — HERO MAP + STORY STRIP ──────────────────────────────────

function buildHeroVariant(): LayoutManifest {
  // Hero occupies most of the top block; strip fills the rest.
  const HERO_MAP_H = Math.floor(TOP_H * 0.72); // ~176
  const STRIP_Y = HERO_MAP_H;
  const STRIP_H = TOP_H - HERO_MAP_H; // ~68
  const cardCount = 3;
  const cardGap = 4;
  const cardW = (CONTENT_W - cardGap * (cardCount - 1)) / cardCount;
  return {
    id: "trip-summary-hero",
    section: "trip_summary",
    page_count: 1,
    description:
      "Hero Map + Story Strip — full-width map on top, horizontal day cards below",
    slots: [
      {
        type: "fill",
        name: "section_bg",
        x_mm: 0, y_mm: 0, w_mm: PAGE_W, h_mm: PAGE_H,
        fill: "sectionSurface",
        z_index: 0,
      },
      {
        type: "vector",
        name: "map_image",
        payload_key: "routeMap",
        x_mm: CONTENT_X, y_mm: 0, w_mm: CONTENT_W, h_mm: HERO_MAP_H,
      },
      {
        type: "fill",
        name: "hero_eyebrow_bg",
        x_mm: CONTENT_X, y_mm: 8, w_mm: 70, h_mm: 14,
        fill: "sectionSurface",
        opacity: 0.85,
        z_index: 2,
      },
      {
        type: "text",
        name: "section_label",
        x_mm: CONTENT_X + 4, y_mm: 11, w_mm: 64, h_mm: 4,
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
        x_mm: CONTENT_X + 4, y_mm: 15, w_mm: 64, h_mm: 6,
        style: "h3",
        color_role: "headingText",
        size_pt: 12,
        line_height: 1.1,
        font_weight: 700,
        max_chars: 30,
        overflow_behavior: "truncate",
        z_index: 3,
      },
      {
        type: "fill",
        name: "strip_top_border",
        x_mm: CONTENT_X, y_mm: STRIP_Y, w_mm: CONTENT_W, h_mm: 0.3,
        fill: "border",
      },
      ...buildHorizontalDayCard(
        0, CONTENT_X + (cardW + cardGap) * 0,
        STRIP_Y + 4, cardW, STRIP_H - 8,
      ),
      ...buildHorizontalDayCard(
        1, CONTENT_X + (cardW + cardGap) * 1,
        STRIP_Y + 4, cardW, STRIP_H - 8,
      ),
      ...buildHorizontalDayCard(
        2, CONTENT_X + (cardW + cardGap) * 2,
        STRIP_Y + 4, cardW, STRIP_H - 8,
      ),
      ...statsBar(),
      summaryLine(),
    ],
    rules: [
      "Section fills full A4 (297mm)",
      `Hero map y:0–${HERO_MAP_H} (full content width)`,
      `Story strip y:${STRIP_Y}–${TOP_H} with 3 horizontal day cards`,
    ],
  };
}

export const TRIP_SUMMARY_CANVAS = buildCanvasVariant();
export const TRIP_SUMMARY_SPLIT = buildSplitVariant();
export const TRIP_SUMMARY_HERO = buildHeroVariant();

export const TRIP_SUMMARY_EDITORIAL = TRIP_SUMMARY_CANVAS;

export const TRIP_SUMMARY_LAYOUTS = [
  TRIP_SUMMARY_CANVAS,
  TRIP_SUMMARY_SPLIT,
  TRIP_SUMMARY_HERO,
];

export const TRIP_SUMMARY_GEOMETRY = {
  PAGE_H,
  TOP_H,
  STATS_H,
  SUMMARY_H,
  LEFT_COL_W,
  RIGHT_COL_W,
  RIGHT_COL_X,
  // Canvas variant uses 5; Split uses 6; Hero uses 3.
  DAY_BLOCKS_MAX: 6,
};
