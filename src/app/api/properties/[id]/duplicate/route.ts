import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";

// POST /api/properties/:id/duplicate
//
// Creates a copy of the property + its images, tag links, and custom
// sections. Cover image is preserved. Name is suffixed with " (copy)".
// Useful for "we have three almost-identical Mara camps" workflows.
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!auth.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }

  const { id } = await ctx.params;
  const source = await prisma.property.findFirst({
    where: { id, organizationId: auth.organization.id },
    include: {
      images: { orderBy: { order: "asc" } },
      tags: true,
      customSections: { orderBy: { order: "asc" } },
    },
  });
  if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const copy = await prisma.$transaction(async (tx) => {
    const created = await tx.property.create({
      data: {
        organizationId: auth.organization!.id,
        locationId: source.locationId,
        name: `${source.name} (copy)`,
        propertyClass: source.propertyClass,
        shortSummary: source.shortSummary,
        whatMakesSpecial: source.whatMakesSpecial,
        whyWeChoose: source.whyWeChoose,
        amenities: source.amenities,
        mealPlan: source.mealPlan,
        suggestedNights: source.suggestedNights,
        suitability: source.suitability,
        internalNotes: source.internalNotes,
      },
    });

    if (source.images.length > 0) {
      await tx.propertyImage.createMany({
        data: source.images.map((img) => ({
          propertyId: created.id,
          url: img.url,
          caption: img.caption,
          order: img.order,
          isCover: img.isCover,
        })),
      });
    }

    if (source.tags.length > 0) {
      await tx.propertyTagOnProperty.createMany({
        data: source.tags.map((t) => ({ propertyId: created.id, tagId: t.tagId })),
      });
    }

    if (source.customSections.length > 0) {
      await tx.propertyCustomSection.createMany({
        data: source.customSections.map((s) => ({
          propertyId: created.id,
          title: s.title,
          body: s.body,
          visible: s.visible,
          order: s.order,
        })),
      });
    }

    return created;
  });

  return NextResponse.json({ property: { id: copy.id } });
}
