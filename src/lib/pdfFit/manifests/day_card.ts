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

    // ─── 5. ACCOMMODATION BLOCK (y:188–286) ───────────────────────────
    // Full-width property image dominant; text stack below with
    // generous heights so every line reads. Stats bar removed —
    // trip-wide stats live on the trip-summary page; the day card
    // ends with the property block.
    {
      type: "image",
      name: "lodge_image",
      content_key: "lodgeImageUrl",
      x_mm: 18, y_mm: 188, w_mm: 174, h_mm: 50,
      object_fit: "cover",
      image_role: "hero",
    },
    {
      type: "text",
      name: "lodge_eyebrow",
      content_key: "lodgeEyebrow",
      x_mm: 18, y_mm: 242, w_mm: 174, h_mm: 5,
      style: "eyebrow",
      color_role: "mutedText",
      size_pt: 9,
      letter_spacing_em: 0.18,
      uppercase: true,
      max_chars: 30,
    },
    {
      type: "text",
      name: "lodge_property_name",
      content_key: "lodgePropertyName",
      x_mm: 18, y_mm: 250, w_mm: 174, h_mm: 9,
      style: "h3",
      color_role: "headingText",
      size_pt: 18,
      line_height: 1.1,
      font_weight: 700,
      max_chars: 60,
      overflow_behavior: "scale_down",
    },
    {
      type: "text",
      name: "lodge_location",
      content_key: "lodgeLocation",
      x_mm: 18, y_mm: 261, w_mm: 174, h_mm: 5,
      style: "caption",
      color_role: "mutedText",
      size_pt: 10,
      letter_spacing_em: 0.02,
      max_chars: 80,
      overflow_behavior: "truncate",
    },
    {
      type: "text",
      name: "lodge_description",
      content_key: "lodgeDescription",
      x_mm: 18, y_mm: 268, w_mm: 174, h_mm: 12,
      style: "body",
      color_role: "bodyText",
      size_pt: 10.5,
      line_height: 1.4,
      max_chars: 320,
      overflow_behavior: "truncate",
    },
    {
      type: "text",
      name: "lodge_features",
      content_key: "lodgeFeatures",
      x_mm: 18, y_mm: 282, w_mm: 174, h_mm: 5,
      style: "caption",
      color_role: "mutedText",
      size_pt: 9,
      letter_spacing_em: 0.04,
      max_chars: 240,
      overflow_behavior: "truncate",
    },
  ],
  rules: [
    "A4 print-safe — section fills 297mm with 18mm L/R margins",
    "Title block 28mm; hero image 80mm; intro 10mm",
    "Body 2-col 40mm at 11pt × 1.55 leading, 10mm column gap",
    "Accommodation y:188-287 — full-width image + text stack below",
    "Property data binds to active-tier proposal.properties only",
  ],
};

// ─── Magazine clones — flip variants ─────────────────────────────────────
//
// Same structure as STANDARD except the hero image swaps sides with
// the body text instead of sitting full-width on top. Matches the
// magazine FlipCard layouts. Variant ids match the magazine ones so
// picking right-flip / left-flip in the chrome dropdown resolves to
// the right PdfFit manifest.

