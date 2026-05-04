import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { friendlyConsultantName } from "@/lib/consultantIdentity";
import { extractBookingChecks } from "@/lib/bookingOps/extract";
import { formatBookingCheckMessage } from "@/lib/bookingOps/format";
import { deriveSuggestedAction } from "@/lib/bookingOps/orchestrate";
import type { Proposal } from "@/lib/types";
import { displayTrackingId } from "@/lib/proposalTracking";

// POST /api/bookings/check-requests/generate
//
// Body: { reservationId: string }
//
// Walks the booked proposal's days[], extracts one stay row per
// property, persists missing rows, returns the full list (existing +
// new) so the UI can render immediately.
//
// Idempotent. The unique constraint on (proposalId, propertyName)
// means re-running this for the same reservation never duplicates —
// it's safe for the operator to click the button multiple times if
// they edit the proposal mid-flow.
//
// Auth: org-scoped via getAuthContext. The reservation must belong
// to the same org as the caller; we never trust the body's
// proposalId — we read it off the reservation row.

export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!ctx.organization) {
    return NextResponse.json({ error: "No active organization." }, { status: 409 });
  }
  const orgId = ctx.organization.id;

  let body: { reservationId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const reservationId = body.reservationId?.trim();
  if (!reservationId) {
    return NextResponse.json({ error: "reservationId required." }, { status: 400 });
  }

  const reservation = await prisma.proposalReservation.findFirst({
    where: { id: reservationId, organizationId: orgId },
    select: {
      id: true,
      proposalId: true,
      arrivalDate: true,
      proposal: {
        select: {
          id: true,
          title: true,
          trackingId: true,
          contentJson: true,
        },
      },
    },
  });
  if (!reservation) {
    return NextResponse.json({ error: "Reservation not found." }, { status: 404 });
  }
  if (!reservation.proposal) {
    return NextResponse.json({ error: "Reservation has no linked proposal." }, { status: 409 });
  }

  const proposal = reservation.proposal.contentJson as unknown as Proposal;
  const extraction = extractBookingChecks({
    proposal,
    arrivalDate: reservation.arrivalDate.toISOString(),
  });
  if (extraction.status === "error") {
    return NextResponse.json({ error: extraction.reason }, { status: 422 });
  }

  const operatorFirstName =
    friendlyConsultantName({ name: ctx.user.name, email: ctx.user.email })
      .split(/\s+/)[0] || null;

  const tripTitle = reservation.proposal.title ?? "your safari";
  const bookingReference = displayTrackingId({
    id: reservation.proposal.id,
    trackingId: reservation.proposal.trackingId,
  });

  // Pre-existing rows for this proposal — the unique index would
  // raise on a duplicate, but checking up front lets us return the
  // full set without a second query.
  const existing = await prisma.bookingCheckRequest.findMany({
    where: { organizationId: orgId, proposalId: reservation.proposalId },
    orderBy: { checkInDate: "asc" },
  });
  const existingByName = new Map(existing.map((r) => [r.propertyName, r] as const));

  // Create one row per stay that doesn't already exist. Property
  // contact info enrichment from the Property Library is intentionally
  // left for v2 — keeping the v1 path single-source-of-truth on
  // proposal.contentJson per the spec ("use only booked proposal data").
  const created = [] as typeof existing;
  for (const stay of extraction.stays) {
    if (existingByName.has(stay.propertyName)) continue;
    const draftText = formatBookingCheckMessage({
      propertyName: stay.propertyName,
      destination: stay.destination,
      tierKey: stay.tierKey,
      checkInDate: stay.checkInDate,
      checkOutDate: stay.checkOutDate,
      nights: stay.nights,
      adults: stay.adults,
      children: stay.children,
      roomingNotes: stay.roomingNotes,
      tripTitle,
      bookingReference,
      operatorFirstName,
    });
    const row = await prisma.bookingCheckRequest.create({
      data: {
        organizationId: orgId,
        proposalId: reservation.proposalId,
        reservationId: reservation.id,
        propertyName: stay.propertyName,
        destination: stay.destination,
        tierKey: stay.tierKey,
        checkInDate: stay.checkInDate,
        checkOutDate: stay.checkOutDate,
        nights: stay.nights,
        adults: stay.adults,
        children: stay.children,
        roomingNotes: stay.roomingNotes,
        draftText,
      },
    });
    created.push(row);
  }

  // Return the full list — existing (with their saved status) plus
  // newly-created. UI can render without a follow-up GET.
  const all = [...existing, ...created].sort(
    (a, b) => a.checkInDate.getTime() - b.checkInDate.getTime(),
  );
  return NextResponse.json({
    rows: all.map(serializeRow),
    warnings: extraction.warnings,
    createdCount: created.length,
  });
}

function serializeRow(row: {
  id: string;
  propertyName: string;
  destination: string | null;
  tierKey: string | null;
  checkInDate: Date;
  checkOutDate: Date;
  nights: number;
  adults: number;
  children: number;
  roomingNotes: string | null;
  draftText: string;
  status: string;
  sentAt: Date | null;
  lastSentAt: Date | null;
  repliedAt: Date | null;
  resolvedAt: Date | null;
  attemptCount: number;
  nextActionAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    propertyName: row.propertyName,
    destination: row.destination,
    tierKey: row.tierKey,
    checkInDate: row.checkInDate.toISOString(),
    checkOutDate: row.checkOutDate.toISOString(),
    nights: row.nights,
    adults: row.adults,
    children: row.children,
    roomingNotes: row.roomingNotes,
    draftText: row.draftText,
    status: row.status,
    sentAt: row.sentAt?.toISOString() ?? null,
    lastSentAt: row.lastSentAt?.toISOString() ?? null,
    repliedAt: row.repliedAt?.toISOString() ?? null,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    attemptCount: row.attemptCount,
    nextActionAt: row.nextActionAt?.toISOString() ?? null,
    suggestedAction: deriveSuggestedAction(
      { status: row.status, nextActionAt: row.nextActionAt },
      new Date(),
    ),
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
