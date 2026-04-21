"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AppHeader } from "@/components/properties/AppHeader";

// Settings → Lead Sources
//
// Admin/owner-only page to manage the per-org source taxonomy the New
// Request form's dropdown is populated from. The default seed (Safari-
// Bookings, TripAdvisor, Website, Referral, …) lands on org creation so
// this page is usually "add your own channels on top".

type LeadSource = {
  id: string;
  name: string;
  sortOrder: number;
  archived: boolean;
};

export function LeadSourcesSettingsPage() {
  const [sources, setSources] = useState<LeadSource[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/lead-sources", { cache: "no-store" });
      if (res.status === 401) { window.location.href = "/sign-in"; return; }
      if (res.status === 409) { window.location.href = "/select-organization"; return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSources(data.sources as LeadSource[]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const add = async () => {
    const name = newName.trim();
    if (!name) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/lead-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.status === 403) throw new Error("Only admins can add sources");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? `HTTP ${res.status}`);
      }
      setNewName("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add");
    } finally {
      setAdding(false);
    }
  };

  const patchSource = async (id: string, patch: Partial<LeadSource>) => {
    try {
      const res = await fetch(`/api/lead-sources/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? `HTTP ${res.status}`);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  };

  const remove = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? Past requests keep their source attribution; removing just hides it from future dropdowns.`)) return;
    try {
      const res = await fetch(`/api/lead-sources/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? `HTTP ${res.status}`);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const saveRename = async () => {
    if (!editingId) return;
    const name = editingValue.trim();
    if (!name) { setEditingId(null); return; }
    await patchSource(editingId, { name });
    setEditingId(null);
  };

  return (
    <div className="min-h-screen bg-[#f8f5ef]">
      <AppHeader />
      <main className="max-w-3xl mx-auto px-6 py-10 md:py-12">
        <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
          <div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-black/50">Settings</div>
            <h1 className="mt-2 text-[30px] md:text-[36px] font-bold tracking-tight text-black/85" style={{ fontFamily: "'Playfair Display', serif" }}>
              Lead sources
            </h1>
            <p className="mt-2 text-[14px] text-black/55 max-w-xl">
              Where your requests come from. Shown in the New Request dropdown and in analytics
              so you know which channels convert.
            </p>
          </div>
          <Link href="/settings/profile" className="text-[12px] text-black/45 hover:text-[#1b3a2d]">
            Your profile →
          </Link>
        </div>

        {error && (
          <div className="mb-5 rounded-xl border border-[#b34334]/30 bg-[#b34334]/5 p-3 text-[13px] text-[#b34334]">
            {error}
          </div>
        )}

        {/* Add form */}
        <div className="bg-white rounded-2xl border border-black/8 p-4 mb-5 flex items-center gap-3">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") add(); }}
            placeholder="Add a source — e.g. Expedia, WTM London, Partner network"
            className="flex-1 px-3 py-2 rounded border border-black/10 text-[13.5px] outline-none focus:border-[#1b3a2d]"
          />
          <button
            type="button"
            onClick={add}
            disabled={adding || !newName.trim()}
            className="text-[12.5px] font-medium text-white px-4 py-2 rounded-full disabled:opacity-50"
            style={{ background: "#1b3a2d" }}
          >
            {adding ? "Adding…" : "Add"}
          </button>
        </div>

        {/* List */}
        <section className="bg-white rounded-2xl border border-black/8 overflow-hidden">
          {sources === null ? (
            <div className="p-5 space-y-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="h-10 rounded-lg bg-black/5 animate-pulse" />
              ))}
            </div>
          ) : sources.length === 0 ? (
            <div className="p-10 text-center text-[13px] text-black/45">
              No lead sources yet. Add your first one above.
            </div>
          ) : (
            <ul className="divide-y divide-black/5">
              {sources.map((s) => (
                <li key={s.id} className="px-5 py-3 flex items-center gap-3">
                  {editingId === s.id ? (
                    <input
                      autoFocus
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      onBlur={saveRename}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveRename();
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="flex-1 px-2 py-1 rounded border border-[#1b3a2d]/40 text-[14px] outline-none"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(s.id);
                        setEditingValue(s.name);
                      }}
                      className="flex-1 text-left text-[14px] text-black/85 hover:text-[#1b3a2d] transition"
                      title="Click to rename"
                    >
                      {s.name}
                    </button>
                  )}

                  {s.archived && (
                    <span className="text-[9.5px] uppercase tracking-[0.22em] px-1.5 py-0.5 rounded font-semibold"
                      style={{ background: "rgba(0,0,0,0.06)", color: "rgba(0,0,0,0.5)" }}
                    >
                      Archived
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => patchSource(s.id, { archived: !s.archived })}
                    className="text-[11.5px] text-black/45 hover:text-[#1b3a2d]"
                  >
                    {s.archived ? "Restore" : "Archive"}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(s.id, s.name)}
                    className="text-[11.5px] text-black/45 hover:text-[#b34334]"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="mt-6 text-[11.5px] text-black/45">
          Renaming a source updates the dropdown but doesn&apos;t rename historical requests —
          those keep the name they were filed under.
        </div>
      </main>
    </div>
  );
}
