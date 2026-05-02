"use client";

import { useEffect, useState, useRef } from "react";
import type { ThemeTokens } from "@/lib/types";

// Universal image slot for day cards. Handles every interaction the brief
// calls for:
//   - Click empty → file picker
//   - Click existing with "showChange" → inline replace pill
//   - Right-click → file picker (replace)
//   - Drag file onto slot → upload
//   - Optional "library" action (destination picker) via onPickFromLibrary
//
// Renders a polished placeholder when empty (not a broken image icon).

type Props = {
  url: string | null;
  alt: string;
  isEditor: boolean;
  tokens: ThemeTokens;
  onUpload: (file: File) => void;
  onPickFromLibrary?: () => void;
  placeholderLabel?: string;
  placeholderHint?: string;
  className?: string;
  /** Show the "Change" pill in the corner when an image is present. */
  showChangePill?: boolean;
  /** CSS style overrides (aspectRatio, etc.) */
  style?: React.CSSProperties;
  /** Children rendered above the image (overlays, labels). */
  children?: React.ReactNode;
  /** Gradient overlay on top of image (for when text sits on it). */
  overlay?: "none" | "bottom" | "top" | "both";
  /** CSS object-position string ("X% Y%") for the image — operator drags
   *  the image in editor mode to reposition. */
  position?: string;
  /** Persists the new object-position when the operator finishes dragging. */
  onPositionChange?: (next: string) => void;
};

export function ImageSlot({
  url,
  alt,
  isEditor,
  tokens,
  onUpload,
  onPickFromLibrary,
  placeholderLabel = "Add a photo",
  placeholderHint,
  className = "",
  showChangePill = true,
  style,
  children,
  overlay = "none",
  position,
  onPositionChange,
}: Props) {
  const [dragging, setDragging] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Live drag-to-reposition. We store the in-flight position in state so
  // the image follows the cursor smoothly, then persist once on mouse-up
  // so a single drag doesn't fire 50 autosaves.
  const dragPosRef = useRef<{
    baseX: number;
    baseY: number;
    startX: number;
    startY: number;
    rectW: number;
    rectH: number;
    final: string;
  } | null>(null);
  const [livePosition, setLivePosition] = useState<string>(position?.trim() || "50% 50%");
  useEffect(() => {
    if (!dragPosRef.current) setLivePosition(position?.trim() || "50% 50%");
  }, [position]);

  const repositionEnabled = isEditor && !!url && !!onPositionChange;
  // A click that doesn't move past CLICK_SLOP_PX is treated as a tap-to-
  // replace (operator brief: "single click should change the photo").
  // Anything past the threshold is a reposition drag. Without this
  // distinction operators couldn't replace an image without using the
  // tiny "Change" pill or right-click — both undiscoverable.
  const CLICK_SLOP_PX = 4;
  const onImageMouseDown = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!isEditor || e.button !== 0) return;
    // If repositioning isn't supported on this slot, just open the
    // picker on click.
    if (!repositionEnabled) {
      triggerPicker();
      return;
    }
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const [bx, by] = parseObjectPosition(livePosition);
    let moved = false;
    dragPosRef.current = {
      baseX: bx,
      baseY: by,
      startX: e.clientX,
      startY: e.clientY,
      rectW: rect.width,
      rectH: rect.height,
      final: livePosition,
    };
    const onMove = (ev: MouseEvent) => {
      const d = dragPosRef.current;
      if (!d) return;
      const dx = ev.clientX - d.startX;
      const dy = ev.clientY - d.startY;
      if (!moved && Math.abs(dx) + Math.abs(dy) < CLICK_SLOP_PX) return;
      moved = true;
      // Drag image right → visible window slides left → object-position X falls.
      const nx = clampPct(d.baseX - (dx / d.rectW) * 100);
      const ny = clampPct(d.baseY - (dy / d.rectH) * 100);
      const next = `${nx.toFixed(1)}% ${ny.toFixed(1)}%`;
      d.final = next;
      setLivePosition(next);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      const finalPos = dragPosRef.current?.final;
      dragPosRef.current = null;
      if (!moved) {
        triggerPicker();
        return;
      }
      if (finalPos && finalPos !== position) onPositionChange?.(finalPos);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const triggerPicker = () => inputRef.current?.click();

  const handleFile = (file: File | undefined | null) => {
    if (!file) return;
    onUpload(file);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (!isEditor) return;
    e.preventDefault();
    if (onPickFromLibrary) {
      setMenuOpen(true);
    } else {
      triggerPicker();
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!isEditor) return;
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => setDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    if (!isEditor) return;
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  const overlayStyle =
    overlay === "bottom"
      ? "linear-gradient(to top, rgba(0,0,0,0.70) 0%, rgba(0,0,0,0.15) 45%, transparent 75%)"
      : overlay === "top"
        ? "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 40%)"
        : overlay === "both"
          ? "linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, transparent 25%, transparent 60%, rgba(0,0,0,0.65) 100%)"
          : null;

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ background: tokens.cardBg, ...style }}
      onContextMenu={handleContextMenu}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={alt}
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            objectPosition: livePosition,
            cursor: repositionEnabled ? "move" : undefined,
          }}
          onMouseDown={onImageMouseDown}
          draggable={false}
        />
      ) : (
        <EmptySlot
          isEditor={isEditor}
          tokens={tokens}
          onClick={triggerPicker}
          label={placeholderLabel}
          hint={placeholderHint}
          onPickFromLibrary={onPickFromLibrary}
        />
      )}

      {overlayStyle && url && (
        <div className="absolute inset-0 pointer-events-none" style={{ background: overlayStyle }} />
      )}

      {/* Dragging overlay */}
      {dragging && (
        <div
          className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none"
          style={{
            background: "rgba(27,58,45,0.55)",
            border: "2px dashed rgba(201,168,76,0.9)",
          }}
        >
          <div className="text-white text-[11px] uppercase tracking-[0.28em] font-semibold">
            Drop to upload
          </div>
        </div>
      )}

      {/* Change pill */}
      {url && isEditor && showChangePill && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            triggerPicker();
          }}
          className="absolute top-3 left-3 z-20 cursor-pointer bg-black/55 text-white text-[10.5px] px-2.5 py-1 rounded-md hover:bg-black/75 transition backdrop-blur-sm font-medium"
          title="Click to replace · right-click for options · drag a file onto the image"
        >
          Change
        </button>
      )}

      {/* Right-click context menu */}
      {menuOpen && isEditor && (
        <div
          className="absolute top-4 left-4 z-40 bg-white border border-black/10 rounded-lg shadow-xl py-1 w-56"
          onClick={(e) => e.stopPropagation()}
        >
          <MenuItem
            onClick={() => {
              setMenuOpen(false);
              triggerPicker();
            }}
            label={url ? "Replace image" : "Upload image"}
          />
          {onPickFromLibrary && (
            <MenuItem
              onClick={() => {
                setMenuOpen(false);
                onPickFromLibrary();
              }}
              label="Choose from library"
            />
          )}
          <div className="border-t border-black/5 my-1" />
          <MenuItem onClick={() => setMenuOpen(false)} label="Cancel" muted />
        </div>
      )}

      {/* Overlay children (text blocks, labels, chrome) */}
      {children}
    </div>
  );
}

