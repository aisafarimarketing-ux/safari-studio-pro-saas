import type { SectionType } from "./types";

export interface SectionDefinition {
  type: SectionType;
  label: string;
  icon: string;
  description: string;
  variants: string[];
  defaultVariant: string;
  defaultContent: Record<string, unknown>;
  /** Sections that source data from proposal-level arrays, not section.content */
  dataSource?: "days" | "properties" | "pricing" | "inclusions" | "practicalInfo";
}

export const SECTION_REGISTRY: Record<SectionType, SectionDefinition> = {
  operatorHeader: {
    type: "operatorHeader",
    label: "Operator Header",
    icon: "▣",
    description: "Branded letterhead with logo, company name, and contact details",
    variants: ["minimal", "centered-brand", "split-logo-details", "transparent-overlay"],
    defaultVariant: "minimal",
    defaultContent: {},
  },
  cover: {
    type: "cover",
    label: "Cover",
    icon: "◻",
    description: "Hero cover with image + text. Right-click an image to replace it.",
    variants: [
      "hero-letter",
      "split-50-50-right",
      "split-50-50-left",
      "split-60-40-right",
      "split-60-40-left",
      "split-40-60-right",
      "split-40-60-left",
      "editorial-magazine",
      "cinematic-split",
      "flip-split",
      "centered-editorial",
      "minimal-type",
      "full-bleed-overlay",
    ],
    defaultVariant: "hero-letter",
    defaultContent: { heroImageUrl: "", tagline: "", greetingBody: "" },
  },
  personalNote: {
    type: "personalNote",
    label: "Personal Note",
    icon: "✍",
    description: "Branded letter from the consultant — greeting body, signature, photo, company logo and contact.",
    variants: ["editorial-letter-image", "branded-letter", "minimal"],
    defaultVariant: "editorial-letter-image",
    defaultContent: {
      body: "Thank you very much for your interest in doing a safari with us.\n\nPlease review the day-by-day itinerary and let me know your thoughts and feedback. I would be delighted to tailor the trip further to accommodate your personal preferences.",
      signOffLead: "Thanks again and I remain at your full disposal!",
      signOff: "Best regards,",
    },
  },
  greeting: {
    type: "greeting",
    label: "Greeting (legacy)",
    icon: "✉",
    description: "Legacy greeting block — superseded by Personal Note. Kept so old proposals still render.",
    variants: ["editorial-letter", "two-column-consultant", "centered-minimal", "sidebar-accent"],
    defaultVariant: "editorial-letter",
    defaultContent: { body: "Dear Guest,\n\nIt is a genuine pleasure to put this proposal together for you." },
  },
  tripSummary: {
    type: "tripSummary",
    label: "Trip Summary",
    icon: "◈",
    description: "Quick-read stats: destinations, duration, pax, budget",
    variants: ["default", "wide-grid"],
    defaultVariant: "default",
    defaultContent: {},
  },
  itineraryTable: {
    type: "itineraryTable",
    label: "Itinerary at a Glance",
    icon: "☰",
    description: "Auto-generated table from day data",
    // editorial-timeline is the new vertical journey rail (matches the
    // luxury-magazine reference); compact retained for legacy proposals
    // but new sections default to horizontal-rows.
    variants: ["horizontal-rows", "editorial-timeline", "default", "compact"],
    defaultVariant: "horizontal-rows",
    defaultContent: {},
    dataSource: "days",
  },
  dayJourney: {
    type: "dayJourney",
    label: "Day-by-Day Journey",
    icon: "✦",
    description: "Magazine spread — image and narrative side by side, never overlapping",
    // Operator brief: "all the other day card layouts to follow RF
    // neat and no writing on the images." Only side-by-side flip
    // variants are offered now — every day reads as image | text or
    // text | image, never with text overlaying the photo.
    //   right-flip — image on the right of every day (RF)
    //   left-flip  — image on the left of every day
    //   trip-flip  — alternates side per day for magazine rhythm
    // editorial-stack (image-on-top + text-below) was removed because
    // it produced visual collisions on phones; legacy proposals that
    // still carry the variant string render through DayCard.tsx's
    // fallback and look the same as right-flip.
    variants: ["right-flip", "left-flip", "trip-flip"],
    defaultVariant: "trip-flip",
    defaultContent: {},
    dataSource: "days",
  },
  propertyShowcase: {
    type: "propertyShowcase",
    label: "Property Showcase",
    icon: "⌂",
    description: "Camp and lodge detail cards",
    variants: ["editorial-carousel"],
    defaultVariant: "editorial-carousel",
    defaultContent: {},
    dataSource: "properties",
  },
  pricing: {
    type: "pricing",
    label: "Pricing",
    icon: "$",
    description: "Investment overview with 3-tier pricing",
    variants: ["editorial"],
    defaultVariant: "editorial",
    defaultContent: {},
    dataSource: "pricing",
  },
  inclusions: {
    type: "inclusions",
    label: "Inclusions & Exclusions",
    icon: "✓",
    description: "What's included and what's not",
    variants: ["inline-ribbon", "split-columns", "stacked-clean", "two-tone-bands", "default"],
    defaultVariant: "inline-ribbon",
    defaultContent: {},
    dataSource: "inclusions",
  },
  practicalInfo: {
    type: "practicalInfo",
    label: "Practical Information",
    icon: "ℹ",
    description: "Visas, health, packing, and travel tips",
    variants: ["two-column-notes", "card-grid", "icon-list", "accordion-style"],
    defaultVariant: "two-column-notes",
    defaultContent: {},
    dataSource: "practicalInfo",
  },
  closing: {
    type: "closing",
    label: "Closing",
    icon: "◐",
    description: "Single trip-theme photo · letter · Secure-This-Safari CTA · share / download / changes / website",
    // editorial-close is the default — one trip-theme photo + the
    // close, no image rail. safari-ready follows the closing
    // message with a kraft "SAFARI READY" folder card carrying the
    // trip meta + Secure CTA, like a paper dossier confirming the
    // booking. The three older variants (split-card / gallery-row /
    // stack) stay registered so legacy proposals keep their look.
    variants: ["editorial-close", "safari-ready", "split-card", "gallery-row", "stack"],
    defaultVariant: "safari-ready",
    defaultContent: {
      headline: "Your journey is ready",
      letter:
        "Now please review every section and let me know what needs adjusting — lodge choices, pace, optional activities, anything. I'll hold these camp dates for seven days while you confirm. Once you're ready, we'll move to booking and I'll send the detailed pre-trip briefing and packing list.",
      availability:
        "Availability at selected camps is limited and subject to confirmation.",
      ctaLabel: "Secure This Safari",
      // Legacy fields kept so old saved proposals don't lose data:
      quote: "Africa changes you.",
      signOff:
        "We've secured the camps, mapped every route, and prepared everything for your journey.",
      urgency: "",
      ctaSubtext: "",
      proofTitle: "",
      proofBody: "",
    },
  },
  footer: {
    type: "footer",
    label: "Footer",
    icon: "—",
    description: "Consultant identity + contact pills + website link",
    // Single-layout footer per operator request — the variant switcher
    // is hidden by SectionChrome when only one variant is registered.
    // Legacy proposals on "contact-cards" / "minimal" / "default" all
    // fall through to the unified layout in FooterSection (no migration
    // needed; the dispatcher there ignores the saved variant string).
    variants: ["default"],
    defaultVariant: "default",
    defaultContent: {},
  },
  customText: {
    type: "customText",
    label: "Custom Text",
    icon: "T",
    description: "Free-form text block",
    variants: ["default", "centered", "full-width"],
    defaultVariant: "default",
    defaultContent: { heading: "", body: "" },
  },
  quote: {
    type: "quote",
    label: "Pull Quote",
    icon: "❝",
    description: "Large pull quote with attribution",
    variants: ["default", "centered"],
    defaultVariant: "centered",
    defaultContent: { quote: "", attribution: "" },
  },
  gallery: {
    type: "gallery",
    label: "Gallery",
    icon: "⊞",
    description: "Image grid layout",
    variants: ["editorial-mosaic", "2-column", "3-column", "4-column"],
    defaultVariant: "editorial-mosaic",
    defaultContent: { images: [] },
  },
  divider: {
    type: "divider",
    label: "Section divider",
    icon: "▬",
    description: "Coloured separator band between sections — recolour by clicking it",
    // Single variant exposed to operators: the thick coloured band
    // (~52px). The legacy variants (line / ornamental / spacious)
    // rendered as 1px hairlines and operators would flip into them
    // by accident via the variant switcher, then read the result as
    // "the divider disappeared". They're still rendered by
    // DividerSection for back-compat with old saved proposals; they
    // just aren't selectable from the chrome any more.
    variants: ["band"],
    defaultVariant: "band",
    defaultContent: { color: "#5e4f33" },
  },
  spacer: {
    type: "spacer",
    label: "Spacer",
    icon: "↕",
    description: "Vertical whitespace",
    variants: ["sm", "md", "lg", "xl"],
    defaultVariant: "md",
    defaultContent: {},
  },
  map: {
    type: "map",
    label: "Map",
    icon: "◎",
    description: "Interactive route map with pins for each day",
    // Legacy variants (route / default / full-width) consolidated into
    // `interactive` — it's the only one with the modern logic
    // (real park polygons, bowed routes, spotlight mask, full coast
    // reach). Existing proposals that still carry the legacy variant
    // names render through the same component since MapSection
    // unconditionally delegates to InteractiveMap.
    variants: ["interactive"],
    defaultVariant: "interactive",
    defaultContent: { caption: "", coords: [] },
  },
};

export const ADDABLE_SECTIONS: SectionType[] = [
  "operatorHeader",
  "cover",
  "personalNote",
  // greeting deprecated — replaced by personalNote. Kept in the registry
  // so legacy proposals still render, not offered for new insertion.
  // tripSummary deprecated — its "At a glance" content is now rendered at
  // the top of itineraryTable. Kept in the registry so old proposals that
  // still have a tripSummary section don't crash, just not offered for
  // new insertion.
  "itineraryTable",
  "dayJourney",
  "propertyShowcase",
  "pricing",
  // inclusions deprecated — moved inside the pricing section's editorial
  // variant. Kept in the registry so legacy renders still work, removed
  // from addable.
  "practicalInfo",
  "closing",
  // Footer carries the consultant contact details on the last page. The
  // closing block stays focused on the moment of conversion — Confirm
  // Booking + Download + Share — so contact rows live exclusively here.
  "footer",
  "customText",
  "quote",
  "gallery",
  "divider",
  "spacer",
  "map",
];
