"use client";

import { useMemo } from "react";
import type { LatLngTuple } from "leaflet";
import type { Day, ThemeTokens, ProposalTheme } from "@/lib/types";
import { PARK_BOUNDARIES } from "@/lib/safariParkBoundaries";

// ─── RouteSchematic ──────────────────────────────────────────────────────
//
// A pure-SVG itinerary diagram. NOT a geographic map — node positions
// are placed for clarity (vertical zigzag spine) regardless of real
// lat/lng. Park polygon SHAPES are drawn at each node's anchor with
// relative-size scaling preserved (Serengeti remains visibly bigger
// than Tarangire and Lake Manyara), but their WORLD POSITION is
// discarded — the polygon centroid lands on the node.
//
// Why this design: every iteration of the geographic map fought a
// crowding / aspect / empty-region problem. The schematic sidesteps
// all of them — labels never collide, the frame fills exactly, no
// aspect war. The price: clients can't cross-reference Google Maps
// for routes or distances. That trade was made deliberately.
//
// Layout:
//
//   ┌─────────────────────────────────────────────┐
//   │  ●  Day 1                                    │
//   │  Arusha                                      │
//   │       \                                      │
//   │        ●  Day 2                              │
//   │        Tarangire (with park polygon halo)    │
//   │       /                                      │
//   │  ●  Day 3                                    │
//   │  Lake Manyara (with park polygon halo)       │
//   │      …                                       │
//   └─────────────────────────────────────────────┘
//
// Node positions alternate left / right of centre; bezier connectors
// curve smoothly between them. Park polygons render under the pins
// with a translucent green wash. Day pills + place names render on
// top.

interface SchematicNode {
  dayLabel: string;
  destination: string;
  firstDay: number;
  lastDay: number;
}

const VIEWBOX_W = 1000;
const PADDING_Y = 90;
const ROW_HEIGHT = 110;
const SPINE_AMPLITUDE = 220; // px from centre
const PX_PER_DEGREE = 95; // park polygon scale; preserves relative size

/** Group consecutive same-destination days into single nodes. */
function buildNodes(days: Day[]): SchematicNode[] {
  const sorted = [...days].sort((a, b) => a.dayNumber - b.dayNumber);
  const out: SchematicNode[] = [];
  for (const day of sorted) {
    const dest = day.destination?.trim() || "";
    if (!dest) continue;
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
      });
    }
  }
  return out;
}

/** Schematic viewBox aspect (W:H). MapSection consumes this to set
 *  the map column's CSS aspect-ratio so the diagram fills the cell
 *  without distortion. */
export function computeSchematicAspect(days: Day[]): number {
  const nodes = buildNodes(days);
  const H = nodeCountToHeight(nodes.length);
  return VIEWBOX_W / H;
}

