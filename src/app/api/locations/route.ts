import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";

// GET /api/locations — list all locations in caller's org.
export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ctx.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }

  const locations = await prisma.location.findMany({
    where: { organizationId: ctx.organization.id },
    orderBy: [{ country: "asc" }, { name: "asc" }],
    include: { _count: { select: { properties: true } } },
  });
  return NextResponse.json({ locations });
}

// POST /api/locations — create. Idempotent on (org, name): returns the
// existing row if one already exists. Lets the editor's inline "+ Add
// location" UX feel safe to spam.
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
  const country = typeof body.country === "string" ? body.country.trim() || null : null;
  const region = typeof body.region === "string" ? body.region.trim() || null : null;

  const location = await prisma.location.upsert({
    where: { organizationId_name: { organizationId: ctx.organization.id, name } },
    create: { organizationId: ctx.organization.id, name, country, region },
    update: { country, region },
  });
  return NextResponse.json({ location });
}
