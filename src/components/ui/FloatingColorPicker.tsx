"use client";

import { useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { HexColorPicker, HexColorInput } from "react-colorful";
import { useEditorStore } from "@/store/editorStore";
import { useProposalStore } from "@/store/proposalStore";

/** Persist recent colors to localStorage */
const RECENT_KEY = "ss-recent-colors";
const MAX_RECENT = 8;

function getRecentColors(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function addRecentColor(color: string) {
  const recent = getRecentColors().filter((c) => c !== color);
  recent.unshift(color);
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}

/**
 * Portal-rendered color picker that floats at click coordinates.
 * Opened via editorStore.openFloatingPicker().
 */
export function FloatingColorPicker() {
  const { floatingPicker, closeFloatingPicker, setFloatingPickerColor } = useEditorStore();
  const { proposal, updateThemeTokens, updateSectionStyleOverrides } = useProposalStore();
  const ref = useRef<HTMLDivElement>(null);

  // Save to recent on close
  const handleClose = useCallback(() => {
    if (floatingPicker?.color) addRecentColor(floatingPicker.color);
    closeFloatingPicker();
  }, [floatingPicker, closeFloatingPicker]);

  // Close on outside click or Escape
  useEffect(() => {
    if (!floatingPicker) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) handleClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [floatingPicker, handleClose]);

  if (!floatingPicker || typeof window === "undefined") return null;

  const { x, y, color, token, sectionId } = floatingPicker;

  // Keep picker on-screen
  const pickerW = 228;
  const pickerH = 400;
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

  // Brand colors from operator profile
  const brandColors = [
    proposal.operator.brandColors.primary,
    proposal.operator.brandColors.secondary,
  ].filter(Boolean);

  // Current theme colors (useful swatches)
  const themeSwatches = [
    proposal.theme.tokens.pageBg,
    proposal.theme.tokens.sectionSurface,
    proposal.theme.tokens.accent,
    proposal.theme.tokens.secondaryAccent,
    proposal.theme.tokens.headingText,
    proposal.theme.tokens.bodyText,
  ];

  // Deduplicate
  const uniqueSwatches = [...new Set([...brandColors, ...themeSwatches])].slice(0, 8);
  const recentColors = getRecentColors().filter((c) => !uniqueSwatches.includes(c)).slice(0, 6);

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
          onClick={handleClose}
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

      {/* Brand & theme colors */}
      <div className="mt-3">
        <div className="text-[9px] uppercase tracking-wider text-black/30 mb-1.5">Theme colors</div>
        <div className="flex gap-1.5 flex-wrap">
          {uniqueSwatches.map((s) => (
            <button
              key={s}
              onClick={() => handleChange(s)}
              className={`w-5 h-5 rounded-md border hover:scale-110 transition ${color === s ? "border-black/40 ring-1 ring-black/20" : "border-black/10"}`}
              style={{ background: s }}
              title={s}
            />
          ))}
        </div>
      </div>

      {/* Recent colors */}
      {recentColors.length > 0 && (
        <div className="mt-2.5">
          <div className="text-[9px] uppercase tracking-wider text-black/30 mb-1.5">Recent</div>
          <div className="flex gap-1.5 flex-wrap">
            {recentColors.map((s) => (
              <button
                key={s}
                onClick={() => handleChange(s)}
                className="w-5 h-5 rounded-md border border-black/10 hover:scale-110 transition"
                style={{ background: s }}
                title={s}
              />
            ))}
          </div>
        </div>
      )}

      {/* Reset (section-level only) */}
      {sectionId && (
        <button
          onClick={() => {
            useProposalStore.getState().resetSectionOverrides(sectionId);
            handleClose();
          }}
          className="mt-3 w-full text-[11px] text-black/40 hover:text-black/70 py-1.5 border border-black/8 rounded-lg hover:bg-black/4 transition"
        >
          Reset to theme
        </button>
      )}
    </div>,
    document.body
  );
}
