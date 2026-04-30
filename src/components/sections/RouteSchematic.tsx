"use client";

import { useMemo } from "react";
import type { LatLngTuple } from "leaflet";
import type { Day, ThemeTokens, ProposalTheme } from "@/lib/types";
import { PARK_BOUNDARIES } from "@/lib/safariParkBoundaries";

// ─── RouteSchematic ──────────────────────────────────────────────────────
//
// A pure-SVG illustrated map. REAL geographic positions (each stop's
// lat/lng drives where the pin lands and where the park polygon is
// drawn), but rendered with the look of a hand-drawn explorer's
// chart: parchment background, sketchy ink lines, italic serif
// labels, compass rose, paper grain.
//
// Why this design:
//
//   • Geographic truth is preserved — the spatial relationships
//     between Arusha, Serengeti, Zanzibar etc. are real, not invented.
//   • Breathing room is BUILT IN via generous bbox padding (~18% on
//     each side) so the route never sits flush against the frame.
//   • Park outlines render at their actual scale — Serengeti reads as
//     big, Lake Manyara as small, because they are.
//   • Crowding is mitigated by per-pin nudges baked into the known
//     coords table (see safariCoords below): Tarangire's pin is
//     anchored deep in the polygon's southern third so it doesn't
//     overlap Manyara.
//
// What it's NOT:
//
//   • Not a Leaflet map — no tile basemap, no street labels, no
//     pan/zoom. The artistic SVG is the whole map.
//   • Not strict cartographic projection — uses linear lat/lng → x/y
//     mapping rather than Mercator (web-Mercator distortion is
//     irrelevant at East-Africa scale and adds complexity for no
//     visible win).
//
// Layered like a vintage illustration:
//
//   1. Parchment base (theme cardBg)
//   2. Park polygon haloes (sage wash + olive ink, hand-drawn filter)
//   3. Route bezier legs (terra-cotta dotted trail, hand-drawn filter)
//   4. Pin dots + day pills + place names (italic serif on top)
//   5. Compass rose + "not to scale" note (decorative)
//   6. Paper-grain noise overlay (warm-brown turbulence at low opacity)
//   7. Soft vignette at the corners

interface SchematicNode {
  dayLabel: string;
  destination: string;
  firstDay: number;
  lastDay: number;
  lat: number;
  lng: number;
}

const VIEWBOX_W = 1000;
const PADDING_FRACTION = 0.18; // 18% breathing room around the route bbox

/** Hardcoded coordinates for the most common East-African safari
 *  stops. Mirrors the table in RouteMap.tsx; duplicated here so the
 *  schematic doesn't require Leaflet at all. Tarangire's pin is
 *  deliberately anchored at the polygon's southern third (-4.25,
 *  36.15) so it has visible separation from Lake Manyara. */
