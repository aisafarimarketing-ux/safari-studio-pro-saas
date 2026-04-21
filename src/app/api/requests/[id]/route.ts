import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";

// /api/requests/[id] — detail (GET) + status/assignment update (PATCH) +
// soft delete (DELETE). Every mutation emits a system note into the
// RequestNote feed so the activity timeline is consistent across surfaces.

const VALID_STATUSES = ["new", "working", "open", "booked", "completed", "not_booked"];

// ─── GET ───────────────────────────────────────────────────────────────────

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ctx.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }

  const { id } = await params;
  const request = await prisma.request.findFirst({
    where: { id, organizationId: ctx.organization.id },
    include: {
      client: true,
      assignedTo: { select: { id: true, name: true, email: true } },
      notes: {
        orderBy: { createdAt: "desc" },
        include: { author: { select: { id: true, name: true, email: true } } },
      },
      proposals: {
        orderBy: { createdAt: "desc" },
        select: { id: true, title: true, status: true, createdAt: true, updatedAt: true },
      },
    },
  });
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ request });
}

// ─── PATCH ────────────────────────────────────────────────────────────────
//
// Body (all optional — supply only what you're changing):
//   { status?, assignedToUserId?, source?, sourceDetail?, tripBrief? }
//
// Every status/assignment change emits a system note so the feed is the
// canonical history.

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ctx.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }
  if (!ctx.orgActive) {
    return NextResponse.json({ error: "Account suspended", code: "ORG_SUSPENDED" }, { status: 402 });
  }

  const { id } = await params;
  const existing = await prisma.request.findFirst({
    where: { id, organizationId: ctx.organization.id },
    include: { assignedTo: { select: { id: true, name: true, email: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: PatchRequestBody;
  try {
    body = (await req.json()) as PatchRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const now = new Date();
  const updates: Record<string, unknown> = { lastActivityAt: now };
  const systemNotes: string[] = [];

  // Status transition
  if (body.status && body.status !== existing.status) {
    if (!VALID_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: `Invalid status: ${body.status}` }, { status: 400 });
    }
    updates.status = body.status;
    systemNotes.push(`Status changed from ${existing.status} to ${body.status}.`);
    // First move off "new" counts as first reply for the response-time metric.
    if (!existing.firstReplyAt && existing.status === "new") {
      updates.firstReplyAt = now;
    }
  }

  // Assignment change
  if (Object.prototype.hasOwnProperty.call(body, "assignedToUserId")) {
    const nextId = body.assignedToUserId?.trim() || null;
    if (nextId !== existing.assignedToUserId) {
      // Verify the user actually belongs to this org. Stops a malicious or
      // stale client from assigning to a user in a different workspace.
      if (nextId) {
        const membership = await prisma.orgMembership.findUnique({
          where: {
            userId_organizationId: { userId: nextId, organizationId: ctx.organization.id },
          },
          select: { userId: true },
        });
        if (!membership) {
          return NextResponse.json({ error: "Assignee not in this organization" }, { status: 400 });
        }
      }
      updates.assignedToUserId = nextId;
      updates.assignedAt = nextId ? now : null;
      systemNotes.push(
        nextId
          ? existing.assignedToUserId
            ? "Request reassigned."
            : "Request assigned."
          : "Request unassigned.",
      );
      if (!existing.firstReplyAt) updates.firstReplyAt = now;
    }
  }

  if (typeof body.source === "string") updates.source = body.source.trim() || null;
  if (typeof body.sourceDetail === "string") updates.sourceDetail = body.sourceDetail.trim() || null;
  if (body.tripBrief !== undefined) {
    updates.tripBrief = body.tripBrief ?? Prisma.DbNull;
  }

  const updated = await prisma.request.update({
    where: { id: existing.id },
    data: updates,
    include: {
      client: true,
      assignedTo: { select: { id: true, name: true, email: true } },
    },
  });

  if (systemNotes.length > 0) {
    await prisma.requestNote.createMany({
      data: systemNotes.map((body) => ({
        requestId: existing.id,
        kind: "system",
        body,
      })),
    });
  }

  return NextResponse.json({ request: updated });
}

// ─── DELETE ────────────────────────────────────────────────────────────────
//
// Hard delete. Rare — most operators will mark as "not_booked" instead.
// Cascades clear notes automatically via the Prisma relation; linked
// Proposals get their `requestId` set to null (relation onDelete: SetNull).

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ctx.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }
  if (ctx.role !== "admin" && ctx.role !== "owner") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.request.findFirst({
    where: { id, organizationId: ctx.organization.id },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.request.delete({ where: { id: existing.id } });
  return NextResponse.json({ ok: true });
}

// ─── Types ────────────────────────────────────────────────────────────────

type PatchRequestBody = {
  status?: string;
  assignedToUserId?: string | null;
  source?: string;
  sourceDetail?: string;
  tripBrief?: Record<string, unknown> | null;
};
