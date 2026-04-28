// ─── Safari business rules ───────────────────────────────────────────────
//
// East African safari itineraries have a domain-specific shape that
// generic geographic routing misses:
//
//   - Trips START at a gateway city or airport, never inside a park.
//   - Trips formally END at a gateway city / airport too — the
//     "drop-off". Game parks (Tarangire, Serengeti, Ngorongoro,
//     Manyara, Karatu, etc.) are NEVER the real end of the trip; if
//     an itinerary appears to "end" in a park, the operator hasn't
//     filled in the final transfer yet, and the proposal should
//     surface that explicitly instead of telling the guest the
//     trip ends in a national park.
//
// This module classifies destinations into safari-domain roles and
// provides helpers the map renderers (rail header, PrintMapPage,
// itinerary preview) consume to label things correctly.

const GATEWAY_RE: RegExp[] = [
  // Tanzania
  /\barusha\b/i,
  /\bkilimanjaro\b/i,
  /\bdar es salaam\b/i,
  /\bdar\b/i,
  /\bzanzibar\b/i,
  /\bstone town\b/i,
  // Kenya
  /\bnairobi\b/i,
  /\bmombasa\b/i,
  /\bdiani\b/i,
  // Rwanda / Uganda
  /\bkigali\b/i,
  /\bentebbe\b/i,
  /\bkampala\b/i,
];

const PARK_RE: RegExp[] = [
  /\btarangire\b/i,
  /\bserengeti\b/i,
  /\bngorongoro\b/i,
  /\blake manyara\b|^manyara\b/i,
  /\bkaratu\b/i,
  /\bmasai mara\b|\bmaasai mara\b|\bthe mara\b/i,
  /\bamboseli\b/i,
  /\btsavo\b/i,
  /\bsamburu\b/i,
  /\blaikipia\b/i,
  /\bol pejeta\b/i,
  /\bmeru\b/i,
  /\bruaha\b/i,
  /\bselous\b|\bnyerere\b/i,
  /\bmahale\b/i,
  /\bkatavi\b/i,
  /\bbwindi\b/i,
  /\bvolcanoes\b|\bmusanze\b/i,
  /\bqueen elizabeth\b|\bkasese\b/i,
  /\bmurchison\b/i,
];

export type StopKind = "gateway" | "park" | "other";

export function classifyStop(name: string): StopKind {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "other";
  for (const re of GATEWAY_RE) if (re.test(trimmed)) return "gateway";
  for (const re of PARK_RE) if (re.test(trimmed)) return "park";
  return "other";
}

export type SafariEndpoints = {
  /** First stop in the itinerary — the trip's pickup point. Always
   *  the trip's first day, regardless of safari classification. */
  start: string;

  /** Final intentional drop-off — a gateway city/airport that the
   *  guest will reach after the safari. `null` when the itinerary
   *  ends inside a park (the trip hasn't been finalised yet). */
  finalDropoff: string | null;

  /** The last named stop in the itinerary. Whether or not it's the
   *  REAL end of the trip is captured in `finalDropoff` above. Used
   *  for the "Last safari stop" label on the rail. */
  lastSafariStop: string;

  /** True when the itinerary's last stop is a national park / lodge
   *  rather than a gateway. Triggers the "to be confirmed" treatment
   *  for the drop-off label. */
  endsInPark: boolean;
};

/**
 * Resolve the safari-domain endpoints for an itinerary.
 *
 *   stops: array of destination names in chronological order
 *
 * Output rules:
 *   - start = first stop (always)
 *   - lastSafariStop = last stop (always)
 *   - finalDropoff = last stop only if it's a gateway; null if it's a park
 *   - endsInPark = true when last stop is a park / lodge (not gateway)
 */
export function resolveSafariEndpoints(stops: string[]): SafariEndpoints {
  const cleaned = stops.map((s) => s.trim()).filter(Boolean);
  if (cleaned.length === 0) {
    return { start: "", finalDropoff: null, lastSafariStop: "", endsInPark: false };
  }
  const start = cleaned[0];
  const last = cleaned[cleaned.length - 1];
  const lastKind = classifyStop(last);
  const endsInPark = lastKind === "park";
  return {
    start,
    lastSafariStop: last,
    finalDropoff: endsInPark ? null : last,
    endsInPark,
  };
}
