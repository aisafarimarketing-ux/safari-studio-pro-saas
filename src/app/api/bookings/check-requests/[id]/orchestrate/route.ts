import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { friendlyConsultantName } from "@/lib/consultantIdentity";
import {
  formatAlternativeOfferMessage,
  formatAlternativeRequestMessage,
  formatBookingCheckFollowUp,
  formatBookingCheckUrgent,
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
  // Pre-render the draft the operator would dispatch on the NEXT
  // attempt. attempt 1 sent → next would be #2 (gentle). attempt 2
  // sent → next would be #3 (urgent). The draft is identical to what
  // the PATCH `record_followup_sent` action will write into the row,
  // so the operator's preview matches what gets persisted.
  const nextAttempt = (row.attemptCount ?? 1) + 1;
  const followUpDraft =
    nextAttempt >= 3
      ? formatBookingCheckUrgent(messageInput)
      : formatBookingCheckFollowUp(messageInput);

  // ── Alternative properties ──────────────────────────────────────────
  // Only resolved when the row is not_available — otherwise we skip
  // the query to keep the orchestrate call cheap.
  let alternatives: Awaited<ReturnType<typeof findAlternativeProperties>> = [];
  if (row.status === "not_available") {
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
  let alternativeRequest: string | null = null;
  if (row.status === "not_available" && alternatives.length > 0) {
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
