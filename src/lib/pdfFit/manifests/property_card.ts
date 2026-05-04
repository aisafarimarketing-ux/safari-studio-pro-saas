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
    {
      type: "text",
      name: "section_title",
      content_key: "sectionTitle",
      x_mm: 18, y_mm: 20, w_mm: 120, h_mm: 16,
      style: "h2",
      color_role: "mutedText",
      max_chars: 60,
    },
    {
      type: "text",
      name: "property_name",
      content_key: "propertyName",
      x_mm: 18, y_mm: 40, w_mm: 80, h_mm: 30,
      style: "h1",
      color_role: "headingText",
      max_chars: 60,
      overflow_behavior: "scale_down",
    },
    {
      type: "text",
      name: "location_meta",
      content_key: "locationMeta",
      x_mm: 18, y_mm: 70, w_mm: 80, h_mm: 10,
      style: "eyebrow",
      color_role: "accent",
      max_chars: 60,
    },
    {
      type: "text",
      name: "description",
      content_key: "description",
      x_mm: 18, y_mm: 85, w_mm: 80, h_mm: 60,
      style: "body",
      color_role: "bodyText",
      max_chars: 400,
      overflow_behavior: "truncate",
    },
    {
      type: "text",
      name: "stay_details",
      content_key: "stayDetails",
      x_mm: 18, y_mm: 150, w_mm: 80, h_mm: 40,
      style: "caption",
      color_role: "bodyText",
      max_chars: 200,
    },
    {
      type: "text",
      name: "features_list",
      content_key: "featuresList",
      x_mm: 18, y_mm: 195, w_mm: 80, h_mm: 40,
      style: "caption",
      color_role: "mutedText",
      max_chars: 200,
    },
    {
      type: "image",
      name: "main_image",
      content_key: "mainImageUrl",
      x_mm: 105, y_mm: 40, w_mm: 87, h_mm: 110,
      min_resolution_px: [1500, 1500],
      object_fit: "cover",
      image_role: "hero",
    },
    {
      type: "image",
      name: "thumb_1",
      content_key: "thumbUrl1",
      x_mm: 105, y_mm: 155, w_mm: 40, h_mm: 40,
      object_fit: "cover",
      image_role: "thumb",
    },
    {
      type: "image",
      name: "thumb_2",
      content_key: "thumbUrl2",
      x_mm: 147, y_mm: 155, w_mm: 40, h_mm: 40,
      object_fit: "cover",
      image_role: "thumb",
    },
    {
      type: "image",
      name: "thumb_3",
      content_key: "thumbUrl3",
      x_mm: 105, y_mm: 200, w_mm: 82, h_mm: 40,
      object_fit: "cover",
      image_role: "thumb",
    },
    {
      type: "line",
      name: "divider",
      x_mm: 18, y_mm: 260, w_mm: 174, h_mm: 1,
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
