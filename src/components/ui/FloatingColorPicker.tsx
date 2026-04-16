"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { HexColorPicker, HexColorInput } from "react-colorful";
import { useEditorStore } from "@/store/editorStore";
import { useProposalStore } from "@/store/proposalStore";

/**
 * Portal-rendered color picker that floats at click coordinates.
 * Opened via editorStore.openFloatingPicker().
 */
export function FloatingColorPicker() {
  const { floatingPicker, closeFloatingPicker, setFloatingPickerColor } = useEditorStore();
  const { updateThemeTokens, updateSectionStyleOverrides } = useProposalStore();
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape
  useEffect(() => {
    if (!floatingPicker) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        closeFloatingPicker();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeFloatingPicker();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [floatingPicker, closeFloatingPicker]);

  if (!floatingPicker || typeof window === "undefined") return null;

  const { x, y, color, token, sectionId } = floatingPicker;

  // Keep picker on-screen
  const pickerW = 228;
  const pickerH = 310;
  const clampedX = Math.min(Math.max(x, 8), window.innerWidth - pickerW - 8);
  const clampedY = Math.min(Math.max(y, 8), window.innerHeight - pickerH - 8);

  const handleChange = (newColor: string) => {
    setFloatingPickerColor(newColor);
    if (sectionId) {
      updateSectionStyleOverrides(sectionId, { [token]: newColor });
    } else {
      updateThemeTokens({ [token]: newColor });
    }
  };

  const labelMap: Record<string, string> = {
    pageBg: "Page background",
    sectionSurface: "Section background",
    cardBg: "Card background",
    accent: "Accent color",
    secondaryAccent: "Secondary accent",
    headingText: "Heading color",
    bodyText: "Body text",
    mutedText: "Muted text",
    border: "Border color",
    buttonBg: "Button",
    badgeBg: "Badge",
  };

  return createPortal(
    <div
      ref={ref}
      style={{ position: "fixed", left: clampedX, top: clampedY, zIndex: 9999 }}
      className="bg-white rounded-2xl shadow-2xl border border-black/10 p-4 ss-popover-in"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-semibold text-black/50 uppercase tracking-wider">
          {labelMap[token] ?? token}
        </span>
        <button
          onClick={closeFloatingPicker}
          className="w-5 h-5 flex items-center justify-center rounded-full text-black/30 hover:text-black/70 hover:bg-black/5 text-xs transition"
        >
          ×
        </button>
      </div>

      {/* Hue + saturation picker */}
      <HexColorPicker
        color={color}
        onChange={handleChange}
        style={{ width: "196px", height: "150px" }}
      />

      {/* Hex input */}
      <div className="flex items-center gap-2 mt-3">
        <div
          className="w-7 h-7 rounded-md border border-black/10 shrink-0"
          style={{ background: color }}
        />
        <HexColorInput
          color={color}
          onChange={handleChange}
          prefixed
          className="flex-1 text-sm border border-black/10 rounded-lg px-2.5 py-1.5 outline-none focus:border-[#1b3a2d] font-mono uppercase"
        />
      </div>

      {/* Quick swatches */}
      <div className="flex gap-1.5 mt-3 flex-wrap">
        {["#f8f5ef", "#1b3a2d", "#c9a84c", "#ffffff", "#1a1a1a", "#e8e2d7", "#2d5a40", "#f0ebe2"].map((s) => (
          <button
            key={s}
            onClick={() => handleChange(s)}
            className="w-5 h-5 rounded-md border border-black/10 hover:scale-110 transition"
            style={{ background: s }}
            title={s}
          />
        ))}
      </div>

      {/* Reset (section-level only) */}
      {sectionId && (
        <button
          onClick={() => {
            useProposalStore.getState().resetSectionOverrides(sectionId);
            closeFloatingPicker();
          }}
          className="mt-3 w-full text-[11px] text-black/40 hover:text-black/70 py-1 border border-black/8 rounded-lg hover:bg-black/4 transition"
        >
          Reset to theme
        </button>
      )}
    </div>,
    document.body
  );
}
