import type { Proposal, Section, Day, Property } from "./types";
import { COLOR_PRESETS } from "./theme";
import { nanoid } from "./nanoid";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSection(
  type: Section["type"],
  order: number,
  variant = "default",
  content: Record<string, unknown> = {}
): Section {
  return {
    id: nanoid(),
    type,
    visible: true,
    order,
    layoutVariant: variant,
    styleOverrides: {},
    content,
  };
}

// ─── Default days (Anderson Family Safari) ────────────────────────────────────

export const DEFAULT_DAYS: Day[] = [
  {
    id: nanoid(),
    dayNumber: 1,
    destination: "Nairobi",
    country: "Kenya",
    subtitle: "Arrival & Briefing",
    board: "Dinner only",
    description:
      "Your East African adventure begins in Nairobi. After a warm welcome at the airstrip, transfer directly into the Nairobi National Park corridor where The Emakoko sits on the edge of the park's gorge. Your afternoon briefing sets the tone: relaxed, expert and entirely focused on the family experience ahead. Sundowners on the deck with distant city lights is a disarmingly good start.",
    tiers: {
      classic: { camp: "The Emakoko", location: "Nairobi National Park", note: "Stunning gorge-edge setting · family rooms" },
      premier: { camp: "The Emakoko", location: "Nairobi National Park", note: "Stunning gorge-edge setting · family rooms" },
      signature: { camp: "Hemingways Nairobi", location: "Karen suburb", note: "Award-winning boutique hotel" },
    },
  },
  {
    id: nanoid(),
    dayNumber: 2,
    destination: "Masai Mara",
    country: "Kenya",
    subtitle: "Fly-in & First Game Drive",
    board: "Full board",
    description:
      "A scenic morning flight deposits you into the heart of the Masai Mara. The grass is long and gold in July, the air sharp and clean. Your guide meets you at the airstrip and the afternoon game drive begins almost immediately — expect lion sightings to feel inevitable rather than lucky. Governors' Camp sits right on the Mara River, and the sound of hippos through canvas is something the children will tell their friends about.",
    tiers: {
      classic: { camp: "Governors' Camp", location: "Mara River · Central Mara", note: "Classic canvas · riverside" },
      premier: { camp: "Little Governors' Camp", location: "Island camp · by boat", note: "Exclusive island setting" },
      signature: { camp: "Angama Mara", location: "Oloololo Escarpment", note: "Clifftop views · private villa available" },
    },
  },
  {
    id: nanoid(),
    dayNumber: 3,
    destination: "Masai Mara",
    country: "Kenya",
    subtitle: "Full Day — Great Migration Plains",
    board: "Full board",
    description:
      "A full day in the Mara — arguably the finest wildlife day available anywhere in Africa in July. The Wildebeest Migration is in full swing, stretching across the plains in columns that disappear into the horizon. Morning and afternoon game drives are bookended by an exceptional lunch back at camp. This is the day the family will reference as the highlight for years to come.",
    tiers: {
      classic: { camp: "Governors' Camp", location: "Mara River · Central Mara", note: "Classic canvas · riverside" },
      premier: { camp: "Little Governors' Camp", location: "Island camp · by boat", note: "Full-day private drive" },
      signature: { camp: "Angama Mara", location: "Oloololo Escarpment", note: "Private vehicle · fully flexible" },
    },
  },
  {
    id: nanoid(),
    dayNumber: 4,
    destination: "Amboseli",
    country: "Kenya",
    subtitle: "Fly to Amboseli — Elephant Plains",
    board: "Full board",
    description:
      "A short scenic flight connects the Mara to Amboseli, a completely different world. Where the Mara is drama and movement, Amboseli is stillness and scale. Kilimanjaro dominates the southern horizon, and the elephant herds here are the most relaxed and well-studied in Africa. Afternoon arrival gives time to settle in and take a first look at the mountain before dinner under the stars.",
    tiers: {
      classic: { camp: "Ol Tukai Lodge", location: "Central Amboseli", note: "Good value · family rooms" },
      premier: { camp: "Tortilis Camp", location: "Thorn-tree canopy", note: "Elegant family tents" },
      signature: { camp: "Amboseli Serena", location: "Lake-edge setting", note: "Expansive pool · premium guiding" },
    },
  },
  {
    id: nanoid(),
    dayNumber: 5,
    destination: "Amboseli",
    country: "Kenya",
    subtitle: "Kilimanjaro at Dawn · Maasai Village",
    board: "Full board",
    description:
      "The second Amboseli day brings depth. An early morning drive through the swamp edges when Kilimanjaro is sharp and pink in the dawn light is extraordinary. An optional Maasai village visit in the late morning adds a cultural layer that the older children especially will find fascinating. Afternoons are gentle: pool, wildlife talks, star beds.",
    tiers: {
      classic: { camp: "Ol Tukai Lodge", location: "Central Amboseli", note: "Good value · family rooms" },
      premier: { camp: "Tortilis Camp", location: "Thorn-tree canopy", note: "Elegant family tents" },
      signature: { camp: "Amboseli Serena", location: "Lake-edge setting", note: "Expansive pool · premium guiding" },
    },
  },
  {
    id: nanoid(),
    dayNumber: 6,
    destination: "Tsavo East",
    country: "Kenya",
    subtitle: "Red Elephants & The Galana River",
    board: "Full board",
    description:
      "Tsavo East is one of Kenya's oldest and largest parks, and the Aruba Dam acts as a permanent wildlife magnet. The red dust elephants are Tsavo's signature, and the family will be the only ones out there. A long afternoon drive following the Galana River is a quietly perfect way to end the last full safari day.",
    tiers: {
      classic: { camp: "Ashnil Aruba Lodge", location: "Aruba Dam edge", note: "Reliable game viewing" },
      premier: { camp: "Satao Camp", location: "Waterhole camp", note: "Classic Tsavo feel" },
      signature: { camp: "Finch Hattons", location: "Tsavo East · private", note: "Private plunge pools · exceptional cuisine" },
    },
  },
  {
    id: nanoid(),
    dayNumber: 7,
    destination: "Nairobi",
    country: "Kenya",
    subtitle: "Final Drive & Fly-out",
    board: "Breakfast only",
    description:
      "One final early morning drive — a last chance to let Africa settle into the memory. After a relaxed camp breakfast the family transfers to the Tsavo East airstrip for the scenic flight back to Nairobi's Wilson Airport, connecting to JKIA for international departures. Bags are light but memories are not.",
    tiers: {
      classic: { camp: "Charter flight", location: "Tsavo East → Wilson", note: "Scheduled group aircraft" },
      premier: { camp: "Charter flight", location: "Tsavo East → Wilson", note: "Scheduled group aircraft" },
      signature: { camp: "Private charter", location: "Tsavo East → JKIA", note: "Direct JKIA available on request" },
    },
  },
];

