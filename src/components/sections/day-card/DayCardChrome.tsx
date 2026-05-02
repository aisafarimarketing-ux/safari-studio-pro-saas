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

  const showLayoutPicker = onSetLocationImageSide && onSetPropertyImageSide;

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
      {showLayoutPicker && (
        <div className="relative">
          <ChromeButton
            onClick={() => setLayoutOpen((v) => !v)}
            label="Day layout (image sides)"
          >
            ⇆
          </ChromeButton>
          {layoutOpen && (
            <div
              ref={popoverRef}
              className="absolute right-0 top-9 z-40 bg-[#0d0d0d] text-white/90 rounded-lg shadow-2xl border border-white/10 p-3 w-[220px]"
              style={{ fontSize: 12 }}
            >
              <SidePicker
                label="Location image"
                value={locationImageSide}
                onChange={onSetLocationImageSide!}
              />
              <div className="h-3" />
              <SidePicker
                label="Property image"
                value={propertyImageSide}
                onChange={onSetPropertyImageSide!}
              />
              <p className="mt-3 text-[10.5px] text-white/45 leading-snug">
                Auto follows the section&rsquo;s trip-flip rhythm. Override per
                day to mix variations.
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
