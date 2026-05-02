"use client";

import { useState, useRef, useEffect } from "react";
import type { DraggableAttributes } from "@dnd-kit/core";
import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";

// Editor-only chrome that floats over the top-right corner of every day
// card. Minimal, white-on-dark pills, invisible in the share view.

export function DayCardChrome({
  attributes,
  listeners,
  onFindImage,
  onAddAfter,
  onDuplicate,
  onDelete,
  locationImageSide,
  propertyImageSide,
  onSetLocationImageSide,
  onSetPropertyImageSide,
  locationBg,
  propertyBgPerDay,
  onSetLocationBg,
  onSetPropertyBgPerDay,
}: {
  attributes?: DraggableAttributes;
  listeners?: SyntheticListenerMap | undefined;
  onFindImage: () => void;
  onAddAfter: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  /** Per-day layout overrides — when undefined, the day inherits the
   *  section variant's flip direction (Act II opposite Act I). */
  locationImageSide?: "left" | "right";
  propertyImageSide?: "left" | "right";
  onSetLocationImageSide?: (next: "left" | "right" | undefined) => void;
  onSetPropertyImageSide?: (next: "left" | "right" | undefined) => void;
  /** Per-day background overrides for each act. Undefined → fall back
   *  to the section-level cardBg / propertyBg. Operator brief: "Day
   *  card to have editor function for both location and accommodation
   *  section separately to change layout, color and more
   *  independently." */
  locationBg?: string;
  propertyBgPerDay?: string;
  onSetLocationBg?: (next: string | undefined) => void;
  onSetPropertyBgPerDay?: (next: string | undefined) => void;
}) {
  const [layoutOpen, setLayoutOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  // Close the popover when the operator clicks anywhere outside it,
  // matching the rest of the editor's popover affordances.
  useEffect(() => {
    if (!layoutOpen) return;
    const onDown = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setLayoutOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [layoutOpen]);

  const showActPicker =
    onSetLocationImageSide &&
    onSetPropertyImageSide &&
    onSetLocationBg &&
    onSetPropertyBgPerDay;

  return (
    <div
      className="absolute top-3 right-3 z-30 flex gap-1"
      data-editor-chrome
      onClick={(e) => e.stopPropagation()}
    >
      <ChromeButton
        {...attributes}
        {...listeners}
        label="Drag to reorder"
        gold={false}
        className="cursor-grab"
      >
        ⠿
      </ChromeButton>
      <ChromeButton onClick={onFindImage} label="Find a destination image" gold>
        ✦
      </ChromeButton>
      {showActPicker && (
        <div className="relative">
          <ChromeButton
            onClick={() => setLayoutOpen((v) => !v)}
            label="Day editor — location & accommodation"
          >
            ✎
          </ChromeButton>
          {layoutOpen && (
            <div
              ref={popoverRef}
              className="absolute right-0 top-9 z-40 bg-[#0d0d0d] text-white/90 rounded-xl shadow-2xl border border-white/10 p-3 w-[260px]"
              style={{ fontSize: 12 }}
            >
              <ActPanel
                title="Location"
                imageSide={locationImageSide}
                onImageSideChange={onSetLocationImageSide!}
                bg={locationBg}
                onBgChange={onSetLocationBg!}
              />
              <div
                aria-hidden
                className="my-3"
                style={{ height: 1, background: "rgba(255,255,255,0.08)" }}
              />
              <ActPanel
                title="Accommodation"
                imageSide={propertyImageSide}
                onImageSideChange={onSetPropertyImageSide!}
                bg={propertyBgPerDay}
                onBgChange={onSetPropertyBgPerDay!}
              />
              <p className="mt-3 text-[10.5px] text-white/45 leading-snug">
                Auto / theme = follow the section defaults. Each side can be
                overridden per day independently.
              </p>
            </div>
          )}
        </div>
      )}
      <ChromeButton onClick={onAddAfter} label="Add day after">
        +
      </ChromeButton>
      <ChromeButton onClick={onDuplicate} label="Duplicate day">
        ⧉
      </ChromeButton>
      <ChromeButton onClick={onDelete} label="Delete day" danger>
        ×
      </ChromeButton>
    </div>
  );
}

// Per-act block inside the popover. Bundles image-side toggle + bg
// colour input + a "theme" reset so an operator can hand-tune one
// half of the day (location OR accommodation) without leaving the
// section-level defaults behind for the other half.
function ActPanel({
  title,
  imageSide,
  onImageSideChange,
  bg,
  onBgChange,
}: {
  title: string;
  imageSide: "left" | "right" | undefined;
  onImageSideChange: (next: "left" | "right" | undefined) => void;
  bg: string | undefined;
  onBgChange: (next: string | undefined) => void;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.22em] text-[#c9a84c] mb-2 font-semibold">
        {title}
      </div>
      <SidePicker label="Image side" value={imageSide} onChange={onImageSideChange} />
      <div className="mt-2">
        <div className="text-[10px] uppercase tracking-[0.18em] text-white/55 mb-1.5 font-semibold">
          Background
        </div>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={hexFor(bg) || "#f8f5ef"}
            onChange={(e) => onBgChange(e.target.value)}
            className="w-7 h-7 rounded border border-white/15 cursor-pointer p-0 bg-transparent"
            title={`Custom ${title.toLowerCase()} background`}
          />
          <input
            type="text"
            value={bg ?? ""}
            onChange={(e) => onBgChange(e.target.value || undefined)}
            placeholder="theme"
            className="flex-1 bg-white/5 border border-white/10 rounded-md px-2 py-1 text-[11px] text-white/85 outline-none focus:border-white/30 transition-colors font-mono uppercase"
          />
          {bg && (
            <button
              type="button"
              onClick={() => onBgChange(undefined)}
              className="text-[10px] text-white/55 hover:text-white/85 px-2 py-1 rounded hover:bg-white/5 transition"
              title="Reset to section default"
            >
              Reset
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Best-effort hex resolver for <input type="color">. Accepts #rrggbb;
// silently returns undefined for rgba()/named colors so the swatch
// doesn't reject the value.
function hexFor(v: string | undefined): string | undefined {
  if (!v) return undefined;
  const m = /^#([0-9a-f]{6})$/i.exec(v.trim());
  return m ? `#${m[1]}` : undefined;
}

function SidePicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: "left" | "right" | undefined;
  onChange: (next: "left" | "right" | undefined) => void;
}) {
  const Pill = ({
    target,
    text,
  }: {
    target: "left" | "right" | undefined;
    text: string;
  }) => {
    const active = value === target || (target === undefined && value === undefined);
    return (
      <button
        type="button"
        onClick={() => onChange(target)}
        className={`flex-1 px-2 py-1.5 rounded-md text-[11px] font-semibold uppercase tracking-[0.16em] transition ${
          active
            ? "bg-[#c9a84c] text-black"
            : "bg-white/5 text-white/65 hover:bg-white/10"
        }`}
      >
        {text}
      </button>
    );
  };
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.18em] text-white/55 mb-1.5 font-semibold">
        {label}
      </div>
      <div className="flex gap-1.5">
        <Pill target={undefined} text="Auto" />
        <Pill target="left" text="Left" />
        <Pill target="right" text="Right" />
      </div>
    </div>
  );
}

function ChromeButton({
  children,
  onClick,
  label,
  gold,
  danger,
  className = "",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  gold?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs transition backdrop-blur-sm ${
        danger
          ? "bg-black/40 text-white/70 hover:bg-red-500/85"
          : gold
            ? "bg-black/40 text-[#c9a84c] hover:bg-black/60"
            : "bg-black/40 text-white/70 hover:bg-black/60"
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
