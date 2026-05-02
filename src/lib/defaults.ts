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
  // Section order, top-to-bottom (new proposals only — existing
  // saved proposals keep their stored order verbatim):
  //   0  Cover (hero image + trip title)
  //   1  Personal Note (consultant letter — no divider above so the
  //                     intro reads as one Cover→Note block)
  //   2  Divider
  //   3  Map (header reads "Itinerary at a glance" — operators add a
  //          standalone itineraryTable section if they want the table
  //          view as well, but it's not on by default to avoid
  //          duplicating the title)
  //   4  Divider
  //   5  Day-by-day journey
  //   6  Divider
  //   7  Property showcase
  //   8  Divider
  //   9  Pricing (carries inclusions / exclusions / T&Cs inline)
  //  10  Divider
  //  11  Practical info
  //  12  Divider
  //  13  Closing
  //  14  Divider
  //  15  Footer
  return [
    // Cover — split-60-40-left: 60% image on the left, 40% text panel on
    // the right. Operator-default per request — replaces the older
    // hero-letter for new proposals. Existing proposals keep whatever
    // they were saved with; only fresh autopilot / blank / template
    // builds pick this up.
    makeSection("cover", 0, "split-60-40-left", {
      heroImageUrl: "",
      coverLabel: "Proposal for the Anderson Family",
      tourLengthLabel: "Tour Length",
      tourLengthValue: "7 Days / 6 Nights",
      travelersLabel: "Travelers",
      travelersValue: "2 adults · 3 children",
      greetingOpener: "Good day Anderson Family,",
      greetingBody:
        "Thank you very much for your interest in doing a safari with us.\n\nI am thrilled to offer you a personalised quote for this family trip across Kenya's greatest parks — Masai Mara, Amboseli and Tsavo East. Please review the day-by-day itinerary and let me know your thoughts and feedback.\n\nYour feedback is highly valued, and I would be delighted to tailor the itinerary further to accommodate your preferences.",
      signOffLead: "Thanks again and I remain at your full disposal!",
      signOff: "Best regards,",
    }),
    makeSection("personalNote", 1, "branded-letter", {
      opener: "Good day Anderson Family,",
      body:
        "Thank you very much for your interest in doing a safari with us.\n\nI am thrilled to offer you a personalised quote for this family trip across Kenya's greatest parks — Masai Mara, Amboseli and Tsavo East. Please review the day-by-day itinerary and let me know your thoughts and feedback.\n\nYour feedback is highly valued, and I would be delighted to tailor the itinerary further to accommodate your preferences.",
      signOffLead: "Thanks again and I remain at your full disposal!",
      signOff: "Best regards,",
    }),
    // Divider — first one of the proposal, sits between the
    // Cover→Personal Note intro block and the Map. All dividers in
    // the default flow seed with the same gold colour; operators
    // recolour each independently.
    makeSection("divider", 2, "band", { color: "#5e4f33" }),
    // No itineraryTable by default — the map's header already reads
    // "Itinerary at a glance" so a standalone table duplicates the
    // title. Operators who want the tabular view can still add it
    // from the section panel.
    makeSection("map", 3, "route", { coords: [] }),
    makeSection("divider", 4, "band", { color: "#5e4f33" }),
    // Day-by-day — trip-flip alternates image side per day so the
    // proposal reads as a magazine spread by default. Operator brief:
    // "Day cards by default to have alternating photo and text — if
    // day card photo is in left, the accommodation by default be
    // right." (See FlipCard for the per-card location/property
    // alternation that lives ON TOP of trip-flip.)
    makeSection("dayJourney", 5, "trip-flip"),
    makeSection("divider", 6, "band", { color: "#5e4f33" }),
    makeSection("propertyShowcase", 7, "editorial-carousel"),
    makeSection("divider", 8, "band", { color: "#5e4f33" }),
    // Pricing now carries inclusions/exclusions + payment schedule,
    // cancellation, insurance, and T&Cs. No standalone inclusions section
    // in the default flow — still available in the registry for legacy.
    makeSection("pricing", 9, "editorial"),
    makeSection("divider", 10, "band", { color: "#5e4f33" }),
    makeSection("practicalInfo", 11, "two-column-notes"),
    makeSection("divider", 12, "band", { color: "#5e4f33" }),
    // Closing — stack: vertical layout (image rail on top, letter +
    // CTA below). Operator-default per request. Other variants
    // (split-card, gallery-row) remain available as per-section
    // overrides via SectionChrome.
    makeSection("closing", 13, "stack", {
      quote: "Take only memories, leave only footprints.",
      attribution: "— Chief Seattle",
      signOff:
        "It has been a genuine pleasure putting this together for you. If you'd like anything adjusted — a camp, a date, a tier — just leave a note below or reply directly. I'll hold these arrangements for seven days while you decide.",
    }),
    makeSection("divider", 14, "band", { color: "#5e4f33" }),
    makeSection("footer", 15, "default"),
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

// ─── Demo proposal — onboarding ────────────────────────────────────────────
//
// Wraps buildDefaultProposal so onboarding always lands on a fully-populated,
// realistic 7-day Kenya itinerary. We retitle to "Best of Kenya" so it reads
// as a sample and not an actual client proposal. The defaults already hit
// every section the editor renders (days, properties, pricing, inclusions,
// practical info), so first-time users see the product at full fidelity in
// one click.

export function buildDemoProposal(): Proposal {
  const base = buildDefaultProposal();
  base.metadata.title = "Best of Kenya — sample";
  base.trip.title = "Best of Kenya";
  base.trip.subtitle = "7 days · Kenya · sample itinerary";
  base.client.guestNames = "Sample client";
  return base;
}

// ─── Migration — bring loaded proposals up to the current section shape ──
//
// Proposals saved before a section type was introduced won't have it in
// their sections[] array. Rather than force a manual "add section" dance
// for every user, we inject missing critical sections on load with the
// same defaults the builder above uses, placed at a sensible order.
//
// Also normalises legacy dayJourney variant strings to the new names so
// the next save cleans the data (the renderer has an alias fallback, but
// persisting the new names avoids that dance forever).

const LEGACY_PROPERTY_SHOWCASE_VARIANTS: Record<string, string> = {
  "field-notes": "editorial-carousel",
  "editorial": "editorial-carousel",
  "image-left-details-right": "editorial-carousel",
  "large-image-detail-block": "editorial-carousel",
  "hero-thumbnails": "editorial-carousel",
  "card-grid": "editorial-carousel",
  "full-bleed": "editorial-carousel",
};

const LEGACY_DAY_VARIANTS: Record<string, string> = {
  // Everything prior generations stored resolves to the same layout now.
  "auto": "editorial-stack",
  "chapter-magazine": "editorial-stack",
  "chapter-destination": "editorial-stack",
  "split-editorial": "editorial-stack",
  "cinematic-hero": "editorial-stack",
  "stacked-story": "editorial-stack",
  "property-led": "editorial-stack",
  "collage-hybrid": "editorial-stack",
  "twin-frame": "editorial-stack",
  "hero-thumbs": "editorial-stack",
  "hero-inset": "editorial-stack",
  "hero-pair": "editorial-stack",
  "split-50-50-left": "editorial-stack",
  "split-50-50-right": "editorial-stack",
  "split-60-40-left": "editorial-stack",
  "split-40-60-left": "editorial-stack",
};

export function migrateLoadedProposal(proposal: Proposal): Proposal {
  let sections = [...proposal.sections];
  let changed = false;

  // ── 0. Drop deprecated standalone summary sections.
  //
  //    tripSummary used to render its stats at the top of an
  //    itineraryTable; itineraryTable has since been removed from the
  //    default flow because the map's header already reads "Itinerary
  //    at a glance" and a standalone table duplicates the title.
  //    Both are still in the section registry (so legacy proposals
  //    don't crash) and operators can re-add either via the + icon.
  //
  //    Migration drops both tripSummary and itineraryTable so existing
  //    proposals match the new default the moment they're opened. The
  //    operator's data is never lost — these sections only carried
  //    auto-derived stats (no per-section copy to preserve).
  const beforeCleanup = sections.length;
  sections = sections.filter(
    (s) => s.type !== "tripSummary" && s.type !== "itineraryTable",
  );
  if (sections.length !== beforeCleanup) changed = true;

  // ── 0a. Add a standalone Footer section after Closing if one isn't
  //    already present. Earlier versions baked the contact block into
  //    the closing-farewell variant; the design has since split, so any
  //    legacy proposal opened today gets a Footer auto-appended so the
  //    consultant's contact details still appear on the last page.
  const hasClosing = sections.some((s) => s.type === "closing");
  const hasFooter = sections.some((s) => s.type === "footer");
  if (hasClosing && !hasFooter) {
    const closingIdx = sections.findIndex((s) => s.type === "closing");
    const insertOrder =
      closingIdx >= 0
        ? (sections[closingIdx].order ?? closingIdx) + 1
        : sections.length;
    sections = [
      ...sections,
      {
        ...makeSection("footer", insertOrder, "default"),
      },
    ].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    changed = true;
  }

  // ── 0b. Drop standalone inclusions sections — the pricing editorial
  //    variant now renders inclusions + exclusions inline. Only drop
  //    when a pricing section exists so nobody loses their only list.
  const hasPricing = sections.some((s) => s.type === "pricing");
  if (hasPricing) {
    const before = sections.length;
    sections = sections.filter((s) => s.type !== "inclusions");
    if (sections.length !== before) changed = true;
  }

  // ── 0b. Upgrade legacy greeting sections to personalNote. Only upgrade
  //    if the proposal doesn't already have a personalNote (avoids
  //    duplicating when a user already started using the new one).
  const hasPersonalNote = sections.some((s) => s.type === "personalNote");
  if (!hasPersonalNote) {
    sections = sections.map((s) => {
      if (s.type !== "greeting") return s;
      changed = true;
      const legacyBody = (s.content.body as string) ?? "";
      return {
        ...s,
        type: "personalNote" as const,
        layoutVariant: "branded-letter",
        content: {
          ...s.content,
          body: legacyBody,
        },
      };
    });
  } else {
    // personalNote already exists — drop any stale legacy greeting so we
    // don't render both.
    const before = sections.length;
    sections = sections.filter((s) => s.type !== "greeting");
    if (sections.length !== before) changed = true;
  }

  // ── 1. Ensure a map section exists ──────────────────────────────────────
  const hasMap = sections.some((s) => s.type === "map");
  if (!hasMap) {
    // Insert right after the personalNote (or legacy greeting) if
    // present, else append. itineraryTable was the previous anchor;
    // it's now stripped above so we use the intro block as the anchor.
    const anchor =
      sections.findIndex((s) => s.type === "personalNote") + 1 ||
      sections.findIndex((s) => s.type === "greeting") + 1 ||
      sections.length;
    const insertAt = anchor;
    const map = makeSection("map", insertAt, "route", { coords: [] });
    sections.splice(insertAt, 0, map);
    changed = true;
  }

  // ── 1a. Ensure dayJourney + propertyShowcase exist ──────────────────────
  // Old proposals (pre-default-overhaul) and ones edited heavily by the
  // operator can end up missing the day-by-day or property showcase. Both
  // are core sections — without them the share/print view rendered as
  // half a deck with no story and no lodges. Auto-insert at sensible
  // anchor points so every loaded proposal has the full spine.
  const hasDayJourney = sections.some((s) => s.type === "dayJourney");
  if (!hasDayJourney) {
    const mapIdx = sections.findIndex((s) => s.type === "map");
    const insertAt = mapIdx >= 0 ? mapIdx + 1 : sections.length;
    // Auto-recovery insert — match the buildDefaultSections() default
    // (left-flip) so a recovered proposal looks like a freshly-built
    // one, not stuck on the old editorial-stack.
    sections.splice(insertAt, 0, makeSection("dayJourney", insertAt, "left-flip"));
    changed = true;
  }
  const hasPropertyShowcase = sections.some((s) => s.type === "propertyShowcase");
  if (!hasPropertyShowcase) {
    const dayIdx = sections.findIndex((s) => s.type === "dayJourney");
    const insertAt = dayIdx >= 0 ? dayIdx + 1 : sections.length;
    sections.splice(
      insertAt,
      0,
      makeSection("propertyShowcase", insertAt, "editorial-carousel"),
    );
    changed = true;
  }

  // ── 2. Normalise legacy dayJourney + propertyShowcase variants ──────────
  const normalised = sections.map((s) => {
    if (s.type === "dayJourney") {
      const mapped = LEGACY_DAY_VARIANTS[s.layoutVariant];
      if (!mapped) return s;
      changed = true;
      return { ...s, layoutVariant: mapped };
    }
    if (s.type === "propertyShowcase") {
      const mapped = LEGACY_PROPERTY_SHOWCASE_VARIANTS[s.layoutVariant];
      if (!mapped) return s;
      changed = true;
      return { ...s, layoutVariant: mapped };
    }
    return s;
  });

  // ── 3. Re-number order to stay contiguous ──────────────────────────────
  const ordered = normalised.map((s, i) => (s.order === i ? s : { ...s, order: i }));
  if (ordered.some((s, i) => s !== normalised[i])) changed = true;

  if (!changed) return proposal;
  return { ...proposal, sections: ordered };
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
