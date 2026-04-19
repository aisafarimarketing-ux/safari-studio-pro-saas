import type { Day, Proposal, TierKey } from "@/lib/types";
import type { DayCardLayoutVariant } from "./types";

// Picks a concrete layout for a day when the section variant is "auto".
// Goal: the proposal should feel designed, not templated — no two
// identical layouts back to back. The four new editorial layouts each
// depend on different amounts of property imagery, so we pick what looks
// fullest given the property that's actually assigned.

export function pickAutoLayoutForDay(
  day: Day,
  index: number,
  totalDays: number,
  proposal: Proposal,
  activeTier: TierKey,
): Exclude<DayCardLayoutVariant, "auto"> {
  // Day 1 → twin-frame (sets the tone with two images).
  if (index === 0) return "twin-frame";

  // Look at what property imagery we have for this day.
  const campName = day.tiers?.[activeTier]?.camp?.trim().toLowerCase();
  const property = campName
    ? proposal.properties.find((p) => p.name.trim().toLowerCase() === campName)
    : null;
  const galleryCount = property?.galleryUrls?.filter(Boolean).length ?? 0;

  // Highly-photographed property → thumbs layout (shows off the gallery).
  if (galleryCount >= 2) {
    // Alternate thumbs / pair / inset by position so the same property
    // across multiple days doesn't repeat the exact composition.
    const phase = index % 3;
    if (phase === 0) return "hero-thumbs";
    if (phase === 1) return "hero-pair";
    return "hero-inset";
  }
  if (galleryCount === 1) return "hero-pair";
  return "hero-inset";
}
