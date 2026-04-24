import type { Template } from "./types";
import { STANDARD_SAFARI_INCLUSIONS, STANDARD_SAFARI_EXCLUSIONS, TANZANIA_PRACTICAL_INFO } from "./shared";

export const TANZANIA_7_DAY_NORTHERN_CIRCUIT: Template = {
  slug: "7-day-tanzania-northern-circuit",
  title: "7-Day Tanzania Northern Circuit — Tarangire, Manyara, Ngorongoro & Serengeti",
  summary: "The canonical Tanzania — four parks, seven nights, everything north.",
  metaDescription:
    "A 7-day Tanzania Northern Circuit safari covering Tarangire, Lake Manyara, Ngorongoro Crater, and the Serengeti. Day-by-day, pricing tiers, practical info. Customise and send.",

  countries: ["Tanzania"],
  nights: 7,
  style: "Mid-range",
  priceFromPerPerson: "5,400",

  exampleClient: { guestNames: "Priya and Vikram", adults: 2, origin: "India" },

  cover: { tagline: "Four parks, seven nights — the Northern Circuit as it should be done." },

  greeting: {
    body:
      "Priya and Vikram — this is the canonical Tanzania. Tarangire for elephants, Manyara for its tree-climbing lions (when you find them), the Crater for the set-piece descent, and the Serengeti for everything else. We've kept the transfer days paced to leave real time in each park.",
  },

  closing: {
    quote: "The Serengeti teaches scale; the Crater teaches containment. The combination is why people come back.",
    signOff:
      "Priya and Vikram — migration timing matters on this circuit. If your dates are Jul-Oct we'll likely move Serengeti camp north to Kogatende. Reply and we'll confirm.",
  },

  map: { caption: "Arusha → Tarangire → Manyara → Ngorongoro → Serengeti → Arusha" },

  days: [
    {
      dayNumber: 1,
      destination: "Arusha",
      country: "Tanzania",
      subtitle: "Arrival",
      description: "Land at Kilimanjaro International. Transfer to Arusha, overnight.",
      board: "Bed & breakfast",
      tiers: {
        classic: { libraryName: "Arusha Coffee Lodge" },
        premier: { libraryName: "Arusha Coffee Lodge" },
        signature: { libraryName: "Arusha Coffee Lodge" },
      },
    },
    {
      dayNumber: 2,
      destination: "Tarangire",
      country: "Tanzania",
      subtitle: "Elephants and baobabs",
      description:
        "Road to Tarangire (~2h30). Afternoon drive along the river — the dry-season elephant density is the reason to stop here.",
      board: "Full board",
      tiers: {
        classic: { libraryName: "Chem Chem Lodge" },
        premier: { libraryName: "Chem Chem Lodge" },
        signature: { libraryName: "Chem Chem Lodge" },
      },
    },
    {
      dayNumber: 3,
      destination: "Lake Manyara",
      country: "Tanzania",
      subtitle: "Tree-climbing lions",
      description:
        "Morning drive in Tarangire. Transfer to Manyara (~2h). Afternoon drive through the forest edge of the park — look up for the lions, which occasionally sleep in the acacias.",
      board: "Full board",
      tiers: {
        classic: { libraryName: "Lake Manyara Serena Safari Lodge" },
        premier: { libraryName: "Lake Manyara Serena Safari Lodge" },
        signature: { libraryName: "&Beyond Lake Manyara Tree Lodge" },
      },
    },
    {
      dayNumber: 4,
      destination: "Ngorongoro",
      country: "Tanzania",
      subtitle: "Crater descent",
      description:
        "Morning drive up the escarpment (~2h). Afternoon descent into the Crater — 600m down, every Big Five species within a 20km radius. Lunch on the floor.",
      board: "Full board",
      tiers: {
        classic: { libraryName: "The Highlands, Ngorongoro" },
        premier: { libraryName: "The Highlands, Ngorongoro" },
        signature: { libraryName: "The Highlands, Ngorongoro" },
      },
    },
    {
      dayNumber: 5,
      destination: "Serengeti",
      country: "Tanzania",
      subtitle: "Into the infinite plain",
      description:
        "Morning flight or drive to the Serengeti (~1h flight, ~4h drive). Check in, afternoon drive — the open plains feel properly big after the Crater's containment.",
      board: "Full board",
      tiers: {
        classic: { libraryName: "Serengeti Under Canvas" },
        premier: { libraryName: "Serengeti Under Canvas" },
        signature: { libraryName: "Singita Grumeti — Sasakwa Lodge" },
      },
    },
    {
      dayNumber: 6,
      destination: "Serengeti",
      country: "Tanzania",
      description:
        "Full day. Dawn drive, hot-air balloon optional (book a week ahead — this is the classic Serengeti balloon flight).",
      board: "Full board",
      highlights: ["Hot-air balloon option", "Dawn game drive", "Sundowner on the kopjes"],
      tiers: {
        classic: { libraryName: "Serengeti Under Canvas" },
        premier: { libraryName: "Serengeti Under Canvas" },
        signature: { libraryName: "Singita Grumeti — Sasakwa Lodge" },
      },
    },
    {
      dayNumber: 7,
      destination: "Arusha",
      country: "Tanzania",
      subtitle: "Departure",
      description:
        "Morning drive. Flight back to Arusha (~1h15). Evening international departure.",
      board: "Bed & breakfast",
      tiers: {
        classic: { libraryName: "Arusha Coffee Lodge" },
        premier: { libraryName: "Arusha Coffee Lodge" },
        signature: { libraryName: "Arusha Coffee Lodge" },
      },
    },
  ],

  pricing: {
    classic: { pricePerPerson: "3,800" },
    premier: { pricePerPerson: "5,400" },
    signature: { pricePerPerson: "8,400" },
    highlighted: "premier",
    notes: "Per person sharing. Migration-window dates (Jul-Oct) push signature pricing higher; we adjust on clone.",
  },

  inclusions: STANDARD_SAFARI_INCLUSIONS,
  exclusions: STANDARD_SAFARI_EXCLUSIONS,
  practicalInfo: TANZANIA_PRACTICAL_INFO,
};
