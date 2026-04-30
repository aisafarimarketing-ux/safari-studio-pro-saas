"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { nanoid } from "@/lib/nanoid";
import {
  pickBrandImageForDestination,
  type BrandImage,
} from "@/lib/brandDNA";
import {
  pickSampleImageForDestination,
  isSampleImageUrl,
  type SampleImage,
} from "@/lib/sampleDestinationImages";
import type { TripStop, TierKey } from "@/lib/types";

// ─── TripStopsEditor ─────────────────────────────────────────────────────
//
// Per-stop trip planner. Replaces the old flat-list-of-destination-chips
// approach with explicit ordered rows: each row carries a destination,
// a nights count, and optional hero-image + per-tier property pre-picks.
//
// Why this exists:
//   1. The AI used to guess nights-per-destination from a flat list +
//      a total nights count. It was wrong often enough that operators
//      asked us to make the allocation explicit. Stops give the AI a
//      deterministic schedule.
//   2. Operators have specific photo and property preferences for each
//      destination — surfacing those at trip-setup time means the AI
//      doesn't have to guess and the operator doesn't have to override
//      every day in the editor.
//   3. Drag-reorder via native HTML5 dnd (no library) — vertical only.
//
// Empty-state nudge:
//   If a stop has no Brand DNA library match AND the operator hasn't
//   explicitly chosen "use sample" or "none", we render a soft hint
//   inviting them to tag photos in Brand DNA, with "use sample" as
//   the one-click escape hatch.

const COMMON_DESTINATIONS = [
  "Arusha", "Masai Mara", "Amboseli", "Serengeti", "Ngorongoro",
  "Tarangire", "Lake Manyara", "Lake Nakuru", "Lake Naivasha", "Samburu",
  "Laikipia", "Ol Pejeta", "Meru", "Mount Kenya", "Nairobi",
  "Zanzibar", "Lamu", "Diani", "Tsavo East", "Tsavo West",
  "Ruaha", "Selous / Nyerere", "Bwindi", "Murchison Falls", "Volcanoes (Rwanda)",
  "Kigali", "Entebbe", "Kampala", "Kilimanjaro", "Mombasa",
];

export type LibraryProperty = {
  id: string;
  name: string;
  propertyClass: string | null;
  location: { name: string; country: string | null } | null;
};

export interface TripStopsEditorProps {
  stops: TripStop[];
  onChange: (next: TripStop[]) => void;
  totalNightsRequired: number;
  brandImageLibrary: BrandImage[];
  properties: LibraryProperty[];
}

export function TripStopsEditor({
  stops,
  onChange,
  totalNightsRequired,
  brandImageLibrary,
  properties,
}: TripStopsEditorProps) {
  const totalNightsAllocated = useMemo(
    () => stops.reduce((sum, s) => sum + (s.nights || 0), 0),
    [stops],
  );

  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const addStop = (destination: string = "") => {
    const next: TripStop = {
      id: nanoid(),
      destination,
      nights: 1,
    };
    onChange([...stops, next]);
  };

  const updateStop = (id: string, patch: Partial<TripStop>) => {
    onChange(stops.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const removeStop = (id: string) => {
    onChange(stops.filter((s) => s.id !== id));
  };

  const moveStop = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= stops.length || to >= stops.length) return;
    const next = stops.slice();
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {stops.length === 0 && (
        <div className="rounded-lg border border-dashed border-black/15 bg-black/2 px-4 py-8 text-center">
          <div className="text-small text-black/60 mb-2">No stops yet</div>
          <div className="text-label text-black/45 mb-3" style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400 }}>
            Add destinations in the order the trip visits them — with how many
            nights at each.
          </div>
          <QuickAddPicker
            existing={[]}
            onPick={(d) => addStop(d)}
          />
        </div>
      )}

      {stops.map((stop, idx) => (
        <StopRow
          key={stop.id}
          stop={stop}
          index={idx}
          isDraggingOver={dragIndex !== null && dragIndex !== idx}
          brandImageLibrary={brandImageLibrary}
          properties={properties}
          onChange={(patch) => updateStop(stop.id, patch)}
          onRemove={() => removeStop(stop.id)}
          onDragStart={() => setDragIndex(idx)}
          onDragOver={(e) => {
            e.preventDefault();
            if (dragIndex === null || dragIndex === idx) return;
            moveStop(dragIndex, idx);
            setDragIndex(idx);
          }}
          onDragEnd={() => setDragIndex(null)}
        />
      ))}

      {stops.length > 0 && (
        <div className="flex items-center gap-2">
          <QuickAddPicker
            existing={stops.map((s) => s.destination)}
            onPick={(d) => addStop(d)}
          />
        </div>
      )}

      <NightsTotalFooter
        allocated={totalNightsAllocated}
        required={totalNightsRequired}
      />
    </div>
  );
}

