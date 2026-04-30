"use client";

import { useState } from "react";
import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import { IntelligentColorPicker } from "@/components/ui/IntelligentColorPicker";
import type { Section } from "@/lib/types";

// ─── SectionHeaderStrip ─────────────────────────────────────────────────
//
// The coloured top strip every section (except cover, personal note,
// and day cards) wears like a hat. Identical visual register to the
// day card's day-head strip — same height, same typography, same
// inline 🎨 editor at the right — so the proposal reads as one
// rhythm of coloured bands.
//
// Operator brief: "every section should have a separator at the top.
// Independent of the section. The editor on it should edit this
// strip's color and the section underneath's background. Even
// between properties in the accommodation section, each should have
// a header separation."
//
// Storage:
//   color   → section.styleOverrides.headerBg
//   bg      → section.styleOverrides.sectionSurface
//   accent  → section.styleOverrides.accent (optional, used by some
//              section layouts for buttons, day badges, etc.)
//
// Falls back to section.content.color (legacy band-divider entries
// migrate cleanly) and finally to a sensible gold so a freshly-added
// strip is never invisible.

const DEFAULT_HEADER_COLOR = "#c9a84c";

export function SectionHeaderStrip({
  section,
  title,
  subtitle,
  variant = "default",
}: {
  section: Section;
  /** UPPERCASE label rendered as the strip's primary text. */
  title: string;
  /** Optional secondary text rendered after a · separator. */
  subtitle?: string;
  /** "compact" reduces the strip's height to ~40px (used between
   *  properties in the accommodation showcase so the rhythm stays
   *  readable when there are 4-6 properties stacked). Default 52px
   *  matches the day-card head strip. */
  variant?: "default" | "compact";
}) {
  const { mode } = useEditorStore();
  const isEditor = mode === "editor";
  const updateSectionStyleOverrides = useProposalStore((s) => s.updateSectionStyleOverrides);
  const [open, setOpen] = useState(false);
  const [field, setField] = useState<"headerBg" | "sectionSurface" | "accent">("headerBg");

  const overrides = section.styleOverrides ?? {};
  const headerBg =
    (overrides.headerBg as string | undefined) ||
    (section.content.color as string | undefined) ||
    DEFAULT_HEADER_COLOR;
  const sectionBg = (overrides.sectionSurface as string | undefined) || "#ffffff";
  const accent = (overrides.accent as string | undefined) || "";

  const setOverride = (key: "headerBg" | "sectionSurface" | "accent", value: string) => {
    updateSectionStyleOverrides(section.id, { [key]: value });
  };

  const height = variant === "compact" ? 40 : 52;
  const titleSize = variant === "compact" ? "11px" : "13px";

  return (
    <div
      className="relative w-full flex items-center gap-3 px-6 md:px-10"
      style={{
        background: headerBg,
        height,
        color: autoTextOnHex(headerBg),
      }}
    >
      <span
        className="font-bold uppercase tracking-[0.24em] truncate"
        style={{ fontSize: titleSize }}
      >
        {title}
      </span>
      {subtitle && (
        <span
          className="uppercase tracking-[0.2em] truncate opacity-80"
          style={{ fontSize: variant === "compact" ? "9.5px" : "11px" }}
        >
          · {subtitle}
        </span>
      )}
      {isEditor && (
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setOpen((v) => !v);
              setField("headerBg");
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/55 backdrop-blur-sm text-white text-[10.5px] font-semibold shadow-md hover:bg-black/75 transition"
            title="Edit colours"
          >
            <span aria-hidden>🎨</span>
            <span>Colours</span>
          </button>
        </div>
      )}
      {open && isEditor && (
        <div
          className="absolute right-3 top-[calc(100%+8px)] z-50 w-[300px] bg-[#1a1a1a] rounded-xl shadow-2xl border border-white/10 overflow-hidden"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Field selector — strip · section · accent */}
          <div className="grid grid-cols-3 border-b border-white/10">
            {(
              [
                { key: "headerBg", label: "Strip", swatch: headerBg },
                { key: "sectionSurface", label: "Section", swatch: sectionBg },
                { key: "accent", label: "Accent", swatch: accent || "transparent" },
              ] as const
            ).map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setField(f.key)}
                className={`px-2 py-2 text-[10.5px] font-semibold uppercase tracking-wider transition ${
                  field === f.key ? "bg-white/15 text-white" : "text-white/60 hover:bg-white/8 hover:text-white"
                }`}
              >
                <div className="flex items-center justify-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full inline-block"
                    style={{
                      background: f.swatch,
                      border:
                        f.swatch === "transparent" || !f.swatch
                          ? "1px dashed rgba(255,255,255,0.35)"
                          : "1px solid rgba(255,255,255,0.25)",
                    }}
                  />
                  {f.label}
                </div>
              </button>
            ))}
          </div>
          <div className="p-3">
            <IntelligentColorPicker
              value={
                field === "headerBg"
                  ? headerBg
                  : field === "sectionSurface"
                    ? sectionBg
                    : accent || "#1b3a2d"
              }
              onChange={(hex) => setOverride(field, hex)}
              presets={STRIP_PRESETS}
            />
          </div>
          <div className="p-2 border-t border-white/10 flex justify-end">
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

// Pick black or white text against the strip's bg luminance.
// Exported so per-property header bands in PropertyShowcaseSection share
// the same readability rule without duplicating the WCAG math.
export function autoTextOnHex(bg: string): string {
  const cleaned = bg.replace(/^#/, "");
  const full = cleaned.length === 3 ? cleaned.split("").map((c) => c + c).join("") : cleaned.slice(0, 6);
  if (full.length !== 6) return "#101828";
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  const channel = (n: number) => {
    const v = n / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const lum = 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  return lum > 0.55 ? "#101828" : "#ffffff";
}

const STRIP_PRESETS = [
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
