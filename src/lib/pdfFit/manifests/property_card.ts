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

// Alias for the brief — "Gallery" variant (hero + 3 thumbs strip).
// PROPERTY_CARD_STANDARD already has this shape; expose under both
// names so the rhythm engine and editor can refer to it by either.
export const PROPERTY_CARD_GALLERY = PROPERTY_CARD_STANDARD;

// ─── Variant B — Editorial (text left, image right, full-height) ─────────
//
// Quiet, magazine-page composition. The hero photograph runs full
// page-height on the right; the left column carries the property
// name + location + description + stay details + amenities. Used
// when the property's story is what matters (heritage lodges,
// designer suites, founder-hosted camps).
//
//   x:0–88    text column (white surface)
//   x:88–210  hero image full-height
//   y:20      eyebrow (Property X of Y)
//   y:32      property name (h1)
//   y:58      location (eyebrow accent)
//   y:75      description body
//   y:170     stay details
//   y:215     features list (amenities)
//   y:288     divider

export const PROPERTY_CARD_EDITORIAL: LayoutManifest = {
  id: "property-card-editorial",
  section: "property_card",
  page_count: 1,
  description:
    "Editorial property page — text column left, full-height hero photograph right",
  slots: [
    {
      type: "image",
      name: "main_image",
      content_key: "mainImageUrl",
      x_mm: 88, y_mm: 0, w_mm: 122, h_mm: 297,
      object_fit: "cover",
      image_role: "hero",
      z_index: 0,
    },
    {
      type: "text",
      name: "section_title",
      content_key: "sectionTitle",
      x_mm: 18, y_mm: 22, w_mm: 64, h_mm: 6,
      style: "eyebrow",
      color_role: "mutedText",
      max_chars: 60,
    },
    {
      type: "text",
      name: "property_name",
      content_key: "propertyName",
      x_mm: 18, y_mm: 32, w_mm: 64, h_mm: 24,
      style: "h1",
      color_role: "headingText",
      max_chars: 60,
      overflow_behavior: "scale_down",
    },
    {
      type: "text",
      name: "location_meta",
      content_key: "locationMeta",
      x_mm: 18, y_mm: 60, w_mm: 64, h_mm: 6,
      style: "eyebrow",
      color_role: "accent",
      max_chars: 60,
    },
    {
      type: "text",
      name: "description",
      content_key: "description",
      x_mm: 18, y_mm: 75, w_mm: 64, h_mm: 88,
      style: "body",
      color_role: "bodyText",
      max_chars: 620,
      overflow_behavior: "truncate",
    },
    {
      type: "text",
      name: "stay_details",
      content_key: "stayDetails",
      x_mm: 18, y_mm: 170, w_mm: 64, h_mm: 38,
      style: "caption",
      color_role: "bodyText",
      max_chars: 240,
    },
    {
      type: "text",
      name: "features_list",
      content_key: "featuresList",
      x_mm: 18, y_mm: 215, w_mm: 64, h_mm: 64,
      style: "caption",
      color_role: "mutedText",
      max_chars: 360,
      overflow_behavior: "truncate",
    },
    {
      type: "line",
      name: "divider",
      x_mm: 18, y_mm: 288, w_mm: 64, h_mm: 1,
      color_role: "border",
    },
  ],
  rules: [
    "Hero photograph full-height right (88–210mm)",
    "Text column lives 18–82mm; never crosses 88mm into the photograph",
    "Description max 620 chars; truncates rather than overflowing into stay/features",
  ],
};

// ─── Variant C — Feature (one dominant image, compact caption) ────────────
//
// Quiet luxury — the photograph IS the page. A small caption strip
// at the bottom carries property name + location + one line of
// description. Use sparingly: best for hero properties or signature
// stays where the visual alone communicates the experience.
//
//   y:0–250    full-bleed hero
//   y:255–292  cream caption strip with property name + meta + 1-line desc

export const PROPERTY_CARD_FEATURE: LayoutManifest = {
  id: "property-card-feature",
  section: "property_card",
  page_count: 1,
  description:
    "Feature page — single dominant photograph with a quiet caption strip below",
  slots: [
    {
      type: "image",
      name: "main_image",
      content_key: "mainImageUrl",
      x_mm: 0, y_mm: 0, w_mm: 210, h_mm: 250,
      object_fit: "cover",
      image_role: "hero",
      z_index: 0,
    },
    {
      type: "fill",
      name: "caption_bg",
      x_mm: 0, y_mm: 250, w_mm: 210, h_mm: 47,
      fill: "sectionBg",
    },
    {
      type: "text",
      name: "section_title",
      content_key: "sectionTitle",
      x_mm: 18, y_mm: 256, w_mm: 174, h_mm: 6,
      style: "eyebrow",
      color_role: "mutedText",
      max_chars: 60,
    },
    {
      type: "text",
      name: "property_name",
      content_key: "propertyName",
      x_mm: 18, y_mm: 264, w_mm: 120, h_mm: 14,
      style: "h2",
      color_role: "headingText",
      max_chars: 60,
      overflow_behavior: "scale_down",
    },
    {
      type: "text",
      name: "location_meta",
      content_key: "locationMeta",
      x_mm: 140, y_mm: 268, w_mm: 52, h_mm: 6,
      style: "eyebrow",
      color_role: "accent",
      alignment: "right",
      max_chars: 50,
    },
    {
      type: "text",
      name: "description",
      content_key: "description",
      x_mm: 18, y_mm: 280, w_mm: 174, h_mm: 12,
      style: "caption",
      color_role: "bodyText",
      max_chars: 200,
      overflow_behavior: "truncate",
    },
  ],
  rules: [
    "Hero photograph dominates 0–250mm",
    "Caption strip 250–297mm carries name + location + one-line description",
    "No stay details or features list — feature variant is intentionally quiet",
  ],
};

export const PROPERTY_CARD_LAYOUTS = [
  PROPERTY_CARD_STANDARD,
  PROPERTY_CARD_EDITORIAL,
  PROPERTY_CARD_FEATURE,
];
