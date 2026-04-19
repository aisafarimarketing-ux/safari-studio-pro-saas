import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";

// GET /api/proposals — list proposals for the caller's active organization
// (newest first). 409 if the caller has no active organization; the UI
// routes through /select-organization in that case.
export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ctx.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }
  if (!ctx.orgActive) {
    return NextResponse.json({ error: "Account suspended", code: "ORG_SUSPENDED" }, { status: 402 });
  }

  const rows = await prisma.proposal.findMany({
    where: { organizationId: ctx.organization.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      updatedAt: true,
      createdAt: true,
      contentJson: true,
    },
  });

  const proposals = rows.map((r) => {
    const json = r.contentJson as { client?: { guestNames?: string } } | null;
    return {
      id: r.id,
      title: r.title,
      status: r.status,
      updatedAt: r.updatedAt,
      createdAt: r.createdAt,
      clientName: json?.client?.guestNames?.trim() || null,
    };
  });
  return NextResponse.json({ proposals });
}

// POST /api/proposals — upsert by client-provided proposal.id within the
// caller's active organization.
//   Body: { proposal: <full Proposal object> }
//   Create if new; update (ownership + tenant-scoped) if existing.
export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ctx.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }
  if (!ctx.orgActive) {
    return NextResponse.json({ error: "Account suspended", code: "ORG_SUSPENDED" }, { status: 402 });
  }

  // Read the raw body so we can a) report size in diagnostics and b)
  // surface the real parse failure instead of a generic "Invalid JSON".
  let raw = "";
  try {
    raw = await req.text();
  } catch (err) {
    console.error("[proposals.POST] body read failed:", err);
    return NextResponse.json(
      { error: "Could not read request body" },
      { status: 400 },
    );
  }

  let body: { proposal?: { id?: string; metadata?: { title?: string; status?: string } } };
  try {
    body = JSON.parse(raw);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error(
      "[proposals.POST] JSON parse failed:",
      detail,
      "· size=",
      raw.length,
      "bytes · first 200 chars:",
      raw.slice(0, 200),
    );
    return NextResponse.json(
      {
        error: `Invalid JSON: ${detail}`,
        bytes: raw.length,
        // Hint the caller to inspect the payload shape — useful when
        // images or long narratives push the body over a proxy limit.
      },
      { status: 400 },
    );
  }

  const proposal = body?.proposal;
  if (!proposal?.id) {
    return NextResponse.json({ error: "proposal.id is required" }, { status: 400 });
  }

  const title = proposal.metadata?.title || "Untitled Proposal";
  const status = proposal.metadata?.status || "draft";

  // Tenant guard: reject if an existing row belongs to a different org.
  const existing = await prisma.proposal.findUnique({
    where: { id: proposal.id },
    select: { userId: true, organizationId: true },
  });
  if (existing && existing.organizationId && existing.organizationId !== ctx.organization.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const saved = await prisma.proposal.upsert({
    where: { id: proposal.id },
    create: {
      id: proposal.id,
      userId: ctx.user.id,
      organizationId: ctx.organization.id,
      title,
      status,
      contentJson: proposal as object,
    },
    update: {
      title,
      status,
      organizationId: ctx.organization.id,
      contentJson: proposal as object,
    },
    select: { id: true, title: true, updatedAt: true },
  });
  return NextResponse.json({ proposal: saved });
}
