import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";

// Operator comments API — full payload (incl. authorEmail) and operator
// reply support. Tenant-scoped: confirms the proposal belongs to the
// caller's org before exposing any comments.

// GET /api/proposals/:id/comments
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

  const comments = await prisma.proposalComment.findMany({
    where: { proposalId: id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ comments });
}

// POST /api/proposals/:id/comments — operator reply.
//   Body: { body: string, sectionId?, dayId?, propertyId? }
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
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

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!text) return NextResponse.json({ error: "body is required" }, { status: 400 });

  const comment = await prisma.proposalComment.create({
    data: {
      proposalId: id,
      body: text.slice(0, 4000),
      authorName: auth.user.name ?? null,
      authorEmail: auth.user.email ?? null,
      authorIsOperator: true,
      sectionId: typeof body.sectionId === "string" ? body.sectionId : null,
      dayId: typeof body.dayId === "string" ? body.dayId : null,
      propertyId: typeof body.propertyId === "string" ? body.propertyId : null,
    },
  });
  return NextResponse.json({ comment });
}
