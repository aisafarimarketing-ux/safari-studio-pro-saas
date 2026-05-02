// ─── Token & Theme ───────────────────────────────────────────────────────────

export interface ThemeTokens {
  pageBg: string;
  sectionSurface: string;
  cardBg: string;
  accent: string;
  secondaryAccent: string;
  headingText: string;
  bodyText: string;
  mutedText: string;
  border: string;
  buttonBg: string;
  badgeBg: string;
}

export interface ProposalTheme {
  tokens: ThemeTokens;
  displayFont: string;
  bodyFont: string;
  preset: string;
}

// ─── Operator ────────────────────────────────────────────────────────────────

export interface OperatorProfile {
  companyName: string;
  consultantName: string;
  consultantPhoto?: string;
  /** Job title / role — shown under the consultant's name in closing
   *  blocks and personal notes (e.g. "Founder · Safari Specialist").
   *  Auto-populated from OrgMembership.roleTitle when the user creates
   *  a proposal; can be overridden per-proposal. */
  consultantRole?: string;
  /** Handwritten signature image — rendered above the consultant's name on
   *  the hero-letter cover variant. Optional; the name renders alone when
   *  no signature has been uploaded. */
  signatureUrl?: string;
  email: string;
  phone: string;
  whatsapp?: string;
  logoUrl?: string;
  /** Dedicated booking URL — if set, the closing section's "Confirm
   *  Booking" / "Book your Safari" CTAs link here. Falls back to
   *  website + mailto when absent. Lets operators route guests to their
   *  own reservation system (a specific form, calendar, Stripe page…)
   *  rather than an email. Full URL expected ("https://…"). */
  bookingUrl?: string;
  address?: string;
  /** Country shown as a separate row in the closing-farewell contact block
   *  (e.g. "Tanzania"). Free-form so operators can use "Kenya & Tanzania"
   *  or similar multi-country phrasings. */
  country?: string;
  website?: string;
  brandColors: { primary: string; secondary: string };
  /** Trust signals shown on the closing booking-recap variant — short
   *  one-line bullets ("Fully refundable until 60 days", "Local expert
   *  support 24/7"). Configured once on the operator profile and re-used
   *  across every proposal that picks the booking-recap layout. */
  trustBadges?: string[];
}

export const DEFAULT_TRUST_BADGES: string[] = [
  "Fully refundable up to 60 days before departure",
  "Local expert support, 24/7 on the road",
  "Hand-picked camps and lodges, no surprises",
  "Dedicated consultant from booking to return",
  "Travel-insurance partners for extra peace of mind",
];

// ─── Client ──────────────────────────────────────────────────────────────────

export interface ClientDetails {
  guestNames: string;
  email?: string;
  pax: string;
  /** Structured breakdown — optional; falls back to free-form `pax` when absent. */
  adults?: number;
  children?: number;
  /** Country of origin for the travellers (e.g. "United Kingdom", "United States"). */
  origin?: string;
  rooming?: string;
  arrivalFlight?: string;
  departureFlight?: string;
  specialOccasion?: string;
  dietary?: string;
}

// ─── Trip ────────────────────────────────────────────────────────────────────

export interface TripDetails {
  title: string;
  subtitle: string;
  /** Free-form display string, e.g. "5 – 12 July 2025". */
  dates: string;
  nights: number;
  /** ISO dates (YYYY-MM-DD), optional — set by Trip Setup, falls back to `dates`. */
  arrivalDate?: string;
  departureDate?: string;
  tripStyle?: string;
  /** Flat list of destination names — kept as the back-compat surface
   *  for older proposals + summaries (subtitle, header chips). The
   *  source of truth for itinerary structure is `stops` (below); when
   *  it's set we derive `destinations` from `stops.map(s => s.destination)`.
   *  Older proposals authored before stops existed continue to work
   *  via this flat list. */
  destinations: string[];
  /** Ordered per-destination plan — one row per stop, with explicit
   *  nights, optional pre-picked hero image (Brand DNA library URL or
   *  a sample-data URL), and optional pre-picked property per tier.
   *  When present, the autopilot route uses this list to allocate
   *  days deterministically — no AI guessing on order or pacing. */
  stops?: TripStop[];
  /** Trip pace knob — Relaxed / Balanced / Packed. Drives drive-time
   *  intensity and optional-activity volume on each day. Independent
   *  of tripStyle (luxury/mid-range/classic), which drives lodge tier. */
  pace?: TripPace;
  /** Operator-curated client-interest tags — Big 5, Birding, Cultural,
   *  Beach, Honeymoon, Hiking, Photography, Family. Drives optional
   *  activities and lodge selection bias. */
  interests?: string[];
  /** Optional pinned arrival routine (Day 1) — operator-saved standard
   *  flow ("land → transfer → welcome dinner") that the AI shouldn't
   *  override with a game-drive Day 1 on a 5pm landing. */
  arrivalRoutine?: string;
  /** Optional pinned departure routine (last day) — same idea. */
  departureRoutine?: string;
  highlights?: string;
  operatorNote?: string;
}

