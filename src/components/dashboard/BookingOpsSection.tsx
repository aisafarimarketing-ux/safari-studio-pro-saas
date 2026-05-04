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
  /** Most-recent outbound (initial OR any follow-up). Drives the
   *  cadence math; sentAt stays frozen at the first dispatch for
   *  audit purposes. */
  lastSentAt: string | null;
  repliedAt: string | null;
  resolvedAt: string | null;
  attemptCount: number;
  nextActionAt: string | null;
  /** Coarse-grained server-derived action bucket. Useful for
   *  filters / counts; the UI hint copy stills comes from
   *  orch.nextAction.kind. */
  suggestedAction: "follow_up" | "switch" | "confirm_client" | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

// Lazy-loaded orchestration payload per row. Fetched when the
// operator expands a card (or when the next-action requires it
// — alternatives list, client draft preview).
type Orchestrate = {
  nextAction: { kind: NextActionKind; hint: string };
  suggestedAction: "follow_up" | "switch" | "confirm_client" | null;
  /** Pre-rendered gentle follow-up draft. Null when escalation is
   *  the right path — the UI hides the "Copy follow-up" button in
   *  that state and shows the escalation panel instead. */
  followUpDraft: string | null;
  alternatives: { name: string; destination: string | null; occurrences: number }[];
  alternativeRequest: string | null;
  clientGoodNews: string | null;
  clientAlternatives: string | null;
};

