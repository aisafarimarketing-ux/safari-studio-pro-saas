import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyOverdue } from "@/lib/notifications";

// GET /api/cron/overdue — daily-ish job that nudges request handlers
// about stale work.
//
// Auth: no Clerk session (cron jobs run headless). Protected by a
// shared secret env var CRON_SECRET that must be sent via the
// Authorization: Bearer header (Railway/Vercel cron support both).
//
// Scope: any request whose status is in {new, working, open} and whose
// lastActivityAt is older than THRESHOLD_HOURS. Sends one email per
// (request × assignee) and stamps a system note so a handler opening
// the request sees the nudge in the timeline. Idempotent-ish: tracks
// last-nudge via the Request row's lastActivityAt so a handler who
// replies in any way won't re-trigger. If they don't reply and the
// job runs again, they'll get nudged again — which is the point.

const THRESHOLD_HOURS = 48;
const ACTIVE_STAGES = ["new", "working", "open"];

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const auth = req.headers.get("authorization") ?? "";
  const provided = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - THRESHOLD_HOURS);

  const stale = await prisma.request.findMany({
    where: {
      status: { in: ACTIVE_STAGES },
      assignedToUserId: { not: null },
      lastActivityAt: { lt: cutoff },
    },
    include: {
      client: { select: { firstName: true, lastName: true } },
    },
    take: 500,
  });

  let dispatched = 0;
  for (const r of stale) {
    if (!r.assignedToUserId) continue;
    const hoursStale = Math.floor((Date.now() - r.lastActivityAt.getTime()) / 3_600_000);
    await notifyOverdue({
      organizationId: r.organizationId,
      requestId: r.id,
      referenceNumber: r.referenceNumber,
      assigneeUserId: r.assignedToUserId,
      hoursStale,
      clientName: [r.client?.firstName, r.client?.lastName].filter(Boolean).join(" ").trim() || null,
    });
    // Leave a system note so the nudge is visible in the timeline.
    await prisma.requestNote.create({
      data: {
        requestId: r.id,
        kind: "system",
        body: `Auto-nudge sent to handler — no activity in ${hoursStale}h.`,
      },
    });
    dispatched += 1;
  }

  return NextResponse.json({ ok: true, considered: stale.length, dispatched, threshold: THRESHOLD_HOURS });
}
