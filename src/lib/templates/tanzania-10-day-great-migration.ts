import type { Template } from "./types";
import { STANDARD_SAFARI_INCLUSIONS, STANDARD_SAFARI_EXCLUSIONS, TANZANIA_PRACTICAL_INFO } from "./shared";

export const TANZANIA_10_DAY_GREAT_MIGRATION: Template = {
  slug: "10-day-great-migration-chase",
  title: "10-Day Great Migration Chase",
  summary: "Ten nights tuned to where the herds actually are that month.",
  metaDescription:
    "A 10-day Tanzania safari built around the Great Migration — camp position shifts to Kogatende, Central, or Ndutu depending on season. Day-by-day, pricing tiers, practical info.",

  countries: ["Tanzania"],
  nights: 10,
  style: "Luxury",
  priceFromPerPerson: "9,400",

  exampleClient: { guestNames: "The Beaumont Family", adults: 2, children: 1, origin: "France" },

  cover: { tagline: "Follow the herds — where they actually are, not where the map says." },

  greeting: {
    body:
      "Beaumonts — the migration isn't a fixed show; it's a year-round circle around the Serengeti–Mara system. We move the camp position seasonally so you're in the right place: Kogatende (crossings) Jul-Oct, Central (resident game) Nov-Dec, Ndutu (calving) Jan-Mar. Tell us your dates and we'll confirm the exact zone.",
  },

  closing: {
    quote: "Every Serengeti book tells you to chase the migration. In practice you position, and the migration comes to you.",
    signOff:
      "Beaumonts — mobile camps need booking 6-9 months out for Jul-Oct dates. If that's your window, reply quickly and we'll confirm availability.",
  },

  map: { caption: "Arusha → Tarangire → Ngorongoro → Serengeti (seasonal zone) → Arusha" },

  days: [
    { dayNumber: 1, destination: "Arusha", country: "Tanzania", subtitle: "Arrival",
      description: "Land JRO, transfer to Arusha. Early dinner, early bed.",
      board: "Bed & breakfast",
      tiers: { classic: { libraryName: "Arusha Coffee Lodge" }, premier: { libraryName: "Arusha Coffee Lodge" }, signature: { libraryName: "Arusha Coffee Lodge" } } },
    { dayNumber: 2, destination: "Tarangire", country: "Tanzania", subtitle: "Baobab country",
      description: "Road to Tarangire. Afternoon drive for elephants and the baobab light at dusk.",
      board: "Full board",
      tiers: { classic: { libraryName: "Chem Chem Lodge" }, premier: { libraryName: "Chem Chem Lodge" }, signature: { libraryName: "Chem Chem Lodge" } } },
    { dayNumber: 3, destination: "Tarangire", country: "Tanzania",
      description: "Full day. Dawn drive, brunch, afternoon along the river.",
      board: "Full board",
      tiers: { classic: { libraryName: "Chem Chem Lodge" }, premier: { libraryName: "Chem Chem Lodge" }, signature: { libraryName: "Chem Chem Lodge" } } },
    { dayNumber: 4, destination: "Ngorongoro", country: "Tanzania", subtitle: "The Crater",
      description: "Transfer up the escarpment, afternoon at the rim.",
      board: "Full board",
      tiers: { classic: { libraryName: "The Highlands, Ngorongoro" }, premier: { libraryName: "The Highlands, Ngorongoro" }, signature: { libraryName: "The Highlands, Ngorongoro" } } },
    { dayNumber: 5, destination: "Ngorongoro", country: "Tanzania", subtitle: "Crater descent",
      description: "Dawn descent. Every Big Five species inside one bowl. Lunch on the floor.",
      board: "Full board",
      tiers: { classic: { libraryName: "The Highlands, Ngorongoro" }, premier: { libraryName: "The Highlands, Ngorongoro" }, signature: { libraryName: "The Highlands, Ngorongoro" } } },
    { dayNumber: 6, destination: "Serengeti", country: "Tanzania", subtitle: "Into the migration zone",
      description: "Flight to the seasonally-appropriate Serengeti airstrip (Kogatende / Seronera / Ndutu). Afternoon drive.",
      board: "Full board",
      tiers: { classic: { libraryName: "Serengeti Under Canvas" }, premier: { libraryName: "Serengeti Under Canvas" }, signature: { libraryName: "Singita Grumeti — Sasakwa Lodge" } } },
    { dayNumber: 7, destination: "Serengeti", country: "Tanzania",
      description: "Full day with the herds. Crossings, calving, or resident game depending on your season.",
      board: "Full board",
      tiers: { classic: { libraryName: "Serengeti Under Canvas" }, premier: { libraryName: "Serengeti Under Canvas" }, signature: { libraryName: "Singita Grumeti — Sasakwa Lodge" } } },
    { dayNumber: 8, destination: "Serengeti", country: "Tanzania",
      description: "Second day. Hot-air balloon optional at dawn — the migration from the air is the image you remember.",
      board: "Full board",
      tiers: { classic: { libraryName: "Serengeti Under Canvas" }, premier: { libraryName: "Serengeti Under Canvas" }, signature: { libraryName: "Singita Grumeti — Sasakwa Lodge" } } },
    { dayNumber: 9, destination: "Serengeti", country: "Tanzania",
      description: "Third day. Long-range drive to whichever zone you haven't reached yet.",
      board: "Full board",
      tiers: { classic: { libraryName: "Serengeti Under Canvas" }, premier: { libraryName: "Serengeti Under Canvas" }, signature: { libraryName: "Singita Grumeti — Sasakwa Lodge" } } },
    { dayNumber: 10, destination: "Arusha", country: "Tanzania", subtitle: "Departure",
      description: "Morning drive. Flight to Arusha. International departure.",
      board: "Bed & breakfast",
      tiers: { classic: { libraryName: "Arusha Coffee Lodge" }, premier: { libraryName: "Arusha Coffee Lodge" }, signature: { libraryName: "Arusha Coffee Lodge" } } },
  ],

  pricing: {
    classic: { pricePerPerson: "6,800" },
    premier: { pricePerPerson: "9,400" },
    signature: { pricePerPerson: "14,800" },
    highlighted: "signature",
    notes: "Migration-window prices (Jul-Oct) push 15-25% higher than shown; we confirm on clone once we know your dates.",
  },

  inclusions: STANDARD_SAFARI_INCLUSIONS,
  exclusions: STANDARD_SAFARI_EXCLUSIONS,
  practicalInfo: TANZANIA_PRACTICAL_INFO,
};
