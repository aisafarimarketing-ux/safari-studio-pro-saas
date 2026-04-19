import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import {
  PROPERTY_CLASSES,
  MEAL_PLANS,
  SUITABILITY,
  type PropertyClassId,
  type MealPlanId,
} from "@/lib/properties";

// POST /api/properties/import
//
// Bulk-create properties from a parsed CSV. The client parses the CSV and
// sends rows as JSON so we keep this server handler simple and avoid a CSV
// parser dep; we just validate and bulk-insert.
//
// Row shape:
//   name, propertyClass, locationName, country, region, shortSummary,
//   whatMakesSpecial, whyWeChoose, amenities (pipe-separated),
//   mealPlan, suggestedNights, suitability (pipe-separated), tags (pipe-separated)
//
// Locations are deduplicated by (org, name) — existing rows are reused,
// new ones are created. Same for tags.

type RowIn = {
  name?: string;
  propertyClass?: string;
  locationName?: string;
  country?: string;
  region?: string;
  shortSummary?: string;
  whatMakesSpecial?: string;
  whyWeChoose?: string;
  amenities?: string;        // pipe-separated
  mealPlan?: string;
  suggestedNights?: string | number;
  suitability?: string;      // pipe-separated
  tags?: string;             // pipe-separated
};

type RowError = { row: number; name: string; error: string };

export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ctx.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }
  if (!ctx.orgActive) {
    return NextResponse.json({ error: "Account suspended", code: "ORG_SUSPENDED" }, { status: 402 });
  }

  let body: { rows?: RowIn[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (rows.length === 0) {
    return NextResponse.json({ error: "No rows to import" }, { status: 400 });
  }
  if (rows.length > 500) {
    return NextResponse.json({ error: "Too many rows (max 500 per import)" }, { status: 400 });
  }

  const orgId = ctx.organization.id;

  // Preload locations + tags for dedupe.
  const [existingLocations, existingTags] = await Promise.all([
    prisma.location.findMany({ where: { organizationId: orgId }, select: { id: true, name: true } }),
    prisma.propertyTag.findMany({ where: { organizationId: orgId }, select: { id: true, name: true } }),
  ]);
  const locByName = new Map(existingLocations.map((l) => [l.name.toLowerCase(), l.id]));
  const tagByName = new Map(existingTags.map((t) => [t.name.toLowerCase(), t.id]));

  const classes = new Set(PROPERTY_CLASSES.map((c) => c.id as string));
  const mealPlans = new Set(MEAL_PLANS.map((m) => m.id as string));
  const suitabilityIds = new Set(SUITABILITY.map((s) => s.id as string));

  const errors: RowError[] = [];
  let created = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const name = (row.name ?? "").trim();
    if (!name) {
      errors.push({ row: i + 1, name: "(blank)", error: "name is required" });
      continue;
    }
    try {
      // Resolve location — create if new.
      let locationId: string | null = null;
      const locName = (row.locationName ?? "").trim();
      if (locName) {
        const existing = locByName.get(locName.toLowerCase());
        if (existing) {
          locationId = existing;
        } else {
          const loc = await prisma.location.create({
            data: {
              organizationId: orgId,
              name: locName,
              country: (row.country ?? "").trim() || null,
              region: (row.region ?? "").trim() || null,
            },
            select: { id: true, name: true },
          });
          locationId = loc.id;
          locByName.set(loc.name.toLowerCase(), loc.id);
        }
      }

      // Normalise enums — drop silently if not in the allow-list.
      const propertyClass = classes.has(row.propertyClass ?? "") ? (row.propertyClass as PropertyClassId) : null;
      const mealPlan = mealPlans.has(row.mealPlan ?? "") ? (row.mealPlan as MealPlanId) : null;
      const amenities = splitPipes(row.amenities).slice(0, 30);
      const suitability = splitPipes(row.suitability)
        .filter((s) => suitabilityIds.has(s))
        .slice(0, 10);
      const suggestedNights = clampInt(row.suggestedNights, 0, 60);

      const created_property = await prisma.property.create({
        data: {
          organizationId: orgId,
          name,
          propertyClass,
          locationId,
          shortSummary: trimOrNull(row.shortSummary, 400),
          whatMakesSpecial: trimOrNull(row.whatMakesSpecial, 1200),
          whyWeChoose: trimOrNull(row.whyWeChoose, 1200),
          amenities,
          mealPlan,
          suggestedNights,
          suitability,
        },
        select: { id: true },
      });

      // Tags — create any missing, then connect.
      const tagNames = splitPipes(row.tags).slice(0, 10);
      if (tagNames.length > 0) {
        const tagIds: string[] = [];
        for (const tname of tagNames) {
          let tid = tagByName.get(tname.toLowerCase());
          if (!tid) {
            const tag = await prisma.propertyTag.create({
              data: { organizationId: orgId, name: tname },
              select: { id: true, name: true },
            });
            tid = tag.id;
            tagByName.set(tag.name.toLowerCase(), tag.id);
          }
          tagIds.push(tid);
        }
        await prisma.propertyTagOnProperty.createMany({
          data: tagIds.map((tagId) => ({ propertyId: created_property.id, tagId })),
          skipDuplicates: true,
        });
      }

      created++;
    } catch (err) {
      errors.push({
        row: i + 1,
        name,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({ created, failed: errors.length, errors });
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function trimOrNull(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().slice(0, max);
  return s || null;
}

function splitPipes(v: unknown): string[] {
  if (typeof v !== "string") return [];
  return v
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
}

function clampInt(v: unknown, min: number, max: number): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseInt(v, 10) : NaN;
  if (!Number.isFinite(n)) return null;
  return Math.max(min, Math.min(max, Math.round(n)));
}
