// Starter library — 10 famous East African camps new operators can load
// with one click. The content is grounded in publicly-known facts about
// each property; operators are expected to edit / replace / archive.
//
// Short + plain voice, matching the same style rules the AI endpoint uses.

export type StarterProperty = {
  name: string;
  propertyClass: string;
  locationName: string;
  country: string;
  region?: string;
  shortSummary: string;
  whatMakesSpecial: string;
  whyWeChoose: string;
  amenities: string[];
  mealPlan: string;
  suggestedNights: number;
  suitability: string[];
  tags: string[];
};

export const STARTER_LIBRARY: StarterProperty[] = [
  {
    name: "Angama Mara",
    propertyClass: "lodge",
    locationName: "Maasai Mara",
    country: "Kenya",
    region: "Oloololo Escarpment",
    shortSummary: "Thirty tents on the edge of the Oloololo Escarpment, with a 1,000-foot view over the Mara Triangle.",
    whatMakesSpecial: "The view is the property. Every tent faces the same drop to the Mara plains. Beadwork studio on site, photographic workshop programme, and a resident photographer who rides with guests when asked.",
    whyWeChoose: "For first-time Mara guests who want a long horizon and a sense of scale. Not the choice if your clients want deep bush immersion — Angama is a grand hotel on a cliff, not a camp.",
    amenities: ["Infinity pool", "Spa", "Wi-Fi", "Photographic studio", "Beadwork studio", "Private dining", "Sundowner deck", "Guided walks"],
    mealPlan: "full_board",
    suggestedNights: 3,
    suitability: ["honeymoon", "first_time", "photography"],
    tags: ["luxury", "view"],
  },
  {
    name: "Cottar's 1920s Safari Camp",
    propertyClass: "tented_camp",
    locationName: "Maasai Mara",
    country: "Kenya",
    region: "Olderkesi Conservancy",
    shortSummary: "Ten canvas tents styled in 1920s colonial detail, set on a private conservancy bordering the Mara and the Serengeti.",
    whatMakesSpecial: "Cottar's family has been guiding safaris in East Africa since 1919. The conservancy means night drives, walking safaris, and four guests per vehicle — plus access to both the Mara and Serengeti when seasonal movements justify it.",
    whyWeChoose: "The classic-style camp for guests who care about heritage and guiding craft over contemporary design. Families take the bush villa; photographers stay longer than planned.",
    amenities: ["Pool", "Spa", "Library", "Private dining", "Guided walks", "Night drives", "Sundowner deck", "Kids' programme"],
    mealPlan: "full_board",
    suggestedNights: 3,
    suitability: ["families", "experienced", "photography", "small_groups"],
    tags: ["luxury", "conservancy", "heritage"],
  },
  {
    name: "Giraffe Manor",
    propertyClass: "boutique_hotel",
    locationName: "Nairobi",
    country: "Kenya",
    shortSummary: "Twelve rooms in a 1930s manor house on a suburban Nairobi reserve, home to a resident herd of Rothschild giraffes.",
    whatMakesSpecial: "The giraffes come to breakfast. They put their heads through the dining-room windows for a pellet. That is the visit — the giraffes are the brief.",
    whyWeChoose: "One-night stopover between flights, especially for families and first-time guests. Book six months out at minimum; the hotel is almost always sold out.",
    amenities: ["Wi-Fi", "Lounge", "Library", "Gardens", "Breakfast with giraffes", "Kids' programme"],
    mealPlan: "full_board",
    suggestedNights: 1,
    suitability: ["families", "first_time", "honeymoon", "kids_under_12"],
    tags: ["iconic", "city"],
  },
  {
    name: "Singita Grumeti — Sasakwa Lodge",
    propertyClass: "lodge",
    locationName: "Grumeti",
    country: "Tanzania",
    region: "Western Serengeti",
    shortSummary: "Ten Edwardian-style cottages on a hilltop above the Grumeti reserve, with private plunge pools and a polo pitch below.",
    whatMakesSpecial: "The 340,000-acre Grumeti Reserves is private. The wildebeest migration comes through May–July and again in November. Staff-to-guest ratio is high even by Singita standards.",
    whyWeChoose: "Repeat Africa guests who've done the classic Serengeti circuit and want a private-concession experience at the highest end. Not for first-timers — the price point doesn't make sense without frame of reference.",
    amenities: ["Private plunge pool", "Spa", "Wine cellar", "Library", "Gym", "Tennis", "Equestrian centre", "Private dining"],
    mealPlan: "all_inclusive",
    suggestedNights: 4,
    suitability: ["honeymoon", "experienced", "small_groups"],
    tags: ["luxury", "private-concession"],
  },
  {
    name: "Serengeti Under Canvas",
    propertyClass: "mobile_camp",
    locationName: "Serengeti",
    country: "Tanzania",
    shortSummary: "Nine tents that follow the wildebeest migration through the year, pitched in different Serengeti locations each season.",
    whatMakesSpecial: "Mobile camp in the real sense — the whole property moves four times a year to stay within an hour of the migration. Bucket showers, solar lanterns, lion calls at night.",
    whyWeChoose: "When clients ask for 'the migration' and mean it. Not a first-trip choice unless the operator prepares them — it's a working camp, not a resort.",
    amenities: ["Safari tents", "Bucket shower", "Private dining", "Guided walks", "Night drives", "Sundowner deck"],
    mealPlan: "full_board",
    suggestedNights: 3,
    suitability: ["experienced", "photography", "honeymoon"],
    tags: ["migration", "mobile"],
  },
  {
    name: "The Highlands, Ngorongoro",
    propertyClass: "lodge",
    locationName: "Ngorongoro",
    country: "Tanzania",
    region: "Olmoti volcano rim",
    shortSummary: "Eight dome-shaped suites on the Olmoti volcano rim, thirty minutes above the Ngorongoro Crater.",
    whatMakesSpecial: "The domes are warm — a real point when you're at 2,600 metres. Ngorongoro Crater descent is daily; on rest days, guided walks up Olmoti with Maasai trackers.",
    whyWeChoose: "A fresh take on the Ngorongoro base camp for guests who find the crater-rim lodges too formal. Pair with a Serengeti mobile camp for the full classic northern Tanzania loop.",
    amenities: ["Wood stove", "Spa", "Wi-Fi", "Guided walks", "Library", "Private dining", "Kids' programme"],
    mealPlan: "full_board",
    suggestedNights: 2,
    suitability: ["families", "first_time", "experienced"],
    tags: ["highlands", "crater"],
  },
  {
    name: "Chem Chem Lodge",
    propertyClass: "lodge",
    locationName: "Tarangire",
    country: "Tanzania",
    region: "Chem Chem Concession",
    shortSummary: "Eight canvas suites in a 16,000-acre private corridor between Tarangire and Lake Manyara.",
    whatMakesSpecial: "The private concession means walking, biking, and night drives — none of which you can do inside Tarangire National Park. Elephants through camp most afternoons in dry season.",
    whyWeChoose: "Right for guests who want elephants, low density, and the flexibility of a private concession without leaving the northern circuit.",
    amenities: ["Pool", "Spa", "Wi-Fi", "Guided walks", "Bikes", "Night drives", "Library", "Sundowner deck"],
    mealPlan: "full_board",
    suggestedNights: 3,
    suitability: ["honeymoon", "photography", "small_groups"],
    tags: ["concession", "elephants"],
  },
  {
    name: "Sirikoi",
    propertyClass: "lodge",
    locationName: "Lewa Wildlife Conservancy",
    country: "Kenya",
    region: "Laikipia",
    shortSummary: "Six tents, two cottages, and a family house on the Lewa Wildlife Conservancy, a UNESCO site with a 25-year rhino conservation record.",
    whatMakesSpecial: "Sirikoi is the Roberts family's home with guests in it. Rhino tracking on foot, camel rides, and helicopter picnics are all on the activity menu. Every dollar supports Lewa.",
    whyWeChoose: "For guests who want a property that feels personal and conservation-led. Perfect for a Laikipia leg before heading to the Mara.",
    amenities: ["Pool", "Spa", "Wi-Fi", "Horse riding", "Camel trekking", "Rhino tracking", "Guided walks", "Private dining"],
    mealPlan: "full_board",
    suggestedNights: 3,
    suitability: ["families", "experienced", "photography", "small_groups"],
    tags: ["conservancy", "rhino"],
  },
  {
    name: "Saruni Samburu",
    propertyClass: "lodge",
    locationName: "Samburu",
    country: "Kenya",
    region: "Kalama Conservancy",
    shortSummary: "Six open-fronted villas on a kopje above the Kalama Conservancy, a community-owned reserve neighbouring Samburu National Reserve.",
    whatMakesSpecial: "Samburu guiding — reticulated giraffe, Grevy's zebra, Beisa oryx, the northern Kenya 'special five' that don't live further south. Cultural time with Samburu warriors is part of most itineraries here.",
    whyWeChoose: "When the brief is 'not the Mara' and the guest has the flexibility for a third country-ish leg. Low guest numbers, high variety.",
    amenities: ["Pool", "Spa", "Wi-Fi", "Guided walks", "Cultural visits", "Night drives", "Library", "Sundowner deck"],
    mealPlan: "full_board",
    suggestedNights: 3,
    suitability: ["honeymoon", "experienced", "photography"],
    tags: ["conservancy", "cultural"],
  },
  {
    name: "Mnemba Island Lodge",
    propertyClass: "boutique_hotel",
    locationName: "Zanzibar",
    country: "Tanzania",
    region: "Mnemba Atoll",
    shortSummary: "Twelve bandas on a private island off the north-east coast of Zanzibar, rebuilt by &Beyond with a new conservation brief.",
    whatMakesSpecial: "The whole atoll is a marine reserve. Snorkelling from the beach. Sea turtles nest on the island. Resident conservation team runs regular releases that guests join.",
    whyWeChoose: "The post-safari finale. Perfect for a three-to-four night decompression after a northern circuit or Mara trip.",
    amenities: ["Beach", "Snorkelling", "Diving", "Spa", "Private dining", "Library", "Kids' programme", "Marine conservation activities"],
    mealPlan: "all_inclusive",
    suggestedNights: 4,
    suitability: ["honeymoon", "families", "first_time"],
    tags: ["beach", "island", "conservation"],
  },
];
