import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";

// GET /api/clients/[id] — profile + full request history across all stages.
//
// Scoped to the caller's org. Returns the client record plus every
// Request linked to them (newest first) and every Proposal linked to
// them (for quick "past quotes").

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
  const client = await prisma.client.findFirst({
    where: { id, organizationId: ctx.organization.id },
    include: {
      requests: {
        orderBy: { receivedAt: "desc" },
        include: {
          assignedTo: { select: { id: true, name: true, email: true } },
          _count: { select: { proposals: true, notes: true } },
        },
      },
      proposals: {
        orderBy: { updatedAt: "desc" },
        select: { id: true, title: true, status: true, updatedAt: true, createdAt: true },
      },
    },
  });

  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Quick rollup for the header stats.
  const totalRequests = client.requests.length;
  const booked = client.requests.filter((r) => r.status === "booked" || r.status === "completed").length;
  const firstSeen = client.requests[client.requests.length - 1]?.receivedAt ?? client.createdAt;
  const lastSeen = client.requests[0]?.receivedAt ?? client.updatedAt;

  return NextResponse.json({
    client,
    stats: {
      totalRequests,
      booked,
      firstSeen,
      lastSeen,
    },
  });
}

// PATCH /api/clients/[id] — edit profile fields (operator-managed).

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ctx.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }

  const { id } = await params;
  const existing = await prisma.client.findFirst({
    where: { id, organizationId: ctx.organization.id },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const ALLOWED = [
    "firstName", "lastName", "salutation", "phone", "country",
    "origin", "preferredLanguage", "internalNotes",
  ];
  const updates: Record<string, unknown> = {};
  for (const k of ALLOWED) {
    if (typeof body[k] === "string") updates[k] = (body[k] as string).trim() || null;
    else if (body[k] === null) updates[k] = null;
  }
  if (Array.isArray(body.tags)) {
    updates.tags = (body.tags as unknown[]).filter((t): t is string => typeof t === "string").slice(0, 20);
  }

  const client = await prisma.client.update({
    where: { id: existing.id },
    data: updates,
  });
  return NextResponse.json({ client });
}
