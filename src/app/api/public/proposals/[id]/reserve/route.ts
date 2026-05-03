import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/public/proposals/:id/reserve
//
// Anonymous (no auth) — fired by the client-facing ReservationDialog
// inside /p/[id]. Persists a ProposalReservation row tied to the
// proposal and routes assignment to the consultant who created the
// proposal so notification emails / inbox entries land with the right
// person on the team.
//
// Body shape (all required except where noted):
//   {
//     firstName: string,
//     lastName: string,
//     email: string,
//     phone: string,
//     nationality?: string,
//     arrivalDate: string,    // ISO date
//     departureDate: string,  // ISO date
//     travelers?: string,     // free text
//     notes?: string,
//     sessionId?: string,     // matches the engagement-tracker session
//   }
//
// Returns: { ok: true, reservationId } on success.
// Validation errors return 400 with { error }; missing proposal → 404.
//
// Email notifications are fire-and-forget (kicked off here but not
// awaited in v1) — the operator will see the row in their inbox
// immediately even if SMTP is slow / down.

const MAX_TEXT = 2000;
const MAX_SHORT = 200;

function str(v: unknown, max = MAX_SHORT): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (t.length === 0) return null;
  return t.slice(0, max);
}

function parseDate(v: unknown): Date | null {
  if (typeof v !== "string") return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  // Proposal must exist and be public-shareable. Anyone with the URL
  // can reserve — same auth posture as the rest of /api/public.
  const proposal = await prisma.proposal.findUnique({
    where: { id },
    select: {
      id: true,
      organizationId: true,
      userId: true,
      title: true,
    },
  });
  if (!proposal) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!proposal.organizationId) {
    // Pre-org proposals can't carry a reservation row because the
    // model requires organizationId. Defensive — these are rare /
    // legacy.
    return NextResponse.json(
      { error: "Proposal is not bookable yet — contact the operator." },
      { status: 409 },
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const firstName = str(body.firstName);
  const lastName = str(body.lastName);
  const email = str(body.email);
  const phone = str(body.phone);
  const nationality = str(body.nationality);
  const arrivalDate = parseDate(body.arrivalDate);
  const departureDate = parseDate(body.departureDate);
  const travelers = str(body.travelers, MAX_TEXT) ?? "";
  const notes = str(body.notes, MAX_TEXT);
  const sessionId = str(body.sessionId, 64);

  // Required-field check. Errors come back as a single string the
  // dialog surfaces in a banner; per-field validation lives client-
  // side already so we can keep this terse.
  if (!firstName || !lastName) {
    return NextResponse.json(
      { error: "First and last name are required." },
      { status: 400 },
    );
  }
  if (!email || !email.includes("@")) {
    return NextResponse.json(
      { error: "A valid email address is required." },
      { status: 400 },
    );
  }
  if (!phone) {
    return NextResponse.json(
      { error: "A phone number is required so we can confirm your booking." },
      { status: 400 },
    );
  }
  if (!arrivalDate || !departureDate) {
    return NextResponse.json(
      { error: "Please pick both an arrival and a departure date." },
      { status: 400 },
    );
  }
  if (departureDate.getTime() < arrivalDate.getTime()) {
    return NextResponse.json(
      { error: "Departure date must be on or after the arrival date." },
      { status: 400 },
    );
  }

  // Persist. Assign to the consultant who created the proposal so
  // notification routing in v2 picks them up automatically.
  const reservation = await prisma.proposalReservation.create({
    data: {
      organizationId: proposal.organizationId,
      proposalId: proposal.id,
      firstName,
      lastName,
      email,
      phone,
      nationality: nationality ?? null,
      arrivalDate,
      departureDate,
      travelers,
      notes: notes ?? null,
      assignedUserId: proposal.userId,
      sessionId: sessionId ?? null,
    },
  });

  return NextResponse.json({ ok: true, reservationId: reservation.id });
}
