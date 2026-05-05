import type { LayoutManifest } from "../types";

// ─── Day card — editorial luxury (single locked layout) ──────────────────
//
// Print-first A4 spread. Functional system stays intact (image
// replace, property swap, AI rewrite live in the editor chrome /
// inline overlays); this manifest controls the visual structure
// of the printed page.
//
// Layout summary:
//   Header band  y:14-46 — DAY · DATE · LOCATION row + Title h1
//   Intro line   y:50-62 — italic editorial hook
//   Body 2-col   y:68-160 — text left, image right (image dominant)
//   Stay block   y:170-260 — image left + text block right (no card)
//   Page footer  y:280+ — operator brand line if present

export const DAY_CARD_STANDARD: LayoutManifest = {
  id: "day-card-standard",
  section: "day_card",
  page_count: 1,
  description:
    "Editorial day spread — header / intro / 2-col body / accommodation block",
  slots: [
    {
      type: "fill",
      name: "section_bg",
      x_mm: 0, y_mm: 0, w_mm: 210, h_mm: 297,
      fill: "sectionSurface",
      z_index: 0,
    },

    // ─── HEADER BAND ───────────────────────────────────────────────────
    {
      type: "text",
      name: "header_meta",
      content_key: "headerMeta",
      x_mm: 18, y_mm: 14, w_mm: 174, h_mm: 5,
      style: "eyebrow",
      color_role: "mutedText",
      size_pt: 9,
      letter_spacing_em: 0.18,
      uppercase: true,
      max_chars: 80,
      overflow_behavior: "truncate",
    },
    {
      type: "text",
      name: "title",
      content_key: "title",
      x_mm: 18, y_mm: 22, w_mm: 174, h_mm: 22,
      style: "h1",
      color_role: "headingText",
      size_pt: 30,
      line_height: 1.05,
      font_weight: 700,
      max_chars: 80,
      overflow_behavior: "scale_down",
    },
    {
      type: "fill",
      name: "header_divider",
      x_mm: 18, y_mm: 46, w_mm: 174, h_mm: 0.3,
      fill: "border",
      opacity: 0.5,
    },

    // ─── INTRO LINE ────────────────────────────────────────────────────
    {
      type: "text",
      name: "intro_text",
      content_key: "introText",
      x_mm: 18, y_mm: 52, w_mm: 174, h_mm: 12,
      style: "body",
      color_role: "headingText",
      size_pt: 13,
      line_height: 1.35,
      max_chars: 200,
      overflow_behavior: "scale_down",
    },

    // ─── BODY — 2 columns ─────────────────────────────────────────────
    {
      type: "text",
      name: "body_text",
      content_key: "narrative",
      x_mm: 18, y_mm: 70, w_mm: 108, h_mm: 92,
      style: "body",
      color_role: "bodyText",
      size_pt: 11,
      line_height: 1.6,
      max_chars: 1100,
      overflow_behavior: "truncate",
    },
    {
      type: "image",
      name: "main_image",
      content_key: "destinationImageUrl",
      x_mm: 132, y_mm: 70, w_mm: 78, h_mm: 92,
      object_fit: "cover",
      image_role: "hero",
    },

    // ─── ACCOMMODATION BLOCK (no card, no border) ─────────────────────
    {
      type: "image",
      name: "lodge_image",
      content_key: "lodgeImageUrl",
      x_mm: 18, y_mm: 174, w_mm: 80, h_mm: 60,
      object_fit: "cover",
      image_role: "thumb",
    },
    {
      type: "text",
      name: "lodge_eyebrow",
      content_key: "lodgeEyebrow",
      x_mm: 106, y_mm: 176, w_mm: 88, h_mm: 5,
      style: "eyebrow",
      color_role: "mutedText",
      size_pt: 8,
      letter_spacing_em: 0.18,
      uppercase: true,
      max_chars: 24,
    },
    {
      type: "text",
      name: "lodge_property_name",
      content_key: "lodgePropertyName",
      x_mm: 106, y_mm: 184, w_mm: 88, h_mm: 10,
      style: "h3",
      color_role: "headingText",
      size_pt: 16,
      line_height: 1.15,
      font_weight: 700,
      max_chars: 50,
      overflow_behavior: "scale_down",
    },
    {
      type: "text",
      name: "lodge_location",
      content_key: "lodgeLocation",
      x_mm: 106, y_mm: 197, w_mm: 88, h_mm: 5,
      style: "caption",
      color_role: "mutedText",
      size_pt: 9,
      max_chars: 50,
      overflow_behavior: "truncate",
    },
    {
      type: "text",
      name: "lodge_description",
      content_key: "lodgeDescription",
      x_mm: 106, y_mm: 206, w_mm: 88, h_mm: 30,
      style: "body",
      color_role: "bodyText",
      size_pt: 10,
      line_height: 1.5,
      max_chars: 280,
      overflow_behavior: "truncate",
    },
    {
      type: "text",
      name: "lodge_amenities",
      content_key: "lodgeAmenities",
      x_mm: 106, y_mm: 240, w_mm: 88, h_mm: 8,
      style: "caption",
      color_role: "mutedText",
      size_pt: 9,
      letter_spacing_em: 0.04,
      max_chars: 200,
      overflow_behavior: "truncate",
    },

    // ─── PAGE FOOTER — quiet brand mark ──────────────────────────────
    {
      type: "fill",
      name: "page_footer_border",
      x_mm: 18, y_mm: 280, w_mm: 174, h_mm: 0.3,
      fill: "border",
      opacity: 0.4,
    },
    {
      type: "text",
      name: "page_footer_brand",
      content_key: "pageFooterBrand",
      x_mm: 18, y_mm: 286, w_mm: 174, h_mm: 5,
      style: "eyebrow",
      color_role: "mutedText",
      size_pt: 8,
      letter_spacing_em: 0.18,
      uppercase: true,
      alignment: "center",
      max_chars: 80,
      overflow_behavior: "truncate",
    },
  ],
  rules: [
    "Section fills full A4 page (297mm)",
    "Header band y:14-46 — eyebrow + title + hairline",
    "Intro y:52-64 — italic editorial hook",
    "Body 2-col y:70-162 — text left (108mm), image right (78mm)",
    "Accommodation y:174-248 — image left, text right, no card",
    "Page footer y:280-291 — quiet brand mark",
  ],
};

export const DAY_CARD_LAYOUTS = [DAY_CARD_STANDARD];