// ─── Default properties ───────────────────────────────────────────────────────

export const DEFAULT_PROPERTIES: Property[] = [
  {
    id: nanoid(),
    name: "Governors' Camp",
    location: "Masai Mara, Kenya",
    shortDesc: "A classic riverside camp with 37 years of Mara history",
    description:
      "Set on the banks of the Mara River in one of the most game-rich corners of the Masai Mara, Governors' Camp is a living institution. The tented suites are spacious and beautifully maintained, and the guiding team is among the most experienced in East Africa.",
    whyWeChoseThis:
      "The combination of location, guiding depth, and family-proven facilities makes Governors' Camp the natural anchor for the Mara portion of this trip.",
    amenities: ["Mara River frontage", "Family tents", "Swimming pool", "Expert guiding", "Full board"],
    mealPlan: "Full board",
    roomType: "Classic tented suite · connecting family option",
    nights: 2,
    tier: "Classic",
    galleryUrls: [],
  },
  {
    id: nanoid(),
    name: "Tortilis Camp",
    location: "Amboseli, Kenya",
    shortDesc: "Elegant tents beneath acacia trees with Kilimanjaro as backdrop",
    description:
      "Tortilis Camp sits within a private conservancy on the edge of Amboseli National Park, surrounded by fever trees and acacia woodland. The view of Kilimanjaro from the mess tent and the pool is one of the most photographed sights in East African safari travel.",
    whyWeChoseThis:
      "The family tent configuration, excellent naturalist guides, and unbeatable Kilimanjaro views make Tortilis the ideal Amboseli base for the Anderson family.",
    amenities: ["Kilimanjaro views", "Family tent", "Pool", "Naturalist guides", "Private conservancy"],
    mealPlan: "Full board",
    roomType: "Family tent · private verandah",
    nights: 2,
    tier: "Premier",
    galleryUrls: [],
  },
];

