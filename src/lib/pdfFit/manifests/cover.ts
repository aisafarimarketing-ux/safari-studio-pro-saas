import type { LayoutManifest, Slot } from "../types";

// ─── Cover layout system ──────────────────────────────────────────────────
//
// Per spec — the cover supports ONLY 7 structural layouts:
//
//   FULL_BLEED  image fills page; text overlays
//   S64L/S64R   text 64% / image 36% (L = image right, R = image left)
//   S55L/S55R   text 55% / image 45%
//   S46L/S46R   text 46% / image 54%
//
// Every layout renders the same backend fields:
//   logo · title · destinations (single line) · metadata row (for / dates / duration / party)
//
// Treatments (FRAMED_LUXURY, TINTED_OVERLAY, FLOATING_CARD, GRADIENT_SPLIT)
// are visual variants applied on top of the structural layout — they
// never change slot positions.

const A4_W = 210;
const A4_H = 297;
const SAFE_X = 18; // horizontal text margin inside a panel
const SAFE_Y = 22; // vertical safe margin from page edges

// Build the slots inside the text panel for a given panel geometry.
// All split layouts share the same internal structure: logo top, title
// dominant, destinations single line, metadata row at the bottom.
function textPanelSlots(panel: {
  x: number; w: number;
}): Slot[] {
  const innerX = panel.x + SAFE_X;
  const innerW = Math.max(40, panel.w - SAFE_X * 2);

  // Metadata row — four columns, equal width, gutter ~6mm.
  const metaY = A4_H - 60;
  const metaH = 28;
  const colCount = 4;
  const colGap = 6;
  const colW = (innerW - colGap * (colCount - 1)) / colCount;
  const metaCols = Array.from({ length: colCount }, (_, i) => ({
    x: innerX + i * (colW + colGap),
    w: colW,
  }));

  return [
    {
      type: "image",
      name: "operator_logo",
      content_key: "operatorLogoUrl",
      x_mm: innerX, y_mm: SAFE_Y, w_mm: 38, h_mm: 14,
      object_fit: "contain",
    },
    {
      type: "text",
      name: "trip_title",
      content_key: "tripTitle",
      x_mm: innerX, y_mm: 90, w_mm: innerW, h_mm: 50,
      style: "h1",
      color_role: "headingText",
      max_chars: 80,
      overflow_behavior: "scale_down",
    },
    {
      type: "text",
      name: "trip_destinations",
      content_key: "tripDestinations",
      x_mm: innerX, y_mm: 148, w_mm: innerW, h_mm: 8,
      style: "eyebrow",
      color_role: "accent",
      max_chars: 120,
      overflow_behavior: "scale_down",
    },
    // Metadata row labels (eyebrow) sit above the values (body).
    // The consumer fills meta_<i>_label with literal label text
    // ("For" / "Dates" / "Duration" / "Party") and meta_<i>_value
    // with the resolved backend value.
    ...metaCols.flatMap((col, i): Slot[] => {
      const valueKeys = [
        "metaForValue",
        "metaDatesValue",
        "metaDurationValue",
        "metaPartyValue",
      ];
      return [
        {
          type: "text",
          name: `meta_${i}_label`,
          content_key: `metaLabel${i}`,
          x_mm: col.x, y_mm: metaY, w_mm: col.w, h_mm: 6,
          style: "eyebrow",
          color_role: "mutedText",
          max_chars: 12,
        },
        {
          type: "text",
          name: `meta_${i}_value`,
          content_key: valueKeys[i],
          x_mm: col.x, y_mm: metaY + 8, w_mm: col.w, h_mm: metaH - 8,
          style: "body",
          color_role: "headingText",
          max_chars: 60,
          overflow_behavior: "scale_down",
        },
        // Hidden helper — keeps labels addressable from typed payloads.
        // Filled with the literal label text by the consumer so the
        // operator can override per-language if needed.
        {
          type: "text",
          name: `meta_${i}_label_hidden`,
          content_key: `metaLabel${i}Hidden`,
          x_mm: -1000, y_mm: -1000, w_mm: 1, h_mm: 1,
          style: "caption",
        },
      ];
    }).filter((slot) => !slot.name.endsWith("_label_hidden")),
  ];
}

// Build a split layout (S64L, S64R, S55L, S55R, S46L, S46R).
function buildSplitLayout(
  id: string,
  textPercent: number,
  imageOnRight: boolean,
): LayoutManifest {
  const textW = (A4_W * textPercent) / 100;
  const imageW = A4_W - textW;
  const textPanelX = imageOnRight ? 0 : imageW;
  const imagePanelX = imageOnRight ? textW : 0;

  return {
    id,
    section: "cover",
    page_count: 1,
    description: `Split cover ${textPercent}% text / ${100 - textPercent}% image (${imageOnRight ? "right" : "left"})`,
    slots: [
      // Text panel background (sectionSurface) — locks the text side
      // to a clean paper surface even if the operator picks a dark
      // pageBg globally.
      {
        type: "fill",
        name: "text_panel_bg",
        x_mm: textPanelX, y_mm: 0, w_mm: textW, h_mm: A4_H,
        fill: "sectionSurface",
        z_index: 0,
      },
      // Image panel.
      {
        type: "image",
        name: "hero_image",
        content_key: "heroImageUrl",
        x_mm: imagePanelX, y_mm: 0, w_mm: imageW, h_mm: A4_H,
        object_fit: "cover",
        image_role: "hero",
        z_index: 0,
      },
      // Text panel slots (relative to the page; we already accounted
      // for the panel offset by passing it in).
      ...textPanelSlots({ x: textPanelX, w: textW }),
    ],
    rules: [
      `Text panel locked to ${textPercent}% width`,
      `Image panel locked to ${100 - textPercent}% width`,
      "Destinations must remain single line (scale_down on overflow)",
      "Metadata row pinned to bottom safe band",
    ],
  };
}

