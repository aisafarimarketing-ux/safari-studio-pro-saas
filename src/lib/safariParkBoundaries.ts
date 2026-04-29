// ─── Safari park boundaries ───────────────────────────────────────────────
//
// REAL park outlines, sourced from OpenStreetMap via Nominatim and
// pre-simplified via scripts/fetch-park-boundaries.mjs (committed
// output: safariParkBoundariesData.ts). The match-regex table below
// maps the operator's destination strings (typed in editor) to the
// park keys so we can look up the right ring per trip.
//
// Why real data: hand-traced 6-vertex shapes read as schematic boxes
// even with smoothing — operators called them out as "make-up". OSM
// boundaries give the actual contour of Serengeti / Ngorongoro /
// Tarangire / etc., which clients can recognise from any guidebook.
//
// To refresh boundaries: re-run `node scripts/fetch-park-boundaries.mjs`.

import type { LatLngTuple } from "leaflet";
import { REAL_PARK_RINGS } from "./safariParkBoundariesData";

export type ParkBoundary = {
  match: RegExp;
  /** Park key — index into REAL_PARK_RINGS. */
  key: keyof typeof REAL_PARK_RINGS;
  /** Display label (currently unused — day pill names the place). */
  name: string;
  coords: LatLngTuple[];
};

// Park entries listed roughly biggest-first within each country so when
// they overlap (e.g. Maasai Mara abuts Serengeti) the smaller one
// renders on top.
const PARK_ENTRIES: Array<Omit<ParkBoundary, "coords">> = [
  // ── Tanzania — Northern Circuit ─────────────────────────────────────
  { key: "serengeti", match: /\bserengeti\b/i, name: "Serengeti" },
  { key: "ngorongoro", match: /\bngorongoro\b/i, name: "Ngorongoro Conservation Area" },
  { key: "tarangire", match: /\btarangire\b/i, name: "Tarangire" },
  { key: "lakeManyara", match: /\blake manyara\b|^manyara\b/i, name: "Lake Manyara" },
  // ── Tanzania — Southern + Western ───────────────────────────────────
  { key: "selous", match: /\bselous\b/i, name: "Selous" },
  { key: "nyerere", match: /\bnyerere\b/i, name: "Nyerere" },
  { key: "ruaha", match: /\bruaha\b/i, name: "Ruaha" },
  { key: "mahale", match: /\bmahale\b/i, name: "Mahale Mountains" },
  // ── Kenya ───────────────────────────────────────────────────────────
  { key: "masaiMara", match: /\bmasai mara\b|\bmaasai mara\b|\bthe mara\b/i, name: "Maasai Mara" },
  { key: "amboseli", match: /\bamboseli\b/i, name: "Amboseli" },
  { key: "tsavoEast", match: /\btsavo east\b/i, name: "Tsavo East" },
  { key: "tsavoWest", match: /\btsavo west\b|^tsavo\b/i, name: "Tsavo West" },
  { key: "samburu", match: /\bsamburu\b/i, name: "Samburu" },
  // ── Uganda ──────────────────────────────────────────────────────────
  { key: "bwindi", match: /\bbwindi\b/i, name: "Bwindi Impenetrable" },
  { key: "queenElizabeth", match: /\bqueen elizabeth\b/i, name: "Queen Elizabeth" },
  { key: "murchison", match: /\bmurchison\b/i, name: "Murchison Falls" },
  // ── Rwanda ──────────────────────────────────────────────────────────
  { key: "volcanoes", match: /\bvolcanoes\b|\bmusanze\b/i, name: "Volcanoes" },
  { key: "akagera", match: /\bakagera\b/i, name: "Akagera" },
];

export const PARK_BOUNDARIES: ParkBoundary[] = PARK_ENTRIES.flatMap((entry) => {
  const coords = REAL_PARK_RINGS[entry.key];
  // Skip parks whose OSM fetch returned a degenerate ring (Mahale
  // sometimes resolves to a 2-point shape). Better to render nothing
  // than a sliver of green wash that doesn't represent the park.
  if (!coords || coords.length < 4) return [];
  return [{ ...entry, coords }];
});

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
      if (park.match.test(dest) && !seen.has(park.key)) {
        seen.add(park.key);
        matches.push(park);
        break;
      }
    }
  }
  return matches;
}
