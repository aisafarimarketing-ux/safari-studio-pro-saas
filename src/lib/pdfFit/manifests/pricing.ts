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

export const PRICING_LAYOUTS = [PRICING_STANDARD];
