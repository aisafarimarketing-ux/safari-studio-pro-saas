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

// ─── Urgent follow-up (48h+) ────────────────────────────────────────────────
//
// Firmer than the 24h gentle check-in. Names the booking deadline
// pressure without losing the calm tone — the recipient is still a
// camp reservations desk, not a debtor. Used by the orchestration
// layer when attemptCount has reached 2 (initial + one follow-up
// already out).

export function formatBookingCheckUrgent(
  input: BookingCheckMessageInput,
): string {
  const lines = [
    "Hello,",
    "",
    `Checking in once more on the booking I sent through for ${input.propertyName}, ${formatDate(input.checkInDate)}–${formatDate(input.checkOutDate)} (${input.nights} ${input.nights === 1 ? "night" : "nights"}, booking reference ${input.bookingReference}).`,
    "",
    "We need to confirm availability soon to keep the trip on track. If the dates aren't clear yet, the closest available alternative would also help.",
  ];
  if (input.operatorFirstName) {
    lines.push("");
    lines.push("Thank you,");
    lines.push(input.operatorFirstName);
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// ─── Client-facing: good news (property confirmed) ─────────────────────────
//
// Operator-paste message for "we have your camp locked in". Calm
// confirmation, the dates, the camp, and a soft next-step. Single
// short paragraph — clients on WhatsApp don't want a press release.

export type ClientMessageInput = {
  clientFirstName: string;
  propertyName: string;
  destination: string | null;
  checkInDate: Date;
  checkOutDate: Date;
  nights: number;
  operatorFirstName: string | null;
};

export function formatGoodNewsMessage(input: ClientMessageInput): string {
  const where = input.destination
    ? `${input.propertyName} in ${input.destination}`
    : input.propertyName;
  const lines = [
    `Hi ${input.clientFirstName} — quick update.`,
    "",
    `${where} have confirmed your stay for ${formatDate(input.checkInDate)} to ${formatDate(input.checkOutDate)} (${input.nights} ${input.nights === 1 ? "night" : "nights"}). That part of the trip is now locked in.`,
    "",
    "I'll keep you posted as the rest of the bookings come back.",
  ];
  if (input.operatorFirstName) {
    lines.push("");
    lines.push("— " + input.operatorFirstName);
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// ─── Client-facing: alternative offer (property unavailable) ───────────────
//
// When the original camp is fully booked, the operator pastes this
// to surface 1–2 alternatives. Honest framing — no spin, no "even
// better option" sales talk. The operator picks which alternatives
// to surface; this just drops them into a sentence.

export type AlternativeOfferInput = {
  clientFirstName: string;
  originalProperty: string;
  destination: string | null;
  checkInDate: Date;
  checkOutDate: Date;
  /** Up to 2 alternative camp names. The formatter handles 1 or 2;
   *  passing 0 falls back to a "we'll find an option" copy. */
  alternatives: string[];
  operatorFirstName: string | null;
};

export function formatAlternativeOfferMessage(
  input: AlternativeOfferInput,
): string {
  const dateRange = `${formatDate(input.checkInDate)}–${formatDate(input.checkOutDate)}`;
  const where = input.destination
    ? `in ${input.destination}`
    : "for those dates";
  const alts = input.alternatives.filter((s) => s.trim().length > 0).slice(0, 2);

  const lines = [`Hi ${input.clientFirstName} — small update.`];
  lines.push("");
  if (alts.length === 0) {
    lines.push(
      `${input.originalProperty} is full ${where} on ${dateRange}. I'm checking the closest alternatives now and will come back to you shortly.`,
    );
  } else if (alts.length === 1) {
    lines.push(
      `${input.originalProperty} is full ${where} on ${dateRange}. The closest match for the same dates is ${alts[0]} — happy to hold it if you'd like to go ahead, or keep looking if you'd rather see other options.`,
    );
  } else {
    lines.push(
      `${input.originalProperty} is full ${where} on ${dateRange}. Two alternatives sit close to the same experience for those dates: ${alts[0]} and ${alts[1]}. Either would work — let me know which feels right and I'll lock it in.`,
    );
  }
  if (input.operatorFirstName) {
    lines.push("");
    lines.push("— " + input.operatorFirstName);
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// ─── Outbound to alternative property ──────────────────────────────────────
//
// When the original property's not_available, the operator wants to
// reach out to an alternative camp with the same dates / guest count.
// Same shape as the initial inquiry but framed honestly — the
// recipient should know they're being asked because someone else
// couldn't take it.

export function formatAlternativeRequestMessage(
  input: BookingCheckMessageInput & { replacingProperty: string },
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
    `I'm reaching out for a confirmed booking originally placed at ${input.replacingProperty}, which is unavailable for the dates. The ${input.tripTitle} client is happy to consider ${input.propertyName} for the same stay:`,
    "",
    ...stayLines,
    "",
    `Booking reference: ${input.bookingReference}`,
    "",
    "Could you let me know whether you can take this booking, or suggest the closest alternative on your end?",
  ];

  if (input.operatorFirstName) {
    lines.push("");
    lines.push("Thank you,");
    lines.push(input.operatorFirstName);
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
