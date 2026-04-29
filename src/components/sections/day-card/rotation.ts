import type { Day, Proposal, TierKey } from "@/lib/types";

// "auto" still exists as the section-level variant for backward-compat
// with old proposals. It now resolves to editorial-stack — operators
// who want the magazine-rhythm flip layouts pick trip-flip / right-flip
// / left-flip explicitly. Kept so the section registry + dispatcher
// signatures stay stable.

export function pickAutoLayoutForDay(
  _day: Day,
  _index: number,
  _totalDays: number,
  _proposal: Proposal,
  _activeTier: TierKey,
): "editorial-stack" {
  return "editorial-stack";
}
