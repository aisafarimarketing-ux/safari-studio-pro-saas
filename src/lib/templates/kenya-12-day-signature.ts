import type { Template } from "./types";
import { STANDARD_SAFARI_INCLUSIONS, STANDARD_SAFARI_EXCLUSIONS, KENYA_PRACTICAL_INFO } from "./shared";

export const KENYA_12_DAY_SIGNATURE: Template = {
  slug: "12-day-kenya-signature",
  title: "12-Day Kenya Signature — Laikipia, Mara & Amboseli",
  summary: "Conservancy Kenya, classic Kenya, Kilimanjaro Kenya — twelve nights, three landscapes.",
  metaDescription:
    "A 12-day Kenya signature safari: Laikipia conservancies for walking and rhino, the Maasai Mara for cats, Amboseli for elephants under Kilimanjaro. Day-by-day, pricing tiers, practical info.",

  countries: ["Kenya"],
  nights: 12,
  style: "Luxury",
  priceFromPerPerson: "12,400",

  exampleClient: {
    guestNames: "Emma and Nicolas",
    adults: 2,
    origin: "France",
  },

  cover: { tagline: "The long-form Kenya — three ecosystems, twelve nights, no crowds." },

  greeting: {
    body:
      "Emma and Nicolas — this is the slow version of the classic circuit, and the better one. Four nights in Laikipia for walking and rhino, four on the Mara for cats and big sky, three in Amboseli for Kilimanjaro and elephants. Transitions are all by air. Tell us which tier suits.",
  },

  closing: {
    quote: "Kenya isn't best fast; it's best spacious.",
    signOff:
      "Emma and Nicolas — we've chosen quieter conservancies over the main-reserve zones at every step. Reply if you'd prefer a different rhythm and we'll rebalance.",
  },

  map: { caption: "Nairobi → Laikipia → Maasai Mara → Amboseli → Nairobi" },

  days: [
    {
      dayNumber: 1,
      destination: "Nairobi",
      country: "Kenya",
      subtitle: "Arrival",
      description: "Land at Jomo Kenyatta, transfer to Karen, early night.",
      board: "Bed & breakfast",
      tiers: {
        classic: { libraryName: "Giraffe Manor" },
        premier: { libraryName: "Giraffe Manor" },
        signature: { libraryName: "Giraffe Manor" },
      },
    },
    {
      dayNumber: 2,
      destination: "Laikipia",
      country: "Kenya",
      subtitle: "Into the conservancies",
      description:
        "Morning flight to Lewa-Downs (~45 min). Sirikoi sits on a private rim of the conservancy — game on foot and vehicle. Afternoon walking safari, rhino tracking with the rangers.",
      board: "Full board",
      tiers: {
        classic: { libraryName: "Sirikoi" },
        premier: { libraryName: "Sirikoi" },
        signature: { libraryName: "Sirikoi" },
      },
    },
    {
      dayNumber: 3,
      destination: "Laikipia",
      country: "Kenya",
      description:
        "Full day. Horseback ride at first light if you ride — Sirikoi's stables field-trained for the terrain. Afternoon drive.",
      board: "Full board",
      highlights: ["Walking safari", "Horseback riding optional", "Rhino tracking"],
      tiers: {
        classic: { libraryName: "Sirikoi" },
        premier: { libraryName: "Sirikoi" },
        signature: { libraryName: "Sirikoi" },
      },
    },
    {
      dayNumber: 4,
      destination: "Laikipia",
      country: "Kenya",
      description:
        "Camel walk through the acacia at mid-morning (takes the pressure off the knees). Sundowner on the escarpment — Mount Kenya visible on clear evenings.",
      board: "Full board",
      tiers: {
        classic: { libraryName: "Sirikoi" },
        premier: { libraryName: "Sirikoi" },
        signature: { libraryName: "Sirikoi" },
      },
    },
    {
      dayNumber: 5,
      destination: "Laikipia",
      country: "Kenya",
      description:
        "Final morning. Anti-poaching-patrol ride-along optional — one of the few places that offer it.",
      board: "Full board",
      tiers: {
        classic: { libraryName: "Sirikoi" },
        premier: { libraryName: "Sirikoi" },
        signature: { libraryName: "Sirikoi" },
      },
    },
    {
      dayNumber: 6,
      destination: "Maasai Mara",
      country: "Kenya",
      subtitle: "Cat country",
      description:
        "Transfer flight across to the Mara (~1h30). Afternoon drive. Cottar's conservancy borders the main reserve — private traversing rights, almost no other vehicles.",
      board: "Full board",
      tiers: {
        classic: { libraryName: "Cottar's 1920s Safari Camp" },
        premier: { libraryName: "Cottar's 1920s Safari Camp" },
        signature: { libraryName: "Cottar's 1920s Safari Camp" },
      },
    },
    {
      dayNumber: 7,
      destination: "Maasai Mara",
      country: "Kenya",
      description:
        "Full day. Bush breakfast. Migration-window crossings if your dates fall in Jul-Oct.",
      board: "Full board",
      tiers: {
        classic: { libraryName: "Cottar's 1920s Safari Camp" },
        premier: { libraryName: "Cottar's 1920s Safari Camp" },
        signature: { libraryName: "Cottar's 1920s Safari Camp" },
      },
    },
    {
      dayNumber: 8,
      destination: "Maasai Mara",
      country: "Kenya",
      description:
        "Night drive optional tonight — conservancy rules allow it, main reserve doesn't. Aardvark, genet, porcupine on a good night.",
      board: "Full board",
      tiers: {
        classic: { libraryName: "Cottar's 1920s Safari Camp" },
        premier: { libraryName: "Cottar's 1920s Safari Camp" },
        signature: { libraryName: "Cottar's 1920s Safari Camp" },
      },
    },
    {
      dayNumber: 9,
      destination: "Maasai Mara",
      country: "Kenya",
      description:
        "Final Mara morning. Hot-air balloon at dawn (book a week ahead). Brunch back at camp.",
      board: "Full board",
      tiers: {
        classic: { libraryName: "Cottar's 1920s Safari Camp" },
        premier: { libraryName: "Cottar's 1920s Safari Camp" },
        signature: { libraryName: "Cottar's 1920s Safari Camp" },
      },
    },
    {
      dayNumber: 10,
      destination: "Amboseli",
      country: "Kenya",
      subtitle: "Under the mountain",
      description:
        "Transfer flight to Amboseli. The elephants here are famous for their tuskers, the mountain for its morning clarity. Afternoon drive through the swamps.",
      board: "Full board",
      tiers: {
        classic: { libraryName: "Tortilis Camp" },
        premier: { libraryName: "Tortilis Camp" },
        signature: { libraryName: "Tortilis Camp" },
      },
    },
    {
      dayNumber: 11,
      destination: "Amboseli",
      country: "Kenya",
      description:
        "Dawn drive at the best time for Kilimanjaro shots — before the cloud builds. Brunch at camp, afternoon drive.",
      board: "Full board",
      tiers: {
        classic: { libraryName: "Tortilis Camp" },
        premier: { libraryName: "Tortilis Camp" },
        signature: { libraryName: "Tortilis Camp" },
      },
    },
    {
      dayNumber: 12,
      destination: "Nairobi",
      country: "Kenya",
      subtitle: "Departure",
      description:
        "Final morning drive. Flight to Nairobi after lunch. International departures that evening.",
      board: "Bed & breakfast",
      tiers: {
        classic: { libraryName: "Giraffe Manor" },
        premier: { libraryName: "Giraffe Manor" },
        signature: { libraryName: "Giraffe Manor" },
      },
    },
  ],

  pricing: {
    classic: { pricePerPerson: "8,400" },
    premier: { pricePerPerson: "12,400" },
    signature: { pricePerPerson: "18,600" },
    highlighted: "signature",
    notes: "Four internal flights (Nairobi-Laikipia-Mara-Amboseli-Nairobi) included. Pricing assumes conservancy over main reserve for the Mara leg.",
  },

  inclusions: STANDARD_SAFARI_INCLUSIONS,
  exclusions: STANDARD_SAFARI_EXCLUSIONS,
  practicalInfo: KENYA_PRACTICAL_INFO,
};
