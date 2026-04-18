"use client";

import { useEffect, useRef, useState } from "react";
import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";

// ─── Trip Meta Strip ────────────────────────────────────────────────────────
//
// Compact live-data row under the editor toolbar: Dates · Nights · Guests ·
// Origin · Style. Each pill is click-to-edit with a focused popover input
// so operators can tune trip-level meta without leaving the canvas or
// hunting for the settings panel.
//
// Edits go straight through the existing useProposalStore actions
// (updateTrip / updateClient) — no new API, just better discoverability.
//
// Hidden in preview mode so the client view stays clean.

type PopoverId = "dates" | "adults" | "children" | "origin" | "style" | null;

export function TripMetaStrip() {
  const { proposal, updateTrip, updateClient } = useProposalStore();
  const { mode } = useEditorStore();
  const isEditor = mode === "editor";
  const [open, setOpen] = useState<PopoverId>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Close popovers on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(null); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!isEditor) return null;

  const { trip, client } = proposal;
  const nights = trip.nights || (trip.arrivalDate && trip.departureDate ? computeNights(trip.arrivalDate, trip.departureDate) : 0);
  const adults = client.adults ?? 2;
  const children = client.children ?? 0;
  const totalGuests = adults + children;
  const guestsLabel = children > 0 ? `${adults}A + ${children}C` : `${adults} ${adults === 1 ? "adult" : "adults"}`;

  // Format dates line
  const datesLabel = trip.arrivalDate && trip.departureDate
    ? formatDateRange(trip.arrivalDate, trip.departureDate)
    : (trip.dates || "Set dates");

  return (
    <div
      ref={rootRef}
      className="border-b border-black/8 bg-[#faf8f3] px-4 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar print:hidden"
    >
      {/* Dates */}
      <MetaPill
        label="Dates"
        value={datesLabel}
        onClick={() => setOpen(open === "dates" ? null : "dates")}
        active={open === "dates"}
      >
        {open === "dates" && (
          <DatesPopover
            arrivalDate={trip.arrivalDate}
            departureDate={trip.departureDate}
            onChange={(arr, dep) => {
              const n = computeNights(arr, dep);
              updateTrip({
                arrivalDate: arr,
                departureDate: dep,
                nights: n,
                dates: formatDateRange(arr, dep),
              });
            }}
          />
        )}
      </MetaPill>

      {/* Nights (read-only, derived) */}
      <DerivedPill label="Nights" value={nights > 0 ? `${nights}` : "—"} />

      {/* Adults */}
      <MetaPill
        label="Adults"
        value={`${adults}`}
        onClick={() => setOpen(open === "adults" ? null : "adults")}
        active={open === "adults"}
      >
        {open === "adults" && (
          <NumberPopover
            value={adults}
            min={1}
            max={20}
            onChange={(v) => {
              updateClient({
                adults: v,
                pax: formatPax(v, children),
              });
            }}
          />
        )}
      </MetaPill>

      {/* Children */}
      <MetaPill
        label="Children"
        value={`${children}`}
        onClick={() => setOpen(open === "children" ? null : "children")}
        active={open === "children"}
      >
        {open === "children" && (
          <NumberPopover
            value={children}
            min={0}
            max={20}
            onChange={(v) => {
              updateClient({
                children: v,
                pax: formatPax(adults, v),
              });
            }}
          />
        )}
      </MetaPill>

      {/* Total guests (read-only) */}
      <DerivedPill label="Guests" value={`${totalGuests} · ${guestsLabel}`} />

      {/* Origin */}
      <MetaPill
        label="Origin"
        value={client.origin || "—"}
        onClick={() => setOpen(open === "origin" ? null : "origin")}
        active={open === "origin"}
      >
        {open === "origin" && (
          <TextPopover
            value={client.origin ?? ""}
            placeholder="e.g. United Kingdom"
            onChange={(v) => updateClient({ origin: v })}
          />
        )}
      </MetaPill>

      {/* Style */}
      <MetaPill
        label="Style"
        value={trip.tripStyle || "—"}
        onClick={() => setOpen(open === "style" ? null : "style")}
        active={open === "style"}
      >
        {open === "style" && (
          <TextPopover
            value={trip.tripStyle ?? ""}
            placeholder="e.g. Luxury family safari"
            onChange={(v) => updateTrip({ tripStyle: v })}
          />
        )}
      </MetaPill>
    </div>
  );
}

// ─── Pill primitives ───────────────────────────────────────────────────────

