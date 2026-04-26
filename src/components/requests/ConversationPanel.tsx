"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─── Conversation panel ────────────────────────────────────────────────────
//
// Chat-style thread inside the Request detail right rail. Reads from
// /api/requests/:id/messages (our DB only — GHL is just transport).
// Polls every 8s while mounted so inbound replies show up without a
// hard reload. Composer at the bottom; channel selector defaults to
// the most recent inbound channel, falls back to email.

const FOREST = "#1b3a2d";
const FOREST_DK = "#172E20";

type Channel = "email" | "sms" | "whatsapp";

type Message = {
  id: string;
  direction: "inbound" | "outbound";
  channel: string;
  subject: string | null;
  body: string;
  status: string;
  createdAt: string;
  readAt: string | null;
};

type Props = {
  requestId: string;
  clientId: string | null;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
};

export function ConversationPanel({
  requestId,
  clientId,
  clientName,
  clientEmail,
  clientPhone,
}: Props) {
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [channel, setChannel] = useState<Channel>("email");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // ── Load + poll ────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/requests/${requestId}/messages`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { messages: Message[] };
      setMessages(data.messages);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load messages");
    }
  }, [requestId]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
  }, [load]);

  // Auto-scroll to bottom on new messages.
  useEffect(() => {
    if (!messages?.length) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages?.length]);

  // ── Default channel: latest inbound channel, fallback to email ─────────
  useEffect(() => {
    if (!messages?.length) return;
    const lastInbound = [...messages]
      .reverse()
      .find((m) => m.direction === "inbound");
    if (lastInbound && (lastInbound.channel === "sms" || lastInbound.channel === "whatsapp" || lastInbound.channel === "email")) {
      setChannel(lastInbound.channel as Channel);
    }
    // Don't override if the user has interacted with the selector — but
    // we don't track that here for simplicity; the effect runs once per
    // message-count change and the user's selection survives subsequent
    // polls because the dependency is only `messages.length`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages?.length]);

  // ── Send ───────────────────────────────────────────────────────────────
  const send = async () => {
    if (!body.trim() || sending) return;
    if (!clientId) {
      setSendError("This request has no linked client.");
      return;
    }
    if (channel === "email" && !subject.trim()) {
      setSendError("Subject is required for email.");
      return;
    }
    setSending(true);
    setSendError(null);

    // Optimistic row — appears instantly while the server call runs.
    const optimistic: Message = {
      id: `temp-${Date.now()}`,
      direction: "outbound",
      channel,
      subject: channel === "email" ? subject : null,
      body,
      status: "draft",
      createdAt: new Date().toISOString(),
      readAt: null,
    };
    setMessages((prev) => (prev ? [...prev, optimistic] : [optimistic]));
    const previousBody = body;
    const previousSubject = subject;
    setBody("");
    if (channel === "email") setSubject("");

    try {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId,
          clientId,
          channel,
          subject: channel === "email" ? previousSubject : undefined,
          body: previousBody,
        }),
      });
      const data = (await res.json()) as { message?: Message; error?: string };
      if (!res.ok && !data.message) throw new Error(data.error || `HTTP ${res.status}`);
      // Replace optimistic with server-truth row.
      setMessages((prev) =>
        (prev ?? []).map((m) => (m.id === optimistic.id ? data.message ?? m : m)),
      );
      if (data.error) setSendError(data.error);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Send failed";
      setSendError(msg);
      // Mark the optimistic row as failed so the user sees the failure
      // inline. They can copy the body and retry.
      setMessages((prev) =>
        (prev ?? []).map((m) =>
          m.id === optimistic.id ? { ...m, status: "failed" } : m,
        ),
      );
      // Restore the composer body for retry.
      setBody(previousBody);
      if (channel === "email") setSubject(previousSubject);
    } finally {
      setSending(false);
    }
  };

  // ── Retry a failed message ─────────────────────────────────────────────
  const retry = async (message: Message) => {
    setBody(message.body);
    if (message.channel === "email") {
      setSubject(message.subject ?? "");
      setChannel("email");
    } else if (message.channel === "sms" || message.channel === "whatsapp") {
      setChannel(message.channel);
    }
    // Operator clicks Send again — easy and obvious.
  };

  // ── Render ─────────────────────────────────────────────────────────────
  const grouped = groupByDate(messages ?? []);
  const canEmail = !!clientEmail;
  const canPhoneChannel = !!clientPhone;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Thread */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {messages === null ? (
          <ThreadSkeleton />
        ) : loadError ? (
          <div className="text-[12.5px] text-red-600 text-center py-6">{loadError}</div>
        ) : messages.length === 0 ? (
          <EmptyState clientName={clientName} />
        ) : (
          grouped.map((group) => (
            <div key={group.label}>
              <div className="flex items-center gap-2 my-3">
                <div className="flex-1 h-px bg-black/8" />
                <span className="text-[10.5px] uppercase tracking-[0.22em] font-semibold text-black/40">
                  {group.label}
                </span>
                <div className="flex-1 h-px bg-black/8" />
              </div>
              <div className="space-y-2">
                {group.messages.map((m) => (
                  <Bubble key={m.id} message={m} onRetry={() => retry(m)} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-black/8 p-3 bg-white shrink-0">
        {/* Channel + subject row */}
        <div className="flex items-center gap-2 mb-2">
          <ChannelChip
            value="email"
            current={channel}
            onClick={() => setChannel("email")}
            disabled={!canEmail}
          />
          <ChannelChip
            value="sms"
            current={channel}
            onClick={() => setChannel("sms")}
            disabled={!canPhoneChannel}
          />
          <ChannelChip
            value="whatsapp"
            current={channel}
            onClick={() => setChannel("whatsapp")}
            disabled={!canPhoneChannel}
          />
          <div className="ml-auto text-[10.5px] text-black/40">
            {channel === "email"
              ? clientEmail
              : channel === "sms" || channel === "whatsapp"
                ? clientPhone
                : ""}
          </div>
        </div>
        {channel === "email" && (
          <input
            type="text"
            placeholder="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={sending}
            className="w-full mb-2 px-3 py-2 rounded-lg border border-black/12 text-[13px] outline-none focus:border-[#1b3a2d]"
          />
        )}
        <div className="flex items-end gap-2">
          <textarea
            rows={3}
            placeholder={`Message ${clientName.split(" ")[0] || clientName}…`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={sending}
            onKeyDown={(e) => {
              // Cmd/Ctrl-Enter sends.
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                void send();
              }
            }}
            style={{ minHeight: 48 }}
            className="flex-1 px-3 py-2.5 rounded-xl border border-black/12 text-[13.5px] outline-none focus:border-[#1b3a2d] resize-y shadow-sm"
          />
          <button
            type="button"
            onClick={send}
            disabled={!body.trim() || sending}
            className="shrink-0 h-[48px] px-5 rounded-xl text-[13.5px] font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: !body.trim() || sending
                ? "linear-gradient(180deg, #4a6b58, #3a5644)"
                : `linear-gradient(180deg, ${FOREST}, ${FOREST_DK})`,
              boxShadow: "0 4px 12px rgba(27,58,45,0.22)",
            }}
            onMouseEnter={(e) => {
              if (!sending && body.trim()) e.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
        {sendError && (
          <div className="mt-2 text-[11.5px] text-red-600">{sendError}</div>
        )}
      </div>
    </div>
  );
}

// ─── Bubble ────────────────────────────────────────────────────────────────

function Bubble({ message, onRetry }: { message: Message; onRetry: () => void }) {
  const outbound = message.direction === "outbound";
  const failed = message.status === "failed";
  const sending = message.status === "draft" && message.id.startsWith("temp-");
  return (
    <div className={`flex ${outbound ? "justify-end" : "justify-start"}`}>
      <div className="max-w-[78%]">
        {message.subject && (
          <div className={`text-[10.5px] uppercase tracking-[0.18em] font-semibold mb-1 ${outbound ? "text-right text-black/45" : "text-black/45"}`}>
            {message.subject}
          </div>
        )}
        <div
          className="px-3.5 py-2.5 rounded-2xl text-[13.5px] leading-[1.45] whitespace-pre-wrap break-words"
          style={
            outbound
              ? {
                  background: failed ? "#fee" : `linear-gradient(180deg, #1b3a2d, #16302a)`,
                  color: failed ? "#7a1a1a" : "white",
                  borderBottomRightRadius: 6,
                  border: failed ? "1px solid #f0b0b0" : "none",
                }
              : {
                  background: "white",
                  color: "rgba(0,0,0,0.85)",
                  borderBottomLeftRadius: 6,
                  border: "1px solid rgba(0,0,0,0.08)",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                }
          }
        >
          {message.body}
        </div>
        <div
          className={`mt-1 text-[10.5px] flex items-center gap-1.5 ${outbound ? "justify-end" : "justify-start"}`}
          style={{ color: "rgba(0,0,0,0.4)" }}
        >
          <span className="uppercase tracking-[0.18em] font-semibold">{message.channel}</span>
          <span>·</span>
          <span>{formatTime(message.createdAt)}</span>
          {sending && <span className="text-[#1b3a2d]/70">· sending…</span>}
          {failed && (
            <>
              <span>·</span>
              <span className="text-red-600 font-semibold">failed</span>
              <button
                type="button"
                onClick={onRetry}
                className="text-[#1b3a2d] font-semibold underline underline-offset-2 ml-1"
              >
                Retry
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Channel chip ──────────────────────────────────────────────────────────

function ChannelChip({
  value,
  current,
  onClick,
  disabled,
}: {
  value: Channel;
  current: Channel;
  onClick: () => void;
  disabled: boolean;
}) {
  const active = current === value;
  const label = value === "email" ? "Email" : value === "sms" ? "SMS" : "WhatsApp";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabled ? "Client has no contact info for this channel" : `Switch to ${label}`}
      className="text-[11px] font-semibold px-2.5 py-1 rounded-full transition disabled:opacity-30 disabled:cursor-not-allowed"
      style={{
        background: active ? "#1b3a2d" : "transparent",
        color: active ? "white" : "rgba(0,0,0,0.55)",
        border: `1px solid ${active ? "#1b3a2d" : "rgba(0,0,0,0.15)"}`,
        letterSpacing: "0.06em",
      }}
    >
      {label}
    </button>
  );
}

// ─── Empty state + skeleton ────────────────────────────────────────────────

function EmptyState({ clientName }: { clientName: string }) {
  return (
    <div className="text-center py-10">
      <div className="text-[24px] mb-2" aria-hidden>💬</div>
      <div className="text-[13px] font-semibold text-black/70">No messages yet</div>
      <div className="text-[11.5px] text-black/45 mt-1">
        Start the conversation with {clientName.split(" ")[0] || clientName}.
      </div>
    </div>
  );
}

function ThreadSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"}`}>
          <div
            className="h-12 w-2/3 rounded-2xl animate-pulse"
            style={{ background: "rgba(0,0,0,0.06)" }}
          />
        </div>
      ))}
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function groupByDate(messages: Message[]): { label: string; messages: Message[] }[] {
  const groups = new Map<string, Message[]>();
  for (const m of messages) {
    const label = formatDateGroup(m.createdAt);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(m);
  }
  return Array.from(groups.entries()).map(([label, messages]) => ({ label, messages }));
}

function formatDateGroup(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const todayKey = now.toDateString();
  const yesterdayKey = new Date(now.getTime() - 86_400_000).toDateString();
  if (d.toDateString() === todayKey) return "Today";
  if (d.toDateString() === yesterdayKey) return "Yesterday";
  // Same year — drop year for compactness.
  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
