"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { lookupDemoCoord } from "@/lib/demoDestinationCoords";
import { classifyStop, isCoastCity } from "@/lib/safariRoutingRules";
import { parksInTrip } from "@/lib/safariParkBoundaries";
import type { Day, ProposalTheme, ThemeTokens, TierKey } from "@/lib/types";

// ─── RouteRealMap ───────────────────────────────────────────────────────
//
// Real cartographic map — Carto Voyager basemap via MapLibre GL.
// Beyond a basic basemap, this component layers four operator-grade
// touches that lift a generic map into something clients screenshot
// and operators show off in demos:
//
//   1. Park polygons. Real OSM-sourced outlines of every park the
//      itinerary visits, washed in brand teal at 22% opacity. Clients
//      see exactly what they're entering, not just dots in space.
//   2. Animated route reveal. Both road (dashed) and flight (solid)
//      lines draw themselves on first paint via a stroke-dashoffset
//      animation. Looks like a flight tracker booting up.
//   3. Rich photo popovers. Click any pin → 220×130 photo of the
//      day's destination + day number, dates, location. Falls back to
//      text-only popover if the day has no hero image.
//   4. Stats strip. Auto-computed "X days · Y stops · Z km · N parks"
//      pinned to the top-left as a tiny info chip. Clientstat for
//      sharing.
//
// Coordinates: each day's destination resolves through lookupDemoCoord
// (case-insensitive, suffix-tolerant). Days whose destination doesn't
// match any entry are silently dropped from the map — the rail still
// shows them so the operator notices and corrects.

interface RouteRealMapProps {
  days: Day[];
  /** Active tier — used to count unique lodges in the stats chip
   *  ("4 LODGES"). Operators asked us to drop the raw KM total
   *  clients see and replace it with something less negotiable. */
  activeTier: TierKey;
  tokens: ThemeTokens;
  theme: ProposalTheme;
  isEditor: boolean;
}

const BASEMAP_STYLE = "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";

type ResolvedStop = {
  destination: string;
  coord: { lat: number; lng: number };
  /** First day in the consecutive-day run that landed at this stop. */
  dayNumber: number;
  /** Last day in the run. Equals dayNumber when the run is one night. */
  endDay: number;
  kind: ReturnType<typeof classifyStop>;
  heroImageUrl?: string;
};

