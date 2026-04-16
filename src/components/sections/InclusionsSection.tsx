"use client";

import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import type { Section } from "@/lib/types";

export function InclusionsSection({ section: _section }: { section: Section }) {
  const { proposal, updateInclusions, updateExclusions } = useProposalStore();
  const { mode } = useEditorStore();
  const isEditor = mode === "editor";
  const { inclusions, exclusions, theme } = proposal;
  const tokens = theme.tokens;

  const handleInclusionBlur = (index: number, value: string) => {
    const updated = [...inclusions];
    updated[index] = value;
    updateInclusions(updated.filter((s) => s.trim()));
  };

  const handleExclusionBlur = (index: number, value: string) => {
    const updated = [...exclusions];
    updated[index] = value;
    updateExclusions(updated.filter((s) => s.trim()));
  };

  const addItem = (type: "inclusion" | "exclusion") => {
    if (type === "inclusion") updateInclusions([...inclusions, "New item"]);
    else updateExclusions([...exclusions, "New item"]);
  };

  return (
    <div className="py-20 md:py-24 px-8 md:px-20" style={{ background: tokens.sectionSurface }}>
      <div className="max-w-5xl mx-auto">
        <div className="text-[10px] uppercase tracking-[0.3em] mb-12" style={{ color: tokens.mutedText }}>
          Inclusions &amp; exclusions
        </div>

        <div className="grid md:grid-cols-2 gap-12 md:gap-16">
          {/* Included */}
          <div>
            <div
              className="text-[11px] uppercase tracking-[0.22em] font-semibold mb-7 pb-4 border-b"
              style={{ color: tokens.accent, borderColor: `${tokens.accent}25` }}
            >
              What&apos;s included
            </div>
            <ul className="space-y-4">
              {inclusions.map((item, i) => (
                <li key={i} className="flex items-start gap-4">
                  <span className="text-[10px] mt-[3px] shrink-0 font-bold" style={{ color: tokens.accent }}>✓</span>
                  <span
                    className="text-[13.5px] leading-relaxed outline-none"
                    style={{ color: tokens.bodyText, fontFamily: `'${theme.bodyFont}', sans-serif` }}
                    contentEditable={isEditor}
                    suppressContentEditableWarning
                    onBlur={(e) => handleInclusionBlur(i, e.currentTarget.textContent ?? item)}
                  >
                    {item}
                  </span>
                </li>
              ))}
              {isEditor && (
                <li>
                  <button
                    onClick={() => addItem("inclusion")}
                    className="text-xs transition pl-8"
                    style={{ color: tokens.mutedText }}
                  >
                    + Add item
                  </button>
                </li>
              )}
            </ul>
          </div>

          {/* Excluded */}
          <div>
            <div
              className="text-[11px] uppercase tracking-[0.22em] font-semibold mb-7 pb-4 border-b"
              style={{ color: tokens.mutedText, borderColor: tokens.border }}
            >
              Not included
            </div>
            <ul className="space-y-4">
              {exclusions.map((item, i) => (
                <li key={i} className="flex items-start gap-4">
                  <span className="text-[10px] mt-[3px] shrink-0" style={{ color: tokens.border }}>—</span>
                  <span
                    className="text-[13.5px] leading-relaxed outline-none"
                    style={{ color: tokens.mutedText, fontFamily: `'${theme.bodyFont}', sans-serif` }}
                    contentEditable={isEditor}
                    suppressContentEditableWarning
                    onBlur={(e) => handleExclusionBlur(i, e.currentTarget.textContent ?? item)}
                  >
                    {item}
                  </span>
                </li>
              ))}
              {isEditor && (
                <li>
                  <button
                    onClick={() => addItem("exclusion")}
                    className="text-xs transition pl-8"
                    style={{ color: tokens.mutedText }}
                  >
                    + Add item
                  </button>
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
