import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";

// POST /api/brand-dna/property-preferences — add a preferred/avoided property.
// Upserts the profile row if the org doesn't have one yet.
export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ctx.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }
  if (ctx.role !== "owner") {
    return NextResponse.json(
      { error: "Brand DNA is owner-only." },
      { status: 403 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const kind = typeof body.kind === "string" && (body.kind === "preferred" || body.kind === "avoided")
    ? body.kind
    : null;
  const propertyName = typeof body.propertyName === "string" ? body.propertyName.trim() : "";
  if (!kind || propertyName.length === 0) {
    return NextResponse.json({ error: "kind and propertyName are required" }, { status: 400 });
  }

  const location = typeof body.location === "string" ? body.location.trim() || null : null;
  const notes = typeof body.notes === "string" ? body.notes.trim() || null : null;

  const profile = await prisma.brandDNAProfile.upsert({
    where: { organizationId: ctx.organization.id },
    create: { organizationId: ctx.organization.id },
    update: {},
  });

  const entry = await prisma.brandDNAPropertyPreference.create({
    data: { profileId: profile.id, kind, propertyName, location, notes },
  });
  return NextResponse.json({ entry });
}
