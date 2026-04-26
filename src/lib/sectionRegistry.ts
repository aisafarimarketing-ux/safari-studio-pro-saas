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
    variants: ["branded-letter", "minimal"],
    defaultVariant: "branded-letter",
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
    variants: ["horizontal-rows", "default", "compact"],
    defaultVariant: "horizontal-rows",
    defaultContent: {},
    dataSource: "days",
  },
  dayJourney: {
    type: "dayJourney",
    label: "Day-by-Day Journey",
    icon: "✦",
    description: "Editorial stack — one layout per day, full width",
    variants: ["editorial-stack"],
    defaultVariant: "editorial-stack",
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
    description: "Elegant sign-off from the consultant",
    variants: ["closing-farewell", "quote-led", "letter-style", "centered-minimal", "cta-card"],
    defaultVariant: "closing-farewell",
    defaultContent: {
      quote: "Africa changes you.",
      signOff: "With warm regards,",
    },
  },
  footer: {
    type: "footer",
    label: "Footer",
    icon: "—",
    description: "Consultant contact details and branding",
    variants: ["default", "minimal"],
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
    label: "Divider",
    icon: "─",
    description: "Horizontal rule",
    variants: ["line", "ornamental", "spacious"],
    defaultVariant: "line",
    defaultContent: {},
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
    variants: ["route", "interactive", "default", "full-width"],
    defaultVariant: "route",
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
