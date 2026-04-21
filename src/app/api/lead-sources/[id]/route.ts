import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";

// /api/lead-sources/[id] — rename, reorder, archive (admin/owner only).

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ctx.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }
  if (ctx.role !== "admin" && ctx.role !== "owner") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.leadSource.findFirst({
    where: { id, organizationId: ctx.organization.id },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: { name?: string; sortOrder?: number; archived?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) updates.name = body.name.trim();
  if (typeof body.sortOrder === "number") updates.sortOrder = body.sortOrder;
  if (typeof body.archived === "boolean") updates.archived = body.archived;

  try {
    const source = await prisma.leadSource.update({ where: { id: existing.id }, data: updates });
    return NextResponse.json({ source });
  } catch (err) {
    if (typeof err === "object" && err && "code" in err && err.code === "P2002") {
      return NextResponse.json({ error: "Name already exists" }, { status: 409 });
    }
    throw err;
  }
}

// Hard delete only when unused — otherwise the historical attribution on
// past requests (Request.source stores the name, not the id) would still
// read fine, but we prefer the archived flag to keep the taxonomy stable.

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ctx.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }
  if (ctx.role !== "admin" && ctx.role !== "owner") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.leadSource.findFirst({
    where: { id, organizationId: ctx.organization.id },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.leadSource.delete({ where: { id: existing.id } });
  return NextResponse.json({ ok: true });
}
