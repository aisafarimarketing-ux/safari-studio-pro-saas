import type { Template } from "./types";
import { STANDARD_SAFARI_INCLUSIONS, STANDARD_SAFARI_EXCLUSIONS, KENYA_PRACTICAL_INFO } from "./shared";

export const KENYA_5_DAY_EXPRESS: Template = {
  slug: "5-day-kenya-express",
  title: "5-Day Kenya Express — Maasai Mara",
  summary: "A long weekend's worth of time, a full week's worth of sightings.",
  metaDescription:
    "A 5-day Kenya safari focused on the Maasai Mara: big cats, migration window, four nights in the game. Day-by-day, pricing tiers, practical info. Customise and send to your clients.",

  countries: ["Kenya"],
  nights: 5,
  style: "Mid-range",
  priceFromPerPerson: "3,400",

  exampleClient: { guestNames: "Chris and Alex", adults: 2, origin: "United States" },

  cover: { tagline: "Five nights, one park, the Mara at its fullest." },

  greeting: {
    body:
      "Chris and Alex — welcome to the most efficient safari in Kenya. Four nights on the Mara gives you two dawn drives, two dusk drives, two full game days. Plenty of time to watch instead of race. We've picked camps that match your pace; tell us which tier fits.",
  },

  closing: {
    quote: "Short stays leave the Mara; the Mara never leaves.",
    signOff:
      "Chris and Alex — this is deliberately compact. If you'd rather add a second park at either end, we can swing via Nakuru or Amboseli in a day. Reply and we'll reshape.",
  },

  map: { caption: "Nairobi → Maasai Mara → Nairobi" },

  days: [
    {
      dayNumber: 1,
      destination: "Nairobi",
      country: "Kenya",
      subtitle: "Arrival",
      description:
        "Land at Jomo Kenyatta. Transfer to Karen for a short night — leafy suburb, quiet, a few minutes from the domestic airstrip you fly out of in the morning.",
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
        "Morning flight (~45 min) from Wilson Airport. Land on a dirt strip, meet your guide, game drive straight to camp through open grass. Afternoon drive once the heat drops.",
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
        "Full day on the plains. Dawn drive for the cats; back for brunch; afternoon drive at low sun. In migration months (July-October) the river crossings are the reason you came.",
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
        "Last full day. Dawn balloon flight optional (add-on, book ahead). Afternoon for leopards along the Oloololo Escarpment — density is among the highest on the continent.",
      board: "Full board",
      tiers: {
        classic: { libraryName: "Angama Mara" },
        premier: { libraryName: "Angama Mara" },
        signature: { libraryName: "Cottar's 1920s Safari Camp" },
      },
    },
    {
      dayNumber: 5,
      destination: "Nairobi",
      country: "Kenya",
      subtitle: "Departure",
      description:
        "Short morning drive. Late-morning flight back to Nairobi — usually lands by 12:30. International departures that evening; day-room options at a city hotel if your flight is late.",
      board: "Bed & breakfast",
      tiers: {
        classic: { libraryName: "Giraffe Manor" },
        premier: { libraryName: "Giraffe Manor" },
        signature: { libraryName: "Giraffe Manor" },
      },
    },
  ],

  pricing: {
    classic: { pricePerPerson: "2,600" },
    premier: { pricePerPerson: "3,400" },
    signature: { pricePerPerson: "5,200" },
    highlighted: "premier",
    notes: "Per person sharing, land-only. Sample camps; swap freely from your library.",
  },

  inclusions: STANDARD_SAFARI_INCLUSIONS,
  exclusions: STANDARD_SAFARI_EXCLUSIONS,
  practicalInfo: KENYA_PRACTICAL_INFO,
};
