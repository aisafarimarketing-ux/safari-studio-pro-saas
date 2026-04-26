import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";

// ─── GET /api/messages/inbox ───────────────────────────────────────────────
//
// Recent inbound messages for the dashboard inbox tile. Returns the
// latest N messages across all of the org's threads, with unread count
// for the badge. UI reads from our DB only — never directly from GHL.
//
// Query: ?limit=N (default 10, max 30)

export async function GET(req: Request) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!auth.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }

  const url = new URL(req.url);
  const limit = clampInt(url.searchParams.get("limit"), 1, 30, 10);

  const [unreadCount, messages] = await Promise.all([
    prisma.message.count({
      where: {
        organizationId: auth.organization.id,
        direction: "inbound",
        readAt: null,
      },
    }),
    prisma.message.findMany({
      where: {
        organizationId: auth.organization.id,
        direction: "inbound",
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        client: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        request: {
          select: { id: true, referenceNumber: true, status: true },
        },
      },
    }),
  ]);

  return NextResponse.json({ unreadCount, messages });
}

function clampInt(v: string | null, min: number, max: number, fallback: number): number {
  if (!v) return fallback;
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}
