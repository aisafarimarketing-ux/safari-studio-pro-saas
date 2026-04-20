import type { Day, Proposal, TierKey } from "@/lib/types";
import type { DayCardLayoutVariant } from "./types";

// Picks a concrete split-page variant for a day when the section variant
// is "auto". The four variants differ only in proportions and which side
// the Activities column sits on — so auto rotation is really about
// rhythm: alternate the dominant side and the ratio so a 6-day proposal
// doesn't feel like one template repeated.

export function pickAutoLayoutForDay(
  day: Day,
  index: number,
  totalDays: number,
  proposal: Proposal,
  activeTier: TierKey,
): Exclude<DayCardLayoutVariant, "auto"> {
  // Signature / arrival day — Activities on the left, slightly wider.
  if (index === 0) return "split-60-40-left";

  // Final day — flip sides for contrast.
  if (index === totalDays - 1) return "split-50-50-right";

  // Premium multi-night stays — give the Stay column more room.
  const campName = day.tiers?.[activeTier]?.camp?.trim().toLowerCase();
  if (campName) {
    const sameCampCount = proposal.days.filter(
      (d) => d.tiers?.[activeTier]?.camp?.trim().toLowerCase() === campName,
    ).length;
    if (sameCampCount >= 2) return "split-40-60-left";
  }

  // Otherwise alternate 60-40 / 50-50 for rhythm so consecutive days don't
  // look identical.
  return index % 2 === 0 ? "split-60-40-left" : "split-50-50-left";
}
