import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";

// PATCH  /api/requests/[id]/tasks/[taskId] — toggle done, edit title/notes/dueAt
// DELETE /api/requests/[id]/tasks/[taskId]

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ctx.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }

  const { id, taskId } = await params;
  const request = await prisma.request.findFirst({
    where: { id, organizationId: ctx.organization.id },
    select: { id: true },
  });
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const existing = await prisma.requestTask.findFirst({
    where: { id: taskId, requestId: request.id },
  });
  if (!existing) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  let body: { title?: string; notes?: string | null; dueAt?: string | null; done?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (typeof body.title === "string" && body.title.trim()) updates.title = body.title.trim().slice(0, 160);
  if (body.notes !== undefined) updates.notes = body.notes?.trim()?.slice(0, 2000) || null;
  if (body.dueAt !== undefined) {
    if (body.dueAt === null || body.dueAt === "") {
      updates.dueAt = null;
    } else {
      const d = new Date(body.dueAt);
      if (Number.isNaN(d.getTime())) return NextResponse.json({ error: "Invalid dueAt" }, { status: 400 });
      updates.dueAt = d;
    }
  }
  if (typeof body.done === "boolean") {
    updates.doneAt = body.done ? new Date() : null;
  }

  const task = await prisma.requestTask.update({
    where: { id: existing.id },
    data: updates,
  });

  await prisma.request.update({
    where: { id: request.id },
    data: { lastActivityAt: new Date() },
  });

  return NextResponse.json({ task });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ctx.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }
  const { id, taskId } = await params;
  const request = await prisma.request.findFirst({
    where: { id, organizationId: ctx.organization.id },
    select: { id: true },
  });
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const existing = await prisma.requestTask.findFirst({
    where: { id: taskId, requestId: request.id },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  await prisma.requestTask.delete({ where: { id: existing.id } });
  return NextResponse.json({ ok: true });
}
