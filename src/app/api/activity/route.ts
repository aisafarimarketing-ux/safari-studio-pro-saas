import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";

// /api/activity — append + read the org-wide activity log.
//
// GET  → recent events (admin/owner) or caller's own events (members).
// POST → record a single event. Most events are emitted server-side by
//        the mutation routes that perform the action (Request PATCH,
//        Proposal POST, etc.), so this endpoint is mainly for the
//        client-side heartbeat-style pings ("Lilian opened a library
//        browser", "Lilian navigated to the Brand DNA page"). The
//        server-emitted events will eventually share a helper.

const VALID_TYPES = new Set([
  "signin", "signout",
  "viewRequest", "createRequest", "assignRequest", "changeStatus", "postNote",
  "createQuote", "sendQuote", "editProposal",
  "archiveProperty", "editBrandDNA",
  "viewLibrary", "viewTeam",
]);

// ─── GET ───────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ctx.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }

  const url = new URL(req.url);
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") ?? 50)));
  const filterUserId = url.searchParams.get("userId")?.trim();
  const since = url.searchParams.get("since");
  const isAdmin = ctx.role === "admin" || ctx.role === "owner";

  // Members can only see their own events (privacy) — admins see the
  // whole org stream.
  const where: Prisma.ActivityEventWhereInput = {
    organizationId: ctx.organization.id,
    ...(isAdmin ? {} : { userId: ctx.user.id }),
    ...(filterUserId ? { userId: filterUserId } : {}),
    ...(since && !Number.isNaN(Date.parse(since)) ? { createdAt: { gt: new Date(since) } } : {}),
  };

  const events = await prisma.activityEvent.findMany({
    where,
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json({ events });
}

// ─── POST ──────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ctx.organization) {
    return new NextResponse(null, { status: 204 });
  }

  let body: {
    type?: string;
    targetType?: string;
    targetId?: string;
    detail?: Record<string, unknown>;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const type = body.type?.trim();
  if (!type || !VALID_TYPES.has(type)) {
    return NextResponse.json({ error: "Unknown type" }, { status: 400 });
  }

  await prisma.activityEvent.create({
    data: {
      userId: ctx.user.id,
      organizationId: ctx.organization.id,
      type,
      targetType: body.targetType?.trim() || null,
      targetId: body.targetId?.trim() || null,
      detail: (body.detail ?? Prisma.DbNull) as Prisma.InputJsonValue | typeof Prisma.DbNull,
    },
  });

  return new NextResponse(null, { status: 204 });
}
