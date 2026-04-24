import type { Template } from "./types";
import { STANDARD_SAFARI_INCLUSIONS, STANDARD_SAFARI_EXCLUSIONS, TANZANIA_PRACTICAL_INFO } from "./shared";

export const TANZANIA_7_DAY_SERENGETI_NGORONGORO: Template = {
  slug: "7-day-serengeti-and-ngorongoro",
  title: "7-Day Serengeti & Ngorongoro",
  summary: "Two parks, done properly — four Serengeti nights, two at the Crater.",
  metaDescription:
    "A 7-day Tanzania safari focused on the Serengeti and Ngorongoro Crater. Four nights of Serengeti plains, two at the rim. Day-by-day, pricing tiers, practical info.",

  countries: ["Tanzania"],
  nights: 7,
  style: "Mid-range",
  priceFromPerPerson: "5,800",

  exampleClient: { guestNames: "Elena and Marco", adults: 2, origin: "Italy" },

  cover: { tagline: "Long on the Serengeti, deliberate on the Crater." },

  greeting: {
    body:
      "Elena and Marco — this is the no-transit-day version. We skip Tarangire and Manyara and double down on the two parks that draw first-timers here: four on the plains, two on the rim. Fewer roads, more game time.",
  },

  closing: {
    quote: "Four Serengeti mornings teach you how to look; the Crater tells you what you've been missing.",
    signOff:
      "Elena and Marco — if you're shooting photos, we can shift the Serengeti leg further north for wider sightings (Kogatende in season). Reply with preferences.",
  },

  map: { caption: "Arusha → Serengeti → Ngorongoro → Arusha" },

  days: [
    {
      dayNumber: 1,
      destination: "Arusha",
      country: "Tanzania",
      subtitle: "Arrival",
      description: "Land JRO, transfer to Arusha.",
      board: "Bed & breakfast",
      tiers: {
        classic: { libraryName: "Arusha Coffee Lodge" },
        premier: { libraryName: "Arusha Coffee Lodge" },
        signature: { libraryName: "Arusha Coffee Lodge" },
      },
    },
    {
      dayNumber: 2,
      destination: "Serengeti",
      country: "Tanzania",
      subtitle: "Into the plains",
      description:
        "Morning flight to the Serengeti (~1h15). Check in, afternoon drive. The scale of the place is the first thing.",
      board: "Full board",
      tiers: {
        classic: { libraryName: "Serengeti Under Canvas" },
        premier: { libraryName: "Serengeti Under Canvas" },
        signature: { libraryName: "Singita Grumeti — Sasakwa Lodge" },
      },
    },
    {
      dayNumber: 3,
      destination: "Serengeti",
      country: "Tanzania",
      description: "Full day. Hot-air balloon optional at dawn. Afternoon drive along the kopjes.",
      board: "Full board",
      tiers: {
        classic: { libraryName: "Serengeti Under Canvas" },
        premier: { libraryName: "Serengeti Under Canvas" },
        signature: { libraryName: "Singita Grumeti — Sasakwa Lodge" },
      },
    },
    {
      dayNumber: 4,
      destination: "Serengeti",
      country: "Tanzania",
      description: "Second full day. Long-range drive south or north depending on the migration's position.",
      board: "Full board",
      tiers: {
        classic: { libraryName: "Serengeti Under Canvas" },
        premier: { libraryName: "Serengeti Under Canvas" },
        signature: { libraryName: "Singita Grumeti — Sasakwa Lodge" },
      },
    },
    {
      dayNumber: 5,
      destination: "Serengeti",
      country: "Tanzania",
      description: "Last Serengeti morning. Bush breakfast on the plains. Afternoon drive.",
      board: "Full board",
      tiers: {
        classic: { libraryName: "Serengeti Under Canvas" },
        premier: { libraryName: "Serengeti Under Canvas" },
        signature: { libraryName: "Singita Grumeti — Sasakwa Lodge" },
      },
    },
    {
      dayNumber: 6,
      destination: "Ngorongoro",
      country: "Tanzania",
      subtitle: "Crater descent",
      description:
        "Morning drive, then game-drive transfer up to the Crater rim (~4h with game stops). Afternoon at camp — the rim view is the event.",
      board: "Full board",
      tiers: {
        classic: { libraryName: "The Highlands, Ngorongoro" },
        premier: { libraryName: "The Highlands, Ngorongoro" },
        signature: { libraryName: "The Highlands, Ngorongoro" },
      },
    },
    {
      dayNumber: 7,
      destination: "Arusha",
      country: "Tanzania",
      subtitle: "Crater + departure",
      description:
        "Dawn descent into the Crater. Lunch on the floor. Drive to Arusha in the afternoon for evening departure.",
      board: "Full board",
      tiers: {
        classic: { libraryName: "The Highlands, Ngorongoro" },
        premier: { libraryName: "The Highlands, Ngorongoro" },
        signature: { libraryName: "The Highlands, Ngorongoro" },
      },
    },
  ],

  pricing: {
    classic: { pricePerPerson: "4,200" },
    premier: { pricePerPerson: "5,800" },
    signature: { pricePerPerson: "8,800" },
    highlighted: "premier",
    notes: "Per person sharing. Serengeti mobile camps move seasonally; swap your preferred property from the editor.",
  },

  inclusions: STANDARD_SAFARI_INCLUSIONS,
  exclusions: STANDARD_SAFARI_EXCLUSIONS,
  practicalInfo: TANZANIA_PRACTICAL_INFO,
};
