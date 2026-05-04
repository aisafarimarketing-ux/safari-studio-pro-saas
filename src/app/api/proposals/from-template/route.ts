import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { getTemplateBySlug, buildProposalFromTemplate } from "@/lib/templates";
import { applyIdentityToOperator, friendlyConsultantName } from "@/lib/consultantIdentity";
import { nextProposalTrackingId } from "@/lib/proposalTracking";
import { ensureRequestForProposal } from "@/lib/requestForProposal";
import {
  applyBrandDefaultsToTheme,
  applyBrandDefaultsToSections,
  pickBrandImageForDestination,
  type BrandColor,
  type BrandImage,
  type BrandSectionStyles,
} from "@/lib/brandDNA";
import type { Proposal } from "@/lib/types";
import crypto from "node:crypto";

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
  // Polished display name — guards legacy User.name === email rows
  // and produces "Collins" from "collins@example.com" when Clerk has
  // no first/last on file.
  const polishedName = friendlyConsultantName({
    name: ctx.user.name,
    email: ctx.user.email,
  });

  // ── Brand master takes precedence over the slug-picked template.
  //    When the org has tagged a proposal as their master, every
  //    new proposal clones from that one — slug-derived shape is
  //    used only as the fallback when no master is set or the
  //    master proposal has been deleted. The master IS the brand:
  //    its theme, sections, day layouts, pricing structure, and
  //    typography all carry over.
  const masterPointer = await prisma.brandDNAProfile.findUnique({
    where: { organizationId: ctx.organization.id },
    select: { masterTemplateProposalId: true },
  });
  let proposal: Proposal | null = null;
  if (masterPointer?.masterTemplateProposalId) {
    const master = await prisma.proposal.findFirst({
      where: {
        id: masterPointer.masterTemplateProposalId,
        organizationId: ctx.organization.id,
      },
      select: { contentJson: true },
    });
    if (master?.contentJson) {
      // Deep-clone via JSON round-trip — the contentJson shape is
      // plain JSON (no Dates, no functions, no circular refs), so
      // round-trip is safe and avoids dragging in a deep-clone lib.
      const cloned = JSON.parse(JSON.stringify(master.contentJson)) as Proposal;
      cloned.id = crypto.randomUUID();
      cloned.metadata = {
        ...cloned.metadata,
        status: "draft",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      // Reset client-specific carryover so the operator personalises
      // from a clean slate. Keep theme / sections / days / pricing /
      // properties — those are the brand the master was crafted for.
      cloned.client = {
        ...cloned.client,
        guestNames: "",
        adults: undefined,
        children: undefined,
        arrivalFlight: "",
        departureFlight: "",
        specialOccasion: "",
        dietary: "",
        rooming: "",
      };
      // Trip dates come from the actual booking, not the master's
      // example. Nights / destinations stay — they're part of the
      // canonical itinerary the brand was designed against.
      cloned.trip = {
        ...cloned.trip,
        dates: "",
        arrivalDate: undefined,
        departureDate: undefined,
      };
      // Operator block gets fully replaced below by
      // applyIdentityToOperator — but seed the basics first so the
      // shape stays consistent with the slug path.
      cloned.operator = {
        ...cloned.operator,
        companyName: ctx.organization.name ?? cloned.operator?.companyName ?? "",
        consultantName: polishedName,
        email: ctx.user.email ?? "",
      };
      proposal = cloned;
    }
    // If the master pointer is set but the proposal is gone, fall
    // through to the slug path — better to clone something than
    // 404 the operator.
  }

  if (!proposal) {
    proposal = buildProposalFromTemplate(tpl, {
      mode: "clone",
      operator: {
        companyName: ctx.organization.name ?? "",
        consultantName: polishedName,
        email: ctx.user.email ?? "",
      },
    });
  }

  proposal.operator = applyIdentityToOperator(proposal.operator, {
    name: polishedName,
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

  // Unified pipeline: link every template-cloned proposal to a
  // Request so it appears in the inbox journey alongside inbound
  // leads. Best-effort — failure logs but doesn't fail the response.
  try {
    await ensureRequestForProposal(saved.id);
  } catch (err) {
    console.warn("[proposals/from-template] ensureRequestForProposal failed:", err);
  }

  return NextResponse.json({ proposal: saved });
}