// Build the full-bleed layout — image fills the page; text floats
// over a gradient overlay. The text panel coordinates run across the
// full page width; FLOATING_CARD treatment can paint a sectionSurface
// card behind the text at render time.
function buildFullBleed(): LayoutManifest {
  return {
    id: "cover-full-bleed",
    section: "cover",
    page_count: 1,
    description: "Full-bleed cinematic cover; text floats over gradient",
    slots: [
      {
        type: "image",
        name: "hero_image",
        content_key: "heroImageUrl",
        x_mm: 0, y_mm: 0, w_mm: A4_W, h_mm: A4_H,
        object_fit: "cover",
        image_role: "hero",
        z_index: 0,
      },
      // Bottom-half gradient ensures legibility when text sits on
      // varied imagery. FLOATING_CARD treatment swaps this for a
      // solid card backdrop via variant fillOverride.
      {
        type: "fill",
        name: "gradient_overlay",
        x_mm: 0, y_mm: 150, w_mm: A4_W, h_mm: 147,
        fill: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.62) 100%)",
        z_index: 1,
      },
      {
        type: "image",
        name: "operator_logo",
        content_key: "operatorLogoUrl",
        x_mm: SAFE_X, y_mm: SAFE_Y, w_mm: 38, h_mm: 14,
        object_fit: "contain",
        z_index: 2,
      },
      {
        type: "text",
        name: "trip_title",
        content_key: "tripTitle",
        x_mm: SAFE_X, y_mm: 175, w_mm: A4_W - SAFE_X * 2, h_mm: 50,
        style: "h1",
        color_role: "white",
        max_chars: 80,
        overflow_behavior: "scale_down",
        z_index: 2,
      },
      {
        type: "text",
        name: "trip_destinations",
        content_key: "tripDestinations",
        x_mm: SAFE_X, y_mm: 232, w_mm: A4_W - SAFE_X * 2, h_mm: 8,
        style: "eyebrow",
        color_role: "white",
        max_chars: 120,
        overflow_behavior: "scale_down",
        z_index: 2,
      },
      // Metadata row (4 columns) at bottom.
      ...(() => {
        const innerW = A4_W - SAFE_X * 2;
        const metaY = A4_H - 50;
        const colCount = 4;
        const colGap = 6;
        const colW = (innerW - colGap * (colCount - 1)) / colCount;
        return Array.from({ length: colCount }, (_, i): Slot[] => {
          const valueKeys = [
            "metaForValue",
            "metaDatesValue",
            "metaDurationValue",
            "metaPartyValue",
          ];
          return [
            {
              type: "text",
              name: `meta_${i}_label`,
              content_key: `metaLabel${i}`,
              x_mm: SAFE_X + i * (colW + colGap),
              y_mm: metaY, w_mm: colW, h_mm: 6,
              style: "eyebrow",
              color_role: "white",
              max_chars: 12,
              z_index: 2,
            },
            {
              type: "text",
              name: `meta_${i}_value`,
              content_key: valueKeys[i],
              x_mm: SAFE_X + i * (colW + colGap),
              y_mm: metaY + 8, w_mm: colW, h_mm: 16,
              style: "body",
              color_role: "white",
              max_chars: 60,
              overflow_behavior: "scale_down",
              z_index: 2,
            },
          ];
        }).flat();
      })(),
    ],
    rules: [
      "Image fills page; text overlays a gradient",
      "Destinations must remain single line (scale_down on overflow)",
      "Logo top-left safe area; title + meta in bottom band",
    ],
  };
}

export const COVER_FULL_BLEED = buildFullBleed();
export const COVER_S64L = buildSplitLayout("cover-s64l", 64, true);
export const COVER_S64R = buildSplitLayout("cover-s64r", 64, false);
export const COVER_S55L = buildSplitLayout("cover-s55l", 55, true);
export const COVER_S55R = buildSplitLayout("cover-s55r", 55, false);
export const COVER_S46L = buildSplitLayout("cover-s46l", 46, true);
export const COVER_S46R = buildSplitLayout("cover-s46r", 46, false);

export const COVER_LAYOUTS = [
  COVER_FULL_BLEED,
  COVER_S64L,
  COVER_S64R,
  COVER_S55L,
  COVER_S55R,
  COVER_S46L,
  COVER_S46R,
];
