"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AppHeader } from "@/components/properties/AppHeader";
import { TasksPanel } from "./TasksPanel";

// ─── Request detail — split view ───────────────────────────────────────────
//
// Left pane: Client info table + Tour Details summary + status/assignment
// controls at the top.
// Right rail: Notes timeline (mixed user + system). New note composer at
// the top, posted entries below.

type RequestDetail = {
  id: string;
  referenceNumber: string;
  status: string;
  source: string | null;
  sourceDetail: string | null;
  receivedAt: string;
  lastActivityAt: string;
  firstReplyAt: string | null;
  originalMessage: string | null;
  tripBrief: {
    title?: string;
    nights?: number;
    travelers?: number;
    destinations?: string[];
    dates?: string;
    style?: string;
    operatorNote?: string;
  } | null;
  client: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    salutation: string | null;
    country: string | null;
    phone: string | null;
    preferredLanguage: string | null;
  } | null;
  assignedTo: { id: string; name: string | null; email: string | null } | null;
  notes: {
    id: string;
    kind: "user" | "system";
    body: string;
    createdAt: string;
    author: { id: string; name: string | null; email: string | null } | null;
  }[];
  proposals: { id: string; title: string; status: string; createdAt: string; updatedAt: string }[];
};

type TeamMember = { userId: string; name: string | null; email: string | null };

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  working: "Working On",
  open: "Open",
  booked: "Booked",
  completed: "Completed",
  not_booked: "Not Booked",
};

