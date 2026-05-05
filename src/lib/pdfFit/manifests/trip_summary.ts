import type { LayoutManifest } from "../types";

// ─── Trip summary layout manifest ─────────────────────────────────────────
//
// Editorial "at a glance" page — left itinerary panel + right route map
// + 4-stat strip across the bottom. Slot names match the variant
// registry (map_focus / list_focus / balanced) so variant adjustments
// resolve cleanly.
//
//   y:20  eyebrow                             "Trip summary"
//   y:28  section_title                       "At a glance"
//   y:50–225  left_itinerary_panel  (88mm)   list of stops
//   y:50–225  map_image            (88mm)   route map
//   y:240–275 stats row (4 cells, 42mm each, 4mm gaps)
//   y:282     caption
//
// All slots fixed-position; long stop lists truncate inside the
// itinerary panel rather than overflowing.

export const TRIP_SUMMARY_EDITORIAL: LayoutManifest = {
  id: "trip-summary-editorial",
  section: "trip_summary",
  page_count: 1,
  description:
    "Editorial trip summary with itinerary list, route map, and 4-stat strip",
  slots: [
    {
      type: "text",
      name: "eyebrow",
      content_key: "eyebrow",
      x_mm: 18, y_mm: 20, w_mm: 174, h_mm: 8,
      style: "eyebrow",
      color_role: "mutedText",
      max_chars: 40,
    },
    {
      type: "text",
      name: "section_title",
      content_key: "sectionTitle",
      x_mm: 18, y_mm: 28, w_mm: 174, h_mm: 14,
      style: "h2",
      color_role: "headingText",
      max_chars: 50,
    },
    {
      type: "text",
      name: "left_itinerary_panel",
      content_key: "itineraryText",
      x_mm: 18, y_mm: 50, w_mm: 80, h_mm: 175,
      style: "body",
      color_role: "bodyText",
      max_chars: 1200,
      overflow_behavior: "truncate",
    },
    {
      type: "vector",
      name: "map_image",
      payload_key: "routeMap",
      x_mm: 106, y_mm: 50, w_mm: 86, h_mm: 175,
    },
    {
      type: "fill",
      name: "stats_bg",
      x_mm: 18, y_mm: 240, w_mm: 174, h_mm: 35,
      fill: "sectionBg",
    },
    {
      type: "text",
      name: "stats_days",
      content_key: "statsDays",
      x_mm: 22, y_mm: 247, w_mm: 41, h_mm: 22,
      style: "h3",
      color_role: "headingText",
      alignment: "center",
      max_chars: 30,
    },
    {
      type: "text",
      name: "stats_stops",
      content_key: "statsStops",
      x_mm: 65, y_mm: 247, w_mm: 41, h_mm: 22,
      style: "h3",
      color_role: "headingText",
      alignment: "center",
      max_chars: 30,
    },
    {
      type: "text",
      name: "stats_lodges",
      content_key: "statsLodges",
      x_mm: 108, y_mm: 247, w_mm: 41, h_mm: 22,
      style: "h3",
      color_role: "headingText",
      alignment: "center",
      max_chars: 30,
    },
    {
      type: "text",
      name: "stats_parks",
      content_key: "statsParks",
      x_mm: 151, y_mm: 247, w_mm: 41, h_mm: 22,
      style: "h3",
      color_role: "headingText",
      alignment: "center",
      max_chars: 30,
    },
    {
      type: "text",
      name: "caption",
      content_key: "caption",
      x_mm: 18, y_mm: 282, w_mm: 174, h_mm: 8,
      style: "caption",
      color_role: "mutedText",
      alignment: "center",
      max_chars: 120,
      overflow_behavior: "truncate",
    },
  ],
  rules: [
    "Itinerary panel and map share the body band 50–225mm",
    "Stat strip locked to bottom band 240–275mm",
    "Long itineraries must truncate inside the left panel",
    "No element crosses panel boundaries",
  ],
};

export const TRIP_SUMMARY_LAYOUTS = [TRIP_SUMMARY_EDITORIAL];
