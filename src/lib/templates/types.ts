import type { TierKey } from "@/lib/types";

// ─── Template types ─────────────────────────────────────────────────────────
//
// A Template is a pre-built itinerary shape — a canonical 7-day Kenya
// Classic, a 10-day Migration Chase, etc. Each template produces a full
// Proposal via buildProposalFromTemplate. Operators clone a template to
// get a populated proposal in their workspace which they then edit freely
// (add/remove days, swap destinations, replace camps, retune prose) with
// the existing editor. Templates are starting shapes; the flexibility
// comes from the editor.

export type TemplateTierPick = {
  /**
   * Library reference *by name*. When the name matches a STARTER_LIBRARY
   * entry the builder pulls images + amenities so the public template
   * page looks fully dressed. When no match, the camp renders as free
   * text (operator sees it post-clone and can swap with their own lodge).
   *
   * Referencing by name keeps the templates resilient to library
   * reorders — the slot indices in STARTER_LIBRARY are not contractual.
   */
  libraryName: string;
  note?: string;
};

export type TemplateDay = {
  dayNumber: number;
  destination: string;
  country: string;
  subtitle?: string;
  description: string;
  board: string;
  highlights?: string[];
  tiers: Record<TierKey, TemplateTierPick>;
};

export type TemplateExampleClient = {
  // "Example" stand-in data shown on the public /templates/[slug] page.
  // Cleared to empty on clone so the operator doesn't see "Sarah & James"
  // in their freshly-copied proposal.
  guestNames: string;
  adults: number;
  children?: number;
  origin?: string;
  specialOccasion?: string;
};

export type Template = {
  slug: string;                // URL segment — "7-day-kenya-classic"
  title: string;               // "7-Day Kenya Classic — Amboseli & Maasai Mara"
  summary: string;             // Card hero sentence
  metaDescription: string;     // SEO <meta description>

  countries: string[];         // ["Kenya"] or ["Kenya", "Tanzania"]
  nights: number;              // 7
  style: "Classic" | "Mid-range" | "Luxury";

  // Shown on the gallery card — "from $4,500 / pp". Free-text so the
  // template author controls the exact rendering (e.g. "from $3,800").
  priceFromPerPerson?: string;

  days: TemplateDay[];

  cover: { tagline: string };
  greeting: { body: string };
  closing: { quote: string; signOff: string };
  map: { caption: string };

  pricing: {
    classic:   { pricePerPerson: string; currency?: string };
    premier:   { pricePerPerson: string; currency?: string };
    signature: { pricePerPerson: string; currency?: string };
    highlighted: TierKey;
    notes?: string;
  };

  inclusions: string[];
  exclusions: string[];
  practicalInfo: { title: string; body: string; icon: string }[];

  exampleClient: TemplateExampleClient;
};
