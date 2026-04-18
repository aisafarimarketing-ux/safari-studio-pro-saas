import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { rankMediaCandidates } from "@/lib/destinationMedia";

// GET /api/media
//   Query params (all optional):
//     location, category, animalType, experienceType, tag, propertyId, limit
//
// Returns context-aware media candidates ranked by:
//   property images > org assets > global assets
//
// Within each tier, score is computed from location/animal/experience/category
// matches plus the asset's stored priorityScore. See src/lib/destinationMedia.ts.
export async function GET(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ctx.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }

  const url = new URL(req.url);
  const q = url.searchParams;

  const locationName = q.get("location")?.trim() || undefined;
  const category = q.get("category")?.trim() || undefined;
  const animalType = q.get("animalType")?.trim() || undefined;
  const experienceType = q.get("experienceType")?.trim() || undefined;
  const tag = q.get("tag")?.trim() || undefined;
  const propertyId = q.get("propertyId")?.trim() || undefined;
  const limit = clampInt(parseInt(q.get("limit") ?? "24", 10), 1, 100, 24);

  // Pre-filter at the DB layer — keeps payload small. The ranker re-applies
  // scoring (DB filter is "must match", scoring is "weight against").
  const where: Record<string, unknown> = {};
  if (locationName) where.locationName = { equals: locationName, mode: "insensitive" };
  if (category) where.category = category;
  if (animalType) where.animalType = animalType;
  if (experienceType) where.experienceType = experienceType;
  if (tag) where.tags = { has: tag };

  const [assets, propertyImages] = await Promise.all([
    prisma.destinationMediaAsset.findMany({
      where: {
        AND: [
          where,
          { OR: [{ organizationId: ctx.organization.id }, { organizationId: null }] },
        ],
      },
      take: 200, // ranker trims after scoring
    }),
    propertyId
      ? prisma.propertyImage.findMany({
          where: { property: { id: propertyId, organizationId: ctx.organization.id } },
          orderBy: [{ isCover: "desc" }, { order: "asc" }],
          select: { id: true, url: true, caption: true, isCover: true },
        })
      : Promise.resolve([]),
  ]);

  const ranked = rankMediaCandidates({
    orgId: ctx.organization.id,
    assets,
    propertyImages,
    context: {
      locationName,
      animalType,
      experienceType,
      category,
      tags: tag ? [tag] : [],
    },
  });

  return NextResponse.json({ candidates: ranked.slice(0, limit) });
}

function clampInt(v: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, Math.round(v)));
}
