import type { LayoutManifest } from "../types";

// ─── Day card — luxury editorial spread (locked geometry) ────────────────
//
// A4 print-safe. 18mm margins, 174mm content width. Vertical rhythm in
// 4mm/8mm multiples per spec.
//
// Stack (top → bottom):
//   y:14   DAY LABEL + TITLE BLOCK   (28mm, max title width 140mm)
//   y:42   HERO IMAGE                 (100mm, full content width)
//   y:148  INTRO LINE                 (10mm, italic serif 13pt)
//   y:162  BODY 2-COL                 (60mm, two columns 80mm each, 8mm gap)
//   y:230  ACCOMMODATION              (32mm, text left + image right)
//   y:268  STATS BAR                  (22mm, 4 equal columns)
//
// Image must dominate (100mm = ~36% of page height). Body text never
// stretches full width; always 2-col. Accommodation block never larger
// than 35mm.

export const DAY_CARD_STANDARD: LayoutManifest = {
  id: "day-card-standard",
  section: "day_card",
  page_count: 1,
  description:
    "Luxury editorial day spread — title / hero / intro / 2-col body / stay / stats",
  slots: [
    {
      type: "fill",
      name: "section_bg",
      x_mm: 0, y_mm: 0, w_mm: 210, h_mm: 297,
      fill: "sectionSurface",
      z_index: 0,
    },

    // ─── 1. DAY LABEL + TITLE BLOCK (y:14–42) ─────────────────────────
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
      x_mm: 18, y_mm: 22, w_mm: 140, h_mm: 14,
      style: "h1",
      color_role: "headingText",
      size_pt: 28,
      line_height: 1.05,
      font_weight: 700,
      letter_spacing_em: -0.01,
      max_chars: 80,
      overflow_behavior: "scale_down",
    },
    {
      type: "fill",
      name: "title_divider",
      x_mm: 18, y_mm: 38, w_mm: 174, h_mm: 0.3,
      fill: "border",
      opacity: 0.5,
    },

    // ─── 2. HERO IMAGE (y:42–122) ─────────────────────────────────────
    // Primary visual anchor — full content width.
    {
      type: "image",
      name: "main_image",
      content_key: "destinationImageUrl",
      x_mm: 18, y_mm: 42, w_mm: 174, h_mm: 80,
      object_fit: "cover",
      image_role: "hero",
    },

    // ─── 3. INTRO LINE (y:128–138) ────────────────────────────────────
    {
      type: "text",
      name: "intro_text",
      content_key: "introText",
      x_mm: 18, y_mm: 128, w_mm: 174, h_mm: 10,
      style: "body",
      color_role: "headingText",
      size_pt: 13,
      line_height: 1.3,
      max_chars: 200,
      overflow_behavior: "scale_down",
    },

    // ─── 4. BODY TEXT — 2-col editorial grid (y:142–182) ──────────────
    {
      type: "text",
      name: "body_text",
      content_key: "narrative",
      x_mm: 18, y_mm: 142, w_mm: 174, h_mm: 40,
      style: "body",
      color_role: "bodyText",
      size_pt: 11,
      line_height: 1.55,
      max_chars: 900,
      overflow_behavior: "truncate",
      column_count: 2,
      column_gap_mm: 10,
    },

    // ─── 5. ACCOMMODATION BLOCK (y:188–262) ───────────────────────────
    // Full-width property image dominant; text stack below. No card,
    // no harsh background. All bound to the active-tier property's
    // backend data — empty state handled by the consumer.
    {
      type: "image",
      name: "lodge_image",
      content_key: "lodgeImageUrl",
      x_mm: 18, y_mm: 188, w_mm: 174, h_mm: 42,
      object_fit: "cover",
      image_role: "hero",
    },
    {
      type: "text",
      name: "lodge_eyebrow",
      content_key: "lodgeEyebrow",
      x_mm: 18, y_mm: 232, w_mm: 174, h_mm: 4,
      style: "eyebrow",
      color_role: "mutedText",
      size_pt: 8,
      letter_spacing_em: 0.18,
      uppercase: true,
      max_chars: 30,
    },
    {
      type: "text",
      name: "lodge_property_name",
      content_key: "lodgePropertyName",
      x_mm: 18, y_mm: 238, w_mm: 174, h_mm: 7,
      style: "h3",
      color_role: "headingText",
      size_pt: 16,
      line_height: 1.1,
      font_weight: 700,
      max_chars: 60,
      overflow_behavior: "scale_down",
    },
    {
      type: "text",
      name: "lodge_location",
      content_key: "lodgeLocation",
      x_mm: 18, y_mm: 246, w_mm: 174, h_mm: 4,
      style: "caption",
      color_role: "mutedText",
      size_pt: 9,
      letter_spacing_em: 0.02,
      max_chars: 80,
      overflow_behavior: "truncate",
    },
    {
      type: "text",
      name: "lodge_description",
      content_key: "lodgeDescription",
      x_mm: 18, y_mm: 251, w_mm: 174, h_mm: 7,
      style: "body",
      color_role: "bodyText",
      size_pt: 10,
      line_height: 1.35,
      max_chars: 240,
      overflow_behavior: "truncate",
    },
    {
      type: "text",
      name: "lodge_features",
      content_key: "lodgeFeatures",
      x_mm: 18, y_mm: 259, w_mm: 174, h_mm: 4,
      style: "caption",
      color_role: "mutedText",
      size_pt: 8,
      letter_spacing_em: 0.04,
      max_chars: 200,
      overflow_behavior: "truncate",
    },

    // ─── 7. STATS BAR (y:268–290) ─────────────────────────────────────
    {
      type: "fill",
      name: "stats_top_border",
      x_mm: 18, y_mm: 268, w_mm: 174, h_mm: 0.3,
      fill: "border",
    },
    // 4 equal columns: Nights / Stops / Lodges / Parks.
    // Column width = 174/4 = 43.5mm; column x = 18 + i*43.5.
    {
      type: "text",
      name: "stats_nights_value",
      content_key: "statsNightsValue",
      x_mm: 18, y_mm: 273, w_mm: 43.5, h_mm: 9,
      style: "h2",
      color_role: "headingText",
      size_pt: 22,
      font_weight: 700,
      line_height: 1.0,
      alignment: "center",
      max_chars: 6,
    },
    {
      type: "text",
      name: "stats_nights_label",
      x_mm: 18, y_mm: 284, w_mm: 43.5, h_mm: 4,
      style: "eyebrow",
      color_role: "mutedText",
      size_pt: 8,
      letter_spacing_em: 0.14,
      uppercase: true,
      alignment: "center",
      max_chars: 12,
    },
    {
      type: "text",
      name: "stats_stops_value",
      content_key: "statsStopsValue",
      x_mm: 61.5, y_mm: 273, w_mm: 43.5, h_mm: 9,
      style: "h2",
      color_role: "headingText",
      size_pt: 22,
      font_weight: 700,
      line_height: 1.0,
      alignment: "center",
      max_chars: 6,
    },
    {
      type: "text",
      name: "stats_stops_label",
      x_mm: 61.5, y_mm: 284, w_mm: 43.5, h_mm: 4,
      style: "eyebrow",
      color_role: "mutedText",
      size_pt: 8,
      letter_spacing_em: 0.14,
      uppercase: true,
      alignment: "center",
      max_chars: 12,
    },
    {
      type: "text",
      name: "stats_lodges_value",
      content_key: "statsLodgesValue",
      x_mm: 105, y_mm: 273, w_mm: 43.5, h_mm: 9,
      style: "h2",
      color_role: "headingText",
      size_pt: 22,
      font_weight: 700,
      line_height: 1.0,
      alignment: "center",
      max_chars: 6,
    },
    {
      type: "text",
      name: "stats_lodges_label",
      x_mm: 105, y_mm: 284, w_mm: 43.5, h_mm: 4,
      style: "eyebrow",
      color_role: "mutedText",
      size_pt: 8,
      letter_spacing_em: 0.14,
      uppercase: true,
      alignment: "center",
      max_chars: 12,
    },
    {
      type: "text",
      name: "stats_parks_value",
      content_key: "statsParksValue",
      x_mm: 148.5, y_mm: 273, w_mm: 43.5, h_mm: 9,
      style: "h2",
      color_role: "headingText",
      size_pt: 22,
      font_weight: 700,
      line_height: 1.0,
      alignment: "center",
      max_chars: 6,
    },
    {
      type: "text",
      name: "stats_parks_label",
      x_mm: 148.5, y_mm: 284, w_mm: 43.5, h_mm: 4,
      style: "eyebrow",
      color_role: "mutedText",
      size_pt: 8,
      letter_spacing_em: 0.14,
      uppercase: true,
      alignment: "center",
      max_chars: 12,
    },
    {
      type: "fill",
      name: "stats_sep_1",
      x_mm: 61.5, y_mm: 273, w_mm: 0.3, h_mm: 16,
      fill: "border",
      opacity: 0.5,
    },
    {
      type: "fill",
      name: "stats_sep_2",
      x_mm: 105, y_mm: 273, w_mm: 0.3, h_mm: 16,
      fill: "border",
      opacity: 0.5,
    },
    {
      type: "fill",
      name: "stats_sep_3",
      x_mm: 148.5, y_mm: 273, w_mm: 0.3, h_mm: 16,
      fill: "border",
      opacity: 0.5,
    },
    {
      type: "fill",
      name: "stats_bottom_border",
      x_mm: 18, y_mm: 290, w_mm: 174, h_mm: 0.3,
      fill: "border",
    },
  ],
  rules: [
    "A4 print-safe — section fills 297mm with 18mm L/R margins",
    "Title block 28mm; hero image 100mm dominant; intro 10mm",
    "Body 2-col 60mm at 11pt × 1.55 leading, 10mm column gap",
    "Accommodation 32mm — text left, image right (64mm wide)",
    "Stats bar 22mm — 4 equal columns with vertical separators",
    "Image must dominate visually (~34% of page height)",
  ],
};

export const DAY_CARD_LAYOUTS = [DAY_CARD_STANDARD];
