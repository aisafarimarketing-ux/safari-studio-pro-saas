import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { nextRequestReferenceNumber } from "@/lib/requestCounter";
import { recordActivity } from "@/lib/activity";
import { notifyNewRequest } from "@/lib/notifications";

// /api/requests — tenant-scoped CRUD for inbound client inquiries.
//
// GET   → list (filterable by status and assignee; default = all open stages)
// POST  → create a new Request, dedup'd Client (by email), auto referenceNumber

// ─── GET /api/requests ────────────────────────────────────────────────────
//
// Query params:
//   status=new|working|open|booked|completed|not_booked (repeatable, or "all")
//   assignedToUserId=<id> | "me" | "unassigned"
//   q=<search> (matches referenceNumber, client email/name/country)
//   limit=N (default 100, max 500)

const OPEN_STAGES = ["new", "working", "open"];

export async function GET(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ctx.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }

  const url = new URL(req.url);
  const statusParams = url.searchParams.getAll("status").filter(Boolean);
  const assignee = url.searchParams.get("assignedToUserId");
  const q = url.searchParams.get("q")?.trim() ?? "";
  const limit = clampInt(url.searchParams.get("limit"), 1, 500, 100);

  const whereStatus: { status?: { in: string[] } } = {};
  if (statusParams.length === 0) {
    // Default view: everything currently open (new + working + open). Booked /
    // completed / not_booked are noise on the daily pipeline.
    whereStatus.status = { in: OPEN_STAGES };
  } else if (!statusParams.includes("all")) {
    whereStatus.status = { in: statusParams };
  }

  const whereAssignee: { assignedToUserId?: string | null } = {};
  if (assignee === "me") whereAssignee.assignedToUserId = ctx.user.id;
  else if (assignee === "unassigned") whereAssignee.assignedToUserId = null;
  else if (assignee) whereAssignee.assignedToUserId = assignee;

  const whereSearch = q
    ? {
        OR: [
          { referenceNumber: { contains: q, mode: "insensitive" as const } },
          { client: { email: { contains: q, mode: "insensitive" as const } } },
          { client: { lastName: { contains: q, mode: "insensitive" as const } } },
          { client: { firstName: { contains: q, mode: "insensitive" as const } } },
          { client: { country: { contains: q, mode: "insensitive" as const } } },
        ],
      }
    : {};

  const rows = await prisma.request.findMany({
    where: {
      organizationId: ctx.organization.id,
      ...whereStatus,
      ...whereAssignee,
      ...whereSearch,
    },
    include: {
      client: {
        select: { id: true, email: true, firstName: true, lastName: true, country: true },
      },
      assignedTo: {
        select: { id: true, name: true, email: true },
      },
      _count: { select: { proposals: true, notes: true } },
    },
    orderBy: { receivedAt: "desc" },
    take: limit,
  });

  // Stage counts for the sidebar (New 5 · Working 3 · Open 10 · ...).
  // Single grouped query so the pipeline UI can render without a fan-out.
  const counts = await prisma.request.groupBy({
    by: ["status"],
    where: { organizationId: ctx.organization.id },
    _count: { _all: true },
  });
  const stageCounts = Object.fromEntries(counts.map((c) => [c.status, c._count._all]));

  return NextResponse.json({ requests: rows, stageCounts });
}

// ─── POST /api/requests ───────────────────────────────────────────────────
//
// Body:
//   {
//     client: { email, firstName?, lastName?, salutation?, phone?, country?,
//               origin?, preferredLanguage? },
//     source?, sourceDetail?,
//     tripBrief?: { nights?, destinations?, travelers?, dates?, style?, note? },
//     originalMessage?: string,
//     assignedToUserId?: string,
//   }
//
// Behaviour:
//   - Client is dedup'd by (orgId, email). Second submission with same email
//     updates the client record's missing fields + links the new request.
//   - referenceNumber is generated server-side.
//   - status starts at "new".

