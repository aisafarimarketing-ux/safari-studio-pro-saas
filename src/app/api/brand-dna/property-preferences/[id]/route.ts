import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";

// DELETE /api/brand-dna/property-preferences/:id — delete a single pref,
// scoped to the caller's Brand DNA profile.
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!auth.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }

  const { id } = await ctx.params;
  const profile = await prisma.brandDNAProfile.findUnique({
    where: { organizationId: auth.organization.id },
    select: { id: true },
  });
  if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const result = await prisma.brandDNAPropertyPreference.deleteMany({
    where: { id, profileId: profile.id },
  });
  if (result.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
