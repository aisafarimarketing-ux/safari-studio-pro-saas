import type { LayoutManifest, GroupSlot, FillSlot } from "../types";

// ─── Practical info layout manifest ────────────────────────────────────────
//
// 6 stacked horizontal cards, each 174mm wide × 30mm tall, spaced 4mm
// apart. Inside each card: small icon (left), title row, body line.
// Card sub-slots are positioned RELATIVE to the card group (PdfFitSlot
// honours this: a group's children render absolute against the
// group's box, not the page).

const SECTION_TITLE_HEIGHT = 16;
const SUBTITLE_HEIGHT = 10;
const CARDS_PER_PAGE = 6;
const CARD_HEIGHT_MM = 30;
const CARD_GAP_MM = 4;
const FIRST_CARD_Y_MM = 50;

function cardYMm(index: number): number {
  return FIRST_CARD_Y_MM + index * (CARD_HEIGHT_MM + CARD_GAP_MM);
}

// Card backdrop fill — the cream / dark panel behind each card.
function buildCardBackdrop(index: number): FillSlot {
  return {
    type: "fill",
    name: `card_${index + 1}_bg`,
    x_mm: 18, y_mm: cardYMm(index), w_mm: 174, h_mm: CARD_HEIGHT_MM,
    fill: "sectionBg",
  };
}

// One card → group slot with 3 sub-slots (icon / title / body).
function buildCardSlot(index: number): GroupSlot {
  const y = cardYMm(index);
  // Sub-slot coords relative to the card group's top-left.
  return {
    type: "group",
    name: `card_${index + 1}`,
    x_mm: 18, y_mm: y, w_mm: 174, h_mm: CARD_HEIGHT_MM,
    slots: [
      {
        type: "text",
        name: `card_${index + 1}_icon`,
        content_key: `card${index + 1}Icon`,
        x_mm: 4, y_mm: 4, w_mm: 8, h_mm: 8,
        style: "h3",
        color_role: "headingText",
        max_chars: 4,
      },
      {
        type: "text",
        name: `card_${index + 1}_title`,
        content_key: `card${index + 1}Title`,
        x_mm: 14, y_mm: 4, w_mm: 120, h_mm: 8,
        style: "h3",
        color_role: "headingText",
        max_chars: 40,
        overflow_behavior: "truncate",
      },
      {
        type: "text",
        name: `card_${index + 1}_body`,
        content_key: `card${index + 1}Body`,
        x_mm: 14, y_mm: 12, w_mm: 156, h_mm: 14,
        style: "caption",
        color_role: "bodyText",
        max_chars: 220,
        overflow_behavior: "truncate",
      },
    ],
  };
}

export const PRACTICAL_INFO_CARDS: LayoutManifest = {
  id: "practical-info-cards",
  section: "practical_info",
  page_count: 1,
  description: "Section title + subtitle, then a 6-card stack of icon + title + body",
  slots: [
    {
      type: "text",
      name: "section_title",
      content_key: "sectionTitle",
      x_mm: 18, y_mm: 20, w_mm: 174, h_mm: SECTION_TITLE_HEIGHT,
      style: "h2",
      color_role: "headingText",
      max_chars: 60,
    },
    {
      type: "text",
      name: "section_subtitle",
      content_key: "sectionSubtitle",
      x_mm: 18, y_mm: 34, w_mm: 174, h_mm: SUBTITLE_HEIGHT,
      style: "eyebrow",
      color_role: "mutedText",
      max_chars: 80,
    },
    ...Array.from({ length: CARDS_PER_PAGE }, (_, i) => buildCardBackdrop(i)),
    ...Array.from({ length: CARDS_PER_PAGE }, (_, i) => buildCardSlot(i)),
  ],
  rules: [
    "Each card has fixed height (30mm)",
    "Max 6 cards per page",
    "No card expands beyond its slot",
    "Body text truncates if too long",
    "Icons must be fixed size (no scaling)",
    "Spacing between cards fixed (4mm)",
    "No dynamic stacking or wrapping",
  ],
};

// ─── Variant B — Featured first card + supporting cards ──────────────────
//
// First card is a hero panel (full-width, double-height) with bigger
// title + body. Cards 2–6 stack below as compact horizontal bands.
// Use when one piece of practical info needs prominence (visa
// requirements changing, weather alert, malaria zone).

const FEATURED_CARD_HEIGHT = 60;
const SUPPORTING_CARD_HEIGHT = 26;
const SUPPORTING_GAP = 3;
const SUPPORTING_FIRST_Y = 50 + FEATURED_CARD_HEIGHT + 6;

