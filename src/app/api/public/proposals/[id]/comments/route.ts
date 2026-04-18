import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Public comments API for the /p/[id] share view. No auth — anyone with
// the proposal id can read existing comments and post a new one. The
// proposal id is a nanoid (effectively unguessable) which is the existing
// share-link security model.
//
// Operator replies and status changes go through the auth'd /api/proposals
// route instead (see src/app/api/proposals/[id]/comments).

// GET /api/public/proposals/:id/comments — list comments for a share link.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  // Confirm the proposal exists before returning anything (prevents using
  // this endpoint as a probe to enumerate ids).
  const proposal = await prisma.proposal.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!proposal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const comments = await prisma.proposalComment.findMany({
    where: { proposalId: id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      body: true,
      authorName: true,
      authorIsOperator: true,
      status: true,
      createdAt: true,
      sectionId: true,
      dayId: true,
      propertyId: true,
      // authorEmail intentionally omitted — never expose contact info publicly.
    },
  });
  return NextResponse.json({ comments });
}

// POST /api/public/proposals/:id/comments — anonymous client submission.
//   Body: { body: string, authorName?: string, authorEmail?: string,
//           sectionId?: string, dayId?: string, propertyId?: string }
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const proposal = await prisma.proposal.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!proposal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (text.length === 0) {
    return NextResponse.json({ error: "Comment body is required" }, { status: 400 });
  }
  if (text.length > 4000) {
    return NextResponse.json({ error: "Comment too long (max 4000 chars)" }, { status: 400 });
  }

  const authorName = typeof body.authorName === "string" ? body.authorName.trim().slice(0, 120) || null : null;
  const authorEmail = typeof body.authorEmail === "string" ? body.authorEmail.trim().slice(0, 200) || null : null;
  const sectionId = typeof body.sectionId === "string" ? body.sectionId : null;
  const dayId = typeof body.dayId === "string" ? body.dayId : null;
  const propertyId = typeof body.propertyId === "string" ? body.propertyId : null;

  const comment = await prisma.proposalComment.create({
    data: {
      proposalId: id,
      body: text,
      authorName,
      authorEmail,
      sectionId,
      dayId,
      propertyId,
      authorIsOperator: false,
    },
    select: {
      id: true,
      body: true,
      authorName: true,
      authorIsOperator: true,
      status: true,
      createdAt: true,
      sectionId: true,
      dayId: true,
      propertyId: true,
    },
  });
  return NextResponse.json({ comment });
}
