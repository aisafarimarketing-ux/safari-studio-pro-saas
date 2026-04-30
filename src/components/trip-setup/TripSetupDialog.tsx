"use client";

import { useEffect, useMemo, useState } from "react";
import { buildBlankProposal } from "@/lib/defaults";
import { AutomatingOverlay } from "./AutomatingOverlay";
import { TripStopsEditor, type LibraryProperty } from "./TripStopsEditor";
import { nanoid } from "@/lib/nanoid";
import {
  BUILT_IN_PRESETS,
  loadSavedTemplates,
  saveTemplate,
  deleteTemplate,
  type TripPreset,
} from "@/lib/tripPresets";
import type { BrandImage } from "@/lib/brandDNA";
import type { Proposal, TripStop } from "@/lib/types";

// ─── Trip Setup ─────────────────────────────────────────────────────────────
//
// Fast entry flow for a new proposal. Captures the data that the editor
// needs to do useful work from the first second: trip name, dates, guests,
// origin, destinations, style, notes. All fields have sensible defaults so
// the user can submit immediately and refine inline in the editor.
//
// Used by:
//   - Dashboard "+ New proposal" (replaces the old blank-proposal flow)
//   - Editor's eventual "New" action
//
// Submission returns a partially-configured Proposal object — the caller
// POSTs it to /api/proposals and routes to /studio.

const STYLE_OPTIONS = [
  { id: "luxury", label: "Luxury", hint: "Lead with the best camps; polish over adventure." },
  { id: "mid_range", label: "Mid-range", hint: "Balanced — comfort and value." },
  { id: "classic", label: "Classic", hint: "Value-led, no-frills, experience-first." },
] as const;

// Pace is independent of style — a "Luxury" trip can still be Packed
// (lots of game drives + activities) or Relaxed (camp-focused, slow
// mornings). Drives optional-activity volume and the AI's transfer
// scheduling. Operators reported same-style same-destinations
// proposals reading wildly different in pacing without a knob to
// match the client's brief.
const PACE_OPTIONS = [
  { id: "relaxed", label: "Relaxed", hint: "Slow mornings, fewer transfers, camp-focused." },
  { id: "balanced", label: "Balanced", hint: "Game drives + downtime; the default." },
  { id: "packed", label: "Packed", hint: "Two activities a day; high-energy itinerary." },
] as const;

// Interest chips — drive optional-activity selection and the AI's
// lodge bias (e.g., birding → birding-friendly camps; photography →
// camps with hide / vehicle access). Multiple-select; empty = AI
// stays neutral.
const INTERESTS = [
  "Big 5",
  "Birding",
  "Cultural",
  "Beach",
  "Honeymoon",
  "Hiking",
  "Photography",
  "Family",
  "Conservation",
  "Walking safari",
  "Hot air balloon",
  "Self-drive",
] as const;

// Common destination chips moved into TripStopsEditor — operator now
// adds destinations as ordered "stops" rows with per-stop nights and
// optional photo / property pre-picks.

const COMMON_ORIGINS = [
  "United Kingdom", "United States", "Germany", "France", "Italy",
  "Spain", "Netherlands", "Switzerland", "Australia", "Canada",
  "Brazil", "United Arab Emirates", "India", "Japan", "China",
];

export interface TripSetupResult {
  proposal: Proposal;
  /** When true, the caller should run `/api/ai/autopilot` after creating
   *  the proposal and merge the returned days/inclusions back in before
   *  routing to /studio. */
  autopilot: boolean;
}

// Parent controls mount/unmount — conditionally render `{open && <Dialog />}`
// so each open gets a fresh instance with today-relative defaults. This
// avoids setState-in-effect lint violations.

