"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";

// ─── Command palette ──────────────────────────────────────────────────────
//
// Cmd/Ctrl-K to open. Searches every entity in the org — clients,
// requests, proposals, reservations, properties — through /api/search
// and lets the operator jump anywhere with the keyboard. shadcn /
// Linear / Superhuman patterns:
//
//   ↑ / ↓     — move highlight
//   Enter     — open the highlighted result
//   Esc       — close
//   Cmd/Ctrl-K — toggle (open or close)
//
// Mounted once at the root layout (ClerkProvider's child) so any page
// can summon it. Inert when no user is signed in. The dashboard's
// search-icon button dispatches `ss:open-command-palette` to summon
// it without prop-drilling.

const TRIGGER_EVENT = "ss:open-command-palette";

// ── Types (mirror /api/search response) ───────────────────────────────

type ResultType = "client" | "request" | "proposal" | "reservation" | "property";

type SearchResult = {
  id: string;
  type: ResultType;
  title: string;
  subtitle: string;
  href: string;
  meta?: string;
};

type Groups = {
  clients: SearchResult[];
  requests: SearchResult[];
  proposals: SearchResult[];
  reservations: SearchResult[];
  properties: SearchResult[];
};

type SearchResponse = { q: string; results: Groups };

const TYPE_LABEL: Record<ResultType, string> = {
  client: "Client",
  request: "Request",
  proposal: "Proposal",
  reservation: "Reservation",
  property: "Property",
};

const TYPE_GROUP_LABEL: Record<keyof Groups, string> = {
  clients: "Clients",
  requests: "Requests",
  proposals: "Proposals",
  reservations: "Reservations",
  properties: "Properties",
};

// Stable group order for the rendered list.
const GROUP_ORDER: (keyof Groups)[] = [
  "clients",
  "requests",
  "proposals",
  "reservations",
  "properties",
];

// ─── Component ────────────────────────────────────────────────────────

