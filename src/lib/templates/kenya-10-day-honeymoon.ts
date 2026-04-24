import type { Template } from "./types";
import { STANDARD_SAFARI_INCLUSIONS, STANDARD_SAFARI_EXCLUSIONS, KENYA_PRACTICAL_INFO } from "./shared";

export const KENYA_10_DAY_HONEYMOON: Template = {
  slug: "10-day-kenya-honeymoon",
  title: "10-Day Kenya Honeymoon — Mara & Lamu",
  summary: "Private conservancy, then Swahili island. Ten nights, minimal crowds.",
  metaDescription:
    "A 10-day Kenya honeymoon: private Mara conservancy plus Lamu Island. Carefully chosen camps, quiet pace, Swahili architecture. Day-by-day, pricing tiers, practical info. Customise and send.",

  countries: ["Kenya"],
  nights: 10,
  style: "Luxury",
  priceFromPerPerson: "9,800",

  exampleClient: { guestNames: "Rachel and Adam", adults: 2, origin: "United States", specialOccasion: "Honeymoon" },

  cover: { tagline: "Mara mornings, Lamu evenings — ten nights of nobody else." },

  greeting: {
    body:
      "Rachel and Adam — welcome. Four nights on the Mara in a private conservancy (no other vehicles at sightings), then five on Lamu where the fastest thing moves at the pace of a dhow. We've picked quiet camps across the board. Tell us if you'd like anything adjusted.",
  },

  closing: {
    quote: "Two kinds of quiet — the Mara's at dawn, Lamu's at dusk. Both earn the trip.",
    signOff:
      "Rachel and Adam — we've held both camps on soft-booking for seven days. Let us know any thoughts; after that they release. Congratulations, again.",
  },

  map: { caption: "Nairobi → Maasai Mara (Cottar's) → Lamu Island → Nairobi" },

  days: [
    {
      dayNumber: 1,
      destination: "Nairobi",
      country: "Kenya",
      subtitle: "Arrival",
      description:
        "Land at Jomo Kenyatta in the evening. Private transfer to Giraffe Manor in Karen — the giraffes come to the dining-room windows at breakfast, which we've timed for the morning.",
      board: "Bed & breakfast",
      tiers: {
        classic: { libraryName: "Giraffe Manor" },
        premier: { libraryName: "Giraffe Manor" },
        signature: { libraryName: "Giraffe Manor" },
      },
    },
    {
      dayNumber: 2,
      destination: "Maasai Mara",
      country: "Kenya",
      subtitle: "Into the conservancy",
      description:
        "Breakfast with giraffes, then flight to the Mara. Cottar's sits on a private conservancy bordering the reserve — its own game, no other vehicles. Afternoon drive, evening sundowner.",
      board: "Full board",
      tiers: {
        classic: { libraryName: "Cottar's 1920s Safari Camp" },
        premier: { libraryName: "Cottar's 1920s Safari Camp" },
        signature: { libraryName: "Cottar's 1920s Safari Camp" },
      },
    },
    {
      dayNumber: 3,
      destination: "Maasai Mara",
      country: "Kenya",
      description:
        "Full day. The Cottar's conservancy allows walking safaris — rare in the main reserve. Night drives also available here.",
      board: "Full board",
      highlights: ["Walking safari (conservancy only)", "Bush breakfast", "Night drive optional"],
      tiers: {
        classic: { libraryName: "Cottar's 1920s Safari Camp" },
        premier: { libraryName: "Cottar's 1920s Safari Camp" },
        signature: { libraryName: "Cottar's 1920s Safari Camp" },
      },
    },
    {
      dayNumber: 4,
      destination: "Maasai Mara",
      country: "Kenya",
      description:
        "Second full day. We'll arrange a private bush bath with sundowners at a fly-camp clearing if the weather holds — chef drives out, table set, no camp staff nearby.",
      board: "Full board",
      tiers: {
        classic: { libraryName: "Cottar's 1920s Safari Camp" },
        premier: { libraryName: "Cottar's 1920s Safari Camp" },
        signature: { libraryName: "Cottar's 1920s Safari Camp" },
      },
    },
    {
      dayNumber: 5,
      destination: "Maasai Mara",
      country: "Kenya",
      description: "Morning drive, lazy afternoon at camp — the pool at Cottar's is the right place to be after four days of early starts.",
      board: "Full board",
      tiers: {
        classic: { libraryName: "Cottar's 1920s Safari Camp" },
        premier: { libraryName: "Cottar's 1920s Safari Camp" },
        signature: { libraryName: "Cottar's 1920s Safari Camp" },
      },
    },
    {
      dayNumber: 6,
      destination: "Lamu",
      country: "Kenya",
      subtitle: "To the island",
      description:
        "Flight east to Lamu (~2h via Nairobi). Boat transfer from Manda airstrip across the channel to Lamu town. Swahili architecture, narrow streets, no cars.",
      board: "Half board",
      tiers: {
        classic: { libraryName: "Lamu hotel — pick from your library" },
        premier: { libraryName: "Lamu hotel — pick from your library" },
        signature: { libraryName: "Lamu hotel — pick from your library" },
      },
    },
    {
      dayNumber: 7,
      destination: "Lamu",
      country: "Kenya",
      description:
        "Dhow sail at sunset — traditional wooden boats, still the main transport between islands. Lunch somewhere uninhabited.",
      board: "Half board",
      tiers: {
        classic: { libraryName: "Lamu hotel — pick from your library" },
        premier: { libraryName: "Lamu hotel — pick from your library" },
        signature: { libraryName: "Lamu hotel — pick from your library" },
      },
    },
    {
      dayNumber: 8,
      destination: "Lamu",
      country: "Kenya",
      description:
        "Swahili cooking class mid-morning. Afternoon free — Shela Beach is a forty-minute walk through the dunes from Lamu town.",
      board: "Half board",
      tiers: {
        classic: { libraryName: "Lamu hotel — pick from your library" },
        premier: { libraryName: "Lamu hotel — pick from your library" },
        signature: { libraryName: "Lamu hotel — pick from your library" },
      },
    },
    {
      dayNumber: 9,
      destination: "Lamu",
      country: "Kenya",
      description: "Final full day. Nothing scheduled — this island rewards an empty diary.",
      board: "Half board",
      tiers: {
        classic: { libraryName: "Lamu hotel — pick from your library" },
        premier: { libraryName: "Lamu hotel — pick from your library" },
        signature: { libraryName: "Lamu hotel — pick from your library" },
      },
    },
    {
      dayNumber: 10,
      destination: "Nairobi",
      country: "Kenya",
      subtitle: "Departure",
      description: "Morning boat to Manda, flight back via Nairobi, international departure.",
      board: "Bed & breakfast",
      tiers: {
        classic: { libraryName: "Giraffe Manor" },
        premier: { libraryName: "Giraffe Manor" },
        signature: { libraryName: "Giraffe Manor" },
      },
    },
  ],

  pricing: {
    classic: { pricePerPerson: "6,800" },
    premier: { pricePerPerson: "9,800" },
    signature: { pricePerPerson: "14,800" },
    highlighted: "signature",
    notes: "Honeymoon-grade camps throughout. Lamu pricing varies with lodge; swap from your library once cloned.",
  },

  inclusions: STANDARD_SAFARI_INCLUSIONS,
  exclusions: STANDARD_SAFARI_EXCLUSIONS,
  practicalInfo: KENYA_PRACTICAL_INFO,
};
