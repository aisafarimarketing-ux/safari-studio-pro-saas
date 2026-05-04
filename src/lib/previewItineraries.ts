// Canonical preview itineraries — the "Exploration Mode" inventory.
//
// Operators send these BEFORE a proposal exists, in the early-
// conversation window where a client is asking "what does a typical
// safari look like?". The narratives here are deliberately:
//
//  - Real (Kenya / Tanzania circuits the operator actually runs)
//  - Concrete (named camps, real movement, specific moments)
//  - Brand-voice safe (no "stunning", "iconic", "embark on", etc. —
//    same bans we apply to AI-generated copy across the system)
//  - Slightly shorter than full proposal-day narratives — these are
//    teasers, not the final brief
//
// Stored in code for v1. When the operator wants to tune them or add
// regional variants, this file moves to a small DB table; the rest of
// the pipeline stays unchanged.

export type PreviewDay = {
  dayNumber: number;
  destination: string;
  /** One short paragraph. Reads like a sentence the operator might
   *  text from their phone — concrete, no flourish. */
  description: string;
  /** Optional. Surfaces as "Stay: …" in the formatted snippet. Drop
   *  when the day is a transit / arrival day with no anchored stay. */
  accommodation?: string;
};

export type PreviewItinerary = {
  /** Stable id used by the AI tool's enum + the AISuggestion log. */
  id: PreviewItineraryId;
  /** Operator-facing label rendered in the FollowUpPanel header
   *  ("From: 5-day safari preview · WhatsApp"). */
  label: string;
  /** Plain prose used inside the WhatsApp greeting line — gets
   *  inserted into "...what a typical {phrase} looks like". Lower-
   *  case so it reads naturally. */
  phrase: string;
  days: PreviewDay[];
};

export type PreviewItineraryId =
  | "3-day-safari"
  | "5-day-safari"
  | "7-day-safari"
  | "honeymoon-safari";