export function CommandPalette() {
  const { isSignedIn } = useUser();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [data, setData] = useState<Groups | null>(null);
  const [loading, setLoading] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // ── Cmd/Ctrl-K toggle + custom-event opener ─────────────────────────
  useEffect(() => {
    if (!isSignedIn) return;
    const onKey = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey;
      if (isMeta && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onCustomEvent = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(TRIGGER_EVENT, onCustomEvent);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(TRIGGER_EVENT, onCustomEvent);
    };
  }, [isSignedIn]);

  // ── Reset state on open ─────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      setQuery("");
      setDebouncedQuery("");
      setHighlightIndex(0);
      setData(null);
      // Focus the input on the next tick — input renders after the open flips.
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // ── Debounce the query ──────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const handle = setTimeout(() => setDebouncedQuery(query.trim()), 140);
    return () => clearTimeout(handle);
  }, [query, open]);

  // ── Fetch on debounced query change ─────────────────────────────────
  useEffect(() => {
    if (!open) return;
    if (debouncedQuery.length < 2) {
      setData(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as SearchResponse;
        if (!cancelled) {
          setData(json.results);
          setHighlightIndex(0);
        }
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [debouncedQuery, open]);

  // ── Flatten results for keyboard navigation ─────────────────────────
  const flatResults = useMemo(() => {
    if (!data) return [] as SearchResult[];
    const out: SearchResult[] = [];
    for (const key of GROUP_ORDER) {
      for (const r of data[key]) out.push(r);
    }
    return out;
  }, [data]);

  // ── Keyboard nav inside the open palette ────────────────────────────
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIndex((i) => Math.min(i + 1, Math.max(0, flatResults.length - 1)));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "Enter") {
        const target = flatResults[highlightIndex];
        if (target) {
          e.preventDefault();
          openResult(target);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, flatResults, highlightIndex]);

  // Scroll highlighted item into view.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-result-index="${highlightIndex}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [highlightIndex]);

  const openResult = (r: SearchResult) => {
    setOpen(false);
    router.push(r.href);
  };

  if (!isSignedIn || !open) return null;

  const totalResults = flatResults.length;
  const showEmpty = !loading && debouncedQuery.length >= 2 && totalResults === 0;
  const showHint = !loading && debouncedQuery.length < 2;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      className="fixed inset-0 z-[1000] flex items-start justify-center px-4 pt-[12vh]"
      onClick={(e) => {
        // Click on the backdrop closes; clicks inside the panel are caught by stopPropagation below.
        if (e.target === e.currentTarget) setOpen(false);
      }}
      style={{
        background: "rgba(13,38,32,0.36)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        animation: "ss-cmdk-fade 140ms ease-out",
      }}
    >
      <div
        className="w-full max-w-[640px] rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: "white",
          boxShadow: "0 24px 60px -16px rgba(13,38,32,0.45), 0 0 0 1px rgba(13,38,32,0.06)",
          maxHeight: "min(70vh, 560px)",
          animation: "ss-cmdk-pop 160ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-5 border-b" style={{ borderColor: "rgba(13,38,32,0.06)" }}>
          <SearchIcon />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search clients, requests, proposals, reservations, properties…"
            className="flex-1 py-4 text-[14.5px] outline-none border-0 bg-transparent"
            style={{ color: "#0d2620" }}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
          />
          <Kbd>Esc</Kbd>
        </div>

        {/* Results / states */}
        <div ref={listRef} className="flex-1 overflow-y-auto">
          {loading && <LoadingState />}
          {showHint && <HintState />}
          {showEmpty && <EmptyState query={debouncedQuery} />}
          {!loading && data && totalResults > 0 && (
            <ResultsList
              groups={data}
              flatResults={flatResults}
              highlightIndex={highlightIndex}
              onPick={openResult}
              onHover={(i) => setHighlightIndex(i)}
            />
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-5 py-2.5 border-t text-[11px]"
          style={{ borderColor: "rgba(13,38,32,0.06)", color: "rgba(13,38,32,0.55)" }}
        >
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5"><Kbd>↑</Kbd><Kbd>↓</Kbd> navigate</span>
            <span className="flex items-center gap-1.5"><Kbd>↵</Kbd> open</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Kbd>{isMacLike() ? "⌘" : "Ctrl"}</Kbd>
            <Kbd>K</Kbd>
            <span>to toggle</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────

function ResultsList({
  groups, flatResults, highlightIndex, onPick, onHover,
}: {
  groups: Groups;
  flatResults: SearchResult[];
  highlightIndex: number;
  onPick: (r: SearchResult) => void;
  onHover: (idx: number) => void;
}) {
  let runningIdx = 0;
  return (
    <div className="py-1">
      {GROUP_ORDER.map((key) => {
        const items = groups[key];
        if (items.length === 0) return null;
        return (
          <div key={key} className="mt-1.5 first:mt-2">
            <div
              className="px-5 py-1.5 text-[10px] uppercase tracking-[0.22em] font-semibold"
              style={{ color: "rgba(13,38,32,0.45)" }}
            >
              {TYPE_GROUP_LABEL[key]}
            </div>
            <ul>
              {items.map((r) => {
                const idx = runningIdx;
                runningIdx += 1;
                const active = idx === highlightIndex;
                const flatRef = flatResults[idx];
                if (!flatRef || flatRef.id !== r.id) return null;
                return (
                  <li key={`${r.type}-${r.id}`}>
                    <button
                      type="button"
                      data-result-index={idx}
                      onClick={() => onPick(r)}
                      onMouseEnter={() => onHover(idx)}
                      className="w-full text-left flex items-center gap-3 px-5 py-2.5 transition"
                      style={{
                        background: active ? "rgba(27,58,45,0.07)" : "transparent",
                      }}
                    >
                      <TypeBadge type={r.type} />
                      <div className="flex-1 min-w-0">
                        <div
                          className="text-[13.5px] font-medium truncate"
                          style={{ color: "#0d2620" }}
                        >
                          {r.title}
                        </div>
                        <div
                          className="text-[11.5px] truncate mt-0.5"
                          style={{ color: "rgba(13,38,32,0.55)" }}
                        >
                          {r.subtitle}
                        </div>
                      </div>
                      {r.meta && (
                        <span
                          className="text-[10.5px] uppercase tracking-[0.16em] font-semibold px-1.5 py-0.5 rounded shrink-0"
                          style={{ background: "rgba(13,38,32,0.06)", color: "rgba(13,38,32,0.55)" }}
                        >
                          {r.meta}
                        </span>
                      )}
                      {active && (
                        <Kbd>↵</Kbd>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
      <div className="h-1.5" />
    </div>
  );
}

function TypeBadge({ type }: { type: ResultType }) {
  const palette: Record<ResultType, { bg: string; color: string; glyph: string }> = {
    client:      { bg: "rgba(27,58,45,0.08)",   color: "#1b3a2d", glyph: "👤" },
    request:     { bg: "rgba(217,119,6,0.10)",  color: "#92400e", glyph: "✉" },
    proposal:    { bg: "rgba(201,168,76,0.16)", color: "#7c5d11", glyph: "📄" },
    reservation: { bg: "rgba(22,163,74,0.10)",  color: "#166534", glyph: "✓" },
    property:    { bg: "rgba(27,58,45,0.08)",   color: "#1b3a2d", glyph: "⌂" },
  };
  const p = palette[type];
  return (
    <span
      className="shrink-0 inline-flex items-center justify-center text-[12px]"
      style={{
        width: 28, height: 28, borderRadius: 8,
        background: p.bg, color: p.color,
      }}
      aria-label={TYPE_LABEL[type]}
    >
      {p.glyph}
    </span>
  );
}

function LoadingState() {
  return (
    <div className="px-5 py-6">
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg animate-pulse" style={{ background: "rgba(13,38,32,0.06)" }} />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 rounded animate-pulse w-1/3" style={{ background: "rgba(13,38,32,0.06)" }} />
              <div className="h-2.5 rounded animate-pulse w-2/3" style={{ background: "rgba(13,38,32,0.06)" }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HintState() {
  return (
    <div className="px-5 py-10 text-center">
      <div className="text-[13px] font-medium" style={{ color: "rgba(13,38,32,0.65)" }}>
        Start typing to search
      </div>
      <div className="text-[11.5px] mt-1" style={{ color: "rgba(13,38,32,0.45)" }}>
        Clients · requests · proposals · reservations · properties
      </div>
    </div>
  );
}

function EmptyState({ query }: { query: string }) {
  return (
    <div className="px-5 py-10 text-center">
      <div className="text-[13px] font-medium" style={{ color: "rgba(13,38,32,0.65)" }}>
        No results found
      </div>
      <div className="text-[11.5px] mt-1" style={{ color: "rgba(13,38,32,0.45)" }}>
        Nothing matches “{query}” in this workspace.
      </div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center justify-center text-[10.5px] font-semibold tabular-nums"
      style={{
        minWidth: 18,
        height: 18,
        padding: "0 5px",
        borderRadius: 4,
        background: "rgba(13,38,32,0.06)",
        color: "rgba(13,38,32,0.65)",
        border: "1px solid rgba(13,38,32,0.08)",
        boxShadow: "inset 0 -1px 0 rgba(13,38,32,0.06)",
      }}
    >
      {children}
    </span>
  );
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="rgba(13,38,32,0.45)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <circle cx="8" cy="8" r="5" />
      <path d="M11.5 11.5 L15 15" />
    </svg>
  );
}

function isMacLike(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPod|iPhone|iPad/.test(navigator.platform);
}

// Static helper exposed so other components can summon the palette
// without importing CommandPalette directly.
export function openCommandPalette() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(TRIGGER_EVENT));
}
