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
    "Magazine spread day page: full-width hero, accent strip, two-column body, accommodation card",
  slots: [
    // Top half — large editorial hero photograph (full bleed).
    {
      type: "image",
      name: "main_image",
      content_key: "destinationImageUrl",
      x_mm: 0, y_mm: 0, w_mm: 210, h_mm: 118,
      object_fit: "cover",
      image_role: "hero",
      z_index: 0,
    },
    // Dark accent strip carrying the day label + destination.
    {
      type: "fill",
      name: "day_header_bg",
      x_mm: 0, y_mm: 118, w_mm: 210, h_mm: 14,
      fill: "accent",
      z_index: 1,
    },
    {
      type: "text",
      name: "day_label",
      content_key: "dayLabel",
      x_mm: 18, y_mm: 122, w_mm: 80, h_mm: 8,
      style: "eyebrow",
      color_role: "white",
      alignment: "left",
      max_chars: 40,
      z_index: 2,
    },
    {
      type: "text",
      name: "location_title",
      content_key: "destination",
      x_mm: 100, y_mm: 122, w_mm: 92, h_mm: 8,
      style: "eyebrow",
      color_role: "white",
      alignment: "right",
      max_chars: 80,
      z_index: 2,
    },
    // Editorial pull-quote sits between the strip and the body.
    {
      type: "text",
      name: "intro_text",
      content_key: "introText",
      x_mm: 18, y_mm: 142, w_mm: 174, h_mm: 14,
      style: "h3",
      color_role: "headingText",
      max_chars: 140,
      overflow_behavior: "truncate",
    },
    // Body narrative — full width, two-column visually via column-count
    // is overkill for one page, so we use one cleaner column with
    // generous leading and a sane char cap.
    {
      type: "text",
      name: "body_text",
      content_key: "narrative",
      x_mm: 18, y_mm: 162, w_mm: 174, h_mm: 56,
      style: "body",
      color_role: "bodyText",
      max_chars: 900,
      overflow_behavior: "truncate",
    },
    // Accommodation card — image left, text right. Sits on a faint
    // sectionBg surface so it reads as a discrete card rather than
    // floating type.
    {
      type: "fill",
      name: "lodge_card_bg",
      x_mm: 18, y_mm: 226, w_mm: 174, h_mm: 56,
      fill: "sectionBg",
    },
    {
      type: "image",
      name: "lodge_image",
      content_key: "lodgeImageUrl",
      x_mm: 22, y_mm: 230, w_mm: 70, h_mm: 48,
      object_fit: "cover",
      image_role: "thumb",
    },
    {
      type: "text",
      name: "lodge_eyebrow",
      content_key: "lodgeEyebrow",
      x_mm: 100, y_mm: 230, w_mm: 88, h_mm: 6,
      style: "eyebrow",
      color_role: "mutedText",
      max_chars: 30,
    },
    {
      type: "text",
      name: "lodge_text_block",
      content_key: "lodgeText",
      x_mm: 100, y_mm: 238, w_mm: 88, h_mm: 40,
      style: "body",
      color_role: "bodyText",
      max_chars: 360,
      overflow_behavior: "truncate",
    },
    {
      type: "line",
      name: "divider",
      x_mm: 18, y_mm: 288, w_mm: 174, h_mm: 1,
      color_role: "border",
    },
  ],
  rules: [
    "Each day MUST fit within one page",
    "Hero locked to top 0–118mm; accent strip 118–132mm",
    "Body narrative truncates at 900 chars before y:218",
    "Accommodation card locked to 226–282mm",
    "No text may exceed its slot height",
  ],
};


export const DAY_CARD_LAYOUTS = [DAY_CARD_STANDARD];
