"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "./AppHeader";
import { CSVImportDialog } from "./CSVImportDialog";
import { PROPERTY_CLASSES, classLabel } from "@/lib/properties";

type LocationLite = { id: string; name: string; country: string | null };
type TagLite = { id: string; name: string };
type PropertyRow = {
  id: string;
  name: string;
  propertyClass: string | null;
  archived: boolean;
  updatedAt: string;
  location: LocationLite | null;
  images: { id: string; url: string }[];
  tags: { tag: TagLite }[];
  _count: { images: number };
};
type LoadState = "loading" | "ready" | "error";

export function PropertyListPage() {
  const router = useRouter();
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [locations, setLocations] = useState<LocationLite[]>([]);
  const [tags, setTags] = useState<TagLite[]>([]);
  const [filters, setFilters] = useState<{ location: string | null; class: string | null; tagIds: string[]; q: string }>({
    location: null,
    class: null,
    tagIds: [],
    q: "",
  });
  const [creating, setCreating] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const load = useCallback(async () => {
    setState("loading");
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.location) params.set("location", filters.location);
      if (filters.class) params.set("class", filters.class);
      filters.tagIds.forEach((t) => params.append("tag", t));
      if (filters.q.trim()) params.set("q", filters.q.trim());

      const [propRes, locRes, tagRes] = await Promise.all([
        fetch(`/api/properties?${params.toString()}`, { cache: "no-store" }),
        fetch("/api/locations", { cache: "no-store" }),
        fetch("/api/property-tags", { cache: "no-store" }),
      ]);
      if (propRes.status === 401) { window.location.href = "/sign-in?redirect_url=/properties"; return; }
      if (propRes.status === 409) { window.location.href = "/select-organization"; return; }
      if (!propRes.ok) throw new Error(`HTTP ${propRes.status}`);

      const [propData, locData, tagData] = await Promise.all([propRes.json(), locRes.json(), tagRes.json()]);
      setProperties(propData.properties ?? []);
      setLocations(locData.locations ?? []);
      setTags(tagData.tags ?? []);
      setState("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
      setState("error");
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const handleNew = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Untitled Property" }),
      });
      if (res.status === 409) { window.location.href = "/select-organization"; return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      router.push(`/properties/${data.property.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create property");
      setCreating(false);
    }
  };

  const filtersActive = useMemo(
    () => Boolean(filters.location || filters.class || filters.tagIds.length > 0 || filters.q.trim()),
    [filters],
  );

  return (
    <div className="min-h-screen bg-[#f8f5ef] text-[#1a1a1a]">
      <AppHeader />

      <main className="max-w-7xl mx-auto px-6 py-10">
        {/* Title + new */}
        <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-black/85">
              Your properties
            </h1>
            <p className="mt-2 text-black/50 text-[15px]">
              Camps and lodges you trust. Reuse them across proposals.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                if (seeding) return;
                setSeeding(true);
                try {
                  const res = await fetch("/api/properties/seed-starter", { method: "POST" });
                  if (res.status === 409) { window.location.href = "/select-organization"; return; }
                  if (!res.ok) throw new Error(`HTTP ${res.status}`);
                  await load();
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Seed failed");
                } finally {
                  setSeeding(false);
                }
              }}
              disabled={seeding}
              className="px-3.5 py-2 rounded-lg text-sm text-black/70 hover:bg-black/[0.04] border border-black/12 transition disabled:opacity-60"
              title="Add 20 pre-built East African camps — dedupes against existing names."
            >
              {seeding ? "Loading starters…" : "✨ Load starter library"}
            </button>
            <button
              onClick={() => setImportOpen(true)}
              className="px-3.5 py-2 rounded-lg text-sm text-black/70 hover:bg-black/[0.04] border border-black/12 transition"
              title="Bulk-import from a CSV"
            >
              ↓ Import CSV
            </button>
            <button
              onClick={handleNew}
              disabled={creating}
              className="px-5 py-2.5 rounded-xl bg-[#1b3a2d] text-white text-sm font-semibold hover:bg-[#2d5a40] active:scale-95 transition shadow-sm disabled:opacity-60"
            >
              {creating ? "Creating…" : "+ Add property"}
            </button>
          </div>
        </div>

        {/* Filters */}
        <FilterBar
          locations={locations}
          tags={tags}
          filters={filters}
          setFilters={setFilters}
          show={state === "ready" && (properties.length > 0 || filtersActive)}
        />

        {/* Body */}
        {state === "loading" && <PropertiesSkeleton />}
        {state === "error" && (
          <div className="rounded-2xl border border-[#b34334]/30 bg-[#b34334]/5 p-6 text-[#b34334]">
            <div className="font-semibold mb-1">Couldn&apos;t load properties</div>
            <div className="text-sm break-words">{error}</div>
            <button
              onClick={load}
              className="mt-4 px-4 py-2 rounded-lg border border-[#b34334]/40 text-sm hover:bg-[#b34334]/10 transition"
            >
              Retry
            </button>
          </div>
        )}
        {state === "ready" && properties.length === 0 && !filtersActive && (
          <EmptyState
            onNew={handleNew}
            creating={creating}
            onImport={() => setImportOpen(true)}
            onSeed={async () => {
              if (seeding) return;
              setSeeding(true);
              try {
                const res = await fetch("/api/properties/seed-starter", { method: "POST" });
                if (res.status === 409) { window.location.href = "/select-organization"; return; }
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                await load();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Seed failed");
              } finally {
                setSeeding(false);
              }
            }}
            seeding={seeding}
          />
        )}
        {state === "ready" && properties.length === 0 && filtersActive && (
          <div className="rounded-2xl border border-dashed border-black/15 bg-white p-10 text-center text-black/55">
            No properties match the current filters.
            <button
              onClick={() => setFilters({ location: null, class: null, tagIds: [], q: "" })}
              className="ml-2 underline hover:text-black/80"
            >
              Clear filters
            </button>
          </div>
        )}
        {state === "ready" && properties.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {properties.map((p) => (
              <PropertyCard key={p.id} property={p} />
            ))}
          </div>
        )}
      </main>

      <CSVImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onComplete={() => {
          setImportOpen(false);
          void load();
        }}
      />
    </div>
  );
}

// ─── Filter bar ────────────────────────────────────────────────────────────

function FilterBar({
  locations,
  tags,
  filters,
  setFilters,
  show,
}: {
  locations: LocationLite[];
  tags: TagLite[];
  filters: { location: string | null; class: string | null; tagIds: string[]; q: string };
  setFilters: (f: typeof filters) => void;
  show: boolean;
}) {
  if (!show) return null;
  return (
    <div className="bg-white border border-black/8 rounded-xl p-3 mb-6 flex items-center gap-2 flex-wrap shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <input
        type="search"
        value={filters.q}
        onChange={(e) => setFilters({ ...filters, q: e.target.value })}
        placeholder="Search by name…"
        className="px-3 py-1.5 rounded-lg border border-black/12 text-sm w-56 focus:outline-none focus:border-[#1b3a2d] focus:ring-2 focus:ring-[#1b3a2d]/12 transition"
      />
      <Select
        value={filters.location ?? ""}
        onChange={(v) => setFilters({ ...filters, location: v || null })}
        placeholder="All locations"
        options={locations.map((l) => ({
          value: l.id,
          label: l.country ? `${l.name} · ${l.country}` : l.name,
        }))}
      />
      <Select
        value={filters.class ?? ""}
        onChange={(v) => setFilters({ ...filters, class: v || null })}
        placeholder="All classes"
        options={PROPERTY_CLASSES.map((c) => ({ value: c.id, label: c.label }))}
      />
      {tags.length > 0 && (
        <details className="relative">
          <summary className="list-none cursor-pointer px-3 py-1.5 rounded-lg border border-black/12 text-sm text-black/65 hover:bg-black/5 transition select-none">
            Tags{filters.tagIds.length > 0 ? ` (${filters.tagIds.length})` : ""}
          </summary>
          <div className="absolute z-20 mt-2 right-0 w-64 bg-white border border-black/10 rounded-xl shadow-xl p-3 max-h-72 overflow-auto">
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => {
                const active = filters.tagIds.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      const next = active
                        ? filters.tagIds.filter((x) => x !== t.id)
                        : [...filters.tagIds, t.id];
                      setFilters({ ...filters, tagIds: next });
                    }}
                    className={`px-2.5 py-1 rounded-full text-[12px] border transition ${
                      active
                        ? "bg-[#1b3a2d] text-white border-[#1b3a2d]"
                        : "bg-white text-black/65 border-black/10 hover:bg-black/5"
                    }`}
                  >
                    {t.name}
                  </button>
                );
              })}
            </div>
          </div>
        </details>
      )}
      {(filters.location || filters.class || filters.tagIds.length > 0 || filters.q.trim()) && (
        <button
          type="button"
          onClick={() => setFilters({ location: null, class: null, tagIds: [], q: "" })}
          className="px-3 py-1.5 rounded-lg text-sm text-black/45 hover:text-black/70 transition ml-auto"
        >
          Clear
        </button>
      )}
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="px-3 py-1.5 rounded-lg border border-black/12 text-sm text-black/65 bg-white focus:outline-none focus:border-[#1b3a2d] focus:ring-2 focus:ring-[#1b3a2d]/12 transition"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

// ─── Card ──────────────────────────────────────────────────────────────────

function PropertyCard({ property }: { property: PropertyRow }) {
  const cover = property.images[0]?.url ?? null;
  return (
    <Link
      href={`/properties/${property.id}`}
      className="group bg-white rounded-2xl border border-black/8 overflow-hidden hover:border-black/20 hover:shadow-[0_4px_20px_rgba(0,0,0,0.06)] transition flex flex-col"
    >
      <div className="relative aspect-[4/3] bg-black/5 overflow-hidden">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt=""
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition duration-500"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-black/25 text-xs">
            No cover image
          </div>
        )}
        {property._count.images > 1 && (
          <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full bg-black/55 text-white text-[11px] tabular-nums">
            {property._count.images} photos
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-baseline justify-between gap-2">
          <div className="font-semibold text-[15px] text-black/85 truncate">{property.name}</div>
          <div className="text-[11px] uppercase tracking-wider text-black/35 shrink-0">
            {classLabel(property.propertyClass)}
          </div>
        </div>
        <div className="text-[12px] text-black/45 mt-1 truncate">
          {property.location ? property.location.name : "No location set"}
          {property.location?.country ? ` · ${property.location.country}` : ""}
        </div>
        {property.tags.length > 0 && (
          <div className="mt-3 flex items-center gap-1 flex-wrap">
            {property.tags.slice(0, 3).map(({ tag }) => (
              <span
                key={tag.id}
                className="px-2 py-0.5 rounded-full text-[11px] bg-black/[0.04] text-black/55"
              >
                {tag.name}
              </span>
            ))}
            {property.tags.length > 3 && (
              <span className="text-[11px] text-black/35">+{property.tags.length - 3}</span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}

// ─── States ────────────────────────────────────────────────────────────────

function PropertiesSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="bg-white rounded-2xl border border-black/8 overflow-hidden">
          <div className="aspect-[4/3] bg-black/[0.06] animate-pulse" />
          <div className="p-4 space-y-2">
            <div className="h-4 bg-black/8 rounded w-2/3 animate-pulse" />
            <div className="h-3 bg-black/6 rounded w-1/3 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  onNew,
  creating,
  onImport,
  onSeed,
  seeding,
}: {
  onNew: () => void;
  creating: boolean;
  onImport: () => void;
  onSeed: () => void;
  seeding: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border border-dashed border-black/15 p-14 text-center">
      <div
        className="w-12 h-12 mx-auto rounded-2xl flex items-center justify-center text-[#c9a84c] text-xl font-bold mb-4"
        style={{ background: "rgba(201,168,76,0.15)" }}
      >
        ◇
      </div>
      <h2 className="text-lg font-semibold text-black/80">Build your property library</h2>
      <p className="mt-1.5 text-[14px] text-black/55 max-w-md mx-auto leading-relaxed">
        Start with the camps and lodges you actually sell. Once they&apos;re here,
        you can drop them straight into proposals — and the AI will know to
        prefer them over anything else.
      </p>
      <div className="mt-7 flex items-center justify-center gap-2 flex-wrap">
        <button
          onClick={onNew}
          disabled={creating}
          className="px-5 py-2.5 rounded-xl bg-[#1b3a2d] text-white text-sm font-semibold hover:bg-[#2d5a40] active:scale-95 transition disabled:opacity-60"
        >
          {creating ? "Creating…" : "+ Add your first property"}
        </button>
        <button
          onClick={onImport}
          className="px-4 py-2.5 rounded-xl border border-black/12 text-sm font-medium text-black/70 hover:bg-black/[0.04] transition"
        >
          ↓ Import CSV
        </button>
        <button
          onClick={onSeed}
          disabled={seeding}
          className="px-4 py-2.5 rounded-xl border border-[#c9a84c]/40 text-sm font-medium text-[#8a7230] hover:bg-[#c9a84c]/10 transition disabled:opacity-60"
          title="Seed the library with 10 famous East African camps — you can archive or edit them after."
        >
          {seeding ? "Seeding…" : "✦ Seed starter library"}
        </button>
      </div>
      <p className="mt-4 text-[11.5px] text-black/40 max-w-md mx-auto">
        Not sure where to begin? The starter library gives you 10 famous East African camps you can edit or archive.
      </p>
    </div>
  );
}
