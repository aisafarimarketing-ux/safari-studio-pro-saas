import type { Template } from "./types";
import { STANDARD_SAFARI_INCLUSIONS, STANDARD_SAFARI_EXCLUSIONS, TANZANIA_PRACTICAL_INFO } from "./shared";

export const TANZANIA_10_DAY_FAMILY_SAFARI: Template = {
  slug: "10-day-tanzania-family-safari",
  title: "10-Day Tanzania Family Safari — Northern Circuit & Zanzibar",
  summary: "Elephant-heavy bush days, then a shallow-water coast for the kids.",
  metaDescription:
    "A 10-day Tanzania family safari: Tarangire and Ngorongoro at a kid-friendly pace, then Zanzibar's calm lagoon beaches. Day-by-day, pricing tiers, practical info.",

  countries: ["Tanzania"],
  nights: 10,
  style: "Mid-range",
  priceFromPerPerson: "5,900",

  exampleClient: { guestNames: "The Okonkwo Family", adults: 2, children: 2, origin: "Nigeria" },

  cover: { tagline: "Ten nights paced for kids — the elephants, the Crater, then the reef." },

  greeting: {
    body:
      "Okonkwo family — this is Tanzania with the kid-pacing built in. Shorter morning drives, pool breaks, a beach week at the end. Tarangire's elephants are genuinely child-friendly; the Crater descent is a spectacle everyone enjoys; Zanzibar's east coast is lagoon-calm at low tide. Reply with ages and allergies and we'll tune.",
  },

  closing: {
    quote: "Kids remember the hippo that yawned, not the seven hours in the car. We've front-loaded the yawns.",
    signOff:
      "Okonkwos — family rooms at these camps go fast. Confirm within 7 days to lock the shape.",
  },

  map: { caption: "Arusha → Tarangire → Ngorongoro → Zanzibar → Arusha" },

  days: [
    { dayNumber: 1, destination: "Arusha", country: "Tanzania", subtitle: "Arrival",
      description: "Land JRO, transfer Arusha.",
      board: "Bed & breakfast",
      tiers: { classic: { libraryName: "Arusha Coffee Lodge" }, premier: { libraryName: "Arusha Coffee Lodge" }, signature: { libraryName: "Arusha Coffee Lodge" } } },
    { dayNumber: 2, destination: "Tarangire", country: "Tanzania", subtitle: "Elephant day",
      description: "Road to Tarangire. Afternoon drive — the elephants here gather in large groups, which is exactly what kids respond to.",
      board: "Full board",
      tiers: { classic: { libraryName: "Chem Chem Lodge" }, premier: { libraryName: "Chem Chem Lodge" }, signature: { libraryName: "Chem Chem Lodge" } } },
    { dayNumber: 3, destination: "Tarangire", country: "Tanzania",
      description: "Full day. Short morning drive, pool mid-day, longer afternoon for the adults while kids stay back.",
      board: "Full board",
      tiers: { classic: { libraryName: "Chem Chem Lodge" }, premier: { libraryName: "Chem Chem Lodge" }, signature: { libraryName: "Chem Chem Lodge" } } },
    { dayNumber: 4, destination: "Ngorongoro", country: "Tanzania", subtitle: "Up to the rim",
      description: "Transfer to the Crater. Afternoon at camp — kids love the viewpoint over the edge.",
      board: "Full board",
      tiers: { classic: { libraryName: "The Highlands, Ngorongoro" }, premier: { libraryName: "The Highlands, Ngorongoro" }, signature: { libraryName: "The Highlands, Ngorongoro" } } },
    { dayNumber: 5, destination: "Ngorongoro", country: "Tanzania", subtitle: "Descent",
      description: "Half-day in the Crater — kids get restless on longer floor drives. Lunch back at camp.",
      board: "Full board",
      tiers: { classic: { libraryName: "The Highlands, Ngorongoro" }, premier: { libraryName: "The Highlands, Ngorongoro" }, signature: { libraryName: "The Highlands, Ngorongoro" } } },
    { dayNumber: 6, destination: "Zanzibar", country: "Tanzania", subtitle: "To the coast",
      description: "Flight to Zanzibar. Transfer to an east-coast resort — the reef breaks offshore so the lagoon inside is shallow and calm.",
      board: "Half board",
      tiers: { classic: { libraryName: "Zanzibar family resort — pick from your library" }, premier: { libraryName: "Zanzibar family resort — pick from your library" }, signature: { libraryName: "Zanzibar family resort — pick from your library" } } },
    { dayNumber: 7, destination: "Zanzibar", country: "Tanzania",
      description: "Beach day. Kids' snorkel session with an instructor. Spice-tour family trip in the afternoon.",
      board: "Half board",
      tiers: { classic: { libraryName: "Zanzibar family resort — pick from your library" }, premier: { libraryName: "Zanzibar family resort — pick from your library" }, signature: { libraryName: "Zanzibar family resort — pick from your library" } } },
    { dayNumber: 8, destination: "Zanzibar", country: "Tanzania",
      description: "Stone Town half-day — narrow streets, the fish market, Forodhani Gardens for evening snacks.",
      board: "Half board",
      tiers: { classic: { libraryName: "Zanzibar family resort — pick from your library" }, premier: { libraryName: "Zanzibar family resort — pick from your library" }, signature: { libraryName: "Zanzibar family resort — pick from your library" } } },
    { dayNumber: 9, destination: "Zanzibar", country: "Tanzania",
      description: "Final beach day. Dhow sail with the kids if they're up to the open water.",
      board: "Half board",
      tiers: { classic: { libraryName: "Zanzibar family resort — pick from your library" }, premier: { libraryName: "Zanzibar family resort — pick from your library" }, signature: { libraryName: "Zanzibar family resort — pick from your library" } } },
    { dayNumber: 10, destination: "Arusha", country: "Tanzania", subtitle: "Departure",
      description: "Flight back to onward hub.",
      board: "Bed & breakfast",
      tiers: { classic: { libraryName: "Arusha Coffee Lodge" }, premier: { libraryName: "Arusha Coffee Lodge" }, signature: { libraryName: "Arusha Coffee Lodge" } } },
  ],

  pricing: {
    classic: { pricePerPerson: "4,400" },
    premier: { pricePerPerson: "5,900" },
    signature: { pricePerPerson: "9,200" },
    highlighted: "premier",
    notes: "Per adult sharing; kids under 12 typically pay 50-65% of the adult rate depending on camp. We adjust on clone.",
  },

  inclusions: STANDARD_SAFARI_INCLUSIONS,
  exclusions: STANDARD_SAFARI_EXCLUSIONS,
  practicalInfo: TANZANIA_PRACTICAL_INFO,
};
