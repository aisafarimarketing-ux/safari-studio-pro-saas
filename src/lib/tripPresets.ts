// ─── Built-in trip presets ──────────────────────────────────────────────
//
// Curated starter itineraries operators can pick at the top of the
// Trip Setup dialog. One click seeds stops + nights + style + pace +
// interests; the operator then types guest names, dates, and origin.
//
// Why this exists: a new operator opens "+ New proposal" for the
// first time. They know their core itineraries by heart but typing
// six destinations + nights + tier picks every time is friction. A
// preset library cuts the form fill from 60s to 5s for the 80% of
// proposals that follow a standard template.
//
// Operator-saved templates (separate file) extend this with org-
// specific routes; built-ins are the floor — every install ships
// with a working set even before the operator saves their first one.

export type PresetStop = {
  destination: string;
  nights: number;
};

export interface TripPreset {
  /** Stable id used as a React key + persistence handle. */
  id: string;
  /** Human label shown in the picker — e.g. "Classic Northern TZ Big 5 · 7 nights". */
  name: string;
  /** One-line description shown beneath the name. */
  description: string;
  /** Region tag — used to filter the picker if it grows. */
  region: "Tanzania" | "Kenya" | "Uganda" | "Rwanda" | "Multi-country";
  stops: PresetStop[];
  /** Default travel style — operator can override after picking. */
  style: "luxury" | "mid_range" | "classic";
  /** Default pace — operator can override. */
  pace: "relaxed" | "balanced" | "packed";
  /** Default interest chips. Empty array = none. */
  interests: string[];
}

