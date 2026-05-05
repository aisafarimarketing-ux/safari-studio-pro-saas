import type { LayoutManifest } from "../types";

// ─── Closing / farewell layout manifest ───────────────────────────────────
//
// Final editorial "thank you / let's book" page. Hero photo across the
// top half, then a contact card with primary CTA + 3 contact rows, and
// trust badges underneath. Slot names align with the closing variant
// registry entries (bold_cta / calm_luxury / editorial_end).
//
//   y:0–145   hero_image
//   y:155     eyebrow
//   y:163     headline (h1)
//   y:188     body intro
//   y:210     primary_cta block (booking text)
//   y:230     secondary_cta_1 (email row)
//   y:240     secondary_cta_2 (whatsapp row)
//   y:250     secondary_cta_3 (website row)
//   y:264     trust badges (3 lines)
//   y:288     brand line

export const CLOSING_FAREWELL: LayoutManifest = {
  id: "closing-farewell",
  section: "closing",
  page_count: 1,
  description:
    "Editorial closing page — hero image + contact card + trust badges",
  slots: [
    {
      type: "image",
      name: "hero_image",
      content_key: "heroImageUrl",
      x_mm: 0, y_mm: 0, w_mm: 210, h_mm: 145,
      object_fit: "cover",
      image_role: "hero",
      z_index: 0,
    },
    {
      type: "fill",
      name: "hero_overlay",
      x_mm: 0, y_mm: 100, w_mm: 210, h_mm: 45,
      fill: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.45) 100%)",
      z_index: 1,
    },
    {
      type: "text",
      name: "eyebrow",
      content_key: "eyebrow",
      x_mm: 18, y_mm: 155, w_mm: 174, h_mm: 8,
      style: "eyebrow",
      color_role: "mutedText",
      max_chars: 40,
    },
    {
      type: "text",
      name: "headline",
      content_key: "headline",
      x_mm: 18, y_mm: 163, w_mm: 174, h_mm: 24,
      style: "h1",
      color_role: "headingText",
      max_chars: 60,
    },
    {
      type: "text",
      name: "body_intro",
      content_key: "bodyIntro",
      x_mm: 18, y_mm: 188, w_mm: 174, h_mm: 20,
      style: "body",
      color_role: "bodyText",
      max_chars: 240,
      overflow_behavior: "truncate",
    },
    {
      type: "text",
      name: "primary_cta",
      content_key: "primaryCta",
      x_mm: 18, y_mm: 212, w_mm: 174, h_mm: 14,
      style: "button_primary",
      color_role: "headingText",
      max_chars: 90,
      overflow_behavior: "truncate",
    },
    {
      type: "text",
      name: "secondary_cta_1",
      content_key: "secondaryCta1",
      x_mm: 18, y_mm: 230, w_mm: 174, h_mm: 8,
      style: "caption",
      color_role: "bodyText",
      max_chars: 80,
      overflow_behavior: "truncate",
    },
    {
      type: "text",
      name: "secondary_cta_2",
      content_key: "secondaryCta2",
      x_mm: 18, y_mm: 240, w_mm: 174, h_mm: 8,
      style: "caption",
      color_role: "bodyText",
      max_chars: 80,
      overflow_behavior: "truncate",
    },
    {
      type: "text",
      name: "secondary_cta_3",
      content_key: "secondaryCta3",
      x_mm: 18, y_mm: 250, w_mm: 174, h_mm: 8,
      style: "caption",
      color_role: "bodyText",
      max_chars: 80,
      overflow_behavior: "truncate",
    },
    {
      type: "text",
      name: "trust_badges",
      content_key: "trustBadges",
      x_mm: 18, y_mm: 264, w_mm: 174, h_mm: 22,
      style: "caption",
      color_role: "mutedText",
      max_chars: 240,
      overflow_behavior: "truncate",
    },
    {
      type: "text",
      name: "brand_line",
      content_key: "brandLine",
      x_mm: 18, y_mm: 288, w_mm: 174, h_mm: 6,
      style: "eyebrow",
      color_role: "mutedText",
      alignment: "center",
      max_chars: 80,
      overflow_behavior: "truncate",
    },
  ],
  rules: [
    "Hero locked to top half (0–145mm) — never grows into the contact card",
    "All contact rows truncate; never wrap to new lines",
    "Trust badges share one block; no per-badge slot growth",
    "Brand line fixed to bottom 4mm strip",
  ],
};

