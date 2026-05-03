"use client";

import { useEffect, useState } from "react";

// FollowUpDialog — small modal showing an AI-drafted follow-up for a
// proposal. Operator reviews, optionally edits, then copies or hands
// off to WhatsApp / email. No automatic send — every dispatch is a
// manual click that opens the operator's own client.

type Channel = "whatsapp" | "email";

type Props = {
  proposalId: string;
  clientName: string | null;
  clientPhone?: string | null;
  clientEmail?: string | null;
  onClose: () => void;
};

export function FollowUpDialog({
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

  const fetchDraft = async (chan: Channel) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/follow-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId, channel: chan }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : `HTTP ${res.status}`);
      }
      setDraft(typeof data.draft === "string" ? data.draft : "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't generate the draft.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void fetchDraft(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ESC closes.
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

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(draft);
    } catch {
      /* swallow — environment without clipboard API */
    }
  };

  const handleOpenWhatsApp = () => {
    const phone = (clientPhone || "").replace(/[^\d+]/g, "").replace(/^\+/, "");
    if (!phone) return;
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(draft)}`;
    window.open(url, "_blank");
  };

  const handleOpenEmail = () => {
    if (!clientEmail) return;
    // For email mode, the model returns "Subject: ...\n\nbody". Split it.
    const m = /^subject:\s*([^\n]+)\n\n([\s\S]+)$/i.exec(draft);
    const subject = m?.[1]?.trim() || "Following up on your safari proposal";
    const body = m?.[2]?.trim() || draft;
    const url = `mailto:${encodeURIComponent(clientEmail)}?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body)}`;
    window.open(url, "_self");
  };

  const canWhatsApp = Boolean(clientPhone) && channel === "whatsapp";
  const canEmail = Boolean(clientEmail) && channel === "email";

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-end md:items-center justify-center p-0 md:p-6"
      style={{ background: "rgba(20,20,20,0.55)" }}
      onClick={onClose}
    >
      <div
        className="w-full md:max-w-[620px] max-h-[92vh] overflow-y-auto rounded-t-2xl md:rounded-2xl shadow-2xl"
        style={{ background: "#F7F3E8", color: "#0a1411" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between gap-3 px-5 md:px-7 pt-5 pb-3"
          style={{ borderBottom: "1px solid rgba(0,0,0,0.10)" }}
        >
          <div className="min-w-0">
            <div
              className="text-[10.5px] uppercase tracking-[0.28em] font-semibold"
              style={{ color: "rgba(10,20,17,0.55)" }}
            >
              Safari Studio AI · Draft follow-up
            </div>
            <h2
              className="font-bold leading-[1.1] mt-0.5 truncate"
              style={{
                color: "#0a1411",
                fontFamily: "'Playfair Display', Georgia, serif",
                fontSize: "1.35rem",
                letterSpacing: "-0.005em",
              }}
            >
              {clientName ? `For ${clientName}` : "Follow-up draft"}
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

        {/* Body */}
        <div className="px-5 md:px-7 py-5 space-y-4">
          {/* Channel toggle */}
          <div className="flex items-center gap-1 p-1 rounded-md w-max" style={{ background: "rgba(0,0,0,0.05)" }}>
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
              rows={Math.min(14, Math.max(6, draft.split(/\n/).length + 1))}
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
            Drafted by Safari Studio AI · review and send manually.
          </p>
        </div>

        {/* Footer actions */}
        <div
          className="px-5 md:px-7 pb-5 pt-3 flex items-center justify-between gap-3 flex-wrap"
          style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void fetchDraft(channel)}
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
            <button
              type="button"
              onClick={handleCopy}
              disabled={!draft || busy}
              className="px-3 h-9 rounded-md text-[12.5px] font-semibold disabled:opacity-50"
              style={{
                background: "transparent",
                color: "#0a1411",
                border: "1px solid rgba(0,0,0,0.16)",
              }}
            >
              Copy
            </button>
          </div>
          <div className="flex items-center gap-2">
            {channel === "whatsapp" && (
              <button
                type="button"
                onClick={handleOpenWhatsApp}
                disabled={!canWhatsApp || busy || !draft}
                className="px-4 h-9 rounded-md text-[13px] font-semibold disabled:opacity-50 active:scale-[0.97]"
                style={{ background: "#1b3a2d", color: "#ffffff" }}
              >
                Open in WhatsApp →
              </button>
            )}
            {channel === "email" && (
              <button
                type="button"
                onClick={handleOpenEmail}
                disabled={!canEmail || busy || !draft}
                className="px-4 h-9 rounded-md text-[13px] font-semibold disabled:opacity-50 active:scale-[0.97]"
                style={{ background: "#1b3a2d", color: "#ffffff" }}
              >
                Open in Email →
              </button>
            )}
          </div>
        </div>
      </div>
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
