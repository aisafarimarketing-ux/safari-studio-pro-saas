import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { isSuperAdmin } from "@/lib/superAdmin";

// POST /api/admin/organizations/:id/tier
//
// Super-admin-only endpoint. Sets an org's commercial tier (trial / pilot /
// paid). For pilot, an optional `expiresAt` deadline is stored so the
// dashboard can surface a countdown. A short freeform `note` is also
// persisted for the admin's own records.

type Body = {
  tier?: "trial" | "pilot" | "paid";
  expiresAt?: string | null;
  note?: string | null;
};

const ALLOWED = new Set(["trial", "pilot", "paid"]);

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!isSuperAdmin(userId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const tier = body.tier;
  if (!tier || !ALLOWED.has(tier)) {
    return NextResponse.json({ error: "tier must be trial | pilot | paid" }, { status: 400 });
  }

  let expires: Date | null = null;
  if (body.expiresAt) {
    const parsed = new Date(body.expiresAt);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: "expiresAt is not a valid date" }, { status: 400 });
    }
    expires = parsed;
  }

  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : null;

  const organization = await prisma.organization.update({
    where: { id },
    data: {
      tier,
      tierExpiresAt: expires,
      tierNote: note,
    },
  });

  return NextResponse.json({ ok: true, organization });
}
