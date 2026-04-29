"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { LatLngExpression, LatLngTuple } from "leaflet";
import type { Day, ThemeTokens } from "@/lib/types";
import { isCoastCity } from "@/lib/safariRoutingRules";

// ─── Map design rules — DO NOT RELAX WITHOUT OPERATOR SIGN-OFF ───────────
//
// Each rule below was added because the previous behaviour produced a
// real complaint from the operator during a marathon design-review pass.
// Don't unwind any of them when refactoring.
//
//   1. The map is a SCHEMATIC, not a strict-geography atlas. Coast
//      destinations (Zanzibar, Mombasa, Diani, Watamu, Lamu, Pemba,
//      Mafia, Nungwi, etc.) are compressed to 40% of their real
//      distance from the inland centroid via compressCoastPositions().
//      Direction preserved, distance shrunk. Inland stops untouched.
//      Real coords still live on `coords` / `rawMarkerGroups` so
//      click-to-fly selection by lat/lng still resolves correctly.
//
//   2. INLAND SAFARI CIRCUIT DOMINATES THE VIEWPORT.
//      boundsOptions: maxZoom 10, padding [36, 36]. computeViewport
//      uses 2% internal breathing-room expansion. The schematic
//      compression in (1) is what keeps coast outliers inside the
//      frame instead of blowing the bounds out across the ocean.
//
//   3. CLOSE MARKER PILLS DIVERGE across the four sides of their
//      anchor. assignPillDirections() finds every pair within 60km
//      and assigns members alternating up → down → right → left
//      (sorted by start day for stability). buildDayPill honours
//      the direction; oppositeDirection() mirrors the place-name
//      tooltip to the far side so pill + caption never collide.
//      Tarangire ↔ Manyara (~33km) was the canonical bug.
//
//   4. TRANSFER FLIGHTS CURVE AWAY from the safari circuit.
//      buildLegPaths computes the inland centroid as an avoid-point
//      and passes it to buildBezierArc, which flips its perpendicular
//      bow vector when it would otherwise curve toward that point.
//      Bow fraction 0.18. The Serengeti → Zanzibar leg must swing
//      OUT over open territory, never slice through Tarangire /
//      Manyara / Serengeti.
//
// Memory anchor: ~/.claude/.../memory/map_and_routing_rules.md
// ─────────────────────────────────────────────────────────────────────────

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
  const rawGroups = groupCoordsByLocation(coords);
  const rawMarkerGroups = mergeMarkerGroupsByCoord(rawGroups);

  // Schematic-positioning pass — coast destinations (Zanzibar,
  // Mombasa, Diani, etc.) get pulled toward the inland centroid so
  // they read on the map without forcing a fully-zoomed-out
  // Tanzania-+-Indian-Ocean view that crushes the safari circuit
  // into a corner. Real direction is preserved, only the distance
  // shrinks. The day-pill still shows "Day 5 · Zanzibar" so clients
  // know the actual stop; the placement is editorial, not geographic.
  // Inland stops are unchanged.
  const groups = compressCoastPositions(rawGroups);
  const markerGroups = compressCoastPositions(rawMarkerGroups);

  // For each marker, compute which side of its anchor the pill should
  // float on so close pairs (Tarangire ↔ Lake Manyara, ~33km) don't
  // overlap each other. Cluster members get assigned alternating
  // directions (up / down / left / right) cycling through the four
  // sides — anything beyond a 4-way cluster falls back to "up", which
  // is unlikely to occur on a single safari circuit.
  const pillDirections = assignPillDirections(markerGroups);

  // Which marker group contains the selected day (if any)? Matches by
  // REAL lat/lng (rawMarkerGroups) since `coords` carries the
  // operator's actual coordinates — the compressed `markerGroups`
  // wouldn't line up for coast destinations. Returned index is still
  // valid for the parallel compressed array.
  const selectedGroupIndex = selectedDayId
    ? rawMarkerGroups.findIndex((g) =>
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
        // Padding 36px — gives day badges + tooltips clear breathing
        // room from the viewport edge. The bounds in computeViewport
        // already use a tiny 2% breathing-room expansion; this
        // pixel-based padding does the rest. Larger than 36px starts
        // to compress the route on multi-region trips (safari + coast).
        // maxZoom 9 prevents over-zoom on a tight single-region
        // itinerary (would otherwise show city streets, looking like
        // Google Maps not a route diagram).
        boundsOptions={{ padding: [36, 36], maxZoom: 9 }}
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
          const pillDir = pillDirections[i];
          const icon = leafletRef.current
            ? buildDayPill(leafletRef.current, g.dayLabel, isSelected, pillDir)
            : undefined;
          // Tooltip direction follows the pill — when the pill floats
          // above the anchor (default), the place-name caption sits
          // below it; when the pill swings down/left/right, the caption
          // mirrors the opposite side so they don't collide. An
          // explicit operator override (g.labelPosition) still wins.
          const tooltipDir =
            g.labelPosition && g.labelPosition !== "auto"
              ? g.labelPosition
              : oppositeDirection(pillDir);
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
                direction={tooltipDir}
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
          width: 0;
          height: 0;
          filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.15));
        }
        /* Stem direction variants — the stem tip always sits on the
           lat/lng anchor, so the four directions just rotate the same
           tiny triangle around the pill. */
        .ss-day-pill-up::after {
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          border-left: 5px solid transparent;
          border-right: 5px solid transparent;
          border-top: 6px solid #243c24;
        }
        .ss-day-pill-down::after {
          bottom: 100%;
          left: 50%;
          transform: translateX(-50%);
          border-left: 5px solid transparent;
          border-right: 5px solid transparent;
          border-bottom: 6px solid #243c24;
        }
        .ss-day-pill-right::after {
          right: 100%;
          top: 50%;
          transform: translateY(-50%);
          border-top: 5px solid transparent;
          border-bottom: 5px solid transparent;
          border-right: 6px solid #243c24;
        }
        .ss-day-pill-left::after {
          left: 100%;
          top: 50%;
          transform: translateY(-50%);
          border-top: 5px solid transparent;
          border-bottom: 5px solid transparent;
          border-left: 6px solid #243c24;
        }
        .ss-day-pill.is-selected {
          background: #1b3a2d;
          box-shadow: 0 0 0 3px rgba(27, 58, 45, 0.20), 0 4px 12px rgba(0, 0, 0, 0.30);
        }
        .ss-day-pill-up.is-selected::after { border-top-color: #1b3a2d; }
        .ss-day-pill-down.is-selected::after { border-bottom-color: #1b3a2d; }
        .ss-day-pill-right.is-selected::after { border-right-color: #1b3a2d; }
        .ss-day-pill-left.is-selected::after { border-left-color: #1b3a2d; }

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

// Spread close marker pills across different sides of their anchors so
// destinations < ~60km apart (Tarangire ↔ Lake Manyara, Manyara ↔
// Karatu, Tarangire ↔ Karatu, etc.) don't pile their pills on top of
// each other at typical safari-circuit zoom levels.
//
// Algorithm: for each marker, find every other marker within
// PROXIMITY_KM. If any exist, the marker is part of a "close cluster".
// Each cluster member is assigned a direction in turn — the first
// member keeps "up", the second goes "down", third "right", fourth
// "left", then it wraps. Markers with no close neighbours stay "up".
//
// We use deterministic ordering (stable sort by start day) so the
// same trip always yields the same pill directions across renders.
function assignPillDirections(groups: CoordGroup[]): PillDirection[] {
  const PROXIMITY_KM = 60;
  const cycle: PillDirection[] = ["up", "down", "right", "left"];
  const dirs: PillDirection[] = groups.map(() => "up");

  for (let i = 0; i < groups.length; i++) {
    const me = groups[i];
    // Build a cluster: this marker plus every other marker within
    // PROXIMITY_KM. Sort by start day so cluster ordering is stable.
    const cluster: number[] = [i];
    for (let j = 0; j < groups.length; j++) {
      if (j === i) continue;
      const dist = haversineKm([me.lat, me.lng], [groups[j].lat, groups[j].lng]);
      if (dist < PROXIMITY_KM) cluster.push(j);
    }
    if (cluster.length < 2) continue; // no close neighbours, keep "up"
    cluster.sort((a, b) => groups[a].startDay - groups[b].startDay);
    const myPos = cluster.indexOf(i);
    dirs[i] = cycle[myPos % cycle.length];
  }

  return dirs;
}

// Opposite of a pill direction — used to place the destination tooltip
// on the far side of the anchor from the pill, so pill and caption
// never collide.
function oppositeDirection(d: PillDirection): "top" | "bottom" | "left" | "right" {
  switch (d) {
    case "up": return "bottom";
    case "down": return "top";
    case "right": return "left";
    case "left": return "right";
  }
}

// Pill direction relative to its lat/lng anchor.
//   "up"    — pill sits ABOVE the anchor, stem points down (default)
//   "down"  — pill sits BELOW the anchor, stem points up
//   "right" — pill sits TO THE RIGHT of the anchor, stem points left
//   "left"  — pill sits TO THE LEFT of the anchor, stem points right
//
// Used to spread pills apart when two destinations sit close together
// in lat/lng (e.g. Tarangire ↔ Lake Manyara, ~33km — they overlap at
// the safari-circuit zoom).
type PillDirection = "up" | "down" | "left" | "right";

// Build a custom DivIcon for a stop — dark charcoal "Day X" pill with
// a small stem pointing at the geographic anchor. Direction controls
// which side of the anchor the pill floats on; anchor placement and
// stem orientation update in lock-step so the stem tip always lands
// on the lat/lng.
function buildDayPill(
  L: typeof import("leaflet"),
  dayLabel: string,
  isSelected: boolean = false,
  direction: PillDirection = "up",
) {
  const text = `Day ${dayLabel}`;
  // Approximation — wider for longer labels (e.g. "Day 99-99").
  // Generous on the upper bound so text never clips inside the icon
  // bounding box.
  const pillWidth = Math.max(54, text.length * 6.4 + 22);
  const pillHeight = 22;
  const stem = 6;
  const sel = isSelected ? " is-selected" : "";
  const className = `ss-day-pill ss-day-pill-${direction}${sel}`;
  const html = `<div class="${className}">${escape(text)}</div>`;

  // For each direction the icon's bounding box and anchor differ:
  //   up    → box extends up from anchor; anchor at bottom-centre
  //   down  → box extends down from anchor; anchor at top-centre
  //   right → box extends right from anchor; anchor at left-centre
  //   left  → box extends left from anchor; anchor at right-centre
  switch (direction) {
    case "down":
      return L.divIcon({
        className: "",
        html,
        iconSize: [pillWidth, pillHeight + stem],
        iconAnchor: [pillWidth / 2, 0],
      });
    case "right":
      return L.divIcon({
        className: "",
        html,
        iconSize: [pillWidth + stem, pillHeight],
        iconAnchor: [0, pillHeight / 2],
      });
    case "left":
      return L.divIcon({
        className: "",
        html,
        iconSize: [pillWidth + stem, pillHeight],
        iconAnchor: [pillWidth + stem, pillHeight / 2],
      });
    case "up":
    default:
      return L.divIcon({
        className: "",
        html,
        iconSize: [pillWidth, pillHeight + stem],
        iconAnchor: [pillWidth / 2, pillHeight + stem],
      });
  }
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

  // Bounds fit ALL destinations — inland safari stops AND coast
  // extensions. Earlier we filtered coast cities to keep the safari
  // circuit roomy, but operators reported that hid Zanzibar / Mombasa
  // days entirely from the map. Trade-off accepted: a trip combining
  // a Tanzanian safari with a Zanzibar beach extension has bounds
  // ~3-4× the safari-only span, so the safari circuit is compressed.
  // We compensate via:
  //   - tiny internal breathing-room (2%) so we don't inflate bounds
  //   - leaflet boundsOptions.padding [36, 36] so markers sit clear
  //     of the viewport edge
  //   - taller MAP_HEIGHT in MapSection so the wider bounds get more
  //     pixels to spread across.
  // Net: every day is visible at its real geographic position, the
  // route lines remain readable, and the offshore handoff (mainland
  // → Zanzibar) reads as a long dashed transfer leg — which is the
  // honest depiction of the trip.
  const lats = groups.map((g) => g.lat);
  const lngs = groups.map((g) => g.lng);
  let south = Math.min(...lats);
  let north = Math.max(...lats);
  let west = Math.min(...lngs);
  let east = Math.max(...lngs);

  // Tiny breathing-room expansion so the outermost markers don't sit
  // flush against the viewport edge. 2% of the route span on each
  // side, combined with the larger leaflet boundsOptions.padding,
  // keeps markers comfortably inside the visible map without wasting
  // map area on empty margins (which used to crush the route).
  const BREATHING = 0.02;
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
  // Inland centroid — used as the "avoid point" for transfer-leg curves.
  // A flight from Serengeti to Zanzibar would otherwise bow toward the
  // mainland and slice through the safari circuit; bowing AWAY from
  // the inland centroid pushes the arc out over open territory.
  const inland = groups.filter((g) => !isCoastCity(g.placeName));
  const refGroups = inland.length > 0 ? inland : groups;
  const avoidLat = refGroups.reduce((s, g) => s + g.lat, 0) / refGroups.length;
  const avoidLng = refGroups.reduce((s, g) => s + g.lng, 0) / refGroups.length;
  const avoid: LatLngTuple = [avoidLat, avoidLng];

  const out: LegPath[] = [];
  for (let i = 0; i < groups.length - 1; i++) {
    const a: LatLngTuple = [groups[i].lat, groups[i].lng];
    const b: LatLngTuple = [groups[i + 1].lat, groups[i + 1].lng];
    const distKm = haversineKm(a, b);
    const kind: "circuit" | "transfer" =
      distKm > transferThresholdKm ? "transfer" : "circuit";
    out.push({
      kind,
      path: kind === "transfer" ? buildBezierArc(a, b, 24, 0.18, avoid) : [a, b],
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
  avoidPoint?: LatLngTuple,
): LatLngExpression[] {
  // Perpendicular-offset control point — bow scales with segment
  // length so a Mara → Zanzibar leg curves visibly without becoming
  // cartoonish on a short Tarangire → Serengeti hop. When an avoid
  // point is supplied (the inland centroid for transfer flights to
  // coast destinations), the bow direction flips if needed so the
  // arc bends AWAY from that point — the flight to Zanzibar curves
  // out over the Indian Ocean instead of slicing through the safari
  // circuit on the mainland.
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  let nx = -dy / len;
  let ny = dx / len;
  if (avoidPoint) {
    const mx = (a[0] + b[0]) / 2;
    const my = (a[1] + b[1]) / 2;
    const dirToAvoidX = avoidPoint[0] - mx;
    const dirToAvoidY = avoidPoint[1] - my;
    // If the perpendicular vector points toward the avoid point,
    // flip it so the bow goes the other way.
    if (nx * dirToAvoidX + ny * dirToAvoidY > 0) {
      nx = -nx;
      ny = -ny;
    }
  }
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

// Pull coast destinations toward the inland centroid so they sit at
// a "schematic" position closer to the safari circuit instead of at
// their real (700+km offshore) coordinates. Direction is preserved —
// Zanzibar still appears south-east of Serengeti, just much closer.
// The day pill keeps the actual destination name so the client knows
// where they're going; only the dot's position is editorialised.
//
// Inland stops are returned unchanged. If the trip is entirely
// coastal (no inland reference point), every group is unchanged too.
function compressCoastPositions<T extends { lat: number; lng: number; placeName: string }>(
  groups: T[],
): T[] {
  const inland = groups.filter((g) => !isCoastCity(g.placeName));
  if (inland.length === 0) return groups;
  const cLat = inland.reduce((s, g) => s + g.lat, 0) / inland.length;
  const cLng = inland.reduce((s, g) => s + g.lng, 0) / inland.length;
  // 0.4 = coast appears at 40 % of its real distance from the inland
  // centroid. Tuned so a Tanzanian safari + Zanzibar trip shows the
  // safari circuit zoomed in tight while Zanzibar still lands in the
  // lower-right area of the map (south-east direction preserved).
  const COMPRESSION = 0.4;
  return groups.map((g) => {
    if (!isCoastCity(g.placeName)) return g;
    const newLat = cLat + (g.lat - cLat) * COMPRESSION;
    const newLng = cLng + (g.lng - cLng) * COMPRESSION;
    return { ...g, lat: newLat, lng: newLng };
  });
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
          padding: [36, 36],
          maxZoom: 10,
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
