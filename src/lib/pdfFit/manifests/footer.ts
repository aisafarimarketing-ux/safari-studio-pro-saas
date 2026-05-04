import type { LayoutManifest } from "../types";

// ─── Footer / contact strip layout manifest ───────────────────────────────
//
// Compact contact-card page rendered last. Operator logo + 3 contact
// rows + brand line. Single page; intentionally short — most of the
// emotional contact lives on the closing page; this one is the
// "leave-behind" reference card for the guest.
//
//   y:30   operator_logo (centered)
//   y:55   company_name
//   y:65   tagline
//   y:90   address_block
//   y:120  email_row
//   y:130  phone_row
//   y:140  whatsapp_row
//   y:150  website_row
//   y:175  divider
//   y:185  closing_line
//   y:288  brand_line

export const FOOTER_CONTACT_CARD: LayoutManifest = {
  id: "footer-contact-card",
  section: "footer",
  page_count: 1,
  description: "Operator contact card with logo, addresses, and brand line",
  slots: [
    {
      type: "image",
      name: "operator_logo",
      content_key: "operatorLogoUrl",
      x_mm: 75, y_mm: 30, w_mm: 60, h_mm: 20,
      object_fit: "contain",
    },
    {
      type: "text",
      name: "company_name",
      content_key: "companyName",
      x_mm: 18, y_mm: 55, w_mm: 174, h_mm: 10,
      style: "h3",
      color_role: "headingText",
      alignment: "center",
      max_chars: 60,
    },
    {
      type: "text",
      name: "tagline",
      content_key: "tagline",
      x_mm: 18, y_mm: 67, w_mm: 174, h_mm: 8,
      style: "eyebrow",
      color_role: "mutedText",
      alignment: "center",
      max_chars: 80,
    },
    {
      type: "text",
      name: "address_block",
      content_key: "addressBlock",
      x_mm: 18, y_mm: 90, w_mm: 174, h_mm: 22,
      style: "body",
      color_role: "bodyText",
      alignment: "center",
      max_chars: 200,
      overflow_behavior: "truncate",
    },
    {
      type: "text",
      name: "email_row",
      content_key: "emailRow",
      x_mm: 18, y_mm: 120, w_mm: 174, h_mm: 8,
      style: "caption",
      color_role: "bodyText",
      alignment: "center",
      max_chars: 80,
      overflow_behavior: "truncate",
    },
    {
      type: "text",
      name: "phone_row",
      content_key: "phoneRow",
      x_mm: 18, y_mm: 130, w_mm: 174, h_mm: 8,
      style: "caption",
      color_role: "bodyText",
      alignment: "center",
      max_chars: 80,
      overflow_behavior: "truncate",
    },
    {
      type: "text",
      name: "whatsapp_row",
      content_key: "whatsappRow",
      x_mm: 18, y_mm: 140, w_mm: 174, h_mm: 8,
      style: "caption",
      color_role: "bodyText",
      alignment: "center",
      max_chars: 80,
      overflow_behavior: "truncate",
    },
    {
      type: "text",
      name: "website_row",
      content_key: "websiteRow",
      x_mm: 18, y_mm: 150, w_mm: 174, h_mm: 8,
      style: "caption",
      color_role: "bodyText",
      alignment: "center",
      max_chars: 80,
      overflow_behavior: "truncate",
    },
    {
      type: "line",
      name: "divider",
      x_mm: 80, y_mm: 178, w_mm: 50, h_mm: 1,
      color_role: "border",
    },
    {
      type: "text",
      name: "closing_line",
      content_key: "closingLine",
      x_mm: 18, y_mm: 185, w_mm: 174, h_mm: 16,
      style: "body",
      color_role: "bodyText",
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
      alignment: "center",
      max_chars: 80,
      overflow_behavior: "truncate",
    },
  ],
  rules: [
    "All slots fixed-position; nothing reflows",
    "Contact rows truncate, never wrap",
    "Brand line fixed to bottom 4mm strip",
  ],
};

export const FOOTER_LAYOUTS = [FOOTER_CONTACT_CARD];
