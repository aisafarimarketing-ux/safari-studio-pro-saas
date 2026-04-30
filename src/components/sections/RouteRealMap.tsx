"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { lookupDemoCoord } from "@/lib/demoDestinationCoords";
import { classifyStop, isCoastCity } from "@/lib/safariRoutingRules";
import type { Day, ProposalTheme, ThemeTokens } from "@/lib/types";

// ─── RouteRealMap ───────────────────────────────────────────────────────
//
// Real cartographic map — Carto Voyager basemap via MapLibre GL. Renders
// the actual geography of East Africa: real coastlines, real park
// outlines (where the basemap shows them), real road networks. Replaces
// the parchment-style RouteSchematic for operators who want the
// proposal to feel like a tour-operator map, not a stylised diagram.
//
// What it draws:
//   - Numbered circle markers at each unique day destination
//   - Connecting lines between consecutive stops:
//       · Solid teal for flights (transfer between distant gateways /
//         coast-to-inland legs that can't be driven in a day)
//       · Dashed teal for roads (everything else)
//   - Auto-fit bounds with breathing-room padding so the route doesn't
//     hug the edges
//
// Coordinates: each day's destination is resolved through
// lookupDemoCoord (case-insensitive, suffix-tolerant). Days whose
// destination doesn't match any entry are silently dropped from the
// map — the rail still shows them so the operator notices.
//
// Basemap: free Carto Voyager raster-via-vector style. No token
// required. CDN-hosted; clients viewing the share view need internet
// for the tiles to render. PDF export rasterises via map.getCanvas()
// before the map unmounts (handled by the parent print path).

interface RouteRealMapProps {
  days: Day[];
  tokens: ThemeTokens;
  theme: ProposalTheme;
  isEditor: boolean;
}

const BASEMAP_STYLE = "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";

type ResolvedStop = {
  destination: string;
  coord: { lat: number; lng: number };
  dayNumber: number;
  kind: ReturnType<typeof classifyStop>;
};

export function RouteRealMap({ days, tokens, theme }: RouteRealMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Resolve each day's coord and de-duplicate adjacent identical stops
  // (e.g., a 3-night Serengeti stay collapses to one map pin labelled
  // "Day 3-5" upstream; the schematic version always showed one pin per
  // unique destination so we keep that behaviour here).
  const stops = useMemo<ResolvedStop[]>(() => {
    const sorted = [...days].sort((a, b) => a.dayNumber - b.dayNumber);
    const out: ResolvedStop[] = [];
    for (const d of sorted) {
      const dest = (d.destination ?? "").trim();
      if (!dest) continue;
      const coord = lookupDemoCoord(dest);
      if (!coord) continue;
      const last = out[out.length - 1];
      if (last && last.destination.toLowerCase() === dest.toLowerCase()) continue;
      out.push({
        destination: dest,
        coord,
        dayNumber: d.dayNumber,
        kind: classifyStop(dest),
      });
    }
    return out;
  }, [days]);

  // Initialise the map once on mount. Map options are static — we
  // imperatively manage source/layer updates afterwards rather than
  // recreating the map for each prop change.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (stops.length === 0) return;

    // Fit bounds calculation: MapLibre takes [west, south, east, north].
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
      // Touch-friendly defaults; cooperative gestures so the map
      // doesn't hijack page scroll on desktop trackpads.
      cooperativeGestures: true,
      // Disable rotation — itineraries read better north-up.
      pitchWithRotate: false,
      dragRotate: false,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    map.on("load", () => {
      setMapLoaded(true);
    });

    mapRef.current = map;

    return () => {
      // Drop all markers + the map. Recreating on stop changes is
      // cheaper than re-running the imperative source/layer dance for
      // a stale instance.
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
      setMapLoaded(false);
    };
    // Stops length is the only re-init trigger — coordinate moves
    // within the same set are handled in the marker / line update
    // effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stops.length]);

  // Add / refresh markers + route lines whenever stops or load state
  // change. Runs as a single imperative pass so we never re-render
  // half a route.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || stops.length === 0) return;

    // ── Markers — numbered teal circles with white border. Built as
    //    DOM elements so we can style them per brand without inline
    //    SVG icons. Each new effect cycle wipes and rebuilds; cheap
    //    enough for a typical 5-12 stop trip.
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    stops.forEach((stop, idx) => {
      const el = document.createElement("div");
      el.className = "ss-route-marker";
      el.style.width = "28px";
      el.style.height = "28px";
      el.style.borderRadius = "50%";
      el.style.background = tokens.headingText || "#1f3a3a";
      el.style.color = "#ffffff";
      el.style.border = "2px solid #ffffff";
      el.style.boxShadow = "0 2px 6px rgba(0,0,0,0.25)";
      el.style.display = "flex";
      el.style.alignItems = "center";
      el.style.justifyContent = "center";
      el.style.fontWeight = "700";
      el.style.fontSize = "12px";
      el.style.fontFamily = `'${theme.bodyFont}', sans-serif`;
      el.textContent = String(idx + 1);

      const popup = new maplibregl.Popup({
        offset: 18,
        closeButton: false,
        className: "ss-route-popup",
      }).setHTML(
        `<div style="font-family:'${theme.bodyFont}',sans-serif;padding:2px 4px;">
          <div style="font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(0,0,0,0.5);font-weight:600;">Day ${stop.dayNumber}</div>
          <div style="font-size:13px;font-weight:600;color:#1f3a3a;margin-top:2px;">${escapeHtml(stop.destination)}</div>
        </div>`,
      );

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([stop.coord.lng, stop.coord.lat])
        .setPopup(popup)
        .addTo(map);
      markersRef.current.push(marker);
    });

    // ── Route lines — split into two GeoJSON layers, one for road
    //    legs (dashed) and one for flight legs (solid). A leg is a
    //    "flight" when it crosses too far to drive in a day OR when
    //    it connects an inland park to a coast gateway (Zanzibar etc).
    const roadFeatures: GeoJSON.Feature[] = [];
    const flightFeatures: GeoJSON.Feature[] = [];

    for (let i = 0; i < stops.length - 1; i++) {
      const a = stops[i];
      const b = stops[i + 1];
      const isFlight = legNeedsFlight(a, b);
      const feature: GeoJSON.Feature = {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: bowedLeg(a.coord, b.coord),
        },
      };
      (isFlight ? flightFeatures : roadFeatures).push(feature);
    }

    upsertLineLayer(map, "ss-route-roads", roadFeatures, {
      paint: {
        "line-color": tokens.headingText || "#1f3a3a",
        "line-width": 2.5,
        "line-dasharray": [1.5, 1.5],
        "line-opacity": 0.85,
      },
    });
    upsertLineLayer(map, "ss-route-flights", flightFeatures, {
      paint: {
        "line-color": tokens.accent || "#c9a84c",
        "line-width": 2.5,
        "line-opacity": 0.95,
      },
    });

    // Re-fit bounds when the stop set changes — covers the case of
    // operator adding/removing a stop in the editor while the map is
    // already mounted.
    const lngs = stops.map((s) => s.coord.lng);
    const lats = stops.map((s) => s.coord.lat);
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: { top: 60, bottom: 60, left: 60, right: 60 }, maxZoom: 9, duration: 600 },
    );
  }, [stops, mapLoaded, tokens.headingText, tokens.accent, theme.bodyFont]);

  // Empty state — no resolvable destinations yet. Render a soft
  // placeholder so the cell isn't blank and the operator gets a hint.
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
      ref={containerRef}
      className="w-full ss-route-realmap"
      style={{
        minHeight: 360,
        height: "100%",
        background: tokens.cardBg,
      }}
    />
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────

