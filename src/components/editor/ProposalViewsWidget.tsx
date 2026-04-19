"use client";

import { useEffect, useState } from "react";

// Small live-engagement widget for the editor toolbar. One line: view
// count + last-viewed relative time, with a drawer that shows the full
// per-session breakdown when clicked.

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
type Summary = {
  totalViews: number;
  uniqueSessions: number;
  lastViewedAt: string | null;
  views: View[];
};

export function ProposalViewsWidget({ proposalId }: { proposalId: string }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/proposals/${proposalId}/views`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as Summary;
        setSummary(data);
      } finally {
        setLoading(false);
      }
    })();
  }, [proposalId]);

  if (loading && !summary) {
    return null;
  }
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
        <span style={{ color: "#1b3a2d" }}>{summary.totalViews} view{summary.totalViews === 1 ? "" : "s"}</span>
        {last && <span className="text-black/40">· {last}</span>}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30 ss-fade-in" onClick={() => setOpen(false)} />
          <aside
            className="fixed top-0 right-0 bottom-0 z-50 w-[min(420px,100vw)] bg-white border-l border-black/10 shadow-2xl flex flex-col ss-popover-in"
            role="dialog"
            aria-label="Proposal engagement"
          >
            <header className="px-5 py-4 border-b border-black/8 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-black/85">Engagement</h2>
                <p className="text-[12px] text-black/45 mt-0.5">
                  {summary.totalViews} total views · {summary.uniqueSessions} unique visitor{summary.uniqueSessions === 1 ? "" : "s"}
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
            <div className="flex-1 overflow-auto p-4 space-y-3">
              {summary.views.map((v) => (
                <ViewRow key={v.id} view={v} />
              ))}
            </div>
          </aside>
        </>
      )}
    </>
  );
}

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
        <span className="text-[11px] text-black/35 shrink-0">
          {relative(view.lastViewedAt)}
        </span>
      </div>
      <div className="text-[12px] text-black/55 mb-1">
        {formatSeconds(view.totalSeconds)} total
      </div>
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
