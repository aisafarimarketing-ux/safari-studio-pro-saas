import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { getTemplateBySlug, buildProposalFromTemplate } from "@/lib/templates";
import { applyIdentityToOperator } from "@/lib/consultantIdentity";
import { nextProposalTrackingId } from "@/lib/proposalTracking";
import {
  applyBrandDefaultsToTheme,
  applyBrandDefaultsToSections,
  pickBrandImageForDestination,
  type BrandColor,
  type BrandImage,
  type BrandSectionStyles,
} from "@/lib/brandDNA";

// ─── POST /api/proposals/from-template ─────────────────────────────────────
//
// Clone a public template into a new proposal inside the caller's
// active organization. Body: { slug: string }.
//
// Returns the saved proposal row so the UI can navigate to /studio/[id].
// The proposal is built via the shared buildProposalFromTemplate() with
// mode:"clone" — which clears the template's example client, fills the
// operator block from the user's Clerk profile + org metadata, and
// preserves everything else (days, tier picks, pricing, prose).

export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ctx.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }
  if (!ctx.orgActive) {
    return NextResponse.json({ error: "Account suspended", code: "ORG_SUSPENDED" }, { status: 402 });
  }

  let body: { slug?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const slug = (body?.slug ?? "").toString().trim();
  if (!slug) return NextResponse.json({ error: "slug is required" }, { status: 400 });

  const tpl = getTemplateBySlug(slug);
  if (!tpl) return NextResponse.json({ error: "Template not found" }, { status: 404 });

  // Build the proposal in clone mode with org + user info from the
  // caller. The cloned operator block starts with org/email basics; we
  // then layer the user's full consultant identity (photo, signature,
  // role title) on top so the proposal carries the drafter's brand.
  const proposal = buildProposalFromTemplate(tpl, {
    mode: "clone",
    operator: {
      companyName: ctx.organization.name ?? "",
      consultantName: ctx.user.name ?? "",
      email: ctx.user.email ?? "",
    },
  });

  proposal.operator = applyIdentityToOperator(proposal.operator, {
    name: ctx.user.name ?? "",
    email: ctx.user.email ?? null,
    roleTitle: ctx.membership?.roleTitle ?? null,
    photoUrl: ctx.membership?.profilePhotoUrl ?? null,
    signatureUrl: ctx.membership?.signatureUrl ?? null,
    whatsapp: ctx.membership?.whatsapp ?? null,
  });

  // Apply the org's Brand DNA visual defaults (colours, fonts) on top
  // of the template's theme. Operator brief: every new proposal uses
  // the org's brand palette + typography by default. Operator can
  // still override per-proposal via SectionChrome.
  const brand = await prisma.brandDNAProfile.findUnique({
    where: { organizationId: ctx.organization.id },
    select: {
      brandColors: true,
      headingFont: true,
      bodyFont: true,
      sectionStyles: true,
      imageLibrary: true,
    },
  });
  if (brand) {
    proposal.theme = applyBrandDefaultsToTheme(proposal.theme, {
      brandColors: (brand.brandColors as BrandColor[] | null) ?? null,
      headingFont: brand.headingFont,
      bodyFont: brand.bodyFont,
    });
    // Per-section overrides — brand defaults fill in section
    // styleOverrides where the template doesn't already set them.
    proposal.sections = applyBrandDefaultsToSections(
      proposal.sections,
      (brand.sectionStyles as BrandSectionStyles | null) ?? null,
    );
    // Day hero images — for any day whose destination matches a
    // location-tagged brand image, set heroImageUrl to that image.
    // Template-supplied heroes (rare on clone) win.
    const library = (brand.imageLibrary as BrandImage[] | null) ?? null;
    if (library && library.length > 0) {
      proposal.days = proposal.days.map((day) => {
        if (day.heroImageUrl) return day;
        const dest = day.destination?.trim() ?? "";
        if (!dest) return day;
        const match = pickBrandImageForDestination(library, dest);
        if (!match) return day;
        return { ...day, heroImageUrl: match.url };
      });
    }
    // Also seed operator brand colours so closing / footer chrome
    // that references operator.brandColors picks them up.
    const primary =
      (brand.brandColors as BrandColor[] | null)?.[0]?.hex ??
      proposal.operator.brandColors?.primary;
    const secondary =
      (brand.brandColors as BrandColor[] | null)?.[1]?.hex ??
      proposal.operator.brandColors?.secondary;
    if (primary || secondary) {
      proposal.operator.brandColors = {
        primary: primary ?? proposal.operator.brandColors?.primary ?? "#1b3a2d",
        secondary:
          secondary ?? proposal.operator.brandColors?.secondary ?? "#c9a84c",
      };
    }
  }

  // Allocate a tracking id ("PRO-2026-0042") so template-derived
  // proposals participate in the per-org sequence from day one.
  // Best-effort — if it fails the proposal still saves and reads fall
  // back to the legacy slice format.
  let trackingId: string | undefined;
  try {
    trackingId = await nextProposalTrackingId(ctx.organization.id);
  } catch (err) {
    console.warn("[proposals/from-template] trackingId allocation failed:", err);
  }

  // Persist via Prisma directly (same shape the existing /api/proposals
  // POST uses internally). Keeping this endpoint self-contained so the
  // template clone never partially duplicates via a second HTTP hop.
  const saved = await prisma.proposal.create({
    data: {
      id: proposal.id,
      organizationId: ctx.organization.id,
      userId: ctx.user.id,
      title: proposal.metadata.title,
      status: proposal.metadata.status ?? "draft",
      contentJson: proposal as unknown as object,
      ...(trackingId ? { trackingId } : {}),
    },
    select: { id: true, title: true, status: true, trackingId: true, updatedAt: true, createdAt: true },
  });

  return NextResponse.json({ proposal: saved });
}
