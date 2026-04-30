"use client";

import { useMemo } from "react";
import type { LatLngTuple } from "leaflet";
import type { Day, ThemeTokens, ProposalTheme } from "@/lib/types";
import { COUNTRY_RINGS } from "@/lib/countryBoundariesData";
import { LAKE_RINGS } from "@/lib/lakeBoundariesData";

// ─── RouteSchematic ──────────────────────────────────────────────────────
//
// HAND-DRAWN SKETCH STYLE — anchored to the operator's reference
// sketch (Apr 2026). Twelve hard rules live in
// ~/.claude/.../memory/map_drawing_rules.md. Don't relax any of
// them without explicit operator sign-off.
//
// At a glance:
//   • Hand-drawn organic country outline (real OSM data + ink wobble)
//   • Numbered circle pins ("1", "2-3") — NO day pills, NO labels-on-pin
//   • Straight thin lines between pins in chronological order
//   • Lakes as organic blobs with italic-serif name labels
//   • Italic-serif place name beside each pin
//   • Offshore islands (Zanzibar etc.) as separate hand-drawn shapes
//   • NO wildlife glyphs · NO park polygons · NO topo stipple · NO
//     compass rose · NO "not to scale" note · NO paper-grain overlay
//   • Parchment background, light ink wobble filter for character

interface SchematicNode {
  shortLabel: string; // "1", "2-3" — for the numbered pin
  destination: string;
  firstDay: number;
  lastDay: number;
  lat: number;
  lng: number;
}

const VIEWBOX_W = 1000;
const PADDING_FRACTION = 0.45;

// Per-country eastern-coast longitude limit. Tanzania's OSM polygon
// loops out to Zanzibar / Pemba / Mafia archipelago vertices when
// fetched as a single boundary, which pulls the country's drawn
// eastern edge well east of the actual mainland coast. Trimming
// vertices east of this limit gives a clean coastline. Add entries
// per country as needed.
const COUNTRY_TRIM_MAX_LNG: Record<string, number> = {
  tanzania: 39.55, // mainland coast at most; Zanzibar et al. excluded
};

function trimCountryRing(
  key: string,
  ring: LatLngTuple[],
): LatLngTuple[] {
  const cap = COUNTRY_TRIM_MAX_LNG[key];
  if (cap == null) return ring;
  // Drop vertices east of the cap. Vertices form a sequential
  // offshore chunk in the data, so dropping them connects the last
  // mainland point directly to the first mainland point on the
  // other side — a near-straight ink line along the coast.
  return ring.filter(([, lng]) => lng <= cap);
}

// Offshore stops are pulled visually closer to the mainland so the
// inland cluster (Arusha / Tarangire / Manyara / Ngorongoro /
// Serengeti) gets more pixels to spread across. Without this, the
// long jump to Zanzibar dominates the bbox and the inland pins
// crowd. Compression factor: 0 = sit on coast; 1 = real position.
const ISLAND_COMPRESSION = 0.55;

