import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { friendlyConsultantName } from "@/lib/consultantIdentity";
import {
  formatAlternativeOfferMessage,
  formatAlternativeRequestMessage,
  formatBookingCheckFollowUp,
  formatGoodNewsMessage,
} from "@/lib/bookingOps/format";
import {
  deriveNextAction,
  deriveSuggestedAction,
  findAlternativeProperties,
  type NextAction,
  type SuggestedAction,
} from "@/lib/bookingOps/orchestrate";
import type { TierKey } from "@/lib/types";
import { displayTrackingId } from "@/lib/proposalTracking";

// GET /api/bookings/check-requests/[id]/orchestrate
//
// Returns the full guided-action payload for one BookingCheckRequest:
//   - nextAction         — the recommended next step (kind + hint)
//   - followUpDraft      — the right cadence variant (gentle vs urgent)
//                          for the next follow-up dispatch
//   - clientGoodNews     — operator-paste message when status=available
//   - clientAlternatives — operator-paste message when status=not_available
//   - alternatives       — up to 2 alternative camp suggestions
//   - alternativeRequest — outbound draft for the alternative camp
//                          (uses the FIRST alternative; null when none)
//
// All deterministic. Server pulls everything in one call so the UI
// doesn't have to choreograph multiple round trips per row.

export async function GET(
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

  const row = await prisma.bookingCheckRequest.findFirst({
    where: { id, organizationId: orgId },
    include: {
      proposal: {
        select: {
          id: true,
          title: true,
          trackingId: true,
          client: {
            select: { firstName: true, lastName: true },
          },
        },
      },
    },
  });
  if (!row) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const now = new Date();
  const nextAction: NextAction = deriveNextAction(
    {
      status: row.status,
      sentAt: row.sentAt,
      nextActionAt: row.nextActionAt,
      attemptCount: row.attemptCount,
    },
    now,
  );
  const suggestedAction: SuggestedAction = deriveSuggestedAction(
    { status: row.status, nextActionAt: row.nextActionAt },
    now,
  );

  const operatorFirstName =
    friendlyConsultantName({ name: auth.user.name, email: auth.user.email })
      .split(/\s+/)[0] || null;

  const tierKey: TierKey | null =
    row.tierKey === "classic" || row.tierKey === "premier" || row.tierKey === "signature"
      ? (row.tierKey as TierKey)
      : null;

  const messageInput = {
    propertyName: row.propertyName,
    destination: row.destination,
    tierKey,
    checkInDate: row.checkInDate,
    checkOutDate: row.checkOutDate,
    nights: row.nights,
    adults: row.adults,
    children: row.children,
    roomingNotes: row.roomingNotes,
    tripTitle: row.proposal.title ?? "your safari",
    bookingReference: displayTrackingId({
      id: row.proposal.id,
      trackingId: row.proposal.trackingId,
    }),
    operatorFirstName,
  };

  // ── Follow-up draft ──────────────────────────────────────────────────
  // Pre-render the gentle draft the operator would dispatch on the
  // NEXT attempt — but only when a follow-up is actually the right
  // move. Once attemptCount reaches 2 the cadence escalates instead
  // (call or switch) and we suppress the draft so the UI doesn't
  // accidentally surface a third write button.
  const followUpDraft =
    nextAction.kind === "send_followup" || nextAction.kind === "send_followup_now"
      ? formatBookingCheckFollowUp(messageInput)
      : null;

  // ── Alternative properties ──────────────────────────────────────────
  // Resolved when the row is genuinely stuck — explicitly
  // not_available OR in the escalation phase (two follow-ups out
  // and still nothing). The escalation case wants alternatives
  // visible so the operator can choose between calling and
  // switching without an extra round trip.
  const wantsAlternatives =
    row.status === "not_available" || nextAction.kind === "escalate";
  let alternatives: Awaited<ReturnType<typeof findAlternativeProperties>> = [];
  if (wantsAlternatives) {
    alternatives = await findAlternativeProperties({
      organizationId: orgId,
      destination: row.destination,
      tierKey: row.tierKey,
      excludeName: row.propertyName,
      excludeProposalId: row.proposalId,
    });
  }

  // ── Client-facing message ──────────────────────────────────────────
  const clientFirstName = row.proposal.client?.firstName?.trim() || "there";
  let clientGoodNews: string | null = null;
  let clientAlternatives: string | null = null;
  if (row.status === "available") {
    clientGoodNews = formatGoodNewsMessage({
      clientFirstName,
      propertyName: row.propertyName,
      destination: row.destination,
      checkInDate: row.checkInDate,
      checkOutDate: row.checkOutDate,
      nights: row.nights,
      operatorFirstName,
    });
  } else if (row.status === "not_available") {
    clientAlternatives = formatAlternativeOfferMessage({
      clientFirstName,
      originalProperty: row.propertyName,
      destination: row.destination,
      checkInDate: row.checkInDate,
      checkOutDate: row.checkOutDate,
      alternatives: alternatives.map((a) => a.name),
      operatorFirstName,
    });
  }

  // ── Outbound to first alternative (when applicable) ─────────────────
  // Now also generated when in the escalation phase so the operator
  // has a ready-to-paste outbound if they choose "switch" over
  // "call".
  let alternativeRequest: string | null = null;
  if (wantsAlternatives && alternatives.length > 0) {
    const first = alternatives[0];
    alternativeRequest = formatAlternativeRequestMessage({
      ...messageInput,
      propertyName: first.name,
      destination: first.destination ?? row.destination,
      replacingProperty: row.propertyName,
    });
  }

  return NextResponse.json({
    nextAction,
    suggestedAction,
    followUpDraft,
    alternatives,
    alternativeRequest,
    clientGoodNews,
    clientAlternatives,
  });
}
