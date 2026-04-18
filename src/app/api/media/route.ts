import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";

// GET /api/media
//   Query params (all optional):
//     location, category, animalType, experienceType, tag, limit
//
// Returns destination media assets matching the filters, scoped to:
//   (organizationId = caller's org) ∪ (organizationId IS NULL, i.e. global)
//
// Ordering: org-owned first, then priority_score desc, then recent.
// This endpoint is the single read path the editor / generator will call to
// resolve context-aware images ("elephant in Tarangire", "arrival Nairobi",
// "beach Zanzibar") so we never fall back on random photography.
export async function GET(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ctx.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }

  const url = new URL(req.url);
  const q = url.searchParams;

  const location = q.get("location")?.trim() || undefined;
  const category = q.get("category")?.trim() || undefined;
  const animalType = q.get("animalType")?.trim() || undefined;
  const experienceType = q.get("experienceType")?.trim() || undefined;
  const tag = q.get("tag")?.trim() || undefined;
  const limit = clampInt(parseInt(q.get("limit") ?? "24", 10), 1, 100, 24);

  const whereCommon: Record<string, unknown> = {};
  if (location) whereCommon.locationName = { equals: location, mode: "insensitive" };
  if (category) whereCommon.category = category;
  if (animalType) whereCommon.animalType = animalType;
  if (experienceType) whereCommon.experienceType = experienceType;
  if (tag) whereCommon.tags = { has: tag };

  const assets = await prisma.destinationMediaAsset.findMany({
    where: {
      AND: [
        whereCommon,
        {
          OR: [
            { organizationId: ctx.organization.id },
            { organizationId: null },
          ],
        },
      ],
    },
    orderBy: [
      // Org-owned first (null last), then highest priority, then newest
      { organizationId: "desc" },
      { priorityScore: "desc" },
      { createdAt: "desc" },
    ],
    take: limit,
  });

  return NextResponse.json({ assets });
}

function clampInt(v: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, Math.round(v)));
}
