"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MEAL_PLANS, classLabel } from "@/lib/properties";
import type { Property as ProposalProperty } from "@/lib/types";

// ─── Day-level property picker ──────────────────────────────────────────────
//
// Fast, single-click assignment. Opens with /api/properties/rank filtered
// by the day's destination and Brand-DNA-ranked — the Smart-sort results
// already factor in preferred/avoided properties, tier bias, and style.
//
// Click a row → emits a Partial<ProposalProperty> snapshot + closes.
// No "select + apply" two-step like the multi-select LibraryPicker — the
// whole point is "choose one camp for this day, quickly".

type LocationLite = { id: string; name: string; country: string | null };
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
  suitability?: string[];
  checkInTime?: string | null;
  checkOutTime?: string | null;
  totalRooms?: number | null;
  spokenLanguages?: string[];
  specialInterests?: string[];
  rooms?: {
    id: string;
    name: string;
    bedConfig?: string | null;
    description?: string | null;
    imageUrls?: string[];
  }[];
  customSections?: {
    id?: string;
    title: string;
    body?: string | null;
    visible?: boolean;
    order?: number;
  }[];
  location: LocationLite | null;
  images: { id: string; url: string; isCover?: boolean; order?: number }[];
};

type RankedRow = { property: LibraryProperty; matchedSignals: string[] };

