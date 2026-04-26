import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { recordActivity } from "@/lib/activity";
import { syncRequestStatus } from "@/lib/ghl/pipelineSync";

// POST /api/requests/bulk — apply the same change to many requests at
// once. Supports three operations; pick one per call.
//
//   { ids: [...], action: "assign",  assignedToUserId: <id> | null }
//   { ids: [...], action: "status",  status: <stage> }
//   { ids: [...], action: "delete" } // admin/owner only
//
// Safety:
//   - Every id must belong to the caller's org — else the whole call
//     rejects with 403.
//   - Assignee (if provided) must be a member of this org.

const VALID_STATUSES = ["new", "working", "open", "booked", "completed", "not_booked"];

type BulkBody =
  | { ids: string[]; action: "assign"; assignedToUserId: string | null }
  | { ids: string[]; action: "status"; status: string }
  | { ids: string[]; action: "delete" };

export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ctx.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }
  if (!ctx.orgActive) {
    return NextResponse.json({ error: "Account suspended", code: "ORG_SUSPENDED" }, { status: 402 });
  }

  let body: BulkBody;
  try {
    body = (await req.json()) as BulkBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const ids = Array.isArray(body?.ids) ? body.ids.filter((x): x is string => typeof x === "string") : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "ids must be a non-empty array" }, { status: 400 });
  }
  if (ids.length > 200) {
    return NextResponse.json({ error: "Max 200 ids per bulk call" }, { status: 400 });
  }

  // Verify every id belongs to the caller's org before doing anything.
  const existing = await prisma.request.findMany({
    where: { id: { in: ids }, organizationId: ctx.organization.id },
    select: { id: true, status: true },
  });
  if (existing.length !== ids.length) {
    return NextResponse.json({ error: "One or more requests not in your organisation" }, { status: 403 });
  }

  const now = new Date();

  if (body.action === "assign") {
    const assigneeId = body.assignedToUserId?.trim() || null;
    if (assigneeId) {
      const membership = await prisma.orgMembership.findUnique({
        where: {
          userId_organizationId: { userId: assigneeId, organizationId: ctx.organization.id },
        },
        select: { userId: true },
      });
      if (!membership) {
        return NextResponse.json({ error: "Assignee is not in this organisation" }, { status: 400 });
      }
    }
    await prisma.request.updateMany({
      where: { id: { in: ids }, organizationId: ctx.organization.id },
      data: {
        assignedToUserId: assigneeId,
        assignedAt: assigneeId ? now : null,
        lastActivityAt: now,
      },
    });
    // System note on every touched request.
    await prisma.requestNote.createMany({
      data: ids.map((id) => ({
        requestId: id,
        kind: "system",
        body: assigneeId ? "Request reassigned (bulk)." : "Request unassigned (bulk).",
      })),
    });
    await recordActivity({
      userId: ctx.user.id,
      organizationId: ctx.organization.id,
      type: "assignRequest",
      detail: { count: ids.length, assignedToUserId: assigneeId, bulk: true },
    });
    return NextResponse.json({ ok: true, count: ids.length });
  }

  if (body.action === "status") {
    if (!VALID_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: `Invalid status: ${body.status}` }, { status: 400 });
    }
    await prisma.request.updateMany({
      where: { id: { in: ids }, organizationId: ctx.organization.id },
      data: {
        status: body.status,
        lastActivityAt: now,
        // Stamp first-reply if any of them were still "new" and unstamped
        // — cheap: updateMany targets only those rows via a nested filter.
      },
    });
    // Independent call to stamp firstReplyAt on any row whose prior
    // status was "new" and has no existing stamp.
    await prisma.request.updateMany({
      where: {
        id: { in: existing.filter((e) => e.status === "new").map((e) => e.id) },
        firstReplyAt: null,
        organizationId: ctx.organization.id,
      },
      data: { firstReplyAt: now },
    });
    await prisma.requestNote.createMany({
      data: ids.map((id) => ({
        requestId: id,
        kind: "system",
        body: `Status changed to ${body.status} (bulk).`,
      })),
    });
    await recordActivity({
      userId: ctx.user.id,
      organizationId: ctx.organization.id,
      type: "changeStatus",
      detail: { count: ids.length, to: body.status, bulk: true },
    });
    // Fire-and-forget GHL sync — one move-stage call per request. The
    // sync layer self-throttles via the per-request retry policy in
    // client.ts. Org without GHL credentials is a no-op.
    for (const id of ids) void syncRequestStatus(id);
    return NextResponse.json({ ok: true, count: ids.length });
  }

  if (body.action === "delete") {
    if (ctx.role !== "owner" && ctx.role !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }
    await prisma.request.deleteMany({
      where: { id: { in: ids }, organizationId: ctx.organization.id },
    });
    return NextResponse.json({ ok: true, count: ids.length });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
