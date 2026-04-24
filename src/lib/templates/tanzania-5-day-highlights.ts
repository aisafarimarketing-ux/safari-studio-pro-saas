import type { Template } from "./types";
import { STANDARD_SAFARI_INCLUSIONS, STANDARD_SAFARI_EXCLUSIONS, TANZANIA_PRACTICAL_INFO } from "./shared";

export const TANZANIA_5_DAY_HIGHLIGHTS: Template = {
  slug: "5-day-tanzania-highlights",
  title: "5-Day Tanzania Highlights — Tarangire & Ngorongoro",
  summary: "A long weekend through Tanzania's two most different parks.",
  metaDescription:
    "A 5-day Tanzania highlights safari focused on Tarangire's elephants and the Ngorongoro Crater. Day-by-day, pricing tiers, practical info. Customise and send to your clients.",

  countries: ["Tanzania"],
  nights: 5,
  style: "Mid-range",
  priceFromPerPerson: "3,600",

  exampleClient: { guestNames: "Marcus and Linda", adults: 2, origin: "Germany" },

  cover: { tagline: "Tarangire's elephants, Ngorongoro's crater floor — five nights, no wasted days." },

  greeting: {
    body:
      "Marcus and Linda — the compact Tanzania. Two nights in Tarangire where the baobab country is underrated; two at the Crater rim where the descent each morning is one of the strangest drives in Africa; one arrival night to catch up. Tell us which tier fits.",
  },

  closing: {
    quote: "The Crater floor is Africa in miniature — and the only Africa where you look down at it.",
    signOff:
      "Marcus and Linda — if you'd like to stretch this with two Serengeti nights before the Crater, we can rebalance. Reply with any thoughts.",
  },

  map: { caption: "Arusha → Tarangire → Ngorongoro → Arusha" },

  days: [
    {
      dayNumber: 1,
      destination: "Arusha",
      country: "Tanzania",
      subtitle: "Arrival",
      description: "Land at Kilimanjaro International (JRO). Private transfer to Arusha (~45 min). Early night.",
      board: "Bed & breakfast",
      tiers: {
        classic: { libraryName: "Arusha Coffee Lodge" },
        premier: { libraryName: "Arusha Coffee Lodge" },
        signature: { libraryName: "Mount Meru Game Lodge" },
      },
    },
    {
      dayNumber: 2,
      destination: "Tarangire",
      country: "Tanzania",
      subtitle: "Into baobab country",
      description:
        "Road transfer from Arusha (~2h30). Tarangire's dry-season elephant density is among Africa's highest; the baobabs give the landscape its texture.",
      board: "Full board",
      tiers: {
        classic: { libraryName: "Chem Chem Lodge" },
        premier: { libraryName: "Chem Chem Lodge" },
        signature: { libraryName: "Chem Chem Lodge" },
      },
    },
    {
      dayNumber: 3,
      destination: "Tarangire",
      country: "Tanzania",
      description:
        "Full day. Dawn drive along the Tarangire River for cat sightings. Afternoon drive through the baobab grove.",
      board: "Full board",
      tiers: {
        classic: { libraryName: "Chem Chem Lodge" },
        premier: { libraryName: "Chem Chem Lodge" },
        signature: { libraryName: "Chem Chem Lodge" },
      },
    },
    {
      dayNumber: 4,
      destination: "Ngorongoro",
      country: "Tanzania",
      subtitle: "The Crater",
      description:
        "Road transfer via Karatu (~3h). Check in to the rim. The Crater descent happens tomorrow — tonight is the view over.",
      board: "Full board",
      tiers: {
        classic: { libraryName: "The Highlands, Ngorongoro" },
        premier: { libraryName: "The Highlands, Ngorongoro" },
        signature: { libraryName: "The Highlands, Ngorongoro" },
      },
    },
    {
      dayNumber: 5,
      destination: "Arusha",
      country: "Tanzania",
      subtitle: "Crater + departure",
      description:
        "Dawn descent into the Crater — 600m down, 20km across, every Big Five species in one bowl. Lunch on the floor. Drive back to Arusha in the afternoon for evening international departure.",
      board: "Full board",
      tiers: {
        classic: { libraryName: "The Highlands, Ngorongoro" },
        premier: { libraryName: "The Highlands, Ngorongoro" },
        signature: { libraryName: "The Highlands, Ngorongoro" },
      },
    },
  ],

  pricing: {
    classic: { pricePerPerson: "2,800" },
    premier: { pricePerPerson: "3,600" },
    signature: { pricePerPerson: "5,400" },
    highlighted: "premier",
    notes: "Per person sharing, land-only. The long Crater-departure day can be split by adding a second rim night.",
  },

  inclusions: STANDARD_SAFARI_INCLUSIONS,
  exclusions: STANDARD_SAFARI_EXCLUSIONS,
  practicalInfo: TANZANIA_PRACTICAL_INFO,
};
