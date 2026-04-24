"use client";

import { useCallback, useEffect, useState } from "react";
import { AppHeader } from "@/components/properties/AppHeader";

// ─── /reservations ────────────────────────────────────────────────────────
//
// Supplier-hold workflow inbox. Row per reservation with status chips +
// quick actions: mark-sent, mark-confirmed, change held-until, release.
// "+ New reservation" opens a modal that captures the essentials and
// can pre-open the operator's mail client with a formatted request
// (mailto:) so they don't retype it.

const FOREST = "#1b3a2d";
const GOLD = "#c9a84c";

type Reservation = {
  id: string;
  proposalId: string | null;
  proposal: { id: string; title: string } | null;
  propertyId: string | null;
  property: { id: string; name: string } | null;
  campName: string;
  reservationsEmail: string;
  guestName: string;
  startDate: string;
  endDate: string;
  adults: number;
  children: number;
  roomConfig: string | null;
  notes: string | null;
  status: string;
  sentAt: string | null;
  confirmedAt: string | null;
  heldUntil: string | null;
  createdAt: string;
};

type StatusFilter = "open" | "all" | "confirmed" | "declined";

export function ReservationsPage() {
  const [rows, setRows] = useState<Reservation[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>("open");
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const qs =
        filter === "open" ? "" :
        filter === "all" ? "?status=all" :
        `?status=${filter}`;
      const res = await fetch(`/api/reservations${qs}`, { cache: "no-store" });
      if (res.status === 401) { window.location.href = "/sign-in?redirect_url=/reservations"; return; }
      if (res.status === 409) { window.location.href = "/select-organization"; return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { reservations: Reservation[] };
      setRows(data.reservations);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="min-h-screen" style={{ background: "#f8f5ef" }}>
      <AppHeader />

      <main className="max-w-5xl mx-auto px-6 py-10">
        <header className="flex items-end justify-between gap-4 flex-wrap mb-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-black/85">
              Camp holds
            </h1>
            <p className="mt-2 text-[15px] text-black/55">
              Track reservations requested from suppliers — pending, sent, confirmed.
            </p>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold transition active:scale-95"
            style={{ background: FOREST, color: "white" }}
          >
            + New reservation
          </button>
        </header>

        <FilterTabs filter={filter} setFilter={setFilter} />

        {err && (
          <div className="rounded-xl border border-[#b34334]/30 bg-[#b34334]/5 p-4 text-[#b34334] text-sm mb-5">
            {err}
          </div>
        )}

        {!rows && !err && (
          <div className="rounded-2xl bg-white border border-black/8 h-40 animate-pulse" />
        )}

        {rows && rows.length === 0 && (
          <EmptyState onNew={() => setModalOpen(true)} />
        )}

        {rows && rows.length > 0 && (
          <div className="rounded-2xl bg-white border border-black/8 overflow-hidden divide-y divide-black/8">
            {rows.map((r) => (
              <ReservationRow key={r.id} row={r} onChanged={load} />
            ))}
          </div>
        )}
      </main>

      {modalOpen && (
        <NewReservationModal
          onClose={() => setModalOpen(false)}
          onCreated={() => { setModalOpen(false); load(); }}
        />
      )}
    </div>
  );
}

// ─── Filter tabs ───────────────────────────────────────────────────────────

function FilterTabs({
  filter,
  setFilter,
}: {
  filter: StatusFilter;
  setFilter: (f: StatusFilter) => void;
}) {
  const opts: { id: StatusFilter; label: string }[] = [
    { id: "open", label: "Open" },
    { id: "confirmed", label: "Confirmed" },
    { id: "declined", label: "Declined" },
    { id: "all", label: "All" },
  ];
  return (
    <div className="mb-5 flex gap-1.5 flex-wrap">
      {opts.map((o) => {
        const active = filter === o.id;
        return (
          <button
            key={o.id}
            onClick={() => setFilter(o.id)}
            className="px-3 py-1.5 rounded-full text-[12.5px] font-medium transition"
            style={{
              background: active ? FOREST : "rgba(0,0,0,0.04)",
              color: active ? "white" : "rgba(0,0,0,0.65)",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Reservation row ───────────────────────────────────────────────────────

function ReservationRow({ row, onChanged }: { row: Reservation; onChanged: () => void }) {
  const [saving, setSaving] = useState(false);

  const setStatus = async (status: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/reservations/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) onChanged();
    } finally {
      setSaving(false);
    }
  };

  const mailtoHref = buildMailtoHref(row);

  return (
    <div className="px-5 py-4 flex items-start gap-4 flex-wrap">
      <div className="flex-1 min-w-[240px]">
        <div className="flex items-center gap-2">
          <div className="text-[15px] font-semibold text-black/85 truncate">{row.campName}</div>
          <StatusChip status={row.status} />
        </div>
        <div className="text-[13px] text-black/60 mt-1 truncate">
          {row.guestName} · {formatDateRange(row.startDate, row.endDate)} · {row.adults}A
          {row.children > 0 ? ` + ${row.children}C` : ""}
        </div>
        <div className="text-[12px] text-black/45 mt-0.5 truncate">
          {row.reservationsEmail}
          {row.proposal && <span> · Proposal: <span className="text-black/65">{row.proposal.title}</span></span>}
        </div>
        {row.notes && (
          <div className="mt-1 text-[12px] text-black/55 italic truncate">{row.notes}</div>
        )}
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {row.status === "pending" && (
          <a
            href={mailtoHref}
            onClick={() => setTimeout(() => setStatus("sent"), 400)}
            className="px-3 py-1.5 rounded-lg text-[12.5px] font-semibold transition active:scale-95"
            style={{ background: GOLD, color: FOREST }}
          >
            Send email →
          </a>
        )}
        {row.status === "sent" && (
          <>
            <button
              onClick={() => setStatus("confirmed")}
              disabled={saving}
              className="px-3 py-1.5 rounded-lg text-[12.5px] font-semibold transition active:scale-95"
              style={{ background: FOREST, color: "white" }}
            >
              Confirmed ✓
            </button>
            <button
              onClick={() => setStatus("declined")}
              disabled={saving}
              className="px-3 py-1.5 rounded-lg text-[12.5px] text-black/65 border hover:bg-black/5 transition"
              style={{ borderColor: "rgba(0,0,0,0.12)" }}
            >
              Declined
            </button>
          </>
        )}
        {(row.status === "confirmed" || row.status === "tentative") && (
          <button
            onClick={() => setStatus("released")}
            disabled={saving}
            className="px-3 py-1.5 rounded-lg text-[12.5px] text-black/65 border hover:bg-black/5 transition"
            style={{ borderColor: "rgba(0,0,0,0.12)" }}
          >
            Release
          </button>
        )}
      </div>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const colours: Record<string, { bg: string; fg: string; label: string }> = {
    pending:   { bg: "rgba(0,0,0,0.06)",           fg: "rgba(0,0,0,0.55)", label: "Pending" },
    sent:      { bg: "rgba(201,168,76,0.18)",      fg: "#8a7125",           label: "Sent" },
    confirmed: { bg: "rgba(27,58,45,0.12)",         fg: FOREST,              label: "Confirmed" },
    declined:  { bg: "rgba(179,67,52,0.1)",         fg: "#b34334",           label: "Declined" },
    tentative: { bg: "rgba(201,168,76,0.1)",        fg: "#8a7125",           label: "Tentative" },
    released:  { bg: "rgba(0,0,0,0.04)",            fg: "rgba(0,0,0,0.4)",   label: "Released" },
  };
  const s = colours[status] ?? colours.pending;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] uppercase tracking-[0.12em] font-semibold"
      style={{ background: s.bg, color: s.fg }}
    >
      {s.label}
    </span>
  );
}

// ─── New reservation modal ─────────────────────────────────────────────────

function NewReservationModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [campName, setCampName] = useState("");
  const [reservationsEmail, setReservationsEmail] = useState("");
  const [guestName, setGuestName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [adults, setAdults] = useState("2");
  const [children, setChildren] = useState("0");
  const [roomConfig, setRoomConfig] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canSubmit = campName.trim() && reservationsEmail.trim() && guestName.trim() && startDate && endDate && !busy;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campName,
          reservationsEmail,
          guestName,
          startDate,
          endDate,
          adults: parseInt(adults, 10) || 2,
          children: parseInt(children, 10) || 0,
          roomConfig: roomConfig || undefined,
          notes: notes || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { if (!busy) onClose(); }} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[92vh] flex flex-col">
        <header className="px-6 py-5 border-b" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
          <div className="text-[10.5px] uppercase tracking-[0.22em] font-semibold" style={{ color: FOREST }}>
            New reservation
          </div>
          <h3 className="text-lg font-bold text-black/85 mt-1" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            Request a camp hold
          </h3>
        </header>
        <form onSubmit={submit} className="px-6 py-5 space-y-3 overflow-auto flex-1">
          <Field label="Camp name" value={campName} onChange={setCampName} placeholder="Cottar's 1920s Safari Camp" />
          <Field
            label="Reservations email"
            value={reservationsEmail}
            onChange={setReservationsEmail}
            placeholder="reservations@thecamp.com"
            type="email"
          />
          <Field label="Guest name(s)" value={guestName} onChange={setGuestName} placeholder="The Smith Family" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start date" value={startDate} onChange={setStartDate} type="date" />
            <Field label="End date" value={endDate} onChange={setEndDate} type="date" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Adults" value={adults} onChange={setAdults} type="number" />
            <Field label="Children" value={children} onChange={setChildren} type="number" />
          </div>
          <Field label="Room config (optional)" value={roomConfig} onChange={setRoomConfig} placeholder="1 double + 1 twin" />
          <FieldText label="Notes (optional)" value={notes} onChange={setNotes} placeholder="Dietary, anniversary, any holds expiring…" />
          {err && (
            <div className="rounded-lg px-3 py-2 text-[13px] text-[#7a2e23] bg-[#f4d7d0] border border-[#e3b5ac]">
              {err}
            </div>
          )}
        </form>
        <footer className="px-6 py-4 border-t flex items-center justify-end gap-2" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2 text-[13.5px] rounded-lg text-black/60 hover:bg-black/5 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={submit}
            disabled={!canSubmit}
            className="px-5 py-2 text-[13.5px] rounded-lg font-semibold transition active:scale-95 disabled:opacity-60"
            style={{ background: FOREST, color: "white" }}
          >
            {busy ? "Saving…" : "Create reservation"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, type = "text",
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <label className="block">
      <span className="block text-[11.5px] text-black/55 mb-1">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border rounded-lg text-[14px] focus:outline-none focus:border-[#1b3a2d]"
        style={{ borderColor: "rgba(0,0,0,0.12)" }}
      />
    </label>
  );
}

function FieldText({
  label, value, onChange, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="block text-[11.5px] text-black/55 mb-1">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full px-3 py-2 border rounded-lg text-[13.5px] leading-relaxed focus:outline-none focus:border-[#1b3a2d] resize-y"
        style={{ borderColor: "rgba(0,0,0,0.12)" }}
      />
    </label>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="rounded-2xl bg-white border border-dashed border-black/15 p-10 text-center">
      <div
        className="w-12 h-12 mx-auto rounded-2xl flex items-center justify-center text-[#c9a84c] text-xl font-bold mb-4"
        style={{ background: "rgba(201,168,76,0.15)" }}
      >
        ✉
      </div>
      <h2 className="text-lg font-semibold text-black/80">No open reservations</h2>
      <p className="mt-1.5 text-[14px] text-black/50 max-w-sm mx-auto">
        Track camp holds once you&apos;ve sent out a proposal — new reservations default to "pending" until you email the supplier.
      </p>
      <button
        onClick={onNew}
        className="mt-6 px-5 py-2.5 rounded-xl text-sm font-semibold transition active:scale-95"
        style={{ background: FOREST, color: "white" }}
      >
        + New reservation
      </button>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function buildMailtoHref(row: Reservation): string {
  const subject = `Hold request — ${row.guestName} — ${formatDateRange(row.startDate, row.endDate)}`;
  const bodyLines = [
    `Hello,`,
    ``,
    `Could we please hold space at ${row.campName} for the following guests:`,
    ``,
    `Guest(s): ${row.guestName}`,
    `Dates: ${formatDateRange(row.startDate, row.endDate)}`,
    `Pax: ${row.adults} adult${row.adults === 1 ? "" : "s"}${row.children > 0 ? ` + ${row.children} child${row.children === 1 ? "" : "ren"}` : ""}`,
    row.roomConfig ? `Rooms: ${row.roomConfig}` : "",
    row.notes ? `Notes: ${row.notes}` : "",
    ``,
    `Please confirm availability + rate at your earliest convenience.`,
    ``,
    `Many thanks.`,
  ].filter(Boolean);
  const body = bodyLines.join("\n");
  return `mailto:${encodeURIComponent(row.reservationsEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function formatDateRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return "";
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  if (sameMonth) {
    return `${start.getDate()}–${end.getDate()} ${start.toLocaleDateString(undefined, { month: "short", year: "numeric" })}`;
  }
  return `${start.toLocaleDateString(undefined, { day: "numeric", month: "short" })} – ${end.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`;
}
