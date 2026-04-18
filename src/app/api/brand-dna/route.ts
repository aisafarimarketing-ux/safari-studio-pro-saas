import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { computeBrandDNACompletion } from "@/lib/brandDNA";

// GET /api/brand-dna — fetch the caller's organization Brand DNA (+ completion)
export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ctx.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }

  const profile = await prisma.brandDNAProfile.findUnique({
    where: { organizationId: ctx.organization.id },
    include: {
      propertyPreferences: { orderBy: { createdAt: "asc" } },
    },
  });

  const completion = computeBrandDNACompletion(
    profile,
    profile?.propertyPreferences ?? [],
  );

  return NextResponse.json({ profile: profile ?? null, completion });
}

// PUT /api/brand-dna — upsert any subset of fields on the profile.
// Body may contain any of the editable fields; unknown fields are ignored.
export async function PUT(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ctx.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch = sanitize(body);

  const profile = await prisma.brandDNAProfile.upsert({
    where: { organizationId: ctx.organization.id },
    create: { organizationId: ctx.organization.id, ...patch },
    update: patch,
    include: { propertyPreferences: { orderBy: { createdAt: "asc" } } },
  });

  const completion = computeBrandDNACompletion(profile, profile.propertyPreferences);
  return NextResponse.json({ profile, completion });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function str(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

function slider(v: unknown): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v !== "number" || !Number.isFinite(v)) return undefined;
  return Math.max(0, Math.min(100, Math.round(v)));
}

function stringArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return v.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
}

function jsonValue(v: unknown): unknown | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v === "object") return v;
  return undefined;
}

// Only keys the client is allowed to write land in the DB. Anything else is
// silently dropped so we never accidentally expose internal columns.
function sanitize(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  const setIf = (key: string, val: unknown) => {
    if (val !== undefined) out[key] = val;
  };

  // Brand Core
  setIf("brandName", str(body.brandName));
  setIf("logoUrl", str(body.logoUrl));
  setIf("websiteUrl", str(body.websiteUrl));
  setIf("tagline", str(body.tagline));
  setIf("shortDescription", str(body.shortDescription));

  // Voice & Tone
  setIf("voiceFormality", slider(body.voiceFormality));
  setIf("voiceLuxury", slider(body.voiceLuxury));
  setIf("voiceDensity", slider(body.voiceDensity));
  setIf("voiceStorytelling", slider(body.voiceStorytelling));
  setIf("writingSample1", str(body.writingSample1));
  setIf("writingSample2", str(body.writingSample2));

  // Visual Style
  setIf("brandColors", jsonValue(body.brandColors));
  setIf("headingFont", str(body.headingFont));
  setIf("bodyFont", str(body.bodyFont));
  setIf("customFontUrl", str(body.customFontUrl));
  setIf("preferredImageStyles", stringArray(body.preferredImageStyles));
  setIf("imageLibrary", jsonValue(body.imageLibrary));

  // Property preferences
  setIf("tierBias", str(body.tierBias));
  setIf("styleBias", stringArray(body.styleBias));

  // AI Instructions
  setIf("aiInstructions", str(body.aiInstructions));

  return out;
}
