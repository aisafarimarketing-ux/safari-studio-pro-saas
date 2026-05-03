"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/properties/AppHeader";
import { formatMoneyCompact } from "@/lib/proposalValue";

// Admin-only analytics rollup. Four blocks:
//   1. Summary KPIs (received, booked, conversion, median response)
//   2. 30-day received-vs-booked sparkline
//   3. Funnel — counts at each pipeline stage
//   4. Two tables: by source (which channels win) + by specialist
//      (per-member leaderboard)

type Totals = {
  received: number;
  booked: number;
  conversion: number;
  medianResponseMinutes: number | null;
};

type Analytics = {
  windowDays: number;
  totals: Totals;
  funnel: Record<string, number>;
  bySource: { source: string; received: number; booked: number; winRate: number }[];
  bySpecialist: {
    userId: string;
    name: string;
    received: number;
    booked: number;
    winRate: number;
    medianResponseMinutes: number | null;
  }[];
  byDay: { date: string; received: number; booked: number }[];
  proposals: {
    total: number;
    byStatus: Record<string, number>;
    withReservation: number;
    withConfirmed: number;
    conversion: number;
    pipelineValueCents: number;
    pipelineCurrency: string;
  };
  reservations: {
    total: number;
    byStatus: Record<string, number>;
  };
  unifiedFunnel: {
    draft: number;
    sent: number;
    viewed: number;
    bookingRequested: number;
    confirmed: number;
  };
  journeyConversion: {
    proposals: number;
    bookings: number;
    rate: number;
  };
};

const STAGE_ORDER: { key: string; label: string }[] = [
  { key: "new",        label: "New" },
  { key: "working",    label: "Working" },
  { key: "open",       label: "Open" },
  { key: "booked",     label: "Booked" },
  { key: "completed",  label: "Completed" },
  { key: "not_booked", label: "Not Booked" },
];

const PROPOSAL_STAGES: { key: string; label: string }[] = [
  { key: "draft",    label: "Draft" },
  { key: "sent",     label: "Sent" },
  { key: "accepted", label: "Accepted" },
];

const RESERVATION_STAGES: { key: string; label: string }[] = [
  { key: "new",       label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "confirmed", label: "Confirmed" },
  { key: "lost",      label: "Lost" },
];

// The five stages of the unified deal journey, used by the new top-of-
// page funnel. Order matters — left-to-right tells the story
// "Draft -> Confirmed".
const UNIFIED_STAGES: { key: keyof Analytics["unifiedFunnel"]; label: string }[] = [
  { key: "draft",            label: "Draft" },
  { key: "sent",             label: "Sent" },
  { key: "viewed",           label: "Viewed" },
  { key: "bookingRequested", label: "Booking requested" },
  { key: "confirmed",        label: "Confirmed" },
];