export type TripPace = "relaxed" | "balanced" | "packed";

export interface TripStop {
  /** Stable id so React row keys + drag-reorder work without
   *  re-keying on every keystroke. */
  id: string;
  destination: string;
  nights: number;
  /** Operator-picked hero image URL — Brand DNA library URL when
   *  matched by location tag, otherwise a sample-data URL, otherwise
   *  empty (operator hadn't set one in setup). */
  heroImageUrl?: string;
  /** Optional pre-picked property per tier. Property id (matches
   *  Property.id from the org's library). When set, autopilot uses
   *  this directly and skips its slot-pick step for that day's tier. */
  propertyByTier?: Partial<Record<TierKey, string>>;
}

// ─── Accommodation ───────────────────────────────────────────────────────────

export interface Accommodation {
  camp: string;
  location: string;
  note: string;
}

// ─── Day ─────────────────────────────────────────────────────────────────────

export interface Day {
  id: string;
  dayNumber: number;
  date?: string;
  destination: string;
  country: string;
  subtitle?: string;
  description: string;
  board: string;
  heroImageUrl?: string;
  /** CSS object-position for the hero image — operators drag the image in
   *  the editor to recompose the crop. Format: "X% Y%" (e.g. "62.5% 38%").
   *  Defaults to centered ("50% 50%") when absent. */
  heroImagePosition?: string;
  transfer?: string;
  /** How the traveller gets to the NEXT day's location. Drives the map's
   *  per-leg styling (solid line + car icon for drive, dashed curve +
   *  plane icon for flight). null / undefined falls back to a haversine
   *  distance heuristic — kept so existing proposals don't break. The
   *  last day's value is unused (no next day). */
  transportToNext?: "drive" | "flight" | null;
  /** Where to place the destination label relative to the marker on
   *  the map. "auto" lets Leaflet pick the side with most room.
   *  Operator-set when two stops are close enough that the auto-layout
   *  produces overlap. Defaults to "auto". */
  labelPosition?: "top" | "bottom" | "left" | "right" | "auto";
  highlights?: string[];
  /** Operator-curated add-ons for this day (priced extras the guest can
   *  opt into from the share view). */
  optionalActivities?: OptionalActivity[];
  /** Editorial pull-quote — the "moment of the day". Surfaces the one
   *  signature experience as a typographic hook above the narrative
   *  (e.g. "Lions hunting at dawn — reserved seats at the Sunrise
   *  Hide"). Optional; layouts hide the slot when blank. */
  momentOfDay?: string;
  /** Drive-time chip rendered ABOVE this day's card (so day 2's value
   *  describes how the traveller got from day 1 → day 2). Free-form
   *  short text like "→ 2.5 hr scenic drive · Manyara to Tarangire".
   *  Day 1 ignores this (no preceding day). */
  driveTimeBefore?: string;
  /** Per-day overrides for the flip card's image-side placement.
   *  Operator brief: "Allow editor to function the location layout
   *  and the day's accommodation separately to give different
   *  variation for the day layouts." When unset, FlipCard falls back
   *  to the section-level flip direction (Act II using the opposite
   *  side from Act I). */
  locationImageSide?: "left" | "right";
  propertyImageSide?: "left" | "right";
  /** Per-day background overrides for the flip card's two acts.
   *  Operator brief: "Day card to have editor function for both
   *  location and accommodation section separately to change layout,
   *  color and more independently." Each undefined falls back to the
   *  section-level surface (cardBg for location, propertyBg /
   *  sectionSurface for the accommodation). */
  locationBg?: string;
  propertyBgPerDay?: string;
  tiers: {
    classic: Accommodation;
    premier: Accommodation;
    signature: Accommodation;
  };
}

