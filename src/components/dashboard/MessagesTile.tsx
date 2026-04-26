"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useDashboardTheme } from "./DashboardTheme";

// ─── Messages tile ─────────────────────────────────────────────────────────
//
// Lightweight inbox surface on the dashboard. Reads from
// /api/messages/inbox (our DB only — never directly from GHL). Shows the
// unread badge, the last 5 inbound messages with client + preview + time,
// and links each row to its associated Request thread.
//
// Polls every 12s while mounted so a fresh reply surfaces without a
// full-page reload — same cadence the rest of the workspace uses.

type InboxMessage = {
  id: string;
  channel: string;
  subject: string | null;
  body: string;
  createdAt: string;
  readAt: string | null;
  client: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  } | null;
  request: {
    id: string;
    referenceNumber: string | null;
    status: string;
  } | null;
};

type InboxResponse = {
  unreadCount: number;
  messages: InboxMessage[];
};

export function MessagesTile() {
  const { tokens } = useDashboardTheme();
  const [data, setData] = useState<InboxResponse | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/messages/inbox?limit=5", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as InboxResponse;
        if (!cancelled) {
          setData(json);
          setLoadFailed(false);
        }
      } catch {
        if (!cancelled) setLoadFailed(true);
      }
    };
    void load();
    const interval = setInterval(load, 12_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const messages = data?.messages ?? [];
  const unread = data?.unreadCount ?? 0;

  return (
    <div
      className="rounded-2xl p-5 flex flex-col h-full"
      style={{
        background: tokens.tileBg,
        boxShadow: `inset 0 0 0 1px ${tokens.ring}, ${tokens.shadow}`,
      }}
    >
      {/* Header */}
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <div
          className="text-[10px] uppercase tracking-[0.28em] font-semibold"
          style={{ color: tokens.muted }}
        >
          Messages
        </div>
        {unread > 0 && (
          <span
            className="text-[10.5px] font-semibold tabular-nums px-2 py-0.5 rounded-full"
            style={{ background: tokens.primarySoft, color: tokens.primary }}
          >
            {unread} unread
          </span>
        )}
      </div>

      {/* Body */}
      {data === null && !loadFailed ? (
        <Skeleton ringColor={tokens.ring} />
      ) : loadFailed ? (
        <div className="text-[12px]" style={{ color: tokens.muted }}>
          Couldn&apos;t load messages.
        </div>
      ) : messages.length === 0 ? (
        <div>
          <div className="text-[14px] font-medium" style={{ color: tokens.heading }}>
            No messages yet.
          </div>
          <div className="text-[11.5px] mt-0.5" style={{ color: tokens.muted }}>
            Inbound replies from clients land here.
          </div>
        </div>
      ) : (
        <ul className="space-y-2.5 flex-1">
          {messages.map((m) => {
            const clientName = formatClientName(m.client);
            const isUnread = !m.readAt;
            const requestHref = m.request ? `/requests/${m.request.id}` : "#";
            return (
              <li key={m.id}>
                <Link
                  href={requestHref}
                  className="group flex items-start gap-2.5 -mx-2 px-2 py-1.5 rounded-lg transition"
                  style={{ background: "transparent" }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = tokens.ring;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  {/* Unread dot */}
                  <div
                    className="mt-1.5 shrink-0 rounded-full"
                    style={{
                      width: 6,
                      height: 6,
                      background: isUnread ? tokens.primary : "transparent",
                      border: isUnread ? "none" : `1px solid ${tokens.ring}`,
                    }}
                    aria-hidden
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span
                        className="text-[12.5px] font-semibold truncate"
                        style={{
                          color: isUnread ? tokens.heading : tokens.muted,
                        }}
                      >
                        {clientName}
                      </span>
                      <span
                        className="text-[10px] uppercase tracking-[0.18em] shrink-0"
                        style={{ color: tokens.muted }}
                      >
                        {m.channel}
                      </span>
                      <span
                        className="text-[10.5px] ml-auto shrink-0 tabular-nums"
                        style={{ color: tokens.muted }}
                      >
                        {formatRelative(m.createdAt)}
                      </span>
                    </div>
                    <div
                      className="text-[11.5px] truncate mt-0.5"
                      style={{ color: tokens.muted }}
                    >
                      {m.subject ? <span className="font-medium">{m.subject} · </span> : null}
                      {m.body}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Skeleton({ ringColor }: { ringColor: string }) {
  return (
    <div className="space-y-2.5">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-start gap-2.5">
          <div className="mt-1.5 w-1.5 h-1.5 rounded-full" style={{ background: ringColor }} />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 rounded animate-pulse w-1/2" style={{ background: ringColor }} />
            <div className="h-2.5 rounded animate-pulse w-4/5" style={{ background: ringColor }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function formatClientName(client: InboxMessage["client"]): string {
  if (!client) return "Unknown";
  const full = [client.firstName, client.lastName].filter(Boolean).join(" ").trim();
  return full || client.email;
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();
  if (diff < 60_000) return "now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
