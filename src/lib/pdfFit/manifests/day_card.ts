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

// ─── Variant B — narrative led ────────────────────────────────────────────
//
// Text-first day spread for emotional, story-heavy days. The image
// is secondary (right column, smaller); the body lives across most of
// the page width with generous leading. Use when the day's narrative
// is rich and the photograph is supportive rather than the main event.
//
//   y:18  eyebrow + day chip + destination
//   y:34  pull-quote (h2)
//   y:55–215  body narrative (left column, wider)
//             secondary image right column with caption
//   y:226–282  accommodation card (same shape as standard)
//   y:288  divider

export const DAY_CARD_NARRATIVE: LayoutManifest = {
  id: "day-card-narrative",
  section: "day_card",
  page_count: 1,
  description:
    "Narrative-led day spread: large pull-quote, generous body, secondary photograph",
  slots: [
    {
      type: "text",
      name: "day_label",
      content_key: "dayLabel",
      x_mm: 18, y_mm: 20, w_mm: 80, h_mm: 6,
      style: "eyebrow",
      color_role: "mutedText",
      max_chars: 40,
    },
    {
      type: "text",
      name: "location_title",
      content_key: "destination",
      x_mm: 100, y_mm: 20, w_mm: 92, h_mm: 6,
      style: "eyebrow",
      color_role: "accent",
      alignment: "right",
      max_chars: 60,
    },
    {
      type: "text",
      name: "intro_text",
      content_key: "introText",
      x_mm: 18, y_mm: 32, w_mm: 174, h_mm: 38,
      style: "h2",
      color_role: "headingText",
      max_chars: 220,
      overflow_behavior: "scale_down",
    },
    {
      type: "text",
      name: "body_text",
      content_key: "narrative",
      x_mm: 18, y_mm: 78, w_mm: 100, h_mm: 130,
      style: "body",
      color_role: "bodyText",
      max_chars: 1200,
      overflow_behavior: "truncate",
    },
    {
      type: "image",
      name: "main_image",
      content_key: "destinationImageUrl",
      x_mm: 124, y_mm: 78, w_mm: 68, h_mm: 100,
      object_fit: "cover",
      image_role: "hero",
    },
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
      x_mm: 22, y_mm: 230, w_mm: 60, h_mm: 48,
      object_fit: "cover",
      image_role: "thumb",
    },
    {
      type: "text",
      name: "lodge_eyebrow",
      content_key: "lodgeEyebrow",
      x_mm: 90, y_mm: 230, w_mm: 98, h_mm: 6,
      style: "eyebrow",
      color_role: "mutedText",
      max_chars: 30,
    },
    {
      type: "text",
      name: "lodge_text_block",
      content_key: "lodgeText",
      x_mm: 90, y_mm: 238, w_mm: 98, h_mm: 40,
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
    "Body narrative is the visual centre; image stays secondary",
    "Pull-quote 32–70mm; body 78–208mm; lodge card 226–282mm",
    "Minimum 600 chars of narrative recommended for this variant",
  ],
};

// ─── Variant C — image led (full-bleed cinematic) ────────────────────────
//
// Photograph-led day — the destination image fills two-thirds of the
// page; text is compact and lives below in a single dense column.
// Use when the photograph itself carries the day's mood (calving
// fields, migration river crossings, predator portraits).
//
//   y:0–195  full-bleed hero
//   y:200    eyebrow + day chip
//   y:208    pull-quote (h3)
//   y:225–262  compact body
//   y:272–292  inline accommodation strip (no card backdrop)

export const DAY_CARD_IMAGE_LED: LayoutManifest = {
  id: "day-card-image-led",
  section: "day_card",
  page_count: 1,
  description:
    "Image-led day spread: photograph dominates, compact text below, inline accommodation strip",
  slots: [
    {
      type: "image",
      name: "main_image",
      content_key: "destinationImageUrl",
      x_mm: 0, y_mm: 0, w_mm: 210, h_mm: 195,
      object_fit: "cover",
      image_role: "hero",
      z_index: 0,
    },
    {
      type: "fill",
      name: "image_fade",
      x_mm: 0, y_mm: 165, w_mm: 210, h_mm: 30,
      fill: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.18) 100%)",
      z_index: 1,
    },
    {
      type: "text",
      name: "day_label",
      content_key: "dayLabel",
      x_mm: 18, y_mm: 200, w_mm: 80, h_mm: 6,
      style: "eyebrow",
      color_role: "mutedText",
      max_chars: 40,
    },
    {
      type: "text",
      name: "location_title",
      content_key: "destination",
      x_mm: 100, y_mm: 200, w_mm: 92, h_mm: 6,
      style: "eyebrow",
      color_role: "accent",
      alignment: "right",
      max_chars: 60,
    },
    {
      type: "text",
      name: "intro_text",
      content_key: "introText",
      x_mm: 18, y_mm: 210, w_mm: 174, h_mm: 14,
      style: "h3",
      color_role: "headingText",
      max_chars: 140,
      overflow_behavior: "truncate",
    },
    {
      type: "text",
      name: "body_text",
      content_key: "narrative",
      x_mm: 18, y_mm: 226, w_mm: 174, h_mm: 38,
      style: "body",
      color_role: "bodyText",
      max_chars: 540,
      overflow_behavior: "truncate",
    },
    {
      type: "image",
      name: "lodge_image",
      content_key: "lodgeImageUrl",
      x_mm: 18, y_mm: 270, w_mm: 38, h_mm: 22,
      object_fit: "cover",
      image_role: "thumb",
    },
    {
      type: "text",
      name: "lodge_eyebrow",
      content_key: "lodgeEyebrow",
      x_mm: 62, y_mm: 270, w_mm: 130, h_mm: 5,
      style: "eyebrow",
      color_role: "mutedText",
      max_chars: 30,
    },
    {
      type: "text",
      name: "lodge_text_block",
      content_key: "lodgeText",
      x_mm: 62, y_mm: 276, w_mm: 130, h_mm: 16,
      style: "caption",
      color_role: "bodyText",
      max_chars: 200,
      overflow_behavior: "truncate",
    },
  ],
  rules: [
    "Hero photograph dominates 0–195mm",
    "Body capped at 540 chars to keep a clean compact block",
    "Accommodation runs as an inline strip, no card panel",
  ],
};

export const DAY_CARD_LAYOUTS = [
  DAY_CARD_STANDARD,
  DAY_CARD_NARRATIVE,
  DAY_CARD_IMAGE_LED,
];
