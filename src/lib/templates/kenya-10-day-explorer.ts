import type { Template } from "./types";
import { STANDARD_SAFARI_INCLUSIONS, STANDARD_SAFARI_EXCLUSIONS, KENYA_PRACTICAL_INFO } from "./shared";

export const KENYA_10_DAY_EXPLORER: Template = {
  slug: "10-day-kenya-explorer",
  title: "10-Day Kenya Explorer — Samburu, Lewa & the Mara",
  summary: "Three parks, three ecosystems, three different Kenyas.",
  metaDescription:
    "A 10-day Kenya safari across Samburu, Lewa and the Maasai Mara: arid north, conservancy Kenya, classic savannah. Day-by-day, pricing tiers, practical info. Customise and send to your clients.",

  countries: ["Kenya"],
  nights: 10,
  style: "Mid-range",
  priceFromPerPerson: "6,800",

  exampleClient: { guestNames: "Megan and David", adults: 2, origin: "Australia" },

  cover: { tagline: "Samburu's arid north, Lewa's rhino sanctuary, the Mara's cats." },

  greeting: {
    body:
      "Megan and David — this is the long, slow Kenya. Samburu for the species you don't see elsewhere (reticulated giraffe, Grevy's zebra). Lewa for the rhinos, walking, and horseback if you ride. The Mara for the closer at the end. Ten nights, four camps, three completely different ecosystems.",
  },

  closing: {
    quote: "Northern Kenya is the Kenya most first-timers miss — and always come back for.",
    signOff:
      "Megan and David — the pace here is gentler than a standard circuit. If you want to add a rest day at Lewa, or swap Samburu for Laikipia, we can reshape. Reply with thoughts.",
  },

  map: { caption: "Nairobi → Samburu → Lewa → Maasai Mara → Nairobi" },

  days: [
    {
      dayNumber: 1,
      destination: "Nairobi",
      country: "Kenya",
      subtitle: "Arrival",
      description:
        "Land at Jomo Kenyatta, transfer to Karen. Settle in, early dinner.",
      board: "Bed & breakfast",
      tiers: {
        classic: { libraryName: "Giraffe Manor" },
        premier: { libraryName: "Giraffe Manor" },
        signature: { libraryName: "Giraffe Manor" },
      },
    },
    {
      dayNumber: 2,
      destination: "Samburu",
      country: "Kenya",
      subtitle: "North to the dry country",
      description:
        "Flight to Samburu (~1h15). Landscape shifts from green to red. Afternoon drive along the Ewaso Ng'iro River — this is where the northern species live: reticulated giraffe, Grevy's zebra, gerenuk standing on hind legs.",
      board: "Full board",
      tiers: {
        classic: { libraryName: "Saruni Samburu" },
        premier: { libraryName: "Saruni Samburu" },
        signature: { libraryName: "Saruni Samburu" },
      },
    },
    {
      dayNumber: 3,
      destination: "Samburu",
      country: "Kenya",
      description:
        "Dawn drive. Midday at camp out of the sun — it hits 35°C here. Afternoon drive back along the river for elephants coming to drink.",
      board: "Full board",
      tiers: {
        classic: { libraryName: "Saruni Samburu" },
        premier: { libraryName: "Saruni Samburu" },
        signature: { libraryName: "Saruni Samburu" },
      },
    },
    {
      dayNumber: 4,
      destination: "Lewa",
      country: "Kenya",
      subtitle: "Conservancy country",
      description:
        "Short transfer flight (~30 min) to Lewa. Afternoon drive in the conservancy — Lewa holds 14% of Kenya's black rhino population in a tiny area. Sightings are near-guaranteed.",
      board: "Full board",
      tiers: {
        classic: { libraryName: "Sirikoi" },
        premier: { libraryName: "Sirikoi" },
        signature: { libraryName: "Sirikoi" },
      },
    },
    {
      dayNumber: 5,
      destination: "Lewa",
      country: "Kenya",
      description:
        "Walking safari in the morning — Lewa is one of the few conservancies where it's properly safe, and you see the small stuff vehicles miss. Optional horseback or camel ride in the afternoon.",
      board: "Full board",
      highlights: ["Walking safari", "Optional horseback riding", "Rhino tracking with conservancy rangers"],
      tiers: {
        classic: { libraryName: "Sirikoi" },
        premier: { libraryName: "Sirikoi" },
        signature: { libraryName: "Sirikoi" },
      },
    },
    {
      dayNumber: 6,
      destination: "Lewa",
      country: "Kenya",
      description:
        "Second full day. Sundowner on the escarpment at the end — Mount Kenya visible on clear evenings.",
      board: "Full board",
      tiers: {
        classic: { libraryName: "Sirikoi" },
        premier: { libraryName: "Sirikoi" },
        signature: { libraryName: "Sirikoi" },
      },
    },
    {
      dayNumber: 7,
      destination: "Maasai Mara",
      country: "Kenya",
      subtitle: "Into the savannah",
      description:
        "Flight south-west to the Mara (~1h30). Afternoon drive in the conservancy — lion density here is among Africa's highest.",
      board: "Full board",
      tiers: {
        classic: { libraryName: "Angama Mara" },
        premier: { libraryName: "Angama Mara" },
        signature: { libraryName: "Cottar's 1920s Safari Camp" },
      },
    },
    {
      dayNumber: 8,
      destination: "Maasai Mara",
      country: "Kenya",
      description:
        "Dawn drive, brunch at camp, afternoon drive. Migration months (Jul-Oct) the river crossings are the draw.",
      board: "Full board",
      tiers: {
        classic: { libraryName: "Angama Mara" },
        premier: { libraryName: "Angama Mara" },
        signature: { libraryName: "Cottar's 1920s Safari Camp" },
      },
    },
    {
      dayNumber: 9,
      destination: "Maasai Mara",
      country: "Kenya",
      description:
        "Last full day. Bush breakfast deep in the plains. Afternoon for leopards along the Oloololo Escarpment.",
      board: "Full board",
      tiers: {
        classic: { libraryName: "Angama Mara" },
        premier: { libraryName: "Angama Mara" },
        signature: { libraryName: "Cottar's 1920s Safari Camp" },
      },
    },
    {
      dayNumber: 10,
      destination: "Nairobi",
      country: "Kenya",
      subtitle: "Departure",
      description:
        "Morning drive, flight to Nairobi after lunch. International departures from that evening.",
      board: "Bed & breakfast",
      tiers: {
        classic: { libraryName: "Giraffe Manor" },
        premier: { libraryName: "Giraffe Manor" },
        signature: { libraryName: "Giraffe Manor" },
      },
    },
  ],

  pricing: {
    classic: { pricePerPerson: "4,900" },
    premier: { pricePerPerson: "6,800" },
    signature: { pricePerPerson: "10,400" },
    highlighted: "premier",
    notes: "Per person sharing, land-only. Includes three internal flights (Nairobi-Samburu-Lewa-Mara-Nairobi) — this is a fly-in itinerary.",
  },

  inclusions: STANDARD_SAFARI_INCLUSIONS,
  exclusions: STANDARD_SAFARI_EXCLUSIONS,
  practicalInfo: KENYA_PRACTICAL_INFO,
};
