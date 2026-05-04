import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";

// PATCH /api/bookings/check-requests/[id]
//
// Operator-driven status transitions and notes updates for one
// BookingCheckRequest row. v1 keeps this dumb: the operator picks
// the next status, we set the matching timestamp. No automatic
// transitions, no reply parsing — those land in v2.
//
// Body shape:
//   {
//     status?: "not_sent" | "sent" | "replied" | "available"
//            | "not_available" | "follow_up_needed",
//     notes?: string,
//     draftText?: string,   // operator-edited copy
//   }
//
// Side effects per status:
//   - "sent"           → sentAt = now if not already set
//   - "replied"        → repliedAt = now if not already set
//   - "available"      → repliedAt set + resolvedAt = now
//   - "not_available"  → repliedAt set + resolvedAt = now
//   - "not_sent" / "follow_up_needed" → no timestamp changes

const ALLOWED_STATUSES = new Set([
  "not_sent",
  "sent",
  "replied",
  "available",
  "not_available",
  "follow_up_needed",
]);

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!auth.organization) {
    return NextResponse.json({ error: "No active organization." }, { status: 409 });
  }
  const orgId = auth.organization.id;

  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "id required." }, { status: 400 });
  }

  let body: { status?: string; notes?: string; draftText?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const existing = await prisma.bookingCheckRequest.findFirst({
    where: { id, organizationId: orgId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (typeof body.notes === "string") {
    // Cap notes hard so a runaway paste can't bloat the row.
    data.notes = body.notes.slice(0, 4000);
  }
  if (typeof body.draftText === "string") {
    data.draftText = body.draftText.slice(0, 8000);
  }
  if (typeof body.status === "string") {
    if (!ALLOWED_STATUSES.has(body.status)) {
      return NextResponse.json({ error: `Invalid status "${body.status}".` }, { status: 400 });
    }
    data.status = body.status;
    const now = new Date();
    switch (body.status) {
      case "sent":
        if (!existing.sentAt) data.sentAt = now;
        break;
      case "replied":
        if (!existing.repliedAt) data.repliedAt = now;
        break;
      case "available":
      case "not_available":
        if (!existing.repliedAt) data.repliedAt = now;
        data.resolvedAt = now;
        break;
      case "not_sent":
        // Operator manually reverted — clear sent/replied/resolved
        // so the timeline doesn't lie.
        data.sentAt = null;
        data.repliedAt = null;
        data.resolvedAt = null;
        break;
      case "follow_up_needed":
        // Operator-flagged stall. Don't touch timestamps — the row
        // is still in "sent" state from the operator's perspective.
        break;
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update." }, { status: 400 });
  }

  const updated = await prisma.bookingCheckRequest.update({
    where: { id },
    data,
  });

  return NextResponse.json({
    row: {
      id: updated.id,
      propertyName: updated.propertyName,
      destination: updated.destination,
      tierKey: updated.tierKey,
      checkInDate: updated.checkInDate.toISOString(),
      checkOutDate: updated.checkOutDate.toISOString(),
      nights: updated.nights,
      adults: updated.adults,
      children: updated.children,
      roomingNotes: updated.roomingNotes,
      draftText: updated.draftText,
      status: updated.status,
      sentAt: updated.sentAt?.toISOString() ?? null,
      repliedAt: updated.repliedAt?.toISOString() ?? null,
      resolvedAt: updated.resolvedAt?.toISOString() ?? null,
      notes: updated.notes,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    },
  });
}
