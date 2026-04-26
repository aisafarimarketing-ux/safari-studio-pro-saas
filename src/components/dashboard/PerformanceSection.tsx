"use client";

import { useEffect, useState } from "react";
import { useDashboardTheme } from "./DashboardTheme";

// ─── Performance Insights ──────────────────────────────────────────────────
//
// "Proves what works." Hangs off /api/dashboard/performance — reads the
// org's RequestTask history over the last 90 days and shows:
//
//   - Conversion rate hero (or "not enough data yet" empty state)
//   - Avg time to follow-up + avg time to booking
//   - By-action-type ranking with conversion bars
//   - Auto-generated insights (only emitted when N is meaningful)
//
// Honest with low data — N < 5 decided tasks per cohort returns null
// rates so we never fabricate a misleading percentage.

const MIN_N = 5;

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

type Insight = { kind: string; message: string };

type PerformanceResponse = {
  windowDays: number;
  counts: {
    totalTasks: number;
    completedTasks: number;
    convertedTasks: number;
    noResponseTasks: number;
    pendingTasks: number;
    autoCreatedTasks: number;
  };
  rates: {
    conversionRate: number | null;
    hasEnoughData: boolean;
    decidedCount: number;
  };
  timing: {
    avgFollowupHours: number | null;
    medianFollowupHours: number | null;
    avgBookingHours: number | null;
    medianBookingHours: number | null;
  };
  byActionType: ActionTypeStats[];
  insights: Insight[];
};

