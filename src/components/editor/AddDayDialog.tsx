"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useProposalStore } from "@/store/proposalStore";
import { countryOf, orderDestinations } from "@/lib/destinationOrdering";

// ─── AddDayDialog ────────────────────────────────────────────────────────
//
// A guard layer that wraps every "create a day" action — + Add day, Add
// after, Duplicate. Without it, those actions silently inserted days
// with `destination: "New Destination"` and `country: "Kenya"`, which
// then leaked into the cover route ("Arusha to New Destination") and
// the map's flag row (🇰🇪 on a Tanzania-only trip).
//
// The dialog forces a real destination + a nights count + a position.
// Country auto-derives from countryOf(); the operator never has to
// pick it. Submission inserts N consecutive days at the chosen
// position via the store's `addDays` action, which also recomputes
// every day's number + date so downstream sections (map, table, cover)
// re-render with fresh values.
//
// Implementation note: the dialog body lives in a sub-component that
// only mounts when there's a mode, with a `key` derived from the mode
// so a fresh open re-runs the useState initialisers. That keeps the
// pre-fill logic in pure state initialisation rather than a
// setState-in-useEffect loop.

export type AddDayDialogMode =
  | { kind: "append" }
  | { kind: "after"; afterDayId: string }
  | { kind: "duplicate"; sourceDayId: string };

export function AddDayDialog({
  mode,
  onClose,
}: {
  mode: AddDayDialogMode | null;
  onClose: () => void;
}) {
  if (!mode || typeof window === "undefined") return null;
  return (
    <DialogBody
      key={modeKey(mode)}
      mode={mode}
      onClose={onClose}
    />
  );
}

function modeKey(mode: AddDayDialogMode): string {
  if (mode.kind === "append") return "append";
  if (mode.kind === "after") return `after:${mode.afterDayId}`;
  return `duplicate:${mode.sourceDayId}`;
}

