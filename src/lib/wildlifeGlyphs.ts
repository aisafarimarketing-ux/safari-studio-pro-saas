// ─── wildlifeGlyphs ─────────────────────────────────────────────────────
//
// Tiny SVG-path glyphs that render inside park polygons on the route
// schematic, evoking the wildlife or terrain of each destination —
// like the small wildlife silhouettes scattered on classic safari-
// operator maps. Each glyph is designed in a 24×24 viewBox and gets
// scaled down to ~16-22px when placed.
//
// Mapping is by destination-name regex (same matching style as
// safariParkBoundaries / safariCoords) so an operator typing
// "Serengeti" or "Maasai Mara" gets a lion, "Zanzibar" gets a palm,
// and so on. Anything unmatched falls through to the generic "tent"
// glyph — never empty.

export type GlyphKind =
  | "lion"
  | "elephant"
  | "buffalo"
  | "gorilla"
  | "mountain"
  | "palm"
  | "rhino"
  | "flamingo"
  | "giraffe"
  | "tent";

interface GlyphDef {
  kind: GlyphKind;
  /** SVG path d-attribute(s), drawn in a 24x24 viewBox. */
  paths: string[];
  /** Stroke width when drawn outlined. */
  strokeWidth?: number;
  /** Fill — true = filled silhouette; false = outlined. */
  filled?: boolean;
}

// ─── Glyph definitions ─────────────────────────────────────────────────
//
// All paths designed to read as a clear silhouette at 18-22px on
// screen. Stylised, not anatomically perfect — same register as a
// guidebook key.

const GLYPHS: Record<GlyphKind, GlyphDef> = {
  lion: {
    kind: "lion",
    filled: true,
    // Round head + mane + small body — reads as lion at 20px.
    paths: [
      // Mane (rounded petals around the head)
      "M12 2.5c1.6 0 2.7.7 3.4 1.6.7-.6 1.7-.6 2.4 0 .8.7.9 1.8.4 2.6.8.5 1.3 1.3 1.3 2.3 0 1-.6 1.9-1.4 2.4.4.7.4 1.6 0 2.3-.5.8-1.4 1.2-2.4 1.2-.4 0-.8-.1-1.2-.2-.6.6-1.4 1-2.3 1H11.7c-.9 0-1.7-.4-2.3-1-.4.1-.8.2-1.2.2-1 0-1.9-.4-2.4-1.2-.4-.7-.4-1.6 0-2.3-.8-.5-1.4-1.4-1.4-2.4 0-1 .5-1.8 1.3-2.3-.5-.8-.4-1.9.4-2.6.7-.6 1.7-.6 2.4 0 .7-.9 1.8-1.6 3.4-1.6z",
      // Body
      "M12 13c2.7 0 5 1.4 5 4 0 2-1.3 3.5-3 4l-2 1-2-1c-1.7-.5-3-2-3-4 0-2.6 2.3-4 5-4z",
      // Eyes (negative space — tiny dots)
      "M10.4 8.2a.7.7 0 1 1-1.4 0 .7.7 0 0 1 1.4 0zM15 8.2a.7.7 0 1 1-1.4 0 .7.7 0 0 1 1.4 0z",
    ],
  },

  elephant: {
    kind: "elephant",
    filled: true,
    paths: [
      // Body + head + trunk
      "M5 11c0-2.8 2.5-5 6-5 2.4 0 4.5 1 5.6 2.6.4-.8 1.2-1.4 2.1-1.4 1.5 0 2.7 1.4 2.4 2.9-.2 1-1 1.7-2 1.9V14c0 2.8-1.6 4.5-4 5.4V21h-1.5v-1.3c-.5.1-1 .2-1.6.2s-1.1-.1-1.6-.2V21H9V19.4c-2.4-.9-4-2.6-4-5.4v-3z",
      // Trunk (curl)
      "M19.5 10.5c.8.7 1.1 1.6.7 2.4-.3.7-1 1.1-1.7 1.1",
      // Tusk
      "M9.4 13.7l1.3 2.3",
    ],
    strokeWidth: 1.2,
  },

  buffalo: {
    kind: "buffalo",
    filled: true,
    paths: [
      // Stocky body
      "M5 12c0-2.5 2-4.3 4-4.3.4 0 .8 0 1.2.2C10.7 7.5 11.3 7 12 7s1.3.5 1.8 1c.4-.2.8-.2 1.2-.2 2 0 4 1.8 4 4.3v3.7c0 1.6-1 2.7-2.5 3.2l-1 .5v1H13v-1c-.3.1-.6.1-1 .1s-.7 0-1-.1v1H8.5v-1l-1-.5C6 18.4 5 17.3 5 15.7V12z",
      // Curved horns (sweeping outwards)
      "M9 6c-1 0-2 .8-2.5 1.6M15 6c1 0 2 .8 2.5 1.6",
    ],
    strokeWidth: 1.2,
  },

  gorilla: {
    kind: "gorilla",
    filled: true,
    paths: [
      // Sitting silhouette — broad shoulders, big head
      "M7 10c0-2.8 2.2-4.5 5-4.5s5 1.7 5 4.5v.5c1.5.4 2.5 1.6 2.5 3.2 0 1.6-1 3-2.5 3.4v1.4c0 1.4-1.1 2.5-2.5 2.5h-5c-1.4 0-2.5-1.1-2.5-2.5v-1.4C5.5 16.7 4.5 15.3 4.5 13.7c0-1.6 1-2.8 2.5-3.2V10z",
      // Eyes
      "M10 11.5a.7.7 0 1 1-1.4 0 .7.7 0 0 1 1.4 0zM15.5 11.5a.7.7 0 1 1-1.4 0 .7.7 0 0 1 1.4 0z",
    ],
  },

  mountain: {
    kind: "mountain",
    filled: false,
    paths: [
      // Twin peaks, snow-capped
      "M3 19l5-9 3.5 5L15 11l6 8z",
      // Snow caps
      "M7.4 11l1 2 1.6-1.6M14 11.5l-.6 1.2 1.2 1",
    ],
    strokeWidth: 1.4,
  },

  palm: {
    kind: "palm",
    filled: false,
    paths: [
      // Palm trunk
      "M12 21V10",
      // Crown — six fronds spreading
      "M12 10c-2-3-5-3.5-7-2",
      "M12 10c-2-2.5-2.5-5-1-7",
      "M12 10c2-3 5-3.5 7-2",
      "M12 10c2-2.5 2.5-5 1-7",
      "M12 10c-3-1-5 0-6 2",
      "M12 10c3-1 5 0 6 2",
    ],
    strokeWidth: 1.4,
  },

  rhino: {
    kind: "rhino",
    filled: true,
    paths: [
      // Body + head + horn
      "M3.5 13.5c0-3.3 2.5-5.5 5.5-5.5 1 0 2 .3 2.8.7l1.7-1.5c.6-.5 1.5-.5 2 .1.5.5.5 1.4 0 2L14 11h.5c3 0 5 2 5 5v2h-2v1.5h-2V18h-7v1.5h-2V18h-2v-1.5h-1v-3z",
      // Horn (front)
      "M14.5 9.5L13 12",
    ],
    strokeWidth: 1.2,
  },

  flamingo: {
    kind: "flamingo",
    filled: true,
    paths: [
      // Long-necked silhouette
      "M9 21l-1-3-1-1 1-2c-1-1.5-1-3.5 0-5 1-1.5 3-2 4.5-1.5l1-1 .5 1c1 0 2 .5 2.5 1.5L17 12l-1 .5L14 16l-2 5H9z",
      // Beak
      "M14.5 10.5l1.5-.5",
    ],
    strokeWidth: 1.2,
  },

  giraffe: {
    kind: "giraffe",
    filled: true,
    paths: [
      // Long neck + small head + body
      "M11 21h-2l-.5-7c-.3-1-1-2-2-2.5l-1-.5v-1l1.5-.5c1 0 1.7-.7 1.7-1.7L9 6c0-2 1.5-3.5 3.5-3.5S16 4 16 6c0 .8-.5 1.5-1.2 1.8l-.3 4c0 1.2 1 1.8 2 2.2L18 14.5v6.5h-2l-.5-3.5L14 14h-2l-1 7z",
      // Horns (small)
      "M11.5 4l-.5-1M13.5 4l.5-1",
    ],
    strokeWidth: 1,
  },

  tent: {
    kind: "tent",
    filled: false,
    paths: [
      // Triangular tent
      "M3 19h18L12 5z",
      // Door flap
      "M12 19v-7l-2 4M12 12l2 4",
    ],
    strokeWidth: 1.4,
  },
};

