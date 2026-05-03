import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { buildBlankProposal } from "@/lib/defaults";
import { recordActivity } from "@/lib/activity";
import { nextProposalTrackingId } from "@/lib/proposalTracking";
import { inferTripDuration, seedBlankDays } from "@/lib/tripDefaults";
import {
  applyIdentityToOperator,
  friendlyConsultantName,
} from "@/lib/consultantIdentity";

// POST /api/requests/[id]/quote
//
// Creates a new Proposal pre-populated from the request's client + trip
// brief, linked back to the request via Proposal.requestId + clientId.
// The operator is dropped into the editor on the returned proposalId and
// can click "Automate" to run the AI autopilot from there (same as the
// existing Trip Setup flow) — we don't auto-run AI here to keep the
// endpoint fast and synchronous.
//
// Returns: { proposalId, proposal } — caller redirects to /studio/<id>.

export async function POST(
  _req: Request,
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
    include: { client: true },
  });
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Pull brandDNA + the consultant's per-org membership so the
  // operator block opens fully branded — company name + logo from
  // the org's Brand DNA, plus the drafter's photo / role / signature
  // / WhatsApp from their OrgMembership profile. This is the
  // "premium feel" fix: every new quote ships with the operator's
  // actual identity rather than placeholder text the operator has
  // to fill in by hand.
  const brandDNA = await prisma.brandDNAProfile.findUnique({
    where: { organizationId: ctx.organization.id },
    select: { brandName: true, logoUrl: true },
  });
  const membership = await prisma.orgMembership.findFirst({
    where: { organizationId: ctx.organization.id, userId: ctx.user.id },
    select: {
      roleTitle: true,
      profilePhotoUrl: true,
      signatureUrl: true,
      whatsapp: true,
    },
  });

  // Compose the blank proposal skeleton and overlay request data.
  const proposal = buildBlankProposal();

  const clientName = [request.client?.firstName, request.client?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim() || request.client?.email || "New Guest";

  const brief = (request.tripBrief ?? {}) as {
    title?: string;
    nights?: number;
    travelers?: number;
    destinations?: string[];
    dates?: string;
    style?: string;
    operatorNote?: string;
  };

  // Metadata + trip — funnel everything through inferTripDuration so a
  // request without explicit nights/dates still produces a coherent
  // timeline. This was the source of the "blank day cards" bug:
  // brief.nights was undefined → trip.nights persisted as 0 → editor
  // opened with no day cards even though the operator had clear intent
  // (destinations, style) for a multi-day safari.
  const inferred = inferTripDuration({
    nights: brief.nights,
    dates: brief.dates,
    destinations: brief.destinations,
    style: brief.style,
  });
  const tripTitle = brief.title?.trim() || `${clientName} Safari`;
  proposal.metadata.title = tripTitle;
  proposal.trip.title = tripTitle;
  proposal.trip.nights = inferred.nights;
  proposal.trip.destinations = inferred.destinations;
  proposal.trip.tripStyle = inferred.tripStyle;
  proposal.trip.dates = inferred.dates;
  proposal.trip.subtitle = [
    `${inferred.nights} night${inferred.nights === 1 ? "" : "s"}`,
    proposal.trip.destinations.slice(0, 3).join(" · ") || null,
  ].filter(Boolean).join(" · ");
  if (brief.operatorNote?.trim()) {
    proposal.trip.operatorNote = brief.operatorNote.trim();
  }

  // Seed real day cards so the editor opens with a usable timeline,
  // not an empty list. Destinations are spread across days; narratives
  // stay blank for the operator (or the autopilot) to fill in. The
  // arrival / departure subtitles on the first and last day make the
  // shape read sensibly even pre-AI.
  proposal.days = seedBlankDays(inferred.nights, inferred.destinations);

  // Client
  proposal.client.guestNames = clientName;
  if (request.client?.email) proposal.client.email = request.client.email;
  if (typeof brief.travelers === "number" && brief.travelers > 0) {
    proposal.client.pax = `${brief.travelers} ${brief.travelers === 1 ? "traveller" : "travellers"}`;
    proposal.client.adults = brief.travelers;
  }
  if (request.client?.origin) proposal.client.origin = request.client.origin;

  // Active tier from style
  const style = brief.style?.toLowerCase() ?? "";
  if (style.includes("luxury") || style.includes("signature")) proposal.activeTier = "signature";
  else if (style.includes("classic") || style.includes("value")) proposal.activeTier = "classic";
  else proposal.activeTier = "premier";

  // Operator — full identity overlay. friendlyConsultantName guards
  // against the legacy User.name === email rows by picking up the
  // email's local-part as a polished fallback. Brand DNA fills the
  // company name + logo on top so the proposal never opens with the
  // generic blank operator card.
  proposal.operator = applyIdentityToOperator(proposal.operator, {
    name: friendlyConsultantName({ name: ctx.user.name, email: ctx.user.email }),
    email: ctx.user.email ?? null,
    roleTitle: membership?.roleTitle?.trim() || null,
    photoUrl: membership?.profilePhotoUrl?.trim() || null,
    signatureUrl: membership?.signatureUrl?.trim() || null,
    whatsapp: membership?.whatsapp?.trim() || null,
  });
  if (brandDNA?.brandName) proposal.operator.companyName = brandDNA.brandName;
  if (brandDNA?.logoUrl) proposal.operator.logoUrl = brandDNA.logoUrl;

  // Allocate a tracking id ("PRO-2026-0042") for the new proposal.
  // Best-effort — null trackingId still saves and reads fall back.
  let trackingId: string | undefined;
  try {
    trackingId = await nextProposalTrackingId(ctx.organization.id);
  } catch (err) {
    console.warn("[requests/quote] trackingId allocation failed:", err);
  }

  // Persist. Both requestId + clientId are set so the proposal ties back
  // to the CRM pipeline. status stays "draft".
  const saved = await prisma.proposal.create({
    data: {
      id: proposal.id,
      userId: ctx.user.id,
      organizationId: ctx.organization.id,
      title: tripTitle,
      status: "draft",
      contentJson: proposal as unknown as Prisma.InputJsonValue,
      requestId: request.id,
      clientId: request.client?.id ?? null,
      ...(trackingId ? { trackingId } : {}),
    },
    select: { id: true, title: true, trackingId: true, createdAt: true },
  });

  // System note on the request feed + activity event.
  await prisma.requestNote.create({
    data: {
      requestId: request.id,
      kind: "system",
      authorUserId: ctx.user.id,
      body: `Quote "${tripTitle}" created.`,
    },
  });
  // Bump lastActivityAt + firstReplyAt (if not already set) — creating a
  // quote is definitely a first reply.
  await prisma.request.update({
    where: { id: request.id },
    data: {
      lastActivityAt: new Date(),
      firstReplyAt: request.firstReplyAt ?? new Date(),
      // Auto-advance out of "new" on first quote. The operator can change
      // back if they're just drafting speculatively.
      status: request.status === "new" ? "working" : request.status,
    },
  });

  await recordActivity({
    userId: ctx.user.id,
    organizationId: ctx.organization.id,
    type: "createQuote",
    targetType: "proposal",
    targetId: saved.id,
    detail: { requestId: request.id, referenceNumber: request.referenceNumber },
  });

  return NextResponse.json({ proposalId: saved.id, proposal: saved }, { status: 201 });
}
