import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { buildBlankProposal } from "@/lib/defaults";
import { recordActivity } from "@/lib/activity";

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

  // Pull brandDNA once so the operator block has real branding on the
  // first draft instead of the blank placeholders.
  const brandDNA = await prisma.brandDNAProfile.findUnique({
    where: { organizationId: ctx.organization.id },
    select: { brandName: true, logoUrl: true },
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

  // Metadata + trip
  const tripTitle = brief.title?.trim() || `${clientName} Safari`;
  proposal.metadata.title = tripTitle;
  proposal.trip.title = tripTitle;
  proposal.trip.nights = brief.nights ?? 0;
  proposal.trip.destinations = Array.isArray(brief.destinations) ? brief.destinations : [];
  proposal.trip.tripStyle = brief.style ?? "Mid-range";
  proposal.trip.dates = brief.dates ?? "";
  proposal.trip.subtitle = [
    brief.nights ? `${brief.nights} night${brief.nights === 1 ? "" : "s"}` : null,
    proposal.trip.destinations.slice(0, 3).join(" · ") || null,
  ].filter(Boolean).join(" · ");
  if (brief.operatorNote?.trim()) {
    proposal.trip.operatorNote = brief.operatorNote.trim();
  }

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

  // Operator — seed from the user + brand DNA so the first paint isn't empty.
  if (ctx.user.name) proposal.operator.consultantName = ctx.user.name;
  if (ctx.user.email) proposal.operator.email = ctx.user.email;
  if (brandDNA?.brandName) proposal.operator.companyName = brandDNA.brandName;
  if (brandDNA?.logoUrl) proposal.operator.logoUrl = brandDNA.logoUrl;

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
    },
    select: { id: true, title: true, createdAt: true },
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
