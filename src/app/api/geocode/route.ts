import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";

// GET /api/geocode?q=Masai+Mara,Kenya
//
// Server-side proxy to Nominatim (OpenStreetMap's free geocoder). Reasons
// to proxy rather than call from the browser:
//   - Nominatim requires a real User-Agent identifying the app.
//   - We can cache responses across tenants so repeated lookups of
//     popular destinations (e.g. "Masai Mara") hit the cache after the
//     first call.
//
// Rate limiting: Nominatim's usage policy is ≤1 req/sec. We don't add
// server-side throttling here; the client caches results per-proposal
// in section.content so typical usage is a handful of requests once, then
// nothing.

const CACHE = new Map<string, { value: GeocodeResult | null; expires: number }>();
const TTL_MS = 24 * 60 * 60 * 1000; // 24h — place names rarely move.

type GeocodeResult = {
  lat: number;
  lng: number;
  displayName: string;
};

export async function GET(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ error: "q is required" }, { status: 400 });
  if (q.length > 200) return NextResponse.json({ error: "q too long" }, { status: 400 });

  const cacheKey = q.toLowerCase();
  const cached = CACHE.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return NextResponse.json({ result: cached.value });
  }

  const nominatim = new URL("https://nominatim.openstreetmap.org/search");
  nominatim.searchParams.set("q", q);
  nominatim.searchParams.set("format", "json");
  nominatim.searchParams.set("limit", "1");
  nominatim.searchParams.set("addressdetails", "0");

  try {
    const res = await fetch(nominatim.toString(), {
      headers: {
        "User-Agent": "SafariStudioPro/1.0 (contact: support@safaristudio.pro)",
        "Accept-Language": "en",
      },
      // Nominatim is a public service — don't cache at the fetch layer,
      // we manage our own cache in-process.
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn("[geocode] nominatim non-OK:", res.status);
      return NextResponse.json({ result: null });
    }
    const json = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
    if (!Array.isArray(json) || json.length === 0) {
      CACHE.set(cacheKey, { value: null, expires: Date.now() + TTL_MS });
      return NextResponse.json({ result: null });
    }
    const top = json[0];
    const result: GeocodeResult = {
      lat: parseFloat(top.lat),
      lng: parseFloat(top.lon),
      displayName: top.display_name,
    };
    if (!Number.isFinite(result.lat) || !Number.isFinite(result.lng)) {
      return NextResponse.json({ result: null });
    }
    CACHE.set(cacheKey, { value: result, expires: Date.now() + TTL_MS });

    // Trim cache if oversized. Not a sophisticated LRU — just a cap.
    if (CACHE.size > 2000) {
      const firstKey = CACHE.keys().next().value;
      if (firstKey) CACHE.delete(firstKey);
    }

    return NextResponse.json({ result });
  } catch (err) {
    console.error("[geocode] error:", err);
    return NextResponse.json({ result: null, error: "Geocoding failed" }, { status: 502 });
  }
}
