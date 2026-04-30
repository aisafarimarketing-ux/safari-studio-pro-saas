import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";

// Shape of an editable property — what the editor PUTs back to us.
type IncomingImage = { id?: string; url: string; caption?: string | null; order: number; isCover: boolean };
type IncomingSection = { id?: string; title: string; body?: string | null; visible: boolean; order: number };
type IncomingRoom = {
  id?: string;
  name: string;
  bedConfig?: string | null;
  description?: string | null;
  imageUrls?: string[];
  order: number;
};

// GET /api/properties/:id — full editor payload.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!auth.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }

  const { id } = await ctx.params;
  const property = await prisma.property.findFirst({
    where: { id, organizationId: auth.organization.id },
    include: {
      location: true,
      images: { orderBy: { order: "asc" } },
      tags: { include: { tag: true } },
      customSections: { orderBy: { order: "asc" } },
      rooms: { orderBy: { order: "asc" } },
    },
  });
  if (!property) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Explicit no-cache headers — operators reported deleted property
  // images resurrecting in the day-card picker even after a hard
  // browser refresh. Default Next.js / Vercel response caching can
  // hold a property GET for several minutes; setting no-store at the
  // route level forces every fetch (browser + edge + CDN) to round-
  // trip to Postgres. The picker also passes cache:"no-store" client-
  // side; both sides agreeing eliminates the stale-payload class of
  // bug entirely.
  return NextResponse.json(
    { property },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        Pragma: "no-cache",
      },
    },
  );
}

// PUT /api/properties/:id — full upsert. Replaces images / tags /
// custom sections wholesale based on the request body. Cheaper than
// per-item endpoints for a small editor + keeps the client simple.
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!auth.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }

  const { id } = await ctx.params;

  const existing = await prisma.property.findFirst({
    where: { id, organizationId: auth.organization.id },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data = sanitizeProperty(body);
  const images = Array.isArray(body.images) ? (body.images as IncomingImage[]) : null;
  const tagIds = Array.isArray(body.tagIds) ? (body.tagIds as unknown[]).filter((x): x is string => typeof x === "string") : null;
  const customSections = Array.isArray(body.customSections)
    ? (body.customSections as IncomingSection[])
    : null;
  const rooms = Array.isArray(body.rooms) ? (body.rooms as IncomingRoom[]) : null;

  // Run scalar update + nested replacements in a transaction so the
  // editor never sees a half-updated property.
  const updated = await prisma.$transaction(async (tx) => {
    await tx.property.update({ where: { id }, data });

    if (images) {
      // Wipe and re-create. With < 50 images this is cheap and correctness
      // beats incremental diff complexity.
      await tx.propertyImage.deleteMany({ where: { propertyId: id } });
      if (images.length > 0) {
        await tx.propertyImage.createMany({
          data: images.map((img, i) => ({
            propertyId: id,
            url: String(img.url),
            caption: img.caption?.trim() || null,
            order: typeof img.order === "number" ? img.order : i,
            isCover: Boolean(img.isCover),
          })),
        });
      }
    }

    if (tagIds) {
      await tx.propertyTagOnProperty.deleteMany({ where: { propertyId: id } });
      if (tagIds.length > 0) {
        // Validate tags belong to this org before linking
        const valid = await tx.propertyTag.findMany({
          where: { id: { in: tagIds }, organizationId: auth.organization!.id },
          select: { id: true },
        });
        if (valid.length > 0) {
          await tx.propertyTagOnProperty.createMany({
            data: valid.map((t) => ({ propertyId: id, tagId: t.id })),
          });
        }
      }
    }

    if (customSections) {
      await tx.propertyCustomSection.deleteMany({ where: { propertyId: id } });
      if (customSections.length > 0) {
        await tx.propertyCustomSection.createMany({
          data: customSections.map((s, i) => ({
            propertyId: id,
            title: String(s.title),
            body: s.body?.trim() || null,
            visible: s.visible !== false,
            order: typeof s.order === "number" ? s.order : i,
          })),
        });
      }
    }

    if (rooms) {
      // Wipe and recreate — same pattern as images / customSections.
      await tx.propertyRoom.deleteMany({ where: { propertyId: id } });
      if (rooms.length > 0) {
        await tx.propertyRoom.createMany({
          data: rooms.map((r, i) => ({
            propertyId: id,
            name: String(r.name || "Room"),
            bedConfig: r.bedConfig?.trim() || null,
            description: r.description?.trim() || null,
            imageUrls: Array.isArray(r.imageUrls)
              ? r.imageUrls.filter((u): u is string => typeof u === "string" && u.length > 0)
              : [],
            order: typeof r.order === "number" ? r.order : i,
          })),
        });
      }
    }

    return await tx.property.findFirst({
      where: { id },
      include: {
        location: true,
        images: { orderBy: { order: "asc" } },
        tags: { include: { tag: true } },
        customSections: { orderBy: { order: "asc" } },
        rooms: { orderBy: { order: "asc" } },
      },
    });
  });

  return NextResponse.json({ property: updated });
}

// DELETE /api/properties/:id — hard delete. Cascade deletes images,
// tag joins, and custom sections via the schema's onDelete rules.
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!auth.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }

  const { id } = await ctx.params;
  const result = await prisma.property.deleteMany({
    where: { id, organizationId: auth.organization.id },
  });
  if (result.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function str(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

function int(v: unknown): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v !== "number" || !Number.isFinite(v)) return undefined;
  return Math.max(0, Math.round(v));
}

function stringArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return v.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
}

function bool(v: unknown): boolean | undefined {
  if (typeof v !== "boolean") return undefined;
  return v;
}

function sanitizeProperty(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  const setIf = (key: string, v: unknown) => { if (v !== undefined) out[key] = v; };

  setIf("name", str(body.name));
  setIf("propertyClass", str(body.propertyClass));
  setIf("locationId", str(body.locationId));
  setIf("shortSummary", str(body.shortSummary));
  setIf("whatMakesSpecial", str(body.whatMakesSpecial));
  setIf("whyWeChoose", str(body.whyWeChoose));
  setIf("amenities", stringArray(body.amenities));
  setIf("mealPlan", str(body.mealPlan));
  setIf("suggestedNights", int(body.suggestedNights));
  setIf("suitability", stringArray(body.suitability));
  setIf("checkInTime", str(body.checkInTime));
  setIf("checkOutTime", str(body.checkOutTime));
  setIf("totalRooms", int(body.totalRooms));
  setIf("spokenLanguages", stringArray(body.spokenLanguages));
  setIf("specialInterests", stringArray(body.specialInterests));
  setIf("internalNotes", str(body.internalNotes));
  setIf("archived", bool(body.archived));

  return out;
}