// ─── Single row ──────────────────────────────────────────────────────────

function StopRow({
  stop,
  index,
  isDraggingOver,
  brandImageLibrary,
  properties,
  onChange,
  onRemove,
  onDragStart,
  onDragOver,
  onDragEnd,
}: {
  stop: TripStop;
  index: number;
  isDraggingOver: boolean;
  brandImageLibrary: BrandImage[];
  properties: LibraryProperty[];
  onChange: (patch: Partial<TripStop>) => void;
  onRemove: () => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}) {
  const brandMatch = stop.destination
    ? pickBrandImageForDestination(brandImageLibrary, stop.destination)
    : null;
  const sampleMatch = stop.destination
    ? pickSampleImageForDestination(stop.destination, { fallback: false })
    : null;

  // Property options narrowed to ones whose location.name matches
  // this destination (case-insensitive substring). Operators with
  // properties tagged by location see a clean shortlist; the "All
  // properties" toggle is the escape hatch.
  const [showAllProperties, setShowAllProperties] = useState(false);
  const filteredProperties = useMemo(() => {
    if (showAllProperties) return properties;
    const dest = stop.destination.trim().toLowerCase();
    if (!dest) return properties;
    return properties.filter((p) => {
      const loc = p.location?.name?.toLowerCase() ?? "";
      return loc.includes(dest) || dest.includes(loc);
    });
  }, [properties, stop.destination, showAllProperties]);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      className={`rounded-lg border bg-white transition ${
        isDraggingOver
          ? "border-[#1b3a2d]/40 shadow-md"
          : "border-black/12 hover:border-black/20"
      }`}
    >
      {/* Top row — destination, nights, summary chips, remove */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          className="cursor-grab active:cursor-grabbing text-black/30 hover:text-black/60 px-1"
          aria-label={`Drag stop ${index + 1}`}
          tabIndex={-1}
        >
          ⋮⋮
        </button>

        <div className="text-label font-bold text-[#1b3a2d] tabular-nums shrink-0 w-6">
          {index + 1}
        </div>

        <input
          type="text"
          name={`stop-destination-${stop.id}`}
          id={`ts-stop-destination-${stop.id}`}
          autoComplete="off"
          list="ts-destination-suggestions"
          value={stop.destination}
          onChange={(e) => onChange({ destination: e.target.value })}
          placeholder="Destination"
          className="flex-1 min-w-0 px-2 py-1.5 rounded border border-black/10 text-small focus:outline-none focus:border-[#1b3a2d] focus:ring-2 focus:ring-[#1b3a2d]/12 transition"
        />

        <NightsStepper
          value={stop.nights}
          onChange={(v) => onChange({ nights: v })}
        />

        <HeroBadge
          stop={stop}
          brandMatch={brandMatch}
          sampleMatch={sampleMatch}
          onChange={onChange}
        />

        <PropertyBadge
          stop={stop}
          properties={filteredProperties}
          allProperties={properties}
          showAll={showAllProperties}
          onToggleShowAll={() => setShowAllProperties((v) => !v)}
          onChange={onChange}
        />

        <button
          type="button"
          onClick={onRemove}
          className="w-7 h-7 rounded text-black/30 hover:bg-red-50 hover:text-red-600 transition flex items-center justify-center text-base shrink-0"
          aria-label="Remove stop"
          title="Remove stop"
        >
          🗑
        </button>
      </div>

      {/* Soft empty-state nudge — shown when destination is set but no
          hero is wired AND no Brand DNA match exists. Sample is always
          available as a fallback so this is informational, not blocking. */}
      {stop.destination.trim() && !stop.heroImageUrl && !brandMatch && (
        <div
          className="px-3 pb-2 text-label text-black/45"
          style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400 }}
        >
          No photos tagged for {stop.destination} in your Brand DNA library.{" "}
          <a
            href="/settings/brand#visualStyle"
            target="_blank"
            rel="noreferrer"
            className="text-[#1b3a2d] underline hover:no-underline"
          >
            Tag now
          </a>
          {sampleMatch && (
            <>
              {" · "}
              <button
                type="button"
                onClick={() => onChange({ heroImageUrl: sampleMatch.url })}
                className="text-[#1b3a2d] underline hover:no-underline"
              >
                Use sample
              </button>
            </>
          )}
        </div>
      )}

      <datalist id="ts-destination-suggestions">
        {COMMON_DESTINATIONS.map((d) => (
          <option key={d} value={d} />
        ))}
      </datalist>
    </div>
  );
}

