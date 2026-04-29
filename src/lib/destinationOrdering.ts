// East-African destination ordering — a small lookup that knows the typical
// geographic sequence of major safari stops within each country, so when an
// operator types destinations in any order ("Serengeti, Tarangire, Arusha")
// the trip generator can reroute them into a sensible journey
// ("Arusha → Tarangire → Serengeti") before asking the AI to draft.
//
// The ordering numbers are *relative within a country*. Lower = closer to
// the gateway (the city travellers fly into). This is enough to produce a
// sane Day 1 → Day N sequence; we don't try to model every internal road.
//
// Unknown destinations sort last but keep their original order between
// each other — so an operator with niche stops the table doesn't know
// about still gets a usable itinerary, just with the well-known ones
// front-loaded into a real route.

const COUNTRY_ORDER: Record<string, number> = {
  // Most trips start in Tanzania or Kenya. Combined trips usually flow
  // Kenya → Tanzania → Zanzibar (or vice versa). These are tie-breakers
  // between countries; within-country order is the dominant signal.
  Kenya: 100,
  Tanzania: 200,
  Uganda: 300,
  Rwanda: 400,
};

type Entry = {
  country: keyof typeof COUNTRY_ORDER;
  order: number;     // Lower = visited earlier in a typical itinerary.
  aliases?: string[]; // Extra spellings/abbreviations the operator might type.
};

const TABLE: Record<string, Entry> = {
  // ── Tanzania — northern circuit (most popular)
  // Tarangire (110) before Lake Manyara (120): the classic loop from
  // Arusha runs south-east to Tarangire first, then west to Manyara,
  // then up to Ngorongoro and Serengeti. Operators previously got
  // routed the wrong way round when typing destinations in random
  // order.
  arusha:               { country: "Tanzania", order: 100 },
  tarangire:            { country: "Tanzania", order: 110 },
  "lake manyara":       { country: "Tanzania", order: 120 },
  manyara:              { country: "Tanzania", order: 120 },
  ngorongoro:           { country: "Tanzania", order: 130, aliases: ["ngorongoro crater", "ngorongoro highlands"] },
  serengeti:            { country: "Tanzania", order: 140, aliases: ["central serengeti", "northern serengeti", "southern serengeti"] },
  "lake natron":        { country: "Tanzania", order: 145 },
  "lake eyasi":         { country: "Tanzania", order: 148 },

  // ── Tanzania — southern + western circuits
  selous:               { country: "Tanzania", order: 200, aliases: ["nyerere", "nyerere national park"] },
  ruaha:                { country: "Tanzania", order: 210 },
  mikumi:               { country: "Tanzania", order: 215 },
  katavi:               { country: "Tanzania", order: 220 },
  mahale:               { country: "Tanzania", order: 230 },
  gombe:                { country: "Tanzania", order: 240 },

  // ── Tanzania — coast & islands (almost always last)
  zanzibar:             { country: "Tanzania", order: 900, aliases: ["stone town", "nungwi", "kendwa", "paje", "matemwe"] },
  pemba:                { country: "Tanzania", order: 910 },
  mafia:                { country: "Tanzania", order: 920 },

  // ── Kenya
  nairobi:              { country: "Kenya", order: 100 },
  amboseli:             { country: "Kenya", order: 120 },
  "lake naivasha":      { country: "Kenya", order: 130, aliases: ["naivasha"] },
  "lake nakuru":        { country: "Kenya", order: 140, aliases: ["nakuru"] },
  "maasai mara":        { country: "Kenya", order: 150, aliases: ["masai mara", "mara", "masai mara national reserve", "maasai mara national reserve"] },
  laikipia:             { country: "Kenya", order: 160 },
  samburu:              { country: "Kenya", order: 170 },
  meru:                 { country: "Kenya", order: 180 },
  "tsavo east":         { country: "Kenya", order: 190 },
  "tsavo west":         { country: "Kenya", order: 195 },
  tsavo:                { country: "Kenya", order: 190 },
  "aberdare":           { country: "Kenya", order: 165, aliases: ["aberdares"] },
  "mount kenya":        { country: "Kenya", order: 168 },

  // ── Kenya — coast (last)
  diani:                { country: "Kenya", order: 900 },
  mombasa:              { country: "Kenya", order: 910 },
  watamu:               { country: "Kenya", order: 920 },
  malindi:              { country: "Kenya", order: 925 },
  lamu:                 { country: "Kenya", order: 930 },

  // ── Uganda
  entebbe:              { country: "Uganda", order: 100 },
  kampala:              { country: "Uganda", order: 110 },
  jinja:                { country: "Uganda", order: 120 },
  "lake mburo":         { country: "Uganda", order: 140 },
  "queen elizabeth":    { country: "Uganda", order: 150, aliases: ["queen elizabeth national park", "qenp"] },
  kibale:               { country: "Uganda", order: 155, aliases: ["kibale forest", "kibale national park"] },
  bwindi:               { country: "Uganda", order: 160, aliases: ["bwindi impenetrable", "bwindi impenetrable forest"] },
  mgahinga:             { country: "Uganda", order: 165 },
  "murchison falls":    { country: "Uganda", order: 200, aliases: ["murchison"] },
  "kidepo":             { country: "Uganda", order: 220, aliases: ["kidepo valley"] },

  // ── Rwanda
  kigali:               { country: "Rwanda", order: 100 },
  musanze:              { country: "Rwanda", order: 110 },
  volcanoes:            { country: "Rwanda", order: 110, aliases: ["volcanoes national park", "volcanoes np"] },
  akagera:              { country: "Rwanda", order: 130 },
  nyungwe:              { country: "Rwanda", order: 140, aliases: ["nyungwe forest"] },
};

