import type { LayoutManifest } from "../types";

// ─── Cover layout manifests ────────────────────────────────────────────────
//
// Three variants from the operator's spec:
//
//   cover-cinematic-hero   — full-bleed photo + bottom gradient + text
//   cover-editorial-split  — image left half / typography right half
//   cover-minimal-luxury   — type-led with logo + title centered
//
// Slot coordinates are mm; copy caps are in chars. The layout components
// in components/proposal-share/PdfFit/CoverLayouts/ consume these
// manifests and resolve content_key references against the proposal.

export const COVER_CINEMATIC_HERO: LayoutManifest = {
  id: "cover-cinematic-hero",
  section: "cover",
  page_count: 1,
  description: "Full-bleed cinematic safari image with bottom gradient text overlay",
  slots: [
    {
      type: "image",
      name: "hero_image",
      content_key: "heroImageUrl",
      x_mm: 0, y_mm: 0, w_mm: 210, h_mm: 297,
      aspect_ratio: "210:297",
      min_resolution_px: [4960, 7016],
      image_role: "hero",
      object_fit: "cover",
      z_index: 0,
      focal_recommendation: "subject upper third, avoid bottom 30%",
    },
    {
      type: "fill",
      name: "gradient_overlay",
      x_mm: 0, y_mm: 180, w_mm: 210, h_mm: 117,
      fill: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.65) 100%)",
      z_index: 1,
    },
    {
      type: "image",
      name: "operator_logo",
      content_key: "operatorLogoUrl",
      x_mm: 18, y_mm: 210, w_mm: 32, h_mm: 12,
      min_resolution_px: [600, 240],
      object_fit: "contain",
      z_index: 2,
    },
    {
      type: "text",
      name: "trip_title",
      content_key: "tripTitle",
      x_mm: 18, y_mm: 230, w_mm: 174, h_mm: 28,
      style: "h1",
      color_role: "white",
      alignment: "left",
      max_chars: 60,
      overflow_behavior: "scale_down",
      z_index: 2,
    },
    {
      type: "text",
      name: "trip_meta",
      content_pattern: "{destinations} · {dates} · {duration}",
      x_mm: 18, y_mm: 262, w_mm: 174, h_mm: 12,
      style: "eyebrow",
      color_role: "white",
      alignment: "left",
      max_chars: 80,
      overflow_behavior: "truncate",
      z_index: 2,
    },
  ],
  design_notes:
    "Primary emotional entry point. Bottom gradient ensures text legibility across variable imagery.",
};

export const COVER_EDITORIAL_SPLIT: LayoutManifest = {
  id: "cover-editorial-split",
  section: "cover",
  page_count: 1,
  description: "Split layout — image left half, typography panel right",
  slots: [
    {
      type: "image",
      name: "hero_image",
      content_key: "heroImageUrl",
      x_mm: 0, y_mm: 0, w_mm: 126, h_mm: 297,
      aspect_ratio: "126:297",
      min_resolution_px: [3500, 7000],
      image_role: "hero",
      object_fit: "cover",
      z_index: 0,
    },
    {
      type: "fill",
      name: "text_panel_bg",
      x_mm: 126, y_mm: 0, w_mm: 84, h_mm: 297,
      fill: "pageBg",
      z_index: 0,
    },
    {
      type: "image",
      name: "operator_logo",
      content_key: "operatorLogoUrl",
      x_mm: 140, y_mm: 40, w_mm: 40, h_mm: 14,
      object_fit: "contain",
      z_index: 1,
    },
    {
      type: "text",
      name: "trip_title",
      content_key: "tripTitle",
      x_mm: 140, y_mm: 80, w_mm: 60, h_mm: 80,
      style: "h1",
      color_role: "headingText",
      alignment: "left",
      max_chars: 55,
      overflow_behavior: "scale_down",
      z_index: 1,
    },
    {
      type: "text",
      name: "trip_meta",
      content_pattern: "{destinations} · {dates} · {duration}",
      x_mm: 140, y_mm: 170, w_mm: 60, h_mm: 20,
      style: "eyebrow",
      color_role: "mutedText",
      alignment: "left",
      max_chars: 70,
      overflow_behavior: "truncate",
      z_index: 1,
    },
  ],
  design_notes:
    "Editorial composition introduces structure and contrast. Narrow text column improves readability.",
};

export const COVER_MINIMAL_LUXURY: LayoutManifest = {
  id: "cover-minimal-luxury",
  section: "cover",
  page_count: 1,
  description: "Minimal typographic cover with subtle background tone",
  slots: [
    {
      type: "fill",
      name: "background",
      x_mm: 0, y_mm: 0, w_mm: 210, h_mm: 297,
      fill: "pageBg",
      z_index: 0,
    },
    {
      type: "image",
      name: "operator_logo",
      content_key: "operatorLogoUrl",
      x_mm: 85, y_mm: 60, w_mm: 40, h_mm: 16,
      object_fit: "contain",
      alignment: "center",
      z_index: 1,
    },
    {
      type: "text",
      name: "trip_title",
      content_key: "tripTitle",
      x_mm: 30, y_mm: 120, w_mm: 150, h_mm: 60,
      style: "h1",
      color_role: "headingText",
      alignment: "center",
      max_chars: 50,
      overflow_behavior: "scale_down",
      z_index: 1,
    },
    {
      type: "text",
      name: "trip_meta",
      content_pattern: "{destinations} · {dates} · {duration}",
      x_mm: 30, y_mm: 190, w_mm: 150, h_mm: 20,
      style: "eyebrow",
      color_role: "mutedText",
      alignment: "center",
      max_chars: 70,
      overflow_behavior: "truncate",
      z_index: 1,
    },
  ],
  design_notes:
    "Minimal luxury approach removes reliance on imagery. Works best with strong font pairing.",
};