// ─── Default sections ─────────────────────────────────────────────────────────

function buildDefaultSections(): Section[] {
  return [
    makeSection("cover", 0, "cinematic-split", {
      heroImageUrl: "",
      tagline: "A family safari across Kenya's greatest parks",
    }),
    makeSection("greeting", 1, "editorial-letter", {
      body: "Dear Anderson Family,\n\nIt is a genuine pleasure to put this proposal together for you. Seven days across the Masai Mara, Amboseli and Tsavo East will give each member of your family a completely different face of Kenya — from the drama of the Great Migration to the silence of elephant plains under Kilimanjaro.",
    }),
    makeSection("tripSummary", 2, "default"),
    makeSection("itineraryTable", 3, "default"),
    makeSection("dayJourney", 4, "split-text-image"),
    makeSection("propertyShowcase", 5, "image-left-details-right"),
    makeSection("pricing", 6, "default"),
    makeSection("inclusions", 7, "default"),
    makeSection("practicalInfo", 8, "card-grid"),
    makeSection("closing", 9, "quote-led", {
      quote: "Africa changes you. The question is not whether you will come back — it's when.",
      signOff: "With warm regards and great excitement for your journey,",
    }),
    makeSection("footer", 10, "default"),
  ];
}

// ─── Default proposal ─────────────────────────────────────────────────────────

export function buildDefaultProposal(): Proposal {
  return {
    id: nanoid(),
    metadata: {
      title: "Anderson Family Safari",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: "draft",
    },
    operator: {
      companyName: "Safari Studio",
      consultantName: "Amina Oduya",
      email: "amina@safaristudio.co",
      phone: "+254 700 000 000",
      whatsapp: "+254 700 000 000",
      website: "safaristudio.co",
      brandColors: { primary: "#1b3a2d", secondary: "#c9a84c" },
    },
    client: {
      guestNames: "The Anderson Family",
      email: "anderson.family@outlook.com",
      pax: "2 adults · 3 children (ages 8, 11, 14)",
      rooming: "1 family tent + 1 double tent",
    },
    trip: {
      title: "Anderson Family Safari",
      subtitle: "7 Days · Kenya · July 2025",
      dates: "5 – 12 July 2025",
      nights: 7,
      tripStyle: "Family safari",
      destinations: ["Nairobi", "Masai Mara", "Amboseli", "Tsavo East"],
    },
    theme: {
      tokens: { ...COLOR_PRESETS.forest },
      displayFont: "Playfair Display",
      bodyFont: "Jost",
      preset: "forest",
    },
    activeTier: "premier",
    visibleTiers: { classic: true, premier: true, signature: false },
    sections: buildDefaultSections(),
    days: DEFAULT_DAYS,
    properties: DEFAULT_PROPERTIES,
    pricing: {
      classic: { pricePerPerson: "4,850", currency: "USD", label: "Classic", highlighted: false },
      premier: { pricePerPerson: "7,200", currency: "USD", label: "Premier", highlighted: true },
      signature: { pricePerPerson: "11,400", currency: "USD", label: "Signature", highlighted: false },
      notes: "Prices are per person sharing, based on the 7-night programme above.",
    },
    inclusions: [
      "All game drives",
      "Full board accommodation (as specified)",
      "National park & conservancy fees",
      "All airstrip transfers and scheduled flights",
      "Flying Doctors emergency cover",
      "Pre-departure trip consultation",
    ],
    exclusions: [
      "International flights",
      "Kenya visa fees",
      "Travel insurance",
      "Personal spending & gratuities",
      "Premium beverages",
    ],
    practicalInfo: [
      {
        id: nanoid(),
        title: "Visas",
        body: "Kenya operates an eTA (electronic Travel Authorisation) system. Apply online at etakenya.go.ke at least 72 hours before departure. Cost is USD 30 per person.",
        icon: "✈",
      },
      {
        id: nanoid(),
        title: "Health",
        body: "Malaria prophylaxis is recommended. Yellow fever vaccination is required if arriving from an endemic country. Consult your GP or travel clinic 6–8 weeks before departure.",
        icon: "⚕",
      },
      {
        id: nanoid(),
        title: "Climate",
        body: "July is one of Kenya's coolest and driest months — ideal for game viewing. Expect warm days (24–28°C) and cool evenings (12–16°C). Pack layers for early morning drives.",
        icon: "☀",
      },
      {
        id: nanoid(),
        title: "What to pack",
        body: "Neutral earth tones (khaki, olive, sand). No white or bright colours on game drives. Comfortable walking shoes, sun hat, quality sunscreen, and a light fleece or jacket.",
        icon: "🎒",
      },
    ],
  };
}

