"use client";

import { useState } from "react";
import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import { resolveTokens } from "@/lib/theme";
import { IntelligentColorPicker } from "@/components/ui/IntelligentColorPicker";
import type { Section } from "@/lib/types";

// ─── DividerSection ──────────────────────────────────────────────────────
//
// Sits between adjacent content sections to give the proposal visible
// rhythm. Operator brief: every section needs to read as separate from
// the next, with a coloured band that's the same height as the day
// card's top strip and independently colourable.
//
// Variants:
//   band (default)  — solid coloured strip, ~52px tall, matches the
//                     day-head height. The user-facing variant.
//   ornamental      — Hairline rule + ornament — kept for back-compat.
//   spacious        — Generous whitespace + hairline — kept for back-compat.
//   line            — Tight whitespace + hairline — kept for back-compat.
//
// Color: section.content.color (band variant only). Operator can edit
// inline by clicking the band in editor mode — opens the
// IntelligentColorPicker. Falls back to the theme's secondary accent
// (gold) when unset so a freshly-inserted divider is never invisible.

const DEFAULT_BAND_COLOR_FALLBACK = "#c9a84c";

export function DividerSection({ section }: { section: Section }) {
  const { proposal, updateSectionContent } = useProposalStore();
  const { mode } = useEditorStore();
  const isEditor = mode === "editor";
  const tokens = resolveTokens(proposal.theme.tokens, section.styleOverrides);

  // ── Band variant (the new default) ─────────────────────────────────
  if (section.layoutVariant === "band" || !section.layoutVariant) {
    const color =
      (section.content.color as string) ||
      tokens.secondaryAccent ||
      DEFAULT_BAND_COLOR_FALLBACK;
    return (
      <BandDivider
        color={color}
        isEditor={isEditor}
        onColorChange={(c) => updateSectionContent(section.id, { color: c })}
      />
    );
  }

  if (section.layoutVariant === "ornamental") {
    return (
      <div className="py-8 flex items-center justify-center gap-4" style={{ background: tokens.sectionSurface }}>
        <div className="h-px flex-1 max-w-32" style={{ background: tokens.border }} />
        <span className="text-lg" style={{ color: tokens.secondaryAccent }}>✦</span>
        <div className="h-px flex-1 max-w-32" style={{ background: tokens.border }} />
      </div>
    );
  }
  if (section.layoutVariant === "spacious") {
    return (
      <div className="py-12 px-8 md:px-16" style={{ background: tokens.sectionSurface }}>
        <div className="max-w-5xl mx-auto h-px" style={{ background: tokens.border }} />
      </div>
    );
  }
  return (
    <div className="py-6 px-8 md:px-16" style={{ background: tokens.sectionSurface }}>
      <div className="max-w-5xl mx-auto h-px" style={{ background: tokens.border }} />
    </div>
  );
}

// ─── Band variant ────────────────────────────────────────────────────────
//
// Thin coloured strip — height 52px (matches the day-card head's natural
// height: py-5 padding + ~14px content). Operator clicks anywhere on
// the band in editor mode to open the colour picker.

function BandDivider({
  color,
  isEditor,
  onColorChange,
}: {
  color: string;
  isEditor: boolean;
  onColorChange: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <div
        onClick={isEditor ? () => setOpen((v) => !v) : undefined}
        className={`w-full transition-shadow ${isEditor ? "cursor-pointer hover:shadow-inner" : ""}`}
        style={{ background: color, height: 52 }}
        role={isEditor ? "button" : undefined}
        aria-label={isEditor ? "Edit divider colour" : undefined}
      />
      {isEditor && (
        <div
          className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/55 backdrop-blur-sm text-white text-[10.5px] font-semibold pointer-events-none"
          aria-hidden
        >
          <span
            className="w-3 h-3 rounded-full inline-block"
            style={{ background: color, border: "1px solid rgba(255,255,255,0.4)" }}
          />
          Click to recolour
        </div>
      )}
      {open && isEditor && (
        <div
          className="absolute z-50 right-3 top-[calc(100%+8px)] bg-[#1a1a1a] rounded-xl shadow-2xl p-3 border border-white/10"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <IntelligentColorPicker
            value={color}
            onChange={(hex) => onColorChange(hex)}
            presets={DIVIDER_PRESETS}
          />
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[11px] text-white/60 hover:text-white px-2 py-1"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const DIVIDER_PRESETS = [
  { value: "#c9a84c", label: "Gold" },
  { value: "#1b3a2d", label: "Forest" },
  { value: "#2d5a40", label: "Sage" },
  { value: "#b06a3b", label: "Copper" },
  { value: "#b34334", label: "Brick" },
  { value: "#3a6ea5", label: "Indigo" },
  { value: "#101828", label: "Charcoal" },
  { value: "#f5e8d8", label: "Cream" },
  { value: "#ffffff", label: "White" },
];
