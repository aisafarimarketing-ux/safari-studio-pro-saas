import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import {
  canUseMode,
  isFollowUpMode,
  normaliseFollowUpMode,
} from "@/lib/followUpMode";

// GET   /api/org/follow-up-mode   — current mode + isPremium for the org
// PATCH /api/org/follow-up-mode   — set mode (owner / admin only)
//
// PATCH body: { mode: "assisted" | "smart_assist" | "auto" }
//
// Premium gating runs through canUseMode() — currently a pass-through
// while the spec explicitly defers gating. Flipping the gate to
// require isPremium for non-assisted modes is a single edit in
// src/lib/followUpMode.ts.

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ctx.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }

  const org = await prisma.organization.findUnique({
    where: { id: ctx.organization.id },
    select: { followUpMode: true, isPremium: true },
  });
  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  return NextResponse.json({
    mode: normaliseFollowUpMode(org.followUpMode),
    isPremium: org.isPremium,
  });
}

type PatchBody = { mode?: unknown };

export async function PATCH(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ctx.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return NextResponse.json(
      { error: "Owner or admin required to change Follow-up Mode." },
      { status: 403 },
    );
  }

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!isFollowUpMode(body.mode)) {
    return NextResponse.json(
      { error: "mode must be 'assisted' | 'smart_assist' | 'auto'." },
      { status: 400 },
    );
  }

  // Read isPremium so the guard sees the live value. Today this is
  // always allowed; the call is structural so the gate can flip later.
  const org = await prisma.organization.findUnique({
    where: { id: ctx.organization.id },
    select: { isPremium: true },
  });
  const decision = canUseMode(body.mode, org?.isPremium ?? false);
  if (!decision.ok) {
    return NextResponse.json({ error: decision.reason }, { status: 402 });
  }

  const updated = await prisma.organization.update({
    where: { id: ctx.organization.id },
    data: { followUpMode: body.mode },
    select: { followUpMode: true, isPremium: true },
  });

  return NextResponse.json({
    mode: normaliseFollowUpMode(updated.followUpMode),
    isPremium: updated.isPremium,
  });
}
