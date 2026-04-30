// ─── Sample destination image bank ──────────────────────────────────────
//
// Curated catalogue of CC0 photos for common East African destinations,
// used as a fallback when an operator hasn't tagged their Brand DNA
// library by location yet. The Trip Setup flow offers this as a
// one-click "use sample" option per stop so a new operator can ship
// their first proposal end-to-end without first uploading their own
// image library.
//
// URLs are stable Unsplash CDN links with the `?w=2000` size hint —
// Unsplash CDN serves arbitrary widths from the same canonical id so
// these don't 404 if Unsplash adjusts their delivery pipeline. The
// photographer attribution is preserved alongside in `credit` so we
// can surface a small "photo: <name>" caption inside the editor when
// a sample image is in use (signals to the operator they should
// upgrade to their own).
//
// Lookup mirrors pickBrandImageForDestination's contract: case-
// insensitive, substring-tolerant. Operator types "Tarangire NP" or
// "tarangire national park" or just "Tarangire" — all hit the same
// entry. Returns null when no entry matches; caller treats null as
// "operator gets to pick or skip".
//
// Adding new destinations: keep the catalogue alphabetical by
// destination name within each region for easy diffs. Always include
// a credit line. Prefer landscape-orientation shots (3:2 or 16:9)
// since day cards render hero images as wide bands.

export interface SampleImage {
  url: string;
  credit: string;
  /** Lowercase substrings that match this entry. The lookup tests
   *  whether the operator's destination string contains any of these
   *  (case-insensitive). Order doesn't matter; first matching entry
   *  in CATALOGUE wins. */
  matches: string[];
}

