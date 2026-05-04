import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import {
  applyBrandDefaultsToTheme,
  applyBrandDefaultsToSections,
  type BrandColor,
  type BrandVisualDefaults,
} from "@/lib/brandDNA";
import type { Proposal, Section } from "@/lib/types";

// POST /api/proposals/[id]/apply-brand-dna
//
// Admin/owner action. Re-applies the org's Brand DNA visual
// defaults (colors / fonts / per-section styles) onto an existing
// proposal that was authored before the current brand was finalised
// — or that drifted from the company look during a member's edits.
//
// Why this is operator-controlled and not auto-fired:
//   • Existing proposals carry per-proposal edits the operator may
//     have made deliberately. Auto-overwriting silently when Brand
//     DNA changes would erase that work.
//   • Members can edit content but not brand; this route is the
//     escape hatch for an admin to bring an off-brand proposal
//     back in line on a one-off basis.
//
// Fill-gap semantics from applyBrandDefaultsToTheme /
// applyBrandDefaultsToSections still apply: brand defaults seed
// empty fields. Per-proposal edits that already filled a slot stay
// untouched. So this is safe to run repeatedly — no risk of
// stomping bespoke work the operator has poured into this trip.

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!auth.organization) {
    return NextResponse.json(
      { error: "No active organization." },
      { status: 409 },
    );
  }
  // Owner-only mirrors the /api/brand-dna PUT gate. Brand operations
  // are an org-level commitment; only the org owner can wield them.
  if (auth.role !== "owner" && auth.role !== "admin") {
    return NextResponse.json(
      { error: "Only an admin or owner can apply Brand DNA to a proposal." },
      { status: 403 },
    );
  }

  const orgId = auth.organization.id;
  const { id: proposalId } = await ctx.params;
  if (!proposalId) {
    return NextResponse.json({ error: "Proposal id required." }, { status: 400 });
  }

  // Org-scope guard: never trust the proposalId alone — match it
  // to the caller's org so a malicious caller can't apply brand
  // settings across tenant boundaries.
  const proposal = await prisma.proposal.findFirst({
    where: { id: proposalId, organizationId: orgId },
    select: { id: true, contentJson: true, updatedAt: true },
  });
  if (!proposal) {
    return NextResponse.json({ error: "Proposal not found." }, { status: 404 });
  }

  const profile = await prisma.brandDNAProfile.findUnique({
    where: { organizationId: orgId },
    select: {
      brandColors: true,
      headingFont: true,
      bodyFont: true,
      sectionStyles: true,
    },
  });
  if (!profile) {
    return NextResponse.json(
      {
        error:
          "No Brand DNA profile set yet. Configure Brand DNA before applying it to a proposal.",
      },
      { status: 422 },
    );
  }

  const content = proposal.contentJson as unknown as Proposal | null;
  if (!content) {
    return NextResponse.json(
      { error: "Proposal has no content to apply Brand DNA to." },
      { status: 422 },
    );
  }

  // Build the visual defaults bag the existing helpers expect.
  // brandColors lives as JSON in the DB; we trust the shape (it's
  // owner-set via /api/brand-dna with sanitisation already in place).
  const visualDefaults: BrandVisualDefaults = {
    brandColors: Array.isArray(profile.brandColors)
      ? (profile.brandColors as BrandColor[])
      : null,
    headingFont: profile.headingFont ?? null,
    bodyFont: profile.bodyFont ?? null,
  };

  const nextTheme = applyBrandDefaultsToTheme(content.theme, visualDefaults);
  const nextSections = applyBrandDefaultsToSections(
    content.sections,
    (profile.sectionStyles as Record<string, unknown> | null) ?? null,
  ) as Section[];

  const nextContent: Proposal = {
    ...content,
    theme: nextTheme,
    sections: nextSections,
  };

  // Track the apply action on the proposal's metadata.updatedAt
  // implicitly via the standard Prisma write; no separate audit
  // row in v1. The change is fully reversible — the operator can
  // edit theme tokens or section styles back to whatever they were
  // afterwards if anything looks wrong.
  const saved = await prisma.proposal.update({
    where: { id: proposalId },
    data: {
      contentJson: nextContent as unknown as object,
    },
    select: { id: true, updatedAt: true },
  });

  return NextResponse.json({
    status: "ok",
    proposalId: saved.id,
    updatedAt: saved.updatedAt.toISOString(),
  });
}
