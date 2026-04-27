"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { LatLngExpression, LatLngTuple } from "leaflet";
import type { Day, ThemeTokens } from "@/lib/types";

// Leaflet needs the DOM, so dynamic-import with ssr: false. The map tiles
// come from Carto (Voyager style) — no API key, more colourful than raw
// OSM without going illustrated.

const MapContainer = dynamic(() => import("react-leaflet").then((m) => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then((m) => m.TileLayer), { ssr: false });
const Marker = dynamic(() => import("react-leaflet").then((m) => m.Marker), { ssr: false });
const Tooltip = dynamic(() => import("react-leaflet").then((m) => m.Tooltip), { ssr: false });
const Polyline = dynamic(() => import("react-leaflet").then((m) => m.Polyline), { ssr: false });

// ─── Types ────────────────────────────────────────────────────────────────

export type RouteCoord = {
  dayId: string;
  dayNumber: number;
  label: string;
  lat: number;
  lng: number;
};

type GeocodeState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; coords: RouteCoord[] }
  | { status: "error"; message: string };

// ─── Geocode cache — stored in section.content.coords to avoid repeat work
// and to make the map render for public viewers without calling the API.

export function RouteMap({
  days,
  cachedCoords,
  onCoordsResolved,
  tokens,
  height = 420,
  selectedDayId,
  presentationMode = false,
}: {
  days: Day[];
  cachedCoords?: RouteCoord[];
  onCoordsResolved?: (coords: RouteCoord[]) => void;
  tokens: ThemeTokens;
  height?: number;
  /** When set, that day's pin gets a selected ring and the map flies
   *  to it. Used by the "interactive" MapSection variant. */
  selectedDayId?: string | null;
  /** Hide zoom controls + lock pan / zoom for guest views and PDF
   *  export. Editor still gets full interactivity. */
  presentationMode?: boolean;
}) {
  const [state, setState] = useState<GeocodeState>({ status: "idle" });
  // Import leaflet once on the client so we can build custom div icons.
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  // Mirror the ref into state so we can block the MapContainer render until
  // leaflet has actually initialised. Without this, a cached-coords render
  // path would produce status === "ready" synchronously on mount and the
  // MapContainer would mount before leaflet is loaded — crashing on
  // createIcon / _leaflet_events from Marker construction.
  const [leafletReady, setLeafletReady] = useState(false);
  // Hold on to the Leaflet map instance so parent-driven flyTo works.
  const mapRef = useRef<import("leaflet").Map | null>(null);

  // Signature of current days used to invalidate the cache when destinations
  // change. Two signatures must share the same format or the startsWith
  // prefix check below always fails — historically the main signature
  // included country and the cached one did not, so every cache miss
  // silently fell through to a live geocode round-trip.
  const signature = useMemo(
    () => days.map((d) => `${d.id}:${d.destination}`).join("|"),
    [days],
  );
  const cachedSignature = useMemo(
    () => (cachedCoords ?? []).map((c) => `${c.dayId}:${c.label}`).join("|"),
    [cachedCoords],
  );

  useEffect(() => {
    let cancelled = false;

    // Use cache if signatures align.
    if (cachedCoords && cachedCoords.length > 0 && cachedSignature.startsWith(signature.slice(0, cachedSignature.length))) {
      setState({ status: "ready", coords: cachedCoords });
      return;
    }

    // Dedupe destinations to cut geocode calls (many trips have the same
    // place across multiple days).
    const seen = new Map<string, RouteCoord | "pending">();
    const sequence: { day: Day; key: string }[] = days.map((d) => ({
      day: d,
      key: `${d.destination}, ${d.country}`.trim(),
    }));

    setState({ status: "loading" });

    (async () => {
      for (const { day, key } of sequence) {
        if (cancelled) return;
        if (seen.has(key)) continue;
        seen.set(key, "pending");
        try {
          const res = await fetch(`/api/geocode?q=${encodeURIComponent(key)}`);
          if (!res.ok) {
            seen.set(key, { dayId: day.id, dayNumber: day.dayNumber, label: key, lat: 0, lng: 0 });
            continue;
          }
          const data = (await res.json()) as { result: { lat: number; lng: number; displayName: string } | null };
          if (data.result) {
            seen.set(key, {
              dayId: day.id,
              dayNumber: day.dayNumber,
              label: day.destination,
              lat: data.result.lat,
              lng: data.result.lng,
            });
          } else {
            // Unknown place — drop it, don't draw a pin.
            seen.delete(key);
          }
        } catch {
          seen.delete(key);
        }
      }

      if (cancelled) return;

      // Build the ordered coord list — one per day (reusing the resolved
      // location for repeated destinations).
      const resolved = new Map<string, RouteCoord | null>();
      for (const [k, v] of seen.entries()) {
        if (v === "pending") continue;
        resolved.set(k, v ?? null);
      }
      const coords: RouteCoord[] = sequence
        .map(({ day, key }) => {
          const c = resolved.get(key);
          if (!c) return null;
          return {
            dayId: day.id,
            dayNumber: day.dayNumber,
            label: day.destination,
            lat: c.lat,
            lng: c.lng,
          };
        })
        .filter((c): c is RouteCoord => c !== null);

      setState({ status: "ready", coords });
      onCoordsResolved?.(coords);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  // ── Fix Leaflet's default icon paths (broken in bundlers) ──
  useEffect(() => {
    if (typeof window === "undefined") return;
    let mounted = true;
    import("leaflet").then((L) => {
      if (!mounted) return;
      leafletRef.current = L;
      delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });
      setLeafletReady(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Render a loading placeholder until BOTH the coord state is ready AND
  // leaflet has finished loading. Either alone is insufficient: "ready"
  // with cached coords can arrive synchronously on first render, well
  // before the async leaflet import resolves.
  if (state.status === "idle" || state.status === "loading" || !leafletReady) {
    return (
      <div
        className="w-full flex items-center justify-center"
        style={{ height, background: tokens.cardBg, color: tokens.mutedText }}
      >
        <div className="text-small">Plotting route…</div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div
        className="w-full flex items-center justify-center"
        style={{ height, background: tokens.cardBg, color: tokens.mutedText }}
      >
        <div className="text-small">Map unavailable — {state.message}</div>
      </div>
    );
  }

  const coords = state.coords;
  if (coords.length === 0) {
    return (
      <div
        className="w-full flex flex-col items-center justify-center"
        style={{ height, background: tokens.cardBg, color: tokens.mutedText }}
      >
        <div className="text-small">No destinations to plot.</div>
        <div className="text-label mt-1">Add a day with a destination name.</div>
      </div>
    );
  }

  // Group consecutive days at the same coordinate into a single marker so
  // a 2-night stay doesn't stack two pins on the same pixel. Label reads
  // "Day 3-4" when a group spans multiple days.
  const groups = groupCoordsByLocation(coords);

  // Which group contains the selected day (if any)?
  const selectedGroupIndex = selectedDayId
    ? groups.findIndex((g) =>
        coords.some(
          (c) => c.dayId === selectedDayId && Math.abs(c.lat - g.lat) < 0.0001 && Math.abs(c.lng - g.lng) < 0.0001,
        ),
      )
    : -1;

  // Bounds from group centres — tighter than per-day bounds.
  const lats = groups.map((g) => g.lat);
  const lngs = groups.map((g) => g.lng);
  const center: LatLngExpression = [
    (Math.min(...lats) + Math.max(...lats)) / 2,
    (Math.min(...lngs) + Math.max(...lngs)) / 2,
  ];
  const bounds: [LatLngTuple, LatLngTuple] = [
    [Math.min(...lats), Math.min(...lngs)],
    [Math.max(...lats), Math.max(...lngs)],
  ];

  // Build a list of legs between consecutive groups, classifying each
  // as drive (solid) or flight (dashed curved) by haversine distance.
  // East-African long-haul transfers (Mara → Zanzibar, ~700 km) read
  // as flights; intra-circuit hops (Tarangire → Serengeti, ~120 km)
  // read as drives. The threshold is heuristic and operator-tunable
  // in a future commit — defaulting to 250 km hits the right answer
  // for the typical safari itinerary.
  const FLIGHT_THRESHOLD_KM = 250;
  const legs = buildLegs(groups, FLIGHT_THRESHOLD_KM);

  return (
    <div className="relative w-full overflow-hidden" style={{ height, background: tokens.cardBg }}>
      <MapContainer
        center={center}
        zoom={6}
        scrollWheelZoom={false}
        bounds={bounds}
        boundsOptions={{ padding: [60, 60], maxZoom: 7 }}
        minZoom={3}
        // Editorial defaults — hide the +/− zoom widget always; let
        // operators pan/zoom via scroll/drag in editor mode and lock
        // both in presentation mode (PDF export, share view).
        zoomControl={false}
        dragging={!presentationMode}
        doubleClickZoom={!presentationMode}
        touchZoom={!presentationMode}
        keyboard={!presentationMode}
        style={{ width: "100%", height: "100%" }}
        ref={(instance) => {
          mapRef.current = instance as unknown as import("leaflet").Map | null;
        }}
      >
        <FlyToSelected
          map={mapRef}
          selectedGroupIndex={selectedGroupIndex}
          groups={groups}
        />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          // Carto Positron — clean light basemap, minimal labels,
          // muted greys/blues. Replaces Carto Voyager which carried
          // road shields + saturated park fills that fought the route
          // for attention.
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          subdomains={["a", "b", "c", "d"]}
          maxZoom={19}
        />

        {/* Route legs — one Polyline per leg, styled per type:
            drive = solid charcoal, flight = dashed soft blue + curved.
            Rendered before markers so pins sit on top of lines. */}
        {legs.map((leg, i) => (
          <Polyline
            key={`leg-${i}`}
            positions={leg.path}
            pathOptions={leg.kind === "flight"
              ? {
                  color: "#6faed6",
                  weight: 1.8,
                  opacity: 0.85,
                  dashArray: "5 7",
                  lineCap: "round",
                  lineJoin: "round",
                }
              : {
                  color: "#2d2d2d",
                  weight: 1.6,
                  opacity: 0.78,
                  lineCap: "round",
                  lineJoin: "round",
                }
            }
          />
        ))}

        {groups.map((g, i) => {
          const isSelected = i === selectedGroupIndex;
          const icon = leafletRef.current
            ? buildDayPill(leafletRef.current, g.dayLabel, isSelected)
            : undefined;
          return (
            <Marker
              key={`${g.lat}-${g.lng}-${g.startDay}`}
              position={[g.lat, g.lng]}
              icon={icon}
              zIndexOffset={isSelected ? 1000 : 0}
            >
              {/* Destination label — clean text below the pill, no
                  leader arrow, no pill background. Reads as a typeset
                  caption under each stop instead of a heavy callout. */}
              <Tooltip
                direction="bottom"
                offset={[0, 6]}
                opacity={1}
                permanent={true}
                className="ss-stop-label"
              >
                {g.placeName}
              </Tooltip>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Global style for the permanent tooltips — can't inject via the
          react-leaflet props, so we do it once at the module scope.
          Editorial map style: dark charcoal day pill with a small stem
          pointing at the geo location, plus a clean green destination
          caption below. No leader arrows, no opaque cards, no
          competing UI chrome. */}
      <style jsx global>{`
        /* Day pill — rounded charcoal, white text, tiny stem
           below pointing at the marker's lat/lng anchor.
           Anchored center-bottom of the icon so the stem sits ON
           the geo point. */
        .ss-day-pill {
          display: inline-flex;
          align-items: center;
          padding: 3.5px 10px;
          background: #3f3933;
          color: #ffffff;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.04em;
          line-height: 1;
          border-radius: 999px;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.22);
          white-space: nowrap;
          font-family: system-ui, sans-serif;
          position: relative;
          transform: translateY(-2px);
        }
        .ss-day-pill::after {
          content: "";
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          width: 0;
          height: 0;
          border-left: 4px solid transparent;
          border-right: 4px solid transparent;
          border-top: 5px solid #3f3933;
          filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.15));
        }
        .ss-day-pill.is-selected {
          background: #1b3a2d;
          box-shadow: 0 0 0 3px rgba(27, 58, 45, 0.18), 0 4px 10px rgba(0, 0, 0, 0.28);
        }
        .ss-day-pill.is-selected::after {
          border-top-color: #1b3a2d;
        }

        /* Destination label — typeset caption under the stem.
           No background, no border, no leader arrow. Just the place
           name in dark green so it reads as part of the map's
           editorial layer instead of a UI chip. Subtle text shadow
           keeps the label readable when it lands on a road or coast. */
        .leaflet-tooltip.ss-stop-label {
          background: transparent;
          color: #243c24;
          border: none;
          border-radius: 0;
          padding: 0;
          font-size: 11.5px;
          font-weight: 700;
          letter-spacing: 0.005em;
          box-shadow: none;
          white-space: nowrap;
          font-family: system-ui, sans-serif;
          text-shadow:
            0 0 3px rgba(247, 245, 240, 0.95),
            0 0 6px rgba(247, 245, 240, 0.85),
            0 1px 2px rgba(247, 245, 240, 0.85);
        }
        .leaflet-tooltip.ss-stop-label::before {
          display: none;
        }
      `}</style>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────

type CoordGroup = {
  startDay: number;
  endDay: number;
  dayLabel: string;   // "1" or "3-4" — rendered inside the day badge pin
  label: string;      // "Day 1 · Arusha" — kept for any callsite that wants the full string
  placeName: string;  // "Arusha" — rendered in the permanent tooltip (no day prefix)
  lat: number;
  lng: number;
};

// Merge consecutive coords with the same lat/lng into a single group so
// multi-night stays don't overplot. Tolerance is tiny (~11m) — geocoding
// returns identical coords for the same place on repeat calls.
function groupCoordsByLocation(coords: RouteCoord[]): CoordGroup[] {
  const groups: CoordGroup[] = [];
  const EPS = 0.0001;
  for (const c of coords) {
    const last = groups[groups.length - 1];
    if (last && Math.abs(last.lat - c.lat) < EPS && Math.abs(last.lng - c.lng) < EPS) {
      last.endDay = c.dayNumber;
      last.dayLabel = last.startDay === last.endDay ? `${last.startDay}` : `${last.startDay}-${last.endDay}`;
      last.label = `Day ${last.dayLabel} · ${c.label}`;
      last.placeName = c.label;
      continue;
    }
    groups.push({
      startDay: c.dayNumber,
      endDay: c.dayNumber,
      dayLabel: String(c.dayNumber),
      label: `Day ${c.dayNumber} · ${c.label}`,
      placeName: c.label,
      lat: c.lat,
      lng: c.lng,
    });
  }
  return groups;
}

// Build a custom DivIcon for a stop — dark charcoal "Day X" pill with
// a small stem pointing at the geographic anchor. Anchored bottom-
// center so the stem touches the lat/lng. Sized roughly to the pill
// content; iconSize doesn't have to be pixel-exact since these
// markers aren't click-targets.
function buildDayPill(
  L: typeof import("leaflet"),
  dayLabel: string,
  isSelected: boolean = false,
) {
  const text = `Day ${dayLabel}`;
  // Approximation — wider for longer labels (e.g. "Day 99-99").
  // Generous on the upper bound so text never clips inside the icon
  // bounding box.
  const estWidth = Math.max(54, text.length * 6.4 + 22);
  const pillHeight = 22;
  const stemHeight = 6;
  const totalHeight = pillHeight + stemHeight;
  const className = isSelected ? "ss-day-pill is-selected" : "ss-day-pill";
  return L.divIcon({
    className: "",
    html: `<div class="${className}">${escape(text)}</div>`,
    iconSize: [estWidth, totalHeight],
    iconAnchor: [estWidth / 2, totalHeight], // bottom-center → stem tip sits on lat/lng
  });
}

// ─── Leg classification + curve helpers ───────────────────────────────

type RouteLeg = {
  kind: "drive" | "flight";
  path: LatLngExpression[];
};

/** Build a list of legs between consecutive groups, classifying each
 *  by haversine distance. Drive legs are straight; flight legs are
 *  curved so two parallel flights between the same regions don't
 *  render as overlapping straight lines. */
function buildLegs(
  groups: { lat: number; lng: number }[],
  flightThresholdKm: number,
): RouteLeg[] {
  if (groups.length < 2) return [];
  const legs: RouteLeg[] = [];
  for (let i = 0; i < groups.length - 1; i++) {
    const a: LatLngTuple = [groups[i].lat, groups[i].lng];
    const b: LatLngTuple = [groups[i + 1].lat, groups[i + 1].lng];
    const km = haversineKm(a, b);
    const isFlight = km > flightThresholdKm;
    legs.push({
      kind: isFlight ? "flight" : "drive",
      path: isFlight ? buildCurvedPath([a, b], 28) : [a, b],
    });
  }
  return legs;
}

function haversineKm(a: LatLngTuple, b: LatLngTuple): number {
  const R = 6371; // km
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(x));
}

// Sub-component — mounted inside MapContainer so it has access to the
// parent's map ref. Whenever selectedGroupIndex changes to a valid value,
// flies the map to that group's coordinates.
function FlyToSelected({
  map,
  selectedGroupIndex,
  groups,
}: {
  map: { current: import("leaflet").Map | null };
  selectedGroupIndex: number;
  groups: CoordGroup[];
}) {
  useEffect(() => {
    if (selectedGroupIndex < 0 || !map.current) return;
    const g = groups[selectedGroupIndex];
    if (!g) return;
    map.current.flyTo([g.lat, g.lng], Math.max(map.current.getZoom(), 8), {
      duration: 0.9,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroupIndex]);
  return null;
}

// Expand a sequence of waypoints into a denser point list that traces a
// gentle curve through each consecutive pair. Uses a quadratic Bézier with
// a perpendicular-offset control point so the arc always bows in a
// consistent direction along the journey.
function buildCurvedPath(points: LatLngTuple[], segments: number): LatLngExpression[] {
  if (points.length < 2) return points;
  const out: LatLngTuple[] = [points[0]];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p2 = points[i + 1];
    const mx = (p0[0] + p2[0]) / 2;
    const my = (p0[1] + p2[1]) / 2;
    const dx = p2[0] - p0[0];
    const dy = p2[1] - p0[1];
    const len = Math.hypot(dx, dy) || 1;
    // Perpendicular unit vector, then offset by ~12% of segment length
    // so the bow is visible but not cartoonish.
    const nx = -dy / len;
    const ny = dx / len;
    const bow = len * 0.12;
    const cx = mx + nx * bow;
    const cy = my + ny * bow;
    for (let s = 1; s <= segments; s++) {
      const t = s / segments;
      const x = (1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * cx + t * t * p2[0];
      const y = (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * cy + t * t * p2[1];
      out.push([x, y]);
    }
  }
  return out;
}

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[c] ?? c);
}
