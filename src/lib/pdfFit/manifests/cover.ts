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

export const COVER_LAYOUTS = [
  COVER_CINEMATIC_HERO,
  COVER_EDITORIAL_SPLIT,
  COVER_MINIMAL_LUXURY,
];
