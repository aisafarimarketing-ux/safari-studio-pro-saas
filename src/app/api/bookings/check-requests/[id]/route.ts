import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { friendlyConsultantName } from "@/lib/consultantIdentity";
import { formatBookingCheckFollowUp } from "@/lib/bookingOps/format";
import {
  computeNextActionAt,
  deriveSuggestedAction,
} from "@/lib/bookingOps/orchestrate";
import { displayTrackingId } from "@/lib/proposalTracking";
import type { TierKey } from "@/lib/types";

// PATCH /api/bookings/check-requests/[id]
//
// Operator-driven status transitions and notes updates for one
// BookingCheckRequest row. v1 keeps this dumb: the operator picks
// the next status, we set the matching timestamp + adjust the
// orchestration fields (nextActionAt, attemptCount). No automatic
// transitions, no reply parsing — those land in v2.
//
// Body shape:
//   {
//     status?: "not_sent" | "sent" | "replied" | "available"
//            | "not_available" | "follow_up_needed",
//     notes?: string,
//     draftText?: string,   // operator-edited copy
//     action?: "record_followup_sent",  // marks a follow-up as
//                                        // dispatched: bumps
//                                        // attemptCount + resets
//                                        // nextActionAt + replaces
//                                        // draftText with the next
//                                        // variant in the cadence.
//   }
//
// Side effects per status:
//   - "sent"           → sentAt = now if not already set
//                        attemptCount = max(1, current)
//                        nextActionAt = now + 24h
//   - "replied"        → repliedAt = now if not already set
//                        nextActionAt = null
//   - "available"      → repliedAt set + resolvedAt = now
//                        nextActionAt = null
//   - "not_available"  → repliedAt set + resolvedAt = now
//                        nextActionAt = null
//   - "follow_up_needed" → nextActionAt = now (so the UI flags it
//                          as overdue immediately)
//   - "not_sent"       → clears all timestamps + attemptCount = 0

