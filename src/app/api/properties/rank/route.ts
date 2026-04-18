import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { rankProperties } from "@/lib/propertyRanking";

// POST /api/properties/rank
//
// Body (all optional):
//   { locationId?: string, propertyClass?: string, tagIds?: string[], limit?: number }
//
// Returns: { ranked: [{ property, score, matchedSignals }] }
//
// Library-only: never invents a property. When the org has no Brand DNA
// preferences, scoring is neutral and falls back to most-recently-edited.
export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ctx.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* allow empty body */ }

  const filters = {
    locationId: typeof body.locationId === "string" ? body.locationId : null,
    propertyClass: typeof body.propertyClass === "string" ? body.propertyClass : null,
    tagIds: Array.isArray(body.tagIds)
      ? (body.tagIds as unknown[]).filter((x): x is string => typeof x === "string")
      : [],
  };
  const limit = clampInt(body.limit, 1, 50, 12);

  const [properties, brandDNA] = await Promise.all([
    prisma.property.findMany({
      where: { organizationId: ctx.organization.id, archived: false },
      include: {
        location: { select: { id: true, name: true, country: true } },
        images: {
          where: { isCover: true },
          take: 1,
          select: { id: true, url: true, isCover: true },
        },
        tags: { include: { tag: { select: { id: true, name: true } } } },
      },
    }),
    prisma.brandDNAProfile.findUnique({
      where: { organizationId: ctx.organization.id },
      include: { propertyPreferences: true },
    }),
  ]);

  const ranked = rankProperties(properties, filters, {
    brandDNA: brandDNA
      ? { tierBias: brandDNA.tierBias, styleBias: brandDNA.styleBias }
      : null,
    propertyPreferences: brandDNA?.propertyPreferences ?? [],
  });

  return NextResponse.json({ ranked: ranked.slice(0, limit) });
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, Math.round(v)));
}
