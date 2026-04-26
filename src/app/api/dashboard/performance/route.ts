import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";

// ─── GET /api/dashboard/performance ────────────────────────────────────────
//
// Performance Insights — proves what's working. Aggregates RequestTask
// rows for the org over the last 90 days (default) and computes:
//
//   conversionRate  = converted / (converted + no_response)
//   avgFollowupHrs  = mean(doneAt - createdAt)  for completed tasks
//   avgBookingHrs   = mean(bookedAt - doneAt)   for converted tasks
//   byActionType[]  = the same metrics broken down per action
//
// Honest empty states: when N is small (<5 converted), we return the
// raw counts but mark the conversion rate as `null` so the UI shows
// "not enough data yet" instead of a misleading percentage.

const DEFAULT_WINDOW_DAYS = 90;
const MIN_N_FOR_RATE = 5;

export async function GET(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ctx.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }

  const url = new URL(req.url);
  const windowDays = clampInt(url.searchParams.get("days"), 7, 365, DEFAULT_WINDOW_DAYS);
  const orgId = ctx.organization.id;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - windowDays);

  // All tasks in the org's window. Includes pending — used for the
  // "tasks created" headline. Booked + completed counts also derive
  // from this set.
  const tasks = await prisma.requestTask.findMany({
    where: {
      request: { organizationId: orgId },
      createdAt: { gte: cutoff },
    },
    select: {
      id: true,
      actionType: true,
      taskOutcome: true,
      auto: true,
      createdAt: true,
      doneAt: true,
      bookedAt: true,
      linkedMessageId: true,
    },
  });

  // Headline counts.
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.doneAt).length;
  const convertedTasks = tasks.filter((t) => t.taskOutcome === "converted").length;
  const noResponseTasks = tasks.filter((t) => t.taskOutcome === "no_response").length;
  const pendingTasks = tasks.filter((t) => t.taskOutcome === "pending").length;
  const autoCreatedTasks = tasks.filter((t) => t.auto).length;

  // Time-to-followup and time-to-booking (in hours), computed only on
  // tasks where the relevant timestamps exist. Median + mean both.
  const followupHours = tasks
    .filter((t) => t.doneAt)
    .map((t) => (t.doneAt!.getTime() - t.createdAt.getTime()) / 3_600_000);
  const bookingHours = tasks
    .filter((t) => t.taskOutcome === "converted" && t.doneAt && t.bookedAt)
    .map((t) => (t.bookedAt!.getTime() - t.doneAt!.getTime()) / 3_600_000);

  const decided = convertedTasks + noResponseTasks;
  const conversionRate = decided >= MIN_N_FOR_RATE ? convertedTasks / decided : null;

  // Per-action-type breakdown.
  const byActionType = aggregateByActionType(tasks);

  // ── Insights — only emit when N is meaningful ────────────────────────
  // Honest copy: empty array when nothing's statistically worth saying.
  const insights = buildInsights({
    byActionType,
    avgFollowupHours: mean(followupHours),
    minN: MIN_N_FOR_RATE,
  });

  return NextResponse.json({
    windowDays,
    counts: {
      totalTasks,
      completedTasks,
      convertedTasks,
      noResponseTasks,
      pendingTasks,
      autoCreatedTasks,
    },
    rates: {
      conversionRate,
      hasEnoughData: decided >= MIN_N_FOR_RATE,
      decidedCount: decided,
    },
    timing: {
      avgFollowupHours: mean(followupHours),
      medianFollowupHours: median(followupHours),
      avgBookingHours: mean(bookingHours),
      medianBookingHours: median(bookingHours),
    },
    byActionType,
    insights,
  });
}

// ─── Helpers ───────────────────────────────────────────────────────────────

type TaskRow = {
  id: string;
  actionType: string | null;
  taskOutcome: string;
  auto: boolean;
  createdAt: Date;
  doneAt: Date | null;
  bookedAt: Date | null;
  linkedMessageId: string | null;
};

type ActionTypeStats = {
  actionType: string;
  total: number;
  converted: number;
  noResponse: number;
  pending: number;
  conversionRate: number | null;
  hasEnoughData: boolean;
  avgFollowupHours: number | null;
  avgBookingHours: number | null;
};