export function TripSetupDialog({
  onClose,
  onCancel,
  onSubmit,
  submitting = false,
  error,
}: {
  onClose: () => void;
  // onCancel — optional, distinct from onClose. Fires while submitting
  // and surfaces as the "Cancel and go back" link in the loading overlay.
  // Aborts the in-flight autopilot request in the parent so the user can
  // edit their inputs and resubmit.
  onCancel?: () => void;
  onSubmit: (result: TripSetupResult) => void;
  submitting?: boolean;
  // Surface autopilot/save errors back inside the dialog so the user
  // actually sees why a Generate attempt didn't redirect to the editor.
  // Without this the error state lived only on the list page (hidden
  // behind the open dialog) and operators thought the app was silently
  // broken.
  error?: string | null;
}) {
  // Lazy initial state — Date.now() only runs on mount. Restores
  // operator preferences (origin / style / pace / interests / arrival
  // + departure routines) from the last submitted setup so the
  // operator doesn't retype the same values every time. Guest-specific
  // fields (names, dates, adults, children, stops, notes) reset every
  // time so an old client's plan never bleeds into a new one.
  const [form, setForm] = useState<FormShape>(() => withRememberedDefaults(buildDefaultForm()));
  const [autopilot, setAutopilot] = useState(true);
  const [brandImageLibrary, setBrandImageLibrary] = useState<BrandImage[]>([]);
  const [properties, setProperties] = useState<LibraryProperty[]>([]);
  // Operator-saved templates — synchronously loaded from localStorage
  // on mount. Wrapped in a function-init so server-side render doesn't
  // touch window; on client mount the value is correct from the first
  // paint (no useEffect needed). Refreshed by saveCurrentAsTemplate
  // and removeSavedTemplate via setSavedTemplates.
  const [savedTemplates, setSavedTemplates] = useState<TripPreset[]>(() =>
    typeof window === "undefined" ? [] : loadSavedTemplates(),
  );
  const [presetPickerOpen, setPresetPickerOpen] = useState(false);

  const applyPreset = (preset: TripPreset) => {
    setForm((f) => ({
      ...f,
      stops: preset.stops.map((s) => ({
        id: nanoid(),
        destination: s.destination,
        nights: s.nights,
      })),
      style: preset.style,
      pace: preset.pace,
      interests: preset.interests,
    }));
    // Reset arrival/departure dates to match the preset's total
    // nights — operator just wants to type guest names + dates next.
    const totalNights = preset.stops.reduce((sum, s) => sum + s.nights, 0);
    setForm((f) => {
      const arrivalDate = f.arrivalDate;
      const a = new Date(arrivalDate);
      if (!isNaN(a.getTime())) {
        const d = new Date(a.getTime() + totalNights * 86400000);
        return { ...f, departureDate: isoDate(d) };
      }
      return f;
    });
    setPresetPickerOpen(false);
  };

  const saveCurrentAsTemplate = () => {
    const name = window.prompt("Template name?", form.title.trim() || "My itinerary");
    if (!name?.trim()) return;
    const preset: TripPreset = {
      id: `saved-${nanoid()}`,
      name: name.trim(),
      description:
        form.stops
          .map((s) => s.destination)
          .filter(Boolean)
          .slice(0, 4)
          .join(" → ") || "—",
      region: "Multi-country",
      stops: form.stops
        .filter((s) => s.destination.trim() && s.nights > 0)
        .map((s) => ({ destination: s.destination, nights: s.nights })),
      style: (form.style === "luxury" || form.style === "classic" ? form.style : "mid_range"),
      pace: form.pace,
      interests: form.interests,
    };
    saveTemplate(preset);
    setSavedTemplates(loadSavedTemplates());
  };

  const removeSavedTemplate = (id: string) => {
    deleteTemplate(id);
    setSavedTemplates(loadSavedTemplates());
  };

  // Load brand-DNA imageLibrary + properties once when the dialog
  // mounts. The TripStopsEditor uses these to (a) preview which stops
  // already have a tagged hero image and which need sample data, and
  // (b) populate the per-tier property pickers with the operator's
  // own library scoped to each stop's destination. Both fetches are
  // best-effort — failure leaves the editor in a fully usable state
  // with auto-everything; the operator can still ship a proposal.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [bd, props] = await Promise.all([
          fetch("/api/brand-dna").then((r) => (r.ok ? r.json() : null)),
          fetch("/api/properties").then((r) => (r.ok ? r.json() : null)),
        ]);
        if (cancelled) return;
        if (bd?.profile?.imageLibrary && Array.isArray(bd.profile.imageLibrary)) {
          setBrandImageLibrary(bd.profile.imageLibrary as BrandImage[]);
        }
        if (props?.properties && Array.isArray(props.properties)) {
          setProperties(
            (props.properties as LibraryPropertyApi[]).map((p) => ({
              id: p.id,
              name: p.name,
              propertyClass: p.propertyClass ?? null,
              location: p.location ?? null,
            })),
          );
        }
      } catch {
        // Ignore — editor still works with empty library.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const nights = useMemo(() => {
    const a = new Date(form.arrivalDate);
    const d = new Date(form.departureDate);
    if (isNaN(a.getTime()) || isNaN(d.getTime())) return 0;
    const diff = Math.round((d.getTime() - a.getTime()) / 86400000);
    return Math.max(0, diff);
  }, [form.arrivalDate, form.departureDate]);

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const totalAllocated = useMemo(
    () => form.stops.reduce((sum, s) => sum + (s.nights || 0), 0),
    [form.stops],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    rememberDefaults(form);
    const proposal = buildProposalFromForm(form, nights);
    onSubmit({ proposal, autopilot });
  };

  const totalGuests = form.adults + form.children;
  const guestsLabel = form.children > 0
    ? `${form.adults} ${form.adults === 1 ? "adult" : "adults"} · ${form.children} ${form.children === 1 ? "child" : "children"}`
    : `${form.adults} ${form.adults === 1 ? "adult" : "adults"}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 ss-fade-in"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      {/* Full-screen overlay while the autopilot is drafting. Auto-runs
          simulated progress, chases 100% the moment `submitting` flips
          back to false, then fades out. */}
      <AutomatingOverlay
        active={Boolean(submitting && autopilot)}
        onCancel={onCancel}
      />
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden ss-modal-in"
      >
        {/* Header */}
        <header className="px-7 py-5 border-b border-black/8 flex items-center justify-between shrink-0">
          <div>
            <div className="text-label ed-label text-[#1b3a2d]">New proposal</div>
            <h2 className="text-h2 font-bold tracking-tight text-black/85 mt-1">
              Trip setup
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-black/5 flex items-center justify-center text-black/40 hover:text-black/70 transition"
            aria-label="Close"
          >
            ✕
          </button>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-auto px-7 py-6 space-y-6">
          {/* Preset picker — built-in itineraries + operator-saved
              templates. One-click seeds stops + style + pace +
              interests. Skip it entirely if you'd rather build from
              scratch. */}
          <PresetPicker
            open={presetPickerOpen}
            onToggle={() => setPresetPickerOpen((v) => !v)}
            builtIn={BUILT_IN_PRESETS}
            saved={savedTemplates}
            onApply={applyPreset}
            onDelete={removeSavedTemplate}
          />

          {/* Guest name(s) — required, drives personalisation everywhere */}
          <Field
            label="Guest name(s)"
            hint="Used in the greeting, closing, and throughout"
          >
            <TextInput
              value={form.guestNames}
              onChange={(v) => update("guestNames", v)}
              placeholder="e.g. The Anderson Family · Sarah & Michael · Priya"
            />
          </Field>

          {/* Trip name — optional; defaults to '<Guest> Safari' */}
          <Field label="Trip name" hint="Optional — defaults to '{guests} Safari'">
            <TextInput
              value={form.title}
              onChange={(v) => update("title", v)}
              placeholder={form.guestNames ? `${form.guestNames} Safari` : "e.g. Anderson Family Safari"}
            />
          </Field>

          {/* Dates */}
          <div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Arrival">
                <input
                  type="date"
                  value={form.arrivalDate}
                  onChange={(e) => {
                    const next = e.target.value;
                    update("arrivalDate", next);
                    // Keep departure ≥ arrival
                    if (new Date(form.departureDate) < new Date(next)) {
                      update("departureDate", next);
                    }
                  }}
                  className={inputCls}
                />
              </Field>
              <Field label="Departure">
                <input
                  type="date"
                  value={form.departureDate}
                  min={form.arrivalDate}
                  onChange={(e) => update("departureDate", e.target.value)}
                  className={inputCls}
                />
              </Field>
            </div>
            <div className="text-small text-black/45 mt-2">
              {nights} night{nights === 1 ? "" : "s"}
            </div>
          </div>

          {/* Guests */}
          <div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Adults">
                <NumberInput
                  value={form.adults}
                  onChange={(v) => update("adults", v)}
                  min={1}
                  max={20}
                />
              </Field>
              <Field label="Children">
                <NumberInput
                  value={form.children}
                  onChange={(v) => update("children", v)}
                  min={0}
                  max={20}
                />
              </Field>
            </div>
            <div className="text-small text-black/45 mt-2">
              {totalGuests} {totalGuests === 1 ? "guest" : "guests"} · {guestsLabel}
            </div>
          </div>

          {/* Origin */}
          <Field label="Origin country" hint="Where the travellers are coming from">
            <input
              type="text"
              list="ts-origin-suggestions"
              value={form.origin}
              onChange={(e) => update("origin", e.target.value)}
              placeholder="e.g. United Kingdom"
              className={inputCls}
            />
            <datalist id="ts-origin-suggestions">
              {COMMON_ORIGINS.map((c) => <option key={c} value={c} />)}
            </datalist>
          </Field>

          {/* Stops — ordered per-destination plan with nights, hero
              image, and per-tier property pre-picks. Replaces the old
              flat-chip list so the AI gets a deterministic schedule. */}
          <Field
            label="Trip stops"
            hint="In order — destination, nights at each, optional photo / property pre-picks"
          >
            <TripStopsEditor
              stops={form.stops}
              onChange={(next) => update("stops", next)}
              totalNightsRequired={nights}
              brandImageLibrary={brandImageLibrary}
              properties={properties}
            />
            {form.stops.length > 0 && (
              <div className="mt-2 text-right">
                <button
                  type="button"
                  onClick={saveCurrentAsTemplate}
                  className="text-label text-[#1b3a2d] underline hover:no-underline"
                  style={{ textTransform: "none", letterSpacing: 0, fontWeight: 500 }}
                >
                  ✦ Save as template
                </button>
              </div>
            )}
          </Field>

          {/* Travel style */}
          <Field label="Travel style">
            <div className="grid grid-cols-3 gap-2">
              {STYLE_OPTIONS.map((s) => {
                const active = form.style === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => update("style", s.id)}
                    className={`text-left px-4 py-3 rounded-xl border transition active:scale-[0.99] ${
                      active
                        ? "bg-[#1b3a2d] text-white border-[#1b3a2d]"
                        : "bg-white text-black/70 border-black/12 hover:border-black/25"
                    }`}
                  >
                    <div className="font-semibold text-small">{s.label}</div>
                    <div className={`text-label mt-0.5 ${active ? "text-white/70" : "text-black/45"}`} style={{ textTransform: "none", letterSpacing: "0", fontWeight: 400 }}>
                      {s.hint}
                    </div>
                  </button>
                );
              })}
            </div>
          </Field>

          {/* Pace — independent of style. Drives optional-activity
              volume and transfer scheduling. */}
          <Field label="Pace" hint="How busy do they want each day?">
            <div className="grid grid-cols-3 gap-2">
              {PACE_OPTIONS.map((p) => {
                const active = form.pace === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => update("pace", p.id)}
                    className={`text-left px-4 py-3 rounded-xl border transition active:scale-[0.99] ${
                      active
                        ? "bg-[#1b3a2d] text-white border-[#1b3a2d]"
                        : "bg-white text-black/70 border-black/12 hover:border-black/25"
                    }`}
                  >
                    <div className="font-semibold text-small">{p.label}</div>
                    <div
                      className={`text-label mt-0.5 ${active ? "text-white/70" : "text-black/45"}`}
                      style={{ textTransform: "none", letterSpacing: "0", fontWeight: 400 }}
                    >
                      {p.hint}
                    </div>
                  </button>
                );
              })}
            </div>
          </Field>

          {/* Client interests — drives optional-activity bias and
              lodge selection. Multi-select, optional. */}
          <Field
            label="Client interests"
            hint="Optional — pick anything they've mentioned"
          >
            <div className="flex flex-wrap gap-1.5">
              {INTERESTS.map((label) => {
                const active = form.interests.includes(label);
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() =>
                      update(
                        "interests",
                        active
                          ? form.interests.filter((x) => x !== label)
                          : [...form.interests, label],
                      )
                    }
                    className={`px-3 py-1 rounded-full text-small font-medium transition active:scale-95 border ${
                      active
                        ? "bg-[#1b3a2d] text-white border-[#1b3a2d]"
                        : "bg-white text-black/65 border-black/12 hover:bg-black/5"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </Field>

          {/* Pinned arrival / departure routines — both optional,
              both single-line. When set, the AI is forbidden from
              writing a different Day 1 / last-day routine. Stops the
              "5pm landing → game drive" hallucination cold. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="Arrival routine"
              hint="Optional — pinned for Day 1"
            >
              <input
                type="text"
                value={form.arrivalRoutine}
                onChange={(e) => update("arrivalRoutine", e.target.value)}
                placeholder="e.g. Welcome dinner at Mount Meru Hotel"
                className={inputCls}
              />
            </Field>
            <Field
              label="Departure routine"
              hint="Optional — pinned for last day"
            >
              <input
                type="text"
                value={form.departureRoutine}
                onChange={(e) => update("departureRoutine", e.target.value)}
                placeholder="e.g. Breakfast then transfer to KIA for evening flight"
                className={inputCls}
              />
            </Field>
          </div>

          {/* Notes */}
          <Field label="Notes" hint="Optional — anything you want to remember about this trip">
            <textarea
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              rows={3}
              placeholder="e.g. 10th anniversary · prefers small camps · no early flights"
              className={`${inputCls} resize-y`}
            />
          </Field>
        </div>

        {/* Error banner — visible inside the dialog when an autopilot
            attempt failed. Shown above the footer so the user sees it
            before deciding to retry or cancel. */}
        {error && !submitting && (
          <div
            className="mx-7 mb-3 rounded-lg border border-[#b34334]/30 bg-[#b34334]/8 px-4 py-3 shrink-0"
            role="alert"
          >
            <div className="flex items-start gap-2.5">
              <span className="text-[#b34334] text-base leading-none mt-0.5" aria-hidden>
                ⚠
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] font-semibold text-[#b34334] mb-0.5">
                  Last attempt didn&apos;t complete
                </div>
                <div className="text-[12.5px] text-[#7a2f25] break-words leading-relaxed">
                  {error}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="px-7 py-4 border-t border-black/8 flex items-center justify-between gap-3 shrink-0 flex-wrap">
          <label className="flex items-center gap-2.5 cursor-pointer select-none group">
            <span
              className={`relative inline-flex h-5 w-9 rounded-full transition ${
                autopilot ? "bg-[#1b3a2d]" : "bg-black/15"
              }`}
              aria-hidden
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition ${
                  autopilot ? "left-[18px]" : "left-0.5"
                }`}
              />
            </span>
            <input
              type="checkbox"
              checked={autopilot}
              onChange={(e) => setAutopilot(e.target.checked)}
              className="sr-only"
            />
            <span className="text-small text-black/70 group-hover:text-black/90">
              <span className="text-[#c9a84c]">✦</span> Automate draft
            </span>
            <span
              className="text-label text-black/40 hidden sm:inline"
              style={{ textTransform: "none", letterSpacing: "0", fontWeight: 400 }}
            >
              uses your library &amp; brand voice
            </span>
          </label>
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-small rounded-lg text-black/60 hover:bg-black/5 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                submitting ||
                !form.guestNames.trim() ||
                form.stops.length === 0 ||
                totalAllocated !== nights
              }
              className="px-5 py-2 text-small rounded-lg bg-[#1b3a2d] text-white font-semibold hover:bg-[#2d5a40] active:scale-95 transition disabled:opacity-60"
              title={
                !form.guestNames.trim()
                  ? "Add guest name(s) first"
                  : form.stops.length === 0
                    ? "Add at least one stop"
                    : totalAllocated !== nights
                      ? `Stops total ${totalAllocated} nights — must match ${nights} (the trip dates)`
                      : undefined
              }
            >
              {submitting
                ? autopilot ? "Drafting…" : "Creating…"
                : autopilot ? "✦ Automate & open →" : "Open editor →"}
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
}

// ─── Preset picker ──────────────────────────────────────────────────────

function PresetPicker({
  open,
  onToggle,
  builtIn,
  saved,
  onApply,
  onDelete,
}: {
  open: boolean;
  onToggle: () => void;
  builtIn: TripPreset[];
  saved: TripPreset[];
  onApply: (preset: TripPreset) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="rounded-xl border border-black/8 bg-gradient-to-br from-[#f7f3eb] to-white">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between text-left"
      >
        <div className="min-w-0">
          <div className="text-small font-semibold text-[#1b3a2d]">
            ✦ Start from a preset
          </div>
          <div
            className="text-label text-black/55 mt-0.5"
            style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400 }}
          >
            {saved.length > 0
              ? `${builtIn.length} built-in itineraries · ${saved.length} of yours`
              : `${builtIn.length} built-in itineraries — Northern TZ Big 5, Mara Migration, Honeymoon, more`}
          </div>
        </div>
        <span className="text-black/40 text-base shrink-0 ml-3" aria-hidden>
          {open ? "▴" : "▾"}
        </span>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3">
          {saved.length > 0 && (
            <PresetGroup label="Your templates" presets={saved} onApply={onApply} onDelete={onDelete} />
          )}
          <PresetGroup label="Built-in" presets={builtIn} onApply={onApply} />
        </div>
      )}
    </div>
  );
}

function PresetGroup({
  label,
  presets,
  onApply,
  onDelete,
}: {
  label: string;
  presets: TripPreset[];
  onApply: (preset: TripPreset) => void;
  onDelete?: (id: string) => void;
}) {
  return (
    <div>
      <div
        className="text-label font-semibold text-black/45 mb-1.5"
        style={{ textTransform: "none", letterSpacing: 0 }}
      >
        {label}
      </div>
      <div className="space-y-1.5">
        {presets.map((p) => {
          const totalNights = p.stops.reduce((sum, s) => sum + s.nights, 0);
          return (
            <div
              key={p.id}
              className="flex items-center gap-2 rounded-lg border border-black/8 bg-white px-3 py-2 hover:border-[#1b3a2d]/30 transition"
            >
              <button
                type="button"
                onClick={() => onApply(p)}
                className="flex-1 min-w-0 text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="text-small font-semibold text-black/85 truncate">
                    {p.name}
                  </span>
                  <span className="text-label text-black/40 shrink-0 tabular-nums">
                    {totalNights}n
                  </span>
                </div>
                <div
                  className="text-label text-black/50 truncate"
                  style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400 }}
                >
                  {p.description}
                </div>
              </button>
              {onDelete && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`Delete "${p.name}"?`)) onDelete(p.id);
                  }}
                  className="w-7 h-7 rounded text-black/30 hover:bg-red-50 hover:text-red-600 transition flex items-center justify-center text-base shrink-0"
                  aria-label={`Delete ${p.name}`}
                  title="Delete template"
                >
                  🗑
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Form bits ──────────────────────────────────────────────────────────────

const inputCls =
  "w-full px-3 py-2 rounded-lg border border-black/12 bg-white text-small text-black/85 placeholder:text-black/30 focus:outline-none focus:border-[#1b3a2d] focus:ring-2 focus:ring-[#1b3a2d]/12 transition";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-label font-semibold text-black/70" style={{ textTransform: "none", letterSpacing: "0" }}>
          {label}
        </span>
        {hint && (
          <span className="text-label text-black/40" style={{ textTransform: "none", letterSpacing: "0", fontWeight: 400 }}>
            {hint}
          </span>
        )}
      </div>
      {children}
    </label>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={inputCls}
    />
  );
}

function NumberInput({
  value,
  onChange,
  min,
  max,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  const clamp = (v: number) => {
    if (typeof min === "number" && v < min) return min;
    if (typeof max === "number" && v > max) return max;
    return v;
  };
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(clamp(value - 1))}
        className="w-9 h-9 rounded-lg border border-black/12 text-black/60 hover:bg-black/5 transition flex items-center justify-center"
        aria-label="Decrease"
      >
        −
      </button>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(clamp(parseInt(e.target.value, 10) || 0))}
        className={`${inputCls} text-center tabular-nums`}
        style={{ MozAppearance: "textfield" as React.CSSProperties["MozAppearance"] }}
      />
      <button
        type="button"
        onClick={() => onChange(clamp(value + 1))}
        className="w-9 h-9 rounded-lg border border-black/12 text-black/60 hover:bg-black/5 transition flex items-center justify-center"
        aria-label="Increase"
      >
        +
      </button>
    </div>
  );
}

// ─── Proposal assembly ─────────────────────────────────────────────────────

type FormShape = {
  title: string;
  guestNames: string;
  arrivalDate: string;
  departureDate: string;
  adults: number;
  children: number;
  origin: string;
  stops: TripStop[];
  style: string;
  pace: "relaxed" | "balanced" | "packed";
  interests: string[];
  arrivalRoutine: string;
  departureRoutine: string;
  notes: string;
};

// Shape returned by GET /api/properties — narrow to just what
// TripStopsEditor needs (id, name, class, location).
type LibraryPropertyApi = {
  id: string;
  name: string;
  propertyClass?: string | null;
  location?: { name: string; country: string | null } | null;
};

function buildProposalFromForm(form: FormShape, nights: number): Proposal {
  const base = buildBlankProposal();

  // Metadata + trip — fall back to guest-derived title if left blank.
  const guestNames = form.guestNames.trim();
  const inferredTitle = guestNames ? `${guestNames} Safari` : "New safari";
  const title = form.title.trim() || inferredTitle;
  base.metadata.title = title;
  base.trip.title = title;
  base.trip.arrivalDate = form.arrivalDate || undefined;
  base.trip.departureDate = form.departureDate || undefined;
  base.trip.nights = nights;
  base.trip.dates = formatDateRange(form.arrivalDate, form.departureDate);
  base.trip.tripStyle = styleLabel(form.style);
  // Stops carry the deterministic per-destination plan; the flat
  // destinations[] is derived from stops for back-compat with code
  // that still reads it (map markers, summary chips, search).
  const cleanStops: TripStop[] = form.stops
    .map((s) => ({
      ...s,
      destination: s.destination.trim(),
      nights: Math.max(0, Math.floor(s.nights || 0)),
    }))
    .filter((s) => s.destination.length > 0 && s.nights > 0);
  base.trip.stops = cleanStops;
  const destinations = cleanStops.map((s) => s.destination);
  base.trip.destinations = destinations;
  base.trip.subtitle = [
    `${nights} night${nights === 1 ? "" : "s"}`,
    destinations.slice(0, 3).join(" · "),
    form.arrivalDate ? formatMonthYear(form.arrivalDate) : null,
  ].filter(Boolean).join(" · ");
  if (form.notes.trim()) {
    base.trip.operatorNote = form.notes.trim();
  }
  base.trip.pace = form.pace;
  if (form.interests.length > 0) {
    base.trip.interests = form.interests;
  }
  if (form.arrivalRoutine.trim()) {
    base.trip.arrivalRoutine = form.arrivalRoutine.trim();
  }
  if (form.departureRoutine.trim()) {
    base.trip.departureRoutine = form.departureRoutine.trim();
  }

  // Client
  const guestLine = form.children > 0
    ? `${form.adults} adults · ${form.children} children`
    : `${form.adults} ${form.adults === 1 ? "adult" : "adults"}`;
  base.client.guestNames = guestNames || "Your Guests";
  base.client.pax = guestLine;
  base.client.adults = form.adults;
  base.client.children = form.children;
  if (form.origin.trim()) {
    base.client.origin = form.origin.trim();
  }

  // Active tier from travel style
  if (form.style === "luxury") base.activeTier = "signature";
  else if (form.style === "classic") base.activeTier = "classic";
  else base.activeTier = "premier";

  return base;
}

function isoDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return "";
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const fmt: Intl.DateTimeFormatOptions = { month: "long", year: "numeric" };
  if (sameMonth) {
    return `${start.getDate()} – ${end.getDate()} ${start.toLocaleDateString(undefined, fmt)}`;
  }
  return `${start.toLocaleDateString(undefined, { day: "numeric", month: "short" })} – ${end.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`;
}

function formatMonthYear(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function styleLabel(id: string): string {
  return STYLE_OPTIONS.find((s) => s.id === id)?.label ?? id;
}

// Defaults: trip from ~30 days out, 7 nights, 2 adults. Function (not a
// constant) so each dialog open refreshes the relative dates.
// ─── Smart defaults (localStorage-backed) ──────────────────────────────
//
// Operator preferences that travel from one proposal to the next:
// origin (where their typical clients come from), style, pace,
// interests, and arrival/departure routines. Saved on every successful
// submit; restored on every dialog open. Guest-specific fields reset.
//
// Why localStorage and not the DB: per-operator (not per-org) and
// totally non-critical — losing it is fine, the operator just retypes
// once. No round trip needed before the dialog renders.

const DEFAULTS_KEY = "ss-trip-setup-defaults-v1";

type RememberedDefaults = {
  origin?: string;
  style?: string;
  pace?: "relaxed" | "balanced" | "packed";
  interests?: string[];
  arrivalRoutine?: string;
  departureRoutine?: string;
};

function loadRememberedDefaults(): RememberedDefaults | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DEFAULTS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as RememberedDefaults;
  } catch {
    return null;
  }
}

function rememberDefaults(form: FormShape): void {
  if (typeof window === "undefined") return;
  try {
    const next: RememberedDefaults = {
      origin: form.origin || undefined,
      style: form.style,
      pace: form.pace,
      interests: form.interests.length > 0 ? form.interests : undefined,
      arrivalRoutine: form.arrivalRoutine || undefined,
      departureRoutine: form.departureRoutine || undefined,
    };
    window.localStorage.setItem(DEFAULTS_KEY, JSON.stringify(next));
  } catch {
    // ignore quota / privacy-mode failures
  }
}

function withRememberedDefaults(base: FormShape): FormShape {
  const remembered = loadRememberedDefaults();
  if (!remembered) return base;
  return {
    ...base,
    origin: remembered.origin ?? base.origin,
    style: remembered.style ?? base.style,
    pace: remembered.pace ?? base.pace,
    interests: remembered.interests ?? base.interests,
    arrivalRoutine: remembered.arrivalRoutine ?? base.arrivalRoutine,
    departureRoutine: remembered.departureRoutine ?? base.departureRoutine,
  };
}

function buildDefaultForm(): FormShape {
  const arrival = new Date(Date.now() + 30 * 86400000);
  const departure = new Date(arrival.getTime() + 7 * 86400000);
  return {
    title: "",
    guestNames: "",
    arrivalDate: isoDate(arrival),
    departureDate: isoDate(departure),
    adults: 2,
    children: 0,
    origin: "",
    stops: [],
    style: "mid_range",
    pace: "balanced",
    interests: [],
    arrivalRoutine: "",
    departureRoutine: "",
    notes: "",
  };
}
