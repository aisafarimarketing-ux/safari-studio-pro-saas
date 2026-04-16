"use client";

import { useProposalStore } from "@/store/proposalStore";
import { ColorPickerPopover } from "@/components/ui/ColorPickerPopover";
import { FontSelector } from "@/components/ui/FontSelector";
import { COLOR_PRESETS } from "@/lib/theme";
import type { ThemeTokens } from "@/lib/types";

const PRESET_NAMES = [
  { key: "forest", label: "Forest", colors: ["#1b3a2d", "#c9a84c", "#f3f0ea"] },
  { key: "ivory", label: "Ivory", colors: ["#3d2b1f", "#a0845c", "#faf8f3"] },
  { key: "dusk", label: "Dusk", colors: ["#4a3728", "#b8936a", "#f0eeeb"] },
  { key: "slate", label: "Slate", colors: ["#1e2d3d", "#4a7fa5", "#f0f2f4"] },
];

const TOKEN_LABELS: [keyof ThemeTokens, string][] = [
  ["pageBg", "Page background"],
  ["sectionSurface", "Section surface"],
  ["cardBg", "Card background"],
  ["accent", "Primary accent"],
  ["secondaryAccent", "Secondary accent"],
  ["headingText", "Heading text"],
  ["bodyText", "Body text"],
  ["mutedText", "Muted text"],
  ["border", "Border / rule"],
  ["buttonBg", "Button background"],
  ["badgeBg", "Badge background"],
];

export function ThemePanel() {
  const { proposal, applyPreset, updateThemeTokens } = useProposalStore();
  const { tokens, preset } = proposal.theme;

  return (
    <div className="space-y-6">
      {/* Presets */}
      <div>
        <div className="text-[11px] uppercase tracking-widest text-black/40 mb-3">Theme preset</div>
        <div className="grid grid-cols-2 gap-2">
          {PRESET_NAMES.map((p) => (
            <button
              key={p.key}
              onClick={() => applyPreset(p.key)}
              className={`p-3 rounded-xl border-2 transition text-left ${
                preset === p.key ? "border-[#1b3a2d]" : "border-black/8 hover:border-black/20"
              }`}
            >
              <div className="flex gap-1 mb-2">
                {p.colors.map((c) => (
                  <div key={c} className="w-4 h-4 rounded-full border border-black/10" style={{ background: c }} />
                ))}
              </div>
              <div className="text-xs font-medium text-black/70">{p.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Color tokens */}
      <div>
        <div className="text-[11px] uppercase tracking-widest text-black/40 mb-3">Colors</div>
        <div className="space-y-2">
          {TOKEN_LABELS.map(([key, label]) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-xs text-black/60">{label}</span>
              <ColorPickerPopover
                value={tokens[key]}
                onChange={(c) => updateThemeTokens({ [key]: c })}
                brandColors={[proposal.operator.brandColors.primary, proposal.operator.brandColors.secondary]}
                label={label}
              >
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-black/10 hover:border-black/25 transition cursor-pointer">
                  <div
                    className="w-4 h-4 rounded-sm border border-black/15"
                    style={{ background: tokens[key] }}
                  />
                  <span className="text-[11px] font-mono text-black/50">{tokens[key]}</span>
                </div>
              </ColorPickerPopover>
            </div>
          ))}
        </div>
      </div>

      {/* Fonts */}
      <div>
        <div className="text-[11px] uppercase tracking-widest text-black/40 mb-3">Typography</div>
        <FontSelector />
      </div>
    </div>
  );
}
