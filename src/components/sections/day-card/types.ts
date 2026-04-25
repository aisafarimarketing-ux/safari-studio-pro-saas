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

// Day cards render one editorial-stack layout: top header strip, big
// hero photo, narrative, optional activities, and a trim accommodation
// block. "auto" exists for the section-level variant picker but resolves
// to the same layout.
export type DayCardLayoutVariant = "auto" | "editorial-stack";

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

  // Property
  property: ResolvedProperty | null;

  // Priced optional activities for this day (the upsell column).
  optionalActivities: OptionalActivity[];

  // Layout hint set by the editor
  layoutVariant: DayCardLayoutVariant;
};

// Shared props every layout component accepts. Layouts never touch the
// store directly — they call back through these handlers.
export type DayCardLayoutProps = {
  data: DayCardData;
  isEditor: boolean;
  tokens: ThemeTokens;
  theme: ProposalTheme;
  activeTier: TierKey;

  // Text editing (reusing contentEditable pattern with data-ai-editable)
  onDestinationChange: (next: string) => void;
  onPhaseLabelChange: (next: string) => void;
  onNarrativeChange: (next: string) => void;
  onBoardChange: (next: string) => void;

  // Image actions — destination hero
  onDestinationImageUpload: (file: File) => void;
  onDestinationImagePickerOpen: () => void;
  /** Persists a new object-position when the operator drags the hero. */
  onDestinationImagePositionChange: (next: string) => void;

  // Property actions
  onOpenPropertyPicker: () => void;
  onPropertyImageUpload: (file: File) => void;  // replaces property.leadImageUrl

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
  const allowed: DayCardLayoutVariant[] = ["auto", "editorial-stack"];
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
