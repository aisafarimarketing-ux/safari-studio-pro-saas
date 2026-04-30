"use client";

import { useMemo } from "react";
import type { LatLngTuple } from "leaflet";
import type { Day, ThemeTokens, ProposalTheme } from "@/lib/types";
import { PARK_BOUNDARIES } from "@/lib/safariParkBoundaries";
import { COUNTRY_RINGS } from "@/lib/countryBoundariesData";
import { LAKE_RINGS } from "@/lib/lakeBoundariesData";
import { getGlyphForDestination } from "@/lib/wildlifeGlyphs";

// ─── RouteSchematic ──────────────────────────────────────────────────────
//
// A pure-SVG illustrated safari map. REAL geographic positions; real
// country outlines (sand-coloured land mass with dark olive ink),
// real lake polygons (blue water), real park outlines (green wash
// with wildlife glyphs at their centroids), the trip's stops drawn
// as small numbered pins along a hand-drawn route line. Indian
// Ocean and any offshore islands (Zanzibar) sit in their own water
// region. The whole thing is dressed in a hand-drawn explorer-map
// aesthetic — turbulence-displaced ink, parchment overlay, paper
// grain, soft vignette.
//
// Layered like a vintage illustration:
//
//   1. Water (full-frame teal-blue base)
//   2. Country mass(es) in sand colour with dark olive coastline
//   3. Lake polygons (blue, on top of land)
//   4. Park polygons (green wash + ink stroke)
//   5. Wildlife glyphs (lion / elephant / mountain / palm) at park centroids
//   6. Bezier connector legs (terra-cotta dotted trail)
//   7. Numbered day pins + place name labels
//   8. Compass rose top-right · "not to scale" italic note bottom-left
//   9. Paper-grain noise overlay + vignette

// ─── Geometry helpers ───────────────────────────────────────────────────

interface SchematicNode {
  dayLabel: string;
  shortLabel: string; // "1", "2-3" — for the small numbered pin
  destination: string;
  firstDay: number;
  lastDay: number;
  lat: number;
  lng: number;
}

const VIEWBOX_W = 1000;
const PADDING_FRACTION = 0.32;

// (Island / lake detection used to drive specialised rendering; the
// new layered approach paints water as a full base + carves countries
// from it, so per-stop classification is no longer needed.)

// Hardcoded coords for known safari stops. Mirrors the table in
// RouteMap.tsx; duplicated here so the schematic is self-contained.
// Tarangire's pin is anchored at (-4.25, 36.15) to give it visual
// separation from Lake Manyara.
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
  {
    match: /^murchison falls\b|^murchison\b/i,
    lat: 2.27,
    lng: 31.69,
  },
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