export function RouteRealMap({ days, activeTier, tokens, theme }: RouteRealMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Resolve each day's coord and collapse consecutive-day stays at
  // the same destination into one stop with a day RANGE. The pin
  // ends up labelled "2-3" so the trip arc on the map mirrors the
  // rail's "Day 2-3 · Tarangire" grouping. Operators asked for this
  // because pin labels of "1, 2, 3, 4, 5" on a 9-day trip read like
  // a 5-day trip — the day numbers tell the real story.
  const stops = useMemo<ResolvedStop[]>(() => {
    const sorted = [...days].sort((a, b) => a.dayNumber - b.dayNumber);
    const out: ResolvedStop[] = [];
    for (const d of sorted) {
      const dest = (d.destination ?? "").trim();
      if (!dest) continue;
      const coord = lookupDemoCoord(dest);
      if (!coord) continue;
      const last = out[out.length - 1];
      if (last && last.destination.toLowerCase() === dest.toLowerCase()) {
        last.endDay = d.dayNumber;
        continue;
      }
      out.push({
        destination: dest,
        coord,
        dayNumber: d.dayNumber,
        endDay: d.dayNumber,
        kind: classifyStop(dest),
        heroImageUrl: d.heroImageUrl,
      });
    }
    return out;
  }, [days]);

  // ── Stats strip data ─────────────────────────────────────────────────
  // Lodges replaces the old km total. Operators didn't want a hard
  // distance number on a client-facing card (it invites haggling and
  // implies "value per km"); a unique-lodges count is a better
  // signal of the trip's substance. Counts every distinct camp name
  // at the active tier, case-insensitive.
  const stats = useMemo(() => {
    const totalDays = days.length;
    const totalStops = stops.length;
    const camps = new Set<string>();
    for (const d of days) {
      const camp = d.tiers?.[activeTier]?.camp?.trim().toLowerCase();
      if (camp) camps.add(camp);
    }
    const matchedParks = parksInTrip(stops.map((s) => s.destination));
    return {
      totalDays,
      totalStops,
      totalLodges: camps.size,
      totalParks: matchedParks.length,
    };
  }, [days, activeTier, stops]);

  // ── Park polygons that match the trip's destinations ─────────────────
  const parkFeatures = useMemo<GeoJSON.Feature[]>(() => {
    const matches = parksInTrip(stops.map((s) => s.destination));
    return matches.map((p) => ({
      type: "Feature",
      properties: { name: p.name, key: p.key },
      geometry: {
        type: "Polygon",
        // Park rings are stored as [lat, lng] tuples (Leaflet legacy);
        // MapLibre wants [lng, lat]. Flip on the way out.
        coordinates: [p.coords.map(([lat, lng]) => [lng, lat] as [number, number])],
      },
    }));
  }, [stops]);

  // ── Init the map once on mount. Static options only; everything
  //    dynamic happens in the imperative effect below.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (stops.length === 0) return;

    const lngs = stops.map((s) => s.coord.lng);
    const lats = stops.map((s) => s.coord.lat);
    const bounds: [[number, number], [number, number]] = [
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)],
    ];

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASEMAP_STYLE,
      bounds,
      fitBoundsOptions: {
        padding: { top: 60, bottom: 60, left: 60, right: 60 },
        maxZoom: 9,
      },
      attributionControl: { compact: true },
      cooperativeGestures: true,
      pitchWithRotate: false,
      dragRotate: false,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    map.on("load", () => setMapLoaded(true));
    mapRef.current = map;

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
      setMapLoaded(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stops.length]);

  // ── Add / refresh layers, markers, and the animated reveal ─────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || stops.length === 0) return;

    // Park polygons go BELOW the route lines so the green wash sits
    // under the dashed roads without obscuring them. Outline at 60%
    // opacity reads as a confident boundary, not a placeholder.
    upsertPolygonLayer(map, "ss-route-parks", parkFeatures, {
      fill: tokens.accent || "#c9a84c",
      fillOpacity: 0.18,
      outline: tokens.headingText || "#1f3a3a",
      outlineOpacity: 0.55,
      outlineWidth: 1.5,
    });

    // ── Markers ────────────────────────────────────────────────────────
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Per-pin offsets (screen pixels) to break apart close pairs like
    // Tarangire ↔ Manyara (~30km apart, overlap badly at zoom 8-9).
    // Computed in a single pass: any two pins within COLLISION_KM get
    // pushed apart along their connecting axis by ~16px each.
    const pinOffsets = computePinOffsets(stops);

    stops.forEach((stop, idx) => {
      // Outer element is what MapLibre sets transform: translate(...) on
      // — we MUST NOT overwrite its transform. Hover scale lives on an
      // INNER element so the position never glitches. (Earlier bug:
      // hover scale was on the outer element, the next mouseleave
      // wiped MapLibre's translate and the pin jumped to 0,0.)
      const wrapper = document.createElement("div");
      wrapper.style.cursor = "pointer";

      // Day-range label: "1" for one-night stops, "2-3" for runs.
      // border-radius:999px keeps single-day pins circular and lets
      // multi-day pins flow into a pill without changing visual
      // language. min-width = height keeps the circle for the
      // common case.
      const isRange = stop.endDay > stop.dayNumber;
      const label = isRange ? `${stop.dayNumber}-${stop.endDay}` : `${stop.dayNumber}`;

      const el = document.createElement("div");
      el.className = "ss-route-marker";
      el.style.minWidth = "32px";
      el.style.height = "32px";
      el.style.padding = isRange ? "0 9px" : "0";
      el.style.borderRadius = "999px";
      el.style.background = tokens.headingText || "#1f3a3a";
      el.style.color = "#ffffff";
      el.style.border = "3px solid #ffffff";
      el.style.boxShadow = "0 3px 8px rgba(0,0,0,0.28)";
      el.style.display = "flex";
      el.style.alignItems = "center";
      el.style.justifyContent = "center";
      el.style.fontWeight = "700";
      el.style.fontSize = isRange ? "12px" : "13px";
      el.style.lineHeight = "1";
      el.style.fontFamily = `'${theme.bodyFont}', sans-serif`;
      el.style.transition = "transform 180ms ease";
      el.style.whiteSpace = "nowrap";
      el.textContent = label;
      wrapper.appendChild(el);

      wrapper.addEventListener("mouseenter", () => {
        el.style.transform = "scale(1.12)";
      });
      wrapper.addEventListener("mouseleave", () => {
        el.style.transform = "scale(1)";
      });

      const popup = new maplibregl.Popup({
        offset: 22,
        closeButton: false,
        className: "ss-route-popup",
        maxWidth: "260px",
      }).setHTML(
        buildPopupHTML(stop, theme.bodyFont, theme.displayFont, tokens),
      );

      const marker = new maplibregl.Marker({
        element: wrapper,
        offset: pinOffsets[idx] ?? [0, 0],
      })
        .setLngLat([stop.coord.lng, stop.coord.lat])
        .setPopup(popup)
        .addTo(map);
      markersRef.current.push(marker);
    });

    // ── Route lines (road dashed, flight solid) — split into two
    //    GeoJSON layers so the line-pattern differs cleanly. Each
    //    layer carries a `progress` data-driven property used by the
    //    reveal animation below.
    const roadFeatures: GeoJSON.Feature[] = [];
    const flightFeatures: GeoJSON.Feature[] = [];
    const segmentLengths: number[] = [];

    for (let i = 0; i < stops.length - 1; i++) {
      const a = stops[i];
      const b = stops[i + 1];
      const isFlight = legNeedsFlight(a, b);
      // Flights arc HIGH (0.20) so they read as long-haul air routes;
      // roads arc gently (0.07) so they hug the inland terrain. The
      // contrast also gives visible breathing space when a flight
      // and a road cross the same general airspace — the two never
      // visually merge into one fat smudge.
      const bow = isFlight ? 0.2 : 0.07;
      const coords = bowedLeg(a.coord, b.coord, bow);
      const feature: GeoJSON.Feature = {
        type: "Feature",
        properties: { segIndex: i },
        geometry: { type: "LineString", coordinates: coords },
      };
      (isFlight ? flightFeatures : roadFeatures).push(feature);
      segmentLengths.push(haversineKm(a.coord, b.coord));
    }

    upsertLineLayer(map, "ss-route-roads", roadFeatures, {
      paint: {
        "line-color": tokens.headingText || "#1f3a3a",
        "line-width": 3,
        "line-dasharray": [1.5, 1.5],
        "line-opacity": 0,
      },
    });
    upsertLineLayer(map, "ss-route-flights", flightFeatures, {
      paint: {
        "line-color": tokens.accent || "#c9a84c",
        "line-width": 3,
        "line-opacity": 0,
      },
    });

    // ── Reveal animation. Fades the route in and "scrubs" the line
    //    width up so it feels like the route is being inked onto the
    //    map. Pure paint-property animation — no SVG / DOM trickery.
    //    Total duration ~1.6s; easing is ease-out so the reveal feels
    //    snappy at the start and settles toward the end.
    let raf = 0;
    const t0 = performance.now();
    const DURATION = 1600;
    const tick = () => {
      const elapsed = performance.now() - t0;
      const t = Math.min(1, elapsed / DURATION);
      const eased = 1 - Math.pow(1 - t, 3);
      const opacity = eased * 0.95;
      if (map.getLayer("ss-route-roads")) {
        map.setPaintProperty("ss-route-roads", "line-opacity", opacity);
      }
      if (map.getLayer("ss-route-flights")) {
        map.setPaintProperty("ss-route-flights", "line-opacity", Math.min(1, eased));
      }
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    // Re-fit when the stop set changes
    const lngs = stops.map((s) => s.coord.lng);
    const lats = stops.map((s) => s.coord.lat);
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: { top: 60, bottom: 60, left: 60, right: 60 }, maxZoom: 9, duration: 600 },
    );

    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [stops, parkFeatures, mapLoaded, tokens.headingText, tokens.accent, theme.bodyFont, theme.displayFont, tokens]);

  // Empty state
  if (stops.length === 0) {
    return (
      <div
        className="w-full h-full flex items-center justify-center"
        style={{ background: tokens.cardBg, minHeight: 360 }}
      >
        <div
          className="text-[12px] text-center px-6 max-w-xs"
          style={{ color: tokens.mutedText }}
        >
          Add destinations to your itinerary to see them on the map.
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative w-full ss-route-realmap"
      style={{ minHeight: 360, height: "100%", background: tokens.cardBg }}
    >
      <div ref={containerRef} className="w-full h-full" />

      {/* ── Stats chip — bottom-left, sits clear of the nav controls
          (top-right) and the basemap attribution (bottom-right). The
          original top-left placement was blocking the parks around
          Arusha. ── */}
      <div
        className="absolute bottom-3 left-3 z-10 rounded-md px-3 py-2 backdrop-blur-md flex items-center gap-3"
        style={{
          background: "rgba(255,255,255,0.92)",
          border: `1px solid ${tokens.border}`,
          fontFamily: `'${theme.bodyFont}', sans-serif`,
          color: tokens.headingText,
        }}
      >
        <Stat label="Days" value={stats.totalDays} accent={tokens.accent || "#c9a84c"} />
        <Divider />
        <Stat label="Stops" value={stats.totalStops} accent={tokens.accent || "#c9a84c"} />
        {stats.totalLodges > 0 && (
          <>
            <Divider />
            <Stat
              label={stats.totalLodges === 1 ? "Lodge" : "Lodges"}
              value={stats.totalLodges}
              accent={tokens.accent || "#c9a84c"}
            />
          </>
        )}
        {stats.totalParks > 0 && (
          <>
            <Divider />
            <Stat
              label={stats.totalParks === 1 ? "Park" : "Parks"}
              value={stats.totalParks}
              accent={tokens.accent || "#c9a84c"}
            />
          </>
        )}
      </div>
    </div>
  );
}