function nodeCountToHeight(n: number): number {
  if (n <= 1) return 320;
  return PADDING_Y * 2 + (n - 1) * ROW_HEIGHT;
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
          background: tokens.cardBg ?? "#f7f5f0",
          color: tokens.mutedText ?? "#6b6b6b",
        }}
      >
        {isEditor
          ? "Add days with destinations to draw the route."
          : "Route coming soon."}
      </div>
    );
  }

  const H = nodeCountToHeight(nodes.length);
  const CENTER_X = VIEWBOX_W / 2;

  // Node positions — vertical zigzag along the spine.
  const positions = nodes.map((_, i) => {
    if (nodes.length === 1) {
      return { x: CENTER_X, y: H / 2 };
    }
    const y = PADDING_Y + i * ROW_HEIGHT;
    const x = i % 2 === 0 ? CENTER_X - SPINE_AMPLITUDE : CENTER_X + SPINE_AMPLITUDE;
    return { x, y };
  });

  // Match each node to a real park polygon (regex match on destination).
  const nodeParks = nodes.map(
    (n) => PARK_BOUNDARIES.find((p) => p.match.test(n.destination)) ?? null,
  );

  // Bezier legs between consecutive nodes — alternating perpendicular
  // bows along the spine produce a smooth S-snake.
  const legPaths = positions.slice(0, -1).map((from, i) => {
    const to = positions[i + 1];
    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2;
    const sign = i % 2 === 0 ? 1 : -1;
    const ctrlX = midX + sign * 90;
    const ctrlY = midY;
    return `M ${from.x} ${from.y} Q ${ctrlX.toFixed(1)} ${ctrlY.toFixed(1)} ${to.x} ${to.y}`;
  });

  // ── Hand-drawn / explorer-map palette ────────────────────────────
  //
  // Earth-toned ink palette — terra-cotta route, sage-wash parks,
  // dark-olive strokes, parchment background. tokens.accent /
  // headingText / cardBg still feed the configurable parts (route
  // line, pills, page bg) so operators can recolour from
  // SectionChrome; the artistic ink colours are hardcoded because
  // they ARE the look.
  const inkColor = tokens.headingText || "#3a2f24"; // deep brown ink
  const accentColor = tokens.accent || "#a85230"; // terra-cotta
  const cardColor = tokens.cardBg || "#f5e8c8"; // parchment
  const mutedColor = tokens.mutedText || "#8a7a62";
  const sageFill = "#8aa370"; // muted sage wash
  const sageStroke = "#4a5d3a"; // dark olive ink

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX_W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ width: "100%", height: "100%", display: "block" }}
      role="img"
      aria-label="Itinerary route diagram"
    >
      <defs>
        {/* "Hand-drawn" filter — turbulence-driven displacement gives
            crisp paths a slight ink-on-paper wobble. Applied to park
            polygons and the route line. */}
        <filter id="hand-drawn" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.025"
            numOctaves="2"
            seed="7"
            result="turbulence"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="turbulence"
            scale="2.4"
          />
        </filter>

        {/* Paper-grain overlay — a subtle warm-brown noise texture
            applied as a final layer at low opacity so the whole map
            reads as printed-on-parchment instead of digital-flat. */}
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

        {/* Vignette gradient — softens the corners so the rectangular
            edge feels less stamped, more illustrated. */}
        <radialGradient id="vignette" cx="50%" cy="50%" r="70%">
          <stop offset="60%" stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor="rgba(60,40,20,0.08)" />
        </radialGradient>
      </defs>

      {/* Parchment base — soft warm cream. Theme bg drives the colour
          so an operator who picks a different cardBg still gets a
          map that fits their proposal. */}
      <rect width={VIEWBOX_W} height={H} fill={cardColor} />

      {/* Park polygon halos — translated to each node, relative size
          preserved (PX_PER_DEGREE fixed). The hand-drawn filter gives
          the strokes a slight wobble so they read as inked, not
          plotted. */}
      <g filter="url(#hand-drawn)">
        {positions.map((pos, i) => {
          const park = nodeParks[i];
          if (!park) return null;
          const d = polygonToPath(park.coords, pos, PX_PER_DEGREE);
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

      {/* Connecting bezier legs — terra-cotta ink with the hand-drawn
          wobble. Sparse short dashes evoke the dotted travel-trail
          you'd find on a vintage explorer's map. */}
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

      {/* Compass rose — top-right corner. A small decorative cardinal
          marker. Pure ornament; helps the map read as a map. */}
      <CompassRose
        cx={VIEWBOX_W - 70}
        cy={70}
        r={32}
        ink={inkColor}
        accent={accentColor}
      />

      {/* Day nodes — pill above pin, place name below. Drawn last
          so they sit on top of the polygon halo. */}
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

            {/* Day pill above the pin — warm ink fill, hand-lettered
                feel via tracked-out italic */}
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

            {/* Place name below the pin — italic serif evokes a
                hand-lettered mid-century travel-map caption. */}
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

      {/* "Not to scale" — vintage map convention, italic serif at
          the bottom-left margin. Reinforces the schematic-as-art
          framing so clients don't measure distances off it. */}
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

      {/* Paper-grain overlay — subtle warm-brown noise across the
          entire frame at low opacity. Last layer so it sits above
          everything; pointer-events disabled so it never blocks
          interactions (when we add them later). */}
      <rect
        width={VIEWBOX_W}
        height={H}
        fill="#3a2f24"
        filter="url(#paper-grain)"
        opacity={0.5}
        style={{ pointerEvents: "none", mixBlendMode: "multiply" }}
      />

      {/* Vignette — soft brown tint at the corners only, deepens the
          parchment feel. */}
      <rect
        width={VIEWBOX_W}
        height={H}
        fill="url(#vignette)"
        style={{ pointerEvents: "none" }}
      />
    </svg>
  );
}

// ─── Compass rose ────────────────────────────────────────────────────────
//
// A small decorative cardinal marker drawn in the same ink palette
// as the rest of the map. North pointer slightly longer to anchor
// orientation; the four cardinal letters sit at the rose's tips. Pure
// ornament — helps the schematic read as a MAP rather than a chart.

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
      {/* Outer ring */}
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
      {/* North arm — solid accent so it reads as the primary direction */}
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
      {/* Cardinal letters — italic serif */}
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

// ─── Polygon transform ───────────────────────────────────────────────────
//
// Translate a park polygon (real OSM lat/lng vertices) so its centroid
// lands on the given anchor point in viewBox coordinates, then scale
// uniformly so 1° = pxPerDegree. Output is an SVG path string. Same
// pxPerDegree across all parks preserves relative size — Serengeti's
// span is ~5× Tarangire's so it draws ~5× bigger.

function polygonToPath(
  coords: LatLngTuple[],
  anchor: { x: number; y: number },
  pxPerDegree: number,
): string {
  if (coords.length < 3) return "";
  let sumLat = 0;
  let sumLng = 0;
  for (const [lat, lng] of coords) {
    sumLat += lat;
    sumLng += lng;
  }
  const centerLat = sumLat / coords.length;
  const centerLng = sumLng / coords.length;
  const points: Array<[number, number]> = coords.map(([lat, lng]) => {
    const dx = (lng - centerLng) * pxPerDegree;
    // Flip Y because SVG y-axis grows downward but lat grows upward.
    const dy = -(lat - centerLat) * pxPerDegree;
    return [anchor.x + dx, anchor.y + dy];
  });
  let d = `M ${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
  for (const [x, y] of points.slice(1)) {
    d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  d += " Z";
  return d;
}
