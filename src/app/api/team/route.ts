import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";

// GET /api/team — list every member of the caller's organization plus
// their live presence snapshot and workload counts. Powers the admin
// Team page ("who has what, who's online, response time, pending").
//
// Scopes by membership, so a member who looks up this endpoint only ever
// sees their own org. Members can read the team list too (useful for
// mention pickers and assignee dropdowns); write operations will live on
// /api/team/[userId] and are admin-only.

const ACTIVE_STAGES = ["new", "working", "open"];
const ONLINE_WINDOW_MS = 2 * 60 * 1000; // 2 minutes

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ctx.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }

  const orgId = ctx.organization.id;

  // Pull the three data streams in parallel — members, presence snapshots,
  // open request counts per assignee. Join in memory to keep the query
  // shape simple.
  const [memberships, presences, stageCounts, firstReplyStats, bookedThisMonth] = await Promise.all([
    prisma.orgMembership.findMany({
      where: { organizationId: orgId },
      include: {
        user: {
          select: { id: true, name: true, email: true, createdAt: true },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.presence.findMany({
      where: { organizationId: orgId },
      select: {
        userId: true,
        currentView: true,
        currentAction: true,
        lastActiveAt: true,
      },
    }),
    prisma.request.groupBy({
      by: ["assignedToUserId", "status"],
      where: { organizationId: orgId, status: { in: ACTIVE_STAGES } },
      _count: { _all: true },
    }),
    // For response-time median we need the per-user set of (firstReplyAt -
    // receivedAt) deltas. Compute in JS since Postgres percentile queries
    // are harder to get right cross-DB. Pull only what we need.
    prisma.request.findMany({
      where: {
        organizationId: orgId,
        firstReplyAt: { not: null },
        receivedAt: { gte: daysAgo(30) },
        assignedToUserId: { not: null },
      },
      select: { assignedToUserId: true, receivedAt: true, firstReplyAt: true },
    }),
    prisma.request.groupBy({
      by: ["assignedToUserId"],
      where: {
        organizationId: orgId,
        status: "booked",
        lastActivityAt: { gte: startOfMonth() },
        assignedToUserId: { not: null },
      },
      _count: { _all: true },
    }),
  ]);

  // Build lookup maps.
  const presenceByUser = new Map(presences.map((p) => [p.userId, p]));
  const stageByUser = new Map<string, { new: number; working: number; open: number; total: number }>();
  for (const c of stageCounts) {
    if (!c.assignedToUserId) continue;
    const row = stageByUser.get(c.assignedToUserId) ?? { new: 0, working: 0, open: 0, total: 0 };
    if (c.status === "new") row.new = c._count._all;
    else if (c.status === "working") row.working = c._count._all;
    else if (c.status === "open") row.open = c._count._all;
    row.total += c._count._all;
    stageByUser.set(c.assignedToUserId, row);
  }

  // Median response time per user (in minutes). Median > mean so a single
  // outlier holiday doesn't blow the stat.
  const replyDeltasByUser = new Map<string, number[]>();
  for (const r of firstReplyStats) {
    if (!r.assignedToUserId || !r.firstReplyAt) continue;
    const deltaMin = (r.firstReplyAt.getTime() - r.receivedAt.getTime()) / 60000;
    if (deltaMin < 0) continue;
    const arr = replyDeltasByUser.get(r.assignedToUserId) ?? [];
    arr.push(deltaMin);
    replyDeltasByUser.set(r.assignedToUserId, arr);
  }
  const medianByUser = new Map<string, number | null>();
  for (const [userId, deltas] of replyDeltasByUser.entries()) {
    medianByUser.set(userId, median(deltas));
  }

  const bookedByUser = new Map(
    bookedThisMonth
      .filter((b) => b.assignedToUserId)
      .map((b) => [b.assignedToUserId as string, b._count._all]),
  );

  const now = Date.now();

  const team = memberships.map((m) => {
    const presence = presenceByUser.get(m.userId);
    const lastActiveAt = presence?.lastActiveAt ?? null;
    const onlineStatus = lastActiveAt && now - lastActiveAt.getTime() < ONLINE_WINDOW_MS
      ? "online"
      : lastActiveAt && now - lastActiveAt.getTime() < 15 * 60 * 1000
        ? "idle"
        : "offline";

    const stages = stageByUser.get(m.userId) ?? { new: 0, working: 0, open: 0, total: 0 };
    return {
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
      roleTitle: m.roleTitle,
      profilePhotoUrl: m.profilePhotoUrl,
      memberSince: m.createdAt,
      presence: {
        status: onlineStatus,
        currentView: presence?.currentView ?? null,
        currentAction: presence?.currentAction ?? null,
        lastActiveAt,
      },
      workload: stages,
      medianResponseMinutes: medianByUser.get(m.userId) ?? null,
      bookedThisMonth: bookedByUser.get(m.userId) ?? 0,
    };
  });

  return NextResponse.json({ team, orgId, you: { userId: ctx.user.id, role: ctx.role } });
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function startOfMonth(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}
