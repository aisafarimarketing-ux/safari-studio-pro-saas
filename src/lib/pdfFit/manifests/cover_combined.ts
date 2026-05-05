import type { LayoutManifest } from "../types";

// ─── Combined cover + personal note (single A4 page) ─────────────────────
//
// Per spec: ONE A4 page with TWO fixed sections.
//   COVER         y 0 → 150mm    (height 150mm)
//   PERSONAL NOTE y 150 → 297mm  (height 147mm)
//
// Each half has its own manifest; the consumer mounts both inside one
// PdfPage and wraps each in its own SectionChrome so hover / click
// controls work independently. Deleting one section does NOT shift
// the other — coordinates are absolute.

// ─── Cover half (150mm tall, S64L default) ───────────────────────────────
//
// Image left  x:0   y:0   w:90mm  h:150mm   (object-fit cover, drag inside)
// Text right  x:90  y:0   w:120mm h:150mm   (12mm internal padding)
//
// Text content (top → bottom):
//   - Logo
//   - Title (max 3 lines)
//   - Destinations (single line, no wrap)
//   - Divider line
//   - Meta 2x2 grid: FOR | DATES / DURATION | PARTY

const COVER_H = 150;
const PANEL_X = 90;
const PANEL_W = 120;
const PAD = 12;
const INNER_X = PANEL_X + PAD;       // 102
const INNER_W = PANEL_W - PAD * 2;   // 96

export const COVER_HALF_S64L: LayoutManifest = {
  id: "cover-half-s64l",
  section: "cover",
  page_count: 1,
  description: "Combined-page cover half (top 150mm) — S64L: image left, text right",
  slots: [
    // Image container — full height of the half, draggable inside.
    {
      type: "image",
      name: "hero_image",
      content_key: "heroImageUrl",
      x_mm: 0, y_mm: 0, w_mm: 90, h_mm: COVER_H,
      object_fit: "cover",
      image_role: "hero",
      z_index: 0,
    },
    // Text panel surface — sectionSurface so the operator's section
    // bg picker repaints just this panel.
    {
      type: "fill",
      name: "text_panel_bg",
      x_mm: PANEL_X, y_mm: 0, w_mm: PANEL_W, h_mm: COVER_H,
      fill: "sectionSurface",
      z_index: 0,
    },
    // Logo top — auto-contrast chip applies via image_role detection.
    {
      type: "image",
      name: "operator_logo",
      content_key: "operatorLogoUrl",
      x_mm: INNER_X, y_mm: PAD, w_mm: 38, h_mm: 14,
      object_fit: "contain",
      image_role: "logo",
    },
    // Title — max 3 lines via slot height + scale_down overflow.
    {
      type: "text",
      name: "trip_title",
      content_key: "tripTitle",
      x_mm: INNER_X, y_mm: 38, w_mm: INNER_W, h_mm: 36,
      style: "h2",
      color_role: "headingText",
      max_chars: 90,
      overflow_behavior: "scale_down",
    },
    // Destinations — single line; truncate or scale.
    {
      type: "text",
      name: "trip_destinations",
      content_key: "tripDestinations",
      x_mm: INNER_X, y_mm: 80, w_mm: INNER_W, h_mm: 6,
      style: "eyebrow",
      color_role: "accent",
      max_chars: 120,
      overflow_behavior: "scale_down",
    },
    // Divider line under destinations.
    {
      type: "line",
      name: "header_divider",
      x_mm: INNER_X, y_mm: 92, w_mm: INNER_W, h_mm: 1,
      color_role: "border",
    },
    // Meta 2×2 grid:
    //   col1 (left)   col2 (right)
    //   FOR / value   DATES / value
    //   DURATION / .. PARTY / value
    {
      type: "text",
      name: "meta_for_label",
      x_mm: INNER_X, y_mm: 102, w_mm: 48, h_mm: 5,
      style: "eyebrow",
      color_role: "mutedText",
      max_chars: 12,
    },
    {
      type: "text",
      name: "meta_for_value",
      x_mm: INNER_X, y_mm: 109, w_mm: 48, h_mm: 8,
      style: "body",
      color_role: "headingText",
      max_chars: 60,
      overflow_behavior: "scale_down",
    },
    {
      type: "text",
      name: "meta_dates_label",
      x_mm: INNER_X + 48, y_mm: 102, w_mm: 48, h_mm: 5,
      style: "eyebrow",
      color_role: "mutedText",
      max_chars: 12,
    },
    {
      type: "text",
      name: "meta_dates_value",
      x_mm: INNER_X + 48, y_mm: 109, w_mm: 48, h_mm: 8,
      style: "body",
      color_role: "headingText",
      max_chars: 60,
      overflow_behavior: "scale_down",
    },
    {
      type: "text",
      name: "meta_duration_label",
      x_mm: INNER_X, y_mm: 124, w_mm: 48, h_mm: 5,
      style: "eyebrow",
      color_role: "mutedText",
      max_chars: 12,
    },
    {
      type: "text",
      name: "meta_duration_value",
      x_mm: INNER_X, y_mm: 131, w_mm: 48, h_mm: 8,
      style: "body",
      color_role: "headingText",
      max_chars: 60,
      overflow_behavior: "scale_down",
    },
    {
      type: "text",
      name: "meta_party_label",
      x_mm: INNER_X + 48, y_mm: 124, w_mm: 48, h_mm: 5,
      style: "eyebrow",
      color_role: "mutedText",
      max_chars: 12,
    },
    {
      type: "text",
      name: "meta_party_value",
      x_mm: INNER_X + 48, y_mm: 131, w_mm: 48, h_mm: 8,
      style: "body",
      color_role: "headingText",
      max_chars: 60,
      overflow_behavior: "scale_down",
    },
  ],
  rules: [
    "Cover height is exactly 150mm",
    "Image locked to x:0–90mm; text panel locked to x:90–210mm",
    "Title max 3 lines (36mm slot, scale_down on overflow)",
    "Destinations single line, no wrap",
    "Meta grid 2x2 within text panel padding",
  ],
};