export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ctx.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }
  if (!ctx.orgActive) {
    return NextResponse.json({ error: "Account suspended", code: "ORG_SUSPENDED" }, { status: 402 });
  }

  let body: CreateRequestBody;
  try {
    body = (await req.json()) as CreateRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = body.client?.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "client.email is required" }, { status: 400 });
  }

  // Upsert the client by (orgId, email). Fills in missing fields only — we
  // never overwrite a field the operator has already set manually.
  const existing = await prisma.client.findUnique({
    where: { organizationId_email: { organizationId: ctx.organization.id, email } },
  });
  const client = existing
    ? await prisma.client.update({
        where: { id: existing.id },
        data: {
          firstName: existing.firstName ?? body.client?.firstName ?? null,
          lastName: existing.lastName ?? body.client?.lastName ?? null,
          salutation: existing.salutation ?? body.client?.salutation ?? null,
          phone: existing.phone ?? body.client?.phone ?? null,
          country: existing.country ?? body.client?.country ?? null,
          origin: existing.origin ?? body.client?.origin ?? null,
          preferredLanguage:
            existing.preferredLanguage ?? body.client?.preferredLanguage ?? null,
        },
      })
    : await prisma.client.create({
        data: {
          organizationId: ctx.organization.id,
          email,
          firstName: body.client?.firstName?.trim() || null,
          lastName: body.client?.lastName?.trim() || null,
          salutation: body.client?.salutation?.trim() || null,
          phone: body.client?.phone?.trim() || null,
          country: body.client?.country?.trim() || null,
          origin: body.client?.origin?.trim() || null,
          preferredLanguage: body.client?.preferredLanguage?.trim() || null,
        },
      });

  const referenceNumber = await nextRequestReferenceNumber(ctx.organization.id);
  const now = new Date();

  const request = await prisma.request.create({
    data: {
      organizationId: ctx.organization.id,
      referenceNumber,
      status: "new",
      clientId: client.id,
      assignedToUserId: body.assignedToUserId?.trim() || null,
      assignedAt: body.assignedToUserId ? now : null,
      source: body.source?.trim() || null,
      sourceDetail: body.sourceDetail?.trim() || null,
      tripBrief: (body.tripBrief ?? Prisma.DbNull) as Prisma.InputJsonValue | typeof Prisma.DbNull,
      originalMessage: body.originalMessage?.trim() || null,
      receivedAt: now,
      lastActivityAt: now,
    },
    include: {
      client: true,
      assignedTo: { select: { id: true, name: true, email: true } },
    },
  });

  // System note for the feed — "Request received · source: SafariBookings".
  await prisma.requestNote.create({
    data: {
      requestId: request.id,
      kind: "system",
      body: body.source
        ? `Request received via ${body.source}.`
        : "Request received.",
    },
  });

  await recordActivity({
    userId: ctx.user.id,
    organizationId: ctx.organization.id,
    type: "createRequest",
    targetType: "request",
    targetId: request.id,
    detail: { referenceNumber, source: body.source ?? null },
  });

  // Fire-and-forget — don't await email delivery; it runs best-effort.
  void notifyNewRequest({
    organizationId: ctx.organization.id,
    requestId: request.id,
    referenceNumber,
    createdByUserId: ctx.user.id,
    clientName: [client.firstName, client.lastName].filter(Boolean).join(" ").trim() || null,
    clientEmail: client.email,
    source: body.source ?? null,
    tripSummary: [
      body.tripBrief?.nights ? `${body.tripBrief.nights} nights` : null,
      Array.isArray(body.tripBrief?.destinations) ? body.tripBrief!.destinations!.slice(0, 3).join(" · ") : null,
    ].filter(Boolean).join(" · ") || null,
  });

  return NextResponse.json({ request }, { status: 201 });
}

// ─── Types ────────────────────────────────────────────────────────────────

type CreateRequestBody = {
  client?: {
    email?: string;
    firstName?: string;
    lastName?: string;
    salutation?: string;
    phone?: string;
    country?: string;
    origin?: string;
    preferredLanguage?: string;
  };
  source?: string;
  sourceDetail?: string;
  tripBrief?: Record<string, unknown>;
  originalMessage?: string;
  assignedToUserId?: string;
};

function clampInt(v: string | null, min: number, max: number, fallback: number): number {
  if (!v) return fallback;
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}