export function DayPropertyPicker({
  dayDestination,
  onClose,
  onSelect,
}: {
  dayDestination: string;
  onClose: () => void;
  onSelect: (snapshot: Partial<ProposalProperty>) => void;
}) {
  const [ranked, setRanked] = useState<RankedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [useLocationFilter, setUseLocationFilter] = useState(true);
  const [selecting, setSelecting] = useState<string | null>(null);

  // Load ranked candidates. Try matching the day's destination first; if
  // the filter yields nothing, fall back to the org-wide ranked list.
  useEffect(() => {
    setLoading(true);
    setError(null);
    (async () => {
      try {
        // First, resolve destination to a location id if possible.
        let locationId: string | undefined;
        if (useLocationFilter && dayDestination.trim()) {
          const locRes = await fetch("/api/locations", { cache: "no-store" });
          if (locRes.ok) {
            const data = await locRes.json();
            const match = (data.locations ?? []).find(
              (l: LocationLite) => l.name.toLowerCase() === dayDestination.trim().toLowerCase(),
            );
            if (match) locationId = match.id;
          }
        }

        // cache: "no-store" is critical here. Without it, browsers + the
        // Next.js / Vercel edge can serve a cached property list whose
        // image references are stale by hours or days, so an operator
        // who deletes a property's images sees them resurrect when they
        // re-open the picker. POST is normally non-cacheable but some
        // CDN configurations (Cloudflare 5xx pages, edge worker passes)
        // do store POST responses. Belt + braces.
        const rankRes = await fetch("/api/properties/rank", {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(locationId ? { locationId } : {}),
            limit: 30,
          }),
        });
        if (rankRes.status === 409) { window.location.href = "/select-organization"; return; }
        if (!rankRes.ok) throw new Error(`HTTP ${rankRes.status}`);
        const rankData = await rankRes.json();
        let list: RankedRow[] = rankData.ranked ?? [];

        // If location filter produced nothing, fall back to unfiltered.
        if (list.length === 0 && locationId) {
          const fallback = await fetch("/api/properties/rank", {
            method: "POST",
            cache: "no-store",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ limit: 30 }),
          });
          if (fallback.ok) {
            const d = await fallback.json();
            list = d.ranked ?? [];
          }
        }
        setRanked(list);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load library");
      } finally {
        setLoading(false);
      }
    })();
  }, [dayDestination, useLocationFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return ranked;
    return ranked.filter((r) => r.property.name.toLowerCase().includes(q));
  }, [ranked, search]);

  const pick = async (property: LibraryProperty, signals: string[]) => {
    if (selecting) return;
    setSelecting(property.id);
    try {
      // Fetch the full payload — cache:"no-store" + a cache-busting
      // query param so any intermediate proxy (Vercel edge, browser
      // disk cache, service worker) is forced to round-trip to Postgres.
      // Operators reported deleted images resurrecting on re-pick; the
      // root cause was a stale cached response. Without this, even a
      // hard refresh wasn't enough — the browser served the old payload
      // because the GET URL had been seen before.
      const cacheBuster = `t=${Date.now()}`;
      const full = await fetch(`/api/properties/${property.id}?${cacheBuster}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      const data = full.ok ? await full.json() : null;
      // If the GET-by-id failed, fall back to the rank list's data —
      // but log it loudly. This was previously silent and an auth
      // hiccup (401, 409) on the GET would silently use the rank
      // payload's stale images. Diagnostic helps pin down recurring
      // "stale image" reports.
      if (!data) {
        console.warn(
          `[DayPropertyPicker] /api/properties/${property.id} did not return data (status ${full.status}); falling back to rank-cached property record. This may show stale images.`,
        );
      }
      const p = (data?.property ?? property) as LibraryProperty & {
        images: { url: string; isCover: boolean; order: number }[];
      };

      const sorted = [...(p.images ?? [])].sort(
        (a, b) => Number(!!b.isCover) - Number(!!a.isCover) || (a.order ?? 0) - (b.order ?? 0),
      );
      const lead = sorted[0]?.url;
      const gallery = sorted.map((i) => i.url);
      const location = p.location
        ? (p.location.country ? `${p.location.name}, ${p.location.country}` : p.location.name)
        : "";

      const snapshot: Partial<ProposalProperty> = {
        // Library link — recorded so "Refresh from library" can re-pull
        // latest fields onto this snapshot later.
        libraryPropertyId: p.id,
        name: p.name,
        location,
        shortDesc: p.shortSummary ?? "",
        description: p.whatMakesSpecial ?? "",
        whyWeChoseThis: p.whyWeChoose ?? "",
        amenities: p.amenities ?? [],
        mealPlan: p.mealPlan ? (MEAL_PLANS.find((m) => m.id === p.mealPlan)?.label ?? p.mealPlan) : "Full board",
        nights: p.suggestedNights ?? 2,
        leadImageUrl: lead,
        galleryUrls: gallery,
        propertyClass: p.propertyClass ?? undefined,
        suitability: p.suitability ?? [],
        // Showcase facts prepped by the operator ahead of time.
        checkInTime: p.checkInTime ?? undefined,
        checkOutTime: p.checkOutTime ?? undefined,
        totalRooms: p.totalRooms ?? undefined,
        spokenLanguages: p.spokenLanguages ?? [],
        specialInterests: p.specialInterests ?? [],
        rooms: (p.rooms ?? []).map((r) => ({
          id: r.id,
          name: r.name,
          bedConfig: r.bedConfig ?? "",
          description: r.description ?? "",
          imageUrls: r.imageUrls ?? [],
        })),
        // Library-side custom sections honour their visibility flag
        // at snapshot-time. Per-proposal hiding can be added later
        // as a separate per-section toggle.
        customSections: (p.customSections ?? [])
          .filter((s) => s.visible !== false)
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          .map((s) => ({
            id: s.id,
            title: s.title,
            body: s.body ?? "",
            order: s.order ?? 0,
          })),
      };
      void signals;
      onSelect(snapshot);
      onClose();
    } catch {
      setSelecting(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 ss-fade-in"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[80vh] flex flex-col overflow-hidden ss-modal-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="px-5 py-4 border-b border-black/8 flex items-center justify-between gap-3">
          <div>
            <div className="text-label ed-label text-[#1b3a2d]">Assign property</div>
            <h2 className="text-h3 font-semibold text-black/85 mt-0.5">
              {dayDestination || "Browse my library"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-black/40 hover:text-black/70 text-xl leading-none px-2"
            aria-label="Close"
          >
            ×
          </button>
        </header>

        {/* Filters */}
        <div className="px-5 py-3 border-b border-black/8 flex items-center gap-2 flex-wrap">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search properties…"
            className="flex-1 min-w-[180px] px-3 py-1.5 rounded-lg border border-black/12 text-small focus:outline-none focus:border-[#1b3a2d] focus:ring-2 focus:ring-[#1b3a2d]/12 transition"
          />
          {dayDestination.trim() && (
            <label className="inline-flex items-center gap-1.5 text-small text-black/60">
              <input
                type="checkbox"
                checked={useLocationFilter}
                onChange={(e) => setUseLocationFilter(e.target.checked)}
                className="accent-[#1b3a2d]"
              />
              <span>Only {dayDestination}</span>
            </label>
          )}
        </div>

        {/* List */}
        <div className="flex-1 overflow-auto">
          {loading && (
            <div className="p-8 text-center text-small text-black/40">Loading…</div>
          )}
          {!loading && error && (
            <div className="p-8 text-center text-small text-[#b34334]">{error}</div>
          )}
          {!loading && !error && ranked.length === 0 && (
            <div className="p-10 text-center">
              <p className="text-small text-black/55">
                Your library is empty.
              </p>
              <Link
                href="/properties/new"
                className="inline-block mt-3 px-4 py-2 rounded-lg bg-[#1b3a2d] text-white text-small font-medium hover:bg-[#2d5a40] transition"
                onClick={onClose}
              >
                + Add a property
              </Link>
            </div>
          )}
          {!loading && !error && filtered.length === 0 && ranked.length > 0 && (
            <div className="p-8 text-center text-small text-black/45">
              No properties match that search.
            </div>
          )}
          {!loading && !error && filtered.length > 0 && (
            <ul className="divide-y divide-black/6">
              {filtered.map(({ property, matchedSignals }) => {
                const cover = property.images[0]?.url ?? null;
                const isLoading = selecting === property.id;
                return (
                  <li key={property.id}>
                    <button
                      type="button"
                      onClick={() => pick(property, matchedSignals)}
                      disabled={!!selecting}
                      className="w-full text-left px-5 py-3 flex items-center gap-4 hover:bg-black/[0.02] transition disabled:opacity-50"
                    >
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-black/5 shrink-0">
                        {cover && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={cover} alt="" className="w-full h-full object-cover" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-small font-medium text-black/85 truncate">
                          {property.name}
                        </div>
                        <div className="text-label mt-0.5 truncate" style={{ color: "rgba(0,0,0,0.45)", textTransform: "none", letterSpacing: "0", fontWeight: 400 }}>
                          {property.location?.name ?? "No location"}
                          {property.location?.country ? ` · ${property.location.country}` : ""}
                          {property.propertyClass ? ` · ${classLabel(property.propertyClass)}` : ""}
                        </div>
                        {matchedSignals.length > 0 && (
                          <div className="mt-1.5 flex items-center gap-1 flex-wrap">
                            {matchedSignals.slice(0, 3).map((sig) => (
                              <span
                                key={sig}
                                className="px-1.5 py-0.5 rounded-full text-label font-medium"
                                style={{
                                  background: "rgba(201,168,76,0.16)",
                                  color: "#8a7125",
                                  textTransform: "none",
                                  letterSpacing: "0",
                                }}
                              >
                                {sig}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="text-small font-semibold shrink-0" style={{ color: "#1b3a2d" }}>
                        {isLoading ? "…" : "Assign →"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