const CATALOGUE: SampleImage[] = [
  // ── Tanzania — gateways ──────────────────────────────────────────────
  {
    url: "https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=2000",
    credit: "Hu Chen / Unsplash",
    matches: ["arusha", "kilimanjaro", "moshi"],
  },
  {
    url: "https://images.unsplash.com/photo-1589182337358-2cb63099350c?w=2000",
    credit: "Hu Chen / Unsplash",
    matches: ["zanzibar", "stone town", "nungwi", "kendwa", "paje", "matemwe", "kiwengwa", "jambiani", "pemba"],
  },
  {
    url: "https://images.unsplash.com/photo-1571406761910-e15bf5a6efba?w=2000",
    credit: "Sergey Pesterev / Unsplash",
    matches: ["dar es salaam", "dar"],
  },
  // ── Tanzania — parks ────────────────────────────────────────────────
  {
    url: "https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=2000",
    credit: "Sergey Pesterev / Unsplash",
    matches: ["serengeti"],
  },
  {
    url: "https://images.unsplash.com/photo-1535941339077-2dd1c7963098?w=2000",
    credit: "Hu Chen / Unsplash",
    matches: ["ngorongoro", "crater"],
  },
  {
    url: "https://images.unsplash.com/photo-1551522435-b4cd0c5cdcaf?w=2000",
    credit: "Hu Chen / Unsplash",
    matches: ["tarangire"],
  },
  {
    url: "https://images.unsplash.com/photo-1568126396076-e83de1c2bcfc?w=2000",
    credit: "Antony Trivet / Unsplash",
    matches: ["lake manyara", "manyara"],
  },
  {
    url: "https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=2000",
    credit: "Sergey Pesterev / Unsplash",
    matches: ["ruaha", "selous", "nyerere"],
  },
  {
    url: "https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=2000",
    credit: "Hu Chen / Unsplash",
    matches: ["lake eyasi", "eyasi"],
  },

  // ── Kenya — gateways ────────────────────────────────────────────────
  {
    url: "https://images.unsplash.com/photo-1611348586804-61bf6c080437?w=2000",
    credit: "Amani Nation / Unsplash",
    matches: ["nairobi"],
  },
  {
    url: "https://images.unsplash.com/photo-1593552415137-7eafb3a7c8b1?w=2000",
    credit: "Sergey Pesterev / Unsplash",
    matches: ["mombasa", "diani", "watamu", "malindi", "lamu"],
  },
  // ── Kenya — parks ───────────────────────────────────────────────────
  {
    url: "https://images.unsplash.com/photo-1547235001-d703406d3f17?w=2000",
    credit: "Sergey Pesterev / Unsplash",
    matches: ["maasai mara", "masai mara", "mara"],
  },
  {
    url: "https://images.unsplash.com/photo-1568667256549-094345857637?w=2000",
    credit: "Sergey Pesterev / Unsplash",
    matches: ["amboseli"],
  },
  {
    url: "https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=2000",
    credit: "Sergey Pesterev / Unsplash",
    matches: ["samburu", "buffalo springs", "shaba"],
  },
  {
    url: "https://images.unsplash.com/photo-1535941339077-2dd1c7963098?w=2000",
    credit: "Hu Chen / Unsplash",
    matches: ["laikipia", "ol pejeta", "lewa", "solio"],
  },
  {
    url: "https://images.unsplash.com/photo-1568126396076-e83de1c2bcfc?w=2000",
    credit: "Antony Trivet / Unsplash",
    matches: ["lake nakuru", "nakuru", "lake naivasha", "naivasha", "lake bogoria"],
  },
  {
    url: "https://images.unsplash.com/photo-1551522435-b4cd0c5cdcaf?w=2000",
    credit: "Hu Chen / Unsplash",
    matches: ["meru", "tsavo east", "tsavo west", "tsavo"],
  },
  {
    url: "https://images.unsplash.com/photo-1535941339077-2dd1c7963098?w=2000",
    credit: "Hu Chen / Unsplash",
    matches: ["mount kenya", "mt kenya"],
  },

  // ── Uganda ─────────────────────────────────────────────────────────
  {
    url: "https://images.unsplash.com/photo-1605338803155-8b9e3a7c0e2e?w=2000",
    credit: "Random Institute / Unsplash",
    matches: ["bwindi"],
  },
  {
    url: "https://images.unsplash.com/photo-1547235001-d703406d3f17?w=2000",
    credit: "Sergey Pesterev / Unsplash",
    matches: ["murchison falls", "murchison"],
  },
  {
    url: "https://images.unsplash.com/photo-1611348586804-61bf6c080437?w=2000",
    credit: "Amani Nation / Unsplash",
    matches: ["entebbe", "kampala"],
  },
  {
    url: "https://images.unsplash.com/photo-1568126396076-e83de1c2bcfc?w=2000",
    credit: "Antony Trivet / Unsplash",
    matches: ["queen elizabeth", "kibale", "kidepo"],
  },

  // ── Rwanda ─────────────────────────────────────────────────────────
  {
    url: "https://images.unsplash.com/photo-1605338803155-8b9e3a7c0e2e?w=2000",
    credit: "Random Institute / Unsplash",
    matches: ["volcanoes", "kinigi", "musanze", "ruhengeri"],
  },
  {
    url: "https://images.unsplash.com/photo-1611348586804-61bf6c080437?w=2000",
    credit: "Amani Nation / Unsplash",
    matches: ["kigali"],
  },

  // ── Last-resort generic East-African savanna shot ─────────────────
  // Used when the operator's destination doesn't match any entry above
  // — better than an empty grey placeholder. Caller decides whether
  // to fall through to this.
  {
    url: "https://images.unsplash.com/photo-1523805009345-7448845a9e53?w=2000",
    credit: "Hu Chen / Unsplash",
    matches: ["__fallback__"],
  },
];

/** Look up a sample image for the given destination string. Case-
 *  insensitive substring match against each entry's `matches[]`.
 *  Returns null when nothing matches AND fallback is false. With
 *  fallback=true (the default), the last entry — a generic East-
 *  African savanna shot — is returned as a final-resort match. */
export function pickSampleImageForDestination(
  destination: string,
  options: { fallback?: boolean } = {},
): SampleImage | null {
  const fallback = options.fallback ?? true;
  const needle = destination.trim().toLowerCase();
  if (!needle) return fallback ? CATALOGUE[CATALOGUE.length - 1] : null;
  for (const entry of CATALOGUE) {
    for (const m of entry.matches) {
      if (m === "__fallback__") continue;
      if (needle.includes(m)) return entry;
    }
  }
  return fallback ? CATALOGUE[CATALOGUE.length - 1] : null;
}

/** Returns true if the given URL is one of the URLs in this
 *  catalogue. Used by the editor to render a small "photo: sample"
 *  badge so operators can see at a glance which days are still on
 *  sample imagery vs their own library. */
export function isSampleImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return CATALOGUE.some((c) => c.url === url);
}
