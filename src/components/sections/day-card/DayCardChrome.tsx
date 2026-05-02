"use client";

import type { DraggableAttributes } from "@dnd-kit/core";
import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";

// Editor-only chrome that floats over the top-right corner of every day
// card. Minimal, white-on-dark pills, invisible in the share view.
//
// Per-act controls (image side + colour) used to live here as a
// single ✎ pen pill that opened a popover with both Location and
// Accommodation editors stacked. Operator brief: "we have editor for
// daycards there but separate so if you hover over the accommodation
// section you see the editor for that section, and if you hover over
// the destination you meet the destination hover." Those controls
// are now rendered AS PART OF each act inside FlipCard
// (ActHoverEditor), revealed on hover of THAT act only. This chrome
// keeps the day-level concerns: drag, find image, +/duplicate/delete.

export function DayCardChrome({
  attributes,
  listeners,
  onFindImage,
  onAddAfter,
  onDuplicate,
  onDelete,
}: {
  attributes?: DraggableAttributes;
  listeners?: SyntheticListenerMap | undefined;
  onFindImage: () => void;
  onAddAfter: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
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
