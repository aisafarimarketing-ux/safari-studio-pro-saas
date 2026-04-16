"use client";

import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import type { Section } from "@/lib/types";

export function InclusionsSection({ section }: { section: Section }) {
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
    <div className="py-16 px-8 md:px-16" style={{ background: tokens.sectionSurface }}>
      <div className="max-w-5xl mx-auto">
        <div className="text-[11px] uppercase tracking-[0.22em] mb-10" style={{ color: tokens.mutedText }}>
          Inclusions & Exclusions
        </div>

        <div className="grid md:grid-cols-2 gap-10">
          {/* Included */}
          <div>
            <div className="text-sm font-semibold uppercase tracking-widest mb-5" style={{ color: tokens.accent }}>
              What&apos;s included
            </div>
            <ul className="space-y-3">
              {inclusions.map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="text-base mt-0.5 shrink-0" style={{ color: tokens.accent }}>✓</span>
                  <span
                    className="text-sm leading-relaxed outline-none"
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
                    className="text-xs text-black/30 hover:text-black/60 transition"
                  >
                    + Add item
                  </button>
                </li>
              )}
            </ul>
          </div>

          {/* Excluded */}
          <div>
            <div className="text-sm font-semibold uppercase tracking-widest mb-5" style={{ color: tokens.mutedText }}>
              Not included
            </div>
            <ul className="space-y-3">
              {exclusions.map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="text-base mt-0.5 shrink-0" style={{ color: tokens.border }}>✗</span>
                  <span
                    className="text-sm leading-relaxed outline-none"
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
                    className="text-xs text-black/30 hover:text-black/60 transition"
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
