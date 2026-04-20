import type { Day, Proposal, TierKey } from "@/lib/types";
import type { DayCardData, ResolvedProperty } from "./types";
import { getDayCardVariant } from "./types";

// Flatten a Day + Proposal + active tier into a single DayCardData record.
// Property lookup is by name-match (case-insensitive) against
// proposal.properties — lives in sync with how the store assigns camps.

export function resolveDayCard(
  day: Day,
  proposal: Proposal,
  activeTier: TierKey,
  sectionLayoutVariant: string,
): DayCardData {
  const tierAssignment = day.tiers?.[activeTier];
  const campName = tierAssignment?.camp?.trim();

  let property: ResolvedProperty | null = null;
  if (campName) {
    const match = proposal.properties.find(
      (p) => p.name.trim().toLowerCase() === campName.toLowerCase(),
    );
    if (match) {
      property = {
        id: match.id,
        name: match.name,
        location: match.location || tierAssignment?.location || "",
        summary: firstSentences(match.shortDesc ?? match.description ?? "", 2),
        highlights: (match.amenities ?? []).slice(0, 3),
        leadImageUrl: match.leadImageUrl ?? null,
        galleryUrls: (match.galleryUrls ?? []).filter(Boolean),
      };
    } else {
      // Tier points at a camp that isn't in the library (free-text stay).
      // We still render a property card — just without imagery.
      property = {
        id: `phantom-${day.id}-${activeTier}`,
        name: campName,
        location: tierAssignment?.location ?? "",
        summary: tierAssignment?.note ?? "",
        highlights: [],
        leadImageUrl: null,
        galleryUrls: [],
      };
    }
  }

  return {
    dayId: day.id,
    dayNumber: day.dayNumber,
    destinationName: day.destination?.trim() || "New Destination",
    destinationCountry: day.country?.trim() || "",
    phaseLabel: day.subtitle?.trim() ?? "",
    boardBasis: day.board?.trim() ?? "",
    narrative: day.description ?? "",
    highlights: (day.highlights ?? []).slice(0, 3),
    destinationImageUrl: day.heroImageUrl?.trim() || null,
    property,
    optionalActivities: day.optionalActivities ?? [],
    layoutVariant: getDayCardVariant(sectionLayoutVariant),
  };
}

function firstSentences(text: string, n: number): string {
  if (!text) return "";
  const parts = text.split(/(?<=[.!?])\s+/);
  return parts.slice(0, n).join(" ").trim();
}
