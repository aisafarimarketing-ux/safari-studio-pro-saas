import type { LayoutManifest } from "../types";

// ─── Property card layout manifest ─────────────────────────────────────────
//
// Single layout from the operator's spec. One-page property profile:
//
//   ┌──────────────────────────┬──────────────┐
//   │  Section title           │              │  y:20
//   │  Property name (h1)      │              │
//   │  Location (eyebrow)      │   Main hero  │  y:40–150
//   │  Description             │   image      │
//   ├──────────────────────────┤              │
//   │                          │              │
//   │  Stay details            ├──────┬───────┤  y:155
//   │                          │ Th 1 │ Th 2  │
//   │                          ├──────┴───────┤  y:200
//   │  Features list           │   Thumb 3    │
//   │                          │              │
//   ├──────────────────────────────────────────┤
//   │  ───── divider ──────                     │  y:260
//   └──────────────────────────────────────────┘
//
// Variants (image_luxury / info_rich / balanced) tweak emphasis only;
// positions stay locked.

export const PROPERTY_CARD_STANDARD: LayoutManifest = {
  id: "property-card-standard",
  section: "property_card",
  page_count: 1,
  description:
    "Editorial property profile: name + meta + body on the left; hero + 3 thumbs on the right",
  slots: [
    // Top — full-width hero photograph for maximum visual lift.
    {
      type: "image",
      name: "main_image",
      content_key: "mainImageUrl",
      x_mm: 0, y_mm: 0, w_mm: 210, h_mm: 118,
      object_fit: "cover",
      image_role: "hero",
      z_index: 0,
    },
    // Header band — section eyebrow + property name + location.
    {
      type: "text",
      name: "section_title",
      content_key: "sectionTitle",
      x_mm: 18, y_mm: 126, w_mm: 174, h_mm: 6,
      style: "eyebrow",
      color_role: "mutedText",
      max_chars: 60,
    },
    {
      type: "text",
      name: "property_name",
      content_key: "propertyName",
      x_mm: 18, y_mm: 134, w_mm: 174, h_mm: 18,
      style: "h1",
      color_role: "headingText",
      max_chars: 60,
      overflow_behavior: "scale_down",
    },
    {
      type: "text",
      name: "location_meta",
      content_key: "locationMeta",
      x_mm: 18, y_mm: 154, w_mm: 174, h_mm: 6,
      style: "eyebrow",
      color_role: "accent",
      max_chars: 60,
    },
    // Body — two even columns (description + stay details / features).
    {
      type: "text",
      name: "description",
      content_key: "description",
      x_mm: 18, y_mm: 168, w_mm: 84, h_mm: 60,
      style: "body",
      color_role: "bodyText",
      max_chars: 420,
      overflow_behavior: "truncate",
    },
    {
      type: "text",
      name: "stay_details",
      content_key: "stayDetails",
      x_mm: 108, y_mm: 168, w_mm: 84, h_mm: 30,
      style: "caption",
      color_role: "bodyText",
      max_chars: 220,
    },
    {
      type: "text",
      name: "features_list",
      content_key: "featuresList",
      x_mm: 108, y_mm: 200, w_mm: 84, h_mm: 30,
      style: "caption",
      color_role: "mutedText",
      max_chars: 220,
    },
    // Three thumbnails — even strip across the bottom.
    {
      type: "image",
      name: "thumb_1",
      content_key: "thumbUrl1",
      x_mm: 18, y_mm: 240, w_mm: 56, h_mm: 42,
      object_fit: "cover",
      image_role: "thumb",
    },
    {
      type: "image",
      name: "thumb_2",
      content_key: "thumbUrl2",
      x_mm: 77, y_mm: 240, w_mm: 56, h_mm: 42,
      object_fit: "cover",
      image_role: "thumb",
    },
    {
      type: "image",
      name: "thumb_3",
      content_key: "thumbUrl3",
      x_mm: 136, y_mm: 240, w_mm: 56, h_mm: 42,
      object_fit: "cover",
      image_role: "thumb",
    },
    {
      type: "line",
      name: "divider",
      x_mm: 18, y_mm: 288, w_mm: 174, h_mm: 1,
      color_role: "border",
    },
  ],
  rules: [
    "Only one main image (no carousel)",
    "Thumbnails are static (max 3)",
    "No '+ more' overlays",
    "All images fixed size (no dynamic resizing)",
    "Text must truncate within slot",
    "Left column must not exceed y_mm 235",
    "No interaction elements",
  ],
};

export const PROPERTY_CARD_LAYOUTS = [PROPERTY_CARD_STANDARD];
