import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";

// GET /api/properties — list, filterable by location, class, tag.
//
// Query params (all optional, comma-separable for multi-value):
//   location  — locationId
//   class     — propertyClass
//   tag       — tag id (repeatable)
//   archived  — "true" to include archived (default: false)
//   q         — text search (name, summary)
export async function GET(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ctx.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }

  const url = new URL(req.url);
  const q = url.searchParams;

  const locationId = q.get("location") || undefined;
  const propertyClass = q.get("class") || undefined;
  const includeArchived = q.get("archived") === "true";
  const search = q.get("q")?.trim() || undefined;
  const tagIds = q.getAll("tag").filter(Boolean);

  const where: Record<string, unknown> = { organizationId: ctx.organization.id };
  if (!includeArchived) where.archived = false;
  if (locationId) where.locationId = locationId;
  if (propertyClass) where.propertyClass = propertyClass;
  if (tagIds.length > 0) {
    where.tags = { some: { tagId: { in: tagIds } } };
  }
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { shortSummary: { contains: search, mode: "insensitive" } },
    ];
  }

  const properties = await prisma.property.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }],
    include: {
      location: { select: { id: true, name: true, country: true } },
      images: {
        where: { isCover: true },
        take: 1,
        select: { id: true, url: true },
      },
      tags: {
        include: { tag: { select: { id: true, name: true } } },
      },
      _count: { select: { images: true } },
    },
  });

  return NextResponse.json({ properties });
}

// POST /api/properties — create a new property.
// Required: name. Everything else is optional and editable later.
export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ctx.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const property = await prisma.property.create({
    data: {
      organizationId: ctx.organization.id,
      name,
      propertyClass: typeof body.propertyClass === "string" ? body.propertyClass : null,
      locationId: typeof body.locationId === "string" ? body.locationId : null,
    },
    select: { id: true },
  });

  return NextResponse.json({ property });
}
