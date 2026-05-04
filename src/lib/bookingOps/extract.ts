import "server-only";
import type { Proposal, TierKey } from "@/lib/types";

// ─── Booking Operations — extraction ──────────────────────────────────────
//
// Pure function. Walks a booked proposal's contentJson.days[] and
// groups consecutive days at the same camp into one "stay" — that's
// the unit of work the operator needs to confirm with each property.
//
// What we extract per stay:
//   propertyName  — the camp string from day.tiers[activeTier].camp
//   destination   — first day's destination of the run
//   tierKey       — the proposal's activeTier (which room class to ask about)
//   checkInDate   — arrivalDate + offset of first day of the run
//   checkOutDate  — checkInDate + nights
//   nights        — number of consecutive days at the property
//   adults / children — copied from contentJson.client
//   roomingNotes  — copied from contentJson.client.rooming
//
// What we deliberately don't do:
//   - Look up the Property Library row (no contact info enrichment) —
//     v1 keeps this pure; the API route enriches separately when it
//     persists rows.
//   - Skip anything based on day.transfer / transit fields. A day
//     with a stay is a stay.
//   - Coerce a missing camp into a placeholder. Days without a
//     populated camp on the active tier are silently skipped — the
//     operator will see them on the editor side.
//
// Idempotent at the (proposalId, propertyName) level: when the same
// camp is used for non-contiguous segments of the trip (rare —
// "fly-in to base camp twice"), we merge into one stay with the
// earliest check-in and the total nights. Cleaner for the property
// reply ("we'll need rooms 5–8 and 10–12") than two parallel rows.

export type ExtractedStay = {
  propertyName: string;
  destination: string | null;
  tierKey: TierKey;
  checkInDate: Date;
  checkOutDate: Date;
  nights: number;
  adults: number;
  children: number;
  roomingNotes: string | null;
};

export type ExtractInput = {
  proposal: Proposal;
  /** Reservation arrival date — preferred over proposal.trip.arrivalDate
   *  because it's the actual travel date the client booked, not the
   *  date the operator was drafting against. ISO string. */
  arrivalDate: string;
};

export type ExtractResult =
  | { status: "ok"; stays: ExtractedStay[]; warnings: string[] }
  | { status: "error"; reason: string };

export function extractBookingChecks(input: ExtractInput): ExtractResult {
  const { proposal } = input;
  const days = Array.isArray(proposal?.days) ? proposal.days : [];
  if (days.length === 0) {
    return { status: "error", reason: "Proposal has no days." };
  }
  const arrival = parseDate(input.arrivalDate);
  if (!arrival) {
    return { status: "error", reason: "Reservation has no valid arrival date." };
  }
  const tierKey: TierKey =
    proposal.activeTier && (["classic", "premier", "signature"] as TierKey[]).includes(proposal.activeTier)
      ? proposal.activeTier
      : "premier";
  const adults =
    typeof proposal.client?.adults === "number" && proposal.client.adults > 0
      ? proposal.client.adults
      : 2;
  const children =
    typeof proposal.client?.children === "number" && proposal.client.children > 0
      ? proposal.client.children
      : 0;
  const roomingNotes = proposal.client?.rooming?.trim() || null;

  // Sort the days defensively. Operators sometimes reorder via the
  // editor and the persisted array order should be authoritative, but
  // a safety sort prevents off-by-one disasters on a malformed array.
  const sortedDays = [...days].sort((a, b) => a.dayNumber - b.dayNumber);

  // Walk runs of consecutive days that share the same property name
  // on the active tier. Each run becomes one stay segment; we then
  // merge segments of the same property at the end (rare).
  type Segment = { propertyName: string; destination: string | null; nights: number; startDayIndex: number };
  const segments: Segment[] = [];
  let current: Segment | null = null;
  for (let i = 0; i < sortedDays.length; i++) {
    const d = sortedDays[i];
    const camp = d.tiers?.[tierKey]?.camp?.trim();
    if (!camp) {
      // Day with no camp on the active tier — close any open segment
      // and skip. Common pattern: transit days the operator hasn't
      // populated, or the last "departure day" with no overnight.
      current = null;
      continue;
    }
    if (current && current.propertyName === camp) {
      current.nights += 1;
      continue;
    }
    current = {
      propertyName: camp,
      destination: d.destination?.trim() || null,
      nights: 1,
      startDayIndex: i,
    };
    segments.push(current);
  }

  if (segments.length === 0) {
    return { status: "error", reason: "Proposal days have no accommodation set on the active tier." };
  }

  // Merge segments by property name. When two non-contiguous runs hit
  // the same camp, we collapse to one stay — earliest check-in, sum
  // of nights. Surfaces a warning so the operator knows the dates
  // don't reflect a single contiguous block.
  const warnings: string[] = [];
  const byName = new Map<string, ExtractedStay>();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  for (const seg of segments) {
    const checkIn = new Date(arrival.getTime() + seg.startDayIndex * ONE_DAY_MS);
    const checkOut = new Date(checkIn.getTime() + seg.nights * ONE_DAY_MS);
    const existing = byName.get(seg.propertyName);
    if (existing) {
      // Same property, two segments — merge.
      const earliest = checkIn < existing.checkInDate ? checkIn : existing.checkInDate;
      const totalNights = existing.nights + seg.nights;
      const mergedCheckOut = new Date(earliest.getTime() + totalNights * ONE_DAY_MS);
      byName.set(seg.propertyName, {
        ...existing,
        checkInDate: earliest,
        checkOutDate: mergedCheckOut,
        nights: totalNights,
      });
      warnings.push(
        `${seg.propertyName} appears twice in the itinerary — merged into one availability check (${totalNights} nights).`,
      );
      continue;
    }
    byName.set(seg.propertyName, {
      propertyName: seg.propertyName,
      destination: seg.destination,
      tierKey,
      checkInDate: checkIn,
      checkOutDate: checkOut,
      nights: seg.nights,
      adults,
      children,
      roomingNotes,
    });
  }

  // Sort by check-in date so the UI always renders in trip order.
  const stays = Array.from(byName.values()).sort(
    (a, b) => a.checkInDate.getTime() - b.checkInDate.getTime(),
  );

  return { status: "ok", stays, warnings };
}

function parseDate(iso: string): Date | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}