function buildSupportingCardSlot(index: number): GroupSlot {
  // Supporting card index is 0..4 (rendered for cards 2..6 in data).
  const dataIndex = index + 1; // card_n in the manifest is 1-indexed
  const y = SUPPORTING_FIRST_Y + index * (SUPPORTING_CARD_HEIGHT + SUPPORTING_GAP);
  return {
    type: "group",
    name: `card_${dataIndex + 1}`,
    x_mm: 18, y_mm: y, w_mm: 174, h_mm: SUPPORTING_CARD_HEIGHT,
    slots: [
      {
        type: "text",
        name: `card_${dataIndex + 1}_icon`,
        content_key: `card${dataIndex + 1}Icon`,
        x_mm: 4, y_mm: 4, w_mm: 8, h_mm: 8,
        style: "h3",
        color_role: "headingText",
        max_chars: 4,
      },
      {
        type: "text",
        name: `card_${dataIndex + 1}_title`,
        content_key: `card${dataIndex + 1}Title`,
        x_mm: 14, y_mm: 4, w_mm: 120, h_mm: 7,
        style: "h3",
        color_role: "headingText",
        max_chars: 40,
        overflow_behavior: "truncate",
      },
      {
        type: "text",
        name: `card_${dataIndex + 1}_body`,
        content_key: `card${dataIndex + 1}Body`,
        x_mm: 14, y_mm: 12, w_mm: 156, h_mm: 12,
        style: "caption",
        color_role: "bodyText",
        max_chars: 180,
        overflow_behavior: "truncate",
      },
    ],
  };
}

function buildSupportingBackdrop(index: number): FillSlot {
  const dataIndex = index + 1;
  const y = SUPPORTING_FIRST_Y + index * (SUPPORTING_CARD_HEIGHT + SUPPORTING_GAP);
  return {
    type: "fill",
    name: `card_${dataIndex + 1}_bg`,
    x_mm: 18, y_mm: y, w_mm: 174, h_mm: SUPPORTING_CARD_HEIGHT,
    fill: "sectionBg",
  };
}

export const PRACTICAL_INFO_FEATURED: LayoutManifest = {
  id: "practical-info-featured",
  section: "practical_info",
  page_count: 1,
  description:
    "Featured first card (hero panel) with supporting cards stacked below",
  slots: [
    {
      type: "text",
      name: "section_title",
      content_key: "sectionTitle",
      x_mm: 18, y_mm: 20, w_mm: 174, h_mm: 16,
      style: "h2",
      color_role: "headingText",
      max_chars: 60,
    },
    {
      type: "text",
      name: "section_subtitle",
      content_key: "sectionSubtitle",
      x_mm: 18, y_mm: 34, w_mm: 174, h_mm: 10,
      style: "eyebrow",
      color_role: "mutedText",
      max_chars: 80,
    },
    // Featured (first) card — full hero panel.
    {
      type: "fill",
      name: "card_1_bg",
      x_mm: 18, y_mm: 50, w_mm: 174, h_mm: FEATURED_CARD_HEIGHT,
      fill: "sectionBg",
    },
    {
      type: "group",
      name: "card_1",
      x_mm: 18, y_mm: 50, w_mm: 174, h_mm: FEATURED_CARD_HEIGHT,
      slots: [
        {
          type: "text",
          name: "card_1_icon",
          content_key: "card1Icon",
          x_mm: 6, y_mm: 6, w_mm: 12, h_mm: 12,
          style: "h2",
          color_role: "headingText",
          max_chars: 4,
        },
        {
          type: "text",
          name: "card_1_title",
          content_key: "card1Title",
          x_mm: 22, y_mm: 8, w_mm: 146, h_mm: 12,
          style: "h2",
          color_role: "headingText",
          max_chars: 50,
          overflow_behavior: "truncate",
        },
        {
          type: "text",
          name: "card_1_body",
          content_key: "card1Body",
          x_mm: 22, y_mm: 24, w_mm: 146, h_mm: 30,
          style: "body",
          color_role: "bodyText",
          max_chars: 360,
          overflow_behavior: "truncate",
        },
      ],
    },
    // Supporting cards 2..6 — compact horizontal bands.
    ...Array.from({ length: 5 }, (_, i) => buildSupportingBackdrop(i)),
    ...Array.from({ length: 5 }, (_, i) => buildSupportingCardSlot(i)),
  ],
  rules: [
    "First card is the visual hero — full panel 50–110mm",
    "Supporting cards 5 × 26mm bands",
    "Always 6 cards total (1 featured + 5 supporting)",
  ],
};

export const PRACTICAL_INFO_LAYOUTS = [
  PRACTICAL_INFO_CARDS,    // clean grid (default)
  PRACTICAL_INFO_FEATURED, // featured first + supporting
];
export const PRACTICAL_INFO_CARDS_PER_PAGE = CARDS_PER_PAGE;