// ─── Optional activity (per-day add-on) ──────────────────────────────────────

export interface OptionalActivity {
  id: string;
  title: string;
  /** Where the activity takes place — e.g. "Ngorongoro Crater". */
  location?: string;
  /** When it happens — free text like "Morning", "Afternoon", "All Day". */
  timeOfDay?: string;
  description?: string;
  /** Price displayed as text (e.g. "55"), currency separate so the share
   *  view can render it consistently. */
  priceAmount?: string;
  priceCurrency?: string;
}

// ─── Property ────────────────────────────────────────────────────────────────

export interface Property {
  id: string;
  name: string;
  location: string;
  shortDesc: string;
  description: string;
  whyWeChoseThis: string;
  amenities: string[];
  mealPlan: string;
  roomType: string;
  nights: number;
  tier?: string;
  leadImageUrl?: string;
  galleryUrls: string[];
  /** Tour-operator-curated showcase fields. All optional — backfilled from
   *  the tour operator's property library ahead of the proposal and shown
   *  in PropertyShowcaseSection's STATS / ROOMS / INFORMATION tabs. */
  checkInTime?: string;
  checkOutTime?: string;
  totalRooms?: number;
  spokenLanguages?: string[];
  specialInterests?: string[];
  /** Per-property toggle for the Fun Facts block in the proposal
   *  showcase. Defaults true at the Prisma layer; treat undefined here
   *  as "true" so legacy snapshots taken before the field existed
   *  keep their current rendering. */
  funFactsVisible?: boolean;
  rooms?: PropertyRoom[];
  /** Link back to the source row in the operator's Property Library.
   *  When present, the showcase exposes a "Refresh from library"
   *  action that re-pulls the latest fields onto this snapshot
   *  (preserving the proposal's property id so day-card references
   *  keep working). undefined = legacy or hand-typed property with
   *  no library origin; the refresh pill stays hidden. */
  libraryPropertyId?: string;
  /** Boutique / Lodge / Tented Camp / etc. — rendered as an
   *  uppercase eyebrow above the property name. Sourced from the
   *  library's `propertyClass` field. */
  propertyClass?: string;
  /** "Couples", "Family-friendly", "Adventure-seekers" — small chip
   *  row in the showcase header. Sourced from library's `suitability`. */
  suitability?: string[];
  /** Free-form library blocks ("Sustainability", "Family policies",
   *  "Dietary requirements") rendered in the INFORMATION tab below
   *  the main description. The library's `visible` flag is honoured
   *  at snapshot-time; per-proposal hiding is a separate flag if
   *  added later. */
  customSections?: PropertyCustomSection[];
}

export interface PropertyCustomSection {
  id?: string;
  title: string;
  body: string;
  order: number;
}

export interface PropertyRoom {
  id: string;
  name: string;
  bedConfig?: string;
  description?: string;
  imageUrls?: string[];
}

// ─── Pricing ─────────────────────────────────────────────────────────────────

export interface TierPrice {
  pricePerPerson: string;
  currency: string;
  label: string;
  highlighted: boolean;
}

export interface PricingData {
  classic: TierPrice;
  premier: TierPrice;
  signature: TierPrice;
  notes?: string;
}

// ─── Practical Info ──────────────────────────────────────────────────────────

export interface PracticalCard {
  id: string;
  title: string;
  body: string;
  icon?: string;
}

// ─── Section ─────────────────────────────────────────────────────────────────

export type SectionType =
  | "operatorHeader"
  | "cover"
  | "personalNote"
  | "greeting"
  | "tripSummary"
  | "itineraryTable"
  | "dayJourney"
  | "propertyShowcase"
  | "pricing"
  | "inclusions"
  | "practicalInfo"
  | "closing"
  | "footer"
  | "customText"
  | "quote"
  | "gallery"
  | "divider"
  | "spacer"
  | "map";