export function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/analytics", { cache: "no-store" });
        if (res.status === 401) { window.location.href = "/sign-in"; return; }
        if (res.status === 403) { setError("Admin access only — ask your owner to promote you."); return; }
        if (res.status === 409) { window.location.href = "/select-organization"; return; }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setData((await res.json()) as Analytics);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Load failed");
      }
    })();
  }, []);

  // Sparkline path + max — computed once on data arrival.
  const spark = useMemo(() => {
    if (!data) return null;
    const days = data.byDay;
    const receivedMax = Math.max(1, ...days.map((d) => d.received));
    const w = 100, h = 28;
    const step = days.length > 1 ? w / (days.length - 1) : w;
    const toY = (v: number) => h - (v / receivedMax) * (h - 4) - 2;
    const recv = days.map((d, i) => `${i === 0 ? "M" : "L"} ${(i * step).toFixed(2)} ${toY(d.received).toFixed(2)}`).join(" ");
    const book = days.map((d, i) => `${i === 0 ? "M" : "L"} ${(i * step).toFixed(2)} ${toY(d.booked).toFixed(2)}`).join(" ");
    return { recv, book, receivedMax, days };
  }, [data]);

  return (
    <div className="min-h-screen bg-[#f8f5ef]">
      <AppHeader />
      <main className="max-w-[1280px] mx-auto px-6 py-10">
        <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
          <div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-black/50">Analytics</div>
            <h1 className="mt-2 text-[32px] md:text-[40px] font-bold tracking-tight text-black/85" style={{ fontFamily: "'Playfair Display', serif" }}>
              How the business is doing
            </h1>
            <p className="mt-2 text-[14px] text-black/55 max-w-xl">
              Last 90 days. Channels that convert, specialists that close, speed of reply.
            </p>
          </div>
          <Link href="/team" className="text-[12px] text-black/45 hover:text-[#1b3a2d]">
            Live team view →
          </Link>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-[#b34334]/30 bg-[#b34334]/5 p-4 text-[13px] text-[#b34334]">
            {error}
          </div>
        )}

        {!data && !error && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-xl bg-black/5 animate-pulse" />
            ))}
          </div>
        )}

        {data && (
          <>
            {/* Journey conversion headline — the load-bearing metric:
                "X proposals → Y bookings (Z%)". Reads first so the
                operator knows where they stand before scanning the
                breakdown. */}
            <JourneyHeadline
              proposals={data.journeyConversion.proposals}
              bookings={data.journeyConversion.bookings}
              rate={data.journeyConversion.rate}
              pipelineValueCents={data.proposals.pipelineValueCents}
              pipelineCurrency={data.proposals.pipelineCurrency}
            />

            {/* Unified five-stage funnel — Draft → Sent → Viewed →
                Booking requested → Confirmed. Shows where deals stack
                up across the linked tables in one row. */}
            <UnifiedFunnel funnel={data.unifiedFunnel} />

            {/* KPIs — now keyed off the actual product activity, not
                just inbound CRM requests. Operators who skip the
                request inbox and create proposals directly were
                previously seeing 0s here. */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <KPI
                label="Proposals"
                value={String(data.proposals.total)}
                hint={
                  data.proposals.total > 0
                    ? `${data.proposals.byStatus.draft ?? 0} draft · ${data.proposals.byStatus.sent ?? 0} sent`
                    : undefined
                }
              />
              <KPI
                label="Bookings"
                value={String(data.reservations.total)}
                hint={
                  data.reservations.total > 0
                    ? `${data.reservations.byStatus.new ?? 0} new · ${data.reservations.byStatus.confirmed ?? 0} confirmed`
                    : undefined
                }
              />
              <KPI
                label="Proposal → booking"
                value={`${Math.round(data.proposals.conversion * 100)}%`}
                hint={
                  data.proposals.total > 0
                    ? `${data.proposals.withReservation} of ${data.proposals.total}`
                    : undefined
                }
              />
              <KPI
                label="Inbound requests"
                value={String(data.totals.received)}
                hint={
                  data.totals.received > 0
                    ? `${data.totals.booked} booked · ${Math.round(data.totals.conversion * 100)}% conv`
                    : "CRM inbox"
                }
              />
            </div>

            {/* Sparkline */}
            <section className="bg-white rounded-2xl border border-black/8 p-5 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.28em] font-semibold text-black/55">
                    Last 30 days
                  </div>
                  <div className="text-[12px] text-black/45 mt-0.5">
                    Peak received on a single day: {spark?.receivedMax ?? 0}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-black/55">
                  <LegendDot color="#1b3a2d" label="Received" />
                  <LegendDot color="#c9a84c" label="Booked" />
                </div>
              </div>
              {spark && (
                <svg viewBox="0 0 100 28" preserveAspectRatio="none" className="w-full h-24">
                  <path d={spark.recv} fill="none" stroke="#1b3a2d" strokeWidth={0.9} />
                  <path d={spark.book} fill="none" stroke="#c9a84c" strokeWidth={0.9} strokeDasharray="1.5 1.5" />
                </svg>
              )}
            </section>

            {/* Pipelines — all three flows the operator runs in one
                view. Previously only the Request inbox funnel was
                shown, which read empty for operators who skip the
                CRM inbox and create proposals directly. */}
            <section className="bg-white rounded-2xl border border-black/8 p-5 mb-6">
              <div className="flex items-baseline justify-between mb-4 gap-3 flex-wrap">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.28em] font-semibold text-black/55">
                    Pipeline snapshot
                  </div>
                  <div className="text-[12px] text-black/45 mt-0.5">
                    Three flows: inbound requests, proposals you ship, bookings clients submit.
                  </div>
                </div>
              </div>

              <PipelineRow
                label="Proposals"
                stages={PROPOSAL_STAGES}
                counts={data.proposals.byStatus}
              />
              <div className="my-4 h-px bg-black/8" />
              <PipelineRow
                label="Bookings"
                stages={RESERVATION_STAGES}
                counts={data.reservations.byStatus}
              />
              <div className="my-4 h-px bg-black/8" />
              <PipelineRow
                label="Inbound requests"
                stages={STAGE_ORDER}
                counts={data.funnel}
              />
            </section>

            {/* Source + Specialist tables side-by-side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Table
                title="By source"
                subtitle="Which channels actually turn into bookings"
                headers={["Source", "Received", "Booked", "Win rate"]}
                rows={data.bySource.map((r) => [
                  r.source,
                  String(r.received),
                  String(r.booked),
                  `${Math.round(r.winRate * 100)}%`,
                ])}
                empty="No requests in the last 90 days."
              />

              <Table
                title="By specialist"
                subtitle="Personal leaderboard — bookings first, then response speed"
                headers={["Name", "Received", "Booked", "Median reply"]}
                rows={data.bySpecialist.map((r) => [
                  r.name,
                  String(r.received),
                  String(r.booked),
                  r.medianResponseMinutes != null ? formatMinutes(r.medianResponseMinutes) : "—",
                ])}
                empty="No team activity in the last 90 days."
              />
            </div>
          </>
        )}
      </main>
    </div>
  );
}

// ─── Tiny UI helpers ──────────────────────────────────────────────────────

function KPI({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-black/8 px-4 py-3">
      <div className="text-[9.5px] uppercase tracking-[0.28em] font-semibold text-black/50 mb-1">
        {label}
      </div>
      <div className="text-[22px] font-bold tracking-tight text-black/85 tabular-nums">
        {value}
      </div>
      {hint && (
        <div className="text-[11px] text-black/45 mt-1 truncate">{hint}</div>
      )}
    </div>
  );
}

// Single-row pipeline visualisation. Used three times on the analytics
// page (Proposals / Bookings / Inbound requests) so each flow shares
// the same shape: small label on the left, stage tiles spread across
// the right.
// ─── Journey conversion headline ────────────────────────────────────────
//
// The single line every operator wants: how many proposals went out,
// how many turned into bookings, and the conversion percentage. Plus
// pipeline value to anchor the money side.

function JourneyHeadline({
  proposals,
  bookings,
  rate,
  pipelineValueCents,
  pipelineCurrency,
}: {
  proposals: number;
  bookings: number;
  rate: number;
  pipelineValueCents: number;
  pipelineCurrency: string;
}) {
  const ratePct = Math.round(rate * 100);
  const pipelineLabel = formatMoneyCompact(pipelineValueCents, pipelineCurrency);
  return (
    <section
      className="rounded-2xl bg-white p-6 mb-6 relative overflow-hidden"
      style={{
        border: "1px solid rgba(27,58,45,0.20)",
        boxShadow:
          "0 1px 2px rgba(27,58,45,0.04), 0 8px 24px -10px rgba(27,58,45,0.10)",
      }}
    >
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[3px]"
        style={{ background: "#1b3a2d" }}
      />
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div className="min-w-0">
          <div
            className="text-[10.5px] uppercase font-bold mb-2"
            style={{ color: "rgba(0,0,0,0.55)", letterSpacing: "0.24em" }}
          >
            Journey conversion
          </div>
          <div
            className="flex items-baseline gap-3 flex-wrap"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            <span
              className="text-[32px] md:text-[40px] tabular-nums"
              style={{ color: "rgba(0,0,0,0.88)", fontWeight: 700, letterSpacing: "-0.022em" }}
            >
              {proposals}
            </span>
            <span className="text-[15px] text-black/55">proposals →</span>
            <span
              className="text-[32px] md:text-[40px] tabular-nums"
              style={{ color: "#1b3a2d", fontWeight: 700, letterSpacing: "-0.022em" }}
            >
              {bookings}
            </span>
            <span className="text-[15px] text-black/55">bookings</span>
            <span
              className="text-[20px] md:text-[24px] tabular-nums px-2.5 py-0.5 rounded-md ml-1"
              style={{
                background: ratePct >= 20 ? "rgba(47,143,70,0.12)" : "rgba(0,0,0,0.05)",
                color: ratePct >= 20 ? "#1b3a2d" : "rgba(0,0,0,0.55)",
                fontWeight: 700,
              }}
            >
              {ratePct}%
            </span>
          </div>
          <p className="mt-2 text-[13px] text-black/55">
            {bookings === 0
              ? "No bookings closed in the last 90 days yet."
              : `In the last 90 days, ${ratePct}% of proposals converted to a booking request.`}
          </p>
        </div>

        {pipelineValueCents > 0 && (
          <div className="text-right shrink-0">
            <div
              className="text-[10.5px] uppercase font-bold"
              style={{ color: "rgba(0,0,0,0.55)", letterSpacing: "0.24em" }}
            >
              Pipeline value
            </div>
            <div
              className="mt-1 tabular-nums"
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: 32,
                fontWeight: 700,
                color: "#c9a84c",
                letterSpacing: "-0.025em",
              }}
            >
              {pipelineLabel}
            </div>
            <div className="text-[11.5px] text-black/45 mt-0.5">
              draft + sent
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Unified five-stage funnel ──────────────────────────────────────────

function UnifiedFunnel({ funnel }: { funnel: Analytics["unifiedFunnel"] }) {
  // Compute the visual width per stage as a proportion of the largest
  // stage. Floors at 8% so a single-deal stage is still visible.
  const max = Math.max(1, ...UNIFIED_STAGES.map((s) => funnel[s.key]));
  return (
    <section
      className="rounded-2xl bg-white p-5 md:p-6 mb-6"
      style={{
        border: "1px solid rgba(0,0,0,0.08)",
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
      }}
    >
      <div className="flex items-baseline justify-between mb-4 gap-3 flex-wrap">
        <div>
          <div
            className="text-[10.5px] uppercase font-bold"
            style={{ color: "rgba(0,0,0,0.55)", letterSpacing: "0.24em" }}
          >
            Deal journey · Last 90 days
          </div>
          <h3
            className="mt-1 text-[18px] font-bold text-black/85"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Where deals are stacking up
          </h3>
        </div>
      </div>

      <div className="space-y-2.5">
        {UNIFIED_STAGES.map((stage, i) => {
          const count = funnel[stage.key];
          const width = Math.max(8, Math.round((count / max) * 100));
          const isTerminal = stage.key === "confirmed";
          const accent = isTerminal ? "#1b3a2d" : i >= 3 ? "#2d5a40" : "#c9a84c";
          return (
            <div key={stage.key} className="flex items-center gap-3">
              <div
                className="w-[140px] text-[11.5px] font-semibold shrink-0"
                style={{ color: "rgba(0,0,0,0.62)" }}
              >
                {stage.label}
              </div>
              <div className="flex-1 h-7 rounded-md" style={{ background: "rgba(0,0,0,0.05)" }}>
                <div
                  className="h-full rounded-md flex items-center justify-end pr-2.5"
                  style={{
                    width: `${width}%`,
                    background: accent,
                    transition: "width 200ms ease-out",
                    boxShadow: isTerminal ? "0 4px 10px -4px rgba(27,58,45,0.35)" : undefined,
                  }}
                >
                  {count > 0 && (
                    <span
                      className="text-[11.5px] tabular-nums font-bold"
                      style={{ color: "#fff" }}
                    >
                      {count}
                    </span>
                  )}
                </div>
              </div>
              <div
                className="w-[44px] text-right tabular-nums text-[13px] font-bold shrink-0"
                style={{ color: count > 0 ? "rgba(0,0,0,0.85)" : "rgba(0,0,0,0.40)" }}
              >
                {count}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PipelineRow({
  label,
  stages,
  counts,
}: {
  label: string;
  stages: { key: string; label: string }[];
  counts: Record<string, number>;
}) {
  const total = stages.reduce((acc, s) => acc + (counts[s.key] ?? 0), 0);
  return (
    <div>
      <div className="flex items-baseline gap-3 mb-3">
        <div
          className="text-[10.5px] uppercase tracking-[0.24em] font-semibold text-black/55"
        >
          {label}
        </div>
        <div className="text-[11px] tabular-nums text-black/40">
          {total} total
        </div>
      </div>
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))` }}
      >
        {stages.map((s) => (
          <div key={s.key} className="text-center">
            <div
              className="text-[20px] font-bold tabular-nums"
              style={{ color: "#1b3a2d" }}
            >
              {counts[s.key] ?? 0}
            </div>
            <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-black/50 mt-0.5">
              {s.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block w-2 h-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function Table({
  title, subtitle, headers, rows, empty,
}: {
  title: string;
  subtitle: string;
  headers: string[];
  rows: string[][];
  empty: string;
}) {
  return (
    <section className="bg-white rounded-2xl border border-black/8 overflow-hidden">
      <header className="px-5 py-4 border-b border-black/8">
        <div className="text-[11px] uppercase tracking-[0.28em] font-semibold text-black/55">{title}</div>
        <div className="text-[12px] text-black/45 mt-0.5">{subtitle}</div>
      </header>
      {rows.length === 0 ? (
        <div className="p-8 text-center text-[13px] text-black/45">{empty}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-black/5">
                {headers.map((h, i) => (
                  <th
                    key={h}
                    className="text-left py-2.5 px-5 text-[9.5px] uppercase tracking-[0.22em] font-semibold text-black/50"
                    style={{ textAlign: i > 0 ? "right" : "left" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri} className="border-b border-black/5 last:border-0">
                  {r.map((cell, ci) => (
                    <td
                      key={ci}
                      className="py-3 px-5 tabular-nums"
                      style={{
                        textAlign: ci > 0 ? "right" : "left",
                        color: ci === 0 ? "rgba(0,0,0,0.85)" : "rgba(0,0,0,0.7)",
                        fontWeight: ci === 0 ? 500 : 400,
                      }}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function formatMinutes(m: number): string {
  if (m < 1) return "<1m";
  if (m < 60) return `${Math.round(m)}m`;
  if (m < 60 * 24) return `${(m / 60).toFixed(1)}h`;
  return `${(m / (60 * 24)).toFixed(1)}d`;
}
