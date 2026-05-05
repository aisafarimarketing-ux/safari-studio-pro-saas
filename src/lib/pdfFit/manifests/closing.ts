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

export const CLOSING_LAYOUTS = [CLOSING_FAREWELL];
