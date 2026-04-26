"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useDashboardTheme } from "./DashboardTheme";

// ─── Today's Priorities ────────────────────────────────────────────────────
//
// The intelligence layer's user surface. Scored requests on the left,
// open tasks on the right, summary metrics + filters above. Reads from
// /api/dashboard/priorities and /api/dashboard/tasks; both compute on
// the fly so the operator always sees current state.
//
// The section is full-width within the dashboard container and uses a
// 2-column layout (1.6fr priorities · 1fr tasks) on desktop, stacking
// on mobile.

const FOREST = "#1b3a2d";

// ── Types (mirror the API response shape) ────────────────────────────────

type FilterKey = "all" | "hot" | "needs-followup" | "unread";

type NextActionType =
  | "draft_quote" | "send_proposal" | "reply" | "nudge"
  | "ask_for_booking" | "follow_up" | "confirm_reservation"
  | "stay_in_touch" | "wait";

type NextAction = { type: NextActionType; label: string; reason: string; urgent: boolean };
type Score = {
  total: number; engagement: number; recency: number; value: number;
  label: "hot" | "warm" | "cold"; nextAction: NextAction;
};

type Priority = {
  requestId: string;
  referenceNumber: string;
  status: string;
  clientId: string | null;
  clientName: string;
  clientEmail: string | null;
  clientCountry: string | null;
  proposalId: string | null;
  proposalTitle: string | null;
  valueCents: number;
  currency: string;
  score: Score;
  engagement: {
    views: number; totalSeconds: number; pricingViewed: boolean;
    inboundMessages: number; outboundMessages: number;
  };
  unreadCount: number;
  lastActivityIso: string;
  lastActivityKind: "message" | "view" | "status";
  needsFollowup: boolean;
  atRisk: boolean;
};

type Summary = {
  hotDealsCount: number;
  hotDealsValueCents: number;
  pipelineAtRiskValueCents: number;
  pipelineAtRiskCount: number;
  unreadMessages: number;
  followupsDueCount: number;
  totalActiveValueCents: number;
  currency: string;
};

type FilterCounts = Record<FilterKey, number>;

type PrioritiesResponse = {
  summary: Summary;
  filterCounts: FilterCounts;
  priorities: Priority[];
};

type Task = {
  id: string;
  title: string;
  notes: string | null;
  dueAt: string | null;
  overdue: boolean;
  createdAt: string;
  request: { id: string; referenceNumber: string; status: string; clientName: string | null } | null;
};

type TasksResponse = { tasks: Task[]; counts: { open: number; overdue: number } };

// ─── Component ────────────────────────────────────────────────────────────

