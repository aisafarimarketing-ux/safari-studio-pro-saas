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

// ─── Variant B — Map dominant ────────────────────────────────────────────
//
// Map fills the upper two thirds of the page. Itinerary list shrinks
// to a thin band along the bottom-left; stats sit on the bottom-right.
// Use when the route shape itself is the story (long flying safaris,
// multi-country crossings).
//
//   y:18  eyebrow + section title
//   y:42–215  full-width route map
//   y:222–280  bottom band: itinerary text (left 110mm) + stats (right 80mm)
//   y:285  caption

export const TRIP_SUMMARY_MAP_DOMINANT: LayoutManifest = {
  id: "trip-summary-map-dominant",
  section: "trip_summary",
  page_count: 1,
  description: "Route-led trip summary — map dominates, itinerary + stats below",
  slots: [
    {
      type: "text",
      name: "eyebrow",
      content_key: "eyebrow",
      x_mm: 18, y_mm: 20, w_mm: 174, h_mm: 6,
      style: "eyebrow",
      color_role: "mutedText",
      max_chars: 40,
    },
    {
      type: "text",
      name: "section_title",
      content_key: "sectionTitle",
      x_mm: 18, y_mm: 28, w_mm: 174, h_mm: 12,
      style: "h2",
      color_role: "headingText",
      max_chars: 60,
    },
    {
      type: "vector",
      name: "map_image",
      payload_key: "routeMap",
      x_mm: 18, y_mm: 44, w_mm: 174, h_mm: 170,
    },
    {
      type: "text",
      name: "left_itinerary_panel",
      content_key: "itineraryText",
      x_mm: 18, y_mm: 222, w_mm: 110, h_mm: 56,
      style: "caption",
      color_role: "bodyText",
      max_chars: 700,
      overflow_behavior: "truncate",
    },
    {
      type: "fill",
      name: "stats_bg",
      x_mm: 132, y_mm: 222, w_mm: 60, h_mm: 56,
      fill: "sectionBg",
    },
    {
      type: "text",
      name: "stats_days",
      content_key: "statsDays",
      x_mm: 134, y_mm: 226, w_mm: 56, h_mm: 12,
      style: "h3",
      color_role: "headingText",
      alignment: "center",
      max_chars: 30,
    },
    {
      type: "text",
      name: "stats_stops",
      content_key: "statsStops",
      x_mm: 134, y_mm: 240, w_mm: 56, h_mm: 12,
      style: "h3",
      color_role: "headingText",
      alignment: "center",
      max_chars: 30,
    },
    {
      type: "text",
      name: "stats_lodges",
      content_key: "statsLodges",
      x_mm: 134, y_mm: 254, w_mm: 56, h_mm: 12,
      style: "h3",
      color_role: "headingText",
      alignment: "center",
      max_chars: 30,
    },
    {
      type: "text",
      name: "stats_parks",
      content_key: "statsParks",
      x_mm: 134, y_mm: 268, w_mm: 56, h_mm: 12,
      style: "h3",
      color_role: "headingText",
      alignment: "center",
      max_chars: 30,
    },
    {
      type: "text",
      name: "caption",
      content_key: "caption",
      x_mm: 18, y_mm: 285, w_mm: 174, h_mm: 8,
      style: "caption",
      color_role: "mutedText",
      alignment: "center",
      max_chars: 120,
      overflow_behavior: "truncate",
    },
  ],
  rules: [
    "Map fills 44–214mm full-width",
    "Itinerary band 222–278mm, max 700 chars (truncates if longer)",
    "Stats column 132–192mm right; itinerary column 18–128mm left",
  ],
};

// ─── Variant C — Minimal stat block (no map) ─────────────────────────────
//
// Quiet, type-led summary. No route map; just the trip headline,
// a generous stat row (DAYS · STOPS · LODGES · PARKS), and a short
// itinerary list. For trips where the route is single-country and
// the operator wants a calm "here's what you booked" page rather
// than a cartographic display.
//
//   y:30  eyebrow
//   y:42  headline (h1)
//   y:80  body intro
//   y:115–170  oversize stat row
//   y:185–268  numbered itinerary list
//   y:288  brand line

export const TRIP_SUMMARY_MINIMAL: LayoutManifest = {
  id: "trip-summary-minimal",
  section: "trip_summary",
  page_count: 1,
  description:
    "Minimal stat-led trip summary — typography only, no map, generous numbers",
  slots: [
    {
      type: "text",
      name: "eyebrow",
      content_key: "eyebrow",
      x_mm: 18, y_mm: 32, w_mm: 174, h_mm: 6,
      style: "eyebrow",
      color_role: "mutedText",
      max_chars: 40,
    },
    {
      type: "text",
      name: "section_title",
      content_key: "sectionTitle",
      x_mm: 18, y_mm: 42, w_mm: 174, h_mm: 26,
      style: "h1",
      color_role: "headingText",
      max_chars: 60,
      overflow_behavior: "scale_down",
    },
    {
      type: "text",
      name: "caption",
      content_key: "caption",
      x_mm: 18, y_mm: 78, w_mm: 174, h_mm: 14,
      style: "body",
      color_role: "mutedText",
      max_chars: 200,
      overflow_behavior: "truncate",
    },
    {
      type: "fill",
      name: "stats_bg",
      x_mm: 18, y_mm: 110, w_mm: 174, h_mm: 60,
      fill: "sectionBg",
    },
    {
      type: "text",
      name: "stats_days",
      content_key: "statsDays",
      x_mm: 22, y_mm: 122, w_mm: 41, h_mm: 36,
      style: "h1",
      color_role: "headingText",
      alignment: "center",
      max_chars: 30,
    },
    {
      type: "text",
      name: "stats_stops",
      content_key: "statsStops",
      x_mm: 65, y_mm: 122, w_mm: 41, h_mm: 36,
      style: "h1",
      color_role: "headingText",
      alignment: "center",
      max_chars: 30,
    },
    {
      type: "text",
      name: "stats_lodges",
      content_key: "statsLodges",
      x_mm: 108, y_mm: 122, w_mm: 41, h_mm: 36,
      style: "h1",
      color_role: "headingText",
      alignment: "center",
      max_chars: 30,
    },
    {
      type: "text",
      name: "stats_parks",
      content_key: "statsParks",
      x_mm: 151, y_mm: 122, w_mm: 41, h_mm: 36,
      style: "h1",
      color_role: "headingText",
      alignment: "center",
      max_chars: 30,
    },
    {
      type: "text",
      name: "left_itinerary_panel",
      content_key: "itineraryText",
      x_mm: 18, y_mm: 185, w_mm: 174, h_mm: 90,
      style: "body",
      color_role: "bodyText",
      max_chars: 1200,
      overflow_behavior: "truncate",
    },
  ],
  rules: [
    "No map — typography is the page",
    "Stats row 110–170mm, headline-sized numbers",
    "Itinerary fills the bottom band 185–275mm",
  ],
};

export const TRIP_SUMMARY_LAYOUTS = [
  TRIP_SUMMARY_EDITORIAL,    // split (default)
  TRIP_SUMMARY_MAP_DOMINANT, // map-led
  TRIP_SUMMARY_MINIMAL,      // type-led, no map
];
