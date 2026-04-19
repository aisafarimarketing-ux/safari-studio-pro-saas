"use client";

import { useState } from "react";

export function AdminOrgRow({
  id,
  name,
  clerkOrgId,
  status,
  suspendedReason,
  proposalCount,
  propertyCount,
  tier,
  tierExpiresAt,
}: {
  id: string;
  name: string;
  clerkOrgId: string;
  status: string;
  suspendedReason: string | null;
  proposalCount: number;
  propertyCount: number;
  tier: string;
  tierExpiresAt: string | null;
}) {
  const [currentStatus, setCurrentStatus] = useState(status);
  const [reason, setReason] = useState(suspendedReason ?? "");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTier, setCurrentTier] = useState(tier);
  const [tierBusy, setTierBusy] = useState(false);
  const [tierExpiry, setTierExpiry] = useState(
    tierExpiresAt ? tierExpiresAt.slice(0, 10) : "",
  );

  const isSuspended = currentStatus === "suspended";

  const toggle = async (nextStatus: "active" | "suspended", nextReason?: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/organizations/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: nextStatus,
          reason: nextStatus === "suspended" ? (nextReason ?? "").trim() || null : null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `HTTP ${res.status}`);
      }
      setCurrentStatus(nextStatus);
      if (nextStatus === "active") setReason("");
      setConfirming(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const updateTier = async (nextTier: "trial" | "pilot" | "paid", nextExpiry?: string) => {
    if (tierBusy) return;
    setTierBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/organizations/${id}/tier`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier: nextTier,
          expiresAt: nextExpiry ? new Date(nextExpiry).toISOString() : null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `HTTP ${res.status}`);
      }
      setCurrentTier(nextTier);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setTierBusy(false);
    }
  };

  return (
    <div className="px-5 py-4">
      <div className="grid grid-cols-[1.2fr_1fr_0.5fr_0.5fr_auto_auto] gap-3 items-center">
        <div className="min-w-0">
          <div className="text-small font-semibold text-black/85 truncate">{name}</div>
          {isSuspended && suspendedReason && !confirming && (
            <div className="text-label text-[#b34334] mt-0.5 truncate" style={{ textTransform: "none", letterSpacing: "0", fontWeight: 400 }}>
              {suspendedReason}
            </div>
          )}
        </div>
        <div className="text-label font-mono text-black/40 truncate" style={{ textTransform: "none", letterSpacing: "0", fontWeight: 400 }}>
          {clerkOrgId}
        </div>
        <div className="text-small text-black/60 text-right tabular-nums">{proposalCount}</div>
        <div className="text-small text-black/60 text-right tabular-nums">{propertyCount}</div>
        <div className="flex items-center gap-1.5 justify-end">
          <select
            value={currentTier}
            onChange={(e) => {
              const next = e.target.value as "trial" | "pilot" | "paid";
              void updateTier(next, next === "pilot" ? tierExpiry : "");
            }}
            disabled={tierBusy}
            className="text-label font-semibold rounded-md border border-black/12 px-2 py-1 bg-white hover:bg-black/[0.03] focus:outline-none focus:border-[#1b3a2d]"
            style={{ textTransform: "none", letterSpacing: "0" }}
          >
            <option value="trial">Trial</option>
            <option value="pilot">Pilot</option>
            <option value="paid">Paid</option>
          </select>
          {currentTier === "pilot" && (
            <input
              type="date"
              value={tierExpiry}
              onChange={(e) => {
                setTierExpiry(e.target.value);
                void updateTier("pilot", e.target.value);
              }}
              disabled={tierBusy}
              className="text-label rounded-md border border-black/12 px-1.5 py-1 bg-white focus:outline-none focus:border-[#1b3a2d]"
              style={{ textTransform: "none", letterSpacing: "0" }}
              title="Pilot end date"
            />
          )}
        </div>
        <div className="flex items-center gap-2 justify-end">
          <StatusBadge status={currentStatus} />
          {!confirming ? (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={busy}
              className={`px-3 py-1 rounded-md text-label font-semibold transition ${
                isSuspended
                  ? "bg-[#1b3a2d] text-white hover:bg-[#2d5a40]"
                  : "text-[#b34334] border border-[#b34334]/30 hover:bg-[#b34334]/[0.08]"
              }`}
              style={{ textTransform: "none", letterSpacing: "0" }}
            >
              {isSuspended ? "Reactivate" : "Suspend"}
            </button>
          ) : null}
        </div>
      </div>

      {confirming && (
        <div className="mt-3 p-3 rounded-lg bg-black/[0.02] border border-black/8">
          {isSuspended ? (
            <p className="text-small text-black/70 mb-2">
              Reactivate this workspace? Users regain full access immediately.
            </p>
          ) : (
            <>
              <p className="text-small text-black/70 mb-2">
                Suspend this workspace? Users will see &ldquo;Workspace on hold&rdquo; next time they load the app.
              </p>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason (optional — shown to the org)"
                className="w-full px-3 py-1.5 rounded-md border border-black/12 text-small focus:outline-none focus:border-[#1b3a2d] focus:ring-2 focus:ring-[#1b3a2d]/12 transition mb-2"
              />
            </>
          )}
          {error && <div className="text-label text-[#b34334] mb-2" style={{ textTransform: "none", letterSpacing: "0", fontWeight: 400 }}>{error}</div>}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => { setConfirming(false); setError(null); }}
              disabled={busy}
              className="px-3 py-1.5 text-small rounded-md text-black/60 hover:bg-black/5 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => toggle(isSuspended ? "active" : "suspended", reason)}
              disabled={busy}
              className={`px-3 py-1.5 text-small rounded-md font-semibold transition ${
                isSuspended
                  ? "bg-[#1b3a2d] text-white hover:bg-[#2d5a40]"
                  : "bg-[#b34334] text-white hover:bg-[#c4543f]"
              }`}
            >
              {busy ? "Working…" : isSuspended ? "Reactivate" : "Suspend"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const active = status === "active";
  return (
    <span
      className="px-2 py-0.5 rounded-full text-label font-semibold"
      style={{
        background: active ? "rgba(45,90,64,0.15)" : "rgba(179,67,52,0.12)",
        color: active ? "#1b3a2d" : "#b34334",
        textTransform: "none",
        letterSpacing: "0.06em",
      }}
    >
      {status}
    </span>
  );
}
