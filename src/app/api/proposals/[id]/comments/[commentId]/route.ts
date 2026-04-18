import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";

// PATCH /api/proposals/:id/comments/:commentId — operator status flip.
//   Body: { status: "open" | "resolved" }
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string; commentId: string }> }) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!auth.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }

  const { id, commentId } = await ctx.params;

  // Tenant-scope check via the parent proposal.
  const proposal = await prisma.proposal.findFirst({
    where: { id, organizationId: auth.organization.id },
    select: { id: true },
  });
  if (!proposal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const status = typeof body.status === "string" && (body.status === "open" || body.status === "resolved")
    ? body.status
    : null;
  if (!status) return NextResponse.json({ error: "status must be 'open' or 'resolved'" }, { status: 400 });

  const result = await prisma.proposalComment.updateMany({
    where: { id: commentId, proposalId: id },
    data: { status },
  });
  if (result.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

// DELETE — operator removes a comment.
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string; commentId: string }> }) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!auth.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }

  const { id, commentId } = await ctx.params;
  const proposal = await prisma.proposal.findFirst({
    where: { id, organizationId: auth.organization.id },
    select: { id: true },
  });
  if (!proposal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const result = await prisma.proposalComment.deleteMany({
    where: { id: commentId, proposalId: id },
  });
  if (result.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
