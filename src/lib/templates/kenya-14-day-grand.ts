import type { Template } from "./types";
import { STANDARD_SAFARI_INCLUSIONS, STANDARD_SAFARI_EXCLUSIONS, KENYA_PRACTICAL_INFO } from "./shared";

export const KENYA_14_DAY_GRAND: Template = {
  slug: "14-day-grand-kenya",
  title: "14-Day Grand Kenya — Amboseli, Mara, Samburu, Lewa & Coast",
  summary: "Fourteen nights, five landscapes, every Kenya worth knowing.",
  metaDescription:
    "A 14-day Grand Kenya safari: Amboseli's elephants, the Maasai Mara, Samburu's dry north, Lewa's rhinos, and the Indian Ocean. Day-by-day, pricing tiers, practical info.",

  countries: ["Kenya"],
  nights: 14,
  style: "Luxury",
  priceFromPerPerson: "14,800",

  exampleClient: { guestNames: "The Takahashi Family", adults: 2, children: 1, origin: "Japan" },

  cover: { tagline: "Every Kenya in one trip — fourteen nights to see why people come back." },

  greeting: {
    body:
      "Takahashi family — this is Kenya deep. Kilimanjaro from Amboseli, lion country on the Mara, red earth in Samburu, rhino at Lewa, and a closing week at the ocean. Every transition is by air. Tell us which tier fits your pace.",
  },

  closing: {
    quote: "Kenya is many countries stacked on top of each other. Fourteen nights gets you to most of them.",
    signOff:
      "Takahashi family — the second week drops the pace considerably. If you'd rather front-load the beach or back-load the bush, we can rebalance. Reply with any thoughts.",
  },

  map: { caption: "Nairobi → Amboseli → Mara → Samburu → Lewa → Coast → Nairobi" },

  days: [
    { dayNumber: 1, destination: "Nairobi", country: "Kenya", subtitle: "Arrival",
      description: "Land at Jomo Kenyatta, transfer to Karen.",
      board: "Bed & breakfast",
      tiers: { classic: { libraryName: "Giraffe Manor" }, premier: { libraryName: "Giraffe Manor" }, signature: { libraryName: "Giraffe Manor" } } },
    { dayNumber: 2, destination: "Amboseli", country: "Kenya", subtitle: "Under Kilimanjaro",
      description: "Flight to Amboseli. Afternoon drive through the swamps for elephants — the view here is the mountain.",
      board: "Full board",
      tiers: { classic: { libraryName: "Ol Tukai Lodge" }, premier: { libraryName: "Tortilis Camp" }, signature: { libraryName: "Tortilis Camp" } } },
    { dayNumber: 3, destination: "Amboseli", country: "Kenya",
      description: "Full day. Dawn drive for Kilimanjaro before the cloud builds.",
      board: "Full board",
      tiers: { classic: { libraryName: "Ol Tukai Lodge" }, premier: { libraryName: "Tortilis Camp" }, signature: { libraryName: "Tortilis Camp" } } },
    { dayNumber: 4, destination: "Maasai Mara", country: "Kenya", subtitle: "Into the savannah",
      description: "Transfer flight to the Mara. Afternoon drive.",
      board: "Full board",
      tiers: { classic: { libraryName: "Angama Mara" }, premier: { libraryName: "Angama Mara" }, signature: { libraryName: "Cottar's 1920s Safari Camp" } } },
    { dayNumber: 5, destination: "Maasai Mara", country: "Kenya",
      description: "Full Mara day. Dawn cats, bush breakfast, dusk leopards.",
      board: "Full board",
      tiers: { classic: { libraryName: "Angama Mara" }, premier: { libraryName: "Angama Mara" }, signature: { libraryName: "Cottar's 1920s Safari Camp" } } },
    { dayNumber: 6, destination: "Maasai Mara", country: "Kenya",
      description: "Second Mara day. Migration crossings in season.",
      board: "Full board",
      tiers: { classic: { libraryName: "Angama Mara" }, premier: { libraryName: "Angama Mara" }, signature: { libraryName: "Cottar's 1920s Safari Camp" } } },
    { dayNumber: 7, destination: "Samburu", country: "Kenya", subtitle: "The dry north",
      description: "Flight to Samburu. Afternoon drive — reticulated giraffe, Grevy's zebra, gerenuk.",
      board: "Full board",
      tiers: { classic: { libraryName: "Saruni Samburu" }, premier: { libraryName: "Saruni Samburu" }, signature: { libraryName: "Saruni Samburu" } } },
    { dayNumber: 8, destination: "Samburu", country: "Kenya",
      description: "Full day. Cool dawn drive along the Ewaso Ng'iro. Hot midday at camp.",
      board: "Full board",
      tiers: { classic: { libraryName: "Saruni Samburu" }, premier: { libraryName: "Saruni Samburu" }, signature: { libraryName: "Saruni Samburu" } } },
    { dayNumber: 9, destination: "Lewa", country: "Kenya", subtitle: "Rhino country",
      description: "Short flight to Lewa. Walking safari in the afternoon.",
      board: "Full board",
      tiers: { classic: { libraryName: "Sirikoi" }, premier: { libraryName: "Sirikoi" }, signature: { libraryName: "Sirikoi" } } },
    { dayNumber: 10, destination: "Lewa", country: "Kenya",
      description: "Full day. Horseback or camel optional. Rhino tracking with the rangers.",
      board: "Full board",
      tiers: { classic: { libraryName: "Sirikoi" }, premier: { libraryName: "Sirikoi" }, signature: { libraryName: "Sirikoi" } } },
    { dayNumber: 11, destination: "Diani", country: "Kenya", subtitle: "The coast",
      description: "Flight via Nairobi to Mombasa, transfer south to Diani. Afternoon in the water.",
      board: "Half board",
      tiers: { classic: { libraryName: "Beach lodge — pick from your library" }, premier: { libraryName: "Beach lodge — pick from your library" }, signature: { libraryName: "Beach lodge — pick from your library" } } },
    { dayNumber: 12, destination: "Diani", country: "Kenya",
      description: "Beach day. Kite surfing or dhow sailing.",
      board: "Half board",
      tiers: { classic: { libraryName: "Beach lodge — pick from your library" }, premier: { libraryName: "Beach lodge — pick from your library" }, signature: { libraryName: "Beach lodge — pick from your library" } } },
    { dayNumber: 13, destination: "Diani", country: "Kenya",
      description: "Beach day. Kisite Marine Park dolphin trip optional.",
      board: "Half board",
      tiers: { classic: { libraryName: "Beach lodge — pick from your library" }, premier: { libraryName: "Beach lodge — pick from your library" }, signature: { libraryName: "Beach lodge — pick from your library" } } },
    { dayNumber: 14, destination: "Nairobi", country: "Kenya", subtitle: "Departure",
      description: "Road transfer to Mombasa, flight to Nairobi, international departure.",
      board: "Bed & breakfast",
      tiers: { classic: { libraryName: "Giraffe Manor" }, premier: { libraryName: "Giraffe Manor" }, signature: { libraryName: "Giraffe Manor" } } },
  ],

  pricing: {
    classic: { pricePerPerson: "10,200" },
    premier: { pricePerPerson: "14,800" },
    signature: { pricePerPerson: "22,400" },
    highlighted: "premier",
    notes: "Five internal flights (all land-to-land hops by air). Coast leg assumes half-board resort pricing — swap your preferred property from the editor.",
  },

  inclusions: STANDARD_SAFARI_INCLUSIONS,
  exclusions: STANDARD_SAFARI_EXCLUSIONS,
  practicalInfo: KENYA_PRACTICAL_INFO,
};
