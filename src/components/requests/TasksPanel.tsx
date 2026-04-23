"use client";

import { useCallback, useEffect, useState } from "react";

// Tasks list + inline add form. Renders inside the request detail's
// right rail when the operator switches to the "Tasks" tab. Keeps its
// own state — doesn't couple to the parent's request payload.

type Task = {
  id: string;
  title: string;
  notes: string | null;
  dueAt: string | null;
  doneAt: string | null;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

export function TasksPanel({ requestId }: { requestId: string }) {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newDueAt, setNewDueAt] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/requests/${requestId}/tasks`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTasks(data.tasks as Task[]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    }
  }, [requestId]);

  useEffect(() => { load(); }, [load]);

  const addTask = async () => {
    const title = newTitle.trim();
    if (!title) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch(`/api/requests/${requestId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, dueAt: newDueAt || null }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? `HTTP ${res.status}`);
      }
      setNewTitle("");
      setNewDueAt("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add task");
    } finally {
      setAdding(false);
    }
  };

  const toggleDone = async (t: Task) => {
    try {
      const res = await fetch(`/api/requests/${requestId}/tasks/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: !t.doneAt }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  };

  const remove = async (t: Task) => {
    if (!confirm(`Delete "${t.title}"?`)) return;
    try {
      const res = await fetch(`/api/requests/${requestId}/tasks/${t.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const openTasks = tasks?.filter((t) => !t.doneAt) ?? [];
  const doneTasks = tasks?.filter((t) => t.doneAt) ?? [];

  return (
    <>
      {/* Add form */}
      <div className="p-4 border-b border-black/5 shrink-0 space-y-2">
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addTask(); } }}
          placeholder="Add a task…"
          className="w-full px-3 py-2 rounded border border-black/12 text-[13px] outline-none focus:border-[#1b3a2d]"
        />
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={newDueAt}
            onChange={(e) => setNewDueAt(e.target.value)}
            className="flex-1 px-2 py-1.5 rounded border border-black/12 text-[12px] outline-none focus:border-[#1b3a2d]"
            title="Due date (optional)"
          />
          <button
            type="button"
            onClick={addTask}
            disabled={adding || !newTitle.trim()}
            className="text-[12px] px-3 py-1.5 rounded-full font-medium text-white disabled:opacity-50"
            style={{ background: "#1b3a2d" }}
          >
            {adding ? "Adding…" : "Add"}
          </button>
        </div>
        {error && (
          <div className="text-[11.5px] text-[#b34334]">{error}</div>
        )}
      </div>

      {/* List */}
      <div className="overflow-y-auto flex-1">
        {tasks === null ? (
          <div className="p-5 space-y-2">
            {[0, 1, 2].map((i) => <div key={i} className="h-9 rounded bg-black/5 animate-pulse" />)}
          </div>
        ) : (openTasks.length === 0 && doneTasks.length === 0) ? (
          <div className="p-6 text-center text-[12.5px] text-black/45">No tasks yet.</div>
        ) : (
          <>
            {openTasks.length > 0 && (
              <ul className="divide-y divide-black/5">
                {openTasks.map((t) => (
                  <TaskRow key={t.id} task={t} onToggle={() => toggleDone(t)} onDelete={() => remove(t)} />
                ))}
              </ul>
            )}
            {doneTasks.length > 0 && (
              <>
                <div className="px-5 pt-4 pb-1 text-[9.5px] uppercase tracking-[0.24em] font-semibold text-black/40 border-t border-black/5">
                  Done · {doneTasks.length}
                </div>
                <ul className="divide-y divide-black/5">
                  {doneTasks.map((t) => (
                    <TaskRow key={t.id} task={t} onToggle={() => toggleDone(t)} onDelete={() => remove(t)} />
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}

function TaskRow({ task, onToggle, onDelete }: { task: Task; onToggle: () => void; onDelete: () => void }) {
  const done = Boolean(task.doneAt);
  const overdue = !done && task.dueAt && new Date(task.dueAt).getTime() < Date.now();
  return (
    <li className="px-5 py-2.5 flex items-start gap-3 group">
      <button
        type="button"
        onClick={onToggle}
        className="mt-[3px] shrink-0 w-4 h-4 rounded border flex items-center justify-center transition"
        style={{
          borderColor: done ? "#1b3a2d" : "rgba(0,0,0,0.3)",
          background: done ? "#1b3a2d" : "transparent",
        }}
        title={done ? "Mark open" : "Mark done"}
      >
        {done && <span className="text-white text-[10px] leading-none">✓</span>}
      </button>
      <div className="flex-1 min-w-0">
        <div
          className="text-[13px] break-words"
          style={{
            color: done ? "rgba(0,0,0,0.4)" : "rgba(0,0,0,0.85)",
            textDecoration: done ? "line-through" : "none",
          }}
        >
          {task.title}
        </div>
        {task.dueAt && (
          <div
            className="text-[10.5px] tabular-nums mt-0.5"
            style={{ color: overdue ? "#b34334" : "rgba(0,0,0,0.45)" }}
          >
            {overdue ? "⚠ overdue · " : "due "}{formatDue(task.dueAt)}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onDelete}
        className="text-[11px] text-black/30 hover:text-[#b34334] opacity-0 group-hover:opacity-100 transition"
        title="Delete"
      >
        ✕
      </button>
    </li>
  );
}

function formatDue(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "tomorrow";
  if (diffDays === -1) return "yesterday";
  if (diffDays > 0 && diffDays < 7) return `in ${diffDays} days`;
  if (diffDays < 0 && diffDays > -7) return `${-diffDays} days ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