// Hardcoded coords for known safari stops (mirror of RouteMap's table).
const SAFARI_COORDS: Array<{ match: RegExp; lat: number; lng: number }> = [
  { match: /^arusha\b/i, lat: -3.3869, lng: 36.6829 },
  { match: /^moshi\b/i, lat: -3.3494, lng: 37.3408 },
  { match: /^kilimanjaro\b/i, lat: -3.0674, lng: 37.3556 },
  { match: /^tarangire\b/i, lat: -4.25, lng: 36.15 },
  { match: /^lake manyara\b|^manyara\b/i, lat: -3.5833, lng: 35.8333 },
  { match: /^ngorongoro\b/i, lat: -3.2, lng: 35.5 },
  { match: /^serengeti\b/i, lat: -2.3333, lng: 34.8333 },
  { match: /^ruaha\b/i, lat: -7.45, lng: 34.65 },
  { match: /^selous\b|^nyerere\b/i, lat: -8.5, lng: 37.5 },
  { match: /^mahale\b/i, lat: -6.1167, lng: 29.85 },
  { match: /^katavi\b/i, lat: -6.7833, lng: 31.15 },
  { match: /^zanzibar\b|^stone town\b/i, lat: -6.1659, lng: 39.2026 },
  { match: /^pemba\b/i, lat: -5.05, lng: 39.7833 },
  { match: /^mafia\b/i, lat: -7.9, lng: 39.75 },
  { match: /^dar es salaam\b|^dar\b/i, lat: -6.7924, lng: 39.2083 },
  { match: /^nairobi\b/i, lat: -1.2864, lng: 36.8172 },
  {
    match: /^masai mara\b|^maasai mara\b|^the mara\b/i,
    lat: -1.5,
    lng: 35.15,
  },
  { match: /^amboseli\b/i, lat: -2.65, lng: 37.2667 },
  { match: /^tsavo east\b/i, lat: -2.75, lng: 38.75 },
  { match: /^tsavo west\b/i, lat: -3.0, lng: 38.0 },
  { match: /^samburu\b/i, lat: 0.55, lng: 37.5333 },
  { match: /^laikipia\b/i, lat: 0.4, lng: 36.9 },
  { match: /^lake nakuru\b|^nakuru\b/i, lat: -0.3667, lng: 36.0833 },
  { match: /^lake naivasha\b|^naivasha\b/i, lat: -0.7167, lng: 36.4333 },
  { match: /^ol pejeta\b/i, lat: 0.0, lng: 36.9 },
  { match: /^meru\b/i, lat: 0.15, lng: 38.2 },
  { match: /^mount kenya\b/i, lat: -0.1521, lng: 37.3083 },
  { match: /^diani\b/i, lat: -4.3, lng: 39.5833 },
  { match: /^lamu\b/i, lat: -2.2717, lng: 40.902 },
  { match: /^mombasa\b/i, lat: -4.0435, lng: 39.6682 },
  { match: /^volcanoes\b|^musanze\b/i, lat: -1.4833, lng: 29.55 },
  { match: /^kigali\b/i, lat: -1.9441, lng: 30.0619 },
  { match: /^bwindi\b/i, lat: -1.05, lng: 29.7 },
  { match: /^queen elizabeth\b|^kasese\b/i, lat: -0.2, lng: 30.05 },
  { match: /^murchison falls\b|^murchison\b/i, lat: 2.27, lng: 31.69 },
  { match: /^entebbe\b/i, lat: 0.047, lng: 32.463 },
  { match: /^kampala\b/i, lat: 0.3476, lng: 32.5825 },
];

function lookupCoord(destination: string): { lat: number; lng: number } | null {
  const name = (destination ?? "").trim();
  if (!name) return null;
  for (const entry of SAFARI_COORDS) {
    if (entry.match.test(name)) return { lat: entry.lat, lng: entry.lng };
  }
  return null;
}

const COUNTRY_BY_BBOX: Array<{
  key: keyof typeof COUNTRY_RINGS;
  bbox: [number, number, number, number]; // [southLat, westLng, northLat, eastLng]
}> = [
  { key: "tanzania", bbox: [-12, 29, 0, 41] },
  { key: "kenya", bbox: [-5, 33, 5, 42] },
  { key: "uganda", bbox: [-2, 29, 5, 35] },
  { key: "rwanda", bbox: [-3, 28, -1, 31] },
  { key: "botswana", bbox: [-27, 19, -17, 30] },
  { key: "zimbabwe", bbox: [-23, 24, -15, 33] },
  { key: "zambia", bbox: [-19, 21, -8, 34] },
  { key: "southAfrica", bbox: [-35, 16, -22, 33] },
];

function detectTripCountries(
  coords: { lat: number; lng: number }[],
): Array<keyof typeof COUNTRY_RINGS> {
  const found = new Set<keyof typeof COUNTRY_RINGS>();
  for (const c of coords) {
    for (const country of COUNTRY_BY_BBOX) {
      const [s, w, n, e] = country.bbox;
      if (c.lat >= s && c.lat <= n && c.lng >= w && c.lng <= e) {
        found.add(country.key);
      }
    }
  }
  return Array.from(found);
}

