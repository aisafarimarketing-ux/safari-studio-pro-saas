import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";

// GET /api/property-tags — list all property tags in caller's org.
// Used by the editor's tag autocomplete.
export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ctx.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }

  const tags = await prisma.propertyTag.findMany({
    where: { organizationId: ctx.organization.id },
    orderBy: { name: "asc" },
    include: { _count: { select: { properties: true } } },
  });
  return NextResponse.json({ tags });
}

// POST /api/property-tags — create. Idempotent on (org, name).
// The editor calls this opportunistically when a user types a new tag.
export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ctx.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const tag = await prisma.propertyTag.upsert({
    where: { organizationId_name: { organizationId: ctx.organization.id, name } },
    create: { organizationId: ctx.organization.id, name },
    update: {},
  });
  return NextResponse.json({ tag });
}
