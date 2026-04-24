import type { Template } from "./types";
import { STANDARD_SAFARI_INCLUSIONS, STANDARD_SAFARI_EXCLUSIONS, KENYA_PRACTICAL_INFO } from "./shared";

export const KENYA_10_DAY_AND_COAST: Template = {
  slug: "10-day-kenya-and-coast",
  title: "10-Day Kenya Safari & Beach — Mara and Diani",
  summary: "Four nights on the plains, five on the Indian Ocean.",
  metaDescription:
    "A 10-day Kenya safari and beach combo: Maasai Mara game drives then Diani Beach to unwind. Day-by-day, pricing tiers, practical info. Customise and send to your clients.",

  countries: ["Kenya"],
  nights: 10,
  style: "Mid-range",
  priceFromPerPerson: "5,200",

  exampleClient: { guestNames: "Thomas and Ingrid", adults: 2, origin: "Germany" },

  cover: { tagline: "Mornings on the Mara, afternoons on the reef." },

  greeting: {
    body:
      "Thomas and Ingrid — this is the classic two-week Kenya in ten nights. The Mara first while your energy is high; Diani at the end when it isn't. We've matched camp-pace to beach-pace; tell us which tier fits.",
  },

  closing: {
    quote: "Safari is an early discipline; the reef asks for no clock at all.",
    signOff:
      "Thomas and Ingrid — if you'd rather extend the bush and shorten the beach (or vice versa), we can rebalance by a night or two in either direction. Reply and we'll update.",
  },

  map: { caption: "Nairobi → Maasai Mara → Diani Beach → Nairobi" },

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
      destination: "Maasai Mara",
      country: "Kenya",
      subtitle: "Into the savannah",
      description:
        "Morning flight to the Mara. Afternoon drive in the conservancy — the landscape opens, and the light flattens out beautifully.",
      board: "Full board",
      tiers: {
        classic: { libraryName: "Angama Mara" },
        premier: { libraryName: "Angama Mara" },
        signature: { libraryName: "Cottar's 1920s Safari Camp" },
      },
    },
    {
      dayNumber: 3,
      destination: "Maasai Mara",
      country: "Kenya",
      description:
        "Full day. Dawn drive for cats, brunch at camp, afternoon drive along the Mara River.",
      board: "Full board",
      tiers: {
        classic: { libraryName: "Angama Mara" },
        premier: { libraryName: "Angama Mara" },
        signature: { libraryName: "Cottar's 1920s Safari Camp" },
      },
    },
    {
      dayNumber: 4,
      destination: "Maasai Mara",
      country: "Kenya",
      description:
        "Second full day. Bush breakfast. Optional Maasai community visit in the afternoon — book ahead.",
      board: "Full board",
      tiers: {
        classic: { libraryName: "Angama Mara" },
        premier: { libraryName: "Angama Mara" },
        signature: { libraryName: "Cottar's 1920s Safari Camp" },
      },
    },
    {
      dayNumber: 5,
      destination: "Maasai Mara",
      country: "Kenya",
      description:
        "Last bush morning. Leopards along the Oloololo Escarpment if you haven't already ticked them. Farewell sundowner.",
      board: "Full board",
      tiers: {
        classic: { libraryName: "Angama Mara" },
        premier: { libraryName: "Angama Mara" },
        signature: { libraryName: "Cottar's 1920s Safari Camp" },
      },
    },
    {
      dayNumber: 6,
      destination: "Diani",
      country: "Kenya",
      subtitle: "Arrival at the coast",
      description:
        "Transfer flight to Mombasa (~1h30). Road transfer south to Diani (~1h15). Afternoon on the beach — the reef breaks a kilometre offshore, so the water inside is lagoon-calm.",
      board: "Half board",
      tiers: {
        classic: { libraryName: "Beach lodge — pick from your library" },
        premier: { libraryName: "Beach lodge — pick from your library" },
        signature: { libraryName: "Beach lodge — pick from your library" },
      },
    },
    {
      dayNumber: 7,
      destination: "Diani",
      country: "Kenya",
      description:
        "Beach day. Kite surfing in season (Jun-Sep, Dec-Feb). Dolphin-watching in Kisite Marine Park (optional).",
      board: "Half board",
      tiers: {
        classic: { libraryName: "Beach lodge — pick from your library" },
        premier: { libraryName: "Beach lodge — pick from your library" },
        signature: { libraryName: "Beach lodge — pick from your library" },
      },
    },
    {
      dayNumber: 8,
      destination: "Diani",
      country: "Kenya",
      description: "Beach day. Wasini Island dhow trip optional. Sunset on the sand.",
      board: "Half board",
      tiers: {
        classic: { libraryName: "Beach lodge — pick from your library" },
        premier: { libraryName: "Beach lodge — pick from your library" },
        signature: { libraryName: "Beach lodge — pick from your library" },
      },
    },
    {
      dayNumber: 9,
      destination: "Diani",
      country: "Kenya",
      description: "Final beach day. Colobus Conservancy visit optional — blue-and-colobus monkeys in acacia canopy.",
      board: "Half board",
      tiers: {
        classic: { libraryName: "Beach lodge — pick from your library" },
        premier: { libraryName: "Beach lodge — pick from your library" },
        signature: { libraryName: "Beach lodge — pick from your library" },
      },
    },
    {
      dayNumber: 10,
      destination: "Nairobi",
      country: "Kenya",
      subtitle: "Departure",
      description:
        "Road transfer back to Mombasa, flight to Nairobi, international departure that evening.",
      board: "Bed & breakfast",
      tiers: {
        classic: { libraryName: "Giraffe Manor" },
        premier: { libraryName: "Giraffe Manor" },
        signature: { libraryName: "Giraffe Manor" },
      },
    },
  ],

  pricing: {
    classic: { pricePerPerson: "3,800" },
    premier: { pricePerPerson: "5,200" },
    signature: { pricePerPerson: "8,400" },
    highlighted: "premier",
    notes: "Beach camps render as free-text until you add Diani / Watamu properties to your library — swap from the editor in the cloned proposal.",
  },

  inclusions: STANDARD_SAFARI_INCLUSIONS,
  exclusions: STANDARD_SAFARI_EXCLUSIONS,
  practicalInfo: KENYA_PRACTICAL_INFO,
};
