import type { Template } from "./types";
import { STANDARD_SAFARI_INCLUSIONS, STANDARD_SAFARI_EXCLUSIONS, TANZANIA_PRACTICAL_INFO } from "./shared";

export const TANZANIA_10_DAY_HONEYMOON: Template = {
  slug: "10-day-tanzania-honeymoon",
  title: "10-Day Tanzania Honeymoon — Private Serengeti & Zanzibar",
  summary: "Private plains, private reef — ten quiet nights for two.",
  metaDescription:
    "A 10-day Tanzania honeymoon: private Serengeti concession and Mnemba Island Lodge on Zanzibar. Carefully chosen camps, quiet pace. Day-by-day, pricing tiers, practical info.",

  countries: ["Tanzania"],
  nights: 10,
  style: "Luxury",
  priceFromPerPerson: "11,800",

  exampleClient: { guestNames: "Mia and Luca", adults: 2, origin: "Italy", specialOccasion: "Honeymoon" },

  cover: { tagline: "Private-concession Serengeti, private-island Zanzibar — ten nights, no crowds." },

  greeting: {
    body:
      "Mia and Luca — welcome. We've built this around privacy: five nights in a private concession on the Serengeti edge where you share sightings with nobody, then four on Mnemba where the island has twelve rooms and no day visitors. Tell us your dates and we'll confirm availability.",
  },

  closing: {
    quote: "Honeymoon Africa done well is about what you don't see: other vehicles, other guests, other hurry.",
    signOff:
      "Mia and Luca — both properties are held on soft-booking for the next 7 days. Reply with the dates you want us to lock. Congratulations.",
  },

  map: { caption: "Arusha → Ngorongoro → Grumeti → Mnemba → Zanzibar → Arusha" },

  days: [
    { dayNumber: 1, destination: "Arusha", country: "Tanzania", subtitle: "Arrival",
      description: "Land JRO, private transfer to Arusha.",
      board: "Bed & breakfast",
      tiers: { classic: { libraryName: "Arusha Coffee Lodge" }, premier: { libraryName: "Arusha Coffee Lodge" }, signature: { libraryName: "Arusha Coffee Lodge" } } },
    { dayNumber: 2, destination: "Ngorongoro", country: "Tanzania", subtitle: "Crater prelude",
      description: "Transfer up the rim. Afternoon champagne-on-the-edge. Crater descent tomorrow.",
      board: "Full board",
      tiers: { classic: { libraryName: "The Highlands, Ngorongoro" }, premier: { libraryName: "The Highlands, Ngorongoro" }, signature: { libraryName: "The Highlands, Ngorongoro" } } },
    { dayNumber: 3, destination: "Ngorongoro", country: "Tanzania", subtitle: "Descent",
      description: "Dawn into the Crater. Lunch on the floor. Early-afternoon back at the rim.",
      board: "Full board",
      tiers: { classic: { libraryName: "The Highlands, Ngorongoro" }, premier: { libraryName: "The Highlands, Ngorongoro" }, signature: { libraryName: "The Highlands, Ngorongoro" } } },
    { dayNumber: 4, destination: "Serengeti", country: "Tanzania", subtitle: "Private plains",
      description: "Flight to Grumeti airstrip (~45min). Sasakwa Lodge sits above the plains on a private 350,000-acre concession — almost no other vehicles.",
      board: "Full board",
      tiers: { classic: { libraryName: "Singita Grumeti — Sasakwa Lodge" }, premier: { libraryName: "Singita Grumeti — Sasakwa Lodge" }, signature: { libraryName: "Singita Grumeti — Sasakwa Lodge" } } },
    { dayNumber: 5, destination: "Serengeti", country: "Tanzania",
      description: "Full day. Balloon at dawn, horse-riding mid-morning, bush-bath sundowner that chef prepares out in a clearing.",
      board: "Full board",
      highlights: ["Hot-air balloon", "Horseback riding", "Private bush-bath sundowner"],
      tiers: { classic: { libraryName: "Singita Grumeti — Sasakwa Lodge" }, premier: { libraryName: "Singita Grumeti — Sasakwa Lodge" }, signature: { libraryName: "Singita Grumeti — Sasakwa Lodge" } } },
    { dayNumber: 6, destination: "Serengeti", country: "Tanzania",
      description: "Second full day. Long drive into the main Serengeti for the migration visuals; lunch back at the concession.",
      board: "Full board",
      tiers: { classic: { libraryName: "Singita Grumeti — Sasakwa Lodge" }, premier: { libraryName: "Singita Grumeti — Sasakwa Lodge" }, signature: { libraryName: "Singita Grumeti — Sasakwa Lodge" } } },
    { dayNumber: 7, destination: "Mnemba", country: "Tanzania", subtitle: "To the island",
      description: "Flight east to Zanzibar, boat transfer to Mnemba. Twelve rooms on a private island; afternoon in the water.",
      board: "Full board",
      tiers: { classic: { libraryName: "Mnemba Island Lodge" }, premier: { libraryName: "Mnemba Island Lodge" }, signature: { libraryName: "Mnemba Island Lodge" } } },
    { dayNumber: 8, destination: "Mnemba", country: "Tanzania",
      description: "Dolphin snorkel at dawn, dhow sail in the afternoon, dinner on the sand.",
      board: "Full board",
      tiers: { classic: { libraryName: "Mnemba Island Lodge" }, premier: { libraryName: "Mnemba Island Lodge" }, signature: { libraryName: "Mnemba Island Lodge" } } },
    { dayNumber: 9, destination: "Mnemba", country: "Tanzania",
      description: "Nothing scheduled. That's the point.",
      board: "Full board",
      tiers: { classic: { libraryName: "Mnemba Island Lodge" }, premier: { libraryName: "Mnemba Island Lodge" }, signature: { libraryName: "Mnemba Island Lodge" } } },
    { dayNumber: 10, destination: "Arusha", country: "Tanzania", subtitle: "Departure",
      description: "Boat off the island, flight to onward hub.",
      board: "Bed & breakfast",
      tiers: { classic: { libraryName: "Arusha Coffee Lodge" }, premier: { libraryName: "Arusha Coffee Lodge" }, signature: { libraryName: "Arusha Coffee Lodge" } } },
  ],

  pricing: {
    classic: { pricePerPerson: "8,200" },
    premier: { pricePerPerson: "11,800" },
    signature: { pricePerPerson: "17,400" },
    highlighted: "signature",
    notes: "Two premium properties throughout — Singita Grumeti and Mnemba Island Lodge both book 6-12 months out in peak season.",
  },

  inclusions: STANDARD_SAFARI_INCLUSIONS,
  exclusions: STANDARD_SAFARI_EXCLUSIONS,
  practicalInfo: TANZANIA_PRACTICAL_INFO,
};
