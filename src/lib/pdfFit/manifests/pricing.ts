import type { LayoutManifest } from "../types";

// ─── Pricing layout manifest ───────────────────────────────────────────────
//
// Standard pricing card:
//
//   Section title (h2)                    y:20
//   Section intro                         y:38
//   ┌────────────────────────────────────┐
//   │ pricing table bg (cream / dark)    │ y:55–105
//   │   row_1: label · calc · total      │ y:65
//   │   row_2: label · calc · total      │ y:80
//   │   GRAND TOTAL (right-aligned, h3)  │ y:100
//   └────────────────────────────────────┘
//   Included list ─────│ Excluded list   │ y:120–200
//   Payment block  ────│ Cancellation    │ y:205–255
//   Footer notes (full width)              y:260–290

export const PRICING_STANDARD: LayoutManifest = {
  id: "pricing-standard",
  section: "pricing",
  page_count: 1,
  description:
    "Editorial pricing card with table + included/excluded columns + payment + cancellation",
  slots: [
    {
      type: "text",
      name: "section_title",
      content_key: "sectionTitle",
      x_mm: 18, y_mm: 20, w_mm: 174, h_mm: 16,
      style: "h2",
      color_role: "headingText",
      max_chars: 60,
    },
    {
      type: "text",
      name: "section_intro",
      content_key: "sectionIntro",
      x_mm: 18, y_mm: 38, w_mm: 174, h_mm: 12,
      style: "caption",
      color_role: "mutedText",
      max_chars: 140,
    },
    {
      type: "fill",
      name: "pricing_table_bg",
      x_mm: 18, y_mm: 55, w_mm: 174, h_mm: 50,
      fill: "sectionBg",
    },
    {
      type: "text",
      name: "row_1_label",
      content_key: "row1Label",
      x_mm: 25, y_mm: 65, w_mm: 80, h_mm: 10,
      style: "body",
      color_role: "bodyText",
      max_chars: 40,
    },
    {
      type: "text",
      name: "row_1_calc",
      content_key: "row1Calc",
      x_mm: 110, y_mm: 65, w_mm: 40, h_mm: 10,
      style: "body",
      color_role: "mutedText",
      alignment: "right",
    },
    {
      type: "text",
      name: "row_1_total",
      content_key: "row1Total",
      x_mm: 150, y_mm: 65, w_mm: 35, h_mm: 10,
      style: "body",
      color_role: "headingText",
      alignment: "right",
    },
    {
      type: "text",
      name: "row_2_label",
      content_key: "row2Label",
      x_mm: 25, y_mm: 80, w_mm: 80, h_mm: 10,
      style: "body",
      color_role: "bodyText",
    },
    {
      type: "text",
      name: "row_2_calc",
      content_key: "row2Calc",
      x_mm: 110, y_mm: 80, w_mm: 40, h_mm: 10,
      style: "body",
      color_role: "mutedText",
      alignment: "right",
    },
    {
      type: "text",
      name: "row_2_total",
      content_key: "row2Total",
      x_mm: 150, y_mm: 80, w_mm: 35, h_mm: 10,
      style: "body",
      color_role: "headingText",
      alignment: "right",
    },
    {
      type: "text",
      name: "grand_total",
      content_key: "grandTotal",
      x_mm: 25, y_mm: 100, w_mm: 160, h_mm: 12,
      style: "h3",
      color_role: "headingText",
      alignment: "right",
    },
    {
      type: "text",
      name: "included_list",
      content_key: "includedList",
      x_mm: 18, y_mm: 120, w_mm: 80, h_mm: 80,
      style: "caption",
      color_role: "bodyText",
      max_chars: 500,
      overflow_behavior: "truncate",
    },
    {
      type: "text",
      name: "excluded_list",
      content_key: "excludedList",
      x_mm: 110, y_mm: 120, w_mm: 80, h_mm: 80,
      style: "caption",
      color_role: "bodyText",
      max_chars: 500,
      overflow_behavior: "truncate",
    },
    {
      type: "text",
      name: "payment_block",
      content_key: "paymentBlock",
      x_mm: 18, y_mm: 205, w_mm: 80, h_mm: 50,
      style: "caption",
      color_role: "bodyText",
      max_chars: 300,
    },
    {
      type: "text",
      name: "cancellation_block",
      content_key: "cancellationBlock",
      x_mm: 110, y_mm: 205, w_mm: 80, h_mm: 50,
      style: "caption",
      color_role: "bodyText",
      max_chars: 300,
    },
    {
      type: "text",
      name: "footer_blocks",
      content_key: "footerBlocks",
      x_mm: 18, y_mm: 260, w_mm: 174, h_mm: 30,
      style: "caption",
      color_role: "mutedText",
      max_chars: 300,
    },
  ],
  rules: [
    "Table rows must not exceed allocated height",
    "All numeric columns right-aligned",
    "Included and excluded lists must not exceed 80mm height",
    "No auto column stacking",
    "Bottom blocks fixed to y_mm 205–297",
    "Overflow truncates with warning",
  ],
};

