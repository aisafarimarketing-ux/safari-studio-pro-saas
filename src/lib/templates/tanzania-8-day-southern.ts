import type { Template } from "./types";
import { STANDARD_SAFARI_INCLUSIONS, STANDARD_SAFARI_EXCLUSIONS, TANZANIA_PRACTICAL_INFO } from "./shared";

export const TANZANIA_8_DAY_SOUTHERN: Template = {
  slug: "8-day-southern-tanzania",
  title: "8-Day Southern Tanzania — Nyerere & Ruaha",
  summary: "Off the tourist trail — hippo pools, wild-dog country, almost empty parks.",
  metaDescription:
    "An 8-day Southern Tanzania safari covering Nyerere (Selous) and Ruaha — Tanzania's quietest premier parks. Walking safaris, boat safaris, wild dogs. Day-by-day, pricing tiers, practical info.",

  countries: ["Tanzania"],
  nights: 8,
  style: "Mid-range",
  priceFromPerPerson: "7,200",

  exampleClient: { guestNames: "Jack and Rosie", adults: 2, origin: "United Kingdom" },

  cover: { tagline: "Tanzania without the crowds — Nyerere's rivers, Ruaha's predators." },

  greeting: {
    body:
      "Jack and Rosie — if the Northern Circuit feels busy, this is the answer. Four nights on Nyerere (formerly the Selous) for boat and walking safaris among hippos; four in Ruaha for raw predator density. You'll see almost no other vehicles. Tell us which tier fits.",
  },

  closing: {
    quote: "The south shows you Africa on its own scale, not the brochure's.",
    signOff:
      "Jack and Rosie — flights to Nyerere and Ruaha are lighter than the north. We soft-book fuel-and-craft a week out. Reply with any dates you're holding.",
  },

  map: { caption: "Dar es Salaam → Nyerere → Ruaha → Dar es Salaam" },

  days: [
    { dayNumber: 1, destination: "Dar es Salaam", country: "Tanzania", subtitle: "Arrival",
      description: "Land at Julius Nyerere International (DAR). Transfer to a Dar city hotel for the night.",
      board: "Bed & breakfast",
      tiers: { classic: { libraryName: "Dar hotel — pick from your library" }, premier: { libraryName: "Dar hotel — pick from your library" }, signature: { libraryName: "Dar hotel — pick from your library" } } },
    { dayNumber: 2, destination: "Nyerere", country: "Tanzania", subtitle: "Into the south",
      description: "Flight west to Nyerere (Selous) (~45 min). Afternoon boat safari on the Rufiji — hippos at 5 metres, fish eagles overhead.",
      board: "Full board",
      tiers: { classic: { libraryName: "Nyerere camp — pick from your library" }, premier: { libraryName: "Nyerere camp — pick from your library" }, signature: { libraryName: "Nyerere camp — pick from your library" } } },
    { dayNumber: 3, destination: "Nyerere", country: "Tanzania",
      description: "Walking safari at dawn — the Rufiji lake system is one of the few places you can walk legally. Boat safari in the afternoon.",
      board: "Full board",
      highlights: ["Walking safari", "Boat safari", "Hippo pools"],
      tiers: { classic: { libraryName: "Nyerere camp — pick from your library" }, premier: { libraryName: "Nyerere camp — pick from your library" }, signature: { libraryName: "Nyerere camp — pick from your library" } } },
    { dayNumber: 4, destination: "Nyerere", country: "Tanzania",
      description: "Full day drive inland for wild dog. Nyerere's dog packs are the largest remaining in East Africa.",
      board: "Full board",
      tiers: { classic: { libraryName: "Nyerere camp — pick from your library" }, premier: { libraryName: "Nyerere camp — pick from your library" }, signature: { libraryName: "Nyerere camp — pick from your library" } } },
    { dayNumber: 5, destination: "Ruaha", country: "Tanzania", subtitle: "Predator country",
      description: "Transfer flight west to Ruaha (~1h30). Afternoon drive — Ruaha has Tanzania's highest lion density, plus cheetah in the grasslands.",
      board: "Full board",
      tiers: { classic: { libraryName: "Ruaha camp — pick from your library" }, premier: { libraryName: "Ruaha camp — pick from your library" }, signature: { libraryName: "Ruaha camp — pick from your library" } } },
    { dayNumber: 6, destination: "Ruaha", country: "Tanzania",
      description: "Full day. Dawn drive for cats; brunch; afternoon along the Great Ruaha River for elephant and buffalo.",
      board: "Full board",
      tiers: { classic: { libraryName: "Ruaha camp — pick from your library" }, premier: { libraryName: "Ruaha camp — pick from your library" }, signature: { libraryName: "Ruaha camp — pick from your library" } } },
    { dayNumber: 7, destination: "Ruaha", country: "Tanzania",
      description: "Second full day. Long loop to the remoter northern sector.",
      board: "Full board",
      tiers: { classic: { libraryName: "Ruaha camp — pick from your library" }, premier: { libraryName: "Ruaha camp — pick from your library" }, signature: { libraryName: "Ruaha camp — pick from your library" } } },
    { dayNumber: 8, destination: "Dar es Salaam", country: "Tanzania", subtitle: "Departure",
      description: "Flight back to Dar, onward international departure.",
      board: "Bed & breakfast",
      tiers: { classic: { libraryName: "Dar hotel — pick from your library" }, premier: { libraryName: "Dar hotel — pick from your library" }, signature: { libraryName: "Dar hotel — pick from your library" } } },
  ],

  pricing: {
    classic: { pricePerPerson: "5,400" },
    premier: { pricePerPerson: "7,200" },
    signature: { pricePerPerson: "11,200" },
    highlighted: "premier",
    notes: "Starter library doesn't currently cover Nyerere or Ruaha camps — free-text placeholders. Swap your preferred lodges from the editor once cloned.",
  },

  inclusions: STANDARD_SAFARI_INCLUSIONS,
  exclusions: STANDARD_SAFARI_EXCLUSIONS,
  practicalInfo: TANZANIA_PRACTICAL_INFO,
};
