import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";

// GET /api/bookings/check-requests?reservationId=X
//
// Lists every BookingCheckRequest tied to the given reservation's
// proposal. Org-scoped: the reservation must belong to the caller's
// org, and the rows are filtered by the same org id. Returns an
// empty array when no rows exist yet (operator hasn't generated).

export async function GET(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!ctx.organization) {
    return NextResponse.json({ error: "No active organization." }, { status: 409 });
  }
  const orgId = ctx.organization.id;

  const url = new URL(req.url);
  const reservationId = url.searchParams.get("reservationId")?.trim();
  if (!reservationId) {
    return NextResponse.json({ error: "reservationId required." }, { status: 400 });
  }

  // Resolve proposalId from the reservation. We never trust a
  // caller-supplied proposalId — it must come off a reservation row
  // that the caller's org owns.
  const reservation = await prisma.proposalReservation.findFirst({
    where: { id: reservationId, organizationId: orgId },
    select: { proposalId: true },
  });
  if (!reservation) {
    return NextResponse.json({ error: "Reservation not found." }, { status: 404 });
  }

  const rows = await prisma.bookingCheckRequest.findMany({
    where: { organizationId: orgId, proposalId: reservation.proposalId },
    orderBy: { checkInDate: "asc" },
  });

  return NextResponse.json({
    rows: rows.map((row) => ({
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
      repliedAt: row.repliedAt?.toISOString() ?? null,
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
      attemptCount: row.attemptCount,
      nextActionAt: row.nextActionAt?.toISOString() ?? null,
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
  });
}
