import type { Day, Proposal, TierKey } from "@/lib/types";
import type { ResolvedProperty } from "../types";
import type { StayChapter } from "./types";

// Group consecutive days into chapters. A chapter is any run of days
// that share the same camp (case-insensitive) at the active tier.
//   - Days with an empty camp → singleton chapters (travel days).
//   - Days with a camp not present in the library → still grouped by
//     name match; we just build a phantom property from the tier's
//     free-text fields.

export function resolveChapters(
  days: Day[],
  proposal: Proposal,
  activeTier: TierKey,
): StayChapter[] {
  if (days.length === 0) return [];

  const out: StayChapter[] = [];
  type Group = { campKey: string; days: Day[] };
  let current: Group | null = null;

  for (const day of days) {
    const camp = day.tiers?.[activeTier]?.camp?.trim();
    const key = camp ? camp.toLowerCase() : `__travel__${day.id}`;
    if (current && current.campKey === key) {
      current.days.push(day);
    } else {
      if (current) out.push(buildChapter(current, proposal, activeTier, out.length));
      current = { campKey: key, days: [day] };
    }
  }
  if (current) out.push(buildChapter(current, proposal, activeTier, out.length));
  return out;
}

function buildChapter(
  group: { campKey: string; days: Day[] },
  proposal: Proposal,
  activeTier: TierKey,
  index: number,
): StayChapter {
  const first = group.days[0];
  const last = group.days[group.days.length - 1];
  const tierAssignment = first.tiers?.[activeTier];
  const campName = tierAssignment?.camp?.trim() ?? "";

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
        summary: firstSentences(match.shortDesc ?? match.description ?? "", 3),
        highlights: (match.amenities ?? []).slice(0, 6),
        leadImageUrl: match.leadImageUrl ?? null,
        galleryUrls: (match.galleryUrls ?? []).filter(Boolean),
      };
    } else {
      property = {
        id: `phantom-${first.id}-${activeTier}`,
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
    id: `chapter-${first.id}-${last.id}`,
    property,
    days: group.days,
    startDayNumber: first.dayNumber,
    endDayNumber: last.dayNumber,
    nights: group.days.length,
    destinationName: first.destination?.trim() || "New Destination",
    destinationCountry: first.country?.trim() || "",
    boardBasis: first.board?.trim() || "",
    layoutIndex: index,
  };
}

function firstSentences(text: string, n: number): string {
  if (!text) return "";
  const parts = text.split(/(?<=[.!?])\s+/);
  return parts.slice(0, n).join(" ").trim();
}
