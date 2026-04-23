"use client";

import { useEffect, useState } from "react";

// ─── Engagement widget (editor toolbar) ────────────────────────────────────
//
// Compact pill in the toolbar: "6 views · 2h ago". Click opens a drawer
// with the "what closes" report:
//
//   Headline — most-read section + top drop-off across all sessions.
//   Section breakdown — one row per engaged section with a horizontal
//     bar sized to the longest dwell, a drop-off marker where relevant.
//   Per-visitor log — same timeline UI we had before, now fed from the
//     same raw /views payload.
//
// Both /api/proposals/[id]/views and /api/proposals/[id]/analytics are
// fetched in parallel on mount so the drawer is ready instantly.

type Event = {
  kind: string;
  sectionId: string | null;
  dwellSeconds: number | null;
  createdAt: string;
};
type View = {
  id: string;
  sessionId: string;
  firstViewedAt: string;
  lastViewedAt: string;
  viewCount: number;
  totalSeconds: number;
  country: string | null;
  userAgent: string | null;
  events: Event[];
};
type ViewsSummary = {
  totalViews: number;
  uniqueSessions: number;
  lastViewedAt: string | null;
  views: View[];
};

type SectionAggregate = {
  sectionId: string;
  label: string;
  kind: "section" | "day";
  order: number;
  sessionsEngaged: number;
  totalDwellSeconds: number;
  avgDwellSeconds: number;
  dropOffCount: number;
  dropOffRate: number;
};

type Analytics = {
  totalViews: number;
  uniqueSessions: number;
  lastViewedAt: string | null;
  medianSessionSeconds: number;
  sections: SectionAggregate[];
  headline:
    | {
        mostEngaging: { label: string; avgDwellSeconds: number; sessions: number };
        topDropOff: { label: string; dropOffCount: number; dropOffRate: number } | null;
      }
    | null;
};

export function ProposalViewsWidget({ proposalId }: { proposalId: string }) {
  const [summary, setSummary] = useState<ViewsSummary | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [viewsRes, analyticsRes] = await Promise.all([
          fetch(`/api/proposals/${proposalId}/views`, { cache: "no-store" }),
          fetch(`/api/proposals/${proposalId}/analytics`, { cache: "no-store" }),
        ]);
        if (cancelled) return;
        if (viewsRes.ok) {
          setSummary((await viewsRes.json()) as ViewsSummary);
        }
        if (analyticsRes.ok) {
          setAnalytics((await analyticsRes.json()) as Analytics);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [proposalId]);

  if (loading && !summary) return null;
  if (!summary || summary.totalViews === 0) {
    return (
      <span
        className="px-2 py-1 text-[12px] text-black/35 tabular-nums"
        title="Client hasn't opened this proposal yet"
      >
        Not opened yet
      </span>
    );
  }

  const last = summary.lastViewedAt ? relative(summary.lastViewedAt) : "";
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-2.5 py-1 text-[12px] rounded-md hover:bg-black/[0.04] transition font-medium flex items-center gap-1.5"
        title="Client engagement"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[#1b3a2d]" aria-hidden />
        <span style={{ color: "#1b3a2d" }}>
          {summary.totalViews} view{summary.totalViews === 1 ? "" : "s"}
        </span>
        {last && <span className="text-black/40">· {last}</span>}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30 ss-fade-in" onClick={() => setOpen(false)} />
          <aside
            className="fixed top-0 right-0 bottom-0 z-50 w-[min(460px,100vw)] bg-white border-l border-black/10 shadow-2xl flex flex-col ss-popover-in"
            role="dialog"
            aria-label="Proposal engagement"
          >
            <header className="px-5 py-4 border-b border-black/8 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-black/85">Engagement</h2>
                <p className="text-[12px] text-black/45 mt-0.5">
                  {summary.totalViews} total views · {summary.uniqueSessions} unique visitor
                  {summary.uniqueSessions === 1 ? "" : "s"}
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-black/40 hover:text-black/70 text-xl leading-none px-2"
                aria-label="Close"
              >
                ×
              </button>
            </header>

            <div className="flex-1 overflow-auto">
              {analytics && <WhatClosesPanel analytics={analytics} />}

              <div className="px-4 pt-2 pb-5 space-y-3">
                <div className="px-1 text-[10.5px] uppercase tracking-[0.22em] font-semibold text-black/40">
                  Per visitor
                </div>
                {summary.views.map((v) => (
                  <ViewRow key={v.id} view={v} />
                ))}
              </div>
            </div>
          </aside>
        </>
      )}
    </>
  );
}

// ─── "What closes" report ──────────────────────────────────────────────────

