"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/properties/AppHeader";
import { NewRequestDialog } from "./NewRequestDialog";

// ─── Requests inbox ───────────────────────────────────────────────────────
//
// Mirrors the reference app's split layout: compact left sidebar with
// stage counts + "Add New Request" CTA; wide right pane with a filter bar
// ("Handled by" + "Sort by") and the request list.
//
// Stages visible in sidebar: new, working, open, booked, completed,
// not_booked. Default view = "new" (fresh leads) so opening the page
// lands the operator on what needs attention first.

type TeamMember = { userId: string; name: string | null; email: string | null };

type RequestRow = {
  id: string;
  referenceNumber: string;
  status: string;
  receivedAt: string;
  lastActivityAt: string;
  source: string | null;
  client: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    country: string | null;
  } | null;
  assignedTo: { id: string; name: string | null; email: string | null } | null;
  tripBrief: {
    title?: string;
    nights?: number;
    destinations?: string[];
    travelers?: number;
    style?: string;
  } | null;
  _count: { proposals: number; notes: number };
};

type StageCounts = Record<string, number>;

const STAGES: { key: string; label: string }[] = [
  { key: "new",          label: "New" },
  { key: "working",      label: "Working On" },
  { key: "open",         label: "Open" },
  { key: "booked",       label: "Booked" },
  { key: "completed",    label: "Completed" },
  { key: "not_booked",   label: "Not Booked" },
];

