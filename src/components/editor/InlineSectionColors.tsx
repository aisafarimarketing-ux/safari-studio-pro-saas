"use client";

import { useState } from "react";
import { useProposalStore } from "@/store/proposalStore";
import { IntelligentColorPicker } from "@/components/ui/IntelligentColorPicker";
import type { Section, StyleOverrides } from "@/lib/types";

// ─── InlineSectionColors ────────────────────────────────────────────────
//
// Small "🎨 Colours" pill that sits at the top of each day card and each
// property card in editor mode. Click → opens a popover with up to three
// colour pickers (section background, card-head strip, accent). Writes
// to section.styleOverrides; image-area backgrounds inside the card
// are deliberately untouched.
//
// Operator brief: "Each day card and each property to have editor at
// the top that will change the section's colours but not the image
// section backgrounds."
//
// Why this lives in editor/ not sections/: the same component is
// dropped into multiple section layouts (FlipCard, EditorialStackCard,
// PropertyShowcaseSection) — keeping it editor-only avoids polluting
// the share view with the pill.

type FieldKey = "sectionSurface" | "dayHeadBg" | "accent" | "cardBg";

interface FieldSpec {
  key: FieldKey;
  label: string;
}

const DEFAULT_FIELDS: FieldSpec[] = [
  { key: "sectionSurface", label: "Section background" },
  { key: "dayHeadBg", label: "Card head strip" },
  { key: "accent", label: "Accent" },
];

const PROPERTY_FIELDS: FieldSpec[] = [
  { key: "sectionSurface", label: "Section background" },
  { key: "cardBg", label: "Card body" },
  { key: "accent", label: "Accent" },
];

export function InlineSectionColors({
  section,
  variant = "day",
}: {
  section: Section;
  /** Picks which fields show — day cards expose Section / Day-head /
   *  Accent; property cards expose Section / Card / Accent. */
  variant?: "day" | "property";
}) {
  const updateSectionStyleOverrides = useProposalStore((s) => s.updateSectionStyleOverrides);
  const [open, setOpen] = useState(false);
  const [activeField, setActiveField] = useState<FieldKey | null>(null);

  const fields = variant === "property" ? PROPERTY_FIELDS : DEFAULT_FIELDS;
  const overrides: StyleOverrides = section.styleOverrides ?? {};

  const setField = (key: FieldKey, value: string | undefined) => {
    // Pass `undefined` to wipe the override; pass a hex to set it. The
    // store action mutates the section's styleOverrides in place via
    // Object.assign, so a wipe needs to set the key to undefined and
    // the resolveTokens path treats undefined as "fall back to theme".
    updateSectionStyleOverrides(section.id, { [key]: value });
  };

  return (
    <div className="absolute top-3 right-3 z-30 ss-section-colors">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/55 backdrop-blur-sm text-white text-[10.5px] font-semibold shadow-md hover:bg-black/75 transition"
        title="Edit section colours"
      >
        <span aria-hidden>🎨</span>
        <span>Colours</span>
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-[280px] bg-[#1a1a1a] rounded-xl shadow-2xl border border-white/10 overflow-hidden"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Field selector */}
          <div className="p-2 flex flex-col gap-1">
            {fields.map((f) => {
              const current = (overrides[f.key] as string | undefined) ?? "";
              const active = activeField === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setActiveField(active ? null : f.key)}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[12px] text-left transition ${
                    active ? "bg-white/15 text-white" : "text-white/75 hover:bg-white/8 hover:text-white"
                  }`}
                >
                  <span
                    className="w-4 h-4 rounded-full shrink-0"
                    style={{
                      background: current || "transparent",
                      border:
                        current === "" || !current
                          ? "1px dashed rgba(255,255,255,0.3)"
                          : "1px solid rgba(255,255,255,0.2)",
                    }}
                    aria-hidden
                  />
                  <span className="flex-1">{f.label}</span>
                  {current && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setField(f.key, undefined);
                        if (activeField === f.key) setActiveField(null);
                      }}
                      className="text-white/40 hover:text-white text-[10px]"
                      title="Reset to theme default"
                    >
                      reset
                    </button>
                  )}
                </button>
              );
            })}
          </div>
          {activeField && (
            <div className="p-3 border-t border-white/10">
              <IntelligentColorPicker
                value={(overrides[activeField] as string | undefined) || "#ffffff"}
                onChange={(hex) => setField(activeField, hex)}
                presets={SECTION_PRESETS}
              />
            </div>
          )}
          <div className="p-2 border-t border-white/10 flex justify-end">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setActiveField(null);
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

const SECTION_PRESETS = [
  { value: "#ffffff", label: "White" },
  { value: "#f9f6f0", label: "Cream" },
  { value: "#f3f0ea", label: "Sand" },
  { value: "#f5e8d8", label: "Buff" },
  { value: "#1b3a2d", label: "Forest" },
  { value: "#2d5a40", label: "Sage" },
  { value: "#c9a84c", label: "Gold" },
  { value: "#101828", label: "Charcoal" },
  { value: "#000000", label: "Black" },
];
