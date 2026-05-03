import "server-only";
import { prisma } from "@/lib/prisma";
import { nextRequestReferenceNumber } from "@/lib/requestCounter";

// ─── ensureRequestForProposal ────────────────────────────────────────────
//
// Guarantees every Proposal participates in the unified pipeline by
// linking it to a Request row. Idempotent and dedup-safe:
//
//   1. If proposal.requestId is already set, return that Request id —
//      no second row gets created. This covers proposals that were
//      drafted FROM a Request (via /api/requests/[id]/quote) and
//      proposals that have already been linked by a previous call.
//
//   2. Otherwise create a new Request with source="proposal", status
//      ="new", assigned to the proposal's owner, and point
//      proposal.requestId at it.
//
// Result tells the caller whether a new row was created so it can
// decide whether to log / fire downstream events.
//
// Best-effort by design: callers should wrap this in try/catch and
// log on failure. The proposal write itself is independent — if the
// Request create fails for any reason (DB hiccup, counter race), the
// proposal still exists and the operator can still work with it.

export async function ensureRequestForProposal(
  proposalId: string,
): Promise<{ requestId: string | null; created: boolean }> {
  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    select: {
      id: true,
      organizationId: true,
      userId: true,
      clientId: true,
      requestId: true,
      title: true,
    },
  });

  if (!proposal) {
    throw new Error(`ensureRequestForProposal: proposal ${proposalId} not found`);
  }

  // Pre-org proposals (legacy / blank-canvas drafts) can't host a
  // Request because Request.organizationId is required. Skip silently.
  if (!proposal.organizationId) {
    return { requestId: null, created: false };
  }

  // Already linked — either drafted from a Request, or this helper
  // already ran. Return the existing id; never create a duplicate.
  if (proposal.requestId) {
    return { requestId: proposal.requestId, created: false };
  }

  const referenceNumber = await nextRequestReferenceNumber(proposal.organizationId);
  const now = new Date();

  // Two-step write: create the Request, then point the proposal at
  // it. Wrapped in a transaction so an interrupted write can't leave
  // a Request orphaned (it'd never get a proposal pointer back).
  const request = await prisma.$transaction(async (tx) => {
    const created = await tx.request.create({
      data: {
        organizationId: proposal.organizationId!,
        referenceNumber,
        status: "new",
        source: "proposal",
        sourceDetail: "Auto-created from proposal builder",
        assignedToUserId: proposal.userId,
        clientId: proposal.clientId ?? null,
        receivedAt: now,
        lastActivityAt: now,
        originalMessage: proposal.title
          ? `Linked to proposal: ${proposal.title}`
          : null,
      },
      select: { id: true },
    });

    await tx.proposal.update({
      where: { id: proposalId },
      data: { requestId: created.id },
    });

    return created;
  });

  return { requestId: request.id, created: true };
}