// ─── Combined cover + personal letter (editorial spread) ─────────────────
//
// One page that does the job of two — hero image on the top half, then
// a magazine-style letter spread below with operator logo + trip title +
// meta + welcome letter + signature + contact strip. Designed for
// proposals where the cover and personal-note sections feel sparse on
// their own; the orchestrator skips the stand-alone personalNote page
// when this layout is in play.
//
//   y:0–148  hero image (full-bleed)
//   y:155    operator logo
//   y:170    trip title
//   y:188    trip meta line
//   y:200    letter body (welcome text)
//   y:248    signature image
//   y:260    advisor name + role
//   y:272    cream contact strip with photo · email · whatsapp · logo
//   y:288    brand line

export const COVER_LETTER_SPREAD: LayoutManifest = {
  id: "cover-letter-spread",
  section: "cover",
  page_count: 1,
  description:
    "Combined cover + welcome letter spread — hero up top, editorial letter and contact strip below",
  slots: [
    {
      type: "image",
      name: "hero_image",
      content_key: "heroImageUrl",
      x_mm: 0, y_mm: 0, w_mm: 210, h_mm: 148,
      object_fit: "cover",
      image_role: "hero",
      z_index: 0,
    },
    {
      type: "fill",
      name: "hero_overlay",
      x_mm: 0, y_mm: 110, w_mm: 210, h_mm: 38,
      fill: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.42) 100%)",
      z_index: 1,
    },
    {
      type: "image",
      name: "operator_logo",
      content_key: "operatorLogoUrl",
      x_mm: 18, y_mm: 156, w_mm: 32, h_mm: 12,
      object_fit: "contain",
    },
    {
      type: "text",
      name: "trip_title",
      content_key: "tripTitle",
      x_mm: 18, y_mm: 170, w_mm: 174, h_mm: 18,
      style: "h1",
      color_role: "headingText",
      max_chars: 60,
      overflow_behavior: "scale_down",
    },
    {
      type: "text",
      name: "trip_meta",
      content_pattern: "{destinations} · {dates} · {duration}",
      x_mm: 18, y_mm: 188, w_mm: 174, h_mm: 8,
      style: "eyebrow",
      color_role: "mutedText",
      max_chars: 80,
      overflow_behavior: "truncate",
    },
    {
      type: "text",
      name: "letter_body",
      content_key: "letterBody",
      x_mm: 18, y_mm: 200, w_mm: 174, h_mm: 44,
      style: "body",
      color_role: "bodyText",
      max_chars: 520,
      overflow_behavior: "truncate",
    },
    {
      type: "image",
      name: "signature_image",
      content_key: "signatureUrl",
      x_mm: 18, y_mm: 247, w_mm: 50, h_mm: 12,
      object_fit: "contain",
      image_role: "signature",
    },
    {
      type: "text",
      name: "advisor_name",
      content_key: "advisorName",
      x_mm: 18, y_mm: 261, w_mm: 90, h_mm: 6,
      style: "body",
      color_role: "headingText",
      max_chars: 40,
    },
    {
      type: "text",
      name: "advisor_title",
      content_key: "advisorTitle",
      x_mm: 18, y_mm: 267, w_mm: 90, h_mm: 5,
      style: "caption",
      color_role: "mutedText",
      max_chars: 60,
    },
    {
      type: "fill",
      name: "contact_strip_bg",
      x_mm: 0, y_mm: 274, w_mm: 210, h_mm: 23,
      fill: "sectionBg",
    },
    {
      type: "image",
      name: "advisor_image",
      content_key: "advisorImageUrl",
      x_mm: 18, y_mm: 278, w_mm: 16, h_mm: 16,
      object_fit: "cover",
    },
    {
      type: "text",
      name: "contact_email",
      content_key: "contactEmail",
      x_mm: 40, y_mm: 280, w_mm: 70, h_mm: 6,
      style: "caption",
      color_role: "bodyText",
      max_chars: 60,
      overflow_behavior: "truncate",
    },
    {
      type: "text",
      name: "contact_whatsapp",
      content_key: "contactWhatsapp",
      x_mm: 40, y_mm: 287, w_mm: 70, h_mm: 6,
      style: "caption",
      color_role: "bodyText",
      max_chars: 40,
      overflow_behavior: "truncate",
    },
    {
      type: "image",
      name: "logo_small",
      content_key: "operatorLogoUrl",
      x_mm: 160, y_mm: 280, w_mm: 32, h_mm: 12,
      object_fit: "contain",
    },
  ],
  rules: [
    "Hero locked to top half (0–148mm)",
    "Letter body truncates before signature at y:247",
    "Contact strip locked to bottom 23mm",
    "All elements fixed-position; no flow",
  ],
};

export const COVER_LAYOUTS = [
  COVER_LETTER_SPREAD,
  COVER_CINEMATIC_HERO,
  COVER_EDITORIAL_SPLIT,
  COVER_MINIMAL_LUXURY,
];