function buildFlipManifest(
  id: string,
  imageOnRight: boolean,
): LayoutManifest {
  // Each side gets ~half the content band (174mm content / 2 - small
  // gap). Image is 84mm wide × 130mm tall — substantial visual
  // anchor. Text fills the other 84mm wide × 130mm tall column.
  const IMAGE_W = 84;
  const TEXT_W = 84;
  const SIDE_GAP = 6;

  const imageX = imageOnRight ? 18 + TEXT_W + SIDE_GAP : 18;
  const textX = imageOnRight ? 18 : 18 + IMAGE_W + SIDE_GAP;

  return {
    id,
    section: "day_card",
    page_count: 1,
    description: imageOnRight
      ? "Day card — text left, hero image right (right-flip)"
      : "Day card — image left, text right (left-flip)",
    slots: [
      {
        type: "fill",
        name: "section_bg",
        x_mm: 0, y_mm: 0, w_mm: 210, h_mm: 297,
        fill: "sectionSurface",
        z_index: 0,
      },

      // Header band (top, full width).
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
        letter_spacing_em: -0.01,
        max_chars: 80,
        overflow_behavior: "scale_down",
      },
      {
        type: "fill",
        name: "title_divider",
        x_mm: 18, y_mm: 46, w_mm: 174, h_mm: 0.3,
        fill: "border",
        opacity: 0.5,
      },

      // Hero image — one half of the content band.
      {
        type: "image",
        name: "main_image",
        content_key: "destinationImageUrl",
        x_mm: imageX, y_mm: 52, w_mm: IMAGE_W, h_mm: 130,
        object_fit: "cover",
        image_role: "hero",
      },

      // Intro line — sits inside the text column.
      {
        type: "text",
        name: "intro_text",
        content_key: "introText",
        x_mm: textX, y_mm: 52, w_mm: TEXT_W, h_mm: 14,
        style: "body",
        color_role: "headingText",
        size_pt: 13,
        line_height: 1.3,
        max_chars: 200,
        overflow_behavior: "scale_down",
      },
      // Body narrative — fills the rest of the text column.
      {
        type: "text",
        name: "body_text",
        content_key: "narrative",
        x_mm: textX, y_mm: 70, w_mm: TEXT_W, h_mm: 112,
        style: "body",
        color_role: "bodyText",
        size_pt: 11,
        line_height: 1.55,
        max_chars: 1100,
        overflow_behavior: "truncate",
      },

      // Accommodation block — full width below hero/text.
      {
        type: "image",
        name: "lodge_image",
        content_key: "lodgeImageUrl",
        x_mm: 18, y_mm: 188, w_mm: 174, h_mm: 50,
        object_fit: "cover",
        image_role: "hero",
      },
      {
        type: "text",
        name: "lodge_eyebrow",
        content_key: "lodgeEyebrow",
        x_mm: 18, y_mm: 242, w_mm: 174, h_mm: 5,
        style: "eyebrow",
        color_role: "mutedText",
        size_pt: 9,
        letter_spacing_em: 0.18,
        uppercase: true,
        max_chars: 30,
      },
      {
        type: "text",
        name: "lodge_property_name",
        content_key: "lodgePropertyName",
        x_mm: 18, y_mm: 250, w_mm: 174, h_mm: 9,
        style: "h3",
        color_role: "headingText",
        size_pt: 18,
        line_height: 1.1,
        font_weight: 700,
        max_chars: 60,
        overflow_behavior: "scale_down",
      },
      {
        type: "text",
        name: "lodge_location",
        content_key: "lodgeLocation",
        x_mm: 18, y_mm: 261, w_mm: 174, h_mm: 5,
        style: "caption",
        color_role: "mutedText",
        size_pt: 10,
        letter_spacing_em: 0.02,
        max_chars: 80,
        overflow_behavior: "truncate",
      },
      {
        type: "text",
        name: "lodge_description",
        content_key: "lodgeDescription",
        x_mm: 18, y_mm: 268, w_mm: 174, h_mm: 12,
        style: "body",
        color_role: "bodyText",
        size_pt: 10.5,
        line_height: 1.4,
        max_chars: 320,
        overflow_behavior: "truncate",
      },
      {
        type: "text",
        name: "lodge_features",
        content_key: "lodgeFeatures",
        x_mm: 18, y_mm: 282, w_mm: 174, h_mm: 5,
        style: "caption",
        color_role: "mutedText",
        size_pt: 9,
        letter_spacing_em: 0.04,
        max_chars: 240,
        overflow_behavior: "truncate",
      },
    ],
    rules: [
      "Header band y:14-46 — full content width",
      `Hero image ${imageOnRight ? "RIGHT" : "LEFT"} — 84mm × 130mm`,
      `Body text ${imageOnRight ? "LEFT" : "RIGHT"} — 84mm × 130mm`,
      "Accommodation y:188-282 — full-width image + text stack",
    ],
  };
}

// Magazine variant ids — picked from the chrome dropdown.
export const DAY_CARD_RIGHT_FLIP = buildFlipManifest("right-flip", true);
export const DAY_CARD_LEFT_FLIP = buildFlipManifest("left-flip", false);
// trip-flip resolves to right-flip by default — the consumer
// detects "trip-flip" and alternates between left/right per
// day index so the deck reads as a magazine spread.
export const DAY_CARD_TRIP_FLIP: LayoutManifest = {
  ...DAY_CARD_RIGHT_FLIP,
  id: "trip-flip",
  description:
    "Day card — alternates right-flip / left-flip per day for magazine rhythm",
};