// Detect which countries the trip touches. Used to pick which
// country outlines to render as the land mass.
const COUNTRY_BY_BBOX: Array<{
  key: keyof typeof COUNTRY_RINGS;
  // Approximate bounding box: [southLat, westLng, northLat, eastLng]
  bbox: [number, number, number, number];
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

function detectTripCountries(coords: { lat: number; lng: number }[]): Array<keyof typeof COUNTRY_RINGS> {
  const found = new Set<keyof typeof COUNTRY_RINGS>();
  for (const c of coords) {
    for (const country of COUNTRY_BY_BBOX) {
      const [s, w, n, e] = country.bbox;
      if (c.lat >= s && c.lat <= n && c.lng >= w && c.lng <= e) {
        found.add(country.key);
      }
    }
  }
  // Always include neighbours of detected countries that share the
  // bbox region — gives a sense of context. For safari trips it's
  // common to see Tanzania + Kenya together even if all stops are
  // in one. Skipping this for simplicity; the detected set is fine.
  return Array.from(found);
}

// Detect lakes in the trip + nearby. We always render Lake Victoria
// + Tanganyika when the bbox is in East Africa, since they're
// landmark features of the region. Other lakes show only when a
// stop matches them.
function detectLakes(
  destinations: string[],
  bbox: { south: number; west: number; north: number; east: number },
): Array<keyof typeof LAKE_RINGS> {
  const out = new Set<keyof typeof LAKE_RINGS>();
  // Stop-driven lakes
  for (const d of destinations) {
    if (/manyara/i.test(d)) out.add("manyara");
    if (/naivasha/i.test(d)) out.add("naivasha");
    if (/nakuru/i.test(d)) out.add("nakuru");
  }
  // Region-driven lakes — always show Victoria when bbox includes
  // any of its lat/lng range so the geography reads correctly.
  if (bbox.west < 35 && bbox.north > -3) out.add("victoria");
  return Array.from(out);
}

// Group consecutive same-destination days into single nodes.
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
      last.dayLabel = `Day ${last.firstDay}–${last.lastDay}`;
      last.shortLabel = `${last.firstDay}–${last.lastDay}`;
    } else {
      out.push({
        dayLabel: `Day ${day.dayNumber}`,
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

// computeSchematicAspect helper removed — MapSection now uses
// items-stretch grid so the map cell takes the rail's natural
// height; the SVG fits via preserveAspectRatio="xMidYMid meet".

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

  // ── Safari-map palette (theme tokens still drive what they can) ──
  const inkColor = tokens.headingText || "#3a2f24"; // dark brown ink
  const accentColor = tokens.accent || "#a85230"; // terra-cotta route line
  const cardColor = tokens.cardBg || "#f3e2bb"; // sand / parchment LAND
  const mutedColor = tokens.mutedText || "#8a7a62";
  const waterColor = "#bfd6dc"; // soft teal-blue ocean / lake
  const parkFill = "#9eb887"; // muted savannah green
  const parkStroke = "#4a5d3a"; // dark olive ink
  const countryStroke = "#6a5a40"; // warm brown country border ink

  // ── Bbox + projection ────────────────────────────────────────────
  const lats = nodes.map((n) => n.lat);
  const lngs = nodes.map((n) => n.lng);
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

  const positions = nodes.map((n) => project(n.lat, n.lng));

  // Country outlines that intersect the trip's bbox.
  const tripCountries = detectTripCountries(
    nodes.map((n) => ({ lat: n.lat, lng: n.lng })),
  );
  // Render countries deduplicated, with bigger ones first so smaller
  // overlap on top.
  const countryPaths = tripCountries
    .map((key) => ({ key, ring: COUNTRY_RINGS[key] }))
    .filter((c) => c.ring && c.ring.length >= 3)
    .map((c) => ({
      key: c.key,
      d: ringToPath(c.ring, project),
    }));

  // Lakes in the trip + always-show landmarks within the bbox.
  const lakeKeys = detectLakes(
    nodes.map((n) => n.destination),
    { south, west, north, east },
  );
  const lakePaths = lakeKeys
    .map((key) => ({ key, ring: LAKE_RINGS[key] }))
    .filter((l) => l.ring && l.ring.length >= 3)
    .map((l) => ({ key: l.key, d: ringToPath(l.ring, project) }));

  // Match each node to a real park polygon (regex match on destination).
  const nodeParks = nodes.map(
    (n) => PARK_BOUNDARIES.find((p) => p.match.test(n.destination)) ?? null,
  );

  // Park polygon paths + label anchor points (centroid of polygon).
  const parkRenders = nodeParks.map((park, i) => {
    if (!park) return null;
    const ring = park.coords;
    const d = ringToPath(ring, project);
    let sumLat = 0;
    let sumLng = 0;
    for (const [lat, lng] of ring) {
      sumLat += lat;
      sumLng += lng;
    }
    const center = project(
      sumLat / ring.length,
      sumLng / ring.length,
    );
    return { key: `${park.key}-${i}`, d, center, name: park.name };
  });

  // Bezier legs between consecutive nodes — alternating perpendicular
  // bows produce a soft S-snake.
  const legPaths = positions.slice(0, -1).map((from, i) => {
    const to = positions[i + 1];
    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    const px = -dy / len;
    const py = dx / len;
    const sign = i % 2 === 0 ? 1 : -1;
    const bowAmount = Math.min(60, len * 0.18);
    const ctrlX = midX + px * sign * bowAmount;
    const ctrlY = midY + py * sign * bowAmount;
    return `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} Q ${ctrlX.toFixed(1)} ${ctrlY.toFixed(1)} ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
  });

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ width: "100%", height: "100%", display: "block" }}
      role="img"
      aria-label="Itinerary route diagram"
    >
      <defs>
        {/* Hand-drawn ink filter */}
        <filter id="hand-drawn" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.02"
            numOctaves="2"
            seed="7"
            result="turbulence"
          />
          <feDisplacementMap in="SourceGraphic" in2="turbulence" scale="2" />
        </filter>
        {/* Lighter wobble for fine elements like text + glyphs */}
        <filter id="hand-drawn-soft" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.04"
            numOctaves="2"
            seed="3"
            result="turbulence"
          />
          <feDisplacementMap in="SourceGraphic" in2="turbulence" scale="0.7" />
        </filter>

        {/* Paper grain — warm-brown noise. */}
        <filter id="paper-grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.85"
            numOctaves="3"
            seed="3"
            stitchTiles="stitch"
          />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0.32  0 0 0 0 0.24  0 0 0 0 0.16  0 0 0 0.08 0"
          />
        </filter>

        {/* Vignette */}
        <radialGradient id="vignette" cx="50%" cy="50%" r="70%">
          <stop offset="60%" stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor="rgba(60,40,20,0.10)" />
        </radialGradient>

        {/* Topo stipple — terrain texture on land. */}
        <pattern
          id="topo-stipple"
          patternUnits="userSpaceOnUse"
          width="14"
          height="14"
          patternTransform="rotate(15)"
        >
          <circle cx="3" cy="3" r="0.6" fill="#8a7558" opacity="0.28" />
          <circle cx="10" cy="9" r="0.5" fill="#8a7558" opacity="0.22" />
          <circle cx="6" cy="11" r="0.4" fill="#a08060" opacity="0.18" />
        </pattern>

        {/* Wave pattern — used along the coastline */}
        <pattern
          id="ocean-waves"
          patternUnits="userSpaceOnUse"
          width="40"
          height="20"
        >
          <path
            d="M0 10 Q 5 5 10 10 T 20 10 T 30 10 T 40 10"
            stroke="#8aa8b0"
            strokeWidth="0.6"
            fill="none"
            opacity="0.6"
          />
        </pattern>

        {/* Clip-path of all rendered country shapes — used so the
            topo-stipple texture sits ONLY on land. */}
        <clipPath id="land-clip">
          {countryPaths.map((c) => (
            <path key={c.key} d={c.d} />
          ))}
        </clipPath>
      </defs>

      {/* ── Layer 1: water base ─────────────────────────────────── */}
      <rect width={W} height={H} fill={waterColor} />
      <rect
        width={W}
        height={H}
        fill="url(#ocean-waves)"
        style={{ pointerEvents: "none" }}
      />

      {/* ── Layer 2: country mass(es) ───────────────────────────── */}
      <g filter="url(#hand-drawn)">
        {countryPaths.map((c) => (
          <path
            key={c.key}
            d={c.d}
            fill={cardColor}
            stroke={countryStroke}
            strokeWidth={1.8}
            strokeOpacity={0.7}
            strokeLinejoin="round"
          />
        ))}
      </g>

      {/* ── Layer 2b: topo stipple on land only ─────────────────── */}
      <rect
        width={W}
        height={H}
        fill="url(#topo-stipple)"
        clipPath="url(#land-clip)"
        style={{ pointerEvents: "none" }}
      />

      {/* ── Layer 3: lakes ──────────────────────────────────────── */}
      <g filter="url(#hand-drawn)">
        {lakePaths.map((l) => (
          <path
            key={l.key}
            d={l.d}
            fill={waterColor}
            stroke="#5a8590"
            strokeWidth={1.2}
            strokeOpacity={0.55}
            strokeLinejoin="round"
          />
        ))}
      </g>

      {/* ── Layer 4: park polygons ──────────────────────────────── */}
      <g filter="url(#hand-drawn)">
        {parkRenders.map((park) =>
          park ? (
            <path
              key={park.key}
              d={park.d}
              fill={parkFill}
              fillOpacity={0.55}
              stroke={parkStroke}
              strokeWidth={1.6}
              strokeOpacity={0.7}
              strokeLinejoin="round"
            />
          ) : null,
        )}
      </g>

      {/* ── Layer 5: wildlife glyphs at park centroids ──────────── */}
      <g filter="url(#hand-drawn-soft)">
        {nodes.map((node, i) => {
          const park = nodeParks[i];
          const center = park ? parkRenders[i]?.center : positions[i];
          if (!center) return null;
          const glyph = getGlyphForDestination(node.destination);
          return (
            <WildlifeGlyph
              key={`glyph-${i}`}
              cx={center.x}
              cy={center.y - 8}
              glyph={glyph}
              ink={parkStroke}
            />
          );
        })}
      </g>

      {/* ── Layer 6: park labels (small caps) ───────────────────── */}
      {parkRenders.map((park) =>
        park ? (
          <text
            key={`park-label-${park.key}`}
            x={park.center.x}
            y={park.center.y + 22}
            fill={parkStroke}
            fontSize={9}
            fontWeight={700}
            textAnchor="middle"
            fontFamily={`'${theme.bodyFont}', sans-serif`}
            letterSpacing="0.16em"
            style={{ textTransform: "uppercase", pointerEvents: "none" }}
            opacity={0.85}
          >
            {park.name}
          </text>
        ) : null,
      )}

      {/* ── Layer 7: bezier route legs ──────────────────────────── */}
      <g filter="url(#hand-drawn)">
        {legPaths.map((d, i) => (
          <path
            key={`leg-${i}`}
            d={d}
            fill="none"
            stroke={accentColor}
            strokeWidth={3}
            strokeDasharray="3 8"
            strokeLinecap="round"
            opacity={0.95}
          />
        ))}
      </g>

      {/* ── Layer 8: numbered day pins ──────────────────────────── */}
      {positions.map((pos, i) => {
        const node = nodes[i];
        return (
          <g key={`pin-${i}`}>
            {/* Outer halo for legibility on parks */}
            <circle
              cx={pos.x}
              cy={pos.y}
              r={14}
              fill={cardColor}
              stroke={inkColor}
              strokeWidth={2}
            />
            <circle cx={pos.x} cy={pos.y} r={11} fill={accentColor} />
            <text
              x={pos.x}
              y={pos.y + 4}
              fill="#ffffff"
              fontSize={node.shortLabel.length > 2 ? 9.5 : 12}
              fontWeight={700}
              textAnchor="middle"
              fontFamily="system-ui, sans-serif"
              style={{ pointerEvents: "none" }}
            >
              {node.shortLabel}
            </text>
            {/* Place name below the pin — italic serif */}
            <g filter="url(#hand-drawn-soft)">
              <text
                x={pos.x}
                y={pos.y + 32}
                fill={inkColor}
                fontSize={12.5}
                fontWeight={600}
                fontStyle="italic"
                textAnchor="middle"
                fontFamily={`'${theme.displayFont}', serif`}
                style={{ pointerEvents: "none" }}
              >
                {node.destination}
              </text>
            </g>
          </g>
        );
      })}

      {/* ── Layer 9: compass rose ────────────────────────────────── */}
      <CompassRose cx={W - 70} cy={70} r={32} ink={inkColor} accent={accentColor} />

      {/* "not to scale" — vintage convention */}
      <text
        x={32}
        y={H - 24}
        fill={mutedColor}
        fontSize={10.5}
        fontStyle="italic"
        fontFamily={`'${theme.displayFont}', serif`}
        opacity={0.75}
      >
        not to scale
      </text>

      {/* ── Layer 10: paper grain overlay ────────────────────────── */}
      <rect
        width={W}
        height={H}
        fill="#3a2f24"
        filter="url(#paper-grain)"
        opacity={0.45}
        style={{ pointerEvents: "none", mixBlendMode: "multiply" }}
      />

      {/* Vignette */}
      <rect
        width={W}
        height={H}
        fill="url(#vignette)"
        style={{ pointerEvents: "none" }}
      />
    </svg>
  );
}

// ─── Polygon → SVG path ─────────────────────────────────────────────────

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

// ─── Wildlife glyph component ──────────────────────────────────────────

function WildlifeGlyph({
  cx,
  cy,
  glyph,
  ink,
}: {
  cx: number;
  cy: number;
  glyph: { kind: string; paths: string[]; strokeWidth?: number; filled?: boolean };
  ink: string;
}) {
  // Glyph designed in 24x24 viewBox; display at 22px centred on (cx,cy).
  const size = 22;
  return (
    <g transform={`translate(${cx - size / 2} ${cy - size / 2})`} opacity={0.78}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        overflow="visible"
        aria-hidden
      >
        {glyph.paths.map((d, i) => (
          <path
            key={i}
            d={d}
            fill={glyph.filled ? ink : "none"}
            stroke={ink}
            strokeWidth={glyph.strokeWidth ?? 1.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </svg>
    </g>
  );
}

// ─── Compass rose ──────────────────────────────────────────────────────

function CompassRose({
  cx,
  cy,
  r,
  ink,
  accent,
}: {
  cx: number;
  cy: number;
  r: number;
  ink: string;
  accent: string;
}) {
  const armN = r;
  const armS = r * 0.78;
  const armEW = r * 0.78;
  const armSize = 4;
  return (
    <g aria-hidden>
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="rgba(0,0,0,0)"
        stroke={ink}
        strokeWidth={1.2}
        strokeOpacity={0.6}
      />
      <circle
        cx={cx}
        cy={cy}
        r={r * 0.7}
        fill="rgba(0,0,0,0)"
        stroke={ink}
        strokeWidth={0.8}
        strokeOpacity={0.4}
      />
      <polygon
        points={`${cx},${cy - armN} ${cx - armSize},${cy} ${cx + armSize},${cy}`}
        fill={accent}
        stroke={ink}
        strokeWidth={0.6}
      />
      <polygon
        points={`${cx},${cy + armS} ${cx - armSize},${cy} ${cx + armSize},${cy}`}
        fill={ink}
        opacity={0.6}
      />
      <polygon
        points={`${cx + armEW},${cy} ${cx},${cy - armSize} ${cx},${cy + armSize}`}
        fill={ink}
        opacity={0.6}
      />
      <polygon
        points={`${cx - armEW},${cy} ${cx},${cy - armSize} ${cx},${cy + armSize}`}
        fill={ink}
        opacity={0.6}
      />
      <text
        x={cx}
        y={cy - r - 4}
        fill={ink}
        fontSize={10}
        fontStyle="italic"
        fontWeight={700}
        textAnchor="middle"
        fontFamily="serif"
      >
        N
      </text>
      <text
        x={cx}
        y={cy + r + 12}
        fill={ink}
        fontSize={9}
        fontStyle="italic"
        textAnchor="middle"
        fontFamily="serif"
        opacity={0.7}
      >
        S
      </text>
      <text
        x={cx + r + 6}
        y={cy + 3}
        fill={ink}
        fontSize={9}
        fontStyle="italic"
        textAnchor="start"
        fontFamily="serif"
        opacity={0.7}
      >
        E
      </text>
      <text
        x={cx - r - 6}
        y={cy + 3}
        fill={ink}
        fontSize={9}
        fontStyle="italic"
        textAnchor="end"
        fontFamily="serif"
        opacity={0.7}
      >
        W
      </text>
    </g>
  );
}
