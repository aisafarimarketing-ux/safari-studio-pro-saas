import type { Template } from "./types";
import { STANDARD_SAFARI_INCLUSIONS, STANDARD_SAFARI_EXCLUSIONS, KENYA_PRACTICAL_INFO } from "./shared";

export const KENYA_8_DAY_LUXURY_FLYING: Template = {
  slug: "8-day-kenya-luxury-flying",
  title: "8-Day Kenya Luxury Flying — Lewa, Samburu & Angama",
  summary: "Eight nights, three premium camps, no road transfers.",
  metaDescription:
    "A signature-tier 8-day Kenya luxury flying safari: Sirikoi on Lewa, Saruni Samburu, Angama Mara. Private aircraft transitions. Day-by-day, pricing tiers, practical info.",

  countries: ["Kenya"],
  nights: 8,
  style: "Luxury",
  priceFromPerPerson: "12,800",

  exampleClient: {
    guestNames: "Sophia and Daniel",
    adults: 2,
    origin: "United States",
    specialOccasion: "Milestone anniversary",
  },

  cover: { tagline: "Eight nights, three landscapes, every transition by air." },

  greeting: {
    body:
      "Sophia and Daniel — welcome. This is Kenya at its most comfortable: no drive over three hours, three premium camps, two nights at each safari stop. Eight days that feel like twelve. Tell us if you'd prefer to stretch any section.",
  },

  closing: {
    quote: "The difference between a good Kenya and a great one is often just the flight over the road.",
    signOff:
      "Sophia and Daniel — all three camps are held on soft-booking for seven days. Reply to confirm or tweak.",
  },

  map: { caption: "Nairobi → Lewa → Samburu → Maasai Mara → Nairobi" },

  days: [
    {
      dayNumber: 1,
      destination: "Nairobi",
      country: "Kenya",
      subtitle: "Arrival",
      description: "Land at Jomo Kenyatta, transfer to Karen for an early night.",
      board: "Bed & breakfast",
      tiers: {
        classic: { libraryName: "Giraffe Manor" },
        premier: { libraryName: "Giraffe Manor" },
        signature: { libraryName: "Giraffe Manor" },
      },
    },
    {
      dayNumber: 2,
      destination: "Lewa",
      country: "Kenya",
      subtitle: "Rhino country",
      description:
        "Morning flight to Lewa-Downs. Sirikoi is a family-run estate on the conservancy rim — game on foot and vehicle. Afternoon walking safari with a ranger.",
      board: "Full board",
      tiers: {
        classic: { libraryName: "Sirikoi" },
        premier: { libraryName: "Sirikoi" },
        signature: { libraryName: "Sirikoi" },
      },
    },
    {
      dayNumber: 3,
      destination: "Lewa",
      country: "Kenya",
      description:
        "Full day. Horseback or camel at first light. Rhino tracking mid-morning. Sundowner on the escarpment.",
      board: "Full board",
      highlights: ["Walking safari", "Horseback riding", "Rhino tracking"],
      tiers: {
        classic: { libraryName: "Sirikoi" },
        premier: { libraryName: "Sirikoi" },
        signature: { libraryName: "Sirikoi" },
      },
    },
    {
      dayNumber: 4,
      destination: "Samburu",
      country: "Kenya",
      subtitle: "The dry north",
      description:
        "Short flight to Samburu (~30 min). The landscape turns red. Saruni sits on Kalama Conservancy above the reserve — private, breezy. Afternoon drive for the northern species.",
      board: "Full board",
      tiers: {
        classic: { libraryName: "Saruni Samburu" },
        premier: { libraryName: "Saruni Samburu" },
        signature: { libraryName: "Saruni Samburu" },
      },
    },
    {
      dayNumber: 5,
      destination: "Samburu",
      country: "Kenya",
      description:
        "Full day. Dawn drive along the Ewaso Ng'iro. Midday lounge at the infinity pool — it looks north into Mathews Range.",
      board: "Full board",
      tiers: {
        classic: { libraryName: "Saruni Samburu" },
        premier: { libraryName: "Saruni Samburu" },
        signature: { libraryName: "Saruni Samburu" },
      },
    },
    {
      dayNumber: 6,
      destination: "Maasai Mara",
      country: "Kenya",
      subtitle: "Big cat country",
      description:
        "Flight south-west to the Mara. Angama sits on the Oloololo Escarpment — thirty tents, 1,000-foot view. Afternoon drive in the Triangle.",
      board: "Full board",
      tiers: {
        classic: { libraryName: "Angama Mara" },
        premier: { libraryName: "Angama Mara" },
        signature: { libraryName: "Angama Mara" },
      },
    },
    {
      dayNumber: 7,
      destination: "Maasai Mara",
      country: "Kenya",
      description:
        "Full day. Bush breakfast on the plains. Angama's photographic studio can host a mid-afternoon session if you're a keen photographer.",
      board: "Full board",
      tiers: {
        classic: { libraryName: "Angama Mara" },
        premier: { libraryName: "Angama Mara" },
        signature: { libraryName: "Angama Mara" },
      },
    },
    {
      dayNumber: 8,
      destination: "Nairobi",
      country: "Kenya",
      subtitle: "Departure",
      description: "Final morning. Flight back to Nairobi, international departure.",
      board: "Bed & breakfast",
      tiers: {
        classic: { libraryName: "Giraffe Manor" },
        premier: { libraryName: "Giraffe Manor" },
        signature: { libraryName: "Giraffe Manor" },
      },
    },
  ],

  pricing: {
    classic: { pricePerPerson: "9,400" },
    premier: { pricePerPerson: "12,800" },
    signature: { pricePerPerson: "18,400" },
    highlighted: "signature",
    notes: "Signature-tier flying circuit. All three camps are the same across tiers by design — the differentiator is room category and add-ons (helicopter time, private-vehicle uplift).",
  },

  inclusions: STANDARD_SAFARI_INCLUSIONS,
  exclusions: STANDARD_SAFARI_EXCLUSIONS,
  practicalInfo: KENYA_PRACTICAL_INFO,
};
