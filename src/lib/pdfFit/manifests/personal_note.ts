import type { LayoutManifest } from "../types";

// ─── Personal note layout manifest ─────────────────────────────────────────
//
// Two-zone layout:
//
//   ┌────────────────────────────────────────┐
//   │  Letter body (174mm × 150mm)           │  y:28–178
//   │                                        │
//   │  Signature image (60×20mm)             │  y:180
//   │                                        │
//   │  Advisor name                          │  y:205
//   │  Advisor title                         │  y:215
//   ├────────────────────────────────────────┤
//   │ ░░ section bg fill ░░                   │  y:235–297
//   │  ┌────┐                                │
//   │  │ 30x│   email          whatsapp      │
//   │  │ 30 │                                │
//   │  └────┘                       logo     │
//   └────────────────────────────────────────┘
//
// Contact strip is stylistically separate from the letter — section
// bg (cream/dark variant) anchors it visually without forcing the
// letter into a panel of its own.

export const PERSONAL_NOTE_WEBSTYLE_FIXED: LayoutManifest = {
  id: "personal-note-webstyle-fixed",
  section: "personal_note",
  page_count: 1,
  description:
    "Letter body on top half; signed-by + contact strip on the bottom band",
  slots: [
    {
      type: "text",
      name: "main_text_block",
      content_key: "body",
      x_mm: 18, y_mm: 28, w_mm: 174, h_mm: 150,
      style: "body",
      color_role: "bodyText",
      max_chars: 700,
      overflow_behavior: "truncate",
    },
    {
      type: "image",
      name: "signature_image",
      content_key: "signatureUrl",
      x_mm: 18, y_mm: 180, w_mm: 60, h_mm: 20,
      object_fit: "contain",
      image_role: "signature",
    },
    {
      type: "text",
      name: "advisor_name",
      content_key: "advisorName",
      x_mm: 18, y_mm: 205, w_mm: 120, h_mm: 10,
      style: "body",
      color_role: "headingText",
    },
    {
      type: "text",
      name: "advisor_title",
      content_key: "advisorTitle",
      x_mm: 18, y_mm: 215, w_mm: 120, h_mm: 10,
      style: "caption",
      color_role: "mutedText",
    },
    {
      type: "fill",
      name: "bottom_block_bg",
      x_mm: 0, y_mm: 235, w_mm: 210, h_mm: 62,
      fill: "sectionBg",
    },
    {
      type: "image",
      name: "advisor_image",
      content_key: "advisorImageUrl",
      x_mm: 18, y_mm: 245, w_mm: 30, h_mm: 30,
      object_fit: "cover",
    },
    {
      type: "text",
      name: "contact_email",
      content_key: "contactEmail",
      x_mm: 60, y_mm: 250, w_mm: 60, h_mm: 20,
      style: "caption",
      color_role: "bodyText",
      max_chars: 60,
      overflow_behavior: "truncate",
    },
    {
      type: "text",
      name: "contact_whatsapp",
      content_key: "contactWhatsapp",
      x_mm: 125, y_mm: 250, w_mm: 60, h_mm: 20,
      style: "caption",
      color_role: "bodyText",
      max_chars: 40,
      overflow_behavior: "truncate",
    },
    {
      type: "image",
      name: "logo_small",
      content_key: "operatorLogoUrl",
      x_mm: 160, y_mm: 270, w_mm: 32, h_mm: 12,
      object_fit: "contain",
    },
  ],
  rules: [
    "Bottom block must stay within y_mm 235–297",
    "No element crosses into bottom block from above",
    "Main text must truncate before y_mm 180",
    "All elements fixed position (no flow layout)",
    "No buttons — render as styled text blocks for PDF",
  ],
};

export const PERSONAL_NOTE_LAYOUTS = [PERSONAL_NOTE_WEBSTYLE_FIXED];