// Nearby lakes shown when the trip's bbox overlaps. Each lake
// renders the polygon plus a handwritten-style italic name label.
const LAKE_LABELS: Array<{
  key: keyof typeof LAKE_RINGS;
  match: RegExp;
  label: string;
}> = [
  { key: "manyara", match: /manyara/i, label: "lake manyara" },
  { key: "naivasha", match: /naivasha/i, label: "lake naivasha" },
  { key: "nakuru", match: /nakuru/i, label: "lake nakuru" },
  { key: "victoria", match: /never-matches/, label: "lake victoria" }, // bbox-driven
  { key: "tanganyika", match: /never-matches/, label: "lake tanganyika" },
];

function detectLakes(
  destinations: string[],
  bbox: { south: number; west: number; north: number; east: number },
): typeof LAKE_LABELS {
  const out = new Set<keyof typeof LAKE_RINGS>();
  for (const d of destinations) {
    for (const l of LAKE_LABELS) if (l.match.test(d)) out.add(l.key);
  }
  // Always include Lake Victoria when the bbox crosses its area —
  // it's a Tanzania/Kenya/Uganda landmark you expect to see.
  if (bbox.west < 35 && bbox.north > -3) out.add("victoria");
  return LAKE_LABELS.filter((l) => out.has(l.key));
}

// Offshore stops — render as separate hand-drawn island shapes in
// the water region so they READ as islands, not pins floating on
// open ocean. Zanzibar gets its elongated north-south silhouette;
// other islands stay rounder.
const ISLAND_RE = /\bzanzibar\b|\bpemba\b|\bmafia\b|\bstone town\b/i;
function isIslandStop(destination: string): boolean {
  return ISLAND_RE.test(destination ?? "");
}

function buildNodes(days: Day[]): SchematicNode[] {
  const sorted = [...days].sort((a, b) => a.dayNumber - b.dayNumber);
  const out: SchematicNode[] = [];
  for (const day of sorted) {
    const dest = day.destination?.trim() || "";
    if (!dest) continue;
    const coord = lookupCoord(dest);
    if (!coord) continue;
    const last = out[out.length - 1];
    if (last && last.destination.toLowerCase() === dest.toLowerCase()) {
      last.lastDay = day.dayNumber;
      last.shortLabel = `${last.firstDay}–${last.lastDay}`;
    } else {
      out.push({
        shortLabel: `${day.dayNumber}`,
        destination: dest,
        firstDay: day.dayNumber,
        lastDay: day.dayNumber,
        lat: coord.lat,
        lng: coord.lng,
      });
    }
  }
  return out;
}

// ─── Component ──────────────────────────────────────────────────────────

