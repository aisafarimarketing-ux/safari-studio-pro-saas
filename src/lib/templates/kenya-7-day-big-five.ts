import type { Template } from "./types";
import { STANDARD_SAFARI_INCLUSIONS, STANDARD_SAFARI_EXCLUSIONS, KENYA_PRACTICAL_INFO } from "./shared";

export const KENYA_7_DAY_BIG_FIVE: Template = {
  slug: "7-day-kenya-big-five",
  title: "7-Day Kenya Big Five — Nakuru, Naivasha & the Mara",
  summary: "Rhinos on Nakuru's shore, hippos on Naivasha, big cats on the Mara.",
  metaDescription:
    "A 7-day Kenya safari built to tick every Big Five box: Lake Nakuru for rhino, Lake Naivasha for birdlife, Maasai Mara for cats. Day-by-day, pricing tiers, practical info. Customise and send.",

  countries: ["Kenya"],
  nights: 7,
  style: "Mid-range",
  priceFromPerPerson: "4,600",

  exampleClient: { guestNames: "The Patel Family", adults: 2, children: 2, origin: "United Kingdom" },

  cover: { tagline: "Three lakes and a savannah — Kenya's full cast in seven days." },

  greeting: {
    body:
      "The Patel Family — this is Kenya for completionists. Rhino country at Nakuru, hippos and fish eagles on Naivasha, and four nights on the Maasai Mara for the rest. The days are long but paced; bush breakfasts and brunch stops are built in. Tell us which tier fits.",
  },

  closing: {
    quote: "The rift lakes and the Mara sit forty minutes apart by air — and forty years apart in temperament.",
    signOff:
      "The Patels — if the kids want to swap a game drive for horseback at Naivasha, or extend the Mara by a night, we can move the pieces. Reply and we'll update.",
  },

  map: { caption: "Nairobi → Lake Nakuru → Lake Naivasha → Maasai Mara → Nairobi" },

  days: [
    {
      dayNumber: 1,
      destination: "Nairobi",
      country: "Kenya",
      subtitle: "Arrival",
      description:
        "Land at Jomo Kenyatta, transfer to Karen. Early night — the road start the next morning is an early one.",
      board: "Bed & breakfast",
      tiers: {
        classic: { libraryName: "Giraffe Manor" },
        premier: { libraryName: "Giraffe Manor" },
        signature: { libraryName: "Giraffe Manor" },
      },
    },
    {
      dayNumber: 2,
      destination: "Lake Nakuru",
      country: "Kenya",
      subtitle: "Rhino country",
      description:
        "Four-hour drive north-west through the Rift Valley escarpment. Afternoon game drive — Nakuru is one of Kenya's two best parks for both black and white rhino. Flamingos on the lake edge when water levels cooperate.",
      board: "Full board",
      tiers: {
        classic: { libraryName: "Sarova Lion Hill Game Lodge" },
        premier: { libraryName: "Sarova Lion Hill Game Lodge" },
        signature: { libraryName: "Sarova Lion Hill Game Lodge" },
      },
    },
    {
      dayNumber: 3,
      destination: "Lake Naivasha",
      country: "Kenya",
      description:
        "Morning in Nakuru for a final rhino search. Midday drive ninety minutes south-east to Naivasha. Afternoon boat on the lake — hippos at close quarters, African fish eagles diving.",
      board: "Full board",
      tiers: {
        classic: { libraryName: "Loldia House" },
        premier: { libraryName: "Loldia House" },
        signature: { libraryName: "Chui Lodge" },
      },
    },
    {
      dayNumber: 4,
      destination: "Maasai Mara",
      country: "Kenya",
      subtitle: "Into lion country",
      description:
        "Morning drive to the Naivasha airstrip. Flight west to the Mara (~1 hour). Afternoon game drive from camp — the change from lake to savannah is immediate. Cats are the story.",
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
        "Full day in the Mara. Dawn drive for kills; brunch at camp; afternoon drive along the Mara River. Migration months bring the river crossings; outside those, resident game is world-class every week.",
      board: "Full board",
      tiers: {
        classic: { libraryName: "Angama Mara" },
        premier: { libraryName: "Angama Mara" },
        signature: { libraryName: "Cottar's 1920s Safari Camp" },
      },
    },
    {
      dayNumber: 6,
      destination: "Maasai Mara",
      country: "Kenya",
      description:
        "Last full day. Bush breakfast in the field. Afternoon for the Oloololo Escarpment leopards — take the long loop out if time allows.",
      board: "Full board",
      tiers: {
        classic: { libraryName: "Angama Mara" },
        premier: { libraryName: "Angama Mara" },
        signature: { libraryName: "Cottar's 1920s Safari Camp" },
      },
    },
    {
      dayNumber: 7,
      destination: "Nairobi",
      country: "Kenya",
      subtitle: "Departure",
      description:
        "Final morning game drive. Flight to Nairobi after lunch. Day rooms at a city hotel if your international departure is late.",
      board: "Bed & breakfast",
      tiers: {
        classic: { libraryName: "Giraffe Manor" },
        premier: { libraryName: "Giraffe Manor" },
        signature: { libraryName: "Giraffe Manor" },
      },
    },
  ],

  pricing: {
    classic: { pricePerPerson: "3,400" },
    premier: { pricePerPerson: "4,600" },
    signature: { pricePerPerson: "7,200" },
    highlighted: "premier",
    notes: "Per person sharing, land-only. The road leg from Nairobi to Nakuru is scenic but long — fly-ins are available as an upgrade.",
  },

  inclusions: STANDARD_SAFARI_INCLUSIONS,
  exclusions: STANDARD_SAFARI_EXCLUSIONS,
  practicalInfo: KENYA_PRACTICAL_INFO,
};