function MetaPill({
  label,
  value,
  onClick,
  active,
  children,
}: {
  label: string;
  value: string;
  onClick: () => void;
  active: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-baseline gap-1.5 px-3 py-1 rounded-md text-small transition ${
          active
            ? "bg-[#1b3a2d]/[0.08] text-[#1b3a2d]"
            : "text-black/70 hover:bg-black/[0.04]"
        }`}
      >
        <span className="text-label ed-label" style={{ color: active ? "#1b3a2d" : "rgba(0,0,0,0.4)" }}>
          {label}
        </span>
        <span className="font-medium truncate max-w-[180px]">{value}</span>
      </button>
      {children}
    </div>
  );
}

function DerivedPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="shrink-0 inline-flex items-baseline gap-1.5 px-3 py-1 rounded-md text-small text-black/55">
      <span className="text-label ed-label" style={{ color: "rgba(0,0,0,0.35)" }}>
        {label}
      </span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

// ─── Popovers ──────────────────────────────────────────────────────────────

function popoverCls() {
  return "absolute left-0 top-full mt-1 z-50 bg-white border border-black/10 rounded-xl shadow-xl p-3 min-w-[240px] ss-popover-in";
}

function DatesPopover({
  arrivalDate,
  departureDate,
  onChange,
}: {
  arrivalDate?: string;
  departureDate?: string;
  onChange: (arrival: string, departure: string) => void;
}) {
  const [arr, setArr] = useState(arrivalDate ?? "");
  const [dep, setDep] = useState(departureDate ?? "");
  return (
    <div className={popoverCls()}>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-label ed-label block mb-1" style={{ color: "rgba(0,0,0,0.5)" }}>Arrival</span>
          <input
            type="date"
            value={arr}
            onChange={(e) => setArr(e.target.value)}
            className="w-full px-2 py-1.5 rounded-md border border-black/12 text-small focus:outline-none focus:border-[#1b3a2d]"
          />
        </label>
        <label className="block">
          <span className="text-label ed-label block mb-1" style={{ color: "rgba(0,0,0,0.5)" }}>Departure</span>
          <input
            type="date"
            value={dep}
            min={arr || undefined}
            onChange={(e) => setDep(e.target.value)}
            className="w-full px-2 py-1.5 rounded-md border border-black/12 text-small focus:outline-none focus:border-[#1b3a2d]"
          />
        </label>
      </div>
      <button
        type="button"
        onClick={() => { if (arr && dep) onChange(arr, dep); }}
        disabled={!arr || !dep}
        className="mt-3 w-full px-3 py-1.5 rounded-md bg-[#1b3a2d] text-white text-small font-medium hover:bg-[#2d5a40] transition disabled:opacity-50"
      >
        Apply
      </button>
    </div>
  );
}

function NumberPopover({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const [v, setV] = useState(value);
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  const commit = (n: number) => {
    const clamped = clamp(n);
    setV(clamped);
    onChange(clamped);
  };
  return (
    <div className={popoverCls()} style={{ minWidth: 180 }}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => commit(v - 1)}
          className="w-9 h-9 rounded-md border border-black/12 hover:bg-black/5 flex items-center justify-center"
        >
          −
        </button>
        <input
          type="number"
          value={v}
          min={min}
          max={max}
          onChange={(e) => commit(parseInt(e.target.value, 10) || 0)}
          className="flex-1 px-2 py-1.5 rounded-md border border-black/12 text-center text-small tabular-nums focus:outline-none focus:border-[#1b3a2d]"
        />
        <button
          type="button"
          onClick={() => commit(v + 1)}
          className="w-9 h-9 rounded-md border border-black/12 hover:bg-black/5 flex items-center justify-center"
        >
          +
        </button>
      </div>
    </div>
  );
}

function TextPopover({
  value,
  placeholder,
  onChange,
}: {
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  const [v, setV] = useState(value);
  return (
    <div className={popoverCls()}>
      <input
        autoFocus
        type="text"
        value={v}
        placeholder={placeholder}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => onChange(v.trim())}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            (e.currentTarget as HTMLInputElement).blur();
          }
        }}
        className="w-full px-3 py-2 rounded-md border border-black/12 text-small focus:outline-none focus:border-[#1b3a2d] focus:ring-2 focus:ring-[#1b3a2d]/12 transition"
      />
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function computeNights(arrISO: string, depISO: string): number {
  const a = new Date(arrISO);
  const d = new Date(depISO);
  if (isNaN(a.getTime()) || isNaN(d.getTime())) return 0;
  return Math.max(0, Math.round((d.getTime() - a.getTime()) / 86400000));
}

function formatDateRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return "";
  const sameMonth =
    start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  if (sameMonth) {
    return `${start.getDate()} – ${end.getDate()} ${start.toLocaleDateString(undefined, { month: "long", year: "numeric" })}`;
  }
  return `${start.toLocaleDateString(undefined, { day: "numeric", month: "short" })} – ${end.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`;
}

function formatPax(adults: number, children: number): string {
  if (children > 0) return `${adults} adults · ${children} children`;
  return `${adults} ${adults === 1 ? "adult" : "adults"}`;
}
