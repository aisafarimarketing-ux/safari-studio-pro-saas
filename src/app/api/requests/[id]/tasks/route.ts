import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";

// GET  /api/requests/[id]/tasks — list (newest first within each "open"/"done" group)
// POST /api/requests/[id]/tasks — create { title, notes?, dueAt? }

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
    select: { id: true },
  });
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const tasks = await prisma.requestTask.findMany({
    where: { requestId: request.id },
    // Open tasks first (doneAt IS NULL), then done; within each group most
    // recently edited first so newly checked items fade to the top of the
    // done pile.
    orderBy: [{ doneAt: { sort: "asc", nulls: "first" } }, { updatedAt: "desc" }],
  });
  return NextResponse.json({ tasks });
}

export async function POST(
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
  const request = await prisma.request.findFirst({
    where: { id, organizationId: ctx.organization.id },
    select: { id: true },
  });
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: { title?: string; notes?: string; dueAt?: string | null };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const title = body.title?.trim();
  if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });

  const dueAt = body.dueAt ? new Date(body.dueAt) : null;
  if (dueAt && Number.isNaN(dueAt.getTime())) {
    return NextResponse.json({ error: "Invalid dueAt date" }, { status: 400 });
  }

  const task = await prisma.requestTask.create({
    data: {
      requestId: request.id,
      title: title.slice(0, 160),
      notes: body.notes?.trim()?.slice(0, 2000) || null,
      dueAt,
      createdByUserId: ctx.user.id,
    },
  });

  // Bump the parent request's lastActivityAt so the inbox reflects the touch.
  await prisma.request.update({
    where: { id: request.id },
    data: { lastActivityAt: new Date() },
  });

  return NextResponse.json({ task }, { status: 201 });
}
