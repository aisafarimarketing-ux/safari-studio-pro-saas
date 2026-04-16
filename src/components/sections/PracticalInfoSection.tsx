"use client";

import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import type { Section } from "@/lib/types";

export function PracticalInfoSection({ section }: { section: Section }) {
  const { proposal, addPracticalCard, removePracticalCard, updatePracticalCard } = useProposalStore();
  const { mode } = useEditorStore();
  const isEditor = mode === "editor";
  const { practicalInfo, theme } = proposal;
  const tokens = theme.tokens;
  const isGrid = section.layoutVariant === "card-grid";

  return (
    <div className="py-16 px-8 md:px-16" style={{ background: tokens.pageBg }}>
      <div className="max-w-5xl mx-auto">
        <div className="text-[11px] uppercase tracking-[0.22em] mb-10" style={{ color: tokens.mutedText }}>
          Good to know
        </div>

        <div className={`${isGrid ? "grid grid-cols-1 md:grid-cols-2 gap-5" : "space-y-4"}`}>
          {practicalInfo.map((card) => (
            <div
              key={card.id}
              className="relative rounded-xl p-6 border"
              style={{ background: tokens.sectionSurface, borderColor: tokens.border }}
            >
              {isEditor && (
                <button
                  onClick={() => removePracticalCard(card.id)}
                  className="absolute top-3 right-3 text-xs text-black/30 hover:text-red-500 transition"
                >
                  ×
                </button>
              )}
              <div className="flex items-start gap-3">
                <span className="text-xl shrink-0">{card.icon ?? "ℹ"}</span>
                <div className="flex-1 min-w-0">
                  <div
                    className="font-semibold text-sm mb-1 outline-none"
                    style={{ color: tokens.headingText, fontFamily: `'${theme.bodyFont}', sans-serif` }}
                    contentEditable={isEditor}
                    suppressContentEditableWarning
                    onBlur={(e) => updatePracticalCard(card.id, { title: e.currentTarget.textContent ?? card.title })}
                  >
                    {card.title}
                  </div>
                  <div
                    className="text-sm leading-relaxed outline-none"
                    style={{ color: tokens.bodyText, fontFamily: `'${theme.bodyFont}', sans-serif` }}
                    contentEditable={isEditor}
                    suppressContentEditableWarning
                    onBlur={(e) => updatePracticalCard(card.id, { body: e.currentTarget.textContent ?? card.body })}
                  >
                    {card.body}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {isEditor && (
          <button
            onClick={addPracticalCard}
            className="mt-5 w-full py-4 rounded-xl border-2 border-dashed text-sm font-medium transition hover:opacity-80"
            style={{ borderColor: tokens.border, color: tokens.mutedText }}
          >
            + Add tip
          </button>
        )}
      </div>
    </div>
  );
}
