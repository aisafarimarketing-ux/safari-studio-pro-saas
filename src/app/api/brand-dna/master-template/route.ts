import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";

// /api/brand-dna/master-template
//
// The "master template" is the org's source-of-truth proposal —
// the one an admin has crafted to look like the brand. New
// proposals clone from it; the editor surfaces a "Brand master
// mode" badge when the operator is editing it.
//
// Three verbs:
//   GET    — any authed member can read which proposal is master.
//            Also returns canEdit so the editor can show / hide the
//            "Use as company brand master" menu item without a
//            second round-trip.
//   POST   — admin/owner only. Body: { proposalId }. Verifies the
//            proposal belongs to the caller's org, then writes the
//            id to BrandDNAProfile.masterTemplateProposalId.
//   DELETE — admin/owner only. Clears the master pointer.
//
// We don't add an FK to the column on purpose: keeping it as a
// soft pointer means deleting the source proposal degrades the
// clone path back to the system template instead of cascading.

type GetResponse =
  | {
      status: "ok";
      masterTemplateProposalId: string | null;
      master: { id: string; title: string } | null;
      canEdit: boolean;
    }
  | { status: "error"; message: string };

type WriteResponse =
  | { status: "ok"; masterTemplateProposalId: string | null }
  | { status: "error"; message: string };

export async function GET(): Promise<NextResponse<GetResponse>> {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json(
      { status: "error", message: "Not authenticated." },
      { status: 401 },
    );
  }
  if (!auth.organization) {
    return NextResponse.json(
      { status: "error", message: "No active organization." },
      { status: 409 },
    );
  }
  const orgId = auth.organization.id;
  const canEdit = auth.role === "owner" || auth.role === "admin";

  const profile = await prisma.brandDNAProfile.findUnique({
    where: { organizationId: orgId },
    select: { masterTemplateProposalId: true },
  });
  const id = profile?.masterTemplateProposalId ?? null;

  // Hydrate the master proposal title for UI display. Soft pointer
  // semantics: if the id is set but the proposal is gone, return
  // null so the editor doesn't show a broken badge.
  let master: { id: string; title: string } | null = null;
  if (id) {
    const row = await prisma.proposal.findFirst({
      where: { id, organizationId: orgId },
      select: { id: true, title: true },
    });
    if (row) master = { id: row.id, title: row.title ?? "Untitled" };
  }

  return NextResponse.json({
    status: "ok",
    masterTemplateProposalId: master ? master.id : null,
    master,
    canEdit,
  });
}

export async function POST(req: Request): Promise<NextResponse<WriteResponse>> {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json(
      { status: "error", message: "Not authenticated." },
      { status: 401 },
    );
  }
  if (!auth.organization) {
    return NextResponse.json(
      { status: "error", message: "No active organization." },
      { status: 409 },
    );
  }
  if (auth.role !== "owner" && auth.role !== "admin") {
    return NextResponse.json(
      {
        status: "error",
        message: "Only an admin or owner can set the brand master.",
      },
      { status: 403 },
    );
  }
  const orgId = auth.organization.id;

  let body: { proposalId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { status: "error", message: "Invalid JSON." },
      { status: 400 },
    );
  }
  const proposalId = body.proposalId?.trim();
  if (!proposalId) {
    return NextResponse.json(
      { status: "error", message: "proposalId is required." },
      { status: 400 },
    );
  }

  // Cross-org guard: never trust the proposalId alone — confirm
  // the proposal lives in the caller's org. Anything else and
  // we'd be letting an admin in one tenant point another tenant's
  // proposal as their master.
  const proposal = await prisma.proposal.findFirst({
    where: { id: proposalId, organizationId: orgId },
    select: { id: true },
  });
  if (!proposal) {
    return NextResponse.json(
      { status: "error", message: "Proposal not found." },
      { status: 404 },
    );
  }

  // Upsert: orgs may not have a BrandDNAProfile yet (the column
  // lives on that model), so the first set-as-master call also
  // creates the profile shell.
  await prisma.brandDNAProfile.upsert({
    where: { organizationId: orgId },
    create: {
      organizationId: orgId,
      masterTemplateProposalId: proposal.id,
    },
    update: { masterTemplateProposalId: proposal.id },
  });

  return NextResponse.json({
    status: "ok",
    masterTemplateProposalId: proposal.id,
  });
}

export async function DELETE(): Promise<NextResponse<WriteResponse>> {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json(
      { status: "error", message: "Not authenticated." },
      { status: 401 },
    );
  }
  if (!auth.organization) {
    return NextResponse.json(
      { status: "error", message: "No active organization." },
      { status: 409 },
    );
  }
  if (auth.role !== "owner" && auth.role !== "admin") {
    return NextResponse.json(
      {
        status: "error",
        message: "Only an admin or owner can clear the brand master.",
      },
      { status: 403 },
    );
  }
  const orgId = auth.organization.id;

  // No-op when the profile doesn't exist — clearing nothing is
  // success. Avoids a 404 when an admin clicks "Remove master" on
  // an org that never had a profile row to begin with.
  const profile = await prisma.brandDNAProfile.findUnique({
    where: { organizationId: orgId },
    select: { id: true },
  });
  if (!profile) {
    return NextResponse.json({ status: "ok", masterTemplateProposalId: null });
  }
  await prisma.brandDNAProfile.update({
    where: { organizationId: orgId },
    data: { masterTemplateProposalId: null },
  });
  return NextResponse.json({ status: "ok", masterTemplateProposalId: null });
}
