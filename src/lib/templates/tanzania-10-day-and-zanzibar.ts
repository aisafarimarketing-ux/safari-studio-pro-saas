import type { Template } from "./types";
import { STANDARD_SAFARI_INCLUSIONS, STANDARD_SAFARI_EXCLUSIONS, TANZANIA_PRACTICAL_INFO } from "./shared";

export const TANZANIA_10_DAY_AND_ZANZIBAR: Template = {
  slug: "10-day-tanzania-and-zanzibar",
  title: "10-Day Tanzania & Zanzibar — Safari and Indian Ocean",
  summary: "Six nights north, three on the reef, one in Stone Town.",
  metaDescription:
    "A 10-day Tanzania safari and Zanzibar beach combo: Northern Circuit game drives then Stone Town's Swahili heart and Mnemba's reef. Day-by-day, pricing tiers, practical info.",

  countries: ["Tanzania"],
  nights: 10,
  style: "Mid-range",
  priceFromPerPerson: "6,400",

  exampleClient: { guestNames: "Jasper and Olivia", adults: 2, origin: "Netherlands" },

  cover: { tagline: "Bush then reef — Tanzania in ten perfectly-spaced nights." },

  greeting: {
    body:
      "Jasper and Olivia — this is Tanzania as most visitors hope to do it. Four nights on the Northern Circuit, one in Stone Town for Swahili architecture and spice, three on Mnemba's reef at the end. Every transition is short. Tell us which tier fits.",
  },

  closing: {
    quote: "The Serengeti teaches distance; Zanzibar teaches stillness.",
    signOff:
      "Jasper and Olivia — Mnemba books a long way out in peak season. Confirm in the next 7 days to hold it.",
  },

  map: { caption: "Arusha → Ngorongoro → Serengeti → Stone Town → Mnemba → Arusha" },

  days: [
    { dayNumber: 1, destination: "Arusha", country: "Tanzania", subtitle: "Arrival",
      description: "Land JRO, transfer Arusha.",
      board: "Bed & breakfast",
      tiers: { classic: { libraryName: "Arusha Coffee Lodge" }, premier: { libraryName: "Arusha Coffee Lodge" }, signature: { libraryName: "Arusha Coffee Lodge" } } },
    { dayNumber: 2, destination: "Ngorongoro", country: "Tanzania", subtitle: "Up to the rim",
      description: "Transfer up the escarpment. Afternoon at the rim.",
      board: "Full board",
      tiers: { classic: { libraryName: "The Highlands, Ngorongoro" }, premier: { libraryName: "The Highlands, Ngorongoro" }, signature: { libraryName: "The Highlands, Ngorongoro" } } },
    { dayNumber: 3, destination: "Ngorongoro", country: "Tanzania", subtitle: "Crater descent",
      description: "Dawn descent, lunch on the floor. Second rim night.",
      board: "Full board",
      tiers: { classic: { libraryName: "The Highlands, Ngorongoro" }, premier: { libraryName: "The Highlands, Ngorongoro" }, signature: { libraryName: "The Highlands, Ngorongoro" } } },
    { dayNumber: 4, destination: "Serengeti", country: "Tanzania", subtitle: "Into the plains",
      description: "Transfer flight to the Serengeti. Afternoon drive.",
      board: "Full board",
      tiers: { classic: { libraryName: "Serengeti Under Canvas" }, premier: { libraryName: "Serengeti Under Canvas" }, signature: { libraryName: "Singita Grumeti — Sasakwa Lodge" } } },
    { dayNumber: 5, destination: "Serengeti", country: "Tanzania",
      description: "Full day. Dawn cats, balloon optional.",
      board: "Full board",
      tiers: { classic: { libraryName: "Serengeti Under Canvas" }, premier: { libraryName: "Serengeti Under Canvas" }, signature: { libraryName: "Singita Grumeti — Sasakwa Lodge" } } },
    { dayNumber: 6, destination: "Serengeti", country: "Tanzania",
      description: "Second day. Bush breakfast on the plains.",
      board: "Full board",
      tiers: { classic: { libraryName: "Serengeti Under Canvas" }, premier: { libraryName: "Serengeti Under Canvas" }, signature: { libraryName: "Singita Grumeti — Sasakwa Lodge" } } },
    { dayNumber: 7, destination: "Stone Town", country: "Tanzania", subtitle: "Swahili arrival",
      description: "Flight east to Zanzibar (~2h). Check in to a Stone Town hotel. Guided walk through the old quarter in the afternoon.",
      board: "Bed & breakfast",
      tiers: { classic: { libraryName: "Stone Town hotel — pick from your library" }, premier: { libraryName: "Stone Town hotel — pick from your library" }, signature: { libraryName: "Stone Town hotel — pick from your library" } } },
    { dayNumber: 8, destination: "Mnemba", country: "Tanzania", subtitle: "To the reef",
      description: "Transfer north to Mnemba Island (~2h30 by road + boat). Afternoon snorkel on the house reef.",
      board: "Full board",
      tiers: { classic: { libraryName: "Mnemba Island Lodge" }, premier: { libraryName: "Mnemba Island Lodge" }, signature: { libraryName: "Mnemba Island Lodge" } } },
    { dayNumber: 9, destination: "Mnemba", country: "Tanzania",
      description: "Full day. Dolphin snorkel at dawn, dhow sail at dusk.",
      board: "Full board",
      tiers: { classic: { libraryName: "Mnemba Island Lodge" }, premier: { libraryName: "Mnemba Island Lodge" }, signature: { libraryName: "Mnemba Island Lodge" } } },
    { dayNumber: 10, destination: "Arusha", country: "Tanzania", subtitle: "Departure",
      description: "Boat off the island, flight via Zanzibar or direct to onward hub.",
      board: "Bed & breakfast",
      tiers: { classic: { libraryName: "Arusha Coffee Lodge" }, premier: { libraryName: "Arusha Coffee Lodge" }, signature: { libraryName: "Arusha Coffee Lodge" } } },
  ],

  pricing: {
    classic: { pricePerPerson: "4,800" },
    premier: { pricePerPerson: "6,400" },
    signature: { pricePerPerson: "10,800" },
    highlighted: "premier",
    notes: "Mnemba is priced all-inclusive and books far out; we advise 6+ months for peak dates.",
  },

  inclusions: STANDARD_SAFARI_INCLUSIONS,
  exclusions: STANDARD_SAFARI_EXCLUSIONS,
  practicalInfo: TANZANIA_PRACTICAL_INFO,
};