// ─── Nights stepper ──────────────────────────────────────────────────────

function NightsStepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const clamp = (v: number) => Math.max(0, Math.min(60, v));
  return (
    <div className="flex items-center gap-1 shrink-0">
      <button
        type="button"
        onClick={() => onChange(clamp(value - 1))}
        className="w-7 h-7 rounded border border-black/10 text-black/55 hover:bg-black/5 transition text-small font-semibold"
        aria-label="Fewer nights"
      >
        −
      </button>
      <div className="text-small font-semibold text-black/85 w-8 text-center tabular-nums">
        {value}
      </div>
      <button
        type="button"
        onClick={() => onChange(clamp(value + 1))}
        className="w-7 h-7 rounded border border-black/10 text-black/55 hover:bg-black/5 transition text-small font-semibold"
        aria-label="More nights"
      >
        +
      </button>
      <span
        className="text-label text-black/45 ml-0.5"
        style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400 }}
      >
        {value === 1 ? "night" : "nights"}
      </span>
    </div>
  );
}

// ─── Hero image badge + popover ─────────────────────────────────────────

function HeroBadge({
  stop,
  brandMatch,
  sampleMatch,
  onChange,
}: {
  stop: TripStop;
  brandMatch: BrandImage | null;
  sampleMatch: SampleImage | null;
  onChange: (patch: Partial<TripStop>) => void;
}) {
  const [open, setOpen] = useState(false);

  // Auto-pick on first interaction with the destination — if the
  // operator hasn't explicitly set a heroImageUrl AND there's a Brand
  // DNA match, the badge previews the match and a one-click "Use this"
  // commits it. Operators who skip the popover entirely still get the
  // auto-pick at submission time (autopilot route runs the same
  // helper as a fallback).

  const status: "library" | "sample" | "none" = stop.heroImageUrl
    ? isSampleImageUrl(stop.heroImageUrl)
      ? "sample"
      : "library"
    : "none";

  const label = status === "library" ? "Library" : status === "sample" ? "Sample" : "Hero";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`shrink-0 inline-flex items-center gap-1 px-2 py-1.5 rounded text-small font-medium border transition ${
          stop.heroImageUrl
            ? "border-[#1b3a2d]/30 bg-[#1b3a2d]/5 text-[#1b3a2d]"
            : "border-black/12 text-black/55 hover:bg-black/5"
        }`}
        title="Hero image"
      >
        <span aria-hidden>📷</span>
        <span>{label}</span>
      </button>
      {open && (
        <Popover onClose={() => setOpen(false)}>
          <div className="w-72 p-3 space-y-2">
            <div
              className="text-label font-semibold text-black/55 mb-1"
              style={{ textTransform: "none", letterSpacing: 0 }}
            >
              Hero image for {stop.destination || "this stop"}
            </div>
            <HeroOption
              label={brandMatch ? "From your library" : "From your library — no match"}
              hint={brandMatch?.caption ?? "Tag photos by location to use this option."}
              thumb={brandMatch?.url}
              selected={
                stop.heroImageUrl !== undefined &&
                brandMatch !== null &&
                stop.heroImageUrl === brandMatch.url
              }
              disabled={!brandMatch}
              onClick={() => {
                if (brandMatch) {
                  onChange({ heroImageUrl: brandMatch.url });
                  setOpen(false);
                }
              }}
            />
            <HeroOption
              label="Sample image"
              hint={sampleMatch?.credit ?? "Generic East African shot"}
              thumb={sampleMatch?.url}
              selected={
                stop.heroImageUrl !== undefined &&
                sampleMatch !== null &&
                stop.heroImageUrl === sampleMatch.url
              }
              disabled={!sampleMatch}
              onClick={() => {
                if (sampleMatch) {
                  onChange({ heroImageUrl: sampleMatch.url });
                  setOpen(false);
                }
              }}
            />
            <HeroOption
              label="No hero"
              hint="Leave empty — set in the editor later"
              selected={!stop.heroImageUrl}
              onClick={() => {
                onChange({ heroImageUrl: undefined });
                setOpen(false);
              }}
            />
          </div>
        </Popover>
      )}
    </div>
  );
}