function WhatClosesPanel({ analytics }: { analytics: Analytics }) {
  const { sections, headline, medianSessionSeconds } = analytics;
  const engaged = sections.filter((s) => s.sessionsEngaged > 0);

  if (engaged.length === 0) {
    return (
      <div className="px-5 py-6 border-b border-black/8">
        <div className="text-[11px] uppercase tracking-[0.22em] font-semibold text-[#1b3a2d] mb-1">
          What closes
        </div>
        <div className="text-[13px] text-black/55 mt-2 leading-relaxed">
          The first visit is registered but no section dwell has been captured yet. Section-level
          signal usually arrives after a reader spends a few seconds on a block.
        </div>
      </div>
    );
  }

  const maxAvg = Math.max(...engaged.map((s) => s.avgDwellSeconds), 1);

  return (
    <div className="px-5 py-5 border-b border-black/8" style={{ background: "rgba(201,168,76,0.06)" }}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="text-[11px] uppercase tracking-[0.22em] font-semibold text-[#1b3a2d]">
          What closes
        </div>
        <div className="text-[11px] text-black/45 tabular-nums">
          Median {formatSeconds(medianSessionSeconds)}
        </div>
      </div>

      {headline && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
          <HeadlineTile
            label="Most read"
            value={headline.mostEngaging.label}
            meta={`Avg ${formatSeconds(headline.mostEngaging.avgDwellSeconds)} · ${headline.mostEngaging.sessions} visitor${headline.mostEngaging.sessions === 1 ? "" : "s"}`}
            accent="#1b3a2d"
          />
          {headline.topDropOff ? (
            <HeadlineTile
              label="Drop-off"
              value={headline.topDropOff.label}
              meta={`${Math.round(headline.topDropOff.dropOffRate * 100)}% stop here (${headline.topDropOff.dropOffCount})`}
              accent="#b34334"
            />
          ) : (
            <HeadlineTile
              label="Drop-off"
              value="Too few visitors yet"
              meta="Need ≥2 sessions to see a pattern"
              accent="#b7a76a"
              muted
            />
          )}
        </div>
      )}

      <div className="space-y-1.5">
        {engaged.map((s) => (
          <SectionBar key={s.sectionId} section={s} maxAvg={maxAvg} />
        ))}
      </div>
    </div>
  );
}

function HeadlineTile({
  label,
  value,
  meta,
  accent,
  muted = false,
}: {
  label: string;
  value: string;
  meta: string;
  accent: string;
  muted?: boolean;
}) {
  return (
    <div
      className="rounded-lg bg-white border p-3"
      style={{ borderColor: "rgba(0,0,0,0.08)" }}
    >
      <div
        className="text-[10px] uppercase tracking-widest font-semibold mb-1"
        style={{ color: accent, opacity: muted ? 0.6 : 1 }}
      >
        {label}
      </div>
      <div
        className="text-[13.5px] font-semibold text-black/85 truncate"
        title={value}
      >
        {value}
      </div>
      <div className="text-[11.5px] text-black/45 mt-0.5 truncate">{meta}</div>
    </div>
  );
}

function SectionBar({
  section,
  maxAvg,
}: {
  section: SectionAggregate;
  maxAvg: number;
}) {
  const widthPct = Math.max(4, Math.round((section.avgDwellSeconds / maxAvg) * 100));
  const dropOffPct = Math.round(section.dropOffRate * 100);
  const isDropOff = section.dropOffCount >= 2 && section.dropOffRate >= 0.25;
  return (
    <div className="rounded-md px-2 py-1.5 hover:bg-black/[0.03] transition">
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <div className="text-[12.5px] text-black/80 truncate flex items-center gap-1.5">
          {section.label}
          {isDropOff && (
            <span
              className="text-[9.5px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded"
              style={{ background: "rgba(179,67,52,0.1)", color: "#b34334" }}
              title={`${dropOffPct}% of visitors stop here`}
            >
              Drop-off
            </span>
          )}
        </div>
        <div className="text-[11.5px] text-black/50 tabular-nums shrink-0">
          {formatSeconds(section.avgDwellSeconds)}
          <span className="text-black/30"> · {section.sessionsEngaged}</span>
        </div>
      </div>
      <div className="h-1 rounded-full" style={{ background: "rgba(0,0,0,0.06)" }}>
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${widthPct}%`,
            background: isDropOff
              ? "linear-gradient(90deg, #1b3a2d, #b34334)"
              : "linear-gradient(90deg, #1b3a2d, #c9a84c)",
          }}
        />
      </div>
    </div>
  );
}

// ─── Per-visitor row (unchanged behaviour) ────────────────────────────────

function ViewRow({ view }: { view: View }) {
  const sectionDwells = aggregateSections(view.events);
  const topSections = Object.entries(sectionDwells)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  return (
    <div className="rounded-xl border border-black/8 bg-white p-3">
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-[12px] font-semibold text-black/85">
            {view.viewCount} visit{view.viewCount === 1 ? "" : "s"}
          </span>
          {view.country && (
            <span className="text-[11px] text-black/40 uppercase tracking-wide">{view.country}</span>
          )}
        </div>
        <span className="text-[11px] text-black/35 shrink-0">{relative(view.lastViewedAt)}</span>
      </div>
      <div className="text-[12px] text-black/55 mb-1">{formatSeconds(view.totalSeconds)} total</div>
      {topSections.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {topSections.map(([sec, secs]) => (
            <span
              key={sec}
              className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#1b3a2d]/[0.08] text-[#1b3a2d]"
            >
              {labelForSection(sec)} · {formatSeconds(secs)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function aggregateSections(events: Event[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of events) {
    if (e.kind !== "section" && e.kind !== "close") continue;
    if (!e.sectionId || !e.dwellSeconds) continue;
    out[e.sectionId] = (out[e.sectionId] ?? 0) + e.dwellSeconds;
  }
  return out;
}

function labelForSection(sectionId: string): string {
  if (sectionId.startsWith("day-")) return "Day card";
  if (sectionId.startsWith("section-")) return "Section";
  return sectionId;
}

function formatSeconds(total: number): string {
  if (total < 60) return `${total}s`;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function relative(iso: string): string {
  const d = new Date(iso);
  const diffSec = Math.round((Date.now() - d.getTime()) / 1000);
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.round(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.round(diffSec / 3600)}h ago`;
  const days = Math.round(diffSec / 86400);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