export function PrioritiesSection() {
  const { tokens } = useDashboardTheme();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [data, setData] = useState<PrioritiesResponse | null>(null);
  const [tasksData, setTasksData] = useState<TasksResponse | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  // Load priorities. Refetches when filter changes.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/dashboard/priorities?filter=${filter}&limit=15`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as PrioritiesResponse;
        if (!cancelled) {
          setData(json);
          setLoadFailed(false);
        }
      } catch {
        if (!cancelled) setLoadFailed(true);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [filter]);

  // Load tasks (independent — same cadence as the priorities polling).
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/dashboard/tasks?limit=12", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as TasksResponse;
        if (!cancelled) setTasksData(json);
      } catch {
        // silent — tasks panel is secondary
      }
    };
    void load();
    const interval = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const summary = data?.summary;
  const counts = data?.filterCounts ?? { all: 0, hot: 0, "needs-followup": 0, unread: 0 };
  const priorities = data?.priorities ?? [];

  return (
    <section
      className="rounded-2xl p-5 md:p-6"
      style={{
        background: tokens.tileBg,
        boxShadow: `inset 0 0 0 1px ${tokens.ring}, ${tokens.shadow}`,
      }}
    >
      {/* Header */}
      <header className="flex items-baseline justify-between gap-4 mb-5">
        <div>
          <div className="text-[10px] uppercase tracking-[0.28em] font-semibold" style={{ color: tokens.muted }}>
            Today's Priorities
          </div>
          <h2
            className="text-[20px] md:text-[22px] font-semibold mt-1 leading-tight"
            style={{ color: tokens.heading }}
          >
            Who to follow up with — right now.
          </h2>
        </div>
      </header>

      {/* Summary metrics strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-5">
        <Metric
          eyebrow="Hot deals"
          value={summary ? String(summary.hotDealsCount) : "—"}
          sub={summary ? formatMoney(summary.hotDealsValueCents, summary.currency) : ""}
          tone="hot"
          tokens={tokens}
        />
        <Metric
          eyebrow="At risk"
          value={summary ? String(summary.pipelineAtRiskCount) : "—"}
          sub={summary ? formatMoney(summary.pipelineAtRiskValueCents, summary.currency) : ""}
          tone="warn"
          tokens={tokens}
        />
        <Metric
          eyebrow="Unread"
          value={summary ? String(summary.unreadMessages) : "—"}
          sub={summary && summary.unreadMessages > 0 ? "messages waiting" : ""}
          tone="info"
          tokens={tokens}
        />
        <Metric
          eyebrow="Follow-ups due"
          value={summary ? String(summary.followupsDueCount) : "—"}
          sub={summary && summary.followupsDueCount > 0 ? "needs a nudge" : ""}
          tone="info"
          tokens={tokens}
        />
      </div>

      {/* Two-column body — priorities + task panel */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-5">
        {/* Priority cards */}
        <div className="min-w-0">
          {/* Filter tabs */}
          <div className="flex items-center gap-1.5 mb-3 flex-wrap">
            <FilterTab label="All" count={counts.all} active={filter === "all"} onClick={() => setFilter("all")} tokens={tokens} />
            <FilterTab label="Hot" count={counts.hot} active={filter === "hot"} onClick={() => setFilter("hot")} tokens={tokens} accent="hot" />
            <FilterTab label="Needs follow-up" count={counts["needs-followup"]} active={filter === "needs-followup"} onClick={() => setFilter("needs-followup")} tokens={tokens} />
            <FilterTab label="Unread" count={counts.unread} active={filter === "unread"} onClick={() => setFilter("unread")} tokens={tokens} accent="unread" />
          </div>

          {data === null && !loadFailed ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <CardSkeleton key={i} ringColor={tokens.ring} />)}
            </div>
          ) : loadFailed ? (
            <EmptyState message="Couldn't load priorities." tokens={tokens} />
          ) : priorities.length === 0 ? (
            <EmptyState
              message={filter === "all"
                ? "Nothing in the priority queue. Quiet day — or a clean inbox."
                : `No deals match this filter.`}
              tokens={tokens}
            />
          ) : (
            <ul className="space-y-2">
              {priorities.map((p) => <PriorityCard key={p.requestId} priority={p} tokens={tokens} />)}
            </ul>
          )}
        </div>

        {/* Tasks panel */}
        <TaskRail tasksData={tasksData} tokens={tokens} />
      </div>
    </section>
  );
}

// ─── Metric pill ─────────────────────────────────────────────────────────

function Metric({
  eyebrow, value, sub, tone, tokens,
}: {
  eyebrow: string; value: string; sub: string;
  tone: "hot" | "warn" | "info";
  tokens: ReturnType<typeof useDashboardTheme>["tokens"];
}) {
  const accent =
    tone === "hot" ? "#dc2626" :
    tone === "warn" ? "#d97706" :
    tokens.primary;
  return (
    <div
      className="rounded-xl p-3 border"
      style={{ background: tokens.pageBg, borderColor: tokens.ring }}
    >
      <div className="text-[9.5px] uppercase tracking-[0.22em] font-semibold" style={{ color: tokens.muted }}>
        {eyebrow}
      </div>
      <div className="flex items-baseline gap-2 mt-1">
        <div className="text-[22px] font-bold tabular-nums leading-none" style={{ color: accent }}>
          {value}
        </div>
        {sub && (
          <div className="text-[10.5px] truncate" style={{ color: tokens.muted }}>{sub}</div>
        )}
      </div>
    </div>
  );
}

// ─── Filter tab ──────────────────────────────────────────────────────────

