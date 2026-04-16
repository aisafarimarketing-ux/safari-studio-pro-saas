"use client";

import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import { ColorPickerPopover } from "@/components/ui/ColorPickerPopover";
import { SECTION_REGISTRY } from "@/lib/sectionRegistry";
import type { ThemeTokens } from "@/lib/types";

const OVERRIDE_LABELS: [keyof ThemeTokens, string][] = [
  ["sectionSurface", "Section background"],
  ["cardBg", "Card background"],
  ["headingText", "Heading color"],
  ["bodyText", "Body text color"],
  ["accent", "Accent color"],
  ["border", "Border color"],
];

export function SectionPanel() {
  const { proposal, updateSectionVariant, updateSectionStyleOverrides, resetSectionOverrides } = useProposalStore();
  const { selectedSectionId } = useEditorStore();

  const section = proposal.sections.find((s) => s.id === selectedSectionId);
  if (!section) return <div className="text-sm text-black/40">Select a section to edit its style</div>;

  const def = SECTION_REGISTRY[section.type];
  const tokens = proposal.theme.tokens;

  return (
    <div className="space-y-5">
      {/* Section info */}
      <div>
        <div className="text-sm font-semibold text-black/70">{def.label}</div>
        <div className="text-xs text-black/40 mt-0.5">{def.description}</div>
      </div>

      {/* Layout variant */}
      {def.variants.length > 1 && (
        <div>
          <div className="text-[11px] uppercase tracking-widest text-black/40 mb-2">Layout</div>
          <div className="space-y-1">
            {def.variants.map((v) => (
              <button
                key={v}
                onClick={() => updateSectionVariant(section.id, v)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${
                  section.layoutVariant === v
                    ? "bg-[#1b3a2d] text-white"
                    : "hover:bg-black/5 text-black/60"
                }`}
              >
                {v.replace(/-/g, " ")}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Color overrides */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-[11px] uppercase tracking-widest text-black/40">Colors</div>
          {Object.keys(section.styleOverrides).length > 0 && (
            <button
              onClick={() => resetSectionOverrides(section.id)}
              className="text-[10px] text-black/30 hover:text-black/60 transition"
            >
              Reset to theme
            </button>
          )}
        </div>
        <div className="space-y-2">
          {OVERRIDE_LABELS.map(([key, label]) => {
            const current = section.styleOverrides[key] ?? tokens[key];
            const isOverridden = !!section.styleOverrides[key];
            return (
              <div key={key} className="flex items-center justify-between">
                <span className={`text-xs ${isOverridden ? "text-black/80 font-medium" : "text-black/50"}`}>
                  {label}
                  {isOverridden && <span className="ml-1 text-[9px] text-[#c9a84c]">●</span>}
                </span>
                <ColorPickerPopover
                  value={current}
                  onChange={(c) => updateSectionStyleOverrides(section.id, { [key]: c })}
                  brandColors={[proposal.operator.brandColors.primary, proposal.operator.brandColors.secondary]}
                  label={label}
                >
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-black/10 hover:border-black/25 transition cursor-pointer">
                    <div className="w-4 h-4 rounded-sm border border-black/15" style={{ background: current }} />
                    <span className="text-[11px] font-mono text-black/50 w-14 truncate">{current}</span>
                  </div>
                </ColorPickerPopover>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