// ─── Destination → glyph mapping ───────────────────────────────────────
//
// Order matters — first match wins. Specific names before generic
// fallbacks. Unknown destinations fall through to the tent glyph.

interface DestinationMapping {
  match: RegExp;
  kind: GlyphKind;
}

const MAPPINGS: DestinationMapping[] = [
  // Big cats / safari plains
  { match: /\bserengeti\b|\bmasai mara\b|\bmaasai mara\b|\bthe mara\b/i, kind: "lion" },

  // Elephants
  { match: /\btarangire\b|\bamboseli\b|\btsavo\b|\bchobe\b/i, kind: "elephant" },

  // Mountain / volcanoes
  { match: /\bkilimanjaro\b|\bmount kenya\b|\bvolcanoes\b|\bmusanze\b/i, kind: "mountain" },

  // Gorillas — Bwindi specifically
  { match: /\bbwindi\b/i, kind: "gorilla" },

  // Buffalo / mixed game in crater country
  { match: /\bngorongoro\b|\blake manyara\b|\bmanyara\b|\bsamburu\b|\bselous\b|\bnyerere\b/i, kind: "buffalo" },

  // Flamingos — Lakes Nakuru / Naivasha
  { match: /\bnakuru\b|\bnaivasha\b/i, kind: "flamingo" },

  // Giraffes — Laikipia / Meru / Ol Pejeta
  { match: /\blaikipia\b|\bmeru\b|\bol pejeta\b|\bmurchison\b/i, kind: "giraffe" },

  // Rhino reserves
  { match: /\bsolio\b|\blewa\b|\bsweetwaters\b/i, kind: "rhino" },

  // Coast / beach — palm tree
  {
    match:
      /\bzanzibar\b|\bstone town\b|\bpemba\b|\bmafia\b|\bdiani\b|\blamu\b|\bmombasa\b|\bwatamu\b/i,
    kind: "palm",
  },

  // Other wildlife parks default to lion (most evocative safari glyph)
  { match: /\bruaha\b|\bkatavi\b|\bmahale\b|\bkruger\b|\bokavango\b|\bqueen elizabeth\b/i, kind: "lion" },
];

export function getGlyphForDestination(destination: string): GlyphDef {
  const name = (destination ?? "").trim();
  if (!name) return GLYPHS.tent;
  for (const m of MAPPINGS) {
    if (m.match.test(name)) return GLYPHS[m.kind];
  }
  return GLYPHS.tent;
}

export { GLYPHS };
