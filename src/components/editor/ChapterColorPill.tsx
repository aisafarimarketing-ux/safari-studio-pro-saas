"use client";

import { useEffect, useRef, useState } from "react";
import { useProposalStore } from "@/store/proposalStore";
import { IntelligentColorPicker } from "@/components/ui/IntelligentColorPicker";
import type { StyleOverrides } from "@/lib/types";

// ─── ChapterColorPill ───────────────────────────────────────────────────
//
// Tiny 🎨 pill that floats next to a chapter's ✦ AI pill in spread
// mode. Click → field selector (Section · Card · Accent) → colour
// picker → the chapter's underlying section receives a styleOverrides
// patch.
//
// Writes through updateSectionStyleOverrides so the change carries
// when the operator flips back to magazine view (single source of
// truth for section colours). Each chapter is responsible for
// resolving tokens locally with its section's overrides so the new
// colour shows in spread immediately — same pattern magazine view
// already uses.

type FieldKey = "sectionSurface" | "cardBg" | "accent" | "headerBg";

interface FieldSpec {
  key: FieldKey;
  label: string;
}

const PRESETS = [
  { value: "#ffffff", label: "White" },
  { value: "#f9f6f0", label: "Cream" },
  { value: "#f3f0ea", label: "Sand" },
  { value: "#f5e8d8", label: "Buff" },
  { value: "#1b3a2d", label: "Forest" },
  { value: "#2d5a40", label: "Sage" },
  { value: "#c9a84c", label: "Gold" },
  { value: "#b06a3b", label: "Copper" },
  { value: "#101828", label: "Charcoal" },
];

export function ChapterColorPill({
  sectionId,
  fields,
  overrides,
}: {
  sectionId: string;
  /** Which colour fields the chapter exposes. Keep it small (2-3) so
   *  the picker doesn't sprawl. */
  fields: FieldSpec[];
  /** Current overrides on the section; the picker shows these as the
   *  starting values. */
  overrides: StyleOverrides;
}) {
  const updateSectionStyleOverrides = useProposalStore(
    (s) => s.updateSectionStyleOverrides,
  );
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<FieldKey | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const setField = (key: FieldKey, value: string | undefined) => {
    updateSectionStyleOverrides(sectionId, { [key]: value });
  };

  const currentColor = (key: FieldKey): string => {
    const v = overrides[key];
    return typeof v === "string" && v ? v : "#ffffff";
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/55 backdrop-blur-sm text-white text-[10.5px] font-semibold shadow-md hover:bg-black/75 transition"
        title="Chapter colours"
      >
        <span aria-hidden>🎨</span>
        <span>Colours</span>
      </button>
      {open && (
        <div
          className="absolute right-0 top-[calc(100%+8px)] bg-[#1a1a1a] rounded-xl shadow-2xl border border-white/10 overflow-hidden"
          style={{ width: 280 }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-2 border-b border-white/10">
            <div className="text-[9.5px] uppercase tracking-[0.22em] text-white/45 font-semibold">
              Chapter colours
            </div>
          </div>
          <div className="p-2 flex flex-col gap-1">
            {fields.map((f) => {
              const isActive = active === f.key;
              const cur = (overrides[f.key] as string | undefined) || "";
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setActive(isActive ? null : f.key)}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12px] text-left transition ${
                    isActive
                      ? "bg-white/15 text-white"
                      : "text-white/80 hover:bg-white/8 hover:text-white"
                  }`}
                >
                  <span
                    className="w-4 h-4 rounded-full shrink-0"
                    style={{
                      background: cur || "transparent",
                      border:
                        cur === "" || !cur
                          ? "1px dashed rgba(255,255,255,0.3)"
                          : "1px solid rgba(255,255,255,0.2)",
                    }}
                    aria-hidden
                  />
                  <span className="flex-1">{f.label}</span>
                  {cur && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        setField(f.key, undefined);
                        if (active === f.key) setActive(null);
                      }}
                      className="text-white/40 hover:text-white text-[10px] underline cursor-pointer"
                      title="Reset to theme default"
                    >
                      reset
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {active && (
            <div className="p-3 border-t border-white/10">
              <IntelligentColorPicker
                value={currentColor(active)}
                onChange={(hex) => setField(active, hex)}
                presets={PRESETS}
              />
            </div>
          )}
          <div className="p-2 border-t border-white/10 flex justify-end">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setActive(null);
              }}
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
