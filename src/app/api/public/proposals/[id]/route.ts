import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/public/proposals/:id — unauthenticated, read-only view.
// Anyone with the proposal id (nanoid — effectively unguessable) can read.
// Middleware leaves /api/public/* open (not in isProtectedRoute).
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const row = await prisma.proposal.findUnique({
    where: { id },
    select: { id: true, title: true, contentJson: true, updatedAt: true },
  });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ proposal: row });
}
