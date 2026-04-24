"use client";

import { useMemo, useState } from "react";
import { buildBlankProposal } from "@/lib/defaults";
import { AutomatingOverlay } from "./AutomatingOverlay";
import type { Proposal } from "@/lib/types";

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

const COMMON_DESTINATIONS = [
  "Arusha", "Masai Mara", "Amboseli", "Serengeti", "Ngorongoro",
  "Tarangire", "Lake Manyara", "Lake Nakuru", "Lake Naivasha", "Samburu",
  "Laikipia", "Ol Pejeta", "Meru", "Mount Kenya", "Nairobi",
  "Zanzibar", "Lamu", "Diani", "Tsavo East", "Tsavo West",
  "Ruaha", "Selous / Nyerere", "Bwindi", "Murchison Falls", "Volcanoes (Rwanda)",
];

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
}: {
  onClose: () => void;
  // onCancel — optional, distinct from onClose. Fires while submitting
  // and surfaces as the "Cancel and go back" link in the loading overlay.
  // Aborts the in-flight autopilot request in the parent so the user can
  // edit their inputs and resubmit.
  onCancel?: () => void;
  onSubmit: (result: TripSetupResult) => void;
  submitting?: boolean;
}) {
  // Lazy initial state — Date.now() only runs on mount.
  const [form, setForm] = useState<FormShape>(() => buildDefaultForm());
  const [customDestination, setCustomDestination] = useState("");
  const [autopilot, setAutopilot] = useState(true);

  const nights = useMemo(() => {
    const a = new Date(form.arrivalDate);
    const d = new Date(form.departureDate);
    if (isNaN(a.getTime()) || isNaN(d.getTime())) return 0;
    const diff = Math.round((d.getTime() - a.getTime()) / 86400000);
    return Math.max(0, diff);
  }, [form.arrivalDate, form.departureDate]);

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const toggleDestination = (d: string) => {
    setForm((f) => ({
      ...f,
      destinations: f.destinations.includes(d)
        ? f.destinations.filter((x) => x !== d)
        : [...f.destinations, d],
    }));
  };

  const addCustomDestination = () => {
    const v = customDestination.trim();
    if (!v) return;
    if (!form.destinations.includes(v)) {
      update("destinations", [...form.destinations, v]);
    }
    setCustomDestination("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
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

          {/* Destinations */}
          <Field label="Destinations" hint="Pick from common or add your own">
            <div className="flex flex-wrap gap-1.5 mb-3">
              {COMMON_DESTINATIONS.map((d) => {
                const active = form.destinations.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDestination(d)}
                    className={`px-3 py-1 rounded-full text-small font-medium transition active:scale-95 border ${
                      active
                        ? "bg-[#1b3a2d] text-white border-[#1b3a2d]"
                        : "bg-white text-black/65 border-black/12 hover:bg-black/5"
                    }`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={customDestination}
                onChange={(e) => setCustomDestination(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addCustomDestination();
                  }
                }}
                placeholder="Add another destination…"
                className={`${inputCls} flex-1`}
              />
              <button
                type="button"
                onClick={addCustomDestination}
                disabled={!customDestination.trim()}
                className="px-3 py-2 rounded-lg text-small font-medium bg-black/5 text-black/70 hover:bg-black/10 transition disabled:opacity-40"
              >
                Add
              </button>
            </div>
            {form.destinations.filter((d) => !COMMON_DESTINATIONS.includes(d)).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {form.destinations
                  .filter((d) => !COMMON_DESTINATIONS.includes(d))
                  .map((d) => (
                    <span
                      key={d}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-small font-medium bg-[#1b3a2d] text-white"
                    >
                      {d}
                      <button
                        type="button"
                        onClick={() => toggleDestination(d)}
                        className="text-white/70 hover:text-white text-base leading-none -mr-1"
                        aria-label={`Remove ${d}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
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
              disabled={submitting || !form.guestNames.trim() || form.destinations.length === 0}
              className="px-5 py-2 text-small rounded-lg bg-[#1b3a2d] text-white font-semibold hover:bg-[#2d5a40] active:scale-95 transition disabled:opacity-60"
              title={
                !form.guestNames.trim()
                  ? "Add guest name(s) first"
                  : form.destinations.length === 0
                    ? "Pick at least one destination"
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
  destinations: string[];
  style: string;
  notes: string;
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
  base.trip.destinations = form.destinations;
  base.trip.subtitle = [
    `${nights} night${nights === 1 ? "" : "s"}`,
    form.destinations.slice(0, 3).join(" · "),
    form.arrivalDate ? formatMonthYear(form.arrivalDate) : null,
  ].filter(Boolean).join(" · ");
  if (form.notes.trim()) {
    base.trip.operatorNote = form.notes.trim();
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
    destinations: [],
    style: "mid_range",
    notes: "",
  };
}
