import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";

// ─── PATCH /api/reservations/:id ───────────────────────────────────────────
// Status update — operator flipping through the lifecycle:
//   pending → sent → (confirmed | declined | tentative) → (released)
// Also accepts heldUntil + notes updates. Tenant-scoped.

const VALID_STATUSES = ["pending", "sent", "confirmed", "declined", "tentative", "released"];

type Body = {
  status?: string;
  heldUntil?: string | null;
  notes?: string;
};

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!auth.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }

  const { id } = await ctx.params;

  const existing = await prisma.reservation.findFirst({
    where: { id, organizationId: auth.organization.id },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch: {
    status?: string;
    heldUntil?: Date | null;
    notes?: string | null;
    sentAt?: Date;
    confirmedAt?: Date;
  } = {};

  if (body.status) {
    if (!VALID_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: `Invalid status. Must be one of ${VALID_STATUSES.join(", ")}` }, { status: 400 });
    }
    patch.status = body.status;
    // Stamp lifecycle timestamps as operators flip status.
    if (body.status === "sent" && !existing.sentAt) patch.sentAt = new Date();
    if (body.status === "confirmed" && !existing.confirmedAt) patch.confirmedAt = new Date();
  }

  if (body.heldUntil === null) {
    patch.heldUntil = null;
  } else if (typeof body.heldUntil === "string") {
    const d = new Date(body.heldUntil);
    if (!isNaN(d.getTime())) patch.heldUntil = d;
  }

  if (typeof body.notes === "string") {
    patch.notes = body.notes.trim() || null;
  }

  const updated = await prisma.reservation.update({
    where: { id },
    data: patch,
  });

  return NextResponse.json({ reservation: updated });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!auth.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }
  const { id } = await ctx.params;
  const existing = await prisma.reservation.findFirst({
    where: { id, organizationId: auth.organization.id },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.reservation.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
