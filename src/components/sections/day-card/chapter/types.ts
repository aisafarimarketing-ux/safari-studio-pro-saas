import type { Day, Proposal, TierKey } from "@/lib/types";
import type { ResolvedProperty } from "../types";

// A StayChapter groups consecutive days of a trip that share the same
// camp (at the active tier). A three-night stay at Angama becomes ONE
// chapter with three days; a travel day on its own is a singleton
// chapter with no property. This mirrors how high-end operators (Karibu,
// Safariportal, etc.) present itineraries — the property gets one hero
// spread per visit, not one per night.

export type StayChapter = {
  id: string;               // synthetic, stable across renders
  property: ResolvedProperty | null;
  days: Day[];              // one or more, ordered
  startDayNumber: number;
  endDayNumber: number;
  nights: number;
  destinationName: string;  // from first day
  destinationCountry: string;
  boardBasis: string;
  layoutIndex: number;      // 0-based position of this chapter in the trip
};

export type ChapterLayoutVariant =
  | "chapter-magazine"          // Safariportal-style
  | "chapter-destination";      // Karibu-style

export function isChapterVariant(v: string): v is ChapterLayoutVariant {
  return v === "chapter-magazine" || v === "chapter-destination";
}

// Shared props every chapter layout receives. All writes go back through
// these handlers so the layouts stay purely presentational.
export type ChapterLayoutProps = {
  chapter: StayChapter;
  isEditor: boolean;
  activeTier: TierKey;
  proposal: Proposal;
  // text + image edits happen on one of the chapter's days — the layout
  // decides which (usually day[0] for hero content).
  onEditDay: (dayId: string, patch: Partial<Day>) => void;
  onPropertyImageUpload: (file: File) => void;
  onDestinationImageUpload: (dayId: string, file: File) => void;
  onOpenPropertyPicker: () => void;
  onOpenDestinationPicker: () => void;
};
