import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";

// ─── GET /api/proposals/:id/deposits ───────────────────────────────────────
//
// Authed, tenant-scoped. Returns the list of deposit payment records
// for the operator's proposal. Feeds the engagement drawer's "Deposits"
// panel so the operator can see who paid what and when.

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!auth.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }

  const { id } = await ctx.params;
  const proposal = await prisma.proposal.findFirst({
    where: { id, organizationId: auth.organization.id },
    select: { id: true },
  });
  if (!proposal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const deposits = await prisma.proposalDeposit.findMany({
    where: { proposalId: id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      payerName: true,
      payerEmail: true,
      amountInCents: true,
      currency: true,
      status: true,
      paystackReference: true,
      paidAt: true,
      createdAt: true,
    },
  });

  const paidTotalCents = deposits
    .filter((d) => d.status === "paid")
    .reduce((sum, d) => sum + d.amountInCents, 0);

  return NextResponse.json({
    deposits,
    totalPaidCents: paidTotalCents,
  });
}
