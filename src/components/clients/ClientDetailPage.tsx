"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AppHeader } from "@/components/properties/AppHeader";

// Client profile page — the "history with us" view for a returning guest.
// Links from the client name on any request detail page.

type ClientFull = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  salutation: string | null;
  phone: string | null;
  country: string | null;
  origin: string | null;
  preferredLanguage: string | null;
  internalNotes: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  requests: {
    id: string;
    referenceNumber: string;
    status: string;
    source: string | null;
    receivedAt: string;
    lastActivityAt: string;
    tripBrief: { title?: string; destinations?: string[]; nights?: number } | null;
    assignedTo: { id: string; name: string | null; email: string | null } | null;
    _count: { proposals: number; notes: number };
  }[];
  proposals: { id: string; title: string; status: string; updatedAt: string }[];
};

type Stats = {
  totalRequests: number;
  booked: number;
  firstSeen: string;
  lastSeen: string;
};

export function ClientDetailPage({ id }: { id: string }) {
  const [data, setData] = useState<{ client: ClientFull; stats: Stats } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/clients/${id}`, { cache: "no-store" });
      if (res.status === 401) { window.location.href = "/sign-in"; return; }
      if (res.status === 409) { window.location.href = "/select-organization"; return; }
      if (res.status === 404) { setError("Client not found"); return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      setData(body as { client: ClientFull; stats: Stats });
      setNotesDraft(body.client.internalNotes ?? "");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const saveNotes = async () => {
    try {
      const res = await fetch(`/api/clients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ internalNotes: notesDraft.trim() || null }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setEditingNotes(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
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
        <main className="max-w-[1200px] mx-auto px-6 py-10">
          <div className="h-40 rounded-2xl bg-black/5 animate-pulse" />
        </main>
      </div>
    );
  }

  const { client, stats } = data;
  const displayName = [client.salutation, client.firstName, client.lastName].filter(Boolean).join(" ").trim() || client.email;
  const isReturning = stats.totalRequests > 1;

  return (
    <div className="min-h-screen bg-[#f8f5ef]">
      <AppHeader />
      <main className="max-w-[1200px] mx-auto px-6 py-8">
        <Link href="/requests" className="text-[12px] text-black/55 hover:text-[#1b3a2d]">← Back to requests</Link>

        {/* Header */}
        <div className="flex items-end justify-between mt-3 mb-8 gap-4 flex-wrap">
          <div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-black/50">Client</div>
            <h1 className="mt-2 text-[30px] md:text-[36px] font-bold tracking-tight text-black/85" style={{ fontFamily: "'Playfair Display', serif" }}>
              {displayName}
            </h1>
            <div className="text-[13px] text-black/55 mt-1">
              {client.email}
              {client.phone && <span> · {client.phone}</span>}
              {client.country && <span> · {client.country}</span>}
            </div>
          </div>
          {isReturning && (
            <div
              className="text-[11px] uppercase tracking-[0.22em] font-semibold px-3 py-1.5 rounded-full"
              style={{ background: "rgba(201,168,76,0.18)", color: "#8a7228" }}
            >
              Returning · {stats.totalRequests} enquiries
            </div>
          )}
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <Stat label="Total requests" value={String(stats.totalRequests)} />
          <Stat label="Booked" value={String(stats.booked)} />
          <Stat label="First seen" value={formatDate(stats.firstSeen)} />
          <Stat label="Last activity" value={formatDate(stats.lastSeen)} />
        </div>

        {/* Two columns */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
          <div className="space-y-6">
            {/* Request history */}
            <section className="bg-white rounded-2xl border border-black/8 overflow-hidden">
              <header className="px-5 py-4 border-b border-black/8 text-[11px] uppercase tracking-[0.28em] font-semibold text-black/55">
                Request history · {client.requests.length}
              </header>
              {client.requests.length === 0 ? (
                <div className="p-10 text-center text-[13px] text-black/45">No requests yet.</div>
              ) : (
                <ul className="divide-y divide-black/5">
                  {client.requests.map((r) => (
                    <li key={r.id}>
                      <Link href={`/requests/${r.id}`} className="block px-5 py-3 hover:bg-black/[0.02]">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-[13.5px] text-black/85">
                                #{r.referenceNumber}
                              </span>
                              <StatusPill status={r.status} />
                            </div>
                            <div className="text-[12.5px] text-black/55 mt-1 truncate">
                              {r.tripBrief?.title || r.tripBrief?.destinations?.join(" · ") || "—"}
                            </div>
                            <div className="text-[11px] text-black/40 mt-1 flex items-center gap-3 flex-wrap">
                              {r.source && <span>Source: {r.source}</span>}
                              {r._count.proposals > 0 && <span>{r._count.proposals} quote{r._count.proposals === 1 ? "" : "s"}</span>}
                              {r.assignedTo && <span>Handler: {r.assignedTo.name || r.assignedTo.email}</span>}
                            </div>
                          </div>
                          <div className="text-right shrink-0 text-[11.5px] text-black/50 tabular-nums">
                            {formatDate(r.receivedAt)}
                          </div>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Proposals */}
            {client.proposals.length > 0 && (
              <section className="bg-white rounded-2xl border border-black/8 overflow-hidden">
                <header className="px-5 py-4 border-b border-black/8 text-[11px] uppercase tracking-[0.28em] font-semibold text-black/55">
                  Proposals · {client.proposals.length}
                </header>
                <ul className="divide-y divide-black/5">
                  {client.proposals.map((p) => (
                    <li key={p.id}>
                      <Link href={`/studio/${p.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-black/[0.02]">
                        <div>
                          <div className="text-[13.5px] font-medium text-black/85">{p.title}</div>
                          <div className="text-[11px] text-black/50 mt-0.5">Edited {formatDate(p.updatedAt)}</div>
                        </div>
                        <span className="text-[11px] uppercase tracking-[0.2em] text-black/55">{p.status}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          {/* Right — profile + internal notes */}
          <aside className="space-y-6">
            <section className="bg-white rounded-2xl border border-black/8 overflow-hidden">
              <header className="px-5 py-4 border-b border-black/8 text-[11px] uppercase tracking-[0.28em] font-semibold text-black/55">
                Client profile
              </header>
              <div className="p-5 space-y-3 text-[13px]">
                <ProfileRow label="Salutation" value={client.salutation} />
                <ProfileRow label="First name" value={client.firstName} />
                <ProfileRow label="Last name" value={client.lastName} />
                <ProfileRow label="Country" value={client.country} />
                <ProfileRow label="Origin" value={client.origin} />
                <ProfileRow label="Language" value={client.preferredLanguage} />
                <ProfileRow label="Phone" value={client.phone} />
                <ProfileRow label="Email" value={client.email} />
              </div>
            </section>

            <section className="bg-white rounded-2xl border border-black/8 overflow-hidden">
              <header className="px-5 py-4 border-b border-black/8 flex items-center justify-between">
                <div className="text-[11px] uppercase tracking-[0.28em] font-semibold text-black/55">Internal notes</div>
                {!editingNotes && (
                  <button
                    type="button"
                    onClick={() => setEditingNotes(true)}
                    className="text-[11px] text-black/45 hover:text-[#1b3a2d]"
                  >
                    Edit
                  </button>
                )}
              </header>
              <div className="p-5">
                {editingNotes ? (
                  <div>
                    <textarea
                      rows={6}
                      value={notesDraft}
                      onChange={(e) => setNotesDraft(e.target.value)}
                      className="w-full px-3 py-2 rounded border border-black/12 text-[13px] outline-none focus:border-[#1b3a2d] resize-y"
                      placeholder="Preferences, repeat-client notes, dietary requirements, never-show info…"
                    />
                    <div className="flex justify-end gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => { setEditingNotes(false); setNotesDraft(client.internalNotes ?? ""); }}
                        className="text-[12px] text-black/55 hover:text-black/85 px-3 py-1.5"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={saveNotes}
                        className="text-[12px] font-medium text-white px-4 py-1.5 rounded-full"
                        style={{ background: "#1b3a2d" }}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : client.internalNotes ? (
                  <div className="text-[13px] text-black/75 whitespace-pre-wrap">{client.internalNotes}</div>
                ) : (
                  <div className="text-[12.5px] text-black/40 italic">No notes yet.</div>
                )}
              </div>
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}

// ─── Tiny components ───────────────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-black/8 px-4 py-3">
      <div className="text-[9.5px] uppercase tracking-[0.28em] font-semibold text-black/50 mb-1">{label}</div>
      <div className="text-[18px] font-bold tracking-tight text-black/85 tabular-nums">{value}</div>
    </div>
  );
}

function ProfileRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-[11px] uppercase tracking-[0.22em] font-semibold text-black/50">{label}</span>
      <span className="text-[13px] text-right truncate" style={{ color: value ? "rgba(0,0,0,0.82)" : "rgba(0,0,0,0.35)" }}>
        {value || "—"}
      </span>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const LABEL: Record<string, string> = {
    new: "New", working: "Working", open: "Open", booked: "Booked",
    completed: "Completed", not_booked: "Not Booked",
  };
  const COLOR: Record<string, { bg: string; fg: string }> = {
    new:        { bg: "rgba(201,168,76,0.18)", fg: "#8a7228" },
    working:    { bg: "rgba(27,58,45,0.1)",   fg: "#1b3a2d" },
    open:       { bg: "rgba(58,90,122,0.12)", fg: "#3a5a7a" },
    booked:     { bg: "rgba(46,160,74,0.14)", fg: "#1b7a2d" },
    completed:  { bg: "rgba(0,0,0,0.07)",     fg: "rgba(0,0,0,0.55)" },
    not_booked: { bg: "rgba(179,67,52,0.12)", fg: "#b34334" },
  };
  const c = COLOR[status] ?? { bg: "rgba(0,0,0,0.06)", fg: "rgba(0,0,0,0.55)" };
  return (
    <span
      className="inline-block text-[9.5px] uppercase tracking-[0.18em] font-semibold px-1.5 py-0.5 rounded"
      style={{ background: c.bg, color: c.fg }}
    >
      {LABEL[status] ?? status}
    </span>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
