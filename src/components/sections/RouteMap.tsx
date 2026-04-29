"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { LatLngExpression, LatLngTuple } from "leaflet";
import type { Day, ThemeTokens } from "@/lib/types";
import { isCoastCity } from "@/lib/safariRoutingRules";

// Leaflet needs the DOM, so dynamic-import with ssr: false. The map tiles
// come from Carto (Voyager style) — no API key, more colourful than raw
// OSM without going illustrated.

const MapContainer = dynamic(() => import("react-leaflet").then((m) => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then((m) => m.TileLayer), { ssr: false });
const Marker = dynamic(() => import("react-leaflet").then((m) => m.Marker), { ssr: false });
const Tooltip = dynamic(() => import("react-leaflet").then((m) => m.Tooltip), { ssr: false });
const Polyline = dynamic(() => import("react-leaflet").then((m) => m.Polyline), { ssr: false });

// ─── Known safari coords ──────────────────────────────────────────────────
//
// Hard-coded coordinates for the most common East African safari stops.
// We hit these BEFORE the Nominatim round-trip so:
//   - Arusha resolves in Tanzania (not Kenya / not "Arusha, USA")
//   - National parks resolve to their gate / centre, not a random town
//     of the same name
//   - The map renders instantly with no API call for the typical trip
//
// Match is case-insensitive on the destination name. Country in the
// proposal is ignored for these (the canonical coord is the source of
// truth). Anything not in this table still falls through to the API
// resolver for unfamiliar places.

const KNOWN_SAFARI_COORDS: Array<{
  match: RegExp;
  lat: number;
  lng: number;
  label?: string;
}> = [
  // ── Tanzania ──
  { match: /^arusha\b/i,                      lat: -3.3869, lng: 36.6829 },
  { match: /^moshi\b/i,                       lat: -3.3494, lng: 37.3408 },
  { match: /^kilimanjaro\b/i,                 lat: -3.0674, lng: 37.3556 },
  { match: /^tarangire\b/i,                   lat: -3.8333, lng: 36.0000 },
  { match: /^lake manyara\b|^manyara\b/i,     lat: -3.5833, lng: 35.8333 },
  { match: /^ngorongoro\b/i,                  lat: -3.2000, lng: 35.5000 },
  { match: /^serengeti\b/i,                   lat: -2.3333, lng: 34.8333 },
  { match: /^ruaha\b/i,                       lat: -7.4500, lng: 34.6500 },
  { match: /^selous\b|^nyerere\b/i,           lat: -8.5000, lng: 37.5000 },
  { match: /^mahale\b/i,                      lat: -6.1167, lng: 29.8500 },
  { match: /^katavi\b/i,                      lat: -6.7833, lng: 31.1500 },
  { match: /^zanzibar\b|^stone town\b/i,      lat: -6.1659, lng: 39.2026 },
  { match: /^pemba\b/i,                       lat: -5.0500, lng: 39.7833 },
  { match: /^mafia\b/i,                       lat: -7.9000, lng: 39.7500 },
  { match: /^dar es salaam\b|^dar\b/i,        lat: -6.7924, lng: 39.2083 },
  // ── Kenya ──
  { match: /^nairobi\b/i,                     lat: -1.2864, lng: 36.8172 },
  { match: /^masai mara\b|^maasai mara\b|^the mara\b/i,
                                              lat: -1.5000, lng: 35.1500 },
  { match: /^amboseli\b/i,                    lat: -2.6500, lng: 37.2667 },
  { match: /^tsavo east\b/i,                  lat: -2.7500, lng: 38.7500 },
  { match: /^tsavo west\b/i,                  lat: -3.0000, lng: 38.0000 },
  { match: /^samburu\b/i,                     lat:  0.5500, lng: 37.5333 },
  { match: /^laikipia\b/i,                    lat:  0.4000, lng: 36.9000 },
  { match: /^lake nakuru\b|^nakuru\b/i,       lat: -0.3667, lng: 36.0833 },
  { match: /^lake naivasha\b|^naivasha\b/i,   lat: -0.7167, lng: 36.4333 },
  { match: /^ol pejeta\b|^ol pejeta\b/i,      lat:  0.0000, lng: 36.9000 },
  { match: /^meru\b/i,                        lat:  0.1500, lng: 38.2000 },
  { match: /^mount kenya\b/i,                 lat: -0.1521, lng: 37.3083 },
  { match: /^diani\b/i,                       lat: -4.3000, lng: 39.5833 },
  { match: /^lamu\b/i,                        lat: -2.2717, lng: 40.9020 },
  { match: /^mombasa\b/i,                     lat: -4.0435, lng: 39.6682 },
  // ── Rwanda / Uganda ──
  { match: /^volcanoes\b|^musanze\b/i,        lat: -1.4833, lng: 29.5500 },
  { match: /^kigali\b/i,                      lat: -1.9441, lng: 30.0619 },
  { match: /^bwindi\b/i,                      lat: -1.0500, lng: 29.7000 },
  { match: /^queen elizabeth\b|^kasese\b/i,   lat: -0.2000, lng: 30.0500 },
  { match: /^murchison falls\b|^murchison\b/i,lat:  2.2700, lng: 31.6900 },
  { match: /^entebbe\b/i,                     lat:  0.0470, lng: 32.4630 },
  { match: /^kampala\b/i,                     lat:  0.3476, lng: 32.5825 },
  // ── Botswana / Zimbabwe / Zambia / South Africa ──
  { match: /^okavango\b/i,                    lat: -19.5000, lng: 22.7500 },
  { match: /^victoria falls\b|^vic falls\b/i, lat: -17.9243, lng: 25.8572 },
  { match: /^cape town\b/i,                   lat: -33.9249, lng: 18.4241 },
  { match: /^kruger\b/i,                      lat: -23.9884, lng: 31.5547 },
];

function lookupKnownCoord(destination: string): { lat: number; lng: number } | null {
  const name = (destination ?? "").trim();
  if (!name) return null;
  for (const entry of KNOWN_SAFARI_COORDS) {
    if (entry.match.test(name)) return { lat: entry.lat, lng: entry.lng };
  }
  return null;
}

// ─── Types ────────────────────────────────────────────────────────────────

export type RouteCoord = {
  dayId: string;
  dayNumber: number;
  label: string;
  lat: number;
  lng: number;
  /** How the traveller gets to the NEXT stop. Threaded from Day so
   *  the leg classifier prefers explicit operator intent over the
   *  haversine fallback. */
  transportToNext?: "drive" | "flight" | null;
  /** Per-stop label placement override. "auto" = let Leaflet pick. */
  labelPosition?: "top" | "bottom" | "left" | "right" | "auto";
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

        // Known-safari-coords first — guarantees Arusha is in
        // Tanzania and Tarangire / Serengeti / Ngorongoro / Mara
        // sit on the right park boundaries instead of whatever
        // Nominatim returns for an ambiguous query. No round-trip
        // needed for the typical safari trip.
        const known = lookupKnownCoord(day.destination);
        if (known) {
          seen.set(key, {
            dayId: day.id,
            dayNumber: day.dayNumber,
            label: day.destination,
            lat: known.lat,
            lng: known.lng,
          });
          continue;
        }

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
        .map(({ day, key }): RouteCoord | null => {
          const c = resolved.get(key);
          if (!c) return null;
          return {
            dayId: day.id,
            dayNumber: day.dayNumber,
            label: day.destination,
            lat: c.lat,
            lng: c.lng,
            transportToNext: day.transportToNext ?? null,
            labelPosition: day.labelPosition ?? "auto",
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

  // Two-tier grouping:
  //
  //   `groups` — chronological. Consecutive same-coord days collapse
  //   into one entry ("Day 3-4 · Serengeti"), but a NON-adjacent
  //   revisit (Day 1 Arusha then Day 7 Arusha) stays as two separate
  //   entries. Used for the ROUTE LINE so the polyline correctly
  //   traces A→M→...→A and the journey reads as a loop.
  //
  //   `markerGroups` — visual. All entries at the same coord merge
  //   into one marker with combined day labels ("Day 1 & 7"). Used
  //   for the MARKERS so two visits to Arusha don't stack pins on
  //   the same pixel. Without this, return-to-base trips render as
  //   a single overlapping pile of identical pins.
  const groups = groupCoordsByLocation(coords);
  const markerGroups = mergeMarkerGroupsByCoord(groups);

  // Which marker group contains the selected day (if any)?
  const selectedGroupIndex = selectedDayId
    ? markerGroups.findIndex((g) =>
        coords.some(
          (c) => c.dayId === selectedDayId && Math.abs(c.lat - g.lat) < 0.0001 && Math.abs(c.lng - g.lng) < 0.0001,
        ),
      )
    : -1;

  // ── Smart viewport ──
  //
  // Naive `fitBounds(allCoords)` over-zooms-out when an itinerary has
  // a far-flung outlier (e.g. Zanzibar 700km from a Tanzanian
  // mainland circuit). The mainland safari clusters into a tiny
  // corner of the map and the rest is empty ocean / unused land.
  //
  // Algorithm: detect the "core" stops — anything within
  // CORE_THRESHOLD_KM of the route centroid. Compute bounds from
  // the core only. Then expand the bounds toward each outlier by a
  // fraction of the gap so the outlier just lands inside the view
  // with minimal extra emptiness. This frames the core as the
  // dominant subject while still showing distant stops.
  // Viewport calc uses MARKER groups (deduped by coord) so a Day 1 +
  // Day 7 Arusha doesn't double-count Arusha's coord and skew the
  // outlier-detection median.
  const viewport = computeViewport(markerGroups);

  // Split adjacent legs into "circuit" (solid) and "transfer" (dashed
  // curve). Long-haul legs above TRANSFER_THRESHOLD_KM render as a
  // gentle Bézier curve so they read as a flight rather than an
  // implausibly straight 700km drive over ocean.
  const TRANSFER_THRESHOLD_KM = 250;
  const legPaths = buildLegPaths(groups, TRANSFER_THRESHOLD_KM);

  return (
    <div className="relative w-full overflow-hidden" style={{ height, background: tokens.cardBg }}>
      <MapContainer
        center={viewport.center}
        zoom={6}
        scrollWheelZoom={false}
        bounds={viewport.bounds}
        // Padding 20px (tight) — combined with computeViewport's
        // outlier-bias, keeps the core route filling 70-80% of the
        // visible map. maxZoom 9 prevents over-zoom on a tight
        // single-region itinerary (would otherwise show city streets,
        // looking like Google Maps not a route diagram).
        boundsOptions={{ padding: [20, 20], maxZoom: 9 }}
        minZoom={5}
        maxZoom={12}
        inertia={false}
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
          groups={markerGroups}
        />
        <RefitOnResize map={mapRef} viewport={viewport} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          // Carto Positron NO LABELS — quietest possible basemap.
          // Landmass + water + soft terrain, but no town / road / park
          // labels fighting the route. The destination labels we DO
          // need come from our own permanent Tooltips on each marker.
          url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
          subdomains={["a", "b", "c", "d"]}
          maxZoom={19}
        />

        {/* Per-leg rendering. Short circuit hops render as one continuous
            solid charcoal polyline (built up leg-by-leg so adjacent
            short legs share a single visual path). Long transfers
            (>250km) render as a soft dashed curve so they read as
            "flight to a distant region" rather than an implausibly
            straight road over ocean. */}
        {legPaths.map((leg, i) => (
          <Polyline
            key={`leg-${i}`}
            positions={leg.path}
            pathOptions={leg.kind === "transfer"
              ? {
                  color: "#243c24",
                  weight: 1.8,
                  opacity: 0.62,
                  dashArray: "4 6",
                  lineCap: "round",
                  lineJoin: "round",
                }
              : {
                  color: "#243c24",
                  weight: 2.5,
                  opacity: 0.92,
                  lineCap: "round",
                  lineJoin: "round",
                }
            }
          />
        ))}

        {/* Directional arrows — one per leg, at the midpoint, rotated
            in the direction of travel. Subtle (charcoal triangle on
            cream chip) so they cue flow without competing with pills.
            Skipped on very short legs (<25km) to avoid clutter when
            two stops sit close together. */}
        {leafletRef.current && legPaths.map((leg, i) => {
          if (leg.skipArrow) return null;
          const [a, b] = leg.endpoints;
          const midLat = (a[0] + b[0]) / 2;
          const midLng = (a[1] + b[1]) / 2;
          const angleDeg =
            (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
          return (
            <Marker
              key={`arrow-${i}`}
              position={[midLat, midLng]}
              icon={buildArrowIcon(leafletRef.current!, angleDeg)}
              interactive={false}
              keyboard={false}
              zIndexOffset={-50}
            />
          );
        })}

        {markerGroups.map((g, i) => {
          const isSelected = i === selectedGroupIndex;
          const icon = leafletRef.current
            ? buildDayPill(leafletRef.current, g.dayLabel, isSelected)
            : undefined;
          // Per-stop labelPosition or "auto". Leaflet's Tooltip
          // direction prop accepts the same set of values minus
          // "auto"; we map "auto" → undefined to fall back to its
          // built-in side picker.
          const direction =
            g.labelPosition && g.labelPosition !== "auto"
              ? g.labelPosition
              : "auto";
          return (
            <Marker
              key={`${g.lat}-${g.lng}-${g.startDay}`}
              position={[g.lat, g.lng]}
              icon={icon}
              zIndexOffset={isSelected ? 1000 : 0}
            >
              {/* Destination label — clean text near the pill, no
                  leader arrow, no pill background. Reads as a typeset
                  caption next to each stop. Direction respects the
                  operator's per-stop labelPosition override. */}
              <Tooltip
                direction={direction}
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
        /* Day pill — slightly bigger for visibility on the editorial
           route diagram. Charcoal background, white text, tiny stem
           pointing at the geo anchor. */
        .ss-day-pill {
          display: inline-flex;
          align-items: center;
          padding: 5px 13px;
          background: #243c24;
          color: #ffffff;
          font-size: 12.5px;
          font-weight: 600;
          letter-spacing: 0.04em;
          line-height: 1;
          border-radius: 999px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
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
          border-left: 5px solid transparent;
          border-right: 5px solid transparent;
          border-top: 6px solid #243c24;
          filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.15));
        }
        .ss-day-pill.is-selected {
          background: #1b3a2d;
          box-shadow: 0 0 0 3px rgba(27, 58, 45, 0.20), 0 4px 12px rgba(0, 0, 0, 0.30);
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

        /* Directional arrow chip — small cream circle with a charcoal
           triangle inside. Rotated by the leg's bearing so the tip
           always points downstream. Pointer-events disabled so it
           never steals clicks from the day pills underneath. */
        .ss-arrow-chip {
          width: 18px;
          height: 18px;
          border-radius: 999px;
          background: rgba(247, 245, 240, 0.95);
          border: 1px solid rgba(36, 60, 36, 0.18);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.10);
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
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
  /** Carried from the LAST day in the group — that's the "to next"
   *  transport for the move that follows this stay. */
  transportToNext?: "drive" | "flight" | null;
  /** Placement override carried from the FIRST day in the group. */
  labelPosition?: "top" | "bottom" | "left" | "right" | "auto";
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
      // The departure transport reflects the LAST day of the group —
      // which is the day the traveller actually leaves. Override.
      last.transportToNext = c.transportToNext ?? null;
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
      transportToNext: c.transportToNext ?? null,
      labelPosition: c.labelPosition ?? "auto",
    });
  }
  return groups;
}

// Merge non-adjacent same-coord groups into a single marker group.
// The chronological `groups` list is preserved separately for the
// route polyline (which correctly traces A→B→C→A on a return-to-base
// trip), but the MAP only needs one pin per unique location with all
// the day labels it represents.
//
// Example:
//   groups = [
//     { dayLabel: "1", placeName: "Arusha", lat: -3.4, lng: 36.7 },
//     { dayLabel: "2-4", placeName: "Serengeti", lat: -2.3, lng: 34.8 },
//     { dayLabel: "5", placeName: "Manyara", lat: -3.6, lng: 35.8 },
//     { dayLabel: "7", placeName: "Arusha", lat: -3.4, lng: 36.7 },
//   ]
// →
//   markerGroups = [
//     { dayLabel: "1 & 7", placeName: "Arusha", ... },
//     { dayLabel: "2-4",  placeName: "Serengeti", ... },
//     { dayLabel: "5",    placeName: "Manyara", ... },
//   ]
function mergeMarkerGroupsByCoord(groups: CoordGroup[]): CoordGroup[] {
  const byKey = new Map<string, CoordGroup>();
  const order: string[] = [];
  const PREC = 4;
  for (const g of groups) {
    const key = `${g.lat.toFixed(PREC)},${g.lng.toFixed(PREC)}`;
    const existing = byKey.get(key);
    if (existing) {
      // Combine day labels: "1" + "7" → "1 & 7", "3-4" + "8" → "3-4 & 8"
      existing.dayLabel = `${existing.dayLabel} & ${g.dayLabel}`;
      existing.label = `Day ${existing.dayLabel} · ${existing.placeName}`;
    } else {
      byKey.set(key, { ...g });
      order.push(key);
    }
  }
  return order.map((k) => byKey.get(k)!);
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

// ─── Smart viewport helpers ──────────────────────────────────────────────

type Viewport = {
  center: LatLngExpression;
  bounds: [LatLngTuple, LatLngTuple];
};

/**
 * Pick a camera frame that keeps the *core* route dominant even when one
 * stop sits far from the rest (Zanzibar from a Tanzanian mainland circuit
 * is the canonical case — naive fitBounds would shrink Arusha + Tarangire
 * + Serengeti into a tiny corner).
 *
 * Algorithm:
 *   1. Centroid of all stops.
 *   2. Median distance from centroid (robust against single far points).
 *   3. Stops ≤ 2.5× median are CORE; the rest are OUTLIERS.
 *   4. If no outliers, fit the full set tightly.
 *   5. With outliers: start with core bounds, then expand each side
 *      toward outliers by ONLY ENOUGH to include them with a small
 *      margin. Net: core route fills 65-80% of the frame, outliers
 *      land near the visible edge with a curved/dashed line drawing
 *      the eye out to them.
 */
function computeViewport(groups: CoordGroup[]): Viewport {
  if (groups.length === 0) {
    return {
      center: [0, 0] as LatLngExpression,
      bounds: [[0, 0], [0, 0]],
    };
  }
  if (groups.length === 1) {
    const g = groups[0];
    // Single-point trip — frame ~1° around the point so the basemap
    // shows context without snapping to street level.
    return {
      center: [g.lat, g.lng] as LatLngExpression,
      bounds: [
        [g.lat - 0.5, g.lng - 0.5],
        [g.lat + 0.5, g.lng + 0.5],
      ],
    };
  }

  // Coast / beach destinations are excluded from viewport calculation.
  // Why: a typical East-African itinerary mixes a tight inland safari
  // circuit (Arusha → Tarangire → Manyara → Serengeti, all within
  // ~300km of each other) with a far-flung beach extension (Zanzibar,
  // Mombasa, Diani, 700km+ off the coast). If the bounds try to
  // include both, the safari circuit collapses into a tiny corner of
  // the map and the route lines + day labels crowd into an unreadable
  // cluster — which is exactly what operators reported.
  //
  // Solution: fit bounds to the inland stops only. Coast markers still
  // render — they're just off the initial viewport. Clients can click
  // a coast day in the side rail and FlyToSelected will pan/zoom there
  // smoothly. The route line going to the coast disappears at the
  // viewport edge, naturally communicating "the trip continues offshore".
  //
  // Edge case: an entirely-coastal trip (Diani + Mombasa + Watamu) has
  // no inland stops; we fall back to fitting all groups. Same for any
  // trip we can't classify (operators with niche destinations the
  // table doesn't know).
  const inland = groups.filter((g) => !isCoastCity(g.placeName));
  const fitGroups = inland.length >= 2 ? inland : groups;

  const lats = fitGroups.map((g) => g.lat);
  const lngs = fitGroups.map((g) => g.lng);
  let south = Math.min(...lats);
  let north = Math.max(...lats);
  let west = Math.min(...lngs);
  let east = Math.max(...lngs);

  // Small breathing-room expansion so the outermost markers don't sit
  // flush against the viewport edge. 8% of the route span on each
  // side, combined with leaflet's boundsOptions padding, leaves the
  // markers comfortably inside the visible map without wasting space.
  const BREATHING = 0.08;
  const latSpan = north - south;
  const lngSpan = east - west;
  south -= latSpan * BREATHING;
  north += latSpan * BREATHING;
  west -= lngSpan * BREATHING;
  east += lngSpan * BREATHING;

  // Floor — don't return a degenerate bounds. If two stops happen to
  // sit on the same point, give the camera ~1° of context.
  const MIN_SPAN = 0.4;
  if (north - south < MIN_SPAN) {
    const pad = (MIN_SPAN - (north - south)) / 2;
    south -= pad;
    north += pad;
  }
  if (east - west < MIN_SPAN) {
    const pad = (MIN_SPAN - (east - west)) / 2;
    west -= pad;
    east += pad;
  }

  return {
    center: [(south + north) / 2, (west + east) / 2] as LatLngExpression,
    bounds: [
      [south, west],
      [north, east],
    ],
  };
}

// ─── Leg path builder ────────────────────────────────────────────────────

type LegPath = {
  kind: "circuit" | "transfer";
  path: LatLngExpression[];
  /** Endpoints used for arrow placement / bearing. Always [from, to]
   *  even for curved transfer legs. */
  endpoints: [LatLngTuple, LatLngTuple];
  /** Skip the directional-arrow chip on legs shorter than ~25km
   *  (e.g. two stops in the same region) to avoid clutter. */
  skipArrow: boolean;
};

/**
 * For each adjacent pair of groups, classify by haversine distance:
 *   - ≤ transferThresholdKm → "circuit" (solid straight line)
 *   - > transferThresholdKm → "transfer" (dashed curved arc)
 *
 * Curve uses a quadratic Bézier with a perpendicular-offset control
 * point so the arc bows consistently. Curved transfers visually
 * differentiate long-haul flights / road moves from the dense
 * mainland circuit.
 */
function buildLegPaths(
  groups: CoordGroup[],
  transferThresholdKm: number,
): LegPath[] {
  if (groups.length < 2) return [];
  const out: LegPath[] = [];
  for (let i = 0; i < groups.length - 1; i++) {
    const a: LatLngTuple = [groups[i].lat, groups[i].lng];
    const b: LatLngTuple = [groups[i + 1].lat, groups[i + 1].lng];
    const distKm = haversineKm(a, b);
    const kind: "circuit" | "transfer" =
      distKm > transferThresholdKm ? "transfer" : "circuit";
    out.push({
      kind,
      path: kind === "transfer" ? buildBezierArc(a, b, 24, 0.14) : [a, b],
      endpoints: [a, b],
      skipArrow: distKm < 25,
    });
  }
  return out;
}

function buildBezierArc(
  a: LatLngTuple,
  b: LatLngTuple,
  segments: number,
  bowFraction: number,
): LatLngExpression[] {
  // Perpendicular-offset control point — bow scales with segment
  // length so a Mara → Zanzibar leg curves visibly without becoming
  // cartoonish on a short Tarangire → Serengeti hop.
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const bow = len * bowFraction;
  const cx = (a[0] + b[0]) / 2 + nx * bow;
  const cy = (a[1] + b[1]) / 2 + ny * bow;
  const pts: LatLngTuple[] = [a];
  for (let s = 1; s <= segments; s++) {
    const t = s / segments;
    const x = (1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * cx + t * t * b[0];
    const y = (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * cy + t * t * b[1];
    pts.push([x, y]);
  }
  return pts;
}

function haversineKm(a: LatLngTuple, b: LatLngTuple): number {
  const R = 6371;
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

// Build a small directional-arrow icon — equilateral triangle in a
// soft cream chip, rotated to follow the leg's bearing. Triangle
// points in the direction of travel.
function buildArrowIcon(L: typeof import("leaflet"), angleDeg: number) {
  const SIZE = 18;
  const html =
    `<div class="ss-arrow-chip" style="transform: rotate(${angleDeg}deg);">` +
    `<svg viewBox="0 0 12 12" width="9" height="9" aria-hidden>` +
    `<path d="M6 1.5 L10.5 10 L6 8 L1.5 10 Z" fill="#243c24"/>` +
    `</svg>` +
    `</div>`;
  return L.divIcon({
    className: "",
    html,
    iconSize: [SIZE, SIZE],
    iconAnchor: [SIZE / 2, SIZE / 2],
  });
}

// Re-fit bounds whenever the container's pixel size changes.
// Critical because the route variant has a 240px rail to the LEFT of
// the map column — fitBounds runs on first mount with the map's
// initial pixel width, but that width changes as Leaflet finishes
// measuring + the page lays out. Without this observer the camera
// stays at the initial (wrong) zoom and the route ends up clipped
// or floats to one side.
function RefitOnResize({
  map, viewport,
}: {
  map: { current: import("leaflet").Map | null };
  viewport: Viewport;
}) {
  useEffect(() => {
    if (!map.current) return;
    const m = map.current;
    const refit = () => {
      try {
        m.invalidateSize();
        m.fitBounds(viewport.bounds, {
          padding: [20, 20],
          maxZoom: 9,
          animate: false,
        });
      } catch {
        // Map disposed during refit — safe to ignore.
      }
    };
    // Initial invalidate after first paint — covers the case where the
    // container width settled AFTER the MapContainer's initial mount.
    const t = window.setTimeout(refit, 80);
    // Resize observer for any subsequent layout changes (sidebar
    // toggling, window resize, font load shift).
    const container = m.getContainer();
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(refit);
      ro.observe(container);
    }
    return () => {
      window.clearTimeout(t);
      if (ro) ro.disconnect();
    };
  }, [map, viewport]);
  return null;
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

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[c] ?? c);
}
