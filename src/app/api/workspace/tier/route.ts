import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";

// GET /api/workspace/tier
//
// Returns the caller's org tier + expiry so the dashboard can surface a
// pilot countdown banner. Deliberately separate from /api/proposals so a
// tier load failure never blocks the workspace.

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ctx.organization) return NextResponse.json({ tier: null });
  return NextResponse.json({
    tier: ctx.organization.tier,
    tierExpiresAt: ctx.organization.tierExpiresAt
      ? ctx.organization.tierExpiresAt.toISOString()
      : null,
    tierNote: ctx.organization.tierNote,
  });
}
