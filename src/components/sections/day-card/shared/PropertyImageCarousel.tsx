"use client";

import { useEffect, useState } from "react";
import type { ThemeTokens } from "@/lib/types";

// PropertyImageCarousel — single big lead image with click-to-next.
//
// Operator brief: "in property section in the day card have one big
// lead image on all layouts with allow to click to see next." This
// replaces the prior 2-tile / 3-tile image strips that competed with
// the property's narrative for visual weight.
//
// Behaviour:
//   • Image fills the cell; aspect-ratio follows whatever the parent
//     sets via the `aspect` prop.
//   • Click anywhere on the image → advance to the next image. Cycles
//     back to the lead after the last gallery shot.
//   • Empty state: a soft "Pick property" placeholder (operator) or a
//     muted blank tile (preview).
//   • Keyboard: ← / → arrows on the focused button cycle in either
//     direction.
//   • Bottom-right pill renders the index ("2 / 5") plus an arrow so
//     guests immediately understand it's clickable.
//   • A single row of indicator dots sits inside the bottom edge for
//     additional click targets.

export type PropertyImageCarouselProps = {
  /** Lead image first, then the property's gallery in order. Empty
   *  entries are filtered out. */
  urls: Array<string | null | undefined>;
  alt: string;
  isEditor: boolean;
  tokens: ThemeTokens;
  /** Optional click target when the cell is empty (operator clicks
   *  to open the property picker). When undefined, the cell is just
   *  a placeholder with no affordance. */
  onPickProperty?: () => void;
  /** Aspect ratio for the cell (e.g. "3 / 2", "1 / 1"). Defaults
   *  3:2 — cinematic landscape. */
  aspect?: string;
  /** Border radius applied to the cell. Defaults 8px. */
  radius?: number;
};

export function PropertyImageCarousel({
  urls,
  alt,
  isEditor,
  tokens,
  onPickProperty,
  aspect = "3 / 2",
  radius = 8,
}: PropertyImageCarouselProps) {
  const filtered = urls.filter(
    (u): u is string => typeof u === "string" && u.trim().length > 0,
  );
  const [index, setIndex] = useState(0);

  // Snap the cursor back when the urls list shrinks (operator removed
  // an image, switched property, etc.).
  useEffect(() => {
    if (filtered.length === 0) {
      if (index !== 0) setIndex(0);
      return;
    }
    if (index >= filtered.length) setIndex(0);
  }, [filtered.length, index]);

  const total = filtered.length;
  const next = () => setIndex((i) => (i + 1) % Math.max(1, total));
  const prev = () =>
    setIndex((i) => (i - 1 + Math.max(1, total)) % Math.max(1, total));

  // Empty state — placeholder with optional click-to-pick affordance.
  if (total === 0) {
    return (
      <button
        type="button"
        onClick={onPickProperty}
        disabled={!isEditor || !onPickProperty}
        className="w-full h-full flex items-center justify-center text-[11.5px] uppercase tracking-[0.22em] transition disabled:opacity-50"
        style={{
          aspectRatio: aspect,
          minHeight: "100%",
          background: tokens.cardBg,
          border: `1px dashed ${tokens.border}`,
          borderRadius: radius,
          color: tokens.mutedText,
        }}
      >
        {isEditor && onPickProperty ? "+ Pick property" : "Property to be confirmed"}
      </button>
    );
  }

  const url = filtered[index];

  return (
    <button
      type="button"
      onClick={next}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") {
          e.preventDefault();
          next();
        }
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          prev();
        }
      }}
      className="relative w-full h-full block group focus:outline-none"
      style={{
        aspectRatio: aspect,
        minHeight: "100%",
        background: tokens.cardBg,
        borderRadius: radius,
        cursor: total > 1 ? "pointer" : "default",
        overflow: "hidden",
      }}
      aria-label={
        total > 1 ? `${alt} — image ${index + 1} of ${total}, tap for next` : alt
      }
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={alt}
        className="absolute inset-0 w-full h-full object-cover transition-opacity duration-200"
      />
      {total > 1 && (
        <>
          {/* Index pill — bottom right, gives guests a clear visual
              cue that the image is clickable to advance. */}
          <div
            className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10.5px] font-semibold uppercase tracking-[0.18em] backdrop-blur-sm"
            style={{
              background: "rgba(0,0,0,0.55)",
              color: "white",
            }}
            aria-hidden
          >
            <span className="tabular-nums">
              {index + 1} / {total}
            </span>
            <span aria-hidden>›</span>
          </div>
          {/* Indicator dots — alternative click targets, also gives
              guests a sense of how many photos there are. Hidden on
              very narrow viewports because they'd visually crowd the
              index pill. */}
          <div
            className="absolute bottom-3 left-3 hidden sm:flex items-center gap-1.5"
            aria-hidden
          >
            {filtered.map((_, i) => (
              <span
                key={i}
                onClick={(e) => {
                  e.stopPropagation();
                  setIndex(i);
                }}
                className="w-1.5 h-1.5 rounded-full transition-opacity"
                style={{
                  background: "white",
                  opacity: i === index ? 0.95 : 0.45,
                  cursor: "pointer",
                }}
              />
            ))}
          </div>
        </>
      )}
    </button>
  );
}
