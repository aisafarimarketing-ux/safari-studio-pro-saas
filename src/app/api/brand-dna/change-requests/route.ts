import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";

// /api/brand-dna/change-requests
//
// Members file requests against brand-locked fields; admins / owners
// review them. Two verbs:
//
//   POST — any authed member. Creates a pending request with the
//          field name, current value, requested value, and an
//          optional reason. Org-scoped: the proposalId (when set)
//          must belong to the caller's org.
//   GET  — list. Admins / owners see every request in the org;
//          members see only their own. Sorted newest-first.
//
// The PATCH (decide) verb lives at /[id] so the route param is
// explicit. See ./[id]/route.ts.
//
// Application of an approved change is intentionally NOT automatic.
// Admins still need to fire the existing /api/brand-dna PUT (for
// org-default changes) or edit the proposal directly (for
// approved-once changes). The request row records the decision; the
// downstream write stays a deliberate operator click. A glitchy
// approval should never silently rewrite the company brand.

const ALLOWED_FIELD_NAMES = new Set([
  // Brand visuals
  "logoUrl",
  "brandColors",
  "headingFont",
  "bodyFont",
  "customFontUrl",
  "imageLibrary",
  "sectionStyles",
  "tagline",
  "shortDescription",
  // Send formats
  "greetingFormat",
  "signoffFormat",
  "whatsappSignatureFormat",
  "emailSignatureFormat",
  // Master template + voice
  "masterTemplateProposalId",
  "voiceFormality",
  "voiceLuxury",
  "voiceDensity",
  "voiceStorytelling",
  "aiInstructions",
  "preferredImageStyles",
  "tierBias",
  "styleBias",
]);

type CreateBody = {
  fieldName?: string;
  currentValue?: unknown;
  requestedValue?: unknown;
  reason?: string;
  proposalId?: string;
};

export async function POST(req: Request) {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!auth.organization) {
    return NextResponse.json({ error: "No active organization." }, { status: 409 });
  }
  const orgId = auth.organization.id;

  let body: CreateBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const fieldName = body.fieldName?.trim();
  if (!fieldName) {
    return NextResponse.json({ error: "fieldName is required." }, { status: 400 });
  }
  if (!ALLOWED_FIELD_NAMES.has(fieldName)) {
    return NextResponse.json(
      { error: `fieldName "${fieldName}" is not a brand-locked field.` },
      { status: 400 },
    );
  }
  if (body.requestedValue === undefined || body.requestedValue === null) {
    return NextResponse.json(
      { error: "requestedValue is required." },
      { status: 400 },
    );
  }

  // Cross-org guard: when proposalId is supplied, confirm it belongs
  // to the caller's org. A member who somehow knows another tenant's
  // proposalId can't file a request against it.
  let proposalId: string | null = null;
  if (body.proposalId) {
    const trimmed = body.proposalId.trim();
    if (trimmed) {
      const proposal = await prisma.proposal.findFirst({
        where: { id: trimmed, organizationId: orgId },
        select: { id: true },
      });
      if (!proposal) {
        return NextResponse.json(
          { error: "Proposal not found in this organization." },
          { status: 404 },
        );
      }
      proposalId = proposal.id;
    }
  }

  const reason =
    typeof body.reason === "string" ? body.reason.trim().slice(0, 1000) : null;

  // Prisma's nullable Json columns need the explicit sentinel
  // Prisma.JsonNull when we mean "store SQL NULL" (vs DbNull which
  // means "no input"). Avoids the TypeScript error from passing a
  // bare `null` literal.
  const created = await prisma.brandChangeRequest.create({
    data: {
      organizationId: orgId,
      requesterId: auth.user.id,
      proposalId,
      fieldName,
      currentValue:
        body.currentValue === undefined || body.currentValue === null
          ? Prisma.JsonNull
          : (body.currentValue as Prisma.InputJsonValue),
      requestedValue: body.requestedValue as Prisma.InputJsonValue,
      reason,
    },
  });

  return NextResponse.json({ status: "ok", request: serialize(created) });
}

export async function GET(req: Request) {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!auth.organization) {
    return NextResponse.json({ error: "No active organization." }, { status: 409 });
  }
  const orgId = auth.organization.id;
  const isAdmin = auth.role === "owner" || auth.role === "admin";

  const url = new URL(req.url);
  const statusFilter = url.searchParams.get("status")?.trim();

  const rows = await prisma.brandChangeRequest.findMany({
    where: {
      organizationId: orgId,
      // Members only see their own requests; admins see the org-wide
      // queue. Same convention as the deal-side scope toggles.
      ...(isAdmin ? {} : { requesterId: auth.user.id }),
      ...(statusFilter ? { status: statusFilter } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json({
    canDecide: isAdmin,
    requests: rows.map(serialize),
  });
}

function serialize(row: {
  id: string;
  requesterId: string;
  proposalId: string | null;
  fieldName: string;
  currentValue: unknown;
  requestedValue: unknown;
  reason: string | null;
  status: string;
  decidedBy: string | null;
  decidedAt: Date | null;
  decidedNote: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    requesterId: row.requesterId,
    proposalId: row.proposalId,
    fieldName: row.fieldName,
    currentValue: row.currentValue ?? null,
    requestedValue: row.requestedValue,
    reason: row.reason,
    status: row.status,
    decidedBy: row.decidedBy,
    decidedAt: row.decidedAt?.toISOString() ?? null,
    decidedNote: row.decidedNote,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