const ALLOWED_STATUSES = new Set([
  "not_sent",
  "sent",
  "replied",
  "available",
  "not_available",
  "follow_up_needed",
]);

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!auth.organization) {
    return NextResponse.json({ error: "No active organization." }, { status: 409 });
  }
  const orgId = auth.organization.id;

  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "id required." }, { status: 400 });
  }

  let body: {
    status?: string;
    notes?: string;
    draftText?: string;
    action?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const existing = await prisma.bookingCheckRequest.findFirst({
    where: { id, organizationId: orgId },
    select: {
      id: true,
      status: true,
      sentAt: true,
      lastSentAt: true,
      repliedAt: true,
      attemptCount: true,
      nextActionAt: true,
      proposalId: true,
      propertyName: true,
      destination: true,
      tierKey: true,
      checkInDate: true,
      checkOutDate: true,
      nights: true,
      adults: true,
      children: true,
      roomingNotes: true,
    },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (typeof body.notes === "string") {
    // Cap notes hard so a runaway paste can't bloat the row.
    data.notes = body.notes.slice(0, 4000);
  }
  if (typeof body.draftText === "string") {
    data.draftText = body.draftText.slice(0, 8000);
  }
  const now = new Date();
  if (typeof body.status === "string") {
    if (!ALLOWED_STATUSES.has(body.status)) {
      return NextResponse.json({ error: `Invalid status "${body.status}".` }, { status: 400 });
    }
    data.status = body.status;
    switch (body.status) {
      case "sent": {
        if (!existing.sentAt) data.sentAt = now;
        // Initial send always touches lastSentAt — even when sentAt
        // was already set (idempotent re-send), the operator just
        // dispatched, so the cadence clock restarts here.
        data.lastSentAt = now;
        // attemptCount jumps to 1 on the initial send; the
        // record_followup_sent action below handles the bumps for
        // every subsequent dispatch.
        const nextAttempt = existing.attemptCount < 1 ? 1 : existing.attemptCount;
        if (existing.attemptCount < 1) data.attemptCount = 1;
        data.nextActionAt = computeNextActionAt(nextAttempt, now);
        break;
      }
      case "replied":
        if (!existing.repliedAt) data.repliedAt = now;
        data.nextActionAt = null;
        break;
      case "available":
      case "not_available":
        if (!existing.repliedAt) data.repliedAt = now;
        data.resolvedAt = now;
        data.nextActionAt = null;
        break;
      case "not_sent":
        // Operator manually reverted — clear all the timeline
        // fields so the row matches the visible "fresh" state.
        data.sentAt = null;
        data.lastSentAt = null;
        data.repliedAt = null;
        data.resolvedAt = null;
        data.nextActionAt = null;
        data.attemptCount = 0;
        break;
      case "follow_up_needed":
        // Operator-flagged stall. Set nextActionAt = now so the UI
        // sees this as "overdue" immediately and the next-action
        // hint reads "send the follow-up message you flagged".
        data.nextActionAt = now;
        break;
    }
  }

  // ── Action: record_followup_sent ────────────────────────────────────
  // The operator clicked "Send follow-up" → the UI fires this action
  // after copying / dispatching. We bump attemptCount, advance
  // nextActionAt with cadence (24h for attempt 1, 48h for attempt 2),
  // and rewrite draftText to a gentle follow-up. Status stays
  // "sent" — the row is still awaiting reply, just a follow-up later.
  //
  // Hard cap at attempt 2: two messages already out is the
  // escalation threshold. A third follow-up tends to feel like
  // pestering, so we refuse — the orchestrate hint guides the
  // operator to call the property or switch to an alternative.
  if (body.action === "record_followup_sent") {
    if ((existing.attemptCount ?? 0) >= 2) {
      return NextResponse.json(
        {
          error:
            "Two follow-ups have already been sent. Time to call the property or switch to an alternative.",
        },
        { status: 422 },
      );
    }
    // Pull the trip + booking ref so the regenerated draft matches
    // what the initial send used. Single extra query, only fires on
    // this action path.
    const proposal = await prisma.proposal.findFirst({
      where: { id: existing.proposalId, organizationId: orgId },
      select: { id: true, title: true, trackingId: true },
    });
    if (!proposal) {
      return NextResponse.json({ error: "Proposal not found." }, { status: 404 });
    }
    const operatorFirstName =
      friendlyConsultantName({ name: auth.user.name, email: auth.user.email })
        .split(/\s+/)[0] || null;
    const tierKey = (existing.tierKey === "classic" || existing.tierKey === "premier" || existing.tierKey === "signature")
      ? (existing.tierKey as TierKey)
      : null;
    const messageInput = {
      propertyName: existing.propertyName,
      destination: existing.destination,
      tierKey,
      checkInDate: existing.checkInDate,
      checkOutDate: existing.checkOutDate,
      nights: existing.nights,
      adults: existing.adults,
      children: existing.children,
      roomingNotes: existing.roomingNotes,
      tripTitle: proposal.title ?? "your safari",
      bookingReference: displayTrackingId({
        id: proposal.id,
        trackingId: proposal.trackingId,
      }),
      operatorFirstName,
    };
    // Always the gentle variant — attempt 2 is the last follow-up
    // we'll generate. The urgent escalation copy is no longer
    // produced; instead the UI surfaces "call or switch" guidance.
    const followUpDraft = formatBookingCheckFollowUp(messageInput);
    const nextAttempt = (existing.attemptCount ?? 1) + 1;
    data.attemptCount = nextAttempt;
    data.lastSentAt = now;
    // Cadence widens after the first follow-up (attempt 2 → +48h)
    // so a pinged property gets breathing room before the
    // operator-side escalation kicks in.
    data.nextActionAt = computeNextActionAt(nextAttempt, now);
    data.draftText = followUpDraft;
    // Status: if the operator was on follow_up_needed, flip back to
    // sent now that they've actually sent the follow-up.
    if (existing.status === "follow_up_needed") data.status = "sent";
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update." }, { status: 400 });
  }

  const updated = await prisma.bookingCheckRequest.update({
    where: { id },
    data,
  });

  return NextResponse.json({
    row: {
      id: updated.id,
      propertyName: updated.propertyName,
      destination: updated.destination,
      tierKey: updated.tierKey,
      checkInDate: updated.checkInDate.toISOString(),
      checkOutDate: updated.checkOutDate.toISOString(),
      nights: updated.nights,
      adults: updated.adults,
      children: updated.children,
      roomingNotes: updated.roomingNotes,
      draftText: updated.draftText,
      status: updated.status,
      sentAt: updated.sentAt?.toISOString() ?? null,
      lastSentAt: updated.lastSentAt?.toISOString() ?? null,
      repliedAt: updated.repliedAt?.toISOString() ?? null,
      resolvedAt: updated.resolvedAt?.toISOString() ?? null,
      attemptCount: updated.attemptCount,
      nextActionAt: updated.nextActionAt?.toISOString() ?? null,
      suggestedAction: deriveSuggestedAction(
        { status: updated.status, nextActionAt: updated.nextActionAt },
        new Date(),
      ),
      notes: updated.notes,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    },
  });
}
