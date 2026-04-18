"use client";

import { useEffect, useMemo, useState } from "react";
import type { MediaCandidate } from "@/lib/destinationMedia";

// Day-card image picker. Opens with the day's destination pre-filtered,
// returns context-ranked candidates from /api/media (property → org →
// global). User selects one; we hand back the URL to set as the day's
// hero image.

const EXPERIENCE_OPTIONS = [
  { id: "", label: "Any experience" },
  { id: "game_drive", label: "Game drive" },
  { id: "arrival", label: "Arrival" },
  { id: "beach", label: "Beach" },
  { id: "hot_air_balloon", label: "Balloon" },
  { id: "walk", label: "Walking safari" },
  { id: "boat", label: "Boating" },
  { id: "cultural", label: "Cultural" },
] as const;

const ANIMAL_OPTIONS = [
  { id: "", label: "Any wildlife" },
  { id: "lion", label: "Lion" },
  { id: "elephant", label: "Elephant" },
  { id: "giraffe", label: "Giraffe" },
  { id: "leopard", label: "Leopard" },
  { id: "rhino", label: "Rhino" },
  { id: "buffalo", label: "Buffalo" },
  { id: "cheetah", label: "Cheetah" },
] as const;

export function DestinationImagePicker({
  open,
  onClose,
  defaultLocation,
  defaultExperience,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  defaultLocation?: string;
  defaultExperience?: string;
  onSelect: (candidate: MediaCandidate) => void;
}) {
  const [location, setLocation] = useState(defaultLocation ?? "");
  const [experience, setExperience] = useState(defaultExperience ?? "");
  const [animal, setAnimal] = useState("");
  const [candidates, setCandidates] = useState<MediaCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sync open → reset to defaults
  useEffect(() => {
    if (!open) return;
    setLocation(defaultLocation ?? "");
    setExperience(defaultExperience ?? "");
    setAnimal("");
  }, [open, defaultLocation, defaultExperience]);

  // Fetch on filter change
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (location.trim()) params.set("location", location.trim());
    if (experience) params.set("experienceType", experience);
    if (animal) params.set("animalType", animal);
    params.set("limit", "30");

    (async () => {
      try {
        const res = await fetch(`/api/media?${params.toString()}`, { cache: "no-store" });
        if (res.status === 409) { window.location.href = "/select-organization"; return; }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setCandidates(data.candidates ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load images");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, location, experience, animal]);

  const grouped = useMemo(() => {
    return {
      property: candidates.filter((c) => c.source === "property"),
      org: candidates.filter((c) => c.source === "org"),
      global: candidates.filter((c) => c.source === "global"),
    };
  }, [candidates]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 ss-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[88vh] flex flex-col ss-modal-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-black/8 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-black/85">Find a destination image</h2>
            <p className="text-[12px] text-black/45 mt-0.5">
              Your photos first, then your library, then the global baseline.
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
        <div className="px-5 py-3 border-b border-black/8 grid grid-cols-1 md:grid-cols-3 gap-2">
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Location (e.g. Serengeti)"
            className="px-3 py-1.5 rounded-lg border border-black/12 text-sm focus:outline-none focus:border-[#1b3a2d] focus:ring-2 focus:ring-[#1b3a2d]/12 transition"
          />
          <select
            value={experience}
            onChange={(e) => setExperience(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-black/12 text-sm bg-white text-black/65 focus:outline-none focus:border-[#1b3a2d] focus:ring-2 focus:ring-[#1b3a2d]/12 transition"
          >
            {EXPERIENCE_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
          <select
            value={animal}
            onChange={(e) => setAnimal(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-black/12 text-sm bg-white text-black/65 focus:outline-none focus:border-[#1b3a2d] focus:ring-2 focus:ring-[#1b3a2d]/12 transition"
          >
            {ANIMAL_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-5">
          {loading && (
            <div className="text-center text-black/40 text-sm py-12">Loading images…</div>
          )}
          {!loading && error && (
            <div className="text-center text-[#b34334] text-sm py-12">{error}</div>
          )}
          {!loading && !error && candidates.length === 0 && (
            <div className="text-center py-12">
              <p className="text-sm text-black/55">
                No matching images yet. Try a broader filter, upload your own
                photos to a property, or seed the global library.
              </p>
            </div>
          )}
          {!loading && !error && candidates.length > 0 && (
            <div className="space-y-6">
              <ImageGroup
                title="From this property"
                hint="Photos you've uploaded to a matching property."
                items={grouped.property}
                onSelect={onSelect}
                onClose={onClose}
                badge="property"
              />
              <ImageGroup
                title="Your destination library"
                hint="Photos your organization has saved for this destination."
                items={grouped.org}
                onSelect={onSelect}
                onClose={onClose}
                badge="org"
              />
              <ImageGroup
                title="Global baseline"
                hint="Default destination assets — replace with your own when you can."
                items={grouped.global}
                onSelect={onSelect}
                onClose={onClose}
                badge="global"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Pieces ────────────────────────────────────────────────────────────────

function ImageGroup({
  title,
  hint,
  items,
  onSelect,
  onClose,
  badge,
}: {
  title: string;
  hint: string;
  items: MediaCandidate[];
  onSelect: (c: MediaCandidate) => void;
  onClose: () => void;
  badge: "property" | "org" | "global";
}) {
  if (items.length === 0) return null;
  const badgeStyles: Record<string, { bg: string; text: string }> = {
    property: { bg: "rgba(45,90,64,0.15)", text: "#1b3a2d" },
    org: { bg: "rgba(201,168,76,0.18)", text: "#8a7125" },
    global: { bg: "rgba(0,0,0,0.06)", text: "rgba(0,0,0,0.55)" },
  };
  const style = badgeStyles[badge];
  return (
    <section>
      <div className="flex items-baseline justify-between mb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-[14px] font-semibold text-black/80">{title}</h3>
          <span
            className="px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider"
            style={{ background: style.bg, color: style.text }}
          >
            {items.length}
          </span>
        </div>
        <span className="text-[11px] text-black/40">{hint}</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {items.map((c) => (
          <button
            key={`${c.source}-${c.assetId ?? c.propertyImageId ?? c.url.slice(-32)}`}
            type="button"
            onClick={() => { onSelect(c); onClose(); }}
            className="group relative aspect-[4/3] rounded-xl overflow-hidden bg-black/5 border border-transparent hover:border-[#1b3a2d] transition"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={c.thumbnailUrl ?? c.url}
              alt=""
              className="absolute inset-0 w-full h-full object-cover transition group-hover:scale-105"
            />
            {c.matchedSignals.length > 0 && (
              <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center gap-1 flex-wrap">
                {c.matchedSignals.slice(0, 2).map((sig) => (
                  <span
                    key={sig}
                    className="px-1.5 py-0.5 rounded-full text-[10px] font-medium tracking-wide bg-black/55 text-white backdrop-blur-sm"
                  >
                    {sig}
                  </span>
                ))}
              </div>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}