export function RequestDetailPage({ id }: { id: string }) {
  const [data, setData] = useState<RequestDetail | null>(null);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [posting, setPosting] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [railTab, setRailTab] = useState<"notes" | "tasks">("notes");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/requests/${id}`, { cache: "no-store" });
      if (res.status === 401) { window.location.href = "/sign-in"; return; }
      if (res.status === 409) { window.location.href = "/select-organization"; return; }
      if (res.status === 404) { setError("Request not found"); return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      setData(body.request as RequestDetail);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Team list for the assignment dropdown.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/team", { cache: "no-store" });
        if (!res.ok) return;
        const body = await res.json();
        setTeam((body.team as TeamMember[]) ?? []);
      } catch {
        // non-fatal
      }
    })();
  }, []);

  const patch = async (patch: Record<string, unknown>) => {
    setUpdating(true);
    try {
      const res = await fetch(`/api/requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? `HTTP ${res.status}`);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setUpdating(false);
    }
  };

  const [creatingQuote, setCreatingQuote] = useState(false);

  const createQuote = async () => {
    setCreatingQuote(true);
    setError(null);
    try {
      const res = await fetch(`/api/requests/${id}/quote`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? `HTTP ${res.status}`);
      }
      const { proposalId } = (await res.json()) as { proposalId: string };
      // Drop the operator straight into the editor. They can click the
      // "Automate" button from there to run the AI autopilot if they want.
      window.location.href = `/studio/${proposalId}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create quote");
      setCreatingQuote(false);
    }
  };

  const postNote = async () => {
    if (!noteText.trim()) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/requests/${id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: noteText.trim() }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setNoteText("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post note");
    } finally {
      setPosting(false);
    }
  };

  if (error && !data) {
    return (
      <div className="min-h-screen bg-[#f8f5ef]">
        <AppHeader />
        <main className="max-w-2xl mx-auto px-6 py-20 text-center">
          <div className="text-[14px] text-[#b34334] mb-4">{error}</div>
          <Link href="/requests" className="text-[#1b3a2d] underline">← Back to requests</Link>
        </main>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#f8f5ef]">
        <AppHeader />
        <main className="max-w-[1280px] mx-auto px-6 py-10">
          <div className="h-40 rounded-2xl bg-black/5 animate-pulse" />
        </main>
      </div>
    );
  }

  const clientName = [data.client?.firstName, data.client?.lastName].filter(Boolean).join(" ").trim() || data.client?.email || "—";

  return (
    <div className="min-h-screen bg-[#f8f5ef]">
      <AppHeader />
      <main className="max-w-[1280px] mx-auto px-6 py-8">
        {/* Header bar */}
        <div className="flex items-start justify-between gap-6 mb-6 flex-wrap">
          <div className="min-w-0">
            <Link href="/requests" className="text-[12px] text-black/55 hover:text-[#1b3a2d]">← Back</Link>
            <div className="flex items-baseline gap-3 mt-2 flex-wrap">
              <div className="text-[10px] uppercase tracking-[0.28em] text-black/50">Request</div>
              <div className="text-[11px] tabular-nums text-black/45">#{data.referenceNumber}</div>
            </div>
            <h1 className="text-[24px] md:text-[30px] font-bold tracking-tight text-black/85 mt-1" style={{ fontFamily: "'Playfair Display', serif" }}>
              Request from{" "}
              {data.client?.id ? (
                <Link href={`/clients/${data.client.id}`} className="hover:underline decoration-[#1b3a2d]/40 underline-offset-4">
                  {clientName}
                </Link>
              ) : (
                clientName
              )}
            </h1>
            <div className="text-[12px] text-black/55 mt-1">
              Received {formatDate(data.receivedAt)} · Source: {data.source ?? "Unknown"}
            </div>
          </div>

          {/* Primary action + Status + Assignment controls */}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={createQuote}
              disabled={creatingQuote}
              className="text-[12.5px] font-semibold text-white px-4 py-2 rounded-full disabled:opacity-60 whitespace-nowrap"
              style={{ background: "#1b3a2d" }}
            >
              {creatingQuote ? "Creating…" : "Create Quote →"}
            </button>
            <label className="text-[11.5px] font-medium text-black/60 flex items-center gap-2">
              Status
              <select
                value={data.status}
                onChange={(e) => patch({ status: e.target.value })}
                disabled={updating}
                className="text-[12.5px] px-2.5 py-1.5 rounded border border-black/12 bg-white"
              >
                {Object.entries(STATUS_LABELS).map(([k, l]) => (
                  <option key={k} value={k}>{l}</option>
                ))}
              </select>
            </label>
            <label className="text-[11.5px] font-medium text-black/60 flex items-center gap-2">
              Handled by
              <select
                value={data.assignedTo?.id ?? ""}
                onChange={(e) => patch({ assignedToUserId: e.target.value || null })}
                disabled={updating}
                className="text-[12.5px] px-2.5 py-1.5 rounded border border-black/12 bg-white"
              >
                <option value="">Unassigned</option>
                {team.map((m) => (
                  <option key={m.userId} value={m.userId}>{m.name || m.email}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* Two-column body */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
          {/* Left pane — client + trip */}
          <div className="space-y-6">
            {/* Client info card */}
            <section className="bg-white rounded-2xl border border-black/8 overflow-hidden">
              <header className="px-5 py-4 border-b border-black/8 text-[11px] uppercase tracking-[0.28em] font-semibold text-black/55">
                Client Information
              </header>
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8 text-[13.5px]">
                <InfoRow label="Email" value={data.client?.email} copyable />
                <InfoRow label="Phone" value={data.client?.phone} />
                <InfoRow label="Last Name" value={data.client?.lastName} />
                <InfoRow label="First Name" value={data.client?.firstName} />
                <InfoRow label="Salutation" value={data.client?.salutation} />
                <InfoRow label="Country" value={data.client?.country} />
                <InfoRow label="Language" value={data.client?.preferredLanguage} />
                {data.sourceDetail && <InfoRow label="Source detail" value={data.sourceDetail} />}
              </div>
            </section>

            {/* Tour details */}
            {data.tripBrief && (
              <section className="bg-white rounded-2xl border border-black/8 overflow-hidden">
                <header className="px-5 py-4 border-b border-black/8 text-[11px] uppercase tracking-[0.28em] font-semibold text-black/55">
                  Tour Details
                </header>
                <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8 text-[13.5px]">
                  <InfoRow label="Nights" value={data.tripBrief.nights != null ? String(data.tripBrief.nights) : null} />
                  <InfoRow label="Travelers" value={data.tripBrief.travelers != null ? String(data.tripBrief.travelers) : null} />
                  <InfoRow label="Style" value={data.tripBrief.style} />
                  <InfoRow label="Dates" value={data.tripBrief.dates} />
                  <InfoRow
                    label="Destinations"
                    value={data.tripBrief.destinations?.join(" · ")}
                  />
                  {data.tripBrief.operatorNote && (
                    <div className="sm:col-span-2">
                      <div className="text-[10.5px] uppercase tracking-[0.24em] font-semibold text-black/50 mb-1">Operator note</div>
                      <div className="text-[13px] text-black/75 whitespace-pre-wrap">{data.tripBrief.operatorNote}</div>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Original client message */}
            {data.originalMessage && (
              <section className="bg-white rounded-2xl border border-black/8 overflow-hidden">
                <header className="px-5 py-4 border-b border-black/8 text-[11px] uppercase tracking-[0.28em] font-semibold text-black/55">
                  Original Message
                </header>
                <div className="p-5 text-[13.5px] text-black/75 whitespace-pre-wrap leading-relaxed">
                  {data.originalMessage}
                </div>
              </section>
            )}

            {/* Quotes */}
            <section className="bg-white rounded-2xl border border-black/8 overflow-hidden">
              <header className="px-5 py-4 border-b border-black/8 flex items-center justify-between">
                <div className="text-[11px] uppercase tracking-[0.28em] font-semibold text-black/55">
                  Quotes · {data.proposals.length}
                </div>
              </header>
              {data.proposals.length === 0 ? (
                <div className="p-10 text-center">
                  <div className="text-[13px] text-black/50">No quote drafted yet.</div>
                  <button
                    type="button"
                    onClick={createQuote}
                    disabled={creatingQuote}
                    className="mt-4 text-[12.5px] font-medium text-white px-4 py-2 rounded-full disabled:opacity-60"
                    style={{ background: "#1b3a2d" }}
                  >
                    {creatingQuote ? "Creating…" : "Draft first quote →"}
                  </button>
                </div>
              ) : (
                <ul className="divide-y divide-black/5">
                  {data.proposals.map((p) => (
                    <li key={p.id}>
                      <Link
                        href={`/studio/${p.id}`}
                        className="flex items-center justify-between px-5 py-3 hover:bg-black/[0.02]"
                      >
                        <div>
                          <div className="text-[13.5px] font-medium text-black/85">{p.title}</div>
                          <div className="text-[11.5px] text-black/50 mt-0.5">
                            Last edited {formatDate(p.updatedAt)}
                          </div>
                        </div>
                        <span className="text-[11px] uppercase tracking-[0.2em] text-black/55">{p.status}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* Right rail — notes + tasks, tab-switched */}
          <aside className="bg-white rounded-2xl border border-black/8 overflow-hidden self-start lg:sticky lg:top-6 flex flex-col max-h-[75vh]">
            <nav className="px-5 pt-4 pb-0 border-b border-black/8 shrink-0 flex items-center gap-4 text-[11px] uppercase tracking-[0.28em] font-semibold">
              <button
                type="button"
                onClick={() => setRailTab("notes")}
                className="pb-3 -mb-[1px]"
                style={{
                  color: railTab === "notes" ? "#1b3a2d" : "rgba(0,0,0,0.45)",
                  borderBottom: railTab === "notes" ? "2px solid #1b3a2d" : "2px solid transparent",
                }}
              >
                Notes
              </button>
              <button
                type="button"
                onClick={() => setRailTab("tasks")}
                className="pb-3 -mb-[1px]"
                style={{
                  color: railTab === "tasks" ? "#1b3a2d" : "rgba(0,0,0,0.45)",
                  borderBottom: railTab === "tasks" ? "2px solid #1b3a2d" : "2px solid transparent",
                }}
              >
                Tasks
              </button>
            </nav>

            {railTab === "tasks" ? (
              <TasksPanel requestId={id} />
            ) : (
              <>
            {/* Notes composer */}
            <div className="p-4 border-b border-black/5 shrink-0">
              <textarea
                rows={3}
                placeholder="Add a note (internal only)…"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                className="w-full px-3 py-2 rounded border border-black/12 text-[13px] outline-none focus:border-[#1b3a2d] resize-y"
              />
              <div className="flex justify-end mt-2">
                <button
                  type="button"
                  onClick={postNote}
                  disabled={posting || !noteText.trim()}
                  className="text-[12px] px-4 py-1.5 rounded-full font-medium text-white disabled:opacity-50"
                  style={{ background: "#1b3a2d" }}
                >
                  {posting ? "Posting…" : "Post note"}
                </button>
              </div>
            </div>

            {/* Timeline */}
            <div className="overflow-y-auto flex-1">
              {data.notes.length === 0 ? (
                <div className="p-6 text-center text-[12.5px] text-black/45">No notes yet.</div>
              ) : (
                <ul className="divide-y divide-black/5">
                  {data.notes.map((n) => (
                    <li key={n.id} className="px-5 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[12px] font-medium text-black/80">
                          {n.kind === "system"
                            ? "System"
                            : n.author?.name || n.author?.email || "Unknown"}
                        </span>
                        <span className="text-[10.5px] text-black/40 tabular-nums">
                          {formatShort(n.createdAt)}
                        </span>
                      </div>
                      <div className="text-[13px] mt-1 whitespace-pre-wrap"
                        style={{ color: n.kind === "system" ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.82)", fontStyle: n.kind === "system" ? "italic" : "normal" }}
                      >
                        {n.body}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
              </>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}

// ─── Small helpers ─────────────────────────────────────────────────────────

function InfoRow({ label, value, copyable }: { label: string; value: string | null | undefined; copyable?: boolean }) {
  const display = value?.trim();
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-[0.24em] font-semibold text-black/50 mb-1">
        {label}
      </div>
      <div className="text-[13.5px] text-black/80 truncate" title={display || ""}>
        {display || <span className="text-black/35">—</span>}
      </div>
      {copyable && display && (
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(display)}
          className="text-[10.5px] text-black/40 hover:text-[#1b3a2d] mt-0.5"
        >
          copy
        </button>
      )}
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
  });
}

function formatShort(iso: string): string {
  const now = Date.now();
  const t = new Date(iso).getTime();
  const diff = Math.max(0, now - t) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
