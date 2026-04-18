"use client";

import { useMemo, useRef, useState } from "react";
import type { TagLite } from "./types";

// Autocomplete chip input. Free typing creates a tag on-the-fly via POST
// /api/property-tags (idempotent on org+name), so the user never has to
// pre-create a taxonomy. Existing org tags surface as suggestions.

export function TagInput({
  tagIds,
  onChange,
  allTags,
  setAllTags,
}: {
  tagIds: string[];
  onChange: (tagIds: string[]) => void;
  allTags: TagLite[];
  setAllTags: (tags: TagLite[]) => void;
}) {
  const [input, setInput] = useState("");
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => tagIds.map((id) => allTags.find((t) => t.id === id)).filter((t): t is TagLite => Boolean(t)),
    [tagIds, allTags],
  );

  const suggestions = useMemo(() => {
    const q = input.trim().toLowerCase();
    if (!q) return [];
    return allTags
      .filter((t) => !tagIds.includes(t.id) && t.name.toLowerCase().includes(q))
      .slice(0, 6);
  }, [input, allTags, tagIds]);

  const exactMatch = useMemo(
    () => allTags.find((t) => t.name.toLowerCase() === input.trim().toLowerCase()),
    [input, allTags],
  );

  const remove = (id: string) => onChange(tagIds.filter((t) => t !== id));

  const addExisting = (tag: TagLite) => {
    if (!tagIds.includes(tag.id)) onChange([...tagIds, tag.id]);
    setInput("");
    inputRef.current?.focus();
  };

  const createOrAdd = async () => {
    const name = input.trim();
    if (!name || creating) return;
    if (exactMatch) {
      addExisting(exactMatch);
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/property-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const tag = data.tag as TagLite;
      setAllTags([...allTags.filter((t) => t.id !== tag.id), tag].sort((a, b) => a.name.localeCompare(b.name)));
      onChange([...tagIds, tag.id]);
      setInput("");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="rounded-xl border border-black/10 bg-white p-2.5 focus-within:border-[#1b3a2d] focus-within:ring-2 focus-within:ring-[#1b3a2d]/12 transition">
      <div className="flex items-center gap-1.5 flex-wrap">
        {selected.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] bg-[#1b3a2d] text-white"
          >
            {tag.name}
            <button
              type="button"
              onClick={() => remove(tag.id)}
              className="text-white/70 hover:text-white text-base leading-none"
              aria-label={`Remove tag ${tag.name}`}
            >
              ×
            </button>
          </span>
        ))}
        <div className="relative flex-1 min-w-[120px]">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                createOrAdd();
              } else if (e.key === "Backspace" && input === "" && tagIds.length > 0) {
                onChange(tagIds.slice(0, -1));
              }
            }}
            placeholder={selected.length === 0 ? "Add a tag (e.g. luxury, family-friendly)" : "Add another…"}
            className="w-full px-1 py-1 text-sm bg-transparent outline-none placeholder:text-black/30"
          />
          {(suggestions.length > 0 || (input.trim() && !exactMatch)) && (
            <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-white border border-black/10 rounded-xl shadow-xl py-1 max-h-56 overflow-auto">
              {suggestions.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => addExisting(tag)}
                  className="block w-full text-left px-3 py-1.5 text-sm text-black/75 hover:bg-black/[0.04] transition"
                >
                  {tag.name}
                </button>
              ))}
              {input.trim() && !exactMatch && (
                <button
                  type="button"
                  onClick={createOrAdd}
                  disabled={creating}
                  className="block w-full text-left px-3 py-1.5 text-sm text-[#1b3a2d] font-medium hover:bg-black/[0.04] transition disabled:opacity-50"
                >
                  {creating ? "Creating…" : `+ Create "${input.trim()}"`}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
