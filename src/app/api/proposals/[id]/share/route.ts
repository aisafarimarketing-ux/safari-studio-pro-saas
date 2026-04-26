import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { triggerProposalSent } from "@/lib/ghl/workflowEvents";

// ─── POST /api/proposals/:id/share ─────────────────────────────────────────
//
// "I just shared this proposal" signal. Two side effects:
//
//   1. First share — flip Proposal.status from "draft" → "sent" and stamp
//      a `sentAt` (we reuse updatedAt; status is the canonical signal).
//      Subsequent calls are idempotent and return alreadyShared=true.
//
//   2. Fire the GHL `proposal_sent` workflow on first share. The trigger
//      is fire-and-forget — we never block the share response on GHL.
//
// Called by the editor's Share button BEFORE the URL is copied to the
// clipboard, so a click flips state even when the operator never opens
// /p/[id] themselves.

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!auth.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }

  const { id } = await ctx.params;
  const proposal = await prisma.proposal.findFirst({
    where: { id, organizationId: auth.organization.id },
    select: { id: true, status: true, title: true },
  });
  if (!proposal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const wasDraft = proposal.status === "draft";
  if (wasDraft) {
    await prisma.proposal.update({
      where: { id: proposal.id },
      data: { status: "sent" },
    });
    // Fire-and-forget GHL workflow trigger. No-op when GHL isn't
    // configured for this org. Any failure lands in IntegrationLog and
    // never breaks this response.
    void triggerProposalSent(proposal.id);
  }

  return NextResponse.json({
    ok: true,
    status: wasDraft ? "sent" : proposal.status,
    alreadyShared: !wasDraft,
  });
}