// ─── Editorial-split — full-bleed hero with overlay typography ───────────
//
// INVARIANT: ONE DAY = ONE PAGE. This variant is non-paginating by
// construction. Every text slot has a max_chars cap with truncate or
// scale_down overflow_behavior, and .pdf-page sets overflow:hidden as
// the final safety net. The content composer emits exactly one
// PdfFitDayPage per Day; nothing in the rendering path may split a day
// across multiple A4 pages. Long narratives ellipsize gracefully —
// they do not spill onto a continuation page. Operators who routinely
// need 700+ char narratives should pick the standard or flip variants
// (1100+ char body caps) instead.
//
// Composition (emotionally weighted top → bottom):
//   y:18-150  HERO 174×132 — primary anchor, dominant
//   y:156-170 INTRO 174×14 — italic editorial pull (carries subtitle)
//   y:174-232 BODY 174×58 — single-column readable narrative
//   y:236-286 LODGE — 72×50 landscape image · 94×50 content panel
//   y:286-297 Bottom whitespace 11mm — intentional editorial breath
//
// Stats strip removed — the page reads as composition, not dashboard.
//
// Two slot names diverge from the standard/flip layouts:
//   - title_overlay   (vs title)         — destination-only, no subtitle
//   - lodge_features_3 (vs lodge_features) — top 3 amenities only
// The renderer in PdfFitDayPage.tsx populates these as additional
// contents-map entries; other variants ignore them.

