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
  email: string;
  phone: string;
  whatsapp?: string;
  logoUrl?: string;
  address?: string;
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
  tiers: {
    classic: Accommodation;
    premier: Accommodation;
    signature: Accommodation;
  };
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