function aggregateByActionType(tasks: TaskRow[]): ActionTypeStats[] {
  const buckets = new Map<string, TaskRow[]>();
  for (const t of tasks) {
    const key = t.actionType ?? "manual";
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(t);
  }
  const out: ActionTypeStats[] = [];
  for (const [actionType, rows] of buckets.entries()) {
    const converted = rows.filter((r) => r.taskOutcome === "converted").length;
    const noResponse = rows.filter((r) => r.taskOutcome === "no_response").length;
    const decided = converted + noResponse;
    const followupHrs = rows
      .filter((r) => r.doneAt)
      .map((r) => (r.doneAt!.getTime() - r.createdAt.getTime()) / 3_600_000);
    const bookingHrs = rows
      .filter((r) => r.taskOutcome === "converted" && r.doneAt && r.bookedAt)
      .map((r) => (r.bookedAt!.getTime() - r.doneAt!.getTime()) / 3_600_000);
    out.push({
      actionType,
      total: rows.length,
      converted,
      noResponse,
      pending: rows.filter((r) => r.taskOutcome === "pending").length,
      conversionRate: decided >= MIN_N_FOR_RATE ? converted / decided : null,
      hasEnoughData: decided >= MIN_N_FOR_RATE,
      avgFollowupHours: mean(followupHrs),
      avgBookingHours: mean(bookingHrs),
    });
  }
  // Sort by conversion rate desc (with hasEnoughData first), then by total desc.
  out.sort((a, b) => {
    if (a.hasEnoughData !== b.hasEnoughData) return a.hasEnoughData ? -1 : 1;
    if (a.conversionRate !== null && b.conversionRate !== null && a.conversionRate !== b.conversionRate) {
      return b.conversionRate - a.conversionRate;
    }
    return b.total - a.total;
  });
  return out;
}

type Insight = {
  kind: "action_winner" | "fast_followup" | "auto_task_lift";
  message: string;
};

function buildInsights(args: {
  byActionType: ActionTypeStats[];
  avgFollowupHours: number | null;
  minN: number;
}): Insight[] {
  const out: Insight[] = [];

  // 1. Best vs baseline conversion ("X converts Yx higher than baseline").
  const ranked = args.byActionType.filter((a) => a.hasEnoughData && a.conversionRate !== null);
  if (ranked.length >= 2) {
    const best = ranked[0];
    const baseline = ranked[ranked.length - 1];
    if (best.conversionRate! > baseline.conversionRate! && baseline.conversionRate! > 0) {
      const lift = best.conversionRate! / baseline.conversionRate!;
      if (lift >= 1.5) {
        out.push({
          kind: "action_winner",
          message: `${humanizeActionType(best.actionType)} converts ${lift.toFixed(1)}× higher than ${humanizeActionType(baseline.actionType)} for your team.`,
        });
      }
    }
  }

  // 2. Fast follow-up signal — only if we have a meaningful spread.
  if (args.avgFollowupHours !== null && args.avgFollowupHours <= 4) {
    out.push({
      kind: "fast_followup",
      message: `Your team replies in ${formatHours(args.avgFollowupHours)} on average. Speed correlates with conversion — keep it up.`,
    });
  }

  return out;
}

function mean(ns: number[]): number | null {
  if (ns.length === 0) return null;
  const sum = ns.reduce((a, b) => a + b, 0);
  return sum / ns.length;
}

function median(ns: number[]): number | null {
  if (ns.length === 0) return null;
  const sorted = [...ns].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function clampInt(v: string | null, min: number, max: number, fallback: number): number {
  if (!v) return fallback;
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function humanizeActionType(actionType: string): string {
  const map: Record<string, string> = {
    reply: "Replies",
    follow_up: "Follow-ups",
    ask_for_booking: "Asking for the booking",
    nudge: "Nudges",
    send_proposal: "Proposal sends",
    confirm_reservation: "Reservation confirmations",
    stay_in_touch: "Light check-ins",
    draft_quote: "Drafting a quote",
    wait: "Waiting",
    manual: "Manual tasks",
  };
  return map[actionType] ?? actionType;
}

function formatHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} minutes`;
  if (hours < 24) return `${hours.toFixed(1)} hours`;
  return `${(hours / 24).toFixed(1)} days`;
}