export const DAY_CARD_EDITORIAL_SPLIT: LayoutManifest = {
  id: "day-card-editorial-split",
  section: "day_card",
  page_count: 1,
  description:
    "Editorial split — 132mm hero with overlay typography, single-column narrative, horizontal lodge. ONE DAY = ONE PAGE.",
  slots: [
    // ─── Background ──────────────────────────────────────────────────
    {
      type: "fill",
      name: "section_bg",
      x_mm: 0, y_mm: 0, w_mm: 210, h_mm: 297,
      fill: "sectionSurface",
      z_index: 0,
    },

    // ─── Hero (y:18–150) — 132mm dominant anchor ─────────────────────
    {
      type: "image",
      name: "main_image",
      content_key: "destinationImageUrl",
      x_mm: 18, y_mm: 18, w_mm: 174, h_mm: 132,
      object_fit: "cover",
      image_role: "hero",
    },
    // Bottom-band gradient scrim — transparent → rgba(0,0,0,0.55) so the
    // overlay typography stays legible on most photos. Bump opacity to
    // 0.65 if dark heroes (sunset/silhouette) cause problems.
    {
      type: "fill",
      name: "hero_overlay_gradient",
      x_mm: 18, y_mm: 120, w_mm: 174, h_mm: 30,
      fill: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.55) 100%)",
      z_index: 1,
    },
    // Overlay eyebrow — DAY · DATE · LOCATION in white.
    {
      type: "text",
      name: "header_meta",
      content_key: "headerMeta",
      x_mm: 24, y_mm: 130, w_mm: 162, h_mm: 5,
      style: "eyebrow",
      color_role: "white",
      size_pt: 9,
      letter_spacing_em: 0.18,
      uppercase: true,
      max_chars: 80,
      overflow_behavior: "truncate",
      z_index: 2,
    },
    // Overlay title — DESTINATION ONLY. New slot name so it can carry
    // a different content value than the standard `title` slot.
    {
      type: "text",
      name: "title_overlay",
      content_key: "destinationOnly",
      x_mm: 24, y_mm: 136, w_mm: 162, h_mm: 12,
      style: "h1",
      color_role: "white",
      size_pt: 28,
      line_height: 1.05,
      font_weight: 700,
      letter_spacing_em: -0.005,
      max_chars: 60,
      overflow_behavior: "scale_down",
      z_index: 2,
    },

    // ─── Intro line (y:156–170) — italic editorial pull ──────────────
    // Carries the "subtitle feeling" since the title overlay is now
    // destination only. Renderer falls back to subtitle / momentOfDay.
    {
      type: "text",
      name: "intro_text",
      content_key: "introText",
      x_mm: 18, y_mm: 156, w_mm: 174, h_mm: 14,
      style: "body",
      color_role: "headingText",
      size_pt: 13,
      line_height: 1.3,
      max_chars: 200,
      overflow_behavior: "scale_down",
    },

    // ─── Body (y:174–232) — single readable column, 58mm tall ────────
    // 700-char cap → roughly 9-10 lines at 11pt × 1.55 leading. Longer
    // narratives truncate with ellipsis rather than paginate.
    {
      type: "text",
      name: "body_text",
      content_key: "narrative",
      x_mm: 18, y_mm: 174, w_mm: 174, h_mm: 58,
      style: "body",
      color_role: "bodyText",
      size_pt: 11,
      line_height: 1.55,
      max_chars: 700,
      overflow_behavior: "truncate",
    },

    // ─── Lodge (y:236–286) — landscape 72×50 image · 94×50 content ──
    // 8mm gutter between image and content; content stack uses uniform
    // 2mm gaps for editorial breathing room.
    {
      type: "image",
      name: "lodge_image",
      content_key: "lodgeImageUrl",
      x_mm: 18, y_mm: 236, w_mm: 72, h_mm: 50,
      object_fit: "cover",
      image_role: "hero",
    },
    {
      type: "text",
      name: "lodge_eyebrow",
      content_key: "lodgeEyebrow",
      x_mm: 98, y_mm: 236, w_mm: 94, h_mm: 5,
      style: "eyebrow",
      color_role: "mutedText",
      size_pt: 9,
      letter_spacing_em: 0.18,
      uppercase: true,
      max_chars: 30,
    },
    {
      type: "text",
      name: "lodge_property_name",
      content_key: "lodgePropertyName",
      x_mm: 98, y_mm: 243, w_mm: 94, h_mm: 9,
      style: "h3",
      color_role: "headingText",
      size_pt: 17,
      line_height: 1.1,
      font_weight: 700,
      max_chars: 60,
      overflow_behavior: "scale_down",
    },
    {
      type: "text",
      name: "lodge_location",
      content_key: "lodgeLocation",
      x_mm: 98, y_mm: 254, w_mm: 94, h_mm: 5,
      style: "caption",
      color_role: "mutedText",
      size_pt: 10,
      letter_spacing_em: 0.02,
      max_chars: 70,
      overflow_behavior: "truncate",
    },
    {
      type: "text",
      name: "lodge_description",
      content_key: "lodgeDescription",
      x_mm: 98, y_mm: 261, w_mm: 94, h_mm: 18,
      style: "body",
      color_role: "bodyText",
      size_pt: 10,
      line_height: 1.4,
      max_chars: 220,
      overflow_behavior: "truncate",
    },
    // Top 3 amenities only — distinct slot name from `lodge_features`
    // so the standard/flip variants keep their 5-amenity rendering.
    // Subtle muted typography (8pt + opacity 0.7) per editorial brief.
    {
      type: "text",
      name: "lodge_features_3",
      content_key: "lodgeFeaturesShort",
      x_mm: 98, y_mm: 281, w_mm: 94, h_mm: 5,
      style: "caption",
      color_role: "mutedText",
      size_pt: 8,
      letter_spacing_em: 0.06,
      opacity: 0.7,
      max_chars: 80,
      overflow_behavior: "truncate",
    },
  ],
  rules: [
    "ONE DAY = ONE PAGE — non-paginating by construction; long content truncates, never splits",
    "A4 print-safe — 18mm L/R margins, 18mm top, 11mm bottom whitespace",
    "Hero 174×132 (y:18–150) — dominant anchor with bottom-band scrim + overlay typography",
    "Title is destination only (h1 white over 30mm scrim)",
    "Single-column body 174×58 — 700 chars cap before truncate",
    "No stats strip — composition prioritised over dashboard density",
    "Horizontal lodge: 72×50 image + 94×50 content, 8mm gutter, 2mm uniform inner gaps (y:236–286)",
  ],
};

export const DAY_CARD_LAYOUTS = [
  DAY_CARD_STANDARD,
  DAY_CARD_RIGHT_FLIP,
  DAY_CARD_LEFT_FLIP,
  DAY_CARD_TRIP_FLIP,
  DAY_CARD_EDITORIAL_SPLIT,
];
