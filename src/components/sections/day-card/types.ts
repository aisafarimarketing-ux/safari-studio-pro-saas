// ─── Day Card — canonical data model ──────────────────────────────────────
//
// Single source of truth for every day card layout. Whatever the stored Day
// looks like (tiers, free-text fields, property references by name), the
// resolver flattens it into this shape so the five layout components can
// stay purely presentational.
//
// Missing or null values are handled by the layouts, which fall back to
// polished placeholders — never broken UI.

import type { Day, Property, Proposal, TierKey, ThemeTokens, ProposalTheme } from "@/lib/types";

export type DayCardLayoutVariant =
  | "auto"
  | "split-editorial"
  | "cinematic-hero"
  | "stacked-story"
  | "property-led"
  | "collage-hybrid";

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

  // Property
  property: ResolvedProperty | null;

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

  // Image actions — destination hero
  onDestinationImageUpload: (file: File) => void;
  onDestinationImagePickerOpen: () => void;

  // Property actions
  onOpenPropertyPicker: () => void;
  onPropertyImageUpload: (file: File) => void;  // replaces property.leadImageUrl
};

export function getDayCardVariant(raw: string | undefined): DayCardLayoutVariant {
  const v = (raw ?? "auto") as DayCardLayoutVariant;
  const allowed: DayCardLayoutVariant[] = [
    "auto",
    "split-editorial",
    "cinematic-hero",
    "stacked-story",
    "property-led",
    "collage-hybrid",
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