// ─── Personal note half (147mm tall) ──────────────────────────────────────
//
// Padding 18mm left/right inside the half (so x:18, w:174 for body).
// All y values are RELATIVE to the half (subtract 150 from spec's
// absolute y values).
//
// Spec absolute → relative:
//   greeting    y:165 → 15
//   body        y:180 → 30  (max h: 60mm)
//   signature   y:245 → 95
//   name+role   y:260 → 110
//   footer band y:275-297 → 125-147 (h: 22mm)

export const PERSONAL_NOTE_HALF: LayoutManifest = {
  id: "personal-note-half",
  section: "personal_note",
  page_count: 1,
  description: "Combined-page personal note half (bottom 147mm)",
  slots: [
    // Half background — sectionSurface, sits behind everything so the
    // operator's section bg picker repaints just this half.
    {
      type: "fill",
      name: "note_panel_bg",
      x_mm: 0, y_mm: 0, w_mm: 210, h_mm: 147,
      fill: "sectionSurface",
      z_index: 0,
    },
    // Greeting — short eyebrow ("Dear Lilian," / "Karibu —")
    {
      type: "text",
      name: "note_greeting",
      content_key: "greeting",
      x_mm: 18, y_mm: 15, w_mm: 174, h_mm: 8,
      style: "h3",
      color_role: "headingText",
      max_chars: 80,
      overflow_behavior: "truncate",
    },
    // Body — main letter text. Max h: 60mm; truncate if overflow.
    {
      type: "text",
      name: "note_body",
      content_key: "body",
      x_mm: 18, y_mm: 30, w_mm: 174, h_mm: 60,
      style: "body",
      color_role: "bodyText",
      max_chars: 700,
      overflow_behavior: "truncate",
    },
    // Signature image (handwritten signature scan).
    {
      type: "image",
      name: "note_signature",
      content_key: "signatureUrl",
      x_mm: 18, y_mm: 95, w_mm: 50, h_mm: 12,
      object_fit: "contain",
      image_role: "signature",
    },
    // Name + role on a single line below the signature.
    {
      type: "text",
      name: "note_advisor_name",
      content_key: "advisorName",
      x_mm: 18, y_mm: 110, w_mm: 110, h_mm: 6,
      style: "body",
      color_role: "headingText",
      max_chars: 50,
      overflow_behavior: "truncate",
    },
    {
      type: "text",
      name: "note_advisor_role",
      content_key: "advisorRole",
      x_mm: 18, y_mm: 117, w_mm: 110, h_mm: 5,
      style: "caption",
      color_role: "mutedText",
      max_chars: 60,
      overflow_behavior: "truncate",
    },
    // Footer band — 22mm strip at bottom of the half.
    {
      type: "fill",
      name: "note_footer_bg",
      x_mm: 0, y_mm: 125, w_mm: 210, h_mm: 22,
      fill: "sectionBg",
    },
    // Left — advisor image (square, 16mm with 3mm vertical centring).
    {
      type: "image",
      name: "note_advisor_image",
      content_key: "advisorImageUrl",
      x_mm: 18, y_mm: 128, w_mm: 20, h_mm: 16,
      object_fit: "cover",
    },
    // Centre — email block (50mm).
    {
      type: "text",
      name: "note_email_label",
      content_key: "emailLabel",
      x_mm: 48, y_mm: 129, w_mm: 50, h_mm: 5,
      style: "eyebrow",
      color_role: "mutedText",
      max_chars: 12,
    },
    {
      type: "text",
      name: "note_email_value",
      content_key: "emailValue",
      x_mm: 48, y_mm: 135, w_mm: 50, h_mm: 9,
      style: "caption",
      color_role: "bodyText",
      max_chars: 60,
      overflow_behavior: "scale_down",
    },
    // Centre — whatsapp block (50mm).
    {
      type: "text",
      name: "note_whatsapp_label",
      content_key: "whatsappLabel",
      x_mm: 104, y_mm: 129, w_mm: 50, h_mm: 5,
      style: "eyebrow",
      color_role: "mutedText",
      max_chars: 12,
    },
    {
      type: "text",
      name: "note_whatsapp_value",
      content_key: "whatsappValue",
      x_mm: 104, y_mm: 135, w_mm: 50, h_mm: 9,
      style: "caption",
      color_role: "bodyText",
      max_chars: 40,
      overflow_behavior: "scale_down",
    },
    // Right — company logo, auto-contrast chip via image_role.
    {
      type: "image",
      name: "note_company_logo",
      content_key: "operatorLogoUrl",
      x_mm: 162, y_mm: 130, w_mm: 30, h_mm: 12,
      object_fit: "contain",
      image_role: "logo",
    },
  ],
  rules: [
    "Personal note height is exactly 147mm",
    "Body truncates after 700 chars (60mm slot height)",
    "Footer band locked to y:125-147 within the half",
    "Three footer columns: advisor image left, email+whatsapp centre, logo right",
  ],
};
