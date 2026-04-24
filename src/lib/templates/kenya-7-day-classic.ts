import type { Template } from "./types";

// ─── 7-Day Kenya Classic — Amboseli & Maasai Mara ───────────────────────────
//
// Canonical first-timer shape: Nairobi arrival → Amboseli (Kilimanjaro,
// elephants) → Maasai Mara (big cats, migration window) → Nairobi out.
// The highest-volume EA safari search — "7 day kenya safari" and close
// variants. Mid-range as the highlighted tier.

export const KENYA_7_DAY_CLASSIC: Template = {
  slug: "7-day-kenya-classic",
  title: "7-Day Kenya Classic — Amboseli & Maasai Mara",
  summary: "Seven nights across Amboseli and the Mara — two weeks of scenery in a week.",
  metaDescription:
    "A proven 7-day Kenya safari itinerary: Amboseli's elephants and Kilimanjaro views, then the Maasai Mara's lion country. Day-by-day, pricing tiers, practical info. Customise and send to your clients.",

  countries: ["Kenya"],
  nights: 7,
  style: "Mid-range",
  priceFromPerPerson: "4,800",

  exampleClient: {
    guestNames: "Sarah and James",
    adults: 2,
    origin: "United Kingdom",
    specialOccasion: "First safari",
  },

  cover: {
    tagline: "Two parks, seven nights, the Kenya most visitors hope to see.",
  },

  greeting: {
    body:
      "Sarah and James — welcome to the shape of a first Kenya safari. Seven nights across Amboseli and the Maasai Mara: two weeks' worth of scenery in a week. Our job is to get you to the right place at the right time of day. Tell us which of the three tiers fits, any dates that might move, and we'll hold space.",
  },

  closing: {
    quote: "The Mara teaches you to watch instead of wait.",
    signOff:
      "Sarah and James — this is the canonical East-African first-timer. Every sentence can change; the only fixed points are the two parks and the days needed to do them well. Reply with any thoughts and we'll update.",
  },

  map: {
    caption: "Nairobi → Amboseli → Maasai Mara → Nairobi",
  },

  days: [
    {
      dayNumber: 1,
      destination: "Nairobi",
      country: "Kenya",
      subtitle: "Arrival",
      description:
        "Your driver meets you at Jomo Kenyatta International. Transfer forty minutes to Karen — leafy suburb of Nairobi, colonial bones, now green. Settle in, shake off the flight. Evening is yours.",
      board: "Bed & breakfast",
      tiers: {
        classic:   { libraryName: "Giraffe Manor" },
        premier:   { libraryName: "Giraffe Manor" },
        signature: { libraryName: "Giraffe Manor" },
      },
    },
    {
      dayNumber: 2,
      destination: "Amboseli",
      country: "Kenya",
      subtitle: "Under Kilimanjaro",
      description:
        "A one-hour flight south-east to Amboseli's dirt strip. The view is Kilimanjaro from the window — on a clear day the mountain fills the frame. Afternoon game drive through the park's swamps; elephants here are famous for their scale.",
      board: "Full board",
      tiers: {
        classic:   { libraryName: "Ol Tukai Lodge" },
        premier:   { libraryName: "Tortilis Camp" },
        signature: { libraryName: "Tortilis Camp", note: "Book the private house if available" },
      },
    },
    {
      dayNumber: 3,
      destination: "Amboseli",
      country: "Kenya",
      description:
        "Full day in the park. Morning drive when the cats are moving; back for brunch; afternoon drive at low sun when the dust is gold. Amboseli is the only park in Kenya where elephants walk with Kilimanjaro behind them. You do this.",
      board: "Full board",
      tiers: {
        classic:   { libraryName: "Ol Tukai Lodge" },
        premier:   { libraryName: "Tortilis Camp" },
        signature: { libraryName: "Tortilis Camp" },
      },
    },
    {
      dayNumber: 4,
      destination: "Maasai Mara",
      country: "Kenya",
      subtitle: "Into lion country",
      description:
        "Morning game drive, then a short flight north-west to the Mara. The landscape changes immediately — Amboseli's acacia bush opens into savannah grass. Afternoon drive in the conservancy; lion density here is among the highest in Africa.",
      board: "Full board",
      tiers: {
        classic:   { libraryName: "Angama Mara" },
        premier:   { libraryName: "Angama Mara" },
        signature: { libraryName: "Cottar's 1920s Safari Camp" },
      },
    },
    {
      dayNumber: 5,
      destination: "Maasai Mara",
      country: "Kenya",
      description:
        "Full day on the plains. Long breakfast picnics in the bush. This is classic Mara — river crossings if your dates fall in the migration window (July-October), resident game every month. Optional visit to a Maasai community; book ahead.",
      board: "Full board",
      highlights: ["Big-cat tracking with your guide", "Bush breakfast", "Optional Maasai community visit"],
      tiers: {
        classic:   { libraryName: "Angama Mara" },
        premier:   { libraryName: "Angama Mara" },
        signature: { libraryName: "Cottar's 1920s Safari Camp" },
      },
    },
    {
      dayNumber: 6,
      destination: "Maasai Mara",
      country: "Kenya",
      description:
        "Last full day. Some guests take a dawn hot-air balloon flight over the Mara Triangle — optional add-on, book at least a week ahead. Afternoon is for the leopards: the Oloololo Escarpment has some of the best sightings on the continent.",
      board: "Full board",
      tiers: {
        classic:   { libraryName: "Angama Mara" },
        premier:   { libraryName: "Angama Mara" },
        signature: { libraryName: "Cottar's 1920s Safari Camp" },
      },
    },
    {
      dayNumber: 7,
      destination: "Nairobi",
      country: "Kenya",
      subtitle: "Departure",
      description:
        "Morning game drive. Light lunch back at camp. Afternoon flight to Nairobi — usually lands by 3pm. Onward international departures fly that evening; day rooms at a Nairobi hotel are available if your flight is late. Your driver handles the airport transfer.",
      board: "Bed & breakfast",
      tiers: {
        classic:   { libraryName: "Giraffe Manor" },
        premier:   { libraryName: "Giraffe Manor" },
        signature: { libraryName: "Giraffe Manor" },
      },
    },
  ],

  pricing: {
    classic:   { pricePerPerson: "3,400" },
    premier:   { pricePerPerson: "4,800" },
    signature: { pricePerPerson: "7,200" },
    highlighted: "premier",
    notes: "Per person sharing, land-only. Sample camps shown; swap freely from your library. Valid outside migration-window premium dates.",
  },

  inclusions: [
    "Private 4x4 safari vehicle with professional guide",
    "All accommodation as listed",
    "Full board on safari, bed-and-breakfast in Nairobi",
    "All park and conservancy fees",
    "Return flights Nairobi ⇄ Amboseli ⇄ Maasai Mara ⇄ Nairobi",
    "Airport transfers on arrival and departure",
    "Bottled water, soft drinks and local beer on safari",
    "Bush breakfasts and sundowners where noted",
  ],

  exclusions: [
    "International flights to Nairobi",
    "Kenya e-visa",
    "Yellow-fever vaccination (where required)",
    "Travel and medical insurance",
    "Premium spirits, wines and champagnes",
    "Gratuities to driver, guides and camp staff",
    "Optional activities — hot-air balloon, Maasai community visit",
  ],

  practicalInfo: [
    {
      title: "Visas",
      body: "Kenya is e-visa. Apply online at least 7 days before travel. Single-entry standard; the East Africa Tourist Visa covers Kenya / Uganda / Rwanda on one document if you're combining.",
      icon: "🛂",
    },
    {
      title: "Flights",
      body: "Direct flights from London to Nairobi run nightly (~8 hours). Most international hubs connect via Amsterdam, Doha, or Dubai. Arrival terminal is Jomo Kenyatta International.",
      icon: "✈",
    },
    {
      title: "Health",
      body: "Yellow-fever certificate required if arriving from a yellow-fever country. Malaria cover recommended for Mara and Amboseli — ask your GP about options. Drink bottled water.",
      icon: "💉",
    },
    {
      title: "Packing",
      body: "Neutral colours on safari — no bright white, no camouflage. Layers: cool mornings, warm middays. Closed walking shoes. A soft duffel beats a hard case for bush-plane transfers (15-20kg limit).",
      icon: "🎒",
    },
    {
      title: "Climate & season",
      body: "January-March is dry, hot, and calm — good for Amboseli. July-October brings the Great Migration into the Mara. November-December is short rains; green, quiet, cheaper.",
      icon: "☀",
    },
    {
      title: "Currency & tipping",
      body: "USD widely accepted in camps; Kenyan shilling for Nairobi. Credit cards in towns. Typical tipping: $15-25 per guest per day across driver and camp staff.",
      icon: "💳",
    },
  ],
};