// Distance in kilometres via haversine. Used to decide whether a leg
// is a flight (too far to drive) or a road transfer.
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

// A leg is a flight when:
//   - It connects an inland stop to a coast city (Zanzibar / Diani / Lamu /
//     Mombasa / Watamu), OR
//   - It connects two gateways more than ~500 km apart (e.g., Nairobi →
//     Arusha can be driven, but Nairobi → Mombasa is a flight).
//   - It's longer than 350 km (no operator is driving 9+ hours in a day).
function legNeedsFlight(a: ResolvedStop, b: ResolvedStop): boolean {
  if (isCoastCity(a.destination) !== isCoastCity(b.destination)) return true;
  const km = haversineKm(a.coord, b.coord);
  return km > 350;
}

// Bow each leg slightly so consecutive segments don't read as a
// straight-line zig-zag — gives the route a journeyed feel without
// inventing geography. Bow strength 12% of leg length, perpendicular
// to the chord.
function bowedLeg(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): [number, number][] {
  const steps = 32;
  const dx = b.lng - a.lng;
  const dy = b.lat - a.lat;
  const len = Math.hypot(dx, dy);
  if (len < 0.001) return [
    [a.lng, a.lat],
    [b.lng, b.lat],
  ];
  // Perpendicular offset for the control point. Sign: negative y in
  // screen space pushes the control "north" of the chord, which reads
  // as a gentle bow on most northbound trips. The sign is consistent
  // so every leg curves the same way and the route looks tidy.
  const perpX = -dy / len;
  const perpY = dx / len;
  const bow = len * 0.12;
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

// Add or update a line layer, replacing any existing source/layer of
// the same id. Lets the effect re-run on every stop change without
// "Source already exists" errors.
function upsertLineLayer(
  map: maplibregl.Map,
  id: string,
  features: GeoJSON.Feature[],
  layerSpec: { paint?: Record<string, unknown> },
) {
  const data: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features,
  };
  const existingSrc = map.getSource(id) as maplibregl.GeoJSONSource | undefined;
  if (existingSrc) {
    existingSrc.setData(data);
    return;
  }
  map.addSource(id, { type: "geojson", data });
  map.addLayer({
    id,
    type: "line",
    source: id,
    layout: {
      "line-cap": "round",
      "line-join": "round",
    },
    paint: layerSpec.paint as never,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
