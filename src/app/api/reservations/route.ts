import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";

// ─── GET /api/reservations ─────────────────────────────────────────────────
// Lists the caller's reservations. Supports ?status= repeatable filter
// and ?limit=N (default 100, max 500). Defaults to all OPEN statuses
// (pending + sent + tentative) so the inbox-style view shows only what
// still needs attention.

const OPEN_STATUSES = ["pending", "sent", "tentative"];

export async function GET(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ctx.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }

  const url = new URL(req.url);
  const statuses = url.searchParams.getAll("status").filter(Boolean);
  const limit = clamp(url.searchParams.get("limit"), 1, 500, 100);

  const where: { organizationId: string; status?: { in: string[] } } = {
    organizationId: ctx.organization.id,
  };
  if (statuses.length === 0) {
    where.status = { in: OPEN_STATUSES };
  } else if (!statuses.includes("all")) {
    where.status = { in: statuses };
  }

  const reservations = await prisma.reservation.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      proposal: { select: { id: true, title: true } },
      property: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({ reservations });
}

// ─── POST /api/reservations ────────────────────────────────────────────────
// Creates a new reservation row. The operator sends the email out-of-band
// (usually via mailto: their own client) — this endpoint just records
// the intent so the status is tracked in-app. Status defaults to
// "pending" until operator flips to "sent".

type Body = {
  proposalId?: string;
  campName?: string;
  propertyId?: string;
  reservationsEmail?: string;
  guestName?: string;
  startDate?: string;
  endDate?: string;
  adults?: number;
  children?: number;
  roomConfig?: string;
  notes?: string;
};

export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ctx.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const campName = (body.campName ?? "").trim();
  const reservationsEmail = (body.reservationsEmail ?? "").trim().toLowerCase();
  const guestName = (body.guestName ?? "").trim();
  const startDate = parseDate(body.startDate);
  const endDate = parseDate(body.endDate);

  if (!campName) return NextResponse.json({ error: "campName is required" }, { status: 400 });
  if (!/^\S+@\S+\.\S+$/.test(reservationsEmail)) {
    return NextResponse.json({ error: "A valid reservationsEmail is required" }, { status: 400 });
  }
  if (!guestName) return NextResponse.json({ error: "guestName is required" }, { status: 400 });
  if (!startDate || !endDate || endDate <= startDate) {
    return NextResponse.json({ error: "Valid startDate and endDate are required (end must be after start)" }, { status: 400 });
  }

  // Optional proposal tenant-check: if the caller passes proposalId,
  // verify it belongs to their org. SetNull cascade lets us keep the
  // reservation if the proposal is later deleted, but we still need to
  // confirm ownership at creation.
  let proposalId: string | null = null;
  if (body.proposalId) {
    const proposal = await prisma.proposal.findFirst({
      where: { id: body.proposalId, organizationId: ctx.organization.id },
      select: { id: true },
    });
    if (!proposal) return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
    proposalId = proposal.id;
  }

  // Same for propertyId.
  let propertyId: string | null = null;
  if (body.propertyId) {
    const prop = await prisma.property.findFirst({
      where: { id: body.propertyId, organizationId: ctx.organization.id },
      select: { id: true },
    });
    if (prop) propertyId = prop.id;
  }

  const row = await prisma.reservation.create({
    data: {
      organizationId: ctx.organization.id,
      proposalId,
      propertyId,
      campName,
      reservationsEmail,
      guestName,
      startDate,
      endDate,
      adults: clamp(body.adults, 1, 30, 2),
      children: clamp(body.children, 0, 20, 0),
      roomConfig: body.roomConfig?.trim() || null,
      notes: body.notes?.trim() || null,
      createdByUserId: ctx.user.id,
      status: "pending",
    },
  });

  return NextResponse.json({ reservation: row });
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function parseDate(v: string | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function clamp(v: string | number | null | undefined, min: number, max: number, fallback: number): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseInt(v, 10) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}
