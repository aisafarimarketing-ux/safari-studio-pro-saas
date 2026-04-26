import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { recordActivity } from "@/lib/activity";

// ─── POST /api/requests/[id]/tasks/auto ────────────────────────────────────
//
// Idempotent task creation from the priorities dashboard. The client
// passes the nextBestAction it's already showing the operator (so the
// task title matches what they clicked), plus the priority label so we
// can derive the dueAt offset:
//
//   HOT  → now (do it today)
//   WARM → +24h
//   COLD → +48h
//
// Dedup: one open task per (requestId, actionType). Re-clicking "Add
// task" returns the existing row — never creates a duplicate. Closed
// tasks don't block creation: if the operator marked an old "Reply to
// client" done last week and a new reply lands today, a fresh task can
// be opened.
//
// Body: {
//   actionType: NextActionType (string),
//   actionLabel: string,           // task title — what the operator saw
//   reason: string,                // scoring engine's "why this action"
//   priorityLevel: "hot" | "warm" | "cold",
// }

const VALID_ACTION_TYPES = new Set([
  "draft_quote",
  "send_proposal",
  "reply",
  "nudge",
  "ask_for_booking",
  "follow_up",
  "confirm_reservation",
  "stay_in_touch",
  "wait",
]);

const VALID_PRIORITY_LEVELS = new Set(["hot", "warm", "cold"]);

type Body = {
  actionType?: string;
  actionLabel?: string;
  reason?: string;
  priorityLevel?: string;
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ctx.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }
  if (!ctx.orgActive) {
    return NextResponse.json({ error: "Account suspended", code: "ORG_SUSPENDED" }, { status: 402 });
  }

  const { id } = await params;
  const request = await prisma.request.findFirst({
    where: { id, organizationId: ctx.organization.id },
    select: { id: true },
  });
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const actionType = body.actionType?.trim();
  if (!actionType || !VALID_ACTION_TYPES.has(actionType)) {
    return NextResponse.json({ error: "Invalid actionType" }, { status: 400 });
  }
  const actionLabel = body.actionLabel?.trim().slice(0, 160);
  if (!actionLabel) {
    return NextResponse.json({ error: "actionLabel is required" }, { status: 400 });
  }
  const priorityLevel = body.priorityLevel?.trim().toLowerCase() ?? "warm";
  if (!VALID_PRIORITY_LEVELS.has(priorityLevel)) {
    return NextResponse.json({ error: "Invalid priorityLevel" }, { status: 400 });
  }
  const reason = body.reason?.trim().slice(0, 500) ?? null;

  // ── Dedup: one OPEN task per (requestId, actionType). The schema
  //    index (requestId, actionType, doneAt) makes this lookup cheap.
  const existing = await prisma.requestTask.findFirst({
    where: {
      requestId: request.id,
      actionType,
      doneAt: null,
    },
  });
  if (existing) {
    return NextResponse.json({ task: existing, alreadyExisted: true });
  }

  // ── Compute dueAt by priority level. HOT = now (do today), WARM =
  //    tomorrow, COLD = day after. The operator can edit it later.
  const now = new Date();
  const dueAt = new Date(now);
  if (priorityLevel === "hot") {
    // Same-day end-of-day so the task surfaces under "today's overdue"
    // tomorrow morning if it slips.
    dueAt.setHours(23, 59, 59, 999);
  } else if (priorityLevel === "warm") {
    dueAt.setDate(dueAt.getDate() + 1);
  } else {
    dueAt.setDate(dueAt.getDate() + 2);
  }

  const task = await prisma.requestTask.create({
    data: {
      requestId: request.id,
      title: actionLabel,
      notes: reason,
      reason,
      dueAt,
      actionType,
      priorityLevel: priorityLevel === "hot" ? "high" : priorityLevel === "cold" ? "low" : "normal",
      auto: false, // user clicked the button — it's a human commit, not a system auto-fill
      createdByUserId: ctx.user.id,
    },
  });

  // Bump request lastActivityAt so the priority recency reflects the
  // commitment — the operator just took an action against this deal.
  await prisma.request.update({
    where: { id: request.id },
    data: { lastActivityAt: now },
  });

  // Activity feed — drives "today's wins" momentum metric.
  void recordActivity({
    userId: ctx.user.id,
    organizationId: ctx.organization.id,
    type: "taskCreated",
    targetType: "task",
    targetId: task.id,
    detail: { requestId: request.id, actionType, priorityLevel, auto: false },
  });

  return NextResponse.json({ task, alreadyExisted: false });
}
