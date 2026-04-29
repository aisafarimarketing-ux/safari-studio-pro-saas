// ─── Safari park boundaries — simplified polygon overlays ─────────────
//
// Approximate polygon outlines for the major East African safari parks.
// Used by RouteMap to draw each park as a translucent green region under
// the day markers — so clients see the TRUE relative size of each park
// (Serengeti is enormous, Lake Manyara is a thin strip, etc.) instead of
// just identical pin dots on a flat basemap.
//
// These polygons are intentionally LOW-fidelity (8-16 vertices each).
// They convey scale and rough shape — they're not GIS reference data.
// The atlas feel matters more than centimetre accuracy.
//
// Format: each entry has
//   - `match`: regex applied to the operator's destination string
//   - `name`: display label (currently unused — we don't label polygons,
//     the day pill names the place — but kept for future "park labels"
//     overlay if we want one)
//   - `coords`: ring of [lat, lng] pairs forming the polygon. Closed
//     automatically by Leaflet.
//
// Adding a new park: pick ~8-12 corners by eye on a real map, paste
// them in. Don't agonise about precision.

import type { LatLngTuple } from "leaflet";

export type ParkBoundary = {
  match: RegExp;
  name: string;
  /** Approximate polygon ring, [lat, lng] pairs. */
  coords: LatLngTuple[];
};

