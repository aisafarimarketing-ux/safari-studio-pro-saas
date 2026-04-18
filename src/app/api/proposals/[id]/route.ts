import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";

// GET /api/proposals/:id — fetch one, scoped to caller's active org
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!auth.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }

  const { id } = await ctx.params;
  const proposal = await prisma.proposal.findFirst({
    where: { id, organizationId: auth.organization.id },
  });
  if (!proposal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ proposal });
}

// DELETE /api/proposals/:id
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!auth.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }

  const { id } = await ctx.params;
  const result = await prisma.proposal.deleteMany({
    where: { id, organizationId: auth.organization.id },
  });
  if (result.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
