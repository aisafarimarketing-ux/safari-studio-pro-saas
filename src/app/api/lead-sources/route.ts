import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";

// /api/lead-sources — per-org taxonomy for the Request.source dropdown.
// GET is for every signed-in member (so the New Request form can populate
// its select). Write operations are admin/owner only.
//
// Archiving rather than deleting so historical requests don't lose their
// source attribution when an operator retires a channel they used to use.

// ─── GET — list active (non-archived) sources ─────────────────────────────

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ctx.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }
  const includeArchived = false; // kept explicit; future param can toggle
  const sources = await prisma.leadSource.findMany({
    where: { organizationId: ctx.organization.id, ...(includeArchived ? {} : { archived: false }) },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return NextResponse.json({ sources });
}

// ─── POST — create a new source ───────────────────────────────────────────

export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ctx.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }
  if (ctx.role !== "admin" && ctx.role !== "owner") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  let body: { name?: string };
  try {
    body = (await req.json()) as { name?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const name = body.name?.trim();
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  // Next sort order — append to the end of the active list.
  const last = await prisma.leadSource.findFirst({
    where: { organizationId: ctx.organization.id },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  const sortOrder = (last?.sortOrder ?? -1) + 1;

  try {
    const source = await prisma.leadSource.create({
      data: { organizationId: ctx.organization.id, name, sortOrder },
    });
    return NextResponse.json({ source }, { status: 201 });
  } catch (err) {
    // Unique (orgId, name) collision — surface a clean 409.
    if (typeof err === "object" && err && "code" in err && err.code === "P2002") {
      return NextResponse.json({ error: "A source with that name already exists" }, { status: 409 });
    }
    throw err;
  }
}