const SAFARI_COORDS: Array<{ match: RegExp; lat: number; lng: number }> = [
  // Tanzania
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
  // Kenya
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
  // Rwanda / Uganda
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

/** Group consecutive same-destination days into single nodes, and
 *  attach the destination's lat/lng. Days whose destination doesn't
 *  resolve to a known coord are dropped (they have nowhere to render). */
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
    } else {
      out.push({
        dayLabel: `Day ${day.dayNumber}`,
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

/** Compute bbox + viewBox aspect for a set of nodes. Used by
 *  MapSection to set the map column's CSS aspect-ratio so the SVG
 *  fills the cell without distortion. */
export function computeSchematicAspect(days: Day[]): number {
  const nodes = buildNodes(days);
  if (nodes.length < 2) return 1.2; // fallback aspect for empty/single
  const lats = nodes.map((n) => n.lat);
  const lngs = nodes.map((n) => n.lng);
  let north = Math.max(...lats);
  let south = Math.min(...lats);
  let east = Math.max(...lngs);
  let west = Math.min(...lngs);
  const latSpan = north - south;
  const lngSpan = east - west;
  north += latSpan * PADDING_FRACTION;
  south -= latSpan * PADDING_FRACTION;
  east += lngSpan * PADDING_FRACTION;
  west -= lngSpan * PADDING_FRACTION;
  const finalLat = north - south;
  const finalLng = east - west;
  if (finalLat < 0.001 || finalLng < 0.001) return 1.2;
  // Clamp so single-region trips don't produce extreme aspects.
  const raw = finalLng / finalLat;
  return Math.min(1.6, Math.max(0.65, raw));
}

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

  // ── Hand-drawn / explorer-map palette ────────────────────────────
  const inkColor = tokens.headingText || "#3a2f24";
  const accentColor = tokens.accent || "#a85230";
  const cardColor = tokens.cardBg || "#f5e8c8";
  const mutedColor = tokens.mutedText || "#8a7a62";
  const sageFill = "#8aa370";
  const sageStroke = "#4a5d3a";

  // ── Bbox + projection ────────────────────────────────────────────
  const lats = nodes.map((n) => n.lat);
  const lngs = nodes.map((n) => n.lng);
  let north = Math.max(...lats);
  let south = Math.min(...lats);
  let east = Math.max(...lngs);
  let west = Math.min(...lngs);
  // For single-stop trips, give the camera ~1° of visual context.
  if (nodes.length === 1) {
    north += 0.5;
    south -= 0.5;
    east += 0.5;
    west -= 0.5;
  } else {
    // Generous padding for breathing room.
    const latSpan = north - south;
    const lngSpan = east - west;
    north += latSpan * PADDING_FRACTION;
    south -= latSpan * PADDING_FRACTION;
    east += lngSpan * PADDING_FRACTION;
    west -= lngSpan * PADDING_FRACTION;
  }
  const finalLat = north - south;
  const finalLng = east - west;

  // ViewBox H derived from bbox aspect so the projection isn't
  // distorted (1° lat ≈ 1° lng at East-African latitudes).
  const W = VIEWBOX_W;
  const H = Math.max(400, Math.round(W * (finalLat / finalLng)));

  const project = (lat: number, lng: number): { x: number; y: number } => ({
    x: ((lng - west) / finalLng) * W,
    y: ((north - lat) / finalLat) * H,
  });

  const positions = nodes.map((n) => project(n.lat, n.lng));

  // Match each node to a real park polygon (regex match on destination).
  const nodeParks = nodes.map(
    (n) => PARK_BOUNDARIES.find((p) => p.match.test(n.destination)) ?? null,
  );

  // Bezier legs between consecutive nodes — alternating perpendicular
  // bows produce a soft S-snake.
  const legPaths = positions.slice(0, -1).map((from, i) => {
    const to = positions[i + 1];
    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    // Perpendicular unit vector
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
        {/* "Hand-drawn" filter — turbulence-driven displacement gives
            crisp paths a slight ink-on-paper wobble. */}
        <filter id="hand-drawn" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.025"
            numOctaves="2"
            seed="7"
            result="turbulence"
          />
          <feDisplacementMap in="SourceGraphic" in2="turbulence" scale="2.4" />
        </filter>

        {/* Paper-grain overlay — subtle warm-brown noise. */}
        <filter id="paper-grain" x="0" y="0" width="100%" height="100%">
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

        {/* Vignette gradient — softens the corners. */}
        <radialGradient id="vignette" cx="50%" cy="50%" r="70%">
          <stop offset="60%" stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor="rgba(60,40,20,0.08)" />
        </radialGradient>
      </defs>

      {/* Parchment base */}
      <rect width={W} height={H} fill={cardColor} />

      {/* Park polygon halos — drawn at REAL geographic coords through
          the projection. Sage wash + dark olive ink, slight wobble
          from the hand-drawn filter. Big parks render big; small
          parks render small. */}
      <g filter="url(#hand-drawn)">
        {nodeParks.map((park, i) => {
          if (!park) return null;
          const d = parkPolygonPath(park.coords, project);
          if (!d) return null;
          return (
            <path
              key={`park-${i}-${park.key}`}
              d={d}
              fill={sageFill}
              fillOpacity={0.32}
              stroke={sageStroke}
              strokeWidth={1.6}
              strokeOpacity={0.65}
              strokeLinejoin="round"
            />
          );
        })}
      </g>

      {/* Connecting bezier legs — terra-cotta dotted trail with the
          hand-drawn wobble. */}
      <g filter="url(#hand-drawn)">
        {legPaths.map((d, i) => (
          <path
            key={`leg-${i}`}
            d={d}
            fill="none"
            stroke={accentColor}
            strokeWidth={3.2}
            strokeDasharray="3 9"
            strokeLinecap="round"
            opacity={0.9}
          />
        ))}
      </g>

      {/* Compass rose — top-right corner. */}
      <CompassRose cx={W - 70} cy={70} r={32} ink={inkColor} accent={accentColor} />

      {/* Day nodes — pin + pill above + place name below. */}
      {positions.map((pos, i) => {
        const node = nodes[i];
        const pillW = Math.max(72, node.dayLabel.length * 7.6 + 22);
        const pillH = 24;
        return (
          <g key={`node-${i}`}>
            {/* Pin: ink-ringed outer + inner solid dot for depth */}
            <circle
              cx={pos.x}
              cy={pos.y}
              r={11}
              fill={cardColor}
              stroke={inkColor}
              strokeWidth={2.4}
            />
            <circle cx={pos.x} cy={pos.y} r={5.5} fill={accentColor} />

            {/* Day pill above the pin */}
            <g>
              <rect
                x={pos.x - pillW / 2}
                y={pos.y - pillH - 16}
                width={pillW}
                height={pillH}
                rx={pillH / 2}
                fill={inkColor}
              />
              <text
                x={pos.x}
                y={pos.y - 19}
                fill={cardColor}
                fontSize={12}
                fontWeight={600}
                fontStyle="italic"
                textAnchor="middle"
                fontFamily={`'${theme.displayFont}', serif`}
                letterSpacing="0.6"
              >
                {node.dayLabel}
              </text>
            </g>

            {/* Place name below the pin — italic serif */}
            <text
              x={pos.x}
              y={pos.y + 32}
              fill={inkColor}
              fontSize={15}
              fontWeight={600}
              fontStyle="italic"
              textAnchor="middle"
              fontFamily={`'${theme.displayFont}', serif`}
            >
              {node.destination}
            </text>

            {/* Optional sub-label — small caps, muted. */}
            {nodeParks[i] && (
              <text
                x={pos.x}
                y={pos.y + 49}
                fill={mutedColor}
                fontSize={10.5}
                fontWeight={500}
                textAnchor="middle"
                fontFamily={`'${theme.bodyFont}', sans-serif`}
                letterSpacing="0.6"
                style={{ textTransform: "uppercase" }}
              >
                National Park
              </text>
            )}
          </g>
        );
      })}

      {/* "Not to scale" — vintage map convention. */}
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

      {/* Paper-grain overlay — sits on top of everything. */}
      <rect
        width={W}
        height={H}
        fill="#3a2f24"
        filter="url(#paper-grain)"
        opacity={0.5}
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

// ─── Park polygon at real coords ─────────────────────────────────────────
//
// Each polygon vertex projected via the same lat/lng → x/y function the
// pins use. Big parks render big, small parks render small — the size
// relationship is automatically truthful because we're using real
// coordinates.

function parkPolygonPath(
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

// ─── Compass rose ────────────────────────────────────────────────────────

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
