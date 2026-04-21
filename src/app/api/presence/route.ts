import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";

// /api/presence — lightweight heartbeat from the client. Called every ~30s
// from a hook mounted on every authenticated page. Updates the caller's
// Presence row so the admin Team page can render "Lilian is editing
// Yue Xu's quote — active 20s ago".
//
// Keep the payload tiny (two optional fields + a timestamp). If this ever
// gets chatty we move to Supabase Realtime; until then a small POST every
// 30s is negligible.

export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ctx.organization) {
    // Silently ignore — the heartbeat runs on pages that may load before
    // an org is resolved. Returning 204 avoids console noise.
    return new NextResponse(null, { status: 204 });
  }

  let body: { currentView?: string; currentAction?: string } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    // Allow empty body — heartbeat without state is still valid.
  }

  const now = new Date();
  const currentView = body.currentView?.trim().slice(0, 120) || null;
  const currentAction = body.currentAction?.trim().slice(0, 40) || null;

  await prisma.presence.upsert({
    where: { userId: ctx.user.id },
    create: {
      userId: ctx.user.id,
      organizationId: ctx.organization.id,
      currentView,
      currentAction,
      lastActiveAt: now,
    },
    update: {
      organizationId: ctx.organization.id,
      currentView,
      currentAction,
      lastActiveAt: now,
    },
  });

  return NextResponse.json({ ok: true, at: now });
}