function HeroOption({
  label,
  hint,
  thumb,
  selected,
  disabled,
  onClick,
}: {
  label: string;
  hint?: string;
  thumb?: string;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg border transition text-left ${
        selected
          ? "border-[#1b3a2d] bg-[#1b3a2d]/8"
          : disabled
            ? "border-black/8 opacity-50 cursor-not-allowed"
            : "border-black/8 hover:bg-black/3"
      }`}
    >
      {thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumb}
          alt=""
          className="w-10 h-10 rounded object-cover shrink-0 bg-black/5"
        />
      ) : (
        <div className="w-10 h-10 rounded bg-black/5 shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className="text-small font-semibold text-black/80 truncate">{label}</div>
        {hint && (
          <div
            className="text-label text-black/45 truncate"
            style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400 }}
          >
            {hint}
          </div>
        )}
      </div>
      {selected && <span className="text-[#1b3a2d] text-small font-bold">✓</span>}
    </button>
  );
}

// ─── Property badge + per-tier popover ──────────────────────────────────

const TIERS: { key: TierKey; label: string }[] = [
  { key: "classic", label: "Classic" },
  { key: "premier", label: "Premier" },
  { key: "signature", label: "Signature" },
];

function PropertyBadge({
  stop,
  properties,
  allProperties,
  showAll,
  onToggleShowAll,
  onChange,
}: {
  stop: TripStop;
  properties: LibraryProperty[];
  allProperties: LibraryProperty[];
  showAll: boolean;
  onToggleShowAll: () => void;
  onChange: (patch: Partial<TripStop>) => void;
}) {
  const [open, setOpen] = useState(false);
  const picked = stop.propertyByTier ?? {};
  const pickedCount = (Object.values(picked) as (string | undefined)[]).filter(Boolean).length;

  const setForTier = (tier: TierKey, propertyId: string | null) => {
    const next = { ...picked };
    if (propertyId) next[tier] = propertyId;
    else delete next[tier];
    const hasAny = (Object.values(next) as (string | undefined)[]).some(Boolean);
    onChange({ propertyByTier: hasAny ? next : undefined });
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`shrink-0 inline-flex items-center gap-1 px-2 py-1.5 rounded text-small font-medium border transition ${
          pickedCount > 0
            ? "border-[#1b3a2d]/30 bg-[#1b3a2d]/5 text-[#1b3a2d]"
            : "border-black/12 text-black/55 hover:bg-black/5"
        }`}
        title="Pre-pick properties per tier"
      >
        <span aria-hidden>🏨</span>
        <span>{pickedCount > 0 ? `${pickedCount}/3` : "Stay"}</span>
      </button>
      {open && (
        <Popover onClose={() => setOpen(false)}>
          <div className="w-80 p-3 space-y-2.5">
            <div className="flex items-baseline justify-between">
              <div
                className="text-label font-semibold text-black/55"
                style={{ textTransform: "none", letterSpacing: 0 }}
              >
                Properties for {stop.destination || "this stop"}
              </div>
              <button
                type="button"
                onClick={onToggleShowAll}
                className="text-label text-[#1b3a2d] underline hover:no-underline"
                style={{ textTransform: "none", letterSpacing: 0, fontWeight: 500 }}
              >
                {showAll ? "Match destination" : "All properties"}
              </button>
            </div>
            {properties.length === 0 && (
              <div
                className="text-label text-black/55 px-1 py-3"
                style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400 }}
              >
                {allProperties.length === 0
                  ? "No properties in your library yet."
                  : `No properties tagged with location matching "${stop.destination}". Tap "All properties" to pick from any.`}
              </div>
            )}
            {properties.length > 0 && TIERS.map(({ key, label }) => (
              <TierRow
                key={key}
                label={label}
                value={picked[key] ?? null}
                options={properties}
                onChange={(id) => setForTier(key, id)}
              />
            ))}
          </div>
        </Popover>
      )}
    </div>
  );
}

function TierRow({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | null;
  options: LibraryProperty[];
  onChange: (id: string | null) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="text-label font-semibold text-black/55 w-16 shrink-0"
        style={{ textTransform: "none", letterSpacing: 0 }}
      >
        {label}
      </span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="flex-1 min-w-0 px-2 py-1.5 rounded border border-black/10 bg-white text-small focus:outline-none focus:border-[#1b3a2d] focus:ring-2 focus:ring-[#1b3a2d]/12 transition"
      >
        <option value="">Auto (let AI pick)</option>
        {options.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
            {p.propertyClass ? ` · ${p.propertyClass}` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}

// ─── Quick-add ───────────────────────────────────────────────────────────

function QuickAddPicker({
  existing,
  onPick,
}: {
  existing: string[];
  onPick: (destination: string) => void;
}) {
  const [custom, setCustom] = useState("");
  const [showChips, setShowChips] = useState(false);
  const lcExisting = useMemo(
    () => new Set(existing.map((e) => e.trim().toLowerCase())),
    [existing],
  );

  const submitCustom = () => {
    const v = custom.trim();
    if (!v) return;
    onPick(v);
    setCustom("");
  };

  return (
    <div className="w-full space-y-2">
      <div className="flex items-center gap-2">
        <input
          type="text"
          name="quick-add-destination"
          id="ts-quick-add-destination"
          autoComplete="off"
          list="ts-destination-suggestions"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submitCustom();
            }
          }}
          placeholder="Add destination — type or pick below"
          className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-black/12 text-small focus:outline-none focus:border-[#1b3a2d] focus:ring-2 focus:ring-[#1b3a2d]/12 transition"
        />
        <button
          type="button"
          onClick={submitCustom}
          disabled={!custom.trim()}
          className="px-3 py-2 rounded-lg text-small font-semibold bg-[#1b3a2d] text-white hover:bg-[#2d5a40] active:scale-95 transition disabled:opacity-40"
        >
          Add
        </button>
        <button
          type="button"
          onClick={() => setShowChips((v) => !v)}
          className="px-3 py-2 rounded-lg text-small text-black/60 hover:bg-black/5 transition"
        >
          {showChips ? "Hide" : "Browse"}
        </button>
      </div>
      {showChips && (
        <div className="flex flex-wrap gap-1.5">
          {COMMON_DESTINATIONS.map((d) => {
            const used = lcExisting.has(d.toLowerCase());
            return (
              <button
                key={d}
                type="button"
                onClick={() => !used && onPick(d)}
                disabled={used}
                className={`px-2.5 py-1 rounded-full text-label font-medium border transition ${
                  used
                    ? "bg-black/5 border-black/8 text-black/35 cursor-not-allowed"
                    : "bg-white border-black/15 text-black/65 hover:bg-[#1b3a2d]/8 hover:border-[#1b3a2d]/30 hover:text-[#1b3a2d]"
                }`}
                style={{ textTransform: "none", letterSpacing: 0 }}
              >
                {d}
                {used && " ·"}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Total nights footer ─────────────────────────────────────────────────

function NightsTotalFooter({
  allocated,
  required,
}: {
  allocated: number;
  required: number;
}) {
  const matches = allocated === required;
  const diff = required - allocated;

  return (
    <div
      className={`flex items-center justify-between px-3 py-2 rounded-lg text-small font-medium ${
        matches
          ? "bg-[#1b3a2d]/8 text-[#1b3a2d]"
          : "bg-amber-50 text-amber-800 border border-amber-200"
      }`}
    >
      <span>
        {allocated} night{allocated === 1 ? "" : "s"} allocated
      </span>
      <span>
        {matches
          ? "✓ Matches dates"
          : diff > 0
            ? `${diff} more night${diff === 1 ? "" : "s"} needed`
            : `${-diff} too many — trim to match dates`}
      </span>
    </div>
  );
}

// ─── Tiny popover primitive ──────────────────────────────────────────────
//
// Closes on outside-click / Escape. Right-aligned beneath the trigger.

function Popover({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!ref.current) return;
      if (ref.current.contains(e.target as Node)) return;
      onClose();
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full mt-1 z-30 bg-white rounded-xl shadow-2xl border border-black/10 ss-fade-in"
    >
      {children}
    </div>
  );
}