export const PREVIEW_ITINERARIES: Record<PreviewItineraryId, PreviewItinerary> = {
  "3-day-safari": {
    id: "3-day-safari",
    label: "3-day safari",
    phrase: "3-day safari",
    days: [
      {
        dayNumber: 1,
        destination: "Masai Mara",
        description:
          "Fly into the Mara from Wilson late morning, transfer to camp, and head out for the afternoon game drive within an hour of arrival. The Mara's openness pays off fast — lions, elephants, and the long-grass plains are visible the same day you land.",
        accommodation: "Riverside tented camp on the Mara River",
      },
      {
        dayNumber: 2,
        destination: "Masai Mara",
        description:
          "A full day in the reserve. Early morning drive across the central plains for cats; back to camp for a late breakfast; afternoon following the river line where elephants water and crocodiles wait below the crossings. Sundowners on the escarpment.",
        accommodation: "Riverside tented camp on the Mara River",
      },
      {
        dayNumber: 3,
        destination: "Masai Mara · Nairobi",
        description:
          "One last morning drive before the flight back to Nairobi. Lunch at a quiet hotel near the airport before the international connection. The whole circuit feels longer than it is.",
      },
    ],
  },
  "5-day-safari": {
    id: "5-day-safari",
    label: "5-day safari",
    phrase: "5-day safari",
    days: [
      {
        dayNumber: 1,
        destination: "Nairobi",
        description:
          "Arrival into JKIA, transfer to a calm hotel for the first night. A briefing over dinner so the next four days move without surprises.",
        accommodation: "Boutique hotel in the Karen suburb",
      },
      {
        dayNumber: 2,
        destination: "Masai Mara",
        description:
          "Morning flight into the Mara. Afternoon drive starts at the airstrip — guide, cooler, no transfer time wasted. Big-cat country; the edge of the migration's range depending on month.",
        accommodation: "Tented camp on the Mara River",
      },
      {
        dayNumber: 3,
        destination: "Masai Mara",
        description:
          "Full day in the reserve with a long lunch packed for the truck. River crossings if July to October; otherwise the central conservancies for cheetah, lion, and the open plains.",
        accommodation: "Tented camp on the Mara River",
      },
      {
        dayNumber: 4,
        destination: "Amboseli",
        description:
          "Bush flight south to Amboseli. Different landscape entirely — flat plains under Kilimanjaro, the largest elephant herds in East Africa, and the kind of skies that make every photograph work.",
        accommodation: "Camp near the Sinet causeway",
      },
      {
        dayNumber: 5,
        destination: "Amboseli · Nairobi",
        description:
          "A morning drive while the light's still gentle, then the flight back to Nairobi for the international connection. Five days, two parks, no driving days lost.",
      },
    ],
  },
  "7-day-safari": {
    id: "7-day-safari",
    label: "7-day safari",
    phrase: "7-day safari",
    days: [
      {
        dayNumber: 1,
        destination: "Nairobi",
        description:
          "Arrival, transfer to a quiet hotel near the park's edge. Briefing over dinner — light, useful, not rehearsed.",
        accommodation: "Boutique hotel in the Karen suburb",
      },
      {
        dayNumber: 2,
        destination: "Samburu",
        description:
          "Bush flight north into Samburu. Different country: red earth, doum palms, the special-five game (reticulated giraffe, Grevy's zebra, gerenuk, oryx, Somali ostrich) you don't see in the southern parks.",
        accommodation: "Riverside camp on the Ewaso Ng'iro",
      },
      {
        dayNumber: 3,
        destination: "Samburu",
        description:
          "Full day in the reserve. Morning drive along the river for elephants and lion; afternoon bushwalk with a Samburu guide who reads tracks the way most people read a phone.",
        accommodation: "Riverside camp on the Ewaso Ng'iro",
      },
      {
        dayNumber: 4,
        destination: "Masai Mara",
        description:
          "Cross-park flight south to the Mara. The shift in landscape from arid Samburu to the green plains is part of the experience. Afternoon game drive on arrival.",
        accommodation: "Tented camp on the Mara River",
      },
      {
        dayNumber: 5,
        destination: "Masai Mara",
        description:
          "Full day in the Mara. Optional balloon flight at dawn — the migration plains from a thousand feet, then a champagne breakfast on the grass. Long afternoon drive for cats.",
        accommodation: "Tented camp on the Mara River",
      },
      {
        dayNumber: 6,
        destination: "Masai Mara · Diani",
        description:
          "Morning drive, fly out via Wilson, then onward to the coast. Diani for two nights of decompression — turtle-friendly beach, soft palm shadow, no game-drive alarms.",
        accommodation: "Beachfront villa on Diani",
      },
      {
        dayNumber: 7,
        destination: "Diani · Nairobi",
        description:
          "A last slow morning by the water before the connection home. The pacing is deliberate — bush, then beach, then back. Most clients re-book a longer version of this.",
      },
    ],
  },
  "honeymoon-safari": {
    id: "honeymoon-safari",
    label: "honeymoon safari",
    phrase: "honeymoon safari",
    days: [
      {
        dayNumber: 1,
        destination: "Nairobi",
        description:
          "Arrival, transfer to a quiet hotel for the night. Champagne in the room, a relaxed dinner, an early start for the bush.",
        accommodation: "Boutique hotel in the Karen suburb",
      },
      {
        dayNumber: 2,
        destination: "Masai Mara",
        description:
          "Bush flight to a private conservancy. The conservancy's the difference here — the camp owns its own bit of grassland, so the drives are private vehicles, no other safari trucks at sightings, sundowners wherever the light is best.",
        accommodation: "Honeymoon tent on its own deck",
      },
      {
        dayNumber: 3,
        destination: "Masai Mara",
        description:
          "Full day in the Mara. Bush breakfast at sunrise, lunch back at camp, an afternoon drive that finishes with sundowners in a chosen spot. The whole day moves at your pace.",
        accommodation: "Honeymoon tent on its own deck",
      },
      {
        dayNumber: 4,
        destination: "Zanzibar",
        description:
          "Two flights — Mara to Nairobi, Nairobi to Zanzibar. By dinner you're on the coast, in linen, hearing the dhow boats come in.",
        accommodation: "Beach villa, plunge pool, ocean side",
      },
      {
        dayNumber: 5,
        destination: "Zanzibar",
        description:
          "Slow morning. A reef-snorkel trip by traditional boat if you want it; otherwise the beach, the pool, lunch at the villa. Nothing has to happen.",
        accommodation: "Beach villa, plunge pool, ocean side",
      },
      {
        dayNumber: 6,
        destination: "Zanzibar",
        description:
          "Optional half-day in Stone Town for the spice market and the older streets — ferry across, lunch at a rooftop, back by sundown. Or a second beach day. Both are right answers.",
        accommodation: "Beach villa, plunge pool, ocean side",
      },
      {
        dayNumber: 7,
        destination: "Zanzibar · home",
        description:
          "Late checkout, transfer to the airport, the international flight home. Most couples go quiet on the drive — that's the right kind of quiet.",
      },
    ],
  },
};

export const PREVIEW_ITINERARY_IDS: PreviewItineraryId[] = [
  "3-day-safari",
  "5-day-safari",
  "7-day-safari",
  "honeymoon-safari",
];

export function getPreviewItinerary(
  id: PreviewItineraryId | string,
): PreviewItinerary | null {
  if (id in PREVIEW_ITINERARIES) {
    return PREVIEW_ITINERARIES[id as PreviewItineraryId];
  }
  return null;
}
