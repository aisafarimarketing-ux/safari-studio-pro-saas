import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { getTemplateBySlug, buildProposalFromTemplate } from "@/lib/templates";

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

  // Build the proposal in clone mode with operator info from the caller.
  // Empty user/org name fields stay empty; operator fills in from the editor.
  const proposal = buildProposalFromTemplate(tpl, {
    mode: "clone",
    operator: {
      companyName: ctx.organization.name ?? "",
      consultantName: ctx.user.name ?? "",
      email: ctx.user.email ?? "",
    },
  });

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
    },
    select: { id: true, title: true, status: true, updatedAt: true, createdAt: true },
  });

  return NextResponse.json({ proposal: saved });
}
