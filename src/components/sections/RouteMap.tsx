"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { LatLngExpression, LatLngTuple } from "leaflet";
import type { Day, ThemeTokens } from "@/lib/types";
import { isCoastCity } from "@/lib/safariRoutingRules";
import { parksInTrip } from "@/lib/safariParkBoundaries";

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
//   2. ROUTE OPENS UP — NOT TOO TIGHT.
//      boundsOptions: maxZoom 8, padding [110, 110]. computeViewport
//      uses 6% internal breathing-room expansion. Operators reported
//      the earlier tight crops felt cramped; this combination gives
//      the markers + bowed leg curves room to breathe.
//
//   3. CLOSE MARKER PILLS DIVERGE across the four sides of their
//      anchor. assignPillDirections() finds every pair within 60km
//      and assigns members alternating up → down → right → left
//      (sorted by start day for stability). buildDayPill honours
//      the direction. The place name is now BAKED into the same
//      DivIcon as the day pill so they read as one unit (no
//      separate Leaflet Tooltip). Tarangire ↔ Manyara (~33km) was
//      the canonical bug.
//
//   4. EVERY LEG BOWS OUTWARD from the trip centroid — like a
//      stretched bow opening up rather than chords folded inward.
//      buildLegPaths computes the trip centroid as the avoid-point;
//      buildBezierArc flips the perpendicular when it would point
//      back toward the centroid. Bow fractions: 0.20 for circuit
//      (road) legs, 0.30 for transfer (flight) legs. Park polygons
//      from safariParkBoundaries.ts render as a soft green wash
//      under the markers, but ONLY for the parks actually visited
//      on this trip (parksInTrip filter).
//
// Memory anchor: ~/.claude/.../memory/map_and_routing_rules.md
// ─────────────────────────────────────────────────────────────────────────

// Leaflet needs the DOM, so dynamic-import with ssr: false. The map tiles
// come from Carto (Voyager style) — no API key, more colourful than raw
// OSM without going illustrated.