export type StyleOverrides = Partial<ThemeTokens> & {
  padding?: string;
  maxWidth?: string;
  /** Day-card head strip background — distinct from sectionSurface so
   *  the day-cards section can colour the head row (day number / location
   *  header) independently from the body card and the section gutter.
   *  Only consumed by EditorialStackCard / FlipCard. */
  dayHeadBg?: string;
  /** Top-of-section header strip colour (the gold band at the top of
   *  Itinerary / Accommodations / Pricing / etc). Independent of
   *  sectionSurface so the strip can carry its own colour without
   *  dragging the section body with it. Consumed by SectionHeaderStrip. */
  headerBg?: string;
  /** Day-card property-act background — Act II of FlipCard (the
   *  "where you'll stay" half). Distinct from sectionSurface and
   *  cardBg so the operator can colour the property column on its
   *  own without touching the destination column. Consumed by
   *  FlipCard. */
  propertyBg?: string;
};

export interface Section {
  id: string;
  type: SectionType;
  visible: boolean;
  locked?: boolean;
  order: number;
  layoutVariant: string;
  styleOverrides: StyleOverrides;
  content: Record<string, unknown>;
}

// ─── Proposal ────────────────────────────────────────────────────────────────

export type TierKey = "classic" | "premier" | "signature";

export interface Proposal {
  id: string;
  metadata: {
    title: string;
    createdAt: string;
    updatedAt: string;
    status: "draft" | "sent" | "accepted";
  };
  operator: OperatorProfile;
  client: ClientDetails;
  trip: TripDetails;
  theme: ProposalTheme;
  activeTier: TierKey;
  visibleTiers: Record<TierKey, boolean>;
  sections: Section[];
  days: Day[];
  properties: Property[];
  pricing: PricingData;
  inclusions: string[];
  exclusions: string[];
  practicalInfo: PracticalCard[];
  /** How the whole proposal renders to the operator and the client.
   *
   *   "magazine" — single-column flow, full-width sections separated
   *                by dividers (default; what we've shipped to date).
   *   "spread"   — two-column with a sticky photograph on the left and
   *                scrolling content on the right. Same data, same
   *                editor — just a different chrome. Familiar to
   *                operators migrating from Safari Portal, plus our
   *                inline editor / AI tools / variants still apply.
   *
   * Optional + falsy → magazine (no migration needed for existing
   * proposals).
   */
  viewMode?: "magazine" | "spread";
  /** Client-selected optional activities (from the share view "Add to my
   *  itinerary" toggles). Written only in non-editor mode. */
  selectedAddOns?: SelectedAddOn[];
  /** Deposit-payment configuration for the share view. Operator toggles
   *  this in the editor; when enabled the public /p/[id] page shows a
   *  "Pay deposit" affordance backed by Paystack. Payment records live
   *  in the ProposalDeposit table, not in the proposal JSON. */
  depositConfig?: DepositConfig;
}

export interface DepositConfig {
  enabled: boolean;
  /** Deposit amount as a human-readable string ("500", "1,500"). Parsed
   *  to cents before hitting Paystack. */
  amount: string;
  currency: string;
  /** Marketing copy shown on the share view above the Pay button. */
  description?: string;
  /** Optional URL to the operator's terms and conditions; when present
   *  the share view shows a checkbox "I agree to [Terms]" next to the
   *  Pay button and records the acceptance against the deposit row. */
  termsUrl?: string;
}

export interface SelectedAddOn {
  dayId: string;
  activityId: string;
  /** ISO timestamp — ordered newest-first so the operator can see the
   *  sequence in which the guest added them. */
  selectedAt: string;
}

// ─── Quick Start Form ─────────────────────────────────────────────────────────

export interface QuickStartForm {
  guestNames: string;
  travelDates: string;
  pax: string;
  rooming: string;
  arrivalFlight: string;
  departureFlight: string;
  specialOccasion: string;
  dietary: string;
  budgetTier: TierKey;
  tripStyle: string;
  destinations: string;
  highlights: string;
  operatorNote: string;
}
