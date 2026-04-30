"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { HexColorPicker, HexColorInput } from "react-colorful";
import { useEditorStore } from "@/store/editorStore";
import { useProposalStore } from "@/store/proposalStore";
import { SECTION_REGISTRY } from "@/lib/sectionRegistry";

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
 * Smart repositioning: never clips edges.
 * Live preview: changes apply immediately as you drag.
 */
export function FloatingColorPicker() {
  const { floatingPicker, closeFloatingPicker, setFloatingPickerColor } = useEditorStore();
  const { proposal, updateThemeTokens, updateSectionStyleOverrides } = useProposalStore();
  const ref = useRef<HTMLDivElement>(null);
  const [initialColor] = useState(() => floatingPicker?.color ?? "");

  // Save to recent on close
  const handleClose = useCallback(() => {
    if (floatingPicker?.color) addRecentColor(floatingPicker.color);
    closeFloatingPicker();
  }, [floatingPicker, closeFloatingPicker]);

  // Revert on ESC
  const handleRevert = useCallback(() => {
    if (!floatingPicker || !initialColor) return;
    const { token, sectionId } = floatingPicker;
    if (sectionId) {
      updateSectionStyleOverrides(sectionId, { [token]: initialColor });
    } else {
      updateThemeTokens({ [token]: initialColor });
    }
    closeFloatingPicker();
  }, [floatingPicker, initialColor, updateSectionStyleOverrides, updateThemeTokens, closeFloatingPicker]);

  // Close on outside click or Escape
  useEffect(() => {
    if (!floatingPicker) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) handleClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleRevert();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [floatingPicker, handleClose, handleRevert]);

  // Mutual exclusion with the inline text toolbar's popovers — only
  // one floating colour editor at a time. We dispatch a custom
  // event on mount so the InlineTextToolbar's open menu collapses
  // immediately when this picker takes the stage.
  useEffect(() => {
    if (!floatingPicker) return;
    document.dispatchEvent(new CustomEvent("ss:close-text-popovers"));
  }, [floatingPicker]);

  if (!floatingPicker || typeof window === "undefined") return null;

  const { y, color, token, sectionId } = floatingPicker;

  // ── Right-anchored placement ─────────────────────────────────────
  // Operator brief: when the inline text toolbar is also visible,
  // its popovers open on the LEFT of the selection — so this picker
  // gets the RIGHT lane, pinned to the viewport's right edge. Click
  // X to scroll vertically based on where the click happened, but
  // never crosses the centre line. Two editors can never overlap.
  const pickerW = 232;
  const pickerH = 420;
  const margin = 12;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const posX = vw - pickerW - margin;
  let posY = y - pickerH / 2;
  posY = Math.min(Math.max(posY, margin), vh - pickerH - margin);

  // ── Live preview: apply immediately on change ──
  const handleChange = (newColor: string) => {
    setFloatingPickerColor(newColor);
    if (sectionId) {
      updateSectionStyleOverrides(sectionId, { [token]: newColor });
    } else {
      updateThemeTokens({ [token]: newColor });
    }
  };

  // ── Labels ──
  const tokenLabelMap: Record<string, string> = {
    pageBg: "Page background",
    sectionSurface: "Section background",
    cardBg: "Card background",
    dayHeadBg: "Day-head background",
    accent: "Accent color",
    secondaryAccent: "Secondary accent",
    headingText: "Heading color",
    bodyText: "Body text",
    mutedText: "Muted text",
    border: "Border color",
    buttonBg: "Button",
    badgeBg: "Badge",
  };

  // Determine scope label
  let scopeLabel = "Global theme";
  if (sectionId) {
    const section = proposal.sections.find((s) => s.id === sectionId);
    if (section) {
      const reg = SECTION_REGISTRY[section.type];
      scopeLabel = reg?.label ?? section.type;
    }
  }

  // Brand + theme swatches
  const brandColors = [
    proposal.operator.brandColors.primary,
    proposal.operator.brandColors.secondary,
  ].filter(Boolean);

  const themeSwatches = [
    proposal.theme.tokens.pageBg,
    proposal.theme.tokens.sectionSurface,
    proposal.theme.tokens.accent,
    proposal.theme.tokens.secondaryAccent,
    proposal.theme.tokens.headingText,
    proposal.theme.tokens.bodyText,
  ];

  const uniqueSwatches = [...new Set([...brandColors, ...themeSwatches])].slice(0, 8);
  const recentColors = getRecentColors().filter((c) => !uniqueSwatches.includes(c)).slice(0, 6);

  return createPortal(
    <div
      ref={ref}
      style={{ position: "fixed", left: posX, top: posY, zIndex: 9999 }}
      className="bg-white rounded-2xl shadow-2xl border border-black/10 p-4 ss-popover-in w-[232px]"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* ── Scope indicator ── */}
      <div className="flex items-center gap-1.5 mb-1">
        <div className={`w-1.5 h-1.5 rounded-full ${sectionId ? "bg-emerald-400" : "bg-blue-400"}`} />
        <span className="text-[9px] text-black/35 uppercase tracking-wider">
          {sectionId ? "Section" : "Global"}
        </span>
      </div>

      {/* Header with scope */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-[11px] font-semibold text-black/60 block">
            {tokenLabelMap[token] ?? token}
          </span>
          <span className="text-[9px] text-black/30">{scopeLabel}</span>
        </div>
        <button
          onClick={handleClose}
          className="w-5 h-5 flex items-center justify-center rounded-full text-black/30 hover:text-black/70 hover:bg-black/5 text-xs transition"
        >
          ×
        </button>
      </div>

      {/* Hue + saturation picker — live preview */}
      <HexColorPicker
        color={color}
        onChange={handleChange}
        style={{ width: "100%", height: "150px" }}
      />

      {/* Hex input + swatch */}
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

      {/* Theme colors */}
      <div className="mt-3">
        <div className="text-[9px] uppercase tracking-wider text-black/30 mb-1.5">Theme</div>
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

      {/* Actions */}
      <div className="flex gap-2 mt-3">
        {sectionId && (
          <button
            onClick={() => {
              useProposalStore.getState().resetSectionOverrides(sectionId);
              handleClose();
            }}
            className="flex-1 text-[10px] text-black/40 hover:text-black/70 py-1.5 border border-black/8 rounded-lg hover:bg-black/4 transition"
          >
            Reset to theme
          </button>
        )}
        <button
          onClick={handleRevert}
          className="text-[10px] text-black/30 hover:text-black/60 py-1.5 px-3 rounded-lg hover:bg-black/4 transition"
          title="Esc to revert"
        >
          Esc undo
        </button>
      </div>
    </div>,
    document.body
  );
}
