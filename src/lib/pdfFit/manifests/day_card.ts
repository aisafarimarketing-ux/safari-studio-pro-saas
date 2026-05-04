import type { LayoutManifest } from "../types";

// ─── Day card layout manifest ──────────────────────────────────────────────
//
// Single layout from the operator's spec. Two halves stacked vertically:
//
//   ┌──────────────────────────────────────────┐
//   │  [accent strip — Day badge | Destination]│  y:20–40
//   ├──────────────────────────────────────────┤
//   │  Intro pull-quote (h3, full width)       │  y:50–70
//   ├────────────────────────┬─────────────────┤
//   │                        │                 │
//   │  Narrative body        │  Destination    │  y:75–175
//   │  (left column)         │  hero image     │
//   │                        │                 │
//   ├────────────────────────┼─────────────────┤
//   │  Accommodation         │  Lodge stats    │  y:185–255
//   │  hero image            │  block          │
//   ├──────────────────────────────────────────┤
//   │  ───── divider ──────                     │  y:260
//   └──────────────────────────────────────────┘
//
// Variants (image_lead / narrative / balanced) live in variants.ts —
// they tweak typography emphasis + image filters on top of these
// fixed coordinates.

export const DAY_CARD_STANDARD: LayoutManifest = {
  id: "day-card-standard",
  section: "day_card",
  page_count: 1,
  description:
    "Two-row editorial day spread: destination image + narrative on top, accommodation image + stats below",
  slots: [
    {
      type: "fill",
      name: "day_header_bg",
      x_mm: 0, y_mm: 20, w_mm: 210, h_mm: 20,
      fill: "accent",
    },
    {
      type: "text",
      name: "day_label",
      content_key: "dayLabel",
      x_mm: 18, y_mm: 24, w_mm: 60, h_mm: 12,
      style: "eyebrow",
      color_role: "white",
      alignment: "left",
      max_chars: 40,
    },
    {
      type: "text",
      name: "location_title",
      content_key: "destination",
      x_mm: 80, y_mm: 24, w_mm: 110, h_mm: 12,
      style: "eyebrow",
      color_role: "white",
      alignment: "right",
      max_chars: 80,
    },
    {
      type: "text",
      name: "intro_text",
      content_key: "introText",
      x_mm: 18, y_mm: 50, w_mm: 174, h_mm: 20,
      style: "h3",
      color_role: "headingText",
      max_chars: 180,
      overflow_behavior: "truncate",
    },
    {
      type: "text",
      name: "body_text",
      content_key: "narrative",
      x_mm: 18, y_mm: 75, w_mm: 80, h_mm: 100,
      style: "body",
      color_role: "bodyText",
      max_chars: 900,
      overflow_behavior: "truncate",
    },
    {
      type: "image",
      name: "main_image",
      content_key: "destinationImageUrl",
      x_mm: 105, y_mm: 75, w_mm: 87, h_mm: 100,
      min_resolution_px: [1500, 1500],
      object_fit: "cover",
      image_role: "hero",
    },
    {
      type: "image",
      name: "lodge_image",
      content_key: "lodgeImageUrl",
      x_mm: 18, y_mm: 185, w_mm: 90, h_mm: 70,
      object_fit: "cover",
      image_role: "thumb",
    },
    {
      type: "text",
      name: "lodge_text_block",
      content_key: "lodgeText",
      x_mm: 115, y_mm: 185, w_mm: 77, h_mm: 70,
      style: "body",
      color_role: "bodyText",
      max_chars: 400,
      overflow_behavior: "truncate",
    },
    {
      type: "line",
      name: "divider",
      x_mm: 18, y_mm: 260, w_mm: 174, h_mm: 1,
      color_role: "border",
    },
  ],
  rules: [
    "Each day MUST fit within one page",
    "No text may exceed its slot height",
    "Images are fixed aspect ratio (no stretching)",
    "If content exceeds limits → truncate with warning",
    "No dynamic stacking of sections",
    "Divider must always remain within page bounds",
  ],
};

export const DAY_CARD_LAYOUTS = [DAY_CARD_STANDARD];