// ─── Variant B — Cinematic emotional close (full-bleed photo) ────────────
//
// Hero photograph fills the upper two thirds (y:0-220mm). A short
// headline + 1–2 line message overlay a soft gradient at the bottom
// of the photo. CTA strip + brand line fill the lower third.
//
//   y:0-220   hero_image full bleed
//   y:160-220 dark gradient over lower portion of photo
//   y:170     headline overlay (white)
//   y:198     body intro (white)
//   y:220-297 cream caption strip (77mm tall) with CTAs + brand line
//   y:240     primary CTA (h2 centered)
//   y:264     secondary contact rows (email / whatsapp / website)
//   y:288     brand line

export const CLOSING_CINEMATIC: LayoutManifest = {
  id: "closing-cinematic",
  section: "closing",
  page_count: 1,
  description:
    "Cinematic emotional close — large photograph fills the page, short message + CTA below",
  slots: [
    {
      type: "image",
      name: "hero_image",
      content_key: "heroImageUrl",
      x_mm: 0, y_mm: 0, w_mm: 210, h_mm: 220,
      object_fit: "cover",
      image_role: "hero",
      z_index: 0,
    },
    {
      type: "fill",
      name: "hero_gradient",
      x_mm: 0, y_mm: 140, w_mm: 210, h_mm: 80,
      fill: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.62) 100%)",
      z_index: 1,
    },
    {
      type: "text",
      name: "eyebrow",
      content_key: "eyebrow",
      x_mm: 18, y_mm: 162, w_mm: 174, h_mm: 5,
      style: "eyebrow",
      color_role: "white",
      size_pt: 9,
      letter_spacing_em: 0.18,
      uppercase: true,
      max_chars: 40,
      z_index: 2,
    },
    {
      type: "text",
      name: "headline",
      content_key: "headline",
      x_mm: 18, y_mm: 172, w_mm: 174, h_mm: 22,
      style: "h1",
      color_role: "white",
      size_pt: 30,
      line_height: 1.05,
      font_weight: 700,
      max_chars: 60,
      overflow_behavior: "scale_down",
      z_index: 2,
    },
    {
      type: "text",
      name: "body_intro",
      content_key: "bodyIntro",
      x_mm: 18, y_mm: 198, w_mm: 174, h_mm: 16,
      style: "body",
      color_role: "white",
      size_pt: 12,
      line_height: 1.4,
      max_chars: 200,
      overflow_behavior: "truncate",
      z_index: 2,
    },
    {
      type: "fill",
      name: "caption_bg",
      x_mm: 0, y_mm: 220, w_mm: 210, h_mm: 77,
      fill: "sectionBg",
    },
    {
      type: "text",
      name: "primary_cta",
      content_key: "primaryCta",
      x_mm: 18, y_mm: 234, w_mm: 174, h_mm: 14,
      style: "h2",
      color_role: "headingText",
      size_pt: 18,
      line_height: 1.1,
      font_weight: 700,
      alignment: "center",
      max_chars: 90,
      overflow_behavior: "truncate",
    },
    {
      type: "text",
      name: "secondary_cta_1",
      content_key: "secondaryCta1",
      x_mm: 18, y_mm: 256, w_mm: 174, h_mm: 6,
      style: "caption",
      color_role: "bodyText",
      size_pt: 10,
      alignment: "center",
      max_chars: 80,
      overflow_behavior: "truncate",
    },
    {
      type: "text",
      name: "secondary_cta_2",
      content_key: "secondaryCta2",
      x_mm: 18, y_mm: 264, w_mm: 174, h_mm: 6,
      style: "caption",
      color_role: "bodyText",
      size_pt: 10,
      alignment: "center",
      max_chars: 80,
      overflow_behavior: "truncate",
    },
    {
      type: "text",
      name: "secondary_cta_3",
      content_key: "secondaryCta3",
      x_mm: 18, y_mm: 272, w_mm: 174, h_mm: 6,
      style: "caption",
      color_role: "bodyText",
      size_pt: 10,
      alignment: "center",
      max_chars: 80,
      overflow_behavior: "truncate",
    },
    {
      type: "text",
      name: "brand_line",
      content_key: "brandLine",
      x_mm: 18, y_mm: 288, w_mm: 174, h_mm: 6,
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
    "Hero photograph fills 0–220mm; gradient ensures headline legibility",
    "Caption strip 220–297mm carries CTA + contact rows + brand line",
    "Section fills full A4 page (297mm)",
  ],
};

