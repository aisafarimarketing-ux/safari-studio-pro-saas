import "server-only";
import { nanoid } from "nanoid";
import type { Day } from "@/lib/types";

// Smart-default helpers used wherever a Proposal is materialised from
// a brief that may be missing dates or duration.
//
// The original bug: a Request whose tripBrief.nights / tripBrief.dates
// were both blank produced a Proposal with `nights = 0` and `days =
// []`. The operator opened the editor to a completely empty timeline
// and assumed the system was broken. These helpers give every "create
// proposal" path the same intelligent fallbacks so the editor always
// opens with a usable scaffold — even before the autopilot runs.
//
// Pure functions, no IO. Keep them deterministic so the same brief
// always lands on the same scaffold (cache-friendly, predictable).

export type TripBrief = {
  nights?: number | null;
  dates?: string | null;
  destinations?: string[] | null;
  style?: string | null;
};

export type InferredTrip = {
  /** Final nights count — never less than MIN_NIGHTS. */
  nights: number;
  /** Caller-supplied dates passed through. We never fabricate dates;
   *  if the brief had none, the field stays empty and the editor
   *  shows day numbers without calendar dates. */
  dates: string;
  /** Trip style label used by the cover + closing sections. Falls
   *  back to a calm generic when the brief didn't carry one. */
  tripStyle: string;
  /** Destinations passed through (deduped, trimmed). */
  destinations: string[];
};

const MIN_NIGHTS = 3;
const MAX_NIGHTS = 21;
const FALLBACK_NIGHTS = 7;

// Estimate trip length from destination count when no explicit duration
// was provided. Mirrors what an experienced consultant would intuit:
// fewer stops = shorter trip; more stops = longer trip. Caps at 14
// nights so a generous brief doesn't produce a marathon scaffold.
function nightsFromDestinations(count: number): number {
  if (count <= 0) return FALLBACK_NIGHTS;
  if (count === 1) return 4;
  if (count === 2) return 6;
  if (count === 3) return 8;
  if (count === 4) return 10;
  if (count === 5) return 12;
  return 14;
}

// Parse a dates field for a "Mar 4 → Mar 11" / "March 4 - 11" /
// "2026-03-04 to 2026-03-11" range. We only return a count when both
// ends parse cleanly; otherwise fall through to the next strategy.
function nightsFromDateRange(raw: string): number | null {
  if (!raw) return null;
  // Split on common range separators.
  const parts = raw
    .split(/(?:→|->|—|–|-|\bto\b)/i)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length !== 2) return null;
  const a = new Date(parts[0]);
  const b = new Date(parts[1]);
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return null;
  const ms = b.getTime() - a.getTime();
  const nights = Math.round(ms / 86_400_000);
  if (!Number.isFinite(nights) || nights <= 0) return null;
  return nights;
}

export function inferTripDuration(brief: TripBrief | null | undefined): InferredTrip {
  const safe: TripBrief = brief ?? {};
  const destinations = (safe.destinations ?? [])
    .filter((d): d is string => typeof d === "string" && d.trim().length > 0)
    .map((d) => d.trim());

  // 1. Honour an explicit nights field when it makes sense.
  const explicitNights = typeof safe.nights === "number" ? safe.nights : NaN;
  let nights = Number.isFinite(explicitNights) && explicitNights > 0 ? explicitNights : NaN;

  // 2. Otherwise try parsing the dates string for a range.
  if (!Number.isFinite(nights)) {
    const fromDates = typeof safe.dates === "string" ? nightsFromDateRange(safe.dates) : null;
    if (fromDates) nights = fromDates;
  }

  // 3. Otherwise estimate from destination count.
  if (!Number.isFinite(nights)) {
    nights = nightsFromDestinations(destinations.length);
  }

  // Clamp to the band. A brief asking for 30 nights is an outlier
  // we don't want to scaffold for; the operator can extend in editor.
  nights = Math.max(MIN_NIGHTS, Math.min(MAX_NIGHTS, Math.round(nights)));

  const tripStyle = safe.style?.trim() || "Custom Safari";
  return {
    nights,
    dates: safe.dates?.trim() || "",
    tripStyle,
    destinations,
  };
}

// Generate Day[] of length `nights` so the editor opens with real
// timeline cards instead of an empty list. Destinations are spread
// evenly across days (e.g. 3 destinations × 9 nights → 3 nights each).
// All narratives + accommodation slots stay blank — the autopilot
// fills them in when invoked. Day 1 / last day get arrival / departure
// subtitles so the timeline reads sensibly even pre-AI.
export function seedBlankDays(
  nights: number,
  destinations: string[],
): Day[] {
  const safeNights = Math.max(1, Math.min(60, Math.round(nights)));
  const stops = destinations.filter((d) => d.trim().length > 0);

  // Distribute destinations across days. With N stops and M days,
  // each stop gets ceil(M/N) days, with the remainder absorbed by the
  // last stop. When stops is empty, every day has destination = "".
  const dayDestinations: string[] = new Array(safeNights).fill("");
  if (stops.length > 0) {
    const baseNightsPerStop = Math.floor(safeNights / stops.length);
    const remainder = safeNights - baseNightsPerStop * stops.length;
    let cursor = 0;
    stops.forEach((stop, i) => {
      const stopNights = baseNightsPerStop + (i < remainder ? 1 : 0);
      for (let n = 0; n < stopNights && cursor < safeNights; n++) {
        dayDestinations[cursor] = stop;
        cursor++;
      }
    });
  }

  return Array.from({ length: safeNights }, (_, idx) => {
    const dayNumber = idx + 1;
    const isFirst = idx === 0;
    const isLast = idx === safeNights - 1;
    const destination = dayDestinations[idx] || "";
    return {
      id: nanoid(),
      dayNumber,
      destination,
      country: "",
      subtitle: isFirst
        ? "Arrival"
        : isLast
          ? "Departure"
          : "",
      description: "",
      board: "Full board",
      tiers: {
        classic: { camp: "", location: "", note: "" },
        premier: { camp: "", location: "", note: "" },
        signature: { camp: "", location: "", note: "" },
      },
    };
  });
}