export function RouteSchematic({
  days,
  tokens,
  theme,
  isEditor,
}: {
  days: Day[];
  tokens: ThemeTokens;
  theme: ProposalTheme;
  isEditor: boolean;
}) {
  const nodes = useMemo(() => buildNodes(days), [days]);

  if (nodes.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-[13px] w-full h-full"
        style={{
          background: tokens.cardBg ?? "#f5e8c8",
          color: tokens.mutedText ?? "#8a7a62",
        }}
      >
        {isEditor
          ? "Add days with destinations to draw the route."
          : "Route coming soon."}
      </div>
    );
  }

  // Sketch palette — drawn lighter than the previous "richer" map
  // so the line work carries the character.
  const inkColor = tokens.headingText || "#2a2418"; // dark ink
  const accentColor = tokens.accent || "#7a4a2a"; // pin / route line
  const cardColor = tokens.cardBg || "#f7e8c4"; // parchment land
  const mutedColor = tokens.mutedText || "#8a7a62";
  const waterColor = "#cde0e3"; // very soft teal water
  const lakeStroke = "#5a8590";

  // Mainland east — used by the island-compression heuristic so
  // offshore stops (Zanzibar) get pulled visually closer to the
  // coast, leaving more of the bbox for the inland cluster.
  const inlandStops = nodes.filter((n) => !isIslandStop(n.destination));
  const mainlandEastLng =
    inlandStops.length > 0
      ? Math.max(...inlandStops.map((n) => n.lng))
      : 39;
  const visualLng = (n: { destination: string; lng: number }) =>
    isIslandStop(n.destination)
      ? mainlandEastLng + (n.lng - mainlandEastLng) * ISLAND_COMPRESSION
      : n.lng;

  // Bbox + projection driven by the COMPRESSED visual lngs so
  // offshore stops don't blow the eastern edge wide open.
  const lats = nodes.map((n) => n.lat);
  const lngs = nodes.map((n) => visualLng(n));
  let north = Math.max(...lats);
  let south = Math.min(...lats);
  let east = Math.max(...lngs);
  let west = Math.min(...lngs);
  if (nodes.length === 1) {
    north += 1;
    south -= 1;
    east += 1.4;
    west -= 1.4;
  } else {
    const latSpan = north - south;
    const lngSpan = east - west;
    north += latSpan * PADDING_FRACTION;
    south -= latSpan * PADDING_FRACTION;
    east += lngSpan * PADDING_FRACTION;
    west -= lngSpan * PADDING_FRACTION;
  }
  const finalLat = north - south;
  const finalLng = east - west;

  const W = VIEWBOX_W;
  const H = Math.max(450, Math.round(W * (finalLat / finalLng)));

  const project = (lat: number, lng: number): { x: number; y: number } => ({
    x: ((lng - west) / finalLng) * W,
    y: ((north - lat) / finalLat) * H,
  });

  const positions = nodes.map((n) => project(n.lat, visualLng(n)));

  const tripCountries = detectTripCountries(
    nodes.map((n) => ({ lat: n.lat, lng: n.lng })),
  );
  const countryPaths = tripCountries
    .map((key) => ({ key, ring: COUNTRY_RINGS[key] }))
    .filter((c) => c.ring && c.ring.length >= 3)
    .map((c) => ({
      key: c.key,
      // Trim offshore vertices that pull the country path east of
      // the actual mainland coast.
      d: ringToPath(trimCountryRing(c.key, c.ring), project),
    }));

  const lakes = detectLakes(
    nodes.map((n) => n.destination),
    { south, west, north, east },
  );
  const lakeRenders = lakes
    .map((l) => ({
      key: l.key,
      label: l.label,
      ring: LAKE_RINGS[l.key],
    }))
    .filter((l) => l.ring && l.ring.length >= 3)
    .map((l) => ({
      key: l.key,
      label: l.label,
      d: ringToPath(l.ring, project),
      anchor: ringCentroid(l.ring, project),
    }));

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ width: "100%", height: "100%", display: "block" }}
      role="img"
      aria-label="Itinerary route diagram"
    >
      <defs>
        {/* Light hand-drawn ink filter — just enough wobble to break
            the vector-perfect feel without making things look noisy. */}
        <filter id="ink-wobble" x="-3%" y="-3%" width="106%" height="106%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.022"
            numOctaves="2"
            seed="5"
            result="turb"
          />
          <feDisplacementMap in="SourceGraphic" in2="turb" scale="1.6" />
        </filter>
      </defs>

      {/* Layer 1: water base */}
      <rect width={W} height={H} fill={waterColor} />

      {/* Layer 2: country mass(es) — hand-drawn parchment land */}
      <g filter="url(#ink-wobble)">
        {countryPaths.map((c) => (
          <path
            key={c.key}
            d={c.d}
            fill={cardColor}
            stroke={inkColor}
            strokeWidth={1.6}
            strokeOpacity={0.7}
            strokeLinejoin="round"
          />
        ))}
      </g>

      {/* Layer 2b: offshore islands — same parchment fill + ink
          stroke as the mainland, drawn at each offshore stop's
          projected position. Zanzibar gets the elongated vertical
          shape; other islands stay rounder. */}
      <g filter="url(#ink-wobble)">
        {nodes.map((n, i) => {
          if (!isIslandStop(n.destination)) return null;
          const pos = positions[i];
          const isZanzibar = /\bzanzibar\b|\bstone town\b/i.test(n.destination);
          const rx = isZanzibar ? 18 : 14;
          const ry = isZanzibar ? 30 : 16;
          return (
            <ellipse
              key={`island-${i}`}
              cx={pos.x}
              cy={pos.y}
              rx={rx}
              ry={ry}
              fill={cardColor}
              stroke={inkColor}
              strokeWidth={1.4}
              strokeOpacity={0.7}
            />
          );
        })}
      </g>

      {/* Layer 3: lakes */}
      <g filter="url(#ink-wobble)">
        {lakeRenders.map((l) => (
          <path
            key={l.key}
            d={l.d}
            fill={waterColor}
            stroke={lakeStroke}
            strokeWidth={1.2}
            strokeOpacity={0.55}
            strokeLinejoin="round"
          />
        ))}
      </g>

      {/* Layer 4: lake name labels — italic serif, lower-case */}
      {lakeRenders.map((l) => (
        <text
          key={`lake-label-${l.key}`}
          x={l.anchor.x + 12}
          y={l.anchor.y + 4}
          fill={lakeStroke}
          fontSize={11.5}
          fontStyle="italic"
          fontFamily={`'${theme.displayFont}', serif`}
          opacity={0.85}
          style={{ pointerEvents: "none" }}
        >
          {l.label}
        </text>
      ))}

      {/* Layer 5: straight route lines between consecutive pins */}
      <g filter="url(#ink-wobble)">
        {positions.slice(0, -1).map((from, i) => {
          const to = positions[i + 1];
          return (
            <line
              key={`leg-${i}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke={inkColor}
              strokeWidth={1.4}
              strokeOpacity={0.85}
              strokeLinecap="round"
            />
          );
        })}
      </g>

      {/* Layer 6: numbered circle pins + place name labels */}
      {positions.map((pos, i) => {
        const node = nodes[i];
        const fontSize = node.shortLabel.length > 2 ? 9.5 : 12;
        return (
          <g key={`pin-${i}`}>
            {/* Pin: cream halo + accent ink ring + accent fill */}
            <circle
              cx={pos.x}
              cy={pos.y}
              r={13}
              fill={cardColor}
              stroke={inkColor}
              strokeWidth={1.6}
            />
            <circle
              cx={pos.x}
              cy={pos.y}
              r={10}
              fill={accentColor}
              opacity={0.95}
            />
            <text
              x={pos.x}
              y={pos.y + 4}
              fill="#ffffff"
              fontSize={fontSize}
              fontWeight={700}
              textAnchor="middle"
              fontFamily="system-ui, sans-serif"
              style={{ pointerEvents: "none" }}
            >
              {node.shortLabel}
            </text>
            {/* Place name beside the pin — italic serif, slightly
                tilted toward the side with most viewBox room so labels
                don't run off edge. */}
            <text
              x={pos.x + (pos.x > W * 0.6 ? -16 : 16)}
              y={pos.y + 5}
              fill={inkColor}
              fontSize={13.5}
              fontStyle="italic"
              fontFamily={`'${theme.displayFont}', serif`}
              textAnchor={pos.x > W * 0.6 ? "end" : "start"}
              style={{ pointerEvents: "none" }}
            >
              {node.destination}
            </text>
          </g>
        );
      })}

      {/* Subtle vignette so the edges feel like printed paper. No
          paper grain noise, no compass rose, no "not to scale". */}
      <rect
        width={W}
        height={H}
        fill="url(#sketch-vignette)"
        style={{ pointerEvents: "none" }}
      />
      <radialGradient id="sketch-vignette" cx="50%" cy="50%" r="70%">
        <stop offset="65%" stopColor="rgba(0,0,0,0)" />
        <stop offset="100%" stopColor="rgba(60,40,20,0.06)" />
      </radialGradient>

      {/* Editor-only hint about which pins came from unknown coords */}
      {isEditor && nodes.length === 0 && (
        <text
          x={W / 2}
          y={H / 2}
          fill={mutedColor}
          fontSize={12}
          textAnchor="middle"
          style={{ pointerEvents: "none" }}
        >
          Add destinations to draw the map.
        </text>
      )}
    </svg>
  );
}

// ─── Geometry helpers ───────────────────────────────────────────────────

function ringToPath(
  coords: LatLngTuple[],
  project: (lat: number, lng: number) => { x: number; y: number },
): string {
  if (coords.length < 3) return "";
  const points = coords.map(([lat, lng]) => project(lat, lng));
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (const p of points.slice(1)) {
    d += ` L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  }
  d += " Z";
  return d;
}

function ringCentroid(
  coords: LatLngTuple[],
  project: (lat: number, lng: number) => { x: number; y: number },
): { x: number; y: number } {
  let sumLat = 0;
  let sumLng = 0;
  for (const [lat, lng] of coords) {
    sumLat += lat;
    sumLng += lng;
  }
  return project(sumLat / coords.length, sumLng / coords.length);
}