// ─── Stats chip pieces ──────────────────────────────────────────────────

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent: string;
}) {
  return (
    <div className="flex flex-col items-center leading-none">
      <span className="text-[14px] font-bold tabular-nums" style={{ color: accent }}>
        {value}
      </span>
      <span
        className="text-[8.5px] uppercase tracking-[0.18em] font-semibold mt-0.5"
        style={{ color: "rgba(0,0,0,0.55)" }}
      >
        {label}
      </span>
    </div>
  );
}

function Divider() {
  return (
    <span
      className="inline-block w-px h-7"
      style={{ background: "rgba(0,0,0,0.12)" }}
      aria-hidden
    />
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

function legNeedsFlight(a: ResolvedStop, b: ResolvedStop): boolean {
  if (isCoastCity(a.destination) !== isCoastCity(b.destination)) return true;
  const km = haversineKm(a.coord, b.coord);
  return km > 350;
}

// Bow factor: roads bow gently, flights bow more dramatically. Different
// bow strengths give visible breathing space between the two line styles
// even when they pass through the same airspace.
function bowedLeg(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
  bowFactor = 0.12,
): [number, number][] {
  const steps = 32;
  const dx = b.lng - a.lng;
  const dy = b.lat - a.lat;
  const len = Math.hypot(dx, dy);
  if (len < 0.001)
    return [
      [a.lng, a.lat],
      [b.lng, b.lat],
    ];
  const perpX = -dy / len;
  const perpY = dx / len;
  const bow = len * bowFactor;
  const cx = (a.lng + b.lng) / 2 + perpX * bow;
  const cy = (a.lat + b.lat) / 2 + perpY * bow;
  const points: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = (1 - t) * (1 - t) * a.lng + 2 * (1 - t) * t * cx + t * t * b.lng;
    const y = (1 - t) * (1 - t) * a.lat + 2 * (1 - t) * t * cy + t * t * b.lat;
    points.push([x, y]);
  }
  return points;
}

// Pin de-cluster: any pair of stops within COLLISION_KM gets shifted
// in opposite directions along their connecting axis so neither pin
// covers the other. Returns one [x, y] pixel offset per stop, indexed
// to match `stops`. Stops with no nearby neighbour stay at [0, 0].
function computePinOffsets(
  stops: Array<{ coord: { lat: number; lng: number } }>,
): Array<[number, number]> {
  const COLLISION_KM = 60;
  const PUSH_PX = 18;
  const offsets: Array<[number, number]> = stops.map(() => [0, 0]);
  for (let i = 0; i < stops.length; i++) {
    for (let j = i + 1; j < stops.length; j++) {
      const a = stops[i].coord;
      const b = stops[j].coord;
      const km = haversineKm(a, b);
      if (km > COLLISION_KM) continue;
      // Direction from a → b in screen-y-positive-down. Lat decreases
      // northward on screen (north is up in MapLibre default), so we
      // flip the y component.
      const dx = b.lng - a.lng;
      const dy = -(b.lat - a.lat);
      const len = Math.hypot(dx, dy);
      if (len < 0.0001) continue;
      const ux = dx / len;
      const uy = dy / len;
      // Push i in -direction, j in +direction
      offsets[i][0] -= ux * PUSH_PX;
      offsets[i][1] -= uy * PUSH_PX;
      offsets[j][0] += ux * PUSH_PX;
      offsets[j][1] += uy * PUSH_PX;
    }
  }
  return offsets;
}

function upsertLineLayer(
  map: maplibregl.Map,
  id: string,
  features: GeoJSON.Feature[],
  layerSpec: { paint?: Record<string, unknown> },
) {
  const data: GeoJSON.FeatureCollection = { type: "FeatureCollection", features };
  const existing = map.getSource(id) as maplibregl.GeoJSONSource | undefined;
  if (existing) {
    existing.setData(data);
    return;
  }
  map.addSource(id, { type: "geojson", data });
  map.addLayer({
    id,
    type: "line",
    source: id,
    layout: { "line-cap": "round", "line-join": "round" },
    paint: layerSpec.paint as never,
  });
}

function upsertPolygonLayer(
  map: maplibregl.Map,
  id: string,
  features: GeoJSON.Feature[],
  spec: {
    fill: string;
    fillOpacity: number;
    outline: string;
    outlineOpacity: number;
    outlineWidth: number;
  },
) {
  const data: GeoJSON.FeatureCollection = { type: "FeatureCollection", features };
  const existing = map.getSource(id) as maplibregl.GeoJSONSource | undefined;
  if (existing) {
    existing.setData(data);
    return;
  }
  map.addSource(id, { type: "geojson", data });
  // Fill first (under), outline on top of fill but under markers.
  map.addLayer({
    id: `${id}-fill`,
    type: "fill",
    source: id,
    paint: {
      "fill-color": spec.fill,
      "fill-opacity": spec.fillOpacity,
    },
  });
  map.addLayer({
    id,
    type: "line",
    source: id,
    paint: {
      "line-color": spec.outline,
      "line-opacity": spec.outlineOpacity,
      "line-width": spec.outlineWidth,
    },
  });
}

// Build the popup HTML — photo on top when a hero exists, day badge
// + destination + (kind chip) below. Inline styles because MapLibre's
// popup container is outside our React tree (Tailwind classes there
// would require a global stylesheet rule).
function buildPopupHTML(
  stop: ResolvedStop,
  bodyFont: string,
  displayFont: string,
  tokens: ThemeTokens,
): string {
  const destination = escapeHtml(stop.destination);
  const heading = tokens.headingText || "#1f3a3a";
  const muted = "rgba(0,0,0,0.55)";
  const accent = tokens.accent || "#c9a84c";
  const kindLabel =
    stop.kind === "park" ? "Park" : stop.kind === "gateway" ? "Gateway" : "";

  const photo = stop.heroImageUrl
    ? `<img src="${escapeHtml(stop.heroImageUrl)}" alt="" style="width:100%;height:130px;object-fit:cover;border-radius:6px 6px 0 0;display:block;" />`
    : "";

  const dayLabel =
    stop.endDay > stop.dayNumber ? `Day ${stop.dayNumber}-${stop.endDay}` : `Day ${stop.dayNumber}`;

  return `
    <div style="font-family:'${bodyFont}',sans-serif;width:220px;border-radius:8px;overflow:hidden;">
      ${photo}
      <div style="padding:${photo ? "10px 12px" : "8px 10px"};">
        <div style="display:flex;align-items:baseline;gap:6px;">
          <span style="font-size:9.5px;letter-spacing:0.22em;text-transform:uppercase;color:${accent};font-weight:700;">${dayLabel}</span>
          ${
            kindLabel
              ? `<span style="font-size:9px;letter-spacing:0.18em;text-transform:uppercase;color:${muted};">${kindLabel}</span>`
              : ""
          }
        </div>
        <div style="font-size:14px;font-weight:600;color:${heading};margin-top:3px;font-family:'${displayFont}',serif;line-height:1.2;">${destination}</div>
      </div>
    </div>
  `;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
