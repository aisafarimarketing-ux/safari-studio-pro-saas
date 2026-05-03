"use client";

import { useEffect, useRef, useState } from "react";
import {
  ACTION_LABEL,
  MOMENTUM_COLORS,
  MOMENTUM_ICON,
  MOMENTUM_LABEL,
  type DealMomentum,
  type SuggestedAction,
} from "@/lib/dealMomentum";
import { fireToast } from "./Toast";

// FollowUpPanel — Deal Momentum's edit surface. Slide-out from the
// right edge (not a modal — modals interrupt; the panel sits next to
// the dashboard so the operator can still see the rest of the queue).
//
// Open path: dashboard fires window CustomEvent "ss:openFollowUp" with
// the deal context. The panel auto-fetches /api/ai/auto-draft (cached
// when the row is fresh) so the draft is on-screen instantly, then
// offers Send / Copy WhatsApp / Copy Email actions.

type Channel = "whatsapp" | "email";

type Props = {
  proposalId: string;
  clientName: string | null;
  clientPhone: string | null;
  clientEmail: string | null;
  onClose: () => void;
};

export function FollowUpPanel({
  proposalId,
  clientName,
  clientPhone,
  clientEmail,
  onClose,
}: Props) {
  const [channel, setChannel] = useState<Channel>(
    clientPhone ? "whatsapp" : "email",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<string>("");
  const [suggestionId, setSuggestionId] = useState<string | null>(null);
  const [momentum, setMomentum] = useState<DealMomentum | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [action, setAction] = useState<SuggestedAction | null>(null);
  // Track the latest fetch so a stale response never overwrites a
  // newer one when the operator quickly toggles channels.
  const reqSeq = useRef(0);

  const fetchDraft = async (chan: Channel, opts?: { force?: boolean }) => {
    const seq = ++reqSeq.current;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/auto-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposalId,
          channel: chan,
          force: opts?.force ?? false,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : `HTTP ${res.status}`);
      }
      if (seq !== reqSeq.current) return; // stale response — ignore
      setDraft(typeof data.draft === "string" ? data.draft : "");
      setSuggestionId(typeof data.suggestionId === "string" ? data.suggestionId : null);
      setMomentum(typeof data.momentum === "string" ? (data.momentum as DealMomentum) : null);
      setReason(typeof data.momentumReason === "string" ? data.momentumReason : null);
      setAction(
        typeof data.suggestedAction === "string" ? (data.suggestedAction as SuggestedAction) : null,
      );
    } catch (err) {
      if (seq !== reqSeq.current) return;
      setError(err instanceof Error ? err.message : "Couldn't generate the draft.");
    } finally {
      if (seq === reqSeq.current) setBusy(false);
    }
  };

  useEffect(() => {
    void fetchDraft(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const switchChannel = (next: Channel) => {
    if (next === channel || busy) return;
    setChannel(next);
    void fetchDraft(next);
  };

  const handleCopyAll = async () => {
    try {
      await navigator.clipboard.writeText(draft);
      fireToast({ message: "Copied to clipboard." });
    } catch {
      /* swallow */
    }
  };

  const handleCopyEmailParts = async () => {
    if (!draft) return;
    const parts = parseEmail(draft);
    const both = `Subject: ${parts.subject}\n\n${parts.body}`;
    try {
      await navigator.clipboard.writeText(both);
      fireToast({
        message: "Copied subject + body.",
        hint: "Paste into your email client.",
      });
    } catch {
      /* swallow */
    }
  };

  const recordSent = async (chan: Channel) => {
    if (!suggestionId) return;
    try {
      await fetch(`/api/suggestions/${suggestionId}/sent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: chan, text: draft }),
      });
    } catch {
      /* best-effort — toast still fires */
    }
  };

  const undoSent = async () => {
    if (!suggestionId) return;
    try {
      await fetch(`/api/suggestions/${suggestionId}/sent`, { method: "DELETE" });
    } catch {
      /* swallow */
    }
  };

  const handleSendWhatsApp = () => {
    const phone = (clientPhone || "").replace(/[^\d+]/g, "").replace(/^\+/, "");
    if (!phone || !draft) return;
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(draft)}`;
    window.open(url, "_blank");
    void recordSent("whatsapp");
    fireToast({
      message: "Opened in WhatsApp — send when ready.",
      hint: "Likely response window: 1–3h.",
      onUndo: () => void undoSent(),
    });
    onClose();
  };

  const handleSendEmail = () => {
    if (!clientEmail || !draft) return;
    const parts = parseEmail(draft);
    const url = `mailto:${encodeURIComponent(clientEmail)}?subject=${encodeURIComponent(
      parts.subject,
    )}&body=${encodeURIComponent(parts.body)}`;
    window.open(url, "_self");
    void recordSent("email");
    fireToast({
      message: "Opened in your email client.",
      hint: "Confirm the send there.",
      onUndo: () => void undoSent(),
    });
    onClose();
  };

  const colors = momentum ? MOMENTUM_COLORS[momentum] : MOMENTUM_COLORS.WARM;

  return (
    <div
      className="fixed inset-0 z-[1000] flex justify-end"
      style={{ background: "rgba(20,20,20,0.45)" }}
      onClick={onClose}
    >
      <aside
        className="h-full w-full md:w-[440px] flex flex-col shadow-2xl"
        style={{
          background: "#F7F3E8",
          color: "#0a1411",
          borderLeft: "1px solid rgba(0,0,0,0.10)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-start justify-between gap-3 px-5 py-4"
          style={{ borderBottom: "1px solid rgba(0,0,0,0.10)" }}
        >
          <div className="min-w-0">
            <div
              className="text-[10.5px] uppercase tracking-[0.28em] font-semibold"
              style={{ color: "rgba(10,20,17,0.55)" }}
            >
              Safari Studio AI · Follow-up
            </div>
            <h2
              className="font-bold leading-[1.1] mt-0.5 truncate"
              style={{
                color: "#0a1411",
                fontFamily: "'Playfair Display', Georgia, serif",
                fontSize: "1.3rem",
                letterSpacing: "-0.005em",
              }}
            >
              {clientName || "Follow-up draft"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-2xl leading-none transition hover:opacity-75 shrink-0"
            style={{ color: "rgba(10,20,17,0.55)" }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Status block — momentum + reason + suggested action */}
        {momentum && (
          <div
            className="px-5 py-3 flex flex-col gap-1"
            style={{
              background: colors.bg,
              borderBottom: "1px solid rgba(0,0,0,0.06)",
            }}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="text-[10.5px] uppercase tracking-[0.18em] font-bold px-2 py-0.5 rounded"
                style={{ background: colors.accent, color: "#fff" }}
              >
                {MOMENTUM_ICON[momentum]} {MOMENTUM_LABEL[momentum]}
              </span>
              {action && (
                <span
                  className="text-[11.5px] font-semibold"
                  style={{ color: colors.fg }}
                >
                  {ACTION_LABEL[action]}
                </span>
              )}
            </div>
            {reason && (
              <p className="text-[12px]" style={{ color: colors.fg, opacity: 0.85 }}>
                {reason}
              </p>
            )}
            <p className="text-[11px] mt-1" style={{ color: "rgba(10,20,17,0.55)" }}>
              <strong style={{ color: "#0a1411" }}>Why this works:</strong>{" "}
              {explainAction(action, momentum)}
            </p>
          </div>
        )}

        {/* Channel toggle + body */}
        <div className="px-5 py-4 flex-1 overflow-y-auto space-y-3">
          <div
            className="flex items-center gap-1 p-1 rounded-md w-max"
            style={{ background: "rgba(0,0,0,0.05)" }}
          >
            <ChannelTab
              active={channel === "whatsapp"}
              disabled={busy}
              onClick={() => switchChannel("whatsapp")}
              label="WhatsApp"
            />
            <ChannelTab
              active={channel === "email"}
              disabled={busy}
              onClick={() => switchChannel("email")}
              label="Email"
            />
          </div>

          {error && (
            <div
              className="rounded-lg p-3 text-[13px]"
              style={{
                background: "rgba(179,67,52,0.08)",
                color: "#b34334",
                border: "1px solid rgba(179,67,52,0.22)",
              }}
            >
              {error}
            </div>
          )}

          {busy && !draft ? (
            <div className="space-y-2">
              <div className="h-3 rounded animate-pulse" style={{ background: "rgba(0,0,0,0.08)" }} />
              <div className="h-3 rounded animate-pulse" style={{ background: "rgba(0,0,0,0.08)" }} />
              <div className="h-3 w-2/3 rounded animate-pulse" style={{ background: "rgba(0,0,0,0.08)" }} />
            </div>
          ) : (
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={Math.min(16, Math.max(8, draft.split(/\n/).length + 1))}
              className="w-full text-[14px] leading-[1.6] rounded-lg p-3 outline-none resize-y"
              style={{
                background: "#ffffff",
                border: "1px solid rgba(0,0,0,0.16)",
                color: "#0a1411",
                fontFamily: "inherit",
              }}
              spellCheck
            />
          )}

          <p className="text-[11.5px]" style={{ color: "rgba(10,20,17,0.55)" }}>
            Drafted by Safari Studio AI · review before sending.
          </p>
        </div>

        {/* Footer — Send / Copy / Regenerate */}
        <div
          className="px-5 py-3 flex items-center justify-between gap-2 flex-wrap"
          style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void fetchDraft(channel, { force: true })}
              disabled={busy}
              className="px-3 h-9 rounded-md text-[12.5px] font-semibold disabled:opacity-50"
              style={{
                background: "transparent",
                color: "#0a1411",
                border: "1px solid rgba(0,0,0,0.16)",
              }}
            >
              {busy ? "Drafting…" : "Regenerate"}
            </button>
            {channel === "whatsapp" ? (
              <button
                type="button"
                onClick={handleCopyAll}
                disabled={!draft || busy}
                className="px-3 h-9 rounded-md text-[12.5px] font-semibold disabled:opacity-50"
                style={{
                  background: "transparent",
                  color: "#0a1411",
                  border: "1px solid rgba(0,0,0,0.16)",
                }}
              >
                Copy WhatsApp
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCopyEmailParts}
                disabled={!draft || busy}
                className="px-3 h-9 rounded-md text-[12.5px] font-semibold disabled:opacity-50"
                style={{
                  background: "transparent",
                  color: "#0a1411",
                  border: "1px solid rgba(0,0,0,0.16)",
                }}
              >
                Copy Email
              </button>
            )}
          </div>
          {channel === "whatsapp" ? (
            <button
              type="button"
              onClick={handleSendWhatsApp}
              disabled={!clientPhone || !draft || busy}
              className="px-4 h-9 rounded-md text-[13px] font-semibold disabled:opacity-50 active:scale-[0.97]"
              style={{ background: "#1b3a2d", color: "#ffffff" }}
            >
              Send via WhatsApp →
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSendEmail}
              disabled={!clientEmail || !draft || busy}
              className="px-4 h-9 rounded-md text-[13px] font-semibold disabled:opacity-50 active:scale-[0.97]"
              style={{ background: "#1b3a2d", color: "#ffffff" }}
            >
              Send via Email →
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}

function ChannelTab({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="px-3 h-7 rounded text-[12px] font-semibold transition disabled:opacity-50"
      style={{
        background: active ? "#ffffff" : "transparent",
        color: active ? "#0a1411" : "rgba(10,20,17,0.55)",
        boxShadow: active ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
      }}
    >
      {label}
    </button>
  );
}

function parseEmail(draft: string): { subject: string; body: string } {
  const m = /^subject:\s*([^\n]+)\n\n([\s\S]+)$/i.exec(draft);
  const subject = m?.[1]?.trim() || "Following up on your safari proposal";
  const body = m?.[2]?.trim() || draft;
  return { subject, body };
}

function explainAction(
  action: SuggestedAction | null,
  momentum: DealMomentum | null,
): string {
  if (!action) return "—";
  if (action === "SEND_NOW") {
    if (momentum === "VERY_HOT") return "Engagement is fresh — strike while attention is on the proposal.";
    if (momentum === "COOLING") return "Activity has slowed — a single targeted message often re-opens the conversation.";
    if (momentum === "COLD") return "Deal has gone quiet — a short re-engagement note resets the conversation without pressure.";
    return "Deal needs a nudge to keep moving.";
  }
  if (action === "ASK_QUESTION") {
    return "They've reached a decision moment (pricing or reservation). A question feels less pushy than a sell.";
  }
  return "Recent activity already in motion — give the client time to reply before pinging again.";
}
