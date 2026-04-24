import type { Template } from "./types";
import { STANDARD_SAFARI_INCLUSIONS, STANDARD_SAFARI_EXCLUSIONS, TANZANIA_PRACTICAL_INFO } from "./shared";

export const TANZANIA_14_DAY_GRAND: Template = {
  slug: "14-day-grand-tanzania",
  title: "14-Day Grand Tanzania — Northern + Mahale Chimps + Zanzibar",
  summary: "Plains, primates, reef — fourteen nights for everything Tanzania does best.",
  metaDescription:
    "A 14-day Grand Tanzania safari: Northern Circuit plus Mahale Mountains chimpanzee trekking plus Zanzibar's Mnemba. Day-by-day, pricing tiers, practical info.",

  countries: ["Tanzania"],
  nights: 14,
  style: "Luxury",
  priceFromPerPerson: "16,200",

  exampleClient: { guestNames: "Harriet and Paul", adults: 2, origin: "Australia" },

  cover: { tagline: "Northern Circuit, Mahale's chimps, Mnemba's reef — Tanzania's three moods in fourteen nights." },

  greeting: {
    body:
      "Harriet and Paul — this is the version for people who've already done the Mara and want something different. Northern Tanzania for the classic safari; Mahale Mountains for wild chimpanzees on the shores of Lake Tanganyika (few visitors, serious forest); Mnemba Island for the close. Tell us which tier fits.",
  },

  closing: {
    quote: "Mahale is where the safari stops feeling familiar. It's also the bit most people don't forget.",
    signOff:
      "Harriet and Paul — Mahale is a long-lead booking (12 months typical) and weather-dependent for the boat transfer. Reply quickly if you're serious about the dates.",
  },

  map: { caption: "Arusha → Tarangire → Ngorongoro → Serengeti → Mahale → Mnemba → Dar" },

  days: [
    { dayNumber: 1, destination: "Arusha", country: "Tanzania", subtitle: "Arrival",
      description: "Land JRO, Arusha for the night.",
      board: "Bed & breakfast",
      tiers: { classic: { libraryName: "Arusha Coffee Lodge" }, premier: { libraryName: "Arusha Coffee Lodge" }, signature: { libraryName: "Arusha Coffee Lodge" } } },
    { dayNumber: 2, destination: "Tarangire", country: "Tanzania", subtitle: "Elephants",
      description: "Road to Tarangire. Afternoon along the river.",
      board: "Full board",
      tiers: { classic: { libraryName: "Chem Chem Lodge" }, premier: { libraryName: "Chem Chem Lodge" }, signature: { libraryName: "Chem Chem Lodge" } } },
    { dayNumber: 3, destination: "Tarangire", country: "Tanzania",
      description: "Full day.",
      board: "Full board",
      tiers: { classic: { libraryName: "Chem Chem Lodge" }, premier: { libraryName: "Chem Chem Lodge" }, signature: { libraryName: "Chem Chem Lodge" } } },
    { dayNumber: 4, destination: "Ngorongoro", country: "Tanzania", subtitle: "Crater prelude",
      description: "Transfer to the rim.",
      board: "Full board",
      tiers: { classic: { libraryName: "The Highlands, Ngorongoro" }, premier: { libraryName: "The Highlands, Ngorongoro" }, signature: { libraryName: "The Highlands, Ngorongoro" } } },
    { dayNumber: 5, destination: "Ngorongoro", country: "Tanzania", subtitle: "Descent",
      description: "Dawn descent, lunch on the floor.",
      board: "Full board",
      tiers: { classic: { libraryName: "The Highlands, Ngorongoro" }, premier: { libraryName: "The Highlands, Ngorongoro" }, signature: { libraryName: "The Highlands, Ngorongoro" } } },
    { dayNumber: 6, destination: "Serengeti", country: "Tanzania", subtitle: "Into the plains",
      description: "Flight to the Serengeti.",
      board: "Full board",
      tiers: { classic: { libraryName: "Serengeti Under Canvas" }, premier: { libraryName: "Singita Grumeti — Sasakwa Lodge" }, signature: { libraryName: "Singita Grumeti — Sasakwa Lodge" } } },
    { dayNumber: 7, destination: "Serengeti", country: "Tanzania",
      description: "Full day. Balloon optional.",
      board: "Full board",
      tiers: { classic: { libraryName: "Serengeti Under Canvas" }, premier: { libraryName: "Singita Grumeti — Sasakwa Lodge" }, signature: { libraryName: "Singita Grumeti — Sasakwa Lodge" } } },
    { dayNumber: 8, destination: "Serengeti", country: "Tanzania",
      description: "Second full day.",
      board: "Full board",
      tiers: { classic: { libraryName: "Serengeti Under Canvas" }, premier: { libraryName: "Singita Grumeti — Sasakwa Lodge" }, signature: { libraryName: "Singita Grumeti — Sasakwa Lodge" } } },
    { dayNumber: 9, destination: "Mahale", country: "Tanzania", subtitle: "To the chimps",
      description: "Long charter flight west to Mahale (~2h). Boat transfer from the dirt strip to the lodge on Lake Tanganyika.",
      board: "Full board",
      tiers: { classic: { libraryName: "Mahale lodge — pick from your library" }, premier: { libraryName: "Mahale lodge — pick from your library" }, signature: { libraryName: "Mahale lodge — pick from your library" } } },
    { dayNumber: 10, destination: "Mahale", country: "Tanzania", subtitle: "Chimp trek",
      description: "Early morning trek into the forest with trackers. Chimp sightings typical but not guaranteed — 70% success rate on any given day.",
      board: "Full board",
      highlights: ["Chimpanzee trekking", "Lake Tanganyika swimming", "Forest birding"],
      tiers: { classic: { libraryName: "Mahale lodge — pick from your library" }, premier: { libraryName: "Mahale lodge — pick from your library" }, signature: { libraryName: "Mahale lodge — pick from your library" } } },
    { dayNumber: 11, destination: "Mahale", country: "Tanzania",
      description: "Second trek day. Lake-side afternoon — the water is some of the clearest and deepest on the continent.",
      board: "Full board",
      tiers: { classic: { libraryName: "Mahale lodge — pick from your library" }, premier: { libraryName: "Mahale lodge — pick from your library" }, signature: { libraryName: "Mahale lodge — pick from your library" } } },
    { dayNumber: 12, destination: "Mnemba", country: "Tanzania", subtitle: "To the reef",
      description: "Long transfer east via Dar to Mnemba. Afternoon in the water.",
      board: "Full board",
      tiers: { classic: { libraryName: "Mnemba Island Lodge" }, premier: { libraryName: "Mnemba Island Lodge" }, signature: { libraryName: "Mnemba Island Lodge" } } },
    { dayNumber: 13, destination: "Mnemba", country: "Tanzania",
      description: "Dolphin snorkel at dawn. Dhow sail at dusk.",
      board: "Full board",
      tiers: { classic: { libraryName: "Mnemba Island Lodge" }, premier: { libraryName: "Mnemba Island Lodge" }, signature: { libraryName: "Mnemba Island Lodge" } } },
    { dayNumber: 14, destination: "Dar es Salaam", country: "Tanzania", subtitle: "Departure",
      description: "Boat off the island, flight to onward hub.",
      board: "Bed & breakfast",
      tiers: { classic: { libraryName: "Dar hotel — pick from your library" }, premier: { libraryName: "Dar hotel — pick from your library" }, signature: { libraryName: "Dar hotel — pick from your library" } } },
  ],

  pricing: {
    classic: { pricePerPerson: "11,400" },
    premier: { pricePerPerson: "16,200" },
    signature: { pricePerPerson: "24,800" },
    highlighted: "signature",
    notes: "Mahale is remote — transit adds one full flight day from/to the Serengeti and weather can delay. Budget a buffer night either side if your onward travel is tight.",
  },

  inclusions: STANDARD_SAFARI_INCLUSIONS,
  exclusions: STANDARD_SAFARI_EXCLUSIONS,
  practicalInfo: TANZANIA_PRACTICAL_INFO,
};