const MapContainer = dynamic(() => import("react-leaflet").then((m) => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then((m) => m.TileLayer), { ssr: false });
const Marker = dynamic(() => import("react-leaflet").then((m) => m.Marker), { ssr: false });
// Tooltip import removed — place name now baked into the day pill's
// DivIcon (see buildDayPill) so pill + caption render as one unit
// with zero gap, regardless of zoom or pill direction.
const Polyline = dynamic(() => import("react-leaflet").then((m) => m.Polyline), { ssr: false });
const Popup = dynamic(() => import("react-leaflet").then((m) => m.Popup), { ssr: false });
// Polygon — re-introduced to render translucent park outlines under
// the markers. Only parks that actually appear in the itinerary are
// drawn (parksInTrip filter), so the operator sees the TRUE relative
// size of each park visited (Serengeti vast, Lake Manyara a thin
// strip) rather than identical pin dots over a flat basemap.
const Polygon = dynamic(() => import("react-leaflet").then((m) => m.Polygon), { ssr: false });

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
  // Tarangire pin pushed to the polygon's southern third (real-park
  // lat range -3.6 to -4.4). The old north-edge coord (-3.83, 36.0)
  // overlapped Manyara's pin (33km). At (-4.25, 36.15) the pin
  // lands deep inside the park with ~90km of visible separation from
  // Manyara, and the route line bows naturally between them (Day 2
  // pill clears Day 3 entirely). Polygon OUTLINE unchanged — OSM
  // coords are untouched, only the pin moves.
  { match: /^tarangire\b/i,                   lat: -4.2500, lng: 36.1500 },
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
  viewportMode = "all",
  inset = false,
}: {
  days: Day[];
  cachedCoords?: RouteCoord[];
  onCoordsResolved?: (coords: RouteCoord[]) => void;
  tokens: ThemeTokens;
  /** Pixel height (number) or CSS height (string like "100%"). When
   *  the parent grid uses items-stretch, pass "100%" so the map fills
   *  the row height set by the rail beside it. */
  height?: number | string;
  /** When set, that day's pin gets a selected ring and the map flies
   *  to it. Used by the "interactive" MapSection variant. */
  selectedDayId?: string | null;
  /** Hide zoom controls + lock pan / zoom for guest views and PDF
   *  export. Editor still gets full interactivity. */
  presentationMode?: boolean;
  /** Which stops drive the viewport bounds.
   *  - "all"          (default): include every destination, including
   *                              offshore / coast stops.
   *  - "inland-only":  exclude coast destinations from bounds, so the
   *                    main map zooms tight on the safari circuit.
   *                    Coast pins still RENDER (off-map at real coords)
   *                    so a paired inset map can show them in context. */
  viewportMode?: "all" | "inland-only";
  /** Inset rendering — smaller chrome, no zoom controls, no day-pill
   *  labels (just dots). Use for the corner overview map showing
   *  offshore stops at real coords. */
  inset?: boolean;
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

  // Schematic compression of coast destinations was removed when the
  // basemap switched to ESRI Topographic — under a real cartographic
  // basemap, a compressed Zanzibar pin landed visibly over inland
  // mainland Tanzania, which read as a geographic lie. Coast pins
  // now render at their TRUE coords. Cramming is handled instead by
  // the inset-map pattern in MapSection (main map zooms tight on
  // inland stops; small inset shows the wider region with offshore
  // stops at real positions).
  const groups = rawGroups;
  const markerGroups = rawMarkerGroups;

  // For each marker, compute which side of its anchor the pill should
  // float on so close pairs (Tarangire ↔ Lake Manyara, ~33km) don't
  // overlap each other. Cluster members get assigned alternating
  // directions (up / down / left / right) cycling through the four
  // sides — anything beyond a 4-way cluster falls back to "up", which
  // is unlikely to occur on a single safari circuit.
  // Pill direction indices align with whatever group set the markers
  // render from. Computed AFTER the inland-only filter below so close
  // pairs that survive (Tarangire ↔ Manyara) get unique sides.
  // (assigned just below the inlandOnly filter.)

  // (selectedGroupIndex is computed below against visibleMarkerGroups
  // so the highlight maps to the markers we actually render.)

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
  // Inland-only mode filters coast stops out of the bounds calculation
  // so the safari circuit stays tight in the main map. Coast markers
  // still render at real coords; they just sit outside the visible
  // bounds and a paired inset map shows them in geographic context.
  // Every stop renders on the main map — pin AND leg, including
  // offshore extensions to the coast (Zanzibar etc.). Operator brief:
  // "show the line to the coast". The viewport bounds are still
  // computed from inland-only stops in inland-only mode, but the
  // marker + leg render passes through the full set so the route
  // visually completes. White space outside the focus area is masked
  // by the spotlight overlay below.
  const visibleMarkerGroups = markerGroups;
  const visibleGroups = groups;
  const inlandOnly = viewportMode === "inland-only";
  const viewportSource = inlandOnly
    ? markerGroups.filter((g) => !isCoastCity(g.placeName))
    : markerGroups;
  const viewport = computeViewport(
    viewportSource.length >= 1 ? viewportSource : markerGroups,
  );
  // Spotlight mask removed — the bright focus area now occupies the
  // entire frame. Bottom-cropping in computeViewport (last day pinned
  // to the bottom edge) plus tight asymmetric leaflet padding means
  // there's no dim "outside" region left to mask.

  // Pill direction assignment runs against the visible marker set so
  // the indexing lines up with the markers we actually render.
  const pillDirections = assignPillDirections(visibleMarkerGroups);
  // Selected-day index is found in visibleMarkerGroups so the
  // highlight aligns with the rendered marker ordering.
  const selectedGroupIndex = selectedDayId
    ? visibleMarkerGroups.findIndex((g) =>
        coords.some(
          (c) =>
            c.dayId === selectedDayId &&
            Math.abs(c.lat - g.lat) < 0.0001 &&
            Math.abs(c.lng - g.lng) < 0.0001,
        ),
      )
    : -1;

  // Split adjacent legs into "circuit" (short drives) and "transfer"
  // (long flights). Both bow outward from the trip centroid; the kind
  // affects bow magnitude and stroke style only.
  const TRANSFER_THRESHOLD_KM = 250;
  const legPathsRaw = buildLegPaths(visibleGroups, TRANSFER_THRESHOLD_KM);
  // Apply a gentle sinusoidal wave to "transfer" (flight) legs so
  // they read as a flowing journey rather than a mechanical line.
  // Drives stay as their dotted bezier — waves on dotted lines look
  // muddled. Amplitude tapers at the endpoints so the path lands
  // exactly on each marker.
  const legPaths = legPathsRaw.map((leg) =>
    leg.kind === "transfer"
      ? { ...leg, path: makeWavyPath(leg.path as [number, number][]) }
      : leg,
  );

  // Parks visited on this trip — only polygons whose match regex hits
  // a stop ON the visible (inland) marker set. Drawn as a soft green
  // wash so the visited parks pop against the basemap's natural tint.
  const tripParks = parksInTrip(visibleMarkerGroups.map((g) => g.placeName));

  return (
    <div className="relative w-full overflow-hidden" style={{ height, background: tokens.cardBg }}>
      <MapContainer
        center={viewport.center}
        zoom={6}
        scrollWheelZoom={false}
        bounds={viewport.bounds}
        // Asymmetric padding via paddingTopLeft / paddingBottomRight.
        // Horizontal 90px on each side gives bowed legs and pill
        // labels room to breathe. Vertical: 24px on top (keeps the
        // northernmost pill clear of the attribution chip), 4px on
        // BOTTOM so the last day's pin sits flush against the bottom
        // edge of the visible frame — no empty ocean below the route.
        // maxZoom 9 caps over-zoom on a single-park itinerary.
        boundsOptions={{
          paddingTopLeft: [90, 24],
          paddingBottomRight: [90, 4],
          maxZoom: 9,
        }}
        minZoom={5}
        maxZoom={12}
        inertia={false}
        // Editorial defaults — hide the +/− zoom widget always; let
        // operators pan/zoom via scroll/drag in editor mode and lock
        // both in presentation mode (PDF export, share view).
        zoomControl={false}
        // Inset overview maps don't show attribution — main map
        // carries the legal attribution for both. Keeps the inset's
        // chrome to zero so it reads as a quiet supplementary view.
        attributionControl={!inset}
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
          groups={visibleMarkerGroups}
        />
        <RefitOnResize map={mapRef} viewport={viewport} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          // Carto Light NO LABELS — minimalist gray basemap. We tint
          // it to a cream paper tone via a CSS filter on the tile
          // pane (see <style> below) so the map reads as an editorial
          // hand-drawn diagram rather than a navigation UI.
          url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
          subdomains={["a", "b", "c", "d"]}
          maxZoom={19}
          className="ss-route-tile-pane"
        />
        {/* Park polygon overlays — only parks visited on THIS trip.
            Soft green wash, low-opacity outline. Drawn FIRST so leg
            polylines and day pills layer cleanly on top. Inset map
            skips polygons (it's a dots-only overview). */}
        {!inset && tripParks.map((park) => (
          <Polygon
            key={park.key}
            // Real OSM boundary, pre-simplified at build time.
            // Source: scripts/fetch-park-boundaries.mjs.
            positions={park.coords}
            pathOptions={{
              // Editorial olive — matches the cream-paper aesthetic.
              // Outline slightly darker than fill; fill at 0.55 opacity
              // so the park names underneath stay readable.
              color: "#5a6b3f",
              weight: 1.2,
              opacity: 0.7,
              fillColor: "#8a9968",
              fillOpacity: 0.55,
              lineCap: "round",
              lineJoin: "round",
            }}
          />
        ))}

        {/* Spotlight mask removed — bottom-cropping (last day flush
            to the bottom edge) plus tight padding means no empty
            outside region left to mask. The bright basemap fills the
            entire frame. */}

        {/* Per-leg rendering. Short circuit hops render as one continuous
            solid charcoal polyline (built up leg-by-leg so adjacent
            short legs share a single visual path). Long transfers
            (>250km) render as a soft dashed curve so they read as
            "flight to a distant region" rather than an implausibly
            straight road over ocean. */}
        {legPaths.map((leg, i) => (
          <Polyline
            key={`leg-${i}`}
            // Roads (circuit, short distance) → DOTTED line.
            // Flights (transfer, long distance) → STRAIGHT solid line.
            // Operator brief: roads are dotted, flights are straight.
            positions={leg.path}
            pathOptions={leg.kind === "transfer"
              ? {
                  // Flight — straight solid line (the path is straight
                  // because buildLegPaths emits [a, b] for transfers
                  // when no avoid-curve is needed; we pass null so the
                  // Bezier curve is bypassed for this style choice).
                  color: "#243c24",
                  weight: 2,
                  opacity: 0.85,
                  lineCap: "round",
                  lineJoin: "round",
                }
              : {
                  // Road — dotted line. Tight dot pattern reads as
                  // "drive route" without competing with the basemap.
                  color: "#243c24",
                  weight: 2.2,
                  opacity: 0.78,
                  dashArray: "1 5",
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
            two stops sit close together. Also skipped on the inset
            overview map — it's a small at-a-glance view, no need for
            directional cues at that scale. */}
        {!inset && leafletRef.current && legPaths.map((leg, i) => {
          if (leg.skipArrow) return null;
          const [a, b] = leg.endpoints;
          // Arrow sits on the bowed curve's midpoint (t=0.5 of the
          // bezier), bearing follows the chord A→B since the bezier
          // tangent at the midpoint is parallel to AB.
          const angleDeg =
            (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
          return (
            <Marker
              key={`arrow-${i}`}
              position={leg.midpoint}
              icon={buildArrowIcon(leafletRef.current!, angleDeg)}
              interactive={false}
              keyboard={false}
              zIndexOffset={-50}
            />
          );
        })}

        {visibleMarkerGroups.map((g, i) => {
          const isSelected = i === selectedGroupIndex;
          const pillDir = pillDirections[i];
          // Inset mode renders simple dots only — no labels, no
          // chrome — because the main map carries the day-pill
          // labels. The inset's job is to show geographic relationships
          // (where Zanzibar sits relative to the safari circuit), not
          // re-state the day numbers.
          const icon = leafletRef.current
            ? inset
              ? buildDotIcon(leafletRef.current)
              : buildDayPill(leafletRef.current, g.dayLabel, g.placeName, isSelected, pillDir)
            : undefined;
          // Place name now lives INSIDE the pill icon (baked in as
          // part of the same DivIcon HTML). The Leaflet Tooltip is
          // gone — it used to sit on the OPPOSITE side of the
          // anchor from the pill, separating "Day 1" from "Arusha"
          // by the marker dot. Operator wanted them tightly together,
          // so they're now a single icon stack.
          // Click popup — show the day's hero image + place name +
          // day label. Looks up the matching day from the proposal's
          // days list by startDay so the image stays in sync with
          // any operator edits.
          const dayMatch = days.find((d) => d.dayNumber === g.startDay);
          const popupImage = dayMatch?.heroImageUrl?.trim() || null;
          return (
            <Marker
              key={`${g.lat}-${g.lng}-${g.startDay}`}
              position={[g.lat, g.lng]}
              icon={icon}
              zIndexOffset={isSelected ? 1000 : 0}
            >
              {!inset && (
                <Popup className="ss-route-popup" closeButton={false}>
                  <div className="ss-route-popup-card">
                    {popupImage && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={popupImage}
                        alt={g.placeName}
                        className="ss-route-popup-img"
                      />
                    )}
                    <div className="ss-route-popup-meta">
                      <div className="ss-route-popup-day">
                        Day {g.dayLabel}
                      </div>
                      <div className="ss-route-popup-name">
                        {g.placeName}
                      </div>
                    </div>
                  </div>
                </Popup>
              )}
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
        /* Cream paper basemap — flattens and warms the gray tiles
           into an editorial cream tone. Leaflet draws each tile as
           an <img> inside .leaflet-tile-pane; we apply a filter
           chain there so the basemap reads as a hand-drawn cream
           sheet rather than a satellite view. */
        .ss-route-tile-pane,
        .leaflet-container .leaflet-tile-pane {
          filter: sepia(0.18) saturate(0.55) brightness(1.08)
                  contrast(0.92);
        }
        .leaflet-container {
          background: #f4ece0 !important;
        }
        /* Day pill — slightly bigger for visibility on the editorial
           route diagram. Charcoal background, white text, tiny stem
           pointing at the geo anchor. */
        /* Click popup — luxury card with hero image + day + place
           name. Replaces Leaflet's default popup chrome so the
           floating card reads as editorial, not navigation UI. */
        .ss-route-popup .leaflet-popup-content-wrapper {
          background: #ffffff;
          border-radius: 6px;
          padding: 0;
          box-shadow: 0 6px 24px rgba(0, 0, 0, 0.18);
          overflow: hidden;
        }
        .ss-route-popup .leaflet-popup-content {
          margin: 0;
          width: 220px !important;
        }
        .ss-route-popup .leaflet-popup-tip {
          background: #ffffff;
        }
        .ss-route-popup-card {
          display: flex;
          flex-direction: column;
        }
        .ss-route-popup-img {
          width: 100%;
          height: 110px;
          object-fit: cover;
          display: block;
        }
        .ss-route-popup-meta {
          padding: 10px 14px 12px;
        }
        .ss-route-popup-day {
          font-size: 10px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: rgba(0, 0, 0, 0.45);
          font-weight: 600;
          margin-bottom: 2px;
        }
        .ss-route-popup-name {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 16px;
          font-weight: 600;
          color: #1a1a1a;
          letter-spacing: -0.005em;
        }

        .ss-day-pill {
          display: inline-flex;
          align-items: center;
          padding: 3px 9px;
          background: #243c24;
          color: #ffffff;
          font-size: 10.5px;
          font-weight: 600;
          letter-spacing: 0.05em;
          line-height: 1;
          border-radius: 999px;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
          white-space: nowrap;
          font-family: system-ui, sans-serif;
          position: relative;
        }
        /* Stem dropped — pin design tightened per operator brief.
           Reference safari atlases use small pills with a tiny anchor
           dot below the place name, not a triangular stem competing
           with the pill. The lat/lng anchor sits at the bottom-centre
           of the pill (set via iconAnchor in buildDayPill), so the
           pill itself "points" at the location without ornament. */
        .ss-day-pill.is-selected {
          background: #1b3a2d;
          box-shadow: 0 0 0 3px rgba(27, 58, 45, 0.20), 0 4px 12px rgba(0, 0, 0, 0.30);
        }

        /* Day-stop stack — the day pill + place name baked together
           into a single DivIcon. flex column with zero gap so the
           pill and label read as one unit, never separated by the
           marker dot. */
        .ss-day-stop {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          line-height: 1;
        }
        .ss-place-baked {
          color: #243c24;
          font-family: system-ui, sans-serif;
          font-size: 10.5px;
          font-weight: 700;
          letter-spacing: 0.04em;
          line-height: 1.1;
          white-space: nowrap;
          text-shadow:
            0 0 3px rgba(247, 245, 240, 0.95),
            0 0 6px rgba(247, 245, 240, 0.85),
            0 1px 2px rgba(247, 245, 240, 0.85);
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

// Tiny filled circle for the inset overview map. No label, no stem,
// no chrome — just a charcoal dot at the lat/lng so the inset reads as
// "here are the trip's stops, geographically." The main map carries
// the labels.
function buildDotIcon(L: typeof import("leaflet")) {
  const SIZE = 8;
  const html = `<div style="width:${SIZE}px;height:${SIZE}px;border-radius:50%;background:#243c24;box-shadow:0 0 0 2px rgba(255,255,255,0.85);"></div>`;
  return L.divIcon({
    className: "",
    html,
    iconSize: [SIZE, SIZE],
    iconAnchor: [SIZE / 2, SIZE / 2],
  });
}

// Build a custom DivIcon for a stop — dark charcoal "Day X" pill +
// the place name caption, baked into a single tightly-stacked icon
// so they always read as one visual unit. Operator brief: "Day and
// location to be very close" — combining them into one icon
// guarantees zero gap regardless of zoom level or pill direction.
//
// Layout inside the icon:
//   ┌──────┐
//   │Day 1 │   ← dark pill (10.5px / 3-9px padding)
//   └──────┘
//   Arusha    ← place caption (small caps, dark with cream text-shadow)
//
// The pill+label stack is treated as one rectangle for sizing /
// anchoring. Direction shifts the whole stack relative to the lat/lng:
//   up    — stack above anchor (anchor at bottom-centre)
//   down  — stack below anchor (anchor at top-centre)
//   right — stack to the right (anchor at left-centre)
//   left  — stack to the left (anchor at right-centre)
function buildDayPill(
  L: typeof import("leaflet"),
  dayLabel: string,
  placeName: string,
  isSelected: boolean = false,
  direction: PillDirection = "up",
) {
  const dayText = `Day ${dayLabel}`;
  const placeText = (placeName ?? "").trim();
  const sel = isSelected ? " is-selected" : "";
  const html =
    `<div class="ss-day-stop">` +
      `<div class="ss-day-pill${sel}">${escape(dayText)}</div>` +
      (placeText
        ? `<div class="ss-place-baked">${escape(placeText)}</div>`
        : "") +
    `</div>`;

  // Approximate stack dimensions. Width is whichever of pill or label
  // is wider; height is pill + label + tiny gap.
  const pillWidth = Math.max(40, dayText.length * 6.0 + 18);
  const labelWidth = Math.max(30, placeText.length * 6.5);
  const stackWidth = Math.max(pillWidth, labelWidth);
  const pillHeight = 18;
  const labelHeight = placeText ? 14 : 0;
  const gap = placeText ? 2 : 0;
  const stackHeight = pillHeight + gap + labelHeight;

  switch (direction) {
    case "down":
      return L.divIcon({
        className: "",
        html,
        iconSize: [stackWidth, stackHeight],
        iconAnchor: [stackWidth / 2, 0],
      });
    case "right":
      return L.divIcon({
        className: "",
        html,
        iconSize: [stackWidth, stackHeight],
        iconAnchor: [0, stackHeight / 2],
      });
    case "left":
      return L.divIcon({
        className: "",
        html,
        iconSize: [stackWidth, stackHeight],
        iconAnchor: [stackWidth, stackHeight / 2],
      });
    case "up":
    default:
      return L.divIcon({
        className: "",
        html,
        iconSize: [stackWidth, stackHeight],
        iconAnchor: [stackWidth / 2, stackHeight],
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

  // ── Bottom-crop rule ─────────────────────────────────────────────
  // The map's bottom edge should align with the LAST DAY of the trip.
  // For a one-way itinerary ending at the southernmost stop (Arusha →
  // Zanzibar, last day = southernmost), we pin the south bound
  // exactly to the last stop's lat with NO breathing-room below — the
  // last pin sits flush against the bottom edge, no empty ocean.
  // For round-trips where the last day isn't the southernmost (e.g.
  // …→ Zanzibar → back to Arusha), we keep the natural min so the
  // mid-trip southerly stop isn't cropped out.
  const lastLat = groups[groups.length - 1].lat;
  const lastIsSouthernmost = Math.abs(lastLat - south) < 0.001;

  // Breathing-room expansion. North / east / west get the standard 3%
  // visual margin; south skips it when the last day is the
  // southernmost stop so the bottom edge sits ON the pin.
  const BREATHING = 0.03;
  const latSpan = north - south;
  const lngSpan = east - west;
  north += latSpan * BREATHING;
  west -= lngSpan * BREATHING;
  east += lngSpan * BREATHING;
  if (!lastIsSouthernmost) {
    south -= latSpan * BREATHING;
  }

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
  /** Endpoints used for arrow bearing. Always [from, to] even for
   *  curved transfer legs. */
  endpoints: [LatLngTuple, LatLngTuple];
  /** Bezier midpoint at t=0.5 — where the directional-arrow chip
   *  should sit so it lands ON the bowed curve, not the chord. */
  midpoint: LatLngTuple;
  /** Skip the directional-arrow chip on legs shorter than ~25km
   *  (e.g. two stops in the same region) to avoid clutter. */
  skipArrow: boolean;
};

// Spotlight helpers removed — the mask is gone; bright basemap fills
// the frame. Bottom-crop in computeViewport + tight asymmetric leaflet
// padding handle the "no empty outside region" goal.

// Subdivide each polyline segment into a gentle sinusoidal curve so
// long transfer legs feel like a flowing journey, not a mechanical
// straight line. Amplitude is a small fraction of the segment's
// length, tapered at endpoints (sin envelope) so the curve lands
// exactly on each marker. 3 wave cycles per segment reads as
// "swooping" without becoming busy.
function makeWavyPath(path: [number, number][]): [number, number][] {
  if (path.length < 2) return path;
  const result: [number, number][] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const dist = Math.hypot(dx, dy);
    if (dist === 0) continue;
    const segments = Math.max(20, Math.floor(dist * 60));
    // Perpendicular vector (90° rotation in 2D), normalized.
    const perpX = -dy / dist;
    const perpY = dx / dist;
    // Wave amplitude scales with leg distance but capped so short
    // legs still read as gentle curves rather than tight squiggles.
    const amplitude = Math.min(dist * 0.05, 0.6);
    for (let j = 0; j < segments; j++) {
      const t = j / segments;
      const taper = Math.sin(t * Math.PI); // 0 at endpoints, 1 at midpoint
      const wave = Math.sin(t * Math.PI * 3) * amplitude * taper;
      result.push([
        a[0] + dx * t + perpX * wave,
        a[1] + dy * t + perpY * wave,
      ]);
    }
  }
  result.push(path[path.length - 1]);
  return result;
}

/**
 * For each adjacent pair of groups, classify by haversine distance:
 *   - ≤ transferThresholdKm → "circuit" (short drive, modest bow)
 *   - > transferThresholdKm → "transfer" (long flight, generous bow)
 *
 * Bow direction is OUTWARD from the inland-circuit centroid — the
 * computed centroid filters out coast cities so a Tanzania→Zanzibar
 * leg correctly bows AWAY from the safari mainland (over open
 * water/territory) instead of slicing back through Tarangire /
 * Manyara / Serengeti.
 */
function buildLegPaths(
  groups: CoordGroup[],
  transferThresholdKm: number,
): LegPath[] {
  if (groups.length < 2) return [];
  // Trip centroid — every leg bows AWAY from this point, so the
  // sequence of legs reads like a stretched bow opening outward
  // instead of a folded chord pulled inward. Operator brief:
  // "naturally open the lines as if you were stretching a bow".
  //
  // Centroid uses the INLAND stops only — when a trip mixes a safari
  // circuit with a coast extension (Zanzibar etc.), an averaged
  // centroid lands inside the safari area and the long Serengeti →
  // Zanzibar leg ends up bowing INTO Tarangire / Manyara instead of
  // outward over open territory. Filtering coast cities gives a
  // centroid in the heart of the inland circuit, so transfer legs
  // correctly swing wide of the safari area.
  const inland = groups.filter((g) => !isCoastCity(g.placeName));
  const centroidSource = inland.length >= 2 ? inland : groups;
  const centroid: LatLngTuple = [
    centroidSource.reduce((s, g) => s + g.lat, 0) / centroidSource.length,
    centroidSource.reduce((s, g) => s + g.lng, 0) / centroidSource.length,
  ];
  const out: LegPath[] = [];
  for (let i = 0; i < groups.length - 1; i++) {
    const a: LatLngTuple = [groups[i].lat, groups[i].lng];
    const b: LatLngTuple = [groups[i + 1].lat, groups[i + 1].lng];
    const distKm = haversineKm(a, b);
    const kind: "circuit" | "transfer" =
      distKm > transferThresholdKm ? "transfer" : "circuit";
    // Bow fractions tuned for visual separation — close-pair stops
    // (Tarangire ↔ Manyara) need a generous arc between them so the
    // pins don't crowd. Circuit 0.32 gives short drives a clear
    // sweep; transfer 0.40 makes long flights read as an aerial arc
    // rather than a chord.
    const bowFraction = kind === "transfer" ? 0.40 : 0.32;
    const { path, midpoint } = buildBezierArc(a, b, centroid, bowFraction);
    out.push({
      kind,
      path,
      endpoints: [a, b],
      midpoint,
      skipArrow: distKm < 25,
    });
  }
  return out;
}

// Quadratic Bézier sampled into smooth segments. Control point sits
// at the midpoint of AB shifted along the AB perpendicular, in
// whichever direction faces AWAY from `avoid` (the trip centroid).
// Net effect: every leg curves outward from the trip's centre, so
// the assembled sequence opens up like a stretched bow rather than
// folding inward over the safari circuit.
function buildBezierArc(
  a: LatLngTuple,
  b: LatLngTuple,
  avoid: LatLngTuple,
  bowFraction: number,
): { path: LatLngTuple[]; midpoint: LatLngTuple } {
  const dy = b[0] - a[0];
  const dx = b[1] - a[1];
  const mid: LatLngTuple = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  // Perpendicular to AB. Treat lat as y, lng as x; the perpendicular
  // is (-dx, dy) or (dx, -dy) depending on which side we want.
  let perpLat = -dx;
  let perpLng = dy;
  const perpLen = Math.hypot(perpLat, perpLng) || 1;
  perpLat /= perpLen;
  perpLng /= perpLen;
  // Outward direction = midpoint − centroid. Flip the perpendicular
  // when its dot product with outward is negative (i.e. it points
  // back toward the centroid).
  const outLat = mid[0] - avoid[0];
  const outLng = mid[1] - avoid[1];
  const dot = perpLat * outLat + perpLng * outLng;
  if (dot < 0) {
    perpLat = -perpLat;
    perpLng = -perpLng;
  }
  const legLen = Math.hypot(dy, dx) || 1;
  const offset = legLen * bowFraction;
  const ctrl: LatLngTuple = [
    mid[0] + perpLat * offset,
    mid[1] + perpLng * offset,
  ];
  // 28 segments — smooth at all zooms, cheap to render.
  const N = 28;
  const points: LatLngTuple[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const u = 1 - t;
    const lat = u * u * a[0] + 2 * u * t * ctrl[0] + t * t * b[0];
    const lng = u * u * a[1] + 2 * u * t * ctrl[1] + t * t * b[1];
    points.push([lat, lng]);
  }
  // Bezier midpoint at t=0.5 — used for the arrow-chip position so
  // it lands on the bowed curve rather than the straight chord.
  const midpoint: LatLngTuple = [
    0.25 * a[0] + 0.5 * ctrl[0] + 0.25 * b[0],
    0.25 * a[1] + 0.5 * ctrl[1] + 0.25 * b[1],
  ];
  return { path: points, midpoint };
}

// compressCoastPositions removed — it was a schematic lie that worked
// under a flat / labelless basemap but broke under a real cartographic
// basemap (compressed Zanzibar pin landed visibly over inland
// Tanzania). The inset-map pattern in MapSection handles cramming now:
// main map zooms tight on inland-only viewport; small corner inset
// shows the wider region with offshore stops at REAL positions.

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
          padding: [60, 60],
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