export function PerformanceSection() {
  const { tokens } = useDashboardTheme();
  const [data, setData] = useState<PerformanceResponse | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/dashboard/performance", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as PerformanceResponse;
        if (!cancelled) {
          setData(json);
          setLoadFailed(false);
        }
      } catch {
        if (!cancelled) setLoadFailed(true);
      }
    };
    void load();
  }, []);

  return (
    <section
      className="rounded-2xl p-5 md:p-6"
      style={{
        background: tokens.tileBg,
        boxShadow: `inset 0 0 0 1px ${tokens.ring}, ${tokens.shadow}`,
      }}
    >
      {/* Header */}
      <header className="flex items-baseline justify-between gap-4 mb-5 flex-wrap">
        <div>
          <div className="text-[10px] uppercase tracking-[0.28em] font-semibold" style={{ color: tokens.muted }}>
            Performance Insights
          </div>
          <h2
            className="text-[20px] md:text-[22px] font-semibold mt-1 leading-tight"
            style={{ color: tokens.heading }}
          >
            What's actually working — last {data?.windowDays ?? 90} days.
          </h2>
        </div>
      </header>

      {data === null && !loadFailed ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-xl animate-pulse" style={{ background: tokens.ring }} />
            ))}
          </div>
        </div>
      ) : loadFailed ? (
        <div className="text-[12.5px]" style={{ color: tokens.muted }}>
          Couldn&apos;t load performance data.
        </div>
      ) : data!.counts.completedTasks === 0 ? (
        <EmptyState tokens={tokens} />
      ) : (
        <>
          {/* Hero metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
            <HeroMetric
              eyebrow="Conversion rate"
              value={data!.rates.conversionRate !== null
                ? `${Math.round(data!.rates.conversionRate * 100)}%`
                : "—"}
              sub={data!.rates.hasEnoughData
                ? `${data!.counts.convertedTasks} of ${data!.rates.decidedCount} converted`
                : `Need ${MIN_N - data!.rates.decidedCount} more decisions for an honest number`}
              tone="primary"
              tokens={tokens}
            />
            <HeroMetric
              eyebrow="Avg time to follow-up"
              value={data!.timing.avgFollowupHours !== null
                ? formatHours(data!.timing.avgFollowupHours)
                : "—"}
              sub={data!.timing.medianFollowupHours !== null
                ? `Median ${formatHours(data!.timing.medianFollowupHours)}`
                : ""}
              tone="info"
              tokens={tokens}
            />
            <HeroMetric
              eyebrow="Avg time to booking"
              value={data!.timing.avgBookingHours !== null
                ? formatHours(data!.timing.avgBookingHours)
                : "—"}
              sub={data!.counts.convertedTasks > 0
                ? `Across ${data!.counts.convertedTasks} converted tasks`
                : "No conversions yet"}
              tone="success"
              tokens={tokens}
            />
          </div>

          {/* Insights */}
          {data!.insights.length > 0 && (
            <ul className="mb-5 space-y-1.5">
              {data!.insights.map((i, idx) => (
                <li
                  key={idx}
                  className="text-[12.5px] px-3 py-2 rounded-lg flex items-start gap-2"
                  style={{ background: tokens.primarySoft, color: tokens.heading }}
                >
                  <span className="shrink-0" aria-hidden style={{ color: tokens.primary }}>◆</span>
                  <span>{i.message}</span>
                </li>
              ))}
            </ul>
          )}

          {/* By action type */}
          {data!.byActionType.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-[0.28em] font-semibold mb-2.5" style={{ color: tokens.muted }}>
                By action type
              </div>
              <ul className="space-y-2">
                {data!.byActionType.map((row) => (
                  <ActionRow key={row.actionType} row={row} tokens={tokens} />
                ))}
              </ul>
              <div className="mt-3 text-[10.5px]" style={{ color: tokens.muted }}>
                Conversion rates need at least {MIN_N} decided tasks (booked or
                no-response) to display. Cohorts under that threshold show
                raw counts only.
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

// ─── Hero metric ─────────────────────────────────────────────────────────

function HeroMetric({
  eyebrow, value, sub, tone, tokens,
}: {
  eyebrow: string; value: string; sub: string;
  tone: "primary" | "info" | "success";
  tokens: ReturnType<typeof useDashboardTheme>["tokens"];
}) {
  const accent = tone === "success" ? "#16a34a" : tokens.primary;
  return (
    <div
      className="rounded-xl p-4"
      style={{ background: tokens.pageBg, border: `1px solid ${tokens.ring}` }}
    >
      <div className="text-[10px] uppercase tracking-[0.24em] font-semibold" style={{ color: tokens.muted }}>
        {eyebrow}
      </div>
      <div
        className="text-[28px] font-bold tabular-nums leading-tight mt-1"
        style={{ color: accent }}
      >
        {value}
      </div>
      {sub && (
        <div className="text-[11.5px] mt-0.5" style={{ color: tokens.muted }}>
          {sub}
        </div>
      )}
    </div>
  );
}

// ─── Action-type row with conversion bar ──────────────────────────────────

function ActionRow({
  row, tokens,
}: {
  row: ActionTypeStats;
  tokens: ReturnType<typeof useDashboardTheme>["tokens"];
}) {
  const label = humanizeActionType(row.actionType);
  const rate = row.conversionRate ?? 0;
  const ratePct = Math.round(rate * 100);
  return (
    <li
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
      style={{ background: tokens.pageBg, border: `1px solid ${tokens.ring}` }}
    >
      <div className="text-[12.5px] font-semibold w-44 shrink-0 truncate" style={{ color: tokens.heading }}>
        {label}
      </div>
      <div className="flex-1 min-w-0">
        {row.hasEnoughData ? (
          <div className="relative h-1.5 rounded-full overflow-hidden" style={{ background: tokens.ring }}>
            <div
              className="absolute left-0 top-0 bottom-0 rounded-full"
              style={{
                width: `${Math.max(2, ratePct)}%`,
                background: rate >= 0.5 ? "#16a34a" : rate >= 0.2 ? tokens.primary : "#d97706",
                transition: "width 320ms ease-out",
              }}
            />
          </div>
        ) : (
          <div className="text-[10.5px]" style={{ color: tokens.muted }}>
            Need {Math.max(0, 5 - (row.converted + row.noResponse))} more decided to compute a rate.
          </div>
        )}
      </div>
      <div className="text-[12px] tabular-nums shrink-0 text-right" style={{ color: tokens.muted }}>
        {row.hasEnoughData ? (
          <>
            <span className="font-semibold" style={{ color: tokens.heading }}>{ratePct}%</span>
            {" · "}
            <span>{row.converted}/{row.converted + row.noResponse}</span>
          </>
        ) : (
          <span>{row.total} total · {row.converted} won</span>
        )}
      </div>
    </li>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────

function EmptyState({ tokens }: { tokens: ReturnType<typeof useDashboardTheme>["tokens"] }) {
  return (
    <div
      className="rounded-xl py-10 px-6 text-center"
      style={{ borderColor: tokens.ring, border: `1px solid ${tokens.ring}`, background: tokens.pageBg }}
    >
      <div className="text-[14px] font-medium" style={{ color: tokens.heading }}>
        Nothing to measure yet.
      </div>
      <div className="text-[12px] mt-1.5 max-w-md mx-auto" style={{ color: tokens.muted }}>
        Once your team starts using the priorities dashboard — adding tasks,
        completing them, and closing bookings — this section will tell you
        exactly which actions move deals.
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────

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
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}
