// One-shot script: fetch real park boundary polygons from OSM/Nominatim,
// simplify with Ramer–Douglas–Peucker, write a generated TypeScript
// module under src/lib/safariParkBoundariesData.ts. Run with:
//   node scripts/fetch-park-boundaries.mjs
//
// Output is checked-in static data — we don't hit Nominatim at runtime.
// Re-run only if a park's boundary changes significantly in OSM.

import fs from "node:fs/promises";
import path from "node:path";

const PARKS = [
  { key: "serengeti", q: "Serengeti National Park, Tanzania" },
  { key: "ngorongoro", q: "Ngorongoro Conservation Area, Tanzania" },
  { key: "tarangire", q: "Tarangire National Park, Tanzania" },
  { key: "lakeManyara", q: "Lake Manyara National Park, Tanzania" },
  { key: "selous", q: "Selous Game Reserve, Tanzania" },
  { key: "nyerere", q: "Nyerere National Park, Tanzania" },
  { key: "ruaha", q: "Ruaha National Park, Tanzania" },
  { key: "mahale", q: "Mahale Mountains National Park, Tanzania" },
  { key: "masaiMara", q: "Masai Mara National Reserve, Narok, Kenya" },
  { key: "amboseli", q: "Amboseli National Park, Kenya" },
  { key: "tsavoEast", q: "Tsavo East National Park, Kenya" },
  { key: "tsavoWest", q: "Tsavo West National Park, Kenya" },
  { key: "samburu", q: "Samburu National Reserve, Kenya" },
  { key: "bwindi", q: "Bwindi Impenetrable National Park, Uganda" },
  { key: "queenElizabeth", q: "Queen Elizabeth National Park, Uganda" },
  { key: "murchison", q: "Murchison Falls National Park, Uganda" },
  { key: "volcanoes", q: "Volcanoes National Park, Rwanda" },
  { key: "akagera", q: "Akagera National Park, Rwanda" },
];

const UA = "safari-studio-pro/1.0 (one-shot park boundary fetch)";

async function fetchPark(q) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&polygon_geojson=1&limit=1`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${q}`);
  const arr = await res.json();
  if (!arr.length) throw new Error(`no result for ${q}`);
  return arr[0];
}

// Ramer–Douglas–Peucker on [lng,lat] segments. Tolerance in degrees.
function rdp(points, tolerance) {
  if (points.length < 3) return points;
  let maxDist = 0;
  let index = 0;
  const [a, b] = [points[0], points[points.length - 1]];
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistance(points[i], a, b);
    if (d > maxDist) {
      maxDist = d;
      index = i;
    }
  }
  if (maxDist > tolerance) {
    const left = rdp(points.slice(0, index + 1), tolerance);
    const right = rdp(points.slice(index), tolerance);
    return [...left.slice(0, -1), ...right];
  }
  return [a, b];
}

function perpendicularDistance(p, a, b) {
  const [px, py] = p;
  const [ax, ay] = a;
  const [bx, by] = b;
  const num = Math.abs((by - ay) * px - (bx - ax) * py + bx * ay - by * ax);
  const den = Math.hypot(by - ay, bx - ax) || 1;
  return num / den;
}

function simplify(geojson, tolerance) {
  // GeoJSON returns either Polygon (rings = [outer, ...holes]) or
  // MultiPolygon (polygons = [[outer, ...holes], ...]). We keep just
  // the outer ring of the largest polygon (parks aren't visualised
  // with holes / islands at this scale).
  let ring = null;
  if (geojson.type === "Polygon") {
    ring = geojson.coordinates[0];
  } else if (geojson.type === "MultiPolygon") {
    let bestArea = 0;
    for (const poly of geojson.coordinates) {
      const r = poly[0];
      const a = polygonArea(r);
      if (a > bestArea) {
        bestArea = a;
        ring = r;
      }
    }
  }
  if (!ring) return [];
  // Closed rings repeat the first point at the end; strip it before
  // RDP so the chord isn't degenerate. We don't add it back — Leaflet
  // closes the polygon automatically.
  if (
    ring.length >= 2 &&
    ring[0][0] === ring[ring.length - 1][0] &&
    ring[0][1] === ring[ring.length - 1][1]
  ) {
    ring = ring.slice(0, -1);
  }
  // Split at the point farthest from the start so RDP has a non-
  // degenerate diameter to bisect against. Otherwise a long thin park
  // (Tarangire) collapses to its two endpoints.
  let farthest = 0;
  let farDist = 0;
  for (let i = 1; i < ring.length; i++) {
    const d = Math.hypot(ring[i][0] - ring[0][0], ring[i][1] - ring[0][1]);
    if (d > farDist) {
      farDist = d;
      farthest = i;
    }
  }
  const half1 = rdp(ring.slice(0, farthest + 1), tolerance);
  const half2 = rdp([...ring.slice(farthest), ring[0]], tolerance);
  // Stitch — drop the duplicated split point and the closing point.
  return [...half1.slice(0, -1), ...half2.slice(0, -1)];
}

function polygonArea(ring) {
  let area = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area / 2);
}

function toLatLng(ring) {
  // GeoJSON: [lng, lat] → Leaflet expects [lat, lng]
  return ring.map(([lng, lat]) => [
    Math.round(lat * 10000) / 10000,
    Math.round(lng * 10000) / 10000,
  ]);
}

async function main() {
  const out = [];
  for (const { key, q } of PARKS) {
    process.stdout.write(`fetching ${key} … `);
    try {
      const r = await fetchPark(q);
      if (!r.geojson) {
        console.log("no geojson");
        continue;
      }
      // Tolerance ~0.005° (≈ 500m) keeps detail without bloating
      // bundle size. Larger parks tolerate slightly more simplification.
      const tol = ["serengeti", "selous", "nyerere", "ruaha"].includes(key) ? 0.012 : 0.006;
      const simplified = simplify(r.geojson, tol);
      const ring = toLatLng(simplified);
      out.push({ key, name: r.display_name.split(",")[0], coords: ring });
      console.log(`${ring.length} verts`);
    } catch (err) {
      console.log(`err: ${err.message}`);
    }
    // Nominatim asks for ≤ 1 req/sec — be polite.
    await new Promise((r) => setTimeout(r, 1100));
  }

  const content =
    `// AUTO-GENERATED by scripts/fetch-park-boundaries.mjs.\n` +
    `// Source: OpenStreetMap via Nominatim (ODbL).\n` +
    `// Re-run the script if a boundary changes significantly upstream.\n\n` +
    `import type { LatLngTuple } from "leaflet";\n\n` +
    `export const REAL_PARK_RINGS: Record<string, LatLngTuple[]> = {\n` +
    out
      .map(
        (p) =>
          `  ${p.key}: [\n${p.coords
            .map(([lat, lng]) => `    [${lat}, ${lng}],`)
            .join("\n")}\n  ],`,
      )
      .join("\n") +
    `\n};\n`;

  const target = path.join("src", "lib", "safariParkBoundariesData.ts");
  await fs.writeFile(target, content);
  console.log(`\nwrote ${target} — ${out.length} parks`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