export const BUILT_IN_PRESETS: TripPreset[] = [
  // ── Tanzania — Northern Circuit ─────────────────────────────────────
  {
    id: "tz-northern-7n",
    name: "Northern Tanzania Big 5 · 7 nights",
    description: "Tarangire → Manyara → Ngorongoro → Serengeti, ending Arusha.",
    region: "Tanzania",
    stops: [
      { destination: "Arusha", nights: 1 },
      { destination: "Tarangire", nights: 1 },
      { destination: "Lake Manyara", nights: 1 },
      { destination: "Ngorongoro", nights: 1 },
      { destination: "Serengeti", nights: 2 },
      { destination: "Arusha", nights: 1 },
    ],
    style: "mid_range",
    pace: "balanced",
    interests: ["Big 5"],
  },
  {
    id: "tz-northern-coast-10n",
    name: "Northern Circuit + Zanzibar · 10 nights",
    description: "7 safari nights then 3 on the coast — gateway combo.",
    region: "Tanzania",
    stops: [
      { destination: "Arusha", nights: 1 },
      { destination: "Tarangire", nights: 1 },
      { destination: "Ngorongoro", nights: 1 },
      { destination: "Serengeti", nights: 3 },
      { destination: "Zanzibar", nights: 4 },
    ],
    style: "mid_range",
    pace: "balanced",
    interests: ["Big 5", "Beach"],
  },
  {
    id: "tz-honeymoon-9n",
    name: "Tanzania Honeymoon · 9 nights",
    description: "Smaller camps, longer Serengeti, Zanzibar finish.",
    region: "Tanzania",
    stops: [
      { destination: "Arusha", nights: 1 },
      { destination: "Tarangire", nights: 2 },
      { destination: "Serengeti", nights: 3 },
      { destination: "Zanzibar", nights: 3 },
    ],
    style: "luxury",
    pace: "relaxed",
    interests: ["Honeymoon", "Big 5", "Beach"],
  },

  // ── Kenya ───────────────────────────────────────────────────────────
  {
    id: "ke-mara-7n",
    name: "Kenya Classic · 7 nights",
    description: "Amboseli → Nakuru → Maasai Mara, ending Nairobi.",
    region: "Kenya",
    stops: [
      { destination: "Nairobi", nights: 1 },
      { destination: "Amboseli", nights: 2 },
      { destination: "Lake Nakuru", nights: 1 },
      { destination: "Maasai Mara", nights: 3 },
    ],
    style: "mid_range",
    pace: "balanced",
    interests: ["Big 5"],
  },
  {
    id: "ke-migration-8n",
    name: "Mara Migration · 8 nights",
    description: "Long Mara stay tuned for the river crossings.",
    region: "Kenya",
    stops: [
      { destination: "Nairobi", nights: 1 },
      { destination: "Maasai Mara", nights: 5 },
      { destination: "Diani", nights: 2 },
    ],
    style: "luxury",
    pace: "balanced",
    interests: ["Big 5", "Photography"],
  },
  {
    id: "ke-conservancy-9n",
    name: "Kenya Conservancy + Coast · 9 nights",
    description: "Laikipia private conservancy then Lamu / Diani.",
    region: "Kenya",
    stops: [
      { destination: "Nairobi", nights: 1 },
      { destination: "Laikipia", nights: 3 },
      { destination: "Maasai Mara", nights: 3 },
      { destination: "Diani", nights: 2 },
    ],
    style: "luxury",
    pace: "relaxed",
    interests: ["Conservation", "Big 5", "Beach"],
  },

  // ── Uganda — Gorilla focus ──────────────────────────────────────────
  {
    id: "ug-gorillas-6n",
    name: "Uganda Gorillas · 6 nights",
    description: "Bwindi gorilla tracking + Queen Elizabeth wildlife.",
    region: "Uganda",
    stops: [
      { destination: "Entebbe", nights: 1 },
      { destination: "Bwindi", nights: 2 },
      { destination: "Queen Elizabeth", nights: 2 },
      { destination: "Entebbe", nights: 1 },
    ],
    style: "mid_range",
    pace: "balanced",
    interests: ["Hiking", "Conservation"],
  },

  // ── Rwanda — Volcanoes ──────────────────────────────────────────────
  {
    id: "rw-volcanoes-4n",
    name: "Rwanda Gorillas · 4 nights",
    description: "Two gorilla treks from Volcanoes National Park.",
    region: "Rwanda",
    stops: [
      { destination: "Kigali", nights: 1 },
      { destination: "Volcanoes (Rwanda)", nights: 3 },
    ],
    style: "luxury",
    pace: "balanced",
    interests: ["Hiking", "Conservation"],
  },

  // ── Multi-country combos ────────────────────────────────────────────
  {
    id: "ke-tz-12n",
    name: "Kenya + Tanzania Combo · 12 nights",
    description: "Mara migration, then southwest into Serengeti + Zanzibar.",
    region: "Multi-country",
    stops: [
      { destination: "Nairobi", nights: 1 },
      { destination: "Maasai Mara", nights: 3 },
      { destination: "Serengeti", nights: 3 },
      { destination: "Ngorongoro", nights: 1 },
      { destination: "Zanzibar", nights: 4 },
    ],
    style: "luxury",
    pace: "balanced",
    interests: ["Big 5", "Photography", "Beach"],
  },
  {
    id: "rw-ug-tz-14n",
    name: "Gorillas + Big 5 + Beach · 14 nights",
    description: "Volcanoes → Bwindi → Serengeti → Zanzibar — bucket-list combo.",
    region: "Multi-country",
    stops: [
      { destination: "Kigali", nights: 1 },
      { destination: "Volcanoes (Rwanda)", nights: 2 },
      { destination: "Bwindi", nights: 2 },
      { destination: "Arusha", nights: 1 },
      { destination: "Serengeti", nights: 3 },
      { destination: "Ngorongoro", nights: 1 },
      { destination: "Zanzibar", nights: 4 },
    ],
    style: "luxury",
    pace: "balanced",
    interests: ["Big 5", "Hiking", "Beach", "Conservation"],
  },
];

// ─── Operator-saved templates (localStorage) ───────────────────────────

const SAVED_KEY = "ss-trip-templates-v1";

export function loadSavedTemplates(): TripPreset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SAVED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidPreset);
  } catch {
    return [];
  }
}

export function saveTemplate(preset: TripPreset): void {
  if (typeof window === "undefined") return;
  try {
    const existing = loadSavedTemplates();
    const without = existing.filter((p) => p.id !== preset.id);
    const next = [preset, ...without].slice(0, 25);
    window.localStorage.setItem(SAVED_KEY, JSON.stringify(next));
  } catch {
    // ignore quota
  }
}

export function deleteTemplate(id: string): void {
  if (typeof window === "undefined") return;
  try {
    const existing = loadSavedTemplates();
    const next = existing.filter((p) => p.id !== id);
    window.localStorage.setItem(SAVED_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

function isValidPreset(v: unknown): v is TripPreset {
  if (!v || typeof v !== "object") return false;
  const obj = v as Record<string, unknown>;
  return (
    typeof obj.id === "string" &&
    typeof obj.name === "string" &&
    Array.isArray(obj.stops) &&
    typeof obj.style === "string" &&
    typeof obj.pace === "string"
  );
}
