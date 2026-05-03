import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyReservationReceived } from "@/lib/notifications";
import { recordProposalEvent } from "@/lib/proposalActivity";
import { displayTrackingId } from "@/lib/proposalTracking";

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
  // We pull the consultant (proposal.user) and the proposal's
  // request/client links so the post-create internal-message snapshot
  // and email fan-out can run without a second round-trip.
  const proposal = await prisma.proposal.findUnique({
    where: { id },
    select: {
      id: true,
      organizationId: true,
      userId: true,
      title: true,
      trackingId: true,
      requestId: true,
      clientId: true,
      user: { select: { email: true, name: true } },
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
  // notification routing picks them up automatically.
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

  const clientFullName = `${firstName} ${lastName}`.trim();
  const trackingId = displayTrackingId(proposal);
  const tripTitle = proposal.title?.trim() || "Untitled proposal";

  // ── Org-level activity event ────────────────────────────────────────────
  // Authoritative reservation_completed write — the dialog's
  // client-side track() call also fires this kind, but the track route
  // intentionally drops it on the floor so the score doesn't double-
  // count. This server-side path is the single source of truth.
  try {
    await recordProposalEvent({
      organizationId: proposal.organizationId,
      proposalId: proposal.id,
      clientId: proposal.clientId ?? null,
      eventType: "reservation_completed",
      metadata: {
        reservationId: reservation.id,
        sessionId: sessionId ?? null,
      },
    });
  } catch (err) {
    // Reservation row is already persisted; activity log is the
    // soft path. Logged so a recurring failure surfaces.
    console.warn("[reserve] recordProposalEvent failed:", err, {
      reservationId: reservation.id,
    });
  }

  // ── Pipeline stage bump ────────────────────────────────────────────────
  // Move the linked Request from "new"/"working" to "open" — the
  // closest existing status that maps to "booking requested but
  // not yet operator-confirmed". Skip when the Request has already
  // moved past "open" (booked / completed / not_booked) so we never
  // regress the pipeline. lastActivityAt bumps so the inbox sort
  // surfaces this booking. Best-effort.
  if (proposal.requestId) {
    try {
      await prisma.request.updateMany({
        where: {
          id: proposal.requestId,
          status: { in: ["new", "working"] },
        },
        data: { status: "open", lastActivityAt: new Date() },
      });
      // Always bump lastActivityAt even if status didn't change, so
      // the inbox surfaces the new reservation activity at the top.
      await prisma.request.update({
        where: { id: proposal.requestId },
        data: { lastActivityAt: new Date() },
      });
    } catch (err) {
      console.warn("[reserve] Request status bump failed:", err, {
        requestId: proposal.requestId,
        reservationId: reservation.id,
      });
    }
  }

  // ── Internal copy — Message row for inbox visibility ────────────────────
  // Stores a snapshot of the booking as a system-channel inbound
  // message so the future inbox UI can render it conversation-style
  // without re-querying the ProposalReservation table. We attach
  // requestId / clientId when the proposal carries those links so the
  // existing per-request and per-client message threads pick the row
  // up automatically. Best-effort — a failure here doesn't block the
  // 200 response to the client.
  try {
    const messageBody = [
      `Reservation #${trackingId} — ${clientFullName}`,
      `Trip: ${tripTitle}`,
      `Phone: ${phone}`,
      `Email: ${email}`,
      nationality ? `Nationality: ${nationality}` : null,
      `Arrival: ${arrivalDate.toISOString().slice(0, 10)}`,
      `Departure: ${departureDate.toISOString().slice(0, 10)}`,
      travelers ? `Travelers: ${travelers}` : null,
      notes ? `Notes: ${notes}` : null,
      `Reservation ID: ${reservation.id}`,
    ]
      .filter(Boolean)
      .join("\n");

    await prisma.message.create({
      data: {
        organizationId: proposal.organizationId,
        requestId: proposal.requestId ?? null,
        clientId: proposal.clientId ?? null,
        direction: "inbound",
        channel: "system",
        subject: `Reservation #${trackingId} — ${clientFullName}`,
        body: messageBody,
        status: "received",
      },
    });
  } catch (err) {
    // Reservation already persisted; the dashboard list reads from
    // ProposalReservation directly so visibility is preserved even if
    // this snapshot fails. Logged so a recurring failure surfaces.
    console.warn(
      "[reserve] internal Message snapshot failed:",
      err,
      { reservationId: reservation.id, proposalId: proposal.id },
    );
  }

  // ── Email fan-out ──────────────────────────────────────────────────────
  // We await delivery so the response can carry an honest status —
  // previously this was fire-and-forget and the dialog claimed
  // "sent to <consultant>" even when RESEND_API_KEY wasn't
  // configured and the mailer silently skipped. Bounded by a 5s
  // timeout: if Resend hangs, we return "delayed" and let the
  // promise keep running in the background (Node lifetime on
  // Railway will still complete it).
  const notifyPromise = notifyReservationReceived({
    organizationId: proposal.organizationId,
    proposalId: proposal.id,
    trackingId,
    proposalTitle: proposal.title,
    reservationId: reservation.id,
    consultantEmail: proposal.user?.email ?? null,
    consultantName: proposal.user?.name ?? null,
    clientName: clientFullName,
    clientEmail: email,
    clientPhone: phone,
    nationality: nationality ?? null,
    arrivalDate,
    departureDate,
    travelers,
    notes: notes ?? null,
  });

  const delivery = await Promise.race([
    notifyPromise,
    new Promise<{ status: "delayed" }>((resolve) =>
      setTimeout(() => resolve({ status: "delayed" }), 5_000),
    ),
  ]);

  if (delivery.status === "delayed") {
    console.warn(
      `[reserve] email delivery >5s for reservation ${reservation.id} — let promise continue in background.`,
    );
    // Don't await — the promise keeps the connection-less work alive
    // until Resend responds; we just stop blocking the HTTP response.
    // When it eventually settles, persist the real status so the
    // dashboard chip flips from "delayed" to the final state.
    notifyPromise
      .then((finalDelivery) => {
        return prisma.proposalReservation
          .update({
            where: { id: reservation.id },
            data: { emailStatus: finalDelivery.status },
          })
          .catch((err) => {
            console.warn(
              "[reserve] background emailStatus update failed:",
              err,
              { reservationId: reservation.id },
            );
          });
      })
      .catch((err) => {
        console.warn("[reserve] background email finally failed:", err);
      });
  }

  // Persist whatever we know now — "sent" / "skipped" / "no-recipient"
  // / "failed" / "delayed". A later background settle (above) may
  // overwrite this with the final status if the race timed out.
  try {
    await prisma.proposalReservation.update({
      where: { id: reservation.id },
      data: { emailStatus: delivery.status },
    });
  } catch (err) {
    console.warn("[reserve] emailStatus persist failed:", err, {
      reservationId: reservation.id,
      status: delivery.status,
    });
  }

  return NextResponse.json({
    ok: true,
    reservationId: reservation.id,
    // Surface delivery state so the dialog can render honest success
    // copy (sent / received-but-not-emailed / received-emailed-late).
    emailDelivery: delivery,
  });
}
