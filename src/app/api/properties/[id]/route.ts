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
  // Try with rooms first; fall back to fetching without rooms if the
  // PropertyRoom table hasn't been pushed to this environment's DB yet.
  // Saves the endpoint from 500-ing on fresh deployments where
  // `prisma db push` hasn't run.
  let property: unknown = null;
  try {
    property = await prisma.property.findFirst({
      where: { id, organizationId: auth.organization.id },
      include: {
        location: true,
        images: { orderBy: { order: "asc" } },
        tags: { include: { tag: true } },
        customSections: { orderBy: { order: "asc" } },
        rooms: { orderBy: { order: "asc" } },
      },
    });
  } catch (err) {
    if (isMissingTableError(err)) {
      console.warn("[properties.GET] PropertyRoom table missing — run `prisma db push`");
      property = await prisma.property.findFirst({
        where: { id, organizationId: auth.organization.id },
        include: {
          location: true,
          images: { orderBy: { order: "asc" } },
          tags: { include: { tag: true } },
          customSections: { orderBy: { order: "asc" } },
        },
      });
    } else {
      throw err;
    }
  }
  if (!property) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ property });
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
    try {
      await tx.property.update({ where: { id }, data });
    } catch (err) {
      if (isMissingTableError(err)) {
        // A new column (checkInTime, spokenLanguages, etc.) hasn't been
        // pushed to this environment yet. Strip the unknown fields and
        // retry with what the DB actually has.
        const legacyData = { ...data } as Record<string, unknown>;
        for (const k of [
          "checkInTime",
          "checkOutTime",
          "totalRooms",
          "spokenLanguages",
          "specialInterests",
        ]) delete legacyData[k];
        await tx.property.update({ where: { id }, data: legacyData });
        console.warn("[properties.PUT] new Property columns missing — run `prisma db push`");
      } else {
        throw err;
      }
    }

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
      // Same wipe-and-recreate pattern as images / customSections. Wrapped
      // so the rest of the PUT still works if the PropertyRoom table
      // hasn't been pushed to this environment yet.
      try {
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
      } catch (err) {
        if (isMissingTableError(err)) {
          console.warn("[properties.PUT] PropertyRoom table missing — run `prisma db push`");
        } else {
          throw err;
        }
      }
    }

    try {
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
    } catch (err) {
      if (isMissingTableError(err)) {
        return await tx.property.findFirst({
          where: { id },
          include: {
            location: true,
            images: { orderBy: { order: "asc" } },
            tags: { include: { tag: true } },
            customSections: { orderBy: { order: "asc" } },
          },
        });
      }
      throw err;
    }
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

/** Detects Prisma's "table does not exist" error so callers can degrade
 *  gracefully when schema hasn't been pushed to this environment yet.
 *  Covers PostgreSQL ("relation … does not exist") + Prisma's own
 *  code-prefixed error codes. */
function isMissingTableError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string };
  if (e.code === "P2021" || e.code === "P2022") return true; // prisma: table / column missing
  const msg = typeof e.message === "string" ? e.message.toLowerCase() : "";
  return (
    msg.includes("does not exist") ||
    msg.includes("relation ") ||
    msg.includes("no such table") ||
    msg.includes("unknown column")
  );
}
