import type { DayCardLayoutVariant } from "./types";
import type { Day, Proposal, TierKey } from "@/lib/types";

// Picks a concrete layout for a day when the section variant is "auto".
// Goal: the proposal should feel designed, not templated — no two
// identical layouts back to back, signature moments for arrival and for
// premium stays.

export function pickAutoLayoutForDay(
  day: Day,
  index: number,
  totalDays: number,
  proposal: Proposal,
  activeTier: TierKey,
): Exclude<DayCardLayoutVariant, "auto"> {
  // Day 1 → cinematic arrival.
  if (index === 0) return "cinematic-hero";

  // Last day → stacked-story reads as "wind-down" — restrained.
  if (index === totalDays - 1) return "stacked-story";

  // Multi-night stay at a premium property → property-led.
  const campName = day.tiers?.[activeTier]?.camp?.trim().toLowerCase();
  if (campName) {
    const sameCampCount = proposal.days.filter(
      (d) => d.tiers?.[activeTier]?.camp?.trim().toLowerCase() === campName,
    ).length;
    if (sameCampCount >= 3) return "property-led";
  }

  // Day has ≥ 2 highlights → collage (it's a signature day).
  if ((day.highlights ?? []).length >= 2) return "collage-hybrid";

  // Otherwise alternate split-editorial ↔ stacked-story for rhythm.
  return index % 2 === 0 ? "split-editorial" : "stacked-story";
}
