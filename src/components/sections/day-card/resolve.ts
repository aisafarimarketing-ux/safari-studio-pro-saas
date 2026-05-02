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
      // Coerce empty strings to null and fall back to the day's hero
      // when the library record has no lead image — operators
      // reported property images "not transported to preview/webview"
      // when autopilot left leadImageUrl as "" (empty string, not
      // null). Empty strings render as a blank slot in non-editor
      // mode; treating them as null + falling back to day.heroImageUrl
      // means there's always SOMETHING to show.
      const matchLead = nonEmpty(match.leadImageUrl);
      const matchGallery = (match.galleryUrls ?? []).filter(
        (u): u is string => typeof u === "string" && u.trim().length > 0,
      );
      const dayHero = nonEmpty(day.heroImageUrl);
      property = {
        id: match.id,
        name: match.name,
        location: match.location || tierAssignment?.location || "",
        summary: firstSentences(match.shortDesc ?? match.description ?? "", 2),
        highlights: (match.amenities ?? []).slice(0, 3),
        leadImageUrl: matchLead ?? matchGallery[0] ?? dayHero ?? null,
        galleryUrls: matchGallery,
      };
    } else {
      // Tier points at a camp that isn't in the library (free-text stay).
      // We still render a property card — fall back to the day's hero
      // image so guests see *something* relevant to the day.
      property = {
        id: `phantom-${day.id}-${activeTier}`,
        name: campName,
        location: tierAssignment?.location ?? "",
        summary: tierAssignment?.note ?? "",
        highlights: [],
        leadImageUrl: nonEmpty(day.heroImageUrl) ?? null,
        galleryUrls: [],
      };
    }
  }

  return {
    dayId: day.id,
    dayNumber: day.dayNumber,
    dayDate: resolveDayDate(day, proposal.trip?.arrivalDate),
    destinationName: day.destination?.trim() || "New Destination",
    destinationCountry: day.country?.trim() || "",
    phaseLabel: day.subtitle?.trim() ?? "",
    boardBasis: day.board?.trim() ?? "",
    narrative: day.description ?? "",
    highlights: (day.highlights ?? []).slice(0, 3),
    destinationImageUrl: day.heroImageUrl?.trim() || null,
    destinationImagePosition: day.heroImagePosition?.trim() || null,
    momentOfDay: day.momentOfDay?.trim() ?? "",
    property,
    optionalActivities: day.optionalActivities ?? [],
    layoutVariant: getDayCardVariant(sectionLayoutVariant),
    locationImageSide: day.locationImageSide,
    propertyImageSide: day.propertyImageSide,
  };
}

// Treat undefined / null / whitespace-only / empty strings the same
// — autopilot has historically written `""` for missing images,
// which renders as an empty slot in non-editor mode and fooled
// operators into thinking images "weren't transported".
function nonEmpty(s: string | null | undefined): string | null {
  if (typeof s !== "string") return null;
  const t = s.trim();
  return t.length > 0 ? t : null;
}

function firstSentences(text: string, n: number): string {
  if (!text) return "";
  const parts = text.split(/(?<=[.!?])\s+/);
  return parts.slice(0, n).join(" ").trim();
}

// Use UTC throughout — the trip's arrivalDate is stored as a calendar date
// (YYYY-MM-DD) with no timezone, so doing the math in local time would
// drift the day by ±1 for any guest viewing the proposal from a different
// region than the operator who set it up.
function resolveDayDate(day: Day, arrivalDateISO: string | undefined): string | null {
  const explicit = day.date?.trim();
  if (explicit) {
    const parsed = parseISODate(explicit);
    if (parsed) return formatDayDate(parsed);
  }
  if (!arrivalDateISO) return null;
  const start = parseISODate(arrivalDateISO);
  if (!start) return null;
  start.setUTCDate(start.getUTCDate() + Math.max(0, day.dayNumber - 1));
  return formatDayDate(start);
}

function parseISODate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return isNaN(d.getTime()) ? null : d;
}

function formatDayDate(d: Date): string {
  const weekday = d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
  const day = d.toLocaleDateString("en-US", { day: "numeric", timeZone: "UTC" });
  const month = d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  return `${weekday} ${day} ${month}`;
}
