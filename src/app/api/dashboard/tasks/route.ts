import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";

// ─── GET /api/dashboard/tasks ──────────────────────────────────────────────
//
// Aggregated open tasks across every Request in the org. Powers the
// "Today's Priorities" task panel — the single place an operator can
// scan everything they've committed to do, without drilling into each
// request page.
//
// Open = doneAt is null. Sorted: overdue first (oldest dueAt), then
// upcoming (nearest dueAt), then no-due-date (newest first).
//
// Query: ?limit=N (default 20, max 100)

export async function GET(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ctx.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }

  const url = new URL(req.url);
  const limit = clampInt(url.searchParams.get("limit"), 1, 100, 20);
  const orgId = ctx.organization.id;
  const now = new Date();

  // Pull all open tasks scoped to the org via the request relation.
  const rows = await prisma.requestTask.findMany({
    where: {
      doneAt: null,
      request: { organizationId: orgId },
    },
    include: {
      request: {
        select: {
          id: true, referenceNumber: true, status: true,
          client: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      },
    },
    take: limit + 50, // buffer; we sort + slice below
  });

  // Sort: overdue (asc by dueAt), then upcoming (asc by dueAt), then
  // no-due-date (desc by createdAt = newest committed first).
  const overdue: typeof rows = [];
  const upcoming: typeof rows = [];
  const undated: typeof rows = [];
  for (const r of rows) {
    if (r.dueAt && r.dueAt < now) overdue.push(r);
    else if (r.dueAt) upcoming.push(r);
    else undated.push(r);
  }
  overdue.sort((a, b) => (a.dueAt!.getTime() - b.dueAt!.getTime()));
  upcoming.sort((a, b) => (a.dueAt!.getTime() - b.dueAt!.getTime()));
  undated.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const sorted = [...overdue, ...upcoming, ...undated].slice(0, limit);

  const tasks = sorted.map((t) => ({
    id: t.id,
    title: t.title,
    notes: t.notes,
    dueAt: t.dueAt?.toISOString() ?? null,
    overdue: t.dueAt ? t.dueAt < now : false,
    createdAt: t.createdAt.toISOString(),
    request: t.request
      ? {
          id: t.request.id,
          referenceNumber: t.request.referenceNumber,
          status: t.request.status,
          clientName: t.request.client
            ? [t.request.client.firstName, t.request.client.lastName]
                .filter(Boolean)
                .join(" ")
                .trim() || t.request.client.email
            : null,
        }
      : null,
  }));

  return NextResponse.json({
    tasks,
    counts: {
      open: rows.length,
      overdue: overdue.length,
    },
  });
}

function clampInt(v: string | null, min: number, max: number, fallback: number): number {
  if (!v) return fallback;
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}
