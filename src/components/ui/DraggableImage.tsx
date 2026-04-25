"use client";

import { useEffect, useRef, useState } from "react";

// DraggableImage — wraps an <img> so an operator (in editor mode) can
// click-and-drag to reposition the visible portion within its container.
// The crop is purely CSS-driven (`object-position`), so the same image
// renders identically in the share view and PDF without any extra logic.
//
// We persist as a string in the standard CSS form ("64.5% 32.0%") rather
// than two numeric fields — keeps the call-site simple and lets the value
// flow straight onto the style prop in non-editor mode.
//
// Persistence happens once on mouse-up so a long drag doesn't fire 50
// autosaves.

export type ImagePosition = string; // e.g. "50% 50%"

const DEFAULT_POSITION: ImagePosition = "50% 50%";

export function DraggableImage({
  src,
  alt,
  position,
  onPositionChange,
  isEditor,
  className,
  style,
  onContextMenu,
}: {
  src: string;
  alt: string;
  position?: ImagePosition;
  onPositionChange?: (next: ImagePosition) => void;
  isEditor: boolean;
  className?: string;
  style?: React.CSSProperties;
  onContextMenu?: (e: React.MouseEvent<HTMLImageElement>) => void;
}) {
  const initial = position?.trim() || DEFAULT_POSITION;
  const [livePos, setLivePos] = useState<ImagePosition>(initial);
  // Refs so the live drag handlers don't re-attach on every state tick.
  const dragRef = useRef<{
    baseX: number;
    baseY: number;
    startX: number;
    startY: number;
    rectW: number;
    rectH: number;
    final: ImagePosition;
  } | null>(null);

  // External prop changes (image swapped, proposal hydrated) overwrite
  // local state — but only when no drag is in flight.
  useEffect(() => {
    if (!dragRef.current) setLivePos(position?.trim() || DEFAULT_POSITION);
  }, [position]);

  const onMouseDown = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!isEditor || !onPositionChange) return;
    // Don't intercept right-clicks (the existing "replace image" context
    // menu still needs to fire).
    if (e.button !== 0) return;
    e.preventDefault();

    const rect = e.currentTarget.getBoundingClientRect();
    const [bx, by] = parsePosition(livePos);
    dragRef.current = {
      baseX: bx,
      baseY: by,
      startX: e.clientX,
      startY: e.clientY,
      rectW: rect.width,
      rectH: rect.height,
      final: livePos,
    };

    const onMove = (ev: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = ev.clientX - d.startX;
      const dy = ev.clientY - d.startY;
      // Dragging the image to the right shifts the visible window left,
      // so object-position decreases. Same for vertical.
      const nx = clamp(d.baseX - (dx / d.rectW) * 100, 0, 100);
      const ny = clamp(d.baseY - (dy / d.rectH) * 100, 0, 100);
      const next = `${nx.toFixed(1)}% ${ny.toFixed(1)}%`;
      d.final = next;
      setLivePos(next);
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      const finalPos = dragRef.current?.final;
      dragRef.current = null;
      if (finalPos && finalPos !== initial) onPositionChange(finalPos);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const cursor = isEditor && onPositionChange ? "move" : undefined;

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src}
      alt={alt}
      className={className}
      style={{ ...style, objectPosition: livePos, cursor }}
      onMouseDown={onMouseDown}
      onContextMenu={onContextMenu}
      draggable={false}
    />
  );
}

function parsePosition(p: string): [number, number] {
  const m = /(-?\d+(?:\.\d+)?)\s*%\s+(-?\d+(?:\.\d+)?)\s*%/.exec(p);
  if (!m) return [50, 50];
  return [Number(m[1]), Number(m[2])];
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
