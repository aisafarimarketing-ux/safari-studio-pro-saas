"use client";

import { useCallback, useEffect, useState } from "react";

// ─── Booking Operations panel ──────────────────────────────────────────────
//
// Surface inside ReservationSummaryDialog. Lists every property the
// operator needs to confirm availability with for this booking.
//
// v1 flow:
//   1. Empty state → "Generate property checks" CTA
//   2. List of property cards, each with:
//      - property + destination + dates
//      - status pill
//      - draft message (collapsible textarea)
//      - "Copy draft" + "Mark sent" / "Mark replied" / "Available" /
//        "Not available" buttons
//      - 24h follow-up hint when status="sent" and sentAt > 24h ago
//
// No auto-send. No auto-confirm. Every transition is operator-driven.

type Row = {
  id: string;
  propertyName: string;
  destination: string | null;
  tierKey: string | null;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  adults: number;
  children: number;
  roomingNotes: string | null;
  draftText: string;
  status: string;
  sentAt: string | null;
  repliedAt: string | null;
  resolvedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type Loaded =
  | { state: "loading" }
  | { state: "empty" }
  | { state: "ready"; rows: Row[]; warnings?: string[] }
  | { state: "error"; message: string };

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export function BookingOpsSection({ reservationId }: { reservationId: string }) {
  const [data, setData] = useState<Loaded>({ state: "loading" });
  const [busy, setBusy] = useState(false);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  const fetchRows = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/bookings/check-requests?reservationId=${encodeURIComponent(reservationId)}`,
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      const rows: Row[] = Array.isArray(body.rows) ? body.rows : [];
      setData(rows.length === 0 ? { state: "empty" } : { state: "ready", rows });
    } catch (err) {
      setData({
        state: "error",
        message: err instanceof Error ? err.message : "Couldn't load property checks.",
      });
    }
  }, [reservationId]);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  const generate = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/bookings/check-requests/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservationId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      const rows: Row[] = Array.isArray(body.rows) ? body.rows : [];
      const warnings: string[] = Array.isArray(body.warnings) ? body.warnings : [];
      setData(
        rows.length === 0
          ? { state: "empty" }
          : { state: "ready", rows, warnings: warnings.length > 0 ? warnings : undefined },
      );
    } catch (err) {
      setData({
        state: "error",
        message: err instanceof Error ? err.message : "Couldn't generate property checks.",
      });
    } finally {
      setBusy(false);
    }
  }, [reservationId]);

  const updateRow = useCallback(
    async (id: string, patch: Partial<Pick<Row, "status" | "notes" | "draftText">>) => {
      try {
        const res = await fetch(`/api/bookings/check-requests/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
        const updated = body.row as Row;
        setData((prev) => {
          if (prev.state !== "ready") return prev;
          return {
            ...prev,
            rows: prev.rows.map((r) => (r.id === id ? updated : r)),
          };
        });
      } catch (err) {
        // Best-effort optimistic — we don't roll back; the next list
        // refresh corrects state. Surface a console warning so we can
        // diagnose if patch is failing silently in production.
        console.warn("[booking-ops] patch failed:", err);
      }
    },
    [],
  );

  const toggleDraft = useCallback((id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  if (data.state === "loading") {
    return <SectionShell><div className="text-[12.5px] opacity-70">Loading property checks…</div></SectionShell>;
  }
  if (data.state === "error") {
    return (
      <SectionShell>
        <div className="text-[12.5px] text-red-700">{data.message}</div>
      </SectionShell>
    );
  }
  if (data.state === "empty") {
    return (
      <SectionShell>
        <div className="text-[12.5px] mb-3 opacity-80">
          Generate availability checks for every property in this booked itinerary.
        </div>
        <button
          type="button"
          onClick={() => void generate()}
          disabled={busy}
          className="px-3 py-2 rounded-lg text-[13px] font-medium"
          style={{ background: "#1b3a2d", color: "#F7F3E8" }}
        >
          {busy ? "Generating…" : "Generate property checks"}
        </button>
      </SectionShell>
    );
  }

  return (
    <SectionShell>
      {data.warnings && data.warnings.length > 0 && (
        <div
          className="mb-3 px-3 py-2 rounded-lg text-[12px]"
          style={{ background: "rgba(202,138,4,0.10)", color: "#a16207" }}
        >
          {data.warnings.map((w, i) => (
            <div key={i}>{w}</div>
          ))}
        </div>
      )}
      <ul className="flex flex-col gap-3">
        {data.rows.map((row) => (
          <PropertyCard
            key={row.id}
            row={row}
            isDraftOpen={openIds.has(row.id)}
            onToggleDraft={() => toggleDraft(row.id)}
            onUpdate={(patch) => void updateRow(row.id, patch)}
          />
        ))}
      </ul>
    </SectionShell>
  );
}

function SectionShell({ children }: { children: React.ReactNode }) {
  return (
    <section
      className="mt-4 px-5 md:px-7 pb-5"
      style={{ borderTop: "1px solid rgba(0,0,0,0.10)" }}
    >
      <div className="pt-4 pb-3">
        <div
          className="text-[11px] tracking-[0.06em] uppercase opacity-70"
          style={{ fontWeight: 600 }}
        >
          Booking operations
        </div>
        <div className="text-[14px] mt-0.5" style={{ fontWeight: 500 }}>
          Properties to check
        </div>
      </div>
      {children}
    </section>
  );
}

function PropertyCard({
  row,
  isDraftOpen,
  onToggleDraft,
  onUpdate,
}: {
  row: Row;
  isDraftOpen: boolean;
  onToggleDraft: () => void;
  onUpdate: (patch: Partial<Pick<Row, "status" | "notes" | "draftText">>) => void;
}) {
  // Capture "now" once on mount so the 24h-since-sent check stays
  // pure during render. We don't need the value to tick — a follow-up
  // hint that turns on after the operator dismisses the dialog and
  // reopens it is fine; the parent re-fetches on every open.
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNowMs(Date.now());
  }, []);
  const followUpNeeded =
    nowMs !== null && row.status === "sent" && row.sentAt
      ? nowMs - new Date(row.sentAt).getTime() > TWENTY_FOUR_HOURS_MS
      : false;

  const dateRange = `${formatShortDate(row.checkInDate)} → ${formatShortDate(row.checkOutDate)}`;
  const subtitle = [row.destination, dateRange, `${row.nights} ${row.nights === 1 ? "night" : "nights"}`]
    .filter(Boolean)
    .join(" · ");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(row.draftText);
    } catch {
      /* clipboard unavailable — operator can still select the textarea */
    }
  };

  return (
    <li
      className="rounded-xl"
      style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.06)" }}
    >
      <div className="px-3 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[13.5px]" style={{ fontWeight: 600 }}>
              {row.propertyName}
            </div>
            <div className="text-[11.5px] mt-0.5 opacity-70">{subtitle}</div>
          </div>
          <StatusPill status={row.status} />
        </div>

        {followUpNeeded && row.status === "sent" && (
          <div
            className="mt-2 px-2.5 py-1.5 rounded-md text-[11.5px] inline-block"
            style={{ background: "rgba(202,138,4,0.10)", color: "#a16207" }}
          >
            Sent over 24h ago — a follow-up note is suggested.
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onToggleDraft}
            className="text-[12px] px-2.5 py-1.5 rounded-md"
            style={{ background: "rgba(0,0,0,0.06)" }}
          >
            {isDraftOpen ? "Hide draft" : "View draft"}
          </button>
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="text-[12px] px-2.5 py-1.5 rounded-md"
            style={{ background: "rgba(0,0,0,0.06)" }}
          >
            Copy draft
          </button>
          {row.status === "not_sent" && (
            <button
              type="button"
              onClick={() => onUpdate({ status: "sent" })}
              className="text-[12px] px-2.5 py-1.5 rounded-md"
              style={{ background: "#1b3a2d", color: "#F7F3E8" }}
            >
              Mark sent
            </button>
          )}
          {(row.status === "sent" || row.status === "follow_up_needed") && (
            <>
              <button
                type="button"
                onClick={() => onUpdate({ status: "available" })}
                className="text-[12px] px-2.5 py-1.5 rounded-md"
                style={{ background: "rgba(22,163,74,0.12)", color: "#15803d", fontWeight: 600 }}
              >
                Available
              </button>
              <button
                type="button"
                onClick={() => onUpdate({ status: "not_available" })}
                className="text-[12px] px-2.5 py-1.5 rounded-md"
                style={{ background: "rgba(220,38,38,0.10)", color: "#b91c1c", fontWeight: 600 }}
              >
                Not available
              </button>
              <button
                type="button"
                onClick={() => onUpdate({ status: "replied" })}
                className="text-[12px] px-2.5 py-1.5 rounded-md"
                style={{ background: "rgba(0,0,0,0.06)" }}
              >
                Replied (no decision)
              </button>
            </>
          )}
          {row.status === "sent" && !followUpNeeded && (
            <button
              type="button"
              onClick={() => onUpdate({ status: "follow_up_needed" })}
              className="text-[12px] px-2.5 py-1.5 rounded-md"
              style={{ background: "rgba(0,0,0,0.06)" }}
            >
              Flag follow-up
            </button>
          )}
          {(row.status === "available" || row.status === "not_available" || row.status === "replied") && (
            <button
              type="button"
              onClick={() => onUpdate({ status: "not_sent" })}
              className="text-[12px] px-2.5 py-1.5 rounded-md opacity-70"
              style={{ background: "rgba(0,0,0,0.05)" }}
              title="Reset this stay back to not-sent"
            >
              Reset
            </button>
          )}
          {row.status === "not_available" && (
            <span className="text-[11.5px] opacity-70 self-center">
              Find an alternative or ask the client to switch.
            </span>
          )}
        </div>

        {isDraftOpen && (
          <div className="mt-3">
            <textarea
              value={row.draftText}
              onChange={(e) => onUpdate({ draftText: e.target.value })}
              rows={Math.min(14, Math.max(8, row.draftText.split("\n").length + 2))}
              className="w-full text-[12.5px] rounded-md p-2 outline-none resize-y"
              style={{
                background: "#F7F3E8",
                border: "1px solid rgba(0,0,0,0.10)",
                fontFamily: "inherit",
                lineHeight: 1.5,
              }}
            />
            <div className="text-[11px] opacity-60 mt-1">
              Edits are saved automatically. The audit trail keeps the
              latest version per property.
            </div>
          </div>
        )}
      </div>
    </li>
  );
}

function StatusPill({ status }: { status: string }) {
  const { label, fg, bg } = statusTokens(status);
  return (
    <span
      className="text-[10.5px] px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: bg, color: fg, fontWeight: 600, letterSpacing: "0.02em" }}
    >
      {label}
    </span>
  );
}

function statusTokens(status: string): { label: string; fg: string; bg: string } {
  switch (status) {
    case "sent":
      return { label: "Sent", fg: "#1d4ed8", bg: "rgba(29,78,216,0.10)" };
    case "replied":
      return { label: "Replied", fg: "rgba(10,20,17,0.7)", bg: "rgba(0,0,0,0.06)" };
    case "available":
      return { label: "Available", fg: "#15803d", bg: "rgba(22,163,74,0.12)" };
    case "not_available":
      return { label: "Not available", fg: "#b91c1c", bg: "rgba(220,38,38,0.10)" };
    case "follow_up_needed":
      return { label: "Follow up", fg: "#a16207", bg: "rgba(202,138,4,0.10)" };
    case "not_sent":
    default:
      return { label: "Not sent", fg: "rgba(10,20,17,0.55)", bg: "rgba(0,0,0,0.05)" };
  }
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]}`;
}
