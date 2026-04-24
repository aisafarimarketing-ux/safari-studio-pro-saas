import type { Template } from "./types";
import { STANDARD_SAFARI_INCLUSIONS, STANDARD_SAFARI_EXCLUSIONS, TANZANIA_PRACTICAL_INFO } from "./shared";

export const TANZANIA_12_DAY_SIGNATURE: Template = {
  slug: "12-day-tanzania-signature",
  title: "12-Day Tanzania Signature — Northern Circuit + Southern Parks",
  summary: "Twelve nights, five parks, two circuits — Tanzania at its deepest.",
  metaDescription:
    "A 12-day Tanzania signature safari combining the Northern Circuit (Tarangire, Ngorongoro, Serengeti) with Southern Tanzania's Nyerere. Day-by-day, pricing tiers, practical info.",

  countries: ["Tanzania"],
  nights: 12,
  style: "Luxury",
  priceFromPerPerson: "13,400",

  exampleClient: { guestNames: "Amara and Kofi", adults: 2, origin: "Ghana" },

  cover: { tagline: "Every Tanzania worth seeing — twelve nights, two circuits, no repeats." },

  greeting: {
    body:
      "Amara and Kofi — this is Tanzania in full. Four nights on the Northern Circuit for the set pieces, four on the Serengeti for scale, three on Nyerere in the south for the walking and boat safaris the north can't offer. One arrival night. Tell us which tier fits.",
  },

  closing: {
    quote: "The north is Tanzania's famous face; the south is its quiet one. You see the country differently with both.",
    signOff:
      "Amara and Kofi — this itinerary uses five internal flights. Confirm dates and we'll hold the aircraft seats.",
  },

  map: { caption: "Arusha → Tarangire → Ngorongoro → Serengeti → Nyerere → Dar" },

  days: [
    { dayNumber: 1, destination: "Arusha", country: "Tanzania", subtitle: "Arrival",
      description: "Land JRO, transfer Arusha.",
      board: "Bed & breakfast",
      tiers: { classic: { libraryName: "Arusha Coffee Lodge" }, premier: { libraryName: "Arusha Coffee Lodge" }, signature: { libraryName: "Arusha Coffee Lodge" } } },
    { dayNumber: 2, destination: "Tarangire", country: "Tanzania", subtitle: "Baobabs",
      description: "Road to Tarangire. Afternoon along the river.",
      board: "Full board",
      tiers: { classic: { libraryName: "Chem Chem Lodge" }, premier: { libraryName: "Chem Chem Lodge" }, signature: { libraryName: "Chem Chem Lodge" } } },
    { dayNumber: 3, destination: "Tarangire", country: "Tanzania",
      description: "Full day in Tarangire.",
      board: "Full board",
      tiers: { classic: { libraryName: "Chem Chem Lodge" }, premier: { libraryName: "Chem Chem Lodge" }, signature: { libraryName: "Chem Chem Lodge" } } },
    { dayNumber: 4, destination: "Ngorongoro", country: "Tanzania", subtitle: "Up to the rim",
      description: "Transfer to the Crater, afternoon on the edge.",
      board: "Full board",
      tiers: { classic: { libraryName: "The Highlands, Ngorongoro" }, premier: { libraryName: "The Highlands, Ngorongoro" }, signature: { libraryName: "The Highlands, Ngorongoro" } } },
    { dayNumber: 5, destination: "Ngorongoro", country: "Tanzania", subtitle: "Crater descent",
      description: "Dawn descent, lunch on the floor.",
      board: "Full board",
      tiers: { classic: { libraryName: "The Highlands, Ngorongoro" }, premier: { libraryName: "The Highlands, Ngorongoro" }, signature: { libraryName: "The Highlands, Ngorongoro" } } },
    { dayNumber: 6, destination: "Serengeti", country: "Tanzania", subtitle: "Into the plains",
      description: "Flight to the Serengeti. Afternoon drive.",
      board: "Full board",
      tiers: { classic: { libraryName: "Serengeti Under Canvas" }, premier: { libraryName: "Singita Grumeti — Sasakwa Lodge" }, signature: { libraryName: "Singita Grumeti — Sasakwa Lodge" } } },
    { dayNumber: 7, destination: "Serengeti", country: "Tanzania",
      description: "Full day. Balloon optional at dawn.",
      board: "Full board",
      tiers: { classic: { libraryName: "Serengeti Under Canvas" }, premier: { libraryName: "Singita Grumeti — Sasakwa Lodge" }, signature: { libraryName: "Singita Grumeti — Sasakwa Lodge" } } },
    { dayNumber: 8, destination: "Serengeti", country: "Tanzania",
      description: "Second full day. Long drive into the migration zone.",
      board: "Full board",
      tiers: { classic: { libraryName: "Serengeti Under Canvas" }, premier: { libraryName: "Singita Grumeti — Sasakwa Lodge" }, signature: { libraryName: "Singita Grumeti — Sasakwa Lodge" } } },
    { dayNumber: 9, destination: "Serengeti", country: "Tanzania",
      description: "Third day. Bush breakfast on the plains.",
      board: "Full board",
      tiers: { classic: { libraryName: "Serengeti Under Canvas" }, premier: { libraryName: "Singita Grumeti — Sasakwa Lodge" }, signature: { libraryName: "Singita Grumeti — Sasakwa Lodge" } } },
    { dayNumber: 10, destination: "Nyerere", country: "Tanzania", subtitle: "To the south",
      description: "Long flight south via Dar (~3h total). Afternoon boat safari on the Rufiji.",
      board: "Full board",
      tiers: { classic: { libraryName: "Nyerere camp — pick from your library" }, premier: { libraryName: "Nyerere camp — pick from your library" }, signature: { libraryName: "Nyerere camp — pick from your library" } } },
    { dayNumber: 11, destination: "Nyerere", country: "Tanzania",
      description: "Walking safari at dawn. Afternoon boat or drive.",
      board: "Full board",
      tiers: { classic: { libraryName: "Nyerere camp — pick from your library" }, premier: { libraryName: "Nyerere camp — pick from your library" }, signature: { libraryName: "Nyerere camp — pick from your library" } } },
    { dayNumber: 12, destination: "Dar es Salaam", country: "Tanzania", subtitle: "Departure",
      description: "Flight to Dar, international departure.",
      board: "Bed & breakfast",
      tiers: { classic: { libraryName: "Dar hotel — pick from your library" }, premier: { libraryName: "Dar hotel — pick from your library" }, signature: { libraryName: "Dar hotel — pick from your library" } } },
  ],

  pricing: {
    classic: { pricePerPerson: "9,200" },
    premier: { pricePerPerson: "13,400" },
    signature: { pricePerPerson: "19,800" },
    highlighted: "signature",
    notes: "Five internal flights. Nyerere camps render as free-text placeholders — swap your preferred Selous/Rufiji property from the editor.",
  },

  inclusions: STANDARD_SAFARI_INCLUSIONS,
  exclusions: STANDARD_SAFARI_EXCLUSIONS,
  practicalInfo: TANZANIA_PRACTICAL_INFO,
};
