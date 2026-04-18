"use client";

import { useEffect, useState } from "react";

// Operator side of the comment system. Bell-icon toggle in the editor
// toolbar that opens a right-side drawer listing every comment, newest
// first. Each comment can be replied to inline, marked resolved, or
// deleted. Lightweight: no realtime, no @mentions, no editing — the
// goal is "I can see and clear what clients sent me".

type Comment = {
  id: string;
  body: string;
  authorName: string | null;
  authorEmail: string | null;
  authorIsOperator: boolean;
  status: string;
  createdAt: string;
};

export function CommentsDrawer({ proposalId }: { proposalId: string }) {
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [openCount, setOpenCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/proposals/${proposalId}/comments`, { cache: "no-store" });
      if (res.status === 409) { window.location.href = "/select-organization"; return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const list: Comment[] = data.comments ?? [];
      setComments(list.slice().reverse()); // newest first in the drawer
      setOpenCount(list.filter((c) => c.status === "open" && !c.authorIsOperator).length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  // Initial open-count load (cheap — used for the badge).
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposalId]);

  const setStatus = async (commentId: string, status: "open" | "resolved") => {
    const previous = comments;
    setComments(comments.map((c) => (c.id === commentId ? { ...c, status } : c)));
    const res = await fetch(`/api/proposals/${proposalId}/comments/${commentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      setComments(previous); // rollback
    } else {
      // re-tally
      setOpenCount(comments.filter((c) => c.id !== commentId && c.status === "open" && !c.authorIsOperator).length
        + (status === "open" ? 1 : 0));
    }
  };

  const deleteComment = async (commentId: string) => {
    const previous = comments;
    setComments(comments.filter((c) => c.id !== commentId));
    const res = await fetch(`/api/proposals/${proposalId}/comments/${commentId}`, { method: "DELETE" });
    if (!res.ok) setComments(previous);
  };

  const submitReply = async () => {
    if (submitting || replyBody.trim().length === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/proposals/${proposalId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: replyBody.trim() }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setReplyBody("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reply");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Toolbar trigger */}
      <button
        type="button"
        onClick={() => { setOpen(true); refresh(); }}
        className="relative px-2.5 py-1.5 text-sm border border-black/12 rounded-lg hover:bg-black/5 text-black/65 transition active:scale-95"
        title={openCount && openCount > 0 ? `${openCount} open ${openCount === 1 ? "note" : "notes"}` : "Client notes"}
      >
        <span className="text-base leading-none">✎</span>
        {openCount !== null && openCount > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center tabular-nums"
            style={{ background: "#c9a84c", color: "#1b3a2d" }}
          >
            {openCount}
          </span>
        )}
      </button>

      {/* Drawer + scrim */}
      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30 ss-fade-in"
            onClick={() => setOpen(false)}
          />
          <aside
            className="fixed top-0 right-0 bottom-0 z-50 w-[min(420px,100vw)] bg-white border-l border-black/10 shadow-2xl flex flex-col ss-popover-in"
            role="dialog"
            aria-label="Client notes"
          >
            <header className="px-5 py-4 border-b border-black/8 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-black/85">Client notes</h2>
                <p className="text-[12px] text-black/45 mt-0.5">
                  Everything left on the share link.
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-black/40 hover:text-black/70 text-xl leading-none px-2"
                aria-label="Close"
              >
                ×
              </button>
            </header>

            <div className="flex-1 overflow-auto p-4 space-y-3">
              {loading && (
                <div className="text-center text-sm text-black/40 py-8">Loading…</div>
              )}
              {!loading && error && (
                <div className="text-center text-sm text-[#b34334] py-4">{error}</div>
              )}
              {!loading && !error && comments.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-sm text-black/55">No notes yet.</p>
                  <p className="text-[12px] text-black/40 mt-1">
                    Clients can leave a note from the share link.
                  </p>
                </div>
              )}
              {!loading && comments.map((c) => (
                <CommentRow
                  key={c.id}
                  comment={c}
                  onResolve={() => setStatus(c.id, "resolved")}
                  onReopen={() => setStatus(c.id, "open")}
                  onDelete={() => deleteComment(c.id)}
                />
              ))}
            </div>

            {/* Reply composer */}
            <div className="px-4 py-3 border-t border-black/8 space-y-2">
              <textarea
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                rows={2}
                maxLength={4000}
                placeholder="Reply to clients…"
                className="w-full px-2.5 py-2 rounded-lg border border-black/10 text-[13px] focus:outline-none focus:border-[#1b3a2d] focus:ring-2 focus:ring-[#1b3a2d]/12 transition resize-y"
              />
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-black/35">
                  Visible on the share link.
                </span>
                <button
                  onClick={submitReply}
                  disabled={submitting || replyBody.trim().length === 0}
                  className="px-3 py-1.5 rounded-lg bg-[#1b3a2d] text-white text-[12px] font-semibold hover:bg-[#2d5a40] active:scale-95 transition disabled:opacity-50"
                >
                  {submitting ? "Sending…" : "Reply"}
                </button>
              </div>
            </div>
          </aside>
        </>
      )}
    </>
  );
}

function CommentRow({
  comment,
  onResolve,
  onReopen,
  onDelete,
}: {
  comment: Comment;
  onResolve: () => void;
  onReopen: () => void;
  onDelete: () => void;
}) {
  const isOp = comment.authorIsOperator;
  const author = comment.authorName ?? (isOp ? "You" : "Client");
  const resolved = comment.status === "resolved";

  return (
    <div
      className={`rounded-xl border p-3 ${
        resolved
          ? "border-black/8 bg-black/[0.02] opacity-70"
          : "border-black/10 bg-white"
      }`}
    >
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className={`text-[12px] font-semibold ${isOp ? "text-[#1b3a2d]" : "text-black/85"}`}>
            {author}
          </span>
          {comment.authorEmail && !isOp && (
            <a
              href={`mailto:${comment.authorEmail}`}
              className="text-[11px] text-black/40 hover:text-[#1b3a2d] truncate"
              title={comment.authorEmail}
            >
              {comment.authorEmail}
            </a>
          )}
        </div>
        <span className="text-[11px] text-black/35 shrink-0">
          {formatTime(comment.createdAt)}
        </span>
      </div>
      <div className="text-[13px] text-black/80 leading-relaxed whitespace-pre-wrap break-words">
        {comment.body}
      </div>
      <div className="mt-2 flex items-center gap-1">
        {resolved ? (
          <button
            onClick={onReopen}
            className="px-2 py-0.5 text-[11px] rounded-md text-black/55 hover:bg-black/[0.05] transition"
          >
            Reopen
          </button>
        ) : (
          !isOp && (
            <button
              onClick={onResolve}
              className="px-2 py-0.5 text-[11px] rounded-md text-[#1b3a2d] hover:bg-[#1b3a2d]/[0.07] transition font-medium"
            >
              Mark resolved
            </button>
          )
        )}
        <button
          onClick={onDelete}
          className="px-2 py-0.5 text-[11px] rounded-md text-black/40 hover:text-[#b34334] hover:bg-[#b34334]/[0.05] transition ml-auto"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
