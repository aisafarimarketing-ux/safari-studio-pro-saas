import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { STARTER_LIBRARY } from "@/lib/starterLibrary";

// POST /api/properties/seed-starter
//
// Populates the caller's org library with the ten-camp starter set from
// src/lib/starterLibrary.ts. Skips any property whose name already exists
// in the org (case-insensitive) — safe to call twice.
//
// This is not gated by empty-library: operators can call it at any time
// to top up. The UI surfaces it most prominently on the empty state.

export async function POST() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ctx.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }
  if (!ctx.orgActive) {
    return NextResponse.json({ error: "Account suspended", code: "ORG_SUSPENDED" }, { status: 402 });
  }

  const orgId = ctx.organization.id;

  // Preload existing names + locations for dedupe.
  const [existingNames, existingLocations] = await Promise.all([
    prisma.property.findMany({
      where: { organizationId: orgId },
      select: { name: true },
    }),
    prisma.location.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true },
    }),
  ]);
  const existingNameSet = new Set(existingNames.map((p) => p.name.trim().toLowerCase()));
  const locByName = new Map(existingLocations.map((l) => [l.name.toLowerCase(), l.id]));

  let created = 0;
  const skipped: string[] = [];

  for (const entry of STARTER_LIBRARY) {
    if (existingNameSet.has(entry.name.toLowerCase())) {
      skipped.push(entry.name);
      continue;
    }

    // Resolve / create location.
    let locationId = locByName.get(entry.locationName.toLowerCase()) ?? null;
    if (!locationId) {
      const loc = await prisma.location.create({
        data: {
          organizationId: orgId,
          name: entry.locationName,
          country: entry.country,
          region: entry.region ?? null,
        },
        select: { id: true, name: true },
      });
      locationId = loc.id;
      locByName.set(loc.name.toLowerCase(), loc.id);
    }

    // Build the image rows only for non-empty URLs. The starter library
    // intentionally ships with empty leadImageUrl / galleryUrls so
    // operators always upload their own — see the comment block in
    // src/lib/starterLibrary.ts. Filtering here keeps the seed safe
    // even if a future starter entry partially fills in URLs.
    const imageRows: { url: string; order: number; isCover: boolean; caption: null }[] = [];
    if (entry.leadImageUrl) {
      imageRows.push({ url: entry.leadImageUrl, order: 0, isCover: true, caption: null });
    }
    entry.galleryUrls.filter(Boolean).forEach((url, i) => {
      imageRows.push({ url, order: i + 1, isCover: false, caption: null });
    });

    await prisma.property.create({
      data: {
        organizationId: orgId,
        name: entry.name,
        propertyClass: entry.propertyClass,
        locationId,
        shortSummary: entry.shortSummary,
        whatMakesSpecial: entry.whatMakesSpecial,
        whyWeChoose: entry.whyWeChoose,
        amenities: entry.amenities,
        mealPlan: entry.mealPlan,
        suggestedNights: entry.suggestedNights,
        suitability: entry.suitability,
        checkInTime: entry.checkInTime,
        checkOutTime: entry.checkOutTime,
        totalRooms: entry.totalRooms,
        spokenLanguages: entry.spokenLanguages,
        specialInterests: entry.specialInterests,
        ...(imageRows.length > 0 ? { images: { create: imageRows } } : {}),
      },
    });
    created++;
  }

  return NextResponse.json({
    created,
    skipped: skipped.length,
    skippedNames: skipped,
    total: STARTER_LIBRARY.length,
  });
}