// ─── Variant C — Minimal centered (typography-led, no hero) ──────────────
//
// Quiet, paper-led close. No hero photograph; just a small operator
// logo, a centered headline, a short message, primary CTA, and
// contact rows — all centered on a vertical axis. Fills the page with
// generous whitespace per editorial luxury convention.

export const CLOSING_MINIMAL: LayoutManifest = {
  id: "closing-minimal",
  section: "closing",
  page_count: 1,
  description:
    "Minimal centered close — typography-led farewell with no hero image",
  slots: [
    {
      type: "fill",
      name: "section_bg",
      x_mm: 0, y_mm: 0, w_mm: 210, h_mm: 297,
      fill: "sectionSurface",
      z_index: 0,
    },
    {
      type: "image",
      name: "operator_logo",
      content_key: "operatorLogoUrl",
      x_mm: 75, y_mm: 60, w_mm: 60, h_mm: 18,
      object_fit: "contain",
      image_role: "logo",
    },
    {
      type: "text",
      name: "eyebrow",
      content_key: "eyebrow",
      x_mm: 30, y_mm: 96, w_mm: 150, h_mm: 6,
      style: "eyebrow",
      color_role: "mutedText",
      size_pt: 10,
      letter_spacing_em: 0.18,
      uppercase: true,
      alignment: "center",
      max_chars: 60,
    },
    {
      type: "text",
      name: "headline",
      content_key: "headline",
      x_mm: 25, y_mm: 110, w_mm: 160, h_mm: 36,
      style: "h1",
      color_role: "headingText",
      size_pt: 36,
      line_height: 1.1,
      font_weight: 700,
      letter_spacing_em: -0.015,
      alignment: "center",
      max_chars: 80,
      overflow_behavior: "scale_down",
    },
    {
      type: "text",
      name: "body_intro",
      content_key: "bodyIntro",
      x_mm: 35, y_mm: 156, w_mm: 140, h_mm: 36,
      style: "body",
      color_role: "bodyText",
      size_pt: 12,
      line_height: 1.55,
      alignment: "center",
      max_chars: 320,
      overflow_behavior: "truncate",
    },
    {
      type: "fill",
      name: "cta_divider",
      x_mm: 90, y_mm: 200, w_mm: 30, h_mm: 0.4,
      fill: "border",
      opacity: 0.5,
    },
    {
      type: "text",
      name: "primary_cta",
      content_key: "primaryCta",
      x_mm: 25, y_mm: 210, w_mm: 160, h_mm: 14,
      style: "h2",
      color_role: "headingText",
      size_pt: 18,
      line_height: 1.1,
      font_weight: 700,
      alignment: "center",
      max_chars: 90,
      overflow_behavior: "truncate",
    },
    {
      type: "text",
      name: "secondary_cta_1",
      content_key: "secondaryCta1",
      x_mm: 30, y_mm: 234, w_mm: 150, h_mm: 6,
      style: "caption",
      color_role: "bodyText",
      size_pt: 10,
      alignment: "center",
      max_chars: 80,
      overflow_behavior: "truncate",
    },
    {
      type: "text",
      name: "secondary_cta_2",
      content_key: "secondaryCta2",
      x_mm: 30, y_mm: 244, w_mm: 150, h_mm: 6,
      style: "caption",
      color_role: "bodyText",
      size_pt: 10,
      alignment: "center",
      max_chars: 80,
      overflow_behavior: "truncate",
    },
    {
      type: "text",
      name: "secondary_cta_3",
      content_key: "secondaryCta3",
      x_mm: 30, y_mm: 254, w_mm: 150, h_mm: 6,
      style: "caption",
      color_role: "bodyText",
      size_pt: 10,
      alignment: "center",
      max_chars: 80,
      overflow_behavior: "truncate",
    },
    {
      type: "text",
      name: "trust_badges",
      content_key: "trustBadges",
      x_mm: 30, y_mm: 268, w_mm: 150, h_mm: 16,
      style: "caption",
      color_role: "mutedText",
      size_pt: 9,
      line_height: 1.5,
      alignment: "center",
      max_chars: 200,
      overflow_behavior: "truncate",
    },
    {
      type: "text",
      name: "brand_line",
      content_key: "brandLine",
      x_mm: 18, y_mm: 288, w_mm: 174, h_mm: 6,
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
    "No hero photograph — typography carries the page",
    "Centered composition; everything aligns to a single vertical axis",
    "Section fills full A4 page (297mm)",
  ],
};

export const CLOSING_LAYOUTS = [
  CLOSING_FAREWELL,
  CLOSING_CINEMATIC,
  CLOSING_MINIMAL,
];
