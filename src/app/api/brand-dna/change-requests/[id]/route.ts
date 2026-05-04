import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";

// PATCH /api/brand-dna/change-requests/[id]
//
// Admin / owner decides on a pending request.
//
// Body:
//   {
//     decision: "approve_once" | "apply_default" | "reject",
//     note?: string,
//   }
//
// Decision semantics:
//   approve_once    — admin OK'd the change for the proposal context
//                     only. Org default unchanged. Status becomes
//                     "approved_once".
//   apply_default   — admin OK'd AND wants the change rolled into the
//                     org Brand DNA. Status becomes "approved_default".
//                     The actual write to BrandDNAProfile is a
//                     separate explicit operator action via
//                     /api/brand-dna PUT — this route records intent
//                     so a glitchy approval can never silently
//                     rewrite the company brand.
//   reject          — declined; reason in note. Status becomes
//                     "rejected".
//
// Once decided, the row is locked: a second PATCH on a non-pending
// request returns 409 so the audit trail can't be quietly rewritten.
// If the admin needs to revisit, the original requester re-files.

const ALLOWED_DECISIONS = ["approve_once", "apply_default", "reject"] as const;
type Decision = (typeof ALLOWED_DECISIONS)[number];

const DECISION_TO_STATUS: Record<Decision, string> = {
  approve_once: "approved_once",
  apply_default: "approved_default",
  reject: "rejected",
};

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!auth.organization) {
    return NextResponse.json({ error: "No active organization." }, { status: 409 });
  }
  if (auth.role !== "owner" && auth.role !== "admin") {
    return NextResponse.json(
      { error: "Only an admin or owner can decide brand change requests." },
      { status: 403 },
    );
  }
  const orgId = auth.organization.id;

  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "Request id is required." }, { status: 400 });
  }

  let body: { decision?: string; note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const decision = (ALLOWED_DECISIONS as readonly string[]).includes(
    body.decision ?? "",
  )
    ? (body.decision as Decision)
    : null;
  if (!decision) {
    return NextResponse.json(
      {
        error: `decision must be one of: ${ALLOWED_DECISIONS.join(", ")}.`,
      },
      { status: 400 },
    );
  }
  const note =
    typeof body.note === "string" ? body.note.trim().slice(0, 1000) : null;

  const existing = await prisma.brandChangeRequest.findFirst({
    where: { id, organizationId: orgId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  }
  if (existing.status !== "pending") {
    return NextResponse.json(
      {
        error: `This request has already been decided (${existing.status}). File a new request to revisit.`,
      },
      { status: 409 },
    );
  }

  const now = new Date();
  const updated = await prisma.brandChangeRequest.update({
    where: { id },
    data: {
      status: DECISION_TO_STATUS[decision],
      decidedBy: auth.user.id,
      decidedAt: now,
      decidedNote: note,
    },
  });

  return NextResponse.json({
    status: "ok",
    request: {
      id: updated.id,
      requesterId: updated.requesterId,
      proposalId: updated.proposalId,
      fieldName: updated.fieldName,
      currentValue: updated.currentValue ?? null,
      requestedValue: updated.requestedValue,
      reason: updated.reason,
      status: updated.status,
      decidedBy: updated.decidedBy,
      decidedAt: updated.decidedAt?.toISOString() ?? null,
      decidedNote: updated.decidedNote,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    },
  });
}
