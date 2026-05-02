// ─── Day Card — canonical data model ──────────────────────────────────────
//
// Single source of truth for every day card layout. Whatever the stored Day
// looks like (tiers, free-text fields, property references by name), the
// resolver flattens it into this shape so the five layout components can
// stay purely presentational.
//
// Missing or null values are handled by the layouts, which fall back to
// polished placeholders — never broken UI.

import type {
  Day,
  Property,
  Proposal,
  TierKey,
  ThemeTokens,
  ProposalTheme,
  OptionalActivity,
} from "@/lib/types";

// Day card layouts:
//   - editorial-stack — single-column magazine (default, vertical flow)
//   - right-flip      — image on the right, narrative on the left
//   - left-flip       — image on the left, narrative on the right
//   - trip-flip       — alternates per day (odd → right, even → left).
//                       Selected at the section level; the resolver picks
//                       right-flip or left-flip per card based on day
//                       index, so each individual card is still consistent.
//   - auto            — legacy alias resolving to editorial-stack.
export type DayCardLayoutVariant =
  | "auto"
  | "editorial-stack"
  | "right-flip"
  | "left-flip"
  | "trip-flip";

export type ResolvedProperty = {
  id: string;
  name: string;
  location: string;
  summary: string;
  highlights: string[];
  leadImageUrl: string | null;
  galleryUrls: string[];
};

export type DayCardData = {
  // Identity
  dayId: string;
  dayNumber: number;
  /** Formatted calendar date for this day, derived from proposal.trip.arrivalDate
   *  + (dayNumber - 1) — e.g. "Mon 12 Aug". Null when no arrival date is set. */
  dayDate: string | null;

  // Place + phase
  destinationName: string;
  destinationCountry: string;
  phaseLabel: string;           // day.subtitle — "Arrival", "Full-day safari", etc.
  boardBasis: string;

  // Narrative
  narrative: string;
  highlights: string[];         // up to 3

  // Imagery
  destinationImageUrl: string | null;  // day.heroImageUrl
  /** Object-position for the destination hero, set when the operator
   *  drags the image to recompose the crop. */
  destinationImagePosition: string | null;

  // Editorial pull-quote — surfaces the one signature experience of the
  // day as a typographic moment above the narrative. Optional.
  momentOfDay: string;

  // Property
  property: ResolvedProperty | null;

  // Priced optional activities for this day (the upsell column).
  optionalActivities: OptionalActivity[];

  // Layout hint set by the editor
  layoutVariant: DayCardLayoutVariant;

  /** Per-day flip override for the location act (left = image left,
   *  right = image right). Layouts fall back to the section-level
   *  flip when undefined. */
  locationImageSide?: "left" | "right";
  /** Per-day flip override for the property act. Falls back to the
   *  opposite of the section-level flip when undefined. */
  propertyImageSide?: "left" | "right";
  /** Per-day background override for the location act. Falls back to
   *  cardBg when undefined. */
  locationBg?: string;
  /** Per-day background override for the property act. Falls back to
   *  the section-level propertyBg / sectionSurface when undefined. */
  propertyBgPerDay?: string;
};

// Shared props every layout component accepts. Layouts never touch the
// store directly — they call back through these handlers.
export type DayCardLayoutProps = {
  data: DayCardData;
  isEditor: boolean;
  tokens: ThemeTokens;
  theme: ProposalTheme;
  activeTier: TierKey;
  /** Operator-picked override for the day-card head strip background.
   *  When unset, layouts fall back to `tokens.sectionSurface`. */
  dayHeadBg?: string;
  /** Operator-picked override for the property-act background (Act II
   *  of FlipCard). Falls back to `tokens.sectionSurface` when unset. */
  propertyBg?: string;

  // Text editing (reusing contentEditable pattern with data-ai-editable)
  onDestinationChange: (next: string) => void;
  onPhaseLabelChange: (next: string) => void;
  onNarrativeChange: (next: string) => void;
  onBoardChange: (next: string) => void;
  /** Edit the editorial pull-quote that surfaces above the narrative. */
  onMomentOfDayChange: (next: string) => void;

  // Image actions — destination hero
  onDestinationImageUpload: (file: File) => void;
  onDestinationImagePickerOpen: () => void;
  /** Persists a new object-position when the operator drags the hero. */
  onDestinationImagePositionChange: (next: string) => void;

  // Property actions
  onOpenPropertyPicker: () => void;
  onPropertyImageUpload: (file: File) => void;  // replaces property.leadImageUrl

  // Per-act editor callbacks. FlipCard surfaces them as a hover-
  // revealed chrome inside each act so operators can edit the
  // location and accommodation halves independently. Optional so
  // EditorialStackCard / preview paths don't have to plumb them.
  onSetLocationImageSide?: (next: "left" | "right" | undefined) => void;
  onSetLocationBg?: (next: string | undefined) => void;
  onSetPropertyImageSide?: (next: "left" | "right" | undefined) => void;
  onSetPropertyBgPerDay?: (next: string | undefined) => void;

  // Optional-activity actions (editor + guest)
  onAddOptionalActivity: () => void;
  onUpdateOptionalActivity: (activityId: string, patch: Partial<OptionalActivity>) => void;
  onRemoveOptionalActivity: (activityId: string) => void;
  onToggleAddOn: (activityId: string) => void;
  isAddOnSelected: (activityId: string) => boolean;
  onRequestActivityInComments: (activity: OptionalActivity) => void;
};

export function getDayCardVariant(raw: string | undefined): DayCardLayoutVariant {
  const v = (raw ?? "auto") as DayCardLayoutVariant;
  const allowed: DayCardLayoutVariant[] = [
    "auto",
    "editorial-stack",
    "right-flip",
    "left-flip",
    "trip-flip",
  ];
  return allowed.includes(v) ? v : "auto";
}

// Convenience — used by the chrome to know whether the active tier has a
// camp assigned (even when the property lookup itself fails, e.g. camp
// name doesn't match anything in the library).
export function hasTierAssignment(day: Day, tier: TierKey): boolean {
  return Boolean(day.tiers?.[tier]?.camp?.trim());
}

// Type guard — lets layouts narrow when they want to branch on presence.
export function hasProperty(data: DayCardData): data is DayCardData & { property: ResolvedProperty } {
  return data.property !== null;
}

// Re-export so layouts only need one import.
export type { Day, Property, Proposal, TierKey, ThemeTokens, ProposalTheme };