function EmptySlot({
  isEditor,
  tokens,
  onClick,
  label,
  hint,
  onPickFromLibrary,
}: {
  isEditor: boolean;
  tokens: ThemeTokens;
  onClick: () => void;
  label: string;
  hint?: string;
  onPickFromLibrary?: () => void;
}) {
  if (!isEditor) {
    return (
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ background: `linear-gradient(135deg, ${tokens.cardBg}, ${tokens.sectionSurface})` }}
      >
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.05)", color: tokens.mutedText, opacity: 0.5 }}
        >
          ◻
        </div>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer transition hover:bg-black/[0.02] group"
    >
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center text-2xl transition group-hover:scale-105"
        style={{
          background: `${tokens.accent}18`,
          color: tokens.accent,
          border: `1px dashed ${tokens.accent}60`,
        }}
      >
        +
      </div>
      <div
        className="mt-3 text-[11px] uppercase tracking-[0.24em] font-semibold"
        style={{ color: tokens.mutedText }}
      >
        {label}
      </div>
      <div
        className="mt-1.5 text-[11px] text-center max-w-[200px]"
        style={{ color: tokens.mutedText, opacity: 0.75 }}
      >
        {hint ?? "Click · drag a file · right-click for options"}
      </div>
      {onPickFromLibrary && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onPickFromLibrary();
          }}
          className="mt-4 text-[11px] font-semibold underline underline-offset-2 hover:opacity-80 transition"
          style={{ color: tokens.accent }}
        >
          Choose from library
        </button>
      )}
    </button>
  );
}

function parseObjectPosition(p: string): [number, number] {
  const m = /(-?\d+(?:\.\d+)?)\s*%\s+(-?\d+(?:\.\d+)?)\s*%/.exec(p);
  if (!m) return [50, 50];
  return [Number(m[1]), Number(m[2])];
}

function clampPct(n: number): number {
  return Math.max(0, Math.min(100, n));
}

function MenuItem({
  onClick,
  label,
  muted,
}: {
  onClick: () => void;
  label: string;
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-3 py-1.5 text-[13px] hover:bg-black/[0.04] transition ${
        muted ? "text-black/45" : "text-black/75"
      }`}
    >
      {label}
    </button>
  );
}