// ─── Variant B — Emphasized total (price feels important) ────────────────
//
// The grand total is the visual centre. A large display-typography
// total card sits in the upper third; rows + included/excluded lists
// fall under it. Use when negotiated price is the proposal's main
// hook (signature trips, returning-guest deals, time-limited holds).
//
//   y:18  eyebrow + section title
//   y:42–115  large total card with currency + amount (display sized)
//   y:122–155  row breakdown (compact)
//   y:170–235  included / not included two-column
//   y:245–278  payment + cancellation two-column
//   y:285  footer note

export const PRICING_EMPHASIZED_TOTAL: LayoutManifest = {
  id: "pricing-emphasized-total",
  section: "pricing",
  page_count: 1,
  description: "Total-emphasized pricing — large grand-total card on top",
  slots: [
    {
      type: "text",
      name: "section_title",
      content_key: "sectionTitle",
      x_mm: 18, y_mm: 20, w_mm: 174, h_mm: 12,
      style: "eyebrow",
      color_role: "mutedText",
      max_chars: 60,
    },
    {
      type: "fill",
      name: "total_card_bg",
      x_mm: 18, y_mm: 38, w_mm: 174, h_mm: 78,
      fill: "sectionBg",
    },
    {
      type: "text",
      name: "total_label",
      content_key: "totalLabel",
      x_mm: 24, y_mm: 48, w_mm: 162, h_mm: 8,
      style: "eyebrow",
      color_role: "mutedText",
      max_chars: 30,
    },
    {
      type: "text",
      name: "grand_total",
      content_key: "grandTotal",
      x_mm: 24, y_mm: 60, w_mm: 162, h_mm: 36,
      style: "h1",
      color_role: "headingText",
      max_chars: 40,
      overflow_behavior: "scale_down",
    },
    {
      type: "text",
      name: "section_intro",
      content_key: "sectionIntro",
      x_mm: 24, y_mm: 100, w_mm: 162, h_mm: 12,
      style: "caption",
      color_role: "mutedText",
      max_chars: 160,
    },
    {
      type: "text",
      name: "row_1_label",
      content_key: "row1Label",
      x_mm: 18, y_mm: 124, w_mm: 80, h_mm: 8,
      style: "caption",
      color_role: "bodyText",
      max_chars: 40,
    },
    {
      type: "text",
      name: "row_1_calc",
      content_key: "row1Calc",
      x_mm: 100, y_mm: 124, w_mm: 50, h_mm: 8,
      style: "caption",
      color_role: "mutedText",
      alignment: "right",
    },
    {
      type: "text",
      name: "row_1_total",
      content_key: "row1Total",
      x_mm: 152, y_mm: 124, w_mm: 40, h_mm: 8,
      style: "caption",
      color_role: "headingText",
      alignment: "right",
    },
    {
      type: "text",
      name: "row_2_label",
      content_key: "row2Label",
      x_mm: 18, y_mm: 134, w_mm: 80, h_mm: 8,
      style: "caption",
      color_role: "bodyText",
    },
    {
      type: "text",
      name: "row_2_calc",
      content_key: "row2Calc",
      x_mm: 100, y_mm: 134, w_mm: 50, h_mm: 8,
      style: "caption",
      color_role: "mutedText",
      alignment: "right",
    },
    {
      type: "text",
      name: "row_2_total",
      content_key: "row2Total",
      x_mm: 152, y_mm: 134, w_mm: 40, h_mm: 8,
      style: "caption",
      color_role: "headingText",
      alignment: "right",
    },
    {
      type: "text",
      name: "included_list",
      content_key: "includedList",
      x_mm: 18, y_mm: 165, w_mm: 80, h_mm: 70,
      style: "caption",
      color_role: "bodyText",
      max_chars: 500,
      overflow_behavior: "truncate",
    },
    {
      type: "text",
      name: "excluded_list",
      content_key: "excludedList",
      x_mm: 110, y_mm: 165, w_mm: 80, h_mm: 70,
      style: "caption",
      color_role: "bodyText",
      max_chars: 500,
      overflow_behavior: "truncate",
    },
    {
      type: "text",
      name: "payment_block",
      content_key: "paymentBlock",
      x_mm: 18, y_mm: 245, w_mm: 80, h_mm: 36,
      style: "caption",
      color_role: "bodyText",
      max_chars: 300,
    },
    {
      type: "text",
      name: "cancellation_block",
      content_key: "cancellationBlock",
      x_mm: 110, y_mm: 245, w_mm: 80, h_mm: 36,
      style: "caption",
      color_role: "bodyText",
      max_chars: 300,
    },
    {
      type: "text",
      name: "footer_blocks",
      content_key: "footerBlocks",
      x_mm: 18, y_mm: 285, w_mm: 174, h_mm: 8,
      style: "caption",
      color_role: "mutedText",
      max_chars: 200,
    },
  ],
  rules: [
    "Total card 38–116mm; grand total at h1 sized to the card",
    "Row breakdown is compact (8mm rows)",
    "Two-column lists 165–235mm; payment + cancellation 245–281mm",
  ],
};

export const PRICING_LAYOUTS = [
  PRICING_STANDARD,
  PRICING_EMPHASIZED_TOTAL,
];
