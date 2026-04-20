"use client";

import { useEffect, useState } from "react";
import { useProposalStore } from "@/store/proposalStore";

// ─── Public comment panel ───────────────────────────────────────────────────
//
// Floating bottom-right widget on the /p/[id] share view. Lets the client
// leave a note ("Can we change this camp?", "Move day 4 to Amboseli")
// without signing in. Captures name + email at submission so the operator
// can reply by their preferred channel.
//
// Lightweight by design: a single thread, no @mentions, no rich text, no
// per-section anchoring in v1 (the API supports it; the UI exposes it
// later). The whole point is "client can talk to operator without leaving
// the proposal".

type PublicComment = {
  id: string;
  body: string;
  authorName: string | null;
  authorIsOperator: boolean;
  status: string;
  createdAt: string;
};

const NAME_KEY = "ss-comment-author-name";
const EMAIL_KEY = "ss-comment-author-email";

export function CommentPanel({ proposalId }: { proposalId: string }) {
  // Read the theme so the floating launcher matches the proposal's brand
  // colours and never visually "disappears" against a dark section like
  // the closing-farewell variant.
  const accent = useProposalStore((s) => s.proposal.theme.tokens.accent);
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<PublicComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restore name/email from local storage so returning visitors don't re-type.
  const [authorName, setAuthorName] = useState(() => {
    if (typeof window === "undefined") return "";
    try { return localStorage.getItem(NAME_KEY) ?? ""; } catch { return ""; }
  });
  const [authorEmail, setAuthorEmail] = useState(() => {
    if (typeof window === "undefined") return "";
    try { return localStorage.getItem(EMAIL_KEY) ?? ""; } catch { return ""; }
  });
  const [body, setBody] = useState("");

  // Open the panel and pre-fill the composer when another part of the page
  // dispatches ss:prefillComment — e.g. the "Request in comments" button on
  // an optional activity. Event-based wiring keeps coupling loose.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ message?: string }>).detail;
      if (!detail?.message) return;
      setOpen(true);
      const msg = detail.message;
      setBody((prev) => (prev.trim() ? prev + "\n\n" + msg : msg));
      // Give the textarea a tick to mount before focusing it.
      setTimeout(() => {
        document.querySelector<HTMLTextAreaElement>('textarea[placeholder="Type a note…"]')?.focus();
      }, 60);
    };
    window.addEventListener("ss:prefillComment", handler as EventListener);
    return () => window.removeEventListener("ss:prefillComment", handler as EventListener);
  }, []);

  // Load comments on first open. We don't poll — re-open to refresh, or
  // the operator can refresh the share link to see the latest.
  useEffect(() => {
    if (!open || comments.length > 0) return;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/public/proposals/${proposalId}/comments`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setComments(data.comments ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load notes");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, comments.length, proposalId]);

  const submit = async () => {
    if (submitting || body.trim().length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/proposals/${proposalId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: body.trim(),
          authorName: authorName.trim() || undefined,
          authorEmail: authorEmail.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setComments((prev) => [...prev, data.comment]);
      setBody("");
      // Persist identity for next visit.
      try {
        if (authorName.trim()) localStorage.setItem(NAME_KEY, authorName.trim());
        if (authorEmail.trim()) localStorage.setItem(EMAIL_KEY, authorEmail.trim());
      } catch {}
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send note");
    } finally {
      setSubmitting(false);
    }
  };

  const openCount = comments.filter((c) => c.status === "open").length;

  return (
    <>
      {/* Floating launcher — white pill with an accent ring + icon so it
          pops against any proposal background (light or dark). */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-[60] px-4 h-12 rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.28)] text-sm font-semibold flex items-center gap-2 transition active:scale-95 hover:shadow-[0_14px_36px_rgba(0,0,0,0.34)] bg-white"
        style={{ color: accent, border: `2px solid ${accent}` }}
        aria-label="Open notes"
      >
        <span className="text-base leading-none">✎</span>
        <span>{open ? "Close notes" : openCount > 0 ? `Notes (${openCount})` : "Chat with us"}</span>
      </button>

      {/* Panel */}
      {open && (
        <div
          className="fixed bottom-24 right-6 z-[60] w-[min(380px,calc(100vw-3rem))] max-h-[70vh] bg-white rounded-2xl shadow-2xl border border-black/10 flex flex-col ss-popover-in"
          role="dialog"
          aria-label="Notes"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-black/8">
            <h3 className="text-[14px] font-semibold text-black/85">Notes for the operator</h3>
            <p className="text-[12px] text-black/50 mt-0.5">
              Anything you&apos;d like changed — a camp, a date, a tier — leave a note here.
            </p>
          </div>

          {/* Thread */}
          <div className="flex-1 overflow-auto px-4 py-3 space-y-3">
            {loading && <div className="text-center text-[13px] text-black/40 py-6">Loading…</div>}
            {!loading && comments.length === 0 && (
              <div className="text-center text-[13px] text-black/45 py-6">
                No notes yet. Yours will be the first.
              </div>
            )}
            {comments.map((c) => (
              <CommentBubble key={c.id} comment={c} />
            ))}
          </div>

          {/* Composer */}
          <div className="px-4 py-3 border-t border-black/8 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="Your name (optional)"
                className="px-2.5 py-1.5 rounded-lg border border-black/10 text-[12px] focus:outline-none focus:border-[#1b3a2d] focus:ring-2 focus:ring-[#1b3a2d]/12 transition"
              />
              <input
                type="email"
                value={authorEmail}
                onChange={(e) => setAuthorEmail(e.target.value)}
                placeholder="Email (optional)"
                className="px-2.5 py-1.5 rounded-lg border border-black/10 text-[12px] focus:outline-none focus:border-[#1b3a2d] focus:ring-2 focus:ring-[#1b3a2d]/12 transition"
              />
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              maxLength={4000}
              placeholder="Type a note…"
              className="w-full px-2.5 py-2 rounded-lg border border-black/10 text-[13px] focus:outline-none focus:border-[#1b3a2d] focus:ring-2 focus:ring-[#1b3a2d]/12 transition resize-y"
            />
            {error && <div className="text-[12px] text-[#b34334]">{error}</div>}
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-black/35">
                Goes straight to the operator.
              </span>
              <button
                onClick={submit}
                disabled={submitting || body.trim().length === 0}
                className="px-3 py-1.5 rounded-lg bg-[#1b3a2d] text-white text-[12px] font-semibold hover:bg-[#2d5a40] active:scale-95 transition disabled:opacity-50"
              >
                {submitting ? "Sending…" : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function CommentBubble({ comment }: { comment: PublicComment }) {
  const isOp = comment.authorIsOperator;
  const author = isOp ? (comment.authorName ?? "Operator") : (comment.authorName ?? "You");
  return (
    <div className={`flex ${isOp ? "justify-start" : "justify-end"}`}>
      <div className={`max-w-[85%] rounded-2xl px-3 py-2 ${
        isOp
          ? "bg-black/[0.05] text-black/80 rounded-bl-sm"
          : "bg-[#1b3a2d] text-white rounded-br-sm"
      }`}>
        <div className={`text-[10px] uppercase tracking-wider font-semibold mb-0.5 ${
          isOp ? "text-black/45" : "text-white/60"
        }`}>
          {author} {comment.status === "resolved" && "· resolved"}
        </div>
        <div className="text-[13px] leading-relaxed whitespace-pre-wrap break-words">
          {comment.body}
        </div>
        <div className={`text-[10px] mt-1 ${isOp ? "text-black/35" : "text-white/45"}`}>
          {formatTime(comment.createdAt)}
        </div>
      </div>
    </div>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
