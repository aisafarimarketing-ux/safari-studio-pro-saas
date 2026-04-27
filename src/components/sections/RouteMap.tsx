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
}: {
  days: Day[];
  cachedCoords?: RouteCoord[];
  onCoordsResolved?: (coords: RouteCoord[]) => void;
  tokens: ThemeTokens;
  height?: number;
  /** When set, that day's pin gets a selected ring and the map flies
   *  to it. Used by the "interactive" MapSection variant. */
  selectedDayId?: string | null;
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

  // Gentle curved polyline between consecutive group centres. Keeps the
  // route feeling like a journey instead of a straight-line diagram.
  const routeLine: LatLngExpression[] = buildCurvedPath(
    groups.map((g) => [g.lat, g.lng] as LatLngTuple),
    28,
  );

  return (
    <div className="relative w-full overflow-hidden" style={{ height, background: tokens.cardBg }}>
      <MapContainer
        center={center}
        zoom={6}
        scrollWheelZoom={false}
        bounds={bounds}
        // Modest padding so markers have breathing room without being lost
        // in a sea of unrelated terrain. maxZoom of 9 lets compact routes
        // (single park / one country) zoom in tight enough that the
        // surrounding parks, lakes, and towns are *named* — that's the
        // visible-ground test the operator's customer asked for.
        // Loose bounds — lets the route spread out and exposes more
        // geography around the pins. padding raised from 40→60px so
        // markers don't kiss the edges; maxZoom lowered from 9→7 so
        // tight clusters (e.g. a single-park route) don't auto-zoom
        // in past the country-level context that makes the route
        // legible. East-African routes typically span 1-3 countries
        // and read best at zoom 5-7.
        boundsOptions={{ padding: [60, 60], maxZoom: 7 }}
        minZoom={3}
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
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          subdomains={["a", "b", "c", "d"]}
          maxZoom={19}
        />

        {groups.length > 1 && (
          <Polyline
            positions={routeLine}
            pathOptions={{
              color: tokens.accent,
              weight: 2.4,
              opacity: 0.85,
              dashArray: "4 6",
              lineCap: "round",
              lineJoin: "round",
            }}
          />
        )}

        {groups.map((g, i) => {
          const isSelected = i === selectedGroupIndex;
          const icon = leafletRef.current
            ? buildDayBadge(leafletRef.current, g.dayLabel, tokens.accent, isSelected)
            : undefined;
          return (
            <Marker
              key={`${g.lat}-${g.lng}-${g.startDay}`}
              position={[g.lat, g.lng]}
              icon={icon}
              zIndexOffset={isSelected ? 1000 : 0}
            >
              {/* direction="auto" — Leaflet flips the label to whichever
                  side has more space. Combined with the lighter pill
                  styling and re-enabled leader arrow, labels feel
                  like callouts pointing at pins instead of large
                  blocks covering the geography. */}
              <Tooltip
                direction="auto"
                offset={[0, 0]}
                opacity={1}
                permanent={true}
                className="ss-map-label"
              >
                {g.placeName}
              </Tooltip>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Legend chip — sits on the map, subtle */}
      <div
        className="absolute bottom-3 left-3 z-[500] flex items-center gap-3 px-3 py-1.5 rounded-md text-[10.5px] uppercase tracking-[0.18em]"
        style={{
          background: "rgba(255,255,255,0.92)",
          color: tokens.bodyText,
          border: `1px solid ${tokens.border}`,
          backdropFilter: "blur(4px)",
        }}
      >
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block"
            style={{ width: 10, height: 10, borderRadius: 999, background: tokens.accent }}
          />
          Stopover
        </span>
        <span style={{ opacity: 0.5 }}>·</span>
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block"
            style={{ width: 16, height: 2, background: tokens.accent, opacity: 0.6 }}
          />
          Route
        </span>
      </div>

      {/* Global style for the permanent tooltips — can't inject via the
          react-leaflet props, so we do it once at the module scope.
          Lighter pill style with a re-enabled leader arrow — the label
          reads as a callout pointing at its pin rather than a heavy
          block of text covering the geography behind it. */}
      <style jsx global>{`
        .leaflet-tooltip.ss-map-label {
          background: rgba(255, 255, 255, 0.96);
          color: rgba(13, 38, 32, 0.85);
          border: 1px solid rgba(13, 38, 32, 0.10);
          border-radius: 6px;
          padding: 3px 8px;
          font-size: 10.5px;
          font-weight: 600;
          letter-spacing: 0.01em;
          box-shadow: 0 4px 10px -2px rgba(13, 38, 32, 0.18);
          white-space: nowrap;
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
        }
        /* Leader arrow — points back at the pin. Color must match the
           pill's background; border is omitted so it looks like a
           seamless extension of the callout. Leaflet auto-flips this
           to the opposite side based on direction="auto". */
        .leaflet-tooltip.ss-map-label::before {
          display: block;
          border-color: transparent !important;
        }
        .leaflet-tooltip-top.ss-map-label::before {
          border-top-color: rgba(255, 255, 255, 0.96) !important;
          margin-bottom: -7px;
        }
        .leaflet-tooltip-bottom.ss-map-label::before {
          border-bottom-color: rgba(255, 255, 255, 0.96) !important;
          margin-top: -7px;
        }
        .leaflet-tooltip-left.ss-map-label::before {
          border-left-color: rgba(255, 255, 255, 0.96) !important;
        }
        .leaflet-tooltip-right.ss-map-label::before {
          border-right-color: rgba(255, 255, 255, 0.96) !important;
        }
        .ss-day-badge {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 30px;
          height: 30px;
          border-radius: 999px;
          color: white;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.02em;
          box-shadow: 0 3px 8px rgba(13, 38, 32, 0.32);
          border: 2px solid white;
          font-family: system-ui, sans-serif;
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

// Build a custom DivIcon for a pin that shows the day number (or range)
// as a tinted circular badge. Selected pins get a double-ring + scale-up
// so the eye tracks where the current lodge sits.
function buildDayBadge(
  L: typeof import("leaflet"),
  dayLabel: string,
  color: string,
  isSelected: boolean = false,
) {
  // Smaller pin (30px default, 38px when selected) — matches the
  // lighter callout style and stops the markers from dominating the
  // map at typical safari-route zoom levels.
  const size = isSelected ? 38 : 30;
  const extraStyle = isSelected
    ? `transform:scale(1.1);box-shadow:0 0 0 4px ${color}28, 0 6px 18px rgba(0,0,0,0.28);`
    : "";
  return L.divIcon({
    className: "",
    html: `<div class="ss-day-badge" style="background:${color};${extraStyle}">${escape(dayLabel)}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
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