// Build a flat lookup of every key + alias → ordering number, keyed by
// lowercase normalised string. Done once at module load.
const LOOKUP: Map<string, number> = (() => {
  const m = new Map<string, number>();
  for (const [name, entry] of Object.entries(TABLE)) {
    const n = COUNTRY_ORDER[entry.country] ?? 9000;
    const ordering = n + entry.order;
    m.set(normalise(name), ordering);
    for (const alias of entry.aliases ?? []) {
      m.set(normalise(alias), ordering);
    }
  }
  return m;
})();

// Same shape but maps name → country, so autopilot can resolve a
// country from a destination name without hardcoding fallbacks.
const COUNTRY_LOOKUP: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const [name, entry] of Object.entries(TABLE)) {
    m.set(normalise(name), entry.country);
    for (const alias of entry.aliases ?? []) {
      m.set(normalise(alias), entry.country);
    }
  }
  return m;
})();

function normalise(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Look up the country for a single destination using the same
 *  table + alias matching as the ordering function. Returns null when
 *  the destination isn't in the table — caller decides what to do.
 *  Used by autopilot to fill a missing country instead of hardcoding
 *  a default that's wrong half the time. */
export function countryOf(name: string): string | null {
  if (!name) return null;
  const norm = normalise(name);
  const direct = COUNTRY_LOOKUP.get(norm);
  if (direct !== undefined) return direct;
  // Substring fallback — handle "Central Serengeti" → "serengeti".
  let best: { len: number; country: string } | null = null;
  for (const [key, country] of COUNTRY_LOOKUP.entries()) {
    if (norm.includes(key)) {
      if (!best || key.length > best.len) best = { len: key.length, country };
    }
  }
  return best ? best.country : null;
}

/** Look up an ordering number for a single destination. Returns null
 *  when the destination isn't in the table. */
export function destinationOrder(name: string): number | null {
  if (!name) return null;
  const norm = normalise(name);
  // Exact match first.
  const direct = LOOKUP.get(norm);
  if (direct !== undefined) return direct;
  // Substring fallback — handle "Central Serengeti" → "serengeti", etc.
  // Pick the longest matching key so "lake manyara" wins over "manyara".
  let best: { len: number; order: number } | null = null;
  for (const [key, order] of LOOKUP.entries()) {
    if (norm.includes(key)) {
      if (!best || key.length > best.len) best = { len: key.length, order };
    }
  }
  return best ? best.order : null;
}

/** Reorder a list of destinations into the typical safari sequence.
 *  Stable: unknown destinations keep their relative position and sort to
 *  the end. Operators can still override in the editor. */
export function orderDestinations<T extends string>(destinations: T[]): T[] {
  return destinations
    .map((d, i) => ({ d, i, order: destinationOrder(d) }))
    .sort((a, b) => {
      // Both unknown → preserve input order.
      if (a.order === null && b.order === null) return a.i - b.i;
      // Known beats unknown.
      if (a.order === null) return 1;
      if (b.order === null) return -1;
      // Both known → compare ordering numbers, then input order.
      if (a.order !== b.order) return a.order - b.order;
      return a.i - b.i;
    })
    .map((x) => x.d);
}
