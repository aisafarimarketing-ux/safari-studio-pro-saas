import { NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";

// GET /api/proposals/:id — fetch single proposal, scoped to current user
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await ctx.params;
  const proposal = await prisma.proposal.findFirst({
    where: { id, userId: user.id },
  });
  if (!proposal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ proposal });
}

// DELETE /api/proposals/:id
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await ctx.params;
  const result = await prisma.proposal.deleteMany({
    where: { id, userId: user.id },
  });
  if (result.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
