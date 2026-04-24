// ─── Shared content for East-Africa templates ─────────────────────────────
//
// Every Kenya or Tanzania template shares roughly the same practical info
// and standard safari inclusions/exclusions — the differences between
// them are in the day-by-day shape, the camps, and the voice. Centralising
// boilerplate here keeps individual template files focused on what's
// actually unique to them.

export const STANDARD_SAFARI_INCLUSIONS: string[] = [
  "Private 4x4 safari vehicle with professional guide",
  "All accommodation as listed",
  "Full board on safari, bed-and-breakfast in transit cities",
  "All park and conservancy fees",
  "Internal flights between parks as detailed",
  "Airport transfers on arrival and departure",
  "Bottled water, soft drinks and local beer on safari",
  "Bush breakfasts and sundowners where noted",
];

export const STANDARD_SAFARI_EXCLUSIONS: string[] = [
  "International flights",
  "Visas (Kenya / Tanzania e-visa)",
  "Yellow-fever vaccination (where required)",
  "Travel and medical insurance",
  "Premium spirits, wines and champagnes",
  "Gratuities to driver, guides and camp staff",
  "Optional activities — hot-air balloon, community visits, spa",
];

// ─── Practical info ────────────────────────────────────────────────────────

type PracticalCardInput = { title: string; body: string; icon: string };

export const KENYA_PRACTICAL_INFO: PracticalCardInput[] = [
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
    body: "Yellow-fever certificate required if arriving from a yellow-fever country. Malaria cover recommended for all safari areas — ask your GP. Drink bottled water.",
    icon: "💉",
  },
  {
    title: "Packing",
    body: "Neutral colours on safari — no bright white, no camouflage. Layers: cool mornings, warm middays. Closed walking shoes. A soft duffel beats a hard case for bush-plane transfers (15-20kg limit).",
    icon: "🎒",
  },
  {
    title: "Climate & season",
    body: "January-March is dry, hot, and calm. July-October brings the Great Migration into the Mara. November-December is short rains; green, quiet, cheaper.",
    icon: "☀",
  },
  {
    title: "Currency & tipping",
    body: "USD widely accepted in camps; Kenyan shilling for Nairobi. Credit cards in towns. Typical tipping: $15-25 per guest per day across driver and camp staff.",
    icon: "💳",
  },
];

export const TANZANIA_PRACTICAL_INFO: PracticalCardInput[] = [
  {
    title: "Visas",
    body: "Tanzania is e-visa. Apply online at least 10 days before travel. Single-entry standard; select multi-entry if your itinerary exits and re-enters the country (e.g. via Zanzibar).",
    icon: "🛂",
  },
  {
    title: "Flights",
    body: "Most international routes land at Kilimanjaro International (JRO) for the Northern Circuit or Julius Nyerere (DAR) for the south / Zanzibar. One stop via Doha, Amsterdam, or Istanbul from most hubs.",
    icon: "✈",
  },
  {
    title: "Health",
    body: "Yellow-fever certificate required if arriving from a yellow-fever country — including layovers over 12 hours. Malaria cover recommended for all parks and the coast.",
    icon: "💉",
  },
  {
    title: "Packing",
    body: "Neutral colours on safari — no bright white, no camouflage. Soft duffel for bush-plane transfers (15kg Coastal / Auric limit). Warmer layers for Ngorongoro mornings at altitude.",
    icon: "🎒",
  },
  {
    title: "Climate & season",
    body: "January-March is dry and green (calving season in the southern Serengeti). June-October is peak — Kogatende crossings late-Jul to Sept. November-December is short rains; calm and lush.",
    icon: "☀",
  },
  {
    title: "Currency & tipping",
    body: "USD widely accepted in camps; Tanzanian shilling for towns. Tipping: $15-25 per guest per day across driver and camp staff; Zanzibar resort staff tip separately.",
    icon: "💳",
  },
];