// ─── Blank proposal ───────────────────────────────────────────────────────────

export function buildBlankProposal(): Proposal {
  return {
    id: nanoid(),
    metadata: {
      title: "New Proposal",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: "draft",
    },
    operator: {
      companyName: "",
      consultantName: "",
      email: "",
      phone: "",
      brandColors: { primary: "#1b3a2d", secondary: "#c9a84c" },
    },
    client: { guestNames: "", pax: "" },
    trip: { title: "New Proposal", subtitle: "", dates: "", nights: 0, destinations: [] },
    theme: {
      tokens: { ...COLOR_PRESETS.forest },
      displayFont: "Playfair Display",
      bodyFont: "Jost",
      preset: "forest",
    },
    activeTier: "premier",
    visibleTiers: { classic: true, premier: true, signature: false },
    sections: buildDefaultSections().map((s) => ({ ...s, content: {} })),
    days: [],
    properties: [],
    pricing: {
      classic: { pricePerPerson: "", currency: "USD", label: "Classic", highlighted: false },
      premier: { pricePerPerson: "", currency: "USD", label: "Premier", highlighted: true },
      signature: { pricePerPerson: "", currency: "USD", label: "Signature", highlighted: false },
    },
    inclusions: [],
    exclusions: [],
    practicalInfo: [],
  };
}

// ─── Templates ────────────────────────────────────────────────────────────────

export const TEMPLATES: { id: string; name: string; description: string; emoji: string }[] = [
  {
    id: "family-safari",
    name: "Family Safari",
    description: "7-day Kenya circuit: Masai Mara, Amboseli, Tsavo East. Pre-filled with camps, narratives, and pricing.",
    emoji: "🦁",
  },
  {
    id: "honeymoon",
    name: "Honeymoon",
    description: "Romantic 8-day Tanzania: Serengeti, Ngorongoro, Zanzibar. Intimate camps and private experiences.",
    emoji: "🌅",
  },
  {
    id: "migration",
    name: "Migration",
    description: "Peak migration 6-day Mara itinerary, July–October. River crossing focused, premium camps.",
    emoji: "🦓",
  },
  {
    id: "beach-bush",
    name: "Beach & Bush",
    description: "5-day Masai Mara + 4 nights Diani Beach. The classic Kenya combination.",
    emoji: "🐘",
  },
];