export function RequestsInbox() {
  const [stage, setStage] = useState<string>("new");
  const [handledBy, setHandledBy] = useState<string>("all"); // "all" | "me" | "unassigned" | userId
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<RequestRow[] | null>(null);
  const [counts, setCounts] = useState<StageCounts>({});
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set("status", stage);
      if (handledBy === "me") params.set("assignedToUserId", "me");
      else if (handledBy === "unassigned") params.set("assignedToUserId", "unassigned");
      else if (handledBy !== "all") params.set("assignedToUserId", handledBy);
      if (search.trim()) params.set("q", search.trim());

      const res = await fetch(`/api/requests?${params.toString()}`, { cache: "no-store" });
      if (res.status === 401) { window.location.href = "/sign-in"; return; }
      if (res.status === 409) { window.location.href = "/select-organization"; return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRows(data.requests as RequestRow[]);
      setCounts(data.stageCounts as StageCounts);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load requests");
    }
  }, [stage, handledBy, search]);

  useEffect(() => { load(); }, [load]);

  // Clear selection whenever the filter changes — stops stale ids lingering.
  useEffect(() => { setSelected(new Set()); }, [stage, handledBy, search]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (!rows) return;
    if (selected.size === rows.length) setSelected(new Set());
    else setSelected(new Set(rows.map((r) => r.id)));
  };

  const runBulk = async (body: Record<string, unknown>) => {
    if (selected.size === 0) return;
    setBulkBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/requests/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected), ...body }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? `HTTP ${res.status}`);
      }
      setSelected(new Set());
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk action failed");
    } finally {
      setBulkBusy(false);
    }
  };

  const bulkAssign = async (assignedToUserId: string | null) => runBulk({ action: "assign", assignedToUserId });
  const bulkStatus = async (status: string) => runBulk({ action: "status", status });
  const bulkDelete = async () => {
    if (!confirm(`Delete ${selected.size} request${selected.size === 1 ? "" : "s"}? This can't be undone.`)) return;
    await runBulk({ action: "delete" });
  };

  // Load team once for the Handled-by filter.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/team", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        setTeam((data.team as { userId: string; name: string | null; email: string | null }[]) ?? []);
      } catch {
        // non-fatal
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-[#f8f5ef]">
      <AppHeader />
      <main className="max-w-[1400px] mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
          {/* Sidebar */}
          <aside className="space-y-4">
            <button
              type="button"
              onClick={() => setDialogOpen(true)}
              className="w-full rounded-full border-2 px-4 py-2.5 text-[13px] font-medium transition"
              style={{
                borderColor: "#1b3a2d",
                color: "#1b3a2d",
                background: "white",
              }}
            >
              + Add New Request
            </button>

            <div className="bg-white rounded-2xl border border-black/8 overflow-hidden">
              <ul className="divide-y divide-black/5">
                {STAGES.map((s) => {
                  const n = counts[s.key] ?? 0;
                  const active = stage === s.key;
                  return (
                    <li key={s.key}>
                      <button
                        type="button"
                        onClick={() => setStage(s.key)}
                        className="w-full px-4 py-3 flex items-center justify-between text-[13px] transition"
                        style={{
                          background: active ? "rgba(27,58,45,0.05)" : "transparent",
                          color: active ? "#1b3a2d" : "rgba(0,0,0,0.75)",
                          fontWeight: active ? 600 : 400,
                        }}
                      >
                        <span>{s.label}</span>
                        <span
                          className="text-[11.5px] tabular-nums px-2 rounded-full"
                          style={{
                            background: active ? "rgba(27,58,45,0.12)" : "rgba(0,0,0,0.06)",
                            color: active ? "#1b3a2d" : "rgba(0,0,0,0.55)",
                          }}
                        >
                          {n}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="bg-white rounded-2xl border border-black/8 px-4 py-3">
              <input
                type="search"
                placeholder="Search requests…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent outline-none text-[13px] placeholder:text-black/35"
              />
            </div>
          </aside>

          {/* Main pane */}
          <section className="bg-white rounded-2xl border border-black/8 overflow-hidden">
            <header className="px-5 py-4 border-b border-black/8 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3 text-[12px] text-black/70">
                <label>Handled by</label>
                <select
                  value={handledBy}
                  onChange={(e) => setHandledBy(e.target.value)}
                  className="text-[12.5px] px-2 py-1 rounded border border-black/12 bg-white"
                >
                  <option value="all">All</option>
                  <option value="me">Me</option>
                  <option value="unassigned">Unassigned</option>
                  {team.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.name || m.email}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-3">
                <a
                  href={(() => {
                    const p = new URLSearchParams();
                    p.set("status", stage);
                    if (handledBy === "me") p.set("assignedToUserId", "me");
                    else if (handledBy === "unassigned") p.set("assignedToUserId", "unassigned");
                    else if (handledBy !== "all") p.set("assignedToUserId", handledBy);
                    return `/api/requests/export?${p.toString()}`;
                  })()}
                  className="text-[11.5px] text-black/55 hover:text-[#1b3a2d]"
                  title="Download this filtered list as CSV"
                >
                  ↓ Export CSV
                </a>
                <div className="text-[11px] uppercase tracking-[0.26em] font-semibold text-black/50">
                  {rows === null ? "Loading…" : `${rows.length} request${rows.length === 1 ? "" : "s"}`}
                </div>
              </div>
            </header>

            {error && (
              <div className="m-4 rounded-xl border border-[#b34334]/30 bg-[#b34334]/5 p-4 text-[13px] text-[#b34334]">
                {error}
              </div>
            )}

            {rows && rows.length > 0 && selected.size > 0 && (
              <div
                className="flex items-center justify-between gap-3 px-5 py-3 border-b border-black/8 flex-wrap"
                style={{ background: "rgba(27,58,45,0.04)" }}
              >
                <div className="text-[12.5px] font-medium text-[#1b3a2d]">
                  {selected.size} selected
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value=""
                    onChange={(e) => { if (e.target.value) { bulkAssign(e.target.value === "unassign" ? null : e.target.value); } }}
                    disabled={bulkBusy}
                    className="text-[12px] px-2 py-1 rounded border border-black/15 bg-white"
                  >
                    <option value="">Assign to…</option>
                    <option value="unassign">— Unassign —</option>
                    {team.map((m) => (
                      <option key={m.userId} value={m.userId}>{m.name || m.email}</option>
                    ))}
                  </select>
                  <select
                    value=""
                    onChange={(e) => { if (e.target.value) bulkStatus(e.target.value); }}
                    disabled={bulkBusy}
                    className="text-[12px] px-2 py-1 rounded border border-black/15 bg-white"
                  >
                    <option value="">Change stage…</option>
                    {STAGES.map((s) => (
                      <option key={s.key} value={s.key}>{s.label}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={bulkDelete}
                    disabled={bulkBusy}
                    className="text-[12px] px-3 py-1 rounded border border-[#b34334]/30 text-[#b34334] hover:bg-[#b34334]/5 disabled:opacity-50"
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelected(new Set())}
                    disabled={bulkBusy}
                    className="text-[12px] text-black/55 hover:text-black/85 px-2"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}
            {rows === null ? (
              <div className="p-5 space-y-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-24 rounded-xl bg-black/5 animate-pulse" />
                ))}
              </div>
            ) : rows.length === 0 ? (
              <EmptyState onNew={() => setDialogOpen(true)} stage={stage} />
            ) : (
              <>
                <div className="px-5 py-2 border-b border-black/5 flex items-center gap-3 text-[11.5px] text-black/50">
                  <input
                    type="checkbox"
                    checked={selected.size === rows.length && rows.length > 0}
                    onChange={toggleSelectAll}
                    className="accent-[#1b3a2d]"
                  />
                  <span>Select all on this page</span>
                </div>
                <ul className="divide-y divide-black/5">
                  {rows.map((r) => (
                    <RequestCard
                      key={r.id}
                      row={r}
                      selected={selected.has(r.id)}
                      onToggle={() => toggleSelect(r.id)}
                    />
                  ))}
                </ul>
              </>
            )}
          </section>
        </div>
      </main>

      {dialogOpen && (
        <NewRequestDialog
          onClose={() => setDialogOpen(false)}
          onCreated={async () => {
            setDialogOpen(false);
            await load();
          }}
        />
      )}
    </div>
  );
}

// ─── Row ──────────────────────────────────────────────────────────────────

function RequestCard({
  row,
  selected,
  onToggle,
}: {
  row: RequestRow;
  selected: boolean;
  onToggle: () => void;
}) {
  const name = [row.client?.firstName, row.client?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim() || row.client?.email || "—";
  const travelers = row.tripBrief?.travelers;
  const trip = row.tripBrief?.title || row.tripBrief?.destinations?.join(" · ") || "—";
  const country = row.client?.country ?? "";

  return (
    <li className="flex items-stretch hover:bg-black/[0.02] transition">
      <label
        className="pl-5 pr-3 flex items-center shrink-0 cursor-pointer"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="accent-[#1b3a2d]"
        />
      </label>
      <Link
        href={`/requests/${row.id}`}
        className="flex-1 block py-4 pr-5"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-[14px] text-black/85">{name}</span>
              {typeof travelers === "number" && (
                <span className="text-[12px] text-black/55">· {travelers} Traveler{travelers === 1 ? "" : "s"}</span>
              )}
              {country && (
                <span className="text-[12px] text-black/55">· {country}</span>
              )}
            </div>
            <div className="text-[12.5px] text-black/55 mt-1 truncate">{trip}</div>
            <div className="text-[11.5px] text-black/40 mt-1 flex items-center gap-3 flex-wrap">
              <span>#{row.referenceNumber}</span>
              {row.source && <span>Source: {row.source}</span>}
              {row._count.notes > 0 && <span>{row._count.notes} note{row._count.notes === 1 ? "" : "s"}</span>}
              {row._count.proposals > 0 && <span>{row._count.proposals} quote{row._count.proposals === 1 ? "" : "s"}</span>}
            </div>
          </div>
          <div className="text-right shrink-0 min-w-[140px]">
            <div className="text-[11.5px] text-black/55">
              {row.assignedTo ? `Handled by ${row.assignedTo.name || row.assignedTo.email}` : "Unassigned"}
            </div>
            <div className="text-[11px] text-black/40 mt-0.5 tabular-nums">
              Received {formatShortDate(row.receivedAt)}
            </div>
          </div>
        </div>
      </Link>
    </li>
  );
}

function EmptyState({ onNew, stage }: { onNew: () => void; stage: string }) {
  return (
    <div className="p-12 text-center">
      <div className="text-[14px] text-black/55">
        No {STAGES.find((s) => s.key === stage)?.label.toLowerCase() ?? "matching"} requests yet.
      </div>
      <button
        type="button"
        onClick={onNew}
        className="mt-5 inline-block rounded-full border-2 px-4 py-2 text-[12.5px]"
        style={{ borderColor: "#1b3a2d", color: "#1b3a2d" }}
      >
        + Add your first request
      </button>
    </div>
  );
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
