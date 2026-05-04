// ─── Booking Operations — message formatter ───────────────────────────────
//
// Pure function. Builds the operator's outbound availability-check
// message for one property. No LLM, no copy invention — same
// deterministic discipline as executionFormat.ts. The operator pastes
// or forwards this verbatim (or edits in the panel before sending).
//
// Tone: professional, concise, mobile-friendly. The recipient is a
// camp reservations desk, not a guest — strip the soft hospitality
// language that makes sense for client-facing messages.
//
// Structure:
//   1. Greeting: "Hello,"
//   2. Anchor: confirmed booking + ask for availability
//   3. Stay block: dates / nights / property / room class / guests / rooming
//   4. Booking reference (proposal trackingId or short id)
//   5. Close: ask for confirmation or alternatives
//   6. Sign-off (operator's first name)
//
// Same date format used everywhere: "5 Jul 2026". No timezones.

import type { TierKey } from "@/lib/types";

export type BookingCheckMessageInput = {
  propertyName: string;
  destination: string | null;
  tierKey: TierKey | null;
  checkInDate: Date;
  checkOutDate: Date;
  nights: number;
  adults: number;
  children: number;
  roomingNotes: string | null;
  /** Trip title or proposal title — used in the lead so the recipient
   *  immediately knows which trip this concerns. */
  tripTitle: string;
  /** Booking reference shown to the property — proposal.trackingId
   *  preferred, fallback to a short slice of the id. */
  bookingReference: string;
  operatorFirstName: string | null;
};

export function formatBookingCheckMessage(
  input: BookingCheckMessageInput,
): string {
  const guestLine = formatGuestLine(input.adults, input.children);
  const roomLine = formatRoomLine(input.tierKey, input.roomingNotes);
  const stayLines: string[] = [
    `Property: ${input.propertyName}${input.destination ? ` (${input.destination})` : ""}`,
    `Check-in: ${formatDate(input.checkInDate)}`,
    `Check-out: ${formatDate(input.checkOutDate)}`,
    `Nights: ${input.nights}`,
    `Guests: ${guestLine}`,
  ];
  if (roomLine) stayLines.push(`Room: ${roomLine}`);

  const lines: string[] = [
    "Hello,",
    "",
    `I have a confirmed booking for the ${input.tripTitle} and would like to check availability:`,
    "",
    ...stayLines,
    "",
    `Booking reference: ${input.bookingReference}`,
    "",
    "Please confirm whether the above dates are available, or suggest the closest alternative.",
  ];

  if (input.operatorFirstName) {
    lines.push("");
    lines.push("Thank you,");
    lines.push(input.operatorFirstName);
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// "5 Jul 2026" — short, unambiguous, no locale surprises.
function formatDate(d: Date): string {
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function formatGuestLine(adults: number, children: number): string {
  const adultsLabel = `${adults} ${adults === 1 ? "adult" : "adults"}`;
  if (children > 0) {
    return `${adultsLabel}, ${children} ${children === 1 ? "child" : "children"}`;
  }
  return adultsLabel;
}

function formatRoomLine(tierKey: TierKey | null, notes: string | null): string {
  const tierLabel: Record<TierKey, string> = {
    classic: "Classic",
    premier: "Premier",
    signature: "Signature",
  };
  const tierPart = tierKey ? tierLabel[tierKey] : "";
  const notesPart = notes?.trim() || "";
  if (tierPart && notesPart) return `${tierPart} — ${notesPart}`;
  return tierPart || notesPart;
}

// ─── Follow-up message ──────────────────────────────────────────────────────
//
// Generates a short polite nudge for use 24h+ after the initial send.
// Lighter touch than the original — references the prior message,
// re-states the dates, asks for a quick word.

export function formatBookingCheckFollowUp(
  input: BookingCheckMessageInput,
): string {
  const lines = [
    "Hello,",
    "",
    `Following up on my note about ${input.propertyName} for ${formatDate(input.checkInDate)}–${formatDate(input.checkOutDate)} (${input.nights} ${input.nights === 1 ? "night" : "nights"}, booking reference ${input.bookingReference}).`,
    "",
    "A quick word on availability would be appreciated, even if you're checking with the team — happy to wait.",
  ];
  if (input.operatorFirstName) {
    lines.push("");
    lines.push("Thank you,");
    lines.push(input.operatorFirstName);
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