// Polygons listed roughly biggest-first within each country so when
// they overlap (e.g. Maasai Mara abuts Serengeti) the smaller one
// renders on top.
export const PARK_BOUNDARIES: ParkBoundary[] = [
  // ── Tanzania — Northern Circuit ──────────────────────────────────────
  {
    match: /\bserengeti\b/i,
    name: "Serengeti",
    coords: [
      [-1.45, 34.10],
      [-1.30, 34.85],
      [-1.65, 35.45],
      [-2.20, 35.65],
      [-2.85, 35.40],
      [-3.05, 34.95],
      [-2.95, 34.30],
      [-2.45, 33.95],
      [-1.85, 33.95],
    ],
  },
  {
    match: /\bngorongoro\b/i,
    name: "Ngorongoro Conservation Area",
    coords: [
      [-2.85, 35.20],
      [-2.85, 35.85],
      [-3.05, 36.15],
      [-3.55, 36.00],
      [-3.55, 35.30],
      [-3.20, 35.05],
    ],
  },
  {
    match: /\btarangire\b/i,
    name: "Tarangire",
    coords: [
      [-3.55, 35.95],
      [-3.55, 36.15],
      [-3.95, 36.20],
      [-4.30, 36.10],
      [-4.35, 35.85],
      [-4.10, 35.80],
      [-3.80, 35.85],
    ],
  },
  {
    match: /\blake manyara\b|^manyara\b/i,
    name: "Lake Manyara",
    coords: [
      [-3.40, 35.78],
      [-3.45, 35.92],
      [-3.65, 35.90],
      [-3.75, 35.85],
      [-3.80, 35.78],
      [-3.65, 35.72],
      [-3.50, 35.72],
    ],
  },
  // ── Tanzania — Southern + Western ────────────────────────────────────
  {
    match: /\bselous\b|\bnyerere\b/i,
    name: "Nyerere (Selous)",
    coords: [
      [-7.50, 36.50],
      [-7.20, 37.50],
      [-7.50, 38.40],
      [-8.50, 38.80],
      [-9.30, 38.30],
      [-9.40, 37.20],
      [-8.80, 36.40],
      [-8.00, 36.30],
    ],
  },
  {
    match: /\bruaha\b/i,
    name: "Ruaha",
    coords: [
      [-6.90, 34.40],
      [-6.85, 35.20],
      [-7.50, 35.30],
      [-8.00, 35.00],
      [-8.10, 34.20],
      [-7.40, 34.00],
    ],
  },
  {
    match: /\bmahale\b/i,
    name: "Mahale Mountains",
    coords: [
      [-5.85, 29.70],
      [-5.95, 29.95],
      [-6.30, 30.05],
      [-6.45, 29.85],
      [-6.30, 29.70],
      [-6.05, 29.65],
    ],
  },
  // ── Kenya ────────────────────────────────────────────────────────────
  {
    match: /\bmasai mara\b|\bmaasai mara\b|\bthe mara\b/i,
    name: "Maasai Mara",
    coords: [
      [-1.20, 34.95],
      [-1.20, 35.40],
      [-1.55, 35.50],
      [-1.85, 35.30],
      [-1.80, 34.90],
      [-1.50, 34.80],
    ],
  },
  {
    match: /\bamboseli\b/i,
    name: "Amboseli",
    coords: [
      [-2.55, 37.05],
      [-2.55, 37.45],
      [-2.80, 37.50],
      [-2.85, 37.10],
      [-2.70, 37.00],
    ],
  },
  {
    match: /\btsavo east\b/i,
    name: "Tsavo East",
    coords: [
      [-2.10, 38.20],
      [-2.10, 39.40],
      [-3.30, 39.20],
      [-3.50, 38.80],
      [-3.20, 38.10],
      [-2.50, 38.00],
    ],
  },
  {
    match: /\btsavo west\b|^tsavo\b/i,
    name: "Tsavo West",
    coords: [
      [-2.65, 37.65],
      [-2.70, 38.30],
      [-3.40, 38.40],
      [-3.50, 37.90],
      [-3.20, 37.55],
    ],
  },
  {
    match: /\bsamburu\b/i,
    name: "Samburu",
    coords: [
      [0.50, 37.45],
      [0.65, 37.75],
      [0.50, 37.95],
      [0.30, 37.85],
      [0.30, 37.55],
    ],
  },
  // ── Uganda ───────────────────────────────────────────────────────────
  {
    match: /\bbwindi\b/i,
    name: "Bwindi Impenetrable",
    coords: [
      [-0.95, 29.55],
      [-0.95, 29.85],
      [-1.15, 29.90],
      [-1.20, 29.60],
      [-1.05, 29.50],
    ],
  },
  {
    match: /\bqueen elizabeth\b/i,
    name: "Queen Elizabeth",
    coords: [
      [-0.05, 29.65],
      [-0.10, 30.30],
      [-0.40, 30.40],
      [-0.55, 30.05],
      [-0.45, 29.70],
    ],
  },
  {
    match: /\bmurchison\b/i,
    name: "Murchison Falls",
    coords: [
      [2.05, 31.40],
      [2.30, 31.90],
      [2.30, 32.40],
      [2.00, 32.50],
      [1.75, 32.10],
      [1.85, 31.50],
    ],
  },
  // ── Rwanda ───────────────────────────────────────────────────────────
  {
    match: /\bvolcanoes\b|\bmusanze\b/i,
    name: "Volcanoes",
    coords: [
      [-1.40, 29.45],
      [-1.40, 29.70],
      [-1.55, 29.75],
      [-1.55, 29.45],
    ],
  },
  {
    match: /\bakagera\b/i,
    name: "Akagera",
    coords: [
      [-1.75, 30.55],
      [-1.75, 30.85],
      [-2.20, 30.80],
      [-2.40, 30.60],
      [-2.20, 30.45],
    ],
  },
];

/** Find every park polygon whose match regex hits any of the operator's
 *  destinations. Returns the polygons in registry order (biggest-first
 *  within each country) so smaller parks render on top of larger ones
 *  when they overlap. */
export function parksInTrip(destinations: string[]): ParkBoundary[] {
  if (destinations.length === 0) return [];
  const seen = new Set<string>();
  const matches: ParkBoundary[] = [];
  for (const park of PARK_BOUNDARIES) {
    for (const dest of destinations) {
      if (park.match.test(dest) && !seen.has(park.name)) {
        seen.add(park.name);
        matches.push(park);
        break;
      }
    }
  }
  return matches;
}
