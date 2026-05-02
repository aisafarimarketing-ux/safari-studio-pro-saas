import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";

// GET /api/session-ping
//
// Lightweight session keep-alive endpoint hit by the editor every
// 60 seconds. Returns 200 + { ok: true } when the Clerk session is
// valid; 401 when it's expired. The editor uses the response to
// proactively warn the operator that their session is going stale
// BEFORE auto-save fails — instead of after.
//
// No DB writes, no payload, just an auth check. This route is in
// the protected matcher (anything under /api/* except /api/public)
// so getAuthContext returns null on a missing/expired session and
// we 401 cleanly.

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  return NextResponse.json({ ok: true, orgActive: ctx.orgActive });
}
