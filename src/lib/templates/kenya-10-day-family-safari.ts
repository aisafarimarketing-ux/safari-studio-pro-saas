import type { Template } from "./types";
import { STANDARD_SAFARI_INCLUSIONS, STANDARD_SAFARI_EXCLUSIONS, KENYA_PRACTICAL_INFO } from "./shared";

export const KENYA_10_DAY_FAMILY_SAFARI: Template = {
  slug: "10-day-kenya-family-safari",
  title: "10-Day Kenya Family Safari — Nairobi, Mara & Watamu",
  summary: "Built for kids: giraffes at breakfast, elephants at lunch, the ocean to land on.",
  metaDescription:
    "A 10-day Kenya family safari: Giraffe Manor and the Sheldrick elephant orphanage, four nights Mara game drives, then Watamu beach. Day-by-day, pricing tiers, practical info. Customise and send.",

  countries: ["Kenya"],
  nights: 10,
  style: "Mid-range",
  priceFromPerPerson: "5,400",

  exampleClient: {
    guestNames: "The Henderson Family",
    adults: 2,
    children: 2,
    origin: "United Kingdom",
  },

  cover: { tagline: "Kids, Kenya, coast — a ten-night trip they'll remember past the holiday." },

  greeting: {
    body:
      "Hendersons — this itinerary is paced for two adults and two kids. Morning starts are gentler than an adult-only safari; transfer days are the exception not the rule; swim options at the end of every afternoon. Families of this size fill a single vehicle cleanly, which keeps the budget sensible. Tell us which tier fits.",
  },

  closing: {
    quote: "Kids don't need the perfect lion sighting; they need the perfect day out.",
    signOff:
      "Hendersons — ages of the kids change a lot of the detail (pool-depth on the beach, walking distances, night-drive eligibility). Reply with ages and any allergies and we'll tune.",
  },

  map: { caption: "Nairobi → Maasai Mara → Watamu → Nairobi" },

  days: [
    {
      dayNumber: 1,
      destination: "Nairobi",
      country: "Kenya",
      subtitle: "Arrival",
      description:
        "Land at Jomo Kenyatta. Private transfer to Giraffe Manor in Karen — the giraffes put their heads through the windows at breakfast. Which is the whole point.",
      board: "Bed & breakfast",
      tiers: {
        classic: { libraryName: "Giraffe Manor" },
        premier: { libraryName: "Giraffe Manor" },
        signature: { libraryName: "Giraffe Manor" },
      },
    },
    {
      dayNumber: 2,
      destination: "Nairobi",
      country: "Kenya",
      subtitle: "City morning + fly Mara",
      description:
        "Morning at the Sheldrick Wildlife Trust — orphaned elephants at 11am feed (book ahead). Transfer to Wilson Airport for the 1pm flight to the Mara. Afternoon game drive, early dinner, early bed.",
      board: "Full board",
      tiers: {
        classic: { libraryName: "Angama Mara" },
        premier: { libraryName: "Angama Mara" },
        signature: { libraryName: "Angama Mara" },
      },
    },
    {
      dayNumber: 3,
      destination: "Maasai Mara",
      country: "Kenya",
      description:
        "Full day. Kids' game drive: shorter in the morning (~2.5h) with a bush-breakfast break. Pool afternoon. Longer dusk drive for the adults if the children want to stay in camp.",
      board: "Full board",
      tiers: {
        classic: { libraryName: "Angama Mara" },
        premier: { libraryName: "Angama Mara" },
        signature: { libraryName: "Angama Mara" },
      },
    },
    {
      dayNumber: 4,
      destination: "Maasai Mara",
      country: "Kenya",
      description:
        "Optional Maasai community visit in the morning (kids love the dancing and the fire-making). Afternoon drive.",
      board: "Full board",
      highlights: ["Maasai community visit", "Kid-friendly game drives", "Swimming at camp"],
      tiers: {
        classic: { libraryName: "Angama Mara" },
        premier: { libraryName: "Angama Mara" },
        signature: { libraryName: "Angama Mara" },
      },
    },
    {
      dayNumber: 5,
      destination: "Maasai Mara",
      country: "Kenya",
      description:
        "Last Mara day. Long morning drive — save the leopards for today. Afternoon pool.",
      board: "Full board",
      tiers: {
        classic: { libraryName: "Angama Mara" },
        premier: { libraryName: "Angama Mara" },
        signature: { libraryName: "Angama Mara" },
      },
    },
    {
      dayNumber: 6,
      destination: "Watamu",
      country: "Kenya",
      subtitle: "Coast arrival",
      description:
        "Flight via Nairobi to Malindi (~3h door-to-door). Road transfer south to Watamu (~30 min). Afternoon on the beach — the reef inside the marine park keeps the water shallow and calm, perfect for kids.",
      board: "Half board",
      tiers: {
        classic: { libraryName: "Watamu lodge — pick from your library" },
        premier: { libraryName: "Watamu lodge — pick from your library" },
        signature: { libraryName: "Watamu lodge — pick from your library" },
      },
    },
    {
      dayNumber: 7,
      destination: "Watamu",
      country: "Kenya",
      description:
        "Snorkelling with green sea turtles in the Watamu Marine National Park. Kids' snorkel gear is widely available at the beach hotels.",
      board: "Half board",
      tiers: {
        classic: { libraryName: "Watamu lodge — pick from your library" },
        premier: { libraryName: "Watamu lodge — pick from your library" },
        signature: { libraryName: "Watamu lodge — pick from your library" },
      },
    },
    {
      dayNumber: 8,
      destination: "Watamu",
      country: "Kenya",
      description:
        "Local Ocean Conservation turtle hatchery visit in the morning. Free afternoon — pool or beach.",
      board: "Half board",
      tiers: {
        classic: { libraryName: "Watamu lodge — pick from your library" },
        premier: { libraryName: "Watamu lodge — pick from your library" },
        signature: { libraryName: "Watamu lodge — pick from your library" },
      },
    },
    {
      dayNumber: 9,
      destination: "Watamu",
      country: "Kenya",
      description: "Glass-bottom boat to Arabuko Sokoke Forest (optional). Final beach afternoon.",
      board: "Half board",
      tiers: {
        classic: { libraryName: "Watamu lodge — pick from your library" },
        premier: { libraryName: "Watamu lodge — pick from your library" },
        signature: { libraryName: "Watamu lodge — pick from your library" },
      },
    },
    {
      dayNumber: 10,
      destination: "Nairobi",
      country: "Kenya",
      subtitle: "Departure",
      description:
        "Morning flight via Nairobi to international departure.",
      board: "Bed & breakfast",
      tiers: {
        classic: { libraryName: "Giraffe Manor" },
        premier: { libraryName: "Giraffe Manor" },
        signature: { libraryName: "Giraffe Manor" },
      },
    },
  ],

  pricing: {
    classic: { pricePerPerson: "3,900" },
    premier: { pricePerPerson: "5,400" },
    signature: { pricePerPerson: "8,200" },
    highlighted: "premier",
    notes: "Per adult sharing; children under 12 typically pay 50-65% of the adult rate — apply when cloning.",
  },

  inclusions: STANDARD_SAFARI_INCLUSIONS,
  exclusions: STANDARD_SAFARI_EXCLUSIONS,
  practicalInfo: KENYA_PRACTICAL_INFO,
};
