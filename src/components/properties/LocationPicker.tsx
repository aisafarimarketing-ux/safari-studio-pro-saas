"use client";

import { useState } from "react";
import type { LocationLite } from "./types";

// Combobox: select an existing location from the org or inline-create
// a new one. New locations POST to /api/locations (idempotent on
// org+name) and are appended to the in-memory list.

export function LocationPicker({
  value,
  onChange,
  locations,
  setLocations,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  locations: LocationLite[];
  setLocations: (locs: LocationLite[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: "", country: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    if (busy) return;
    const name = draft.name.trim();
    if (!name) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, country: draft.country.trim() || undefined }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const loc = data.location as LocationLite;
      setLocations(
        [...locations.filter((l) => l.id !== loc.id), loc].sort((a, b) =>
          (a.country ?? "").localeCompare(b.country ?? "") || a.name.localeCompare(b.name),
        ),
      );
      onChange(loc.id);
      setAdding(false);
      setDraft({ name: "", country: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create location");
    } finally {
      setBusy(false);
    }
  };

  if (adding) {
    return (
      <div className="rounded-xl border border-black/10 bg-white p-3 space-y-2">
        <input
          autoFocus
          type="text"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          placeholder="Location name (e.g. Masai Mara)"
          className="w-full px-3 py-1.5 rounded-lg border border-black/12 text-sm focus:outline-none focus:border-[#1b3a2d] focus:ring-2 focus:ring-[#1b3a2d]/12 transition"
        />
        <input
          type="text"
          value={draft.country}
          onChange={(e) => setDraft({ ...draft, country: e.target.value })}
          placeholder="Country (optional)"
          className="w-full px-3 py-1.5 rounded-lg border border-black/12 text-sm focus:outline-none focus:border-[#1b3a2d] focus:ring-2 focus:ring-[#1b3a2d]/12 transition"
        />
        {error && <div className="text-[12px] text-[#b34334]">{error}</div>}
        <div className="flex items-center gap-2 justify-end">
          <button
            type="button"
            onClick={() => { setAdding(false); setError(null); }}
            disabled={busy}
            className="px-3 py-1.5 text-sm rounded-lg text-black/55 hover:bg-black/5 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={create}
            disabled={busy || !draft.name.trim()}
            className="px-3 py-1.5 text-sm rounded-lg bg-[#1b3a2d] text-white font-medium hover:bg-[#2d5a40] active:scale-95 transition disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="flex-1 px-3 py-2 rounded-lg border border-black/12 bg-white text-sm text-black/85 focus:outline-none focus:border-[#1b3a2d] focus:ring-2 focus:ring-[#1b3a2d]/12 transition"
      >
        <option value="">— Select a location —</option>
        {locations.map((l) => (
          <option key={l.id} value={l.id}>
            {l.country ? `${l.name} · ${l.country}` : l.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => setAdding(true)}
        className="px-3 py-2 text-sm rounded-lg border border-black/12 text-black/65 hover:bg-black/5 transition shrink-0"
      >
        + New
      </button>
    </div>
  );
}
