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

  // Theme-driven colours (with sensible fallbacks for cold renders).
  const accentColor = tokens.accent || "#1b3a2d";
  const headingColor = tokens.headingText || "#243c24";
  const cardColor = tokens.cardBg || "#f7f5f0";
  const mutedColor = tokens.mutedText || "#6b6b6b";

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX_W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ width: "100%", height: "100%", display: "block" }}
      role="img"
      aria-label="Itinerary route diagram"
    >
      {/* Section-tinted background — soft cream that lets the green
          park washes pop without competing. */}
      <rect width={VIEWBOX_W} height={H} fill={cardColor} />

      {/* Park polygon haloes — translated to each node, relative size
          preserved (PX_PER_DEGREE is a fixed scalar, so a park 5x
          larger in the real world renders 5x larger here). Drawn
          BEFORE legs and pins so they sit underneath. */}
      {positions.map((pos, i) => {
        const park = nodeParks[i];
        if (!park) return null;
        const d = polygonToPath(park.coords, pos, PX_PER_DEGREE);
        if (!d) return null;
        return (
          <path
            key={`park-${i}-${park.key}`}
            d={d}
            fill="#3a7a52"
            fillOpacity={0.18}
            stroke="#2d5a40"
            strokeWidth={1.3}
            strokeOpacity={0.55}
            strokeLinejoin="round"
          />
        );
      })}

      {/* Connecting bezier legs — dashed charcoal line, soft so the
          pins remain the primary signal. */}
      {legPaths.map((d, i) => (
        <path
          key={`leg-${i}`}
          d={d}
          fill="none"
          stroke={headingColor}
          strokeWidth={2.2}
          strokeDasharray="2 8"
          strokeLinecap="round"
          opacity={0.85}
        />
      ))}

      {/* Day nodes — pill above pin, place name below. Drawn last
          so they sit on top of the polygon halo. */}
      {positions.map((pos, i) => {
        const node = nodes[i];
        const pillW = Math.max(64, node.dayLabel.length * 7.2 + 18);
        const pillH = 22;
        return (
          <g key={`node-${i}`}>
            {/* Pin: outer halo + inner solid dot for depth */}
            <circle
              cx={pos.x}
              cy={pos.y}
              r={10}
              fill={cardColor}
              stroke={accentColor}
              strokeWidth={2.2}
            />
            <circle cx={pos.x} cy={pos.y} r={5} fill={accentColor} />

            {/* Day pill above the pin */}
            <g>
              <rect
                x={pos.x - pillW / 2}
                y={pos.y - pillH - 14}
                width={pillW}
                height={pillH}
                rx={pillH / 2}
                fill={accentColor}
              />
              <text
                x={pos.x}
                y={pos.y - 18}
                fill="#ffffff"
                fontSize={11.5}
                fontWeight={700}
                textAnchor="middle"
                fontFamily="system-ui, sans-serif"
                letterSpacing="0.5"
              >
                {node.dayLabel}
              </text>
            </g>

            {/* Place name below the pin */}
            <text
              x={pos.x}
              y={pos.y + 30}
              fill={headingColor}
              fontSize={14}
              fontWeight={700}
              textAnchor="middle"
              fontFamily={`'${theme.displayFont}', serif`}
            >
              {node.destination}
            </text>

            {/* Optional sub-label: park or generic stop kind */}
            {nodeParks[i] && (
              <text
                x={pos.x}
                y={pos.y + 47}
                fill={mutedColor}
                fontSize={10.5}
                fontWeight={500}
                textAnchor="middle"
                fontFamily={`'${theme.bodyFont}', sans-serif`}
                letterSpacing="0.4"
                style={{ textTransform: "uppercase" }}
              >
                National Park
              </text>
            )}
          </g>
        );
      })}
    </svg>
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