function FilterTab({
  label, count, active, onClick, tokens, accent,
}: {
  label: string; count: number; active: boolean; onClick: () => void;
  tokens: ReturnType<typeof useDashboardTheme>["tokens"];
  accent?: "hot" | "unread";
}) {
  const accentColor = accent === "hot" ? "#dc2626" : tokens.primary;
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[12px] font-semibold px-3 py-1.5 rounded-full transition flex items-center gap-1.5"
      style={{
        background: active ? tokens.primary : "transparent",
        color: active ? "white" : tokens.heading,
        border: `1px solid ${active ? tokens.primary : tokens.ring}`,
      }}
    >
      {label}
      {count > 0 && (
        <span
          className="text-[10.5px] tabular-nums px-1.5 py-0.5 rounded-full font-semibold"
          style={{
            background: active ? "rgba(255,255,255,0.16)" : (accent ? `${accentColor}1a` : tokens.primarySoft),
            color: active ? "white" : (accent ? accentColor : tokens.primary),
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

// ─── Priority card ───────────────────────────────────────────────────────

function PriorityCard({
  priority, tokens,
}: {
  priority: Priority;
  tokens: ReturnType<typeof useDashboardTheme>["tokens"];
}) {
  const labelColor = priority.score.label === "hot" ? "#dc2626" : priority.score.label === "warm" ? "#d97706" : tokens.muted;
  const labelBg = priority.score.label === "hot" ? "#fee2e2" : priority.score.label === "warm" ? "#fef3c7" : tokens.ring;
  const messageHref = `/requests/${priority.requestId}`;

  return (
    <li
      className="rounded-xl p-3.5 border transition"
      style={{
        background: tokens.pageBg,
        borderColor: priority.score.nextAction.urgent ? `${labelColor}66` : tokens.ring,
      }}
    >
      <div className="flex items-start gap-3">
        {/* Priority badge column */}
        <div className="shrink-0">
          <div
            className="text-[10px] uppercase tracking-[0.18em] font-bold px-2 py-1 rounded-md"
            style={{ background: labelBg, color: labelColor }}
          >
            {priority.score.label}
          </div>
          <div
            className="text-[10px] tabular-nums text-center mt-1.5 font-semibold"
            style={{ color: tokens.muted }}
          >
            {priority.score.total}
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2 flex-wrap">
            <Link
              href={`/requests/${priority.requestId}`}
              className="text-[14px] font-semibold truncate hover:underline"
              style={{ color: tokens.heading }}
              title={priority.clientName}
            >
              {priority.clientName}
            </Link>
            {priority.valueCents > 0 && (
              <div className="text-[12.5px] font-semibold tabular-nums shrink-0" style={{ color: tokens.heading }}>
                {formatMoney(priority.valueCents, priority.currency)}
              </div>
            )}
          </div>
          <div className="text-[11.5px] mt-0.5" style={{ color: tokens.muted }}>
            <span className="tabular-nums">#{priority.referenceNumber}</span>
            {priority.proposalTitle ? <> · {priority.proposalTitle}</> : null}
            <> · {formatRelative(priority.lastActivityIso)}</>
            {priority.unreadCount > 0 && (
              <> · <span style={{ color: "#dc2626", fontWeight: 600 }}>{priority.unreadCount} unread</span></>
            )}
          </div>

          {/* Engagement chips */}
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {priority.engagement.views > 0 && (
              <Chip icon="◐" tokens={tokens}>{priority.engagement.views} {priority.engagement.views === 1 ? "view" : "views"}</Chip>
            )}
            {priority.engagement.totalSeconds >= 30 && (
              <Chip icon="◔" tokens={tokens}>{formatDwell(priority.engagement.totalSeconds)}</Chip>
            )}
            {priority.engagement.pricingViewed && (
              <Chip icon="$" tokens={tokens} highlight>Saw pricing</Chip>
            )}
            {priority.engagement.inboundMessages > 0 && (
              <Chip icon="→" tokens={tokens}>{priority.engagement.inboundMessages} {priority.engagement.inboundMessages === 1 ? "reply" : "replies"}</Chip>
            )}
            {priority.atRisk && (
              <Chip icon="!" tokens={tokens} variant="warn">At risk</Chip>
            )}
          </div>

          {/* Next action + CTAs */}
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <div
              className="text-[11.5px] flex-1 min-w-0 truncate"
              style={{ color: tokens.muted }}
              title={priority.score.nextAction.reason}
            >
              <span className="font-semibold" style={{ color: priority.score.nextAction.urgent ? "#dc2626" : tokens.heading }}>
                Next:
              </span>{" "}
              {priority.score.nextAction.label}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {priority.proposalId && priority.score.nextAction.type === "ask_for_booking" && (
                <Link
                  href={`/studio/${priority.proposalId}`}
                  className="text-[11.5px] font-semibold px-2.5 py-1 rounded-md transition"
                  style={{ background: tokens.ring, color: tokens.heading }}
                >
                  Open quote
                </Link>
              )}
              <Link
                href={messageHref}
                className="text-[11.5px] font-semibold px-3 py-1.5 rounded-md transition text-white"
                style={{ background: priority.score.nextAction.urgent ? "#dc2626" : FOREST }}
              >
                Message client →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}

// ─── Engagement chip ─────────────────────────────────────────────────────

function Chip({
  icon, children, tokens, highlight, variant,
}: {
  icon: string; children: React.ReactNode;
  tokens: ReturnType<typeof useDashboardTheme>["tokens"];
  highlight?: boolean;
  variant?: "warn";
}) {
  let bg = tokens.ring;
  let color = tokens.muted;
  if (highlight) { bg = tokens.primarySoft; color = tokens.primary; }
  if (variant === "warn") { bg = "#fef3c7"; color = "#92400e"; }
  return (
    <span
      className="text-[10.5px] font-medium px-1.5 py-0.5 rounded-md inline-flex items-center gap-1"
      style={{ background: bg, color }}
    >
      <span aria-hidden style={{ opacity: 0.7 }}>{icon}</span>
      {children}
    </span>
  );
}

// ─── Task rail ───────────────────────────────────────────────────────────

function TaskRail({
  tasksData, tokens,
}: {
  tasksData: TasksResponse | null;
  tokens: ReturnType<typeof useDashboardTheme>["tokens"];
}) {
  const tasks = tasksData?.tasks ?? [];
  const overdueCount = tasksData?.counts.overdue ?? 0;
  const openCount = tasksData?.counts.open ?? 0;

  return (
    <aside
      className="rounded-xl p-4 self-start lg:sticky lg:top-4 flex flex-col"
      style={{
        background: tokens.pageBg,
        border: `1px solid ${tokens.ring}`,
      }}
    >
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.28em] font-semibold" style={{ color: tokens.muted }}>
            Open Tasks
          </div>
          <div className="text-[15px] font-semibold mt-0.5" style={{ color: tokens.heading }}>
            {openCount} {openCount === 1 ? "task" : "tasks"}
          </div>
        </div>
        {overdueCount > 0 && (
          <span
            className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full tabular-nums"
            style={{ background: "#fee2e2", color: "#dc2626" }}
          >
            {overdueCount} overdue
          </span>
        )}
      </div>

      {tasksData === null ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 rounded animate-pulse" style={{ background: tokens.ring }} />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-[12.5px] py-6 text-center" style={{ color: tokens.muted }}>
          No open tasks. Add one from a request.
        </div>
      ) : (
        <ul className="space-y-1.5 flex-1 max-h-[480px] overflow-y-auto -mx-1 px-1">
          {tasks.map((t) => (
            <li key={t.id}>
              <Link
                href={t.request ? `/requests/${t.request.id}` : "#"}
                className="block group rounded-lg px-2.5 py-2 transition"
                style={{ background: "transparent" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = tokens.ring; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                <div className="flex items-baseline gap-2">
                  <div
                    className="mt-1 shrink-0 rounded-full"
                    style={{
                      width: 5, height: 5,
                      background: t.overdue ? "#dc2626" : tokens.primary,
                    }}
                    aria-hidden
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-medium truncate" style={{ color: tokens.heading }}>
                      {t.title}
                    </div>
                    <div className="text-[10.5px] truncate" style={{ color: tokens.muted }}>
                      {t.request?.clientName ?? "—"}
                      {t.dueAt && (
                        <> · <span style={{ color: t.overdue ? "#dc2626" : "inherit", fontWeight: t.overdue ? 600 : 400 }}>
                          {t.overdue ? "Overdue " : "Due "}
                          {formatRelative(t.dueAt)}
                        </span></>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

// ─── Skeletons + empty ───────────────────────────────────────────────────

function CardSkeleton({ ringColor }: { ringColor: string }) {
  return (
    <div className="rounded-xl p-3.5 border" style={{ borderColor: ringColor }}>
      <div className="flex items-start gap-3">
        <div className="w-12 h-7 rounded animate-pulse" style={{ background: ringColor }} />
        <div className="flex-1 space-y-2">
          <div className="h-4 rounded animate-pulse w-1/2" style={{ background: ringColor }} />
          <div className="h-3 rounded animate-pulse w-3/4" style={{ background: ringColor }} />
          <div className="flex gap-1.5">
            <div className="h-5 rounded animate-pulse w-14" style={{ background: ringColor }} />
            <div className="h-5 rounded animate-pulse w-20" style={{ background: ringColor }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  message, tokens,
}: {
  message: string;
  tokens: ReturnType<typeof useDashboardTheme>["tokens"];
}) {
  return (
    <div
      className="rounded-xl py-10 text-center text-[13px] border"
      style={{ borderColor: tokens.ring, color: tokens.muted, background: tokens.pageBg }}
    >
      {message}
    </div>
  );
}

// ─── Formatters ──────────────────────────────────────────────────────────

function formatMoney(cents: number, currency: string): string {
  if (!Number.isFinite(cents) || cents <= 0) return `${currency} 0`;
  const dollars = cents / 100;
  return `${currency} ${dollars.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  // Negative — future due date.
  if (diff < 0) {
    const futureDays = Math.floor(-diff / 86_400_000);
    if (futureDays < 1) return "today";
    if (futureDays === 1) return "tomorrow";
    if (futureDays < 7) return `in ${futureDays}d`;
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatDwell(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}
