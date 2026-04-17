import { NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";

// GET /api/proposals — list current user's proposals (newest first)
export async function GET() {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const proposals = await prisma.proposal.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, status: true, updatedAt: true, createdAt: true },
  });
  return NextResponse.json({ proposals });
}

// POST /api/proposals — upsert by client-provided proposal.id
//   Body: { proposal: <full Proposal object> }
//   Create if new; update (ownership-checked) if existing.
export async function POST(req: Request) {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: { proposal?: { id?: string; metadata?: { title?: string; status?: string } } };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const proposal = body?.proposal;
  if (!proposal?.id) {
    return NextResponse.json({ error: "proposal.id is required" }, { status: 400 });
  }

  const title = proposal.metadata?.title || "Untitled Proposal";
  const status = proposal.metadata?.status || "draft";

  // Ownership check before upsert — don't let user A overwrite user B's row.
  const existing = await prisma.proposal.findUnique({
    where: { id: proposal.id },
    select: { userId: true },
  });
  if (existing && existing.userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const saved = await prisma.proposal.upsert({
    where: { id: proposal.id },
    create: {
      id: proposal.id,
      userId: user.id,
      title,
      status,
      contentJson: proposal as object,
    },
    update: {
      title,
      status,
      contentJson: proposal as object,
    },
    select: { id: true, title: true, updatedAt: true },
  });
  return NextResponse.json({ proposal: saved });
}
