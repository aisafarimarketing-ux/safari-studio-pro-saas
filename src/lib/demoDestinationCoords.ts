// ─── Demo destination coordinates ─────────────────────────────────────────
//
// Static lookup used by the public /demo page to pin the route map without
// any geocoder round-trip. Covers the 30-odd destinations the starter
// library and AI drafts routinely produce across East Africa, plus the
// classic post-safari beach stops.
//
// Keys are lower-cased, whitespace-normalised destination names — match
// the day.destination strings Claude returns. Lookup is tolerant: the
// resolver strips "national park", "national reserve", and "conservancy"
// suffixes so "Maasai Mara National Reserve" still hits "maasai mara".

export type DestCoord = { lat: number; lng: number };

const COORDS: Record<string, DestCoord> = {
  // ── Kenya ─────────────────────────────────────────────────────────────
  nairobi:             { lat: -1.2921, lng: 36.8219 },
  mombasa:             { lat: -4.0435, lng: 39.6682 },
  "maasai mara":       { lat: -1.5020, lng: 35.1430 },
  "masai mara":        { lat: -1.5020, lng: 35.1430 },
  mara:                { lat: -1.5020, lng: 35.1430 },
  "mara triangle":     { lat: -1.4450, lng: 35.0000 },
  samburu:             { lat:  0.5800, lng: 37.5500 },
  amboseli:            { lat: -2.6530, lng: 37.2606 },
  "lake nakuru":       { lat: -0.3700, lng: 36.0800 },
  nakuru:              { lat: -0.3031, lng: 36.0800 },
  "lake naivasha":     { lat: -0.7750, lng: 36.3500 },
  naivasha:            { lat: -0.7172, lng: 36.4309 },
  lewa:                { lat:  0.2000, lng: 37.4167 },
  "lewa wildlife conservancy": { lat: 0.2000, lng: 37.4167 },
  "ol pejeta":         { lat:  0.0000, lng: 36.9167 },
  laikipia:            { lat:  0.3333, lng: 36.7833 },
  lamu:                { lat: -2.2696, lng: 40.9020 },
  tsavo:               { lat: -2.9833, lng: 38.4667 },
  "tsavo east":        { lat: -2.7000, lng: 38.8000 },
  "tsavo west":        { lat: -3.2500, lng: 38.0000 },
  aberdare:            { lat: -0.4000, lng: 36.7500 },
  diani:               { lat: -4.2769, lng: 39.5995 },
  watamu:              { lat: -3.3564, lng: 39.9903 },
  "meru":              { lat:  0.1667, lng: 38.2000 },
  kilifi:              { lat: -3.6309, lng: 39.8493 },

  // ── Tanzania ──────────────────────────────────────────────────────────
  arusha:              { lat: -3.3869, lng: 36.6830 },
  "dar es salaam":     { lat: -6.7924, lng: 39.2083 },
  dar:                 { lat: -6.7924, lng: 39.2083 },
  serengeti:           { lat: -2.3333, lng: 34.8333 },
  "central serengeti": { lat: -2.4220, lng: 34.8330 },
  "northern serengeti":{ lat: -2.0000, lng: 34.7500 },
  "southern serengeti":{ lat: -3.0000, lng: 35.0000 },
  ngorongoro:          { lat: -3.2000, lng: 35.5000 },
  "ngorongoro crater": { lat: -3.2000, lng: 35.5000 },
  tarangire:           { lat: -3.8333, lng: 35.9333 },
  "lake manyara":      { lat: -3.5833, lng: 35.8333 },
  manyara:             { lat: -3.5833, lng: 35.8333 },
  zanzibar:            { lat: -6.1659, lng: 39.2026 },
  "stone town":        { lat: -6.1629, lng: 39.1887 },
  ruaha:               { lat: -7.6667, lng: 34.9000 },
  selous:              { lat: -7.7000, lng: 37.5000 },
  nyerere:             { lat: -7.7000, lng: 37.5000 },
  mahale:              { lat: -6.1800, lng: 29.8700 },
  mafia:               { lat: -7.8500, lng: 39.7500 },
  pemba:               { lat: -5.1000, lng: 39.7833 },

  // ── Uganda ────────────────────────────────────────────────────────────
  kampala:             { lat:  0.3476, lng: 32.5825 },
  entebbe:             { lat:  0.0447, lng: 32.4633 },
  bwindi:              { lat: -1.0500, lng: 29.7500 },
  "bwindi impenetrable":{ lat: -1.0500, lng: 29.7500 },
  mgahinga:            { lat: -1.3667, lng: 29.6333 },
  kidepo:              { lat:  3.9000, lng: 33.8333 },
  "queen elizabeth":   { lat: -0.2000, lng: 30.0500 },
  "murchison falls":   { lat:  2.2764, lng: 31.6880 },
  kibale:              { lat:  0.4833, lng: 30.3667 },
  "lake mburo":        { lat: -0.6000, lng: 30.9500 },

  // ── Rwanda ────────────────────────────────────────────────────────────
  kigali:              { lat: -1.9536, lng: 30.0606 },
  "volcanoes national park": { lat: -1.4700, lng: 29.4980 },
  volcanoes:           { lat: -1.4700, lng: 29.4980 },
  nyungwe:             { lat: -2.5000, lng: 29.2500 },
  akagera:             { lat: -1.7500, lng: 30.7167 },
};

const SUFFIXES = [
  " national reserve",
  " national park",
  " conservancy",
  " game reserve",
  " reserve",
  " np",
];

function normalise(name: string): string {
  let s = name.trim().toLowerCase();
  // Strip common suffixes
  for (const suf of SUFFIXES) {
    if (s.endsWith(suf)) {
      s = s.slice(0, -suf.length).trim();
      break;
    }
  }
  return s.replace(/\s+/g, " ");
}

export function lookupDemoCoord(destination: string): DestCoord | null {
  if (!destination) return null;
  const key = normalise(destination);
  if (COORDS[key]) return COORDS[key];
  // Fall back to first word match — "Serengeti (Kogatende)" → "serengeti"
  const firstWord = key.split(/[\s,(]/)[0];
  if (firstWord && COORDS[firstWord]) return COORDS[firstWord];
  return null;
}
