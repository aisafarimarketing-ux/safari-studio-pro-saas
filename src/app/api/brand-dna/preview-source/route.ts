import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { buildDemoProposal } from "@/lib/defaults";
import type { Proposal } from "@/lib/types";

// GET /api/brand-dna/preview-source
//
// Returns the base proposal the Live Brand Preview should render
// against. Priority order:
//
//   1. masterTemplateProposalId — the explicit master the admin picked
//   2. Most recent proposal in the organization (any author)
//   3. buildDemoProposal() — hardcoded sample so a fresh org with no
//      proposals yet still gets a meaningful preview
//
// Read-only. The caller never mutates the returned proposal — the
// preview surface applies form-state on top of this snapshot in
// memory and re-renders. Saving Brand DNA is a separate PUT call.
//
// Org-scoped: the master pointer is consulted only inside the
// caller's organization, and the fallback "most recent" query is
// scoped the same way. A malicious caller can't reach across tenant
// boundaries via this endpoint.
//
// Response shape:
//   {
//     source: "master" | "recent" | "fallback",
//     proposal: Proposal,             // Proposal type from lib/types
//     proposalRef: { id, title } | null  // null on fallback
//   }
//
// Owner-only mirrors /api/brand-dna PUT — this surface is part of
// the Brand DNA settings page, gated to admins. Members never
// reach the preview source.

export async function GET() {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!auth.organization) {
    return NextResponse.json(
      { error: "No active organization" },
      { status: 409 },
    );
  }
  if (auth.role !== "owner" && auth.role !== "admin") {
    return NextResponse.json(
      { error: "Brand DNA preview is admin-only." },
      { status: 403 },
    );
  }

  const orgId = auth.organization.id;

  // ── Priority 1: explicit master template
  const profile = await prisma.brandDNAProfile.findUnique({
    where: { organizationId: orgId },
    select: { masterTemplateProposalId: true },
  });
  if (profile?.masterTemplateProposalId) {
    const master = await prisma.proposal.findFirst({
      where: {
        id: profile.masterTemplateProposalId,
        organizationId: orgId,
      },
      select: { id: true, title: true, contentJson: true },
    });
    if (master) {
      return NextResponse.json({
        source: "master",
        proposal: master.contentJson as unknown as Proposal,
        proposalRef: { id: master.id, title: master.title ?? "Untitled" },
      });
    }
    // Master pointer was set but the proposal is gone — fall through
    // to "recent" rather than returning a broken preview.
  }

  // ── Priority 2: most-recent proposal in the org
  const recent = await prisma.proposal.findFirst({
    where: { organizationId: orgId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, contentJson: true },
  });
  if (recent && recent.contentJson) {
    return NextResponse.json({
      source: "recent",
      proposal: recent.contentJson as unknown as Proposal,
      proposalRef: { id: recent.id, title: recent.title ?? "Untitled" },
    });
  }

  // ── Priority 3: hardcoded demo
  // Defensive try/catch — buildDemoProposal is pure, but a future
  // bug there shouldn't break the settings page.
  try {
    const demo = buildDemoProposal();
    return NextResponse.json({
      source: "fallback",
      proposal: demo,
      proposalRef: null,
    });
  } catch (err) {
    console.warn("[brand-dna/preview-source] demo fallback failed:", err);
    return NextResponse.json(
      { error: "Couldn't build a preview — try again." },
      { status: 500 },
    );
  }
}
