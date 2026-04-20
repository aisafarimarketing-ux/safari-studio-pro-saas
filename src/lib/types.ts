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
  /** Handwritten signature image — rendered above the consultant's name on
   *  the hero-letter cover variant. Optional; the name renders alone when
   *  no signature has been uploaded. */
  signatureUrl?: string;
  email: string;
  phone: string;
  whatsapp?: string;
  logoUrl?: string;
  address?: string;
  /** Country shown as a separate row in the closing-farewell contact block
   *  (e.g. "Tanzania"). Free-form so operators can use "Kenya & Tanzania"
   *  or similar multi-country phrasings. */
  country?: string;
  website?: string;
  brandColors: { primary: string; secondary: string };
}

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
  destinations: string[];
  highlights?: string;
  operatorNote?: string;
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
  transfer?: string;
  highlights?: string[];
  /** Operator-curated add-ons for this day (priced extras the guest can
   *  opt into from the share view). */
  optionalActivities?: OptionalActivity[];
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
  rooms?: PropertyRoom[];
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
  /** Client-selected optional activities (from the share view "Add to my
   *  itinerary" toggles). Written only in non-editor mode. */
  selectedAddOns?: SelectedAddOn[];
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
