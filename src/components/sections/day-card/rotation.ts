import type { Day, Proposal, TierKey } from "@/lib/types";
import type { DayCardLayoutVariant } from "./types";

// Day cards now all render as the same editorial-stack layout. "auto"
// still exists as the section-level variant but there's no real choice
// to make — kept so the section registry + dispatcher signatures stay
// stable.

export function pickAutoLayoutForDay(
  _day: Day,
  _index: number,
  _totalDays: number,
  _proposal: Proposal,
  _activeTier: TierKey,
): Exclude<DayCardLayoutVariant, "auto"> {
  return "editorial-stack";
}
