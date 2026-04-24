"use client";

import { useState } from "react";
import type { DepositConfig } from "@/lib/types";

// ─── DepositPayButton ──────────────────────────────────────────────────────
//
// Client-facing affordance on /p/[id]. Rendered only when the operator
// has enabled depositConfig on the proposal. Click opens a modal that
// collects name + email (+ terms consent when termsUrl is set), POSTs
// to /api/public/proposals/[id]/deposit/init, and redirects the client
// to the Paystack hosted checkout. On return they land at
// /p/[id]/deposit-success with the reference in the query string.

const FOREST = "#1b3a2d";
const GOLD = "#c9a84c";

export function DepositPayButton({
  proposalId,
  config,
  accent,
}: {
  proposalId: string;
  config: DepositConfig;
  accent?: string;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const termsRequired = Boolean(config.termsUrl);
  const canSubmit =
    email.trim().length > 3 && (!termsRequired || agreed) && !busy;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/proposals/${proposalId}/deposit/init`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payerName: name.trim() || undefined,
          payerEmail: email.trim(),
          termsAccepted: agreed,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "Could not start payment. Please retry.");
        setBusy(false);
        return;
      }
      const data = (await res.json()) as { authorizationUrl: string };
      window.location.href = data.authorizationUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error.");
      setBusy(false);
    }
  };

  const accentColor = accent ?? GOLD;

  return (
    <>
      <div className="my-10 mx-auto max-w-[900px] px-6">
        <div
          className="rounded-2xl border p-6 md:p-8 text-center"
          style={{
            background: "rgba(201,168,76,0.06)",
            borderColor: "rgba(201,168,76,0.45)",
          }}
        >
          <div
            className="text-[11px] uppercase tracking-[0.24em] font-semibold"
            style={{ color: FOREST }}
          >
            Secure your booking
          </div>
          <h3
            className="mt-3 text-2xl md:text-3xl font-bold tracking-tight"
            style={{ fontFamily: "'Playfair Display', Georgia, serif", color: FOREST }}
          >
            Pay your deposit · {config.currency} {config.amount}
          </h3>
          {config.description && (
            <p className="mt-3 text-[14px] max-w-xl mx-auto text-black/65 leading-relaxed">
              {config.description}
            </p>
          )}
          <button
            onClick={() => setOpen(true)}
            className="mt-6 px-7 py-3.5 rounded-xl text-[15px] font-semibold transition hover:brightness-110 active:scale-95"
            style={{ background: accentColor, color: FOREST }}
          >
            Pay deposit →
          </button>
          <div className="mt-3 text-[11.5px] text-black/45">
            Secure payment via Paystack · card, M-Pesa, bank transfer
          </div>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => { if (!busy) setOpen(false); }}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden ss-modal-in">
            <header className="px-6 py-5 border-b" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
              <div className="text-[10.5px] uppercase tracking-[0.22em] font-semibold" style={{ color: FOREST }}>
                Deposit
              </div>
              <h3
                className="text-lg font-bold text-black/85 mt-1"
                style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
              >
                Pay {config.currency} {config.amount}
              </h3>
            </header>
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-3.5">
              <label className="block">
                <span className="block text-[12px] text-black/55 mb-1">Your name</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Optional — appears on the receipt"
                  className="w-full px-3.5 py-2.5 border rounded-lg text-[14px] focus:outline-none focus:border-[#1b3a2d]"
                  style={{ borderColor: "rgba(0,0,0,0.12)" }}
                  disabled={busy}
                />
              </label>
              <label className="block">
                <span className="block text-[12px] text-black/55 mb-1">Email address *</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-3.5 py-2.5 border rounded-lg text-[14px] focus:outline-none focus:border-[#1b3a2d]"
                  style={{ borderColor: "rgba(0,0,0,0.12)" }}
                  disabled={busy}
                />
                <span className="block mt-1 text-[11.5px] text-black/45">
                  We send the receipt here. No marketing email — promise.
                </span>
              </label>

              {termsRequired && config.termsUrl && (
                <label className="flex items-start gap-2.5 text-[13px] text-black/70 pt-1">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="mt-0.5"
                    disabled={busy}
                  />
                  <span>
                    I have read and agree to the{" "}
                    <a
                      href={config.termsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                      style={{ color: FOREST }}
                    >
                      terms and conditions
                    </a>
                    .
                  </span>
                </label>
              )}

              {error && (
                <div className="rounded-lg px-3 py-2 text-[13px] text-[#7a2e23] bg-[#f4d7d0] border border-[#e3b5ac]">
                  {error}
                </div>
              )}
            </form>
            <div
              className="px-6 py-4 border-t flex items-center justify-end gap-2"
              style={{ borderColor: "rgba(0,0,0,0.08)" }}
            >
              <button
                onClick={() => { if (!busy) setOpen(false); }}
                className="px-4 py-2 text-[13.5px] rounded-lg text-black/60 hover:bg-black/5 transition"
                disabled={busy}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="px-5 py-2 text-[13.5px] rounded-lg font-semibold transition active:scale-95 disabled:opacity-60"
                style={{ background: accentColor, color: FOREST }}
              >
                {busy ? "Redirecting…" : "Pay with Paystack →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
