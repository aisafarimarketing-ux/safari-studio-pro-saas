import "server-only";
import { prisma } from "@/lib/prisma";

// ─── Outcome attribution — Phase 6 feedback loop ──────────────────────────
//
// Determines whether a completed RequestTask led to a booking. Two entry
// points:
//
//   attributeBookedRequest(requestId)
//     Real-time hook. Called from PATCH /api/requests/[id] the moment a
//     request flips to status="booked". Marks every completed task on
//     that request from the last ATTRIBUTION_WINDOW_DAYS as converted,
//     stamps bookedAt with the booking timestamp, and links the first
//     outbound message that fired in the same window.
//
//   sweepNoResponseTasks()
//     Eventual-consistency cron. Walks every "pending" task that's been
//     completed for longer than ATTRIBUTION_WINDOW_DAYS without a
//     booking and marks them "no_response". Idempotent — re-runs only
//     touch tasks still in pending state.
//
// Both never throw. Errors land in console.warn so the parent flow
// (request PATCH, cron handler) keeps moving.

export const ATTRIBUTION_WINDOW_DAYS = 7;

// ─── Real-time: convert tasks when a request books ─────────────────────────

/** Marks every completed task on `requestId` from the last
 *  ATTRIBUTION_WINDOW_DAYS as "converted". Safe to call multiple times. */
export async function attributeBookedRequest(
  requestId: string,
  bookedAt: Date = new Date(),
): Promise<{ converted: number }> {
  try {
    const cutoff = new Date(bookedAt);
    cutoff.setDate(cutoff.getDate() - ATTRIBUTION_WINDOW_DAYS);

    // Find every closed-but-not-yet-attributed task done within the window.
    const candidates = await prisma.requestTask.findMany({
      where: {
        requestId,
        taskOutcome: "pending",
        doneAt: { gte: cutoff, lte: bookedAt },
      },
      select: { id: true, createdAt: true, doneAt: true },
    });
    if (candidates.length === 0) return { converted: 0 };

    // For each task, find the first outbound message sent on this
    // request between task creation and task completion. That's the
    // "follow-up that led to the booking" link the spec asks for.
    const updates = await Promise.all(
      candidates.map(async (t) => {
        if (!t.doneAt) return null;
        const linkedMessage = await prisma.message.findFirst({
          where: {
            requestId,
            direction: "outbound",
            createdAt: { gte: t.createdAt, lte: t.doneAt },
          },
          orderBy: { createdAt: "asc" },
          select: { id: true },
        });
        return prisma.requestTask.update({
          where: { id: t.id },
          data: {
            taskOutcome: "converted",
            bookedAt,
            linkedMessageId: linkedMessage?.id ?? null,
          },
        });
      }),
    );
    return { converted: updates.filter(Boolean).length };
  } catch (err) {
    console.warn(`[attribution] attributeBookedRequest(${requestId}) failed:`, err);
    return { converted: 0 };
  }
}

// ─── Cron: sweep completed-but-stale tasks to no_response ──────────────────

/** Walks every pending task that's been completed for longer than
 *  ATTRIBUTION_WINDOW_DAYS and marks it "no_response". Limits to a
 *  bounded batch per run so a backfill on a busy org doesn't ship a
 *  single massive transaction. */
export async function sweepNoResponseTasks(opts: { limit?: number } = {}): Promise<{
  swept: number;
  remaining: number;
}> {
  const limit = opts.limit ?? 500;
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - ATTRIBUTION_WINDOW_DAYS);

  // Tasks completed before the cutoff that are still pending have
  // sat outside the window without converting. Safe to sweep.
  const candidates = await prisma.requestTask.findMany({
    where: {
      taskOutcome: "pending",
      doneAt: { not: null, lte: cutoff },
    },
    select: { id: true, requestId: true, createdAt: true, doneAt: true },
    take: limit,
  });

  if (candidates.length === 0) {
    return { swept: 0, remaining: 0 };
  }

  // Defence-in-depth: re-check each candidate's request status. If a
  // booking landed in the meantime (race with the real-time hook),
  // mark converted instead of no_response. Cheap because requestIds
  // are usually clustered.
  const requestIds = Array.from(new Set(candidates.map((c) => c.requestId)));
  const requests = await prisma.request.findMany({
    where: { id: { in: requestIds } },
    select: { id: true, status: true, updatedAt: true },
  });
  const requestById = new Map(requests.map((r) => [r.id, r]));

  let swept = 0;
  await Promise.all(
    candidates.map(async (t) => {
      const r = requestById.get(t.requestId);
      if (!r) return;
      // Booking may have landed within the task's window even though
      // the task slipped past the cutoff (real-time hook may have been
      // skipped by an outage). Attribute "converted" if so.
      if (
        r.status === "booked" &&
        t.doneAt &&
        r.updatedAt.getTime() - t.doneAt.getTime() <= ATTRIBUTION_WINDOW_DAYS * 86_400_000 &&
        r.updatedAt.getTime() >= t.doneAt.getTime()
      ) {
        const linkedMessage = await prisma.message.findFirst({
          where: {
            requestId: t.requestId,
            direction: "outbound",
            createdAt: { gte: t.createdAt, lte: t.doneAt },
          },
          orderBy: { createdAt: "asc" },
          select: { id: true },
        });
        await prisma.requestTask.update({
          where: { id: t.id },
          data: {
            taskOutcome: "converted",
            bookedAt: r.updatedAt,
            linkedMessageId: linkedMessage?.id ?? null,
          },
        });
        swept += 1;
        return;
      }
      // Otherwise it's a no-response.
      await prisma.requestTask.update({
        where: { id: t.id },
        data: { taskOutcome: "no_response" },
      });
      swept += 1;
    }),
  );

  // Rough estimate of remaining work. Cheap COUNT — drives the cron's
  // "did I drain the queue?" reporting.
  const remaining = await prisma.requestTask.count({
    where: { taskOutcome: "pending", doneAt: { not: null, lte: cutoff } },
  });

  return { swept, remaining };
}