type NextActionKind =
  | "send_initial"
  | "awaiting_reply"
  | "send_followup"
  | "escalate"
  | "send_followup_now"
  | "mark_outcome"
  | "tell_client"
  | "offer_alternatives"
  | "none";

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

  // Action handler — dispatches non-status mutations like
  // record_followup_sent. Same PATCH endpoint, different body shape.
  const sendAction = useCallback(
    async (id: string, action: "record_followup_sent") => {
      try {
        const res = await fetch(`/api/bookings/check-requests/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
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
        console.warn("[booking-ops] action failed:", err);
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
            onAction={(action) => sendAction(row.id, action)}
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
  onAction,
}: {
  row: Row;
  isDraftOpen: boolean;
  onToggleDraft: () => void;
  onUpdate: (patch: Partial<Pick<Row, "status" | "notes" | "draftText">>) => void;
  onAction: (action: "record_followup_sent") => Promise<void>;
}) {
  // Capture "now" once on mount so the 24h-since-sent check stays
  // pure during render. We don't need the value to tick — a follow-up
  // hint that turns on after the operator dismisses the dialog and
  // reopens it is fine; the parent re-fetches on every open.
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => {
    setNowMs(Date.now());
  }, []);
  // Server has already calculated nextActionAt with the right
  // cadence (attempt 1 → +24h, attempt 2+ → +48h) — UI just trusts
  // that value. The legacy fallback to sentAt + 24h handles old
  // rows written before the cadence column existed.
  const followUpNeeded =
    nowMs !== null && row.status === "sent" && row.nextActionAt
      ? nowMs >= new Date(row.nextActionAt).getTime()
      : nowMs !== null && row.status === "sent" && row.sentAt
        ? nowMs - new Date(row.sentAt).getTime() > TWENTY_FOUR_HOURS_MS
        : false;

  // Orchestration payload — fetched lazily on first expand. Cached
  // per-row so toggling open/closed doesn't refetch unless the
  // operator explicitly refreshes (we re-fetch when status changes).
  const [orch, setOrch] = useState<Orchestrate | null>(null);
  const fetchOrch = useCallback(async () => {
    try {
      const res = await fetch(`/api/bookings/check-requests/${row.id}/orchestrate`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      setOrch(body as Orchestrate);
    } catch (err) {
      console.warn("[booking-ops] orchestrate fetch failed:", err);
    }
  }, [row.id]);
  // Refetch whenever status / attemptCount changes — those flip the
  // available drafts and alternatives.
  useEffect(() => {
    void fetchOrch();
  }, [fetchOrch, row.status, row.attemptCount]);

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

        {/* Suggested next-action hint — driven by deriveNextAction
            on the server. Italic, calm, single line. Sits between
            status pill and action buttons so the operator sees the
            recommendation before scanning the buttons. */}
        {orch?.nextAction.hint && (
          <div
            className="mt-2 text-[11.5px] italic"
            style={{ color: "rgba(10,20,17,0.72)" }}
          >
            {orch.nextAction.hint}
          </div>
        )}

        {followUpNeeded && row.status === "sent" && (
          <div
            className="mt-2 px-2.5 py-1.5 rounded-md text-[11.5px] inline-block"
            style={{ background: "rgba(202,138,4,0.10)", color: "#a16207" }}
          >
            {row.attemptCount >= 2
              ? "Two follow-ups already out — time to escalate or move on."
              : row.attemptCount === 1
                ? "Sent over 24h ago — a follow-up note is suggested."
                : "Awaiting reply."}
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
          {/* Send follow-up — copies the gentle draft to the clipboard,
              marks the action recorded server-side. Only renders when
              orchestrate says a follow-up is the right next move
              (followUpDraft is set + kind ∈ send_followup /
              send_followup_now). On the escalation path the button
              is hidden and the panel below takes over. */}
          {(followUpNeeded || row.status === "follow_up_needed") &&
            orch?.followUpDraft &&
            orch.nextAction.kind !== "escalate" && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(orch.followUpDraft ?? "");
                  } catch {
                    /* clipboard unavailable */
                  }
                  await onAction("record_followup_sent");
                }}
                className="text-[12px] px-2.5 py-1.5 rounded-md"
                style={{ background: "#1b3a2d", color: "#F7F3E8", fontWeight: 600 }}
                title="Copies a gentle follow-up to your clipboard."
              >
                Copy follow-up
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

        {/* Escalation branch: two messages already out and still no
            reply. Surface the same alternatives flow as the
            not_available state — but proactively, before the
            operator marks the row dead. The operator then picks
            "switch" (mark not_available, work the alternatives) or
            "call" (mark replied once contact is made manually).
            No third follow-up button is offered. */}
        {orch?.nextAction.kind === "escalate" && (
          <div
            className="mt-3 rounded-md p-3"
            style={{ background: "rgba(202,138,4,0.08)", border: "1px solid rgba(202,138,4,0.22)" }}
          >
            <div className="text-[11.5px] mb-2" style={{ color: "#a16207", fontWeight: 600 }}>
              Two messages already out — time to call or switch.
            </div>
            <div className="text-[11.5px] mb-3 opacity-80">
              A third write rarely helps. Either pick up the phone, or move
              the booking to an alternative property below.
            </div>
            {orch.alternatives.length > 0 && (
              <>
                <div className="text-[11px] uppercase tracking-[0.06em] opacity-60 mb-1" style={{ fontWeight: 600 }}>
                  Alternatives in the same region
                </div>
                <ul className="text-[12.5px] space-y-1 mb-3">
                  {orch.alternatives.map((alt) => (
                    <li key={alt.name}>
                      <span style={{ fontWeight: 500 }}>{alt.name}</span>
                      {alt.destination && <span className="opacity-70"> · {alt.destination}</span>}
                      {alt.occurrences > 1 && (
                        <span className="opacity-60"> · used in {alt.occurrences} past proposals</span>
                      )}
                    </li>
                  ))}
                </ul>
                {orch.alternativeRequest && (
                  <ClientMessageRow
                    label={`Outbound to ${orch.alternatives[0].name}`}
                    text={orch.alternativeRequest}
                    accent="amber"
                  />
                )}
              </>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onUpdate({ status: "not_available" })}
                className="text-[12px] px-2.5 py-1.5 rounded-md"
                style={{ background: "#a16207", color: "#F7F3E8", fontWeight: 600 }}
                title="Move this row to the not_available flow so the alternatives become the active path."
              >
                Switch to alternative
              </button>
              <button
                type="button"
                onClick={() => onUpdate({ status: "replied" })}
                className="text-[12px] px-2.5 py-1.5 rounded-md"
                style={{ background: "rgba(0,0,0,0.06)", fontWeight: 500 }}
                title="Mark replied once you've reached the property by phone."
              >
                I called them
              </button>
            </div>
          </div>
        )}

        {/* Not-available branch: surface alternatives + client offer
            message + first-alternative outbound. Operator picks
            which to copy. v1 doesn't auto-create new check-request
            rows for the alternatives — operator decides flow. */}
        {row.status === "not_available" && orch && (
          <div
            className="mt-3 rounded-md p-3"
            style={{ background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.20)" }}
          >
            <div className="text-[11.5px] mb-2" style={{ color: "#b91c1c", fontWeight: 600 }}>
              Segment blocked — original property unavailable.
            </div>
            {orch.alternatives.length === 0 ? (
              <div className="text-[11.5px] opacity-75">
                No alternatives found in your past proposals for this region and tier.
                Reach out to the client with the offer message below to keep the
                conversation moving.
              </div>
            ) : (
              <>
                <div className="text-[11px] uppercase tracking-[0.06em] opacity-60 mb-1" style={{ fontWeight: 600 }}>
                  Suggested alternatives
                </div>
                <ul className="text-[12.5px] space-y-1 mb-3">
                  {orch.alternatives.map((alt) => (
                    <li key={alt.name}>
                      <span style={{ fontWeight: 500 }}>{alt.name}</span>
                      {alt.destination && <span className="opacity-70"> · {alt.destination}</span>}
                      {alt.occurrences > 1 && (
                        <span className="opacity-60"> · used in {alt.occurrences} past proposals</span>
                      )}
                    </li>
                  ))}
                </ul>
                {orch.alternativeRequest && (
                  <ClientMessageRow
                    label={`Outbound to ${orch.alternatives[0].name}`}
                    text={orch.alternativeRequest}
                  />
                )}
              </>
            )}
            {orch.clientAlternatives && (
              <ClientMessageRow
                label="Tell the client"
                text={orch.clientAlternatives}
                accent="amber"
              />
            )}
          </div>
        )}

        {/* Available branch: surface the "good news" client message
            so the operator can paste a confirmation note in one click. */}
        {row.status === "available" && orch?.clientGoodNews && (
          <div
            className="mt-3 rounded-md p-3"
            style={{ background: "rgba(22,163,74,0.06)", border: "1px solid rgba(22,163,74,0.20)" }}
          >
            <div className="text-[11.5px] mb-2" style={{ color: "#15803d", fontWeight: 600 }}>
              Locked in — share the good news with the client.
            </div>
            <ClientMessageRow label="Tell the client" text={orch.clientGoodNews} accent="green" />
          </div>
        )}
      </div>
    </li>
  );
}

// Small inline row that shows a labelled message + a copy button.
// Used for the "Tell the client" / "Outbound to alternative" panels
// — same pattern, different copy / accent.
function ClientMessageRow({
  label,
  text,
  accent,
}: {
  label: string;
  text: string;
  accent?: "green" | "amber";
}) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };
  const accentColor =
    accent === "green" ? "#15803d" : accent === "amber" ? "#a16207" : "#0a1411";
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] uppercase tracking-[0.06em] opacity-70" style={{ fontWeight: 600 }}>
          {label}
        </span>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="text-[11px] px-2 py-0.5 rounded"
          style={{ background: "rgba(0,0,0,0.06)", color: accentColor, fontWeight: 600 }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre
        className="text-[12px] whitespace-pre-wrap rounded-md p-2"
        style={{
          background: "#F7F3E8",
          border: "1px solid rgba(0,0,0,0.10)",
          fontFamily: "inherit",
          lineHeight: 1.5,
        }}
      >
        {text}
      </pre>
    </div>
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
