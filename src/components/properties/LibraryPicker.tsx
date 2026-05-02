"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Property as ProposalProperty } from "@/lib/types";
import { MEAL_PLANS, classLabel } from "@/lib/properties";

// Picker modal: select one or many library properties to drop into a
// proposal. Selection emits *snapshots* (Partial<Property>) — the parent
// pushes them onto the proposal via addPropertyFromLibrary so the proposal
// stays stable if the library entry is later edited.

type LocationLite = { id: string; name: string; country: string | null };
type TagLite = { id: string; name: string };
type LibraryProperty = {
  id: string;
  name: string;
  propertyClass: string | null;
  shortSummary?: string | null;
  whatMakesSpecial?: string | null;
  whyWeChoose?: string | null;
  amenities?: string[];
  mealPlan?: string | null;
  suggestedNights?: number | null;
  funFactsVisible?: boolean | null;
  location: LocationLite | null;
  images: { id: string; url: string }[];
  tags: { tag: TagLite }[];
  _count: { images: number };
};

export function LibraryPicker({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (snapshots: Partial<ProposalProperty>[]) => void;
}) {
  const [properties, setProperties] = useState<LibraryProperty[]>([]);
  // signals carries Brand DNA explanation pills when sortMode === "smart"
  const [signals, setSignals] = useState<Map<string, string[]>>(new Map());
  const [locations, setLocations] = useState<LocationLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<"recent" | "smart">("recent");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    setSelected(new Set());
    (async () => {
      try {
        const locsP = fetch("/api/locations", { cache: "no-store" });

        if (sortMode === "smart") {
          // Server-side ranking — applies Brand DNA preferences + biases.
          const [rankRes, locRes] = await Promise.all([
            fetch("/api/properties/rank", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                locationId: locationFilter ?? undefined,
                limit: 50,
              }),
            }),
            locsP,
          ]);
          if (!rankRes.ok) throw new Error(`HTTP ${rankRes.status}`);
          const [rankData, locData] = await Promise.all([rankRes.json(), locRes.json()]);
          type Ranked = { property: LibraryProperty; matchedSignals: string[] };
          const ranked: Ranked[] = rankData.ranked ?? [];
          setProperties(ranked.map((r) => r.property));
          setSignals(new Map(ranked.map((r) => [r.property.id, r.matchedSignals])));
          setLocations(locData.locations ?? []);
        } else {
          const [propRes, locRes] = await Promise.all([
            fetch("/api/properties", { cache: "no-store" }),
            locsP,
          ]);
          if (!propRes.ok) throw new Error(`HTTP ${propRes.status}`);
          const [propData, locData] = await Promise.all([propRes.json(), locRes.json()]);
          // List API returns cover-only; we re-fetch full payloads on Insert.
          setProperties(propData.properties ?? []);
          setSignals(new Map());
          setLocations(locData.locations ?? []);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load library");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, sortMode, locationFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return properties.filter((p) => {
      if (locationFilter && p.location?.id !== locationFilter) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [properties, search, locationFilter]);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const insert = async () => {
    if (selected.size === 0) return;

    // For multi-select we need each property's full image list to populate
    // galleryUrls. Fetch the full payloads in parallel — small loads and the
    // user is willing to wait for the click they just made.
    const fulls = await Promise.all(
      Array.from(selected).map(async (id) => {
        try {
          const res = await fetch(`/api/properties/${id}`);
          if (!res.ok) return null;
          const data = await res.json();
          return data.property as LibraryProperty & {
            images: { id: string; url: string; isCover: boolean; order: number }[];
          };
        } catch {
          return null;
        }
      }),
    );

    const snapshots: Partial<ProposalProperty>[] = fulls
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
      .map((p) => snapshotFromLibrary(p));

    onSelect(snapshots);
    onClose();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 ss-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col ss-modal-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-black/8 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-black/85">Browse my properties</h2>
            <p className="text-[12px] text-black/45 mt-0.5">
              Selections are snapshotted into the proposal — later edits to the
              library won&apos;t change this proposal.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-black/40 hover:text-black/70 text-xl leading-none px-2"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Filters */}
        <div className="px-5 py-3 border-b border-black/8 flex items-center gap-2 flex-wrap">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search properties…"
            className="px-3 py-1.5 rounded-lg border border-black/12 text-sm w-56 focus:outline-none focus:border-[#1b3a2d] focus:ring-2 focus:ring-[#1b3a2d]/12 transition"
          />
          <select
            value={locationFilter ?? ""}
            onChange={(e) => setLocationFilter(e.target.value || null)}
            className="px-3 py-1.5 rounded-lg border border-black/12 text-sm bg-white text-black/65 focus:outline-none focus:border-[#1b3a2d] focus:ring-2 focus:ring-[#1b3a2d]/12 transition"
          >
            <option value="">All locations</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.country ? `${l.name} · ${l.country}` : l.name}
              </option>
            ))}
          </select>

          {/* Sort mode — Recent (default) vs Smart (Brand-DNA-aware ranking). */}
          <div className="ml-auto inline-flex items-center gap-0.5 bg-black/[0.05] rounded-lg p-0.5">
            <SortChip active={sortMode === "recent"} onClick={() => setSortMode("recent")}>
              Recent
            </SortChip>
            <SortChip
              active={sortMode === "smart"}
              onClick={() => setSortMode("smart")}
              accent
            >
              Smart sort ✦
            </SortChip>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto">
          {loading && (
            <div className="p-8 text-center text-black/40 text-sm">Loading library…</div>
          )}
          {!loading && error && (
            <div className="p-8 text-center text-[#b34334] text-sm">{error}</div>
          )}
          {!loading && !error && properties.length === 0 && (
            <div className="p-10 text-center">
              <p className="text-sm text-black/55">Your property library is empty.</p>
              <Link
                href="/properties"
                className="inline-block mt-3 px-4 py-2 rounded-lg bg-[#1b3a2d] text-white text-sm font-medium hover:bg-[#2d5a40] transition"
                onClick={onClose}
              >
                Add your first property
              </Link>
            </div>
          )}
          {!loading && !error && properties.length > 0 && filtered.length === 0 && (
            <div className="p-8 text-center text-sm text-black/45">
              No properties match the current filters.
            </div>
          )}
          {!loading && !error && filtered.length > 0 && (
            <ul className="divide-y divide-black/6">
              {filtered.map((p) => {
                const isSel = selected.has(p.id);
                const cover = p.images[0]?.url ?? null;
                const matched = sortMode === "smart" ? signals.get(p.id) ?? [] : [];
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => toggle(p.id)}
                      className={`w-full text-left px-5 py-3 flex items-center gap-4 hover:bg-black/[0.02] transition ${
                        isSel ? "bg-[#1b3a2d]/[0.04]" : ""
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition ${
                          isSel
                            ? "bg-[#1b3a2d] border-[#1b3a2d] text-white"
                            : "border-black/20"
                        }`}
                      >
                        {isSel && <span className="text-xs leading-none">✓</span>}
                      </div>
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-black/5 shrink-0">
                        {cover ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={cover} alt="" className="w-full h-full object-cover" />
                        ) : null}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-[14px] text-black/85 truncate">
                          {p.name}
                        </div>
                        <div className="text-[12px] text-black/45 mt-0.5 truncate">
                          {p.location ? p.location.name : "No location"}
                          {p.location?.country ? ` · ${p.location.country}` : ""}
                          {p.propertyClass ? ` · ${classLabel(p.propertyClass)}` : ""}
                        </div>
                        {p.shortSummary && (
                          <div className="text-[12px] text-black/55 mt-1 line-clamp-1">
                            {p.shortSummary}
                          </div>
                        )}
                        {matched.length > 0 && (
                          <div className="mt-1.5 flex items-center gap-1 flex-wrap">
                            {matched.slice(0, 3).map((sig) => (
                              <span
                                key={sig}
                                className="px-1.5 py-0.5 rounded-full text-[10px] font-medium tracking-wide"
                                style={{
                                  background: sig === "avoided"
                                    ? "rgba(179,67,52,0.10)"
                                    : "rgba(201,168,76,0.16)",
                                  color: sig === "avoided" ? "#b34334" : "#8a7125",
                                }}
                              >
                                {sig}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-black/8 flex items-center justify-between gap-3">
          <div className="text-[12px] text-black/45">
            {selected.size === 0
              ? "Select one or more properties"
              : `${selected.size} selected`}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-sm rounded-lg text-black/55 hover:bg-black/5 transition"
            >
              Cancel
            </button>
            <button
              onClick={insert}
              disabled={selected.size === 0}
              className="px-4 py-1.5 text-sm rounded-lg bg-[#1b3a2d] text-white font-medium hover:bg-[#2d5a40] active:scale-95 transition disabled:opacity-40"
            >
              Insert {selected.size > 0 ? selected.size : ""}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Mapping ───────────────────────────────────────────────────────────────
//
// The library Property model is richer than the proposal Property type, so
// the mapping discards what doesn't fit and translates the rest. The
// proposal type stays unchanged — keeping the existing renderer working —
// and the proposal is stable against later library edits.

function snapshotFromLibrary(p: LibraryProperty & {
  images: { id: string; url: string; isCover: boolean; order: number }[];
}): Partial<ProposalProperty> {
  const sorted = [...p.images].sort((a, b) => Number(b.isCover) - Number(a.isCover) || a.order - b.order);
  const lead = sorted[0]?.url;
  const gallery = sorted.map((i) => i.url);

  // Compose location string from name + country.
  const location = p.location
    ? p.location.country
      ? `${p.location.name}, ${p.location.country}`
      : p.location.name
    : "";

  return {
    name: p.name,
    location,
    shortDesc: p.shortSummary ?? "",
    description: p.whatMakesSpecial ?? "",
    whyWeChoseThis: p.whyWeChoose ?? "",
    amenities: p.amenities ?? [],
    mealPlan: mealPlanLabel(p.mealPlan ?? null),
    nights: p.suggestedNights ?? 2,
    funFactsVisible: p.funFactsVisible ?? true,
    leadImageUrl: lead,
    galleryUrls: gallery,
  };
}

function mealPlanLabel(id: string | null): string {
  if (!id) return "Full board";
  return MEAL_PLANS.find((m) => m.id === id)?.label ?? id;
}

// ─── Sort chip ─────────────────────────────────────────────────────────────

function SortChip({
  active,
  onClick,
  accent = false,
  children,
}: {
  active: boolean;
  onClick: () => void;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded-md text-[12px] font-medium transition ${
        active
          ? accent
            ? "bg-[#c9a84c] text-[#1b3a2d] shadow-sm"
            : "bg-white text-black/85 shadow-sm"
          : "text-black/50 hover:text-black/75"
      }`}
    >
      {children}
    </button>
  );
}
