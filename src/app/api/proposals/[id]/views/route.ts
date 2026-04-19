import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";

// GET /api/proposals/:id/views
//
// Operator-only view analytics summary. Returns:
//   { totalViews, uniqueSessions, lastViewedAt, views: [{...}] }
//
// Each view includes per-session totals and (when available) the event
// timeline so the dashboard can show "they lingered 4m on Day 3 · Mara".
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!auth.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }

  const { id } = await ctx.params;
  // Tenant scope — operator can only see views on their own proposals.
  const proposal = await prisma.proposal.findFirst({
    where: { id, organizationId: auth.organization.id },
    select: { id: true },
  });
  if (!proposal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const views = await prisma.proposalView.findMany({
    where: { proposalId: id },
    orderBy: { lastViewedAt: "desc" },
    include: {
      events: {
        orderBy: { createdAt: "asc" },
        take: 50,
      },
    },
  });

  const lastViewedAt = views[0]?.lastViewedAt ?? null;
  const totalViews = views.reduce((sum, v) => sum + v.viewCount, 0);

  return NextResponse.json({
    totalViews,
    uniqueSessions: views.length,
    lastViewedAt,
    views,
  });
}