function DialogBody({
  mode,
  onClose,
}: {
  mode: AddDayDialogMode;
  onClose: () => void;
}) {
  const { proposal, addDays } = useProposalStore();

  // Suggestions for the destination autocomplete: every destination the
  // operator has already used in this trip, deduped, plus the trip's
  // setup-stage destinations as a tail. orderDestinations sorts them
  // into a sensible safari arc rather than alphabetical noise.
  const suggestions = useMemo(() => {
    const fromDays = proposal.days.map((d) => d.destination).filter(Boolean);
    const fromTrip = proposal.trip.destinations ?? [];
    const merged = Array.from(new Set([...fromDays, ...fromTrip]));
    return orderDestinations(merged);
  }, [proposal.days, proposal.trip.destinations]);

  // Pre-fill on mount. Duplicate copies the source day's destination
  // verbatim; after / append start blank. The whole DialogBody
  // remounts on mode change (parent passes a key derived from the
  // mode) so these initialisers run fresh every time the operator
  // opens the dialog.
  const [destination, setDestination] = useState(() =>
    mode.kind === "duplicate"
      ? proposal.days.find((d) => d.id === mode.sourceDayId)?.destination ?? ""
      : "",
  );
  const [nights, setNights] = useState(1);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Focus the input on the next paint. requestAnimationFrame avoids
  // racing the dialog's transform-from-centre paint.
  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  // Resolve the position label so the operator knows where the days
  // will land. "After Day 3 · Tarangire", "At the end", etc.
  const positionLabel = useMemo(() => {
    if (mode.kind === "append") return `At the end (after Day ${proposal.days.length})`;
    const id = mode.kind === "after" ? mode.afterDayId : mode.sourceDayId;
    const d = proposal.days.find((x) => x.id === id);
    if (!d) return "At the end";
    return `After Day ${d.dayNumber}${d.destination ? ` · ${d.destination}` : ""}`;
  }, [mode, proposal.days]);

  // Auto-derived country preview — operators see the inferred country
  // before submit so they know nothing weird sneaks in. Falls back to
  // the trip's prevailing country if countryOf can't recognise the
  // destination (e.g. operator typed "Olduvai Gorge" and the lookup
  // table doesn't have it yet).
  const inferredCountry = useMemo(() => {
    const looked = countryOf(destination.trim());
    if (looked) return looked;
    // Same fallback as the store: most common country in existing days.
    const counts = new Map<string, number>();
    for (const d of proposal.days) {
      const c = (d.country ?? "").trim();
      if (c) counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    let best: { c: string; n: number } | null = null;
    for (const [c, n] of counts) {
      if (!best || n > best.n) best = { c, n };
    }
    return best?.c ?? "";
  }, [destination, proposal.days]);

  const canSubmit = destination.trim().length > 0 && nights >= 1;

  const submit = () => {
    if (!canSubmit) return;
    addDays({
      destination: destination.trim(),
      country: inferredCountry || undefined,
      nights,
      afterDayId:
        mode.kind === "append"
          ? undefined
          : mode.kind === "after"
            ? mode.afterDayId
            : mode.sourceDayId,
    });
    onClose();
  };

  const titleText =
    mode.kind === "duplicate"
      ? "Duplicate this day"
      : mode.kind === "after"
        ? "Add a day after"
        : "Add a day";

  return createPortal(
    <>
      {/* Click-away catcher — closes the dialog without inserting. */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.32)",
          backdropFilter: "blur(2px)",
          zIndex: 10000,
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titleText}
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 420,
          maxWidth: "calc(100vw - 32px)",
          background: "#ffffff",
          borderRadius: 14,
          boxShadow: "0 24px 60px rgba(0,0,0,0.32), 0 4px 12px rgba(0,0,0,0.18)",
          border: "1px solid rgba(0,0,0,0.08)",
          zIndex: 10001,
          fontFamily: "inherit",
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            onClose();
          }
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-black/6">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-black/45">
              Itinerary
            </div>
            <div className="text-[15px] font-semibold text-black/85 mt-0.5">
              {titleText}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full text-black/45 hover:bg-black/5 hover:text-black/75 transition flex items-center justify-center text-[16px]"
            title="Close (Esc)"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Destination */}
          <div>
            <label
              htmlFor="add-day-destination"
              className="block text-[11px] uppercase tracking-[0.18em] font-semibold text-black/55 mb-1.5"
            >
              Destination
            </label>
            <input
              ref={inputRef}
              id="add-day-destination"
              name="addDayDestination"
              type="text"
              autoComplete="off"
              list="add-day-destination-suggestions"
              placeholder="e.g. Tarangire, Serengeti, Zanzibar"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="w-full px-3 py-2 text-[14px] rounded-lg border border-black/12 outline-none focus:border-[#1b3a2d] focus:ring-2 focus:ring-[#1b3a2d]/15 transition"
            />
            <datalist id="add-day-destination-suggestions">
              {suggestions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            {inferredCountry && destination.trim() && (
              <div className="mt-1.5 text-[11px] text-black/50">
                Country: <span className="text-black/75 font-medium">{inferredCountry}</span>
              </div>
            )}
          </div>

          {/* Nights */}
          <div>
            <label
              htmlFor="add-day-nights"
              className="block text-[11px] uppercase tracking-[0.18em] font-semibold text-black/55 mb-1.5"
            >
              Nights at this stop
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setNights((n) => Math.max(1, n - 1))}
                className="w-8 h-8 rounded-lg border border-black/10 hover:bg-black/5 transition text-[16px] text-black/70"
                title="Fewer nights"
              >
                −
              </button>
              <input
                id="add-day-nights"
                name="addDayNights"
                type="number"
                min={1}
                max={31}
                value={nights}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (Number.isFinite(v)) setNights(Math.max(1, Math.min(31, v)));
                }}
                className="w-16 text-center px-2 py-1.5 text-[14px] rounded-lg border border-black/12 outline-none focus:border-[#1b3a2d] tabular-nums"
              />
              <button
                type="button"
                onClick={() => setNights((n) => Math.min(31, n + 1))}
                className="w-8 h-8 rounded-lg border border-black/10 hover:bg-black/5 transition text-[16px] text-black/70"
                title="More nights"
              >
                +
              </button>
              <span className="text-[12px] text-black/45 ml-1">
                {nights === 1 ? "1 night" : `${nights} nights`} · inserts {nights}{" "}
                {nights === 1 ? "day" : "days"}
              </span>
            </div>
          </div>

          {/* Position */}
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] font-semibold text-black/55 mb-1.5">
              Position
            </div>
            <div className="text-[12.5px] text-black/70">{positionLabel}</div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-black/6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-[12.5px] font-medium rounded-lg text-black/60 hover:bg-black/5 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="px-3.5 py-1.5 text-[12.5px] font-semibold rounded-lg bg-[#1b3a2d] text-white hover:bg-[#244e3c] transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {nights === 1 ? "Add 1 day" : `Add ${nights} days`}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
