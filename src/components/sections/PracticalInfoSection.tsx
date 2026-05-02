"use client";

import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import { resolveTokens } from "@/lib/theme";
import type { Section, ThemeTokens, ProposalTheme } from "@/lib/types";

// Editorial header for the Practical Info block. Big serif title +
// tracked-out "Travel tips" eyebrow underneath, sized to read as the
// section's headline rather than a chrome label.
function SectionHeading({ tokens, theme }: { tokens: ThemeTokens; theme: ProposalTheme }) {
  return (
    <div className="mb-10">
      <h2
        className="font-bold leading-[1.05]"
        style={{
          color: tokens.headingText,
          fontFamily: `'${theme.displayFont}', serif`,
          fontSize: "clamp(2rem, 4vw, 2.8rem)",
          letterSpacing: "-0.01em",
        }}
      >
        Good to know
      </h2>
      <div
        className="mt-2 text-[11px] uppercase tracking-[0.3em] font-semibold"
        style={{ color: tokens.mutedText }}
      >
        Travel tips
      </div>
    </div>
  );
}

export function PracticalInfoSection({ section }: { section: Section }) {
  const { proposal, addPracticalCard, removePracticalCard, updatePracticalCard } = useProposalStore();
  const { mode } = useEditorStore();
  const isEditor = mode === "editor";
  const { practicalInfo, theme } = proposal;
  const tokens = resolveTokens(theme.tokens, section.styleOverrides);
  const variant = section.layoutVariant;

  const renderCard = (card: typeof practicalInfo[0]) => (
    <div
      key={card.id}
      className="relative p-7 rounded-xl border"
      style={{ background: tokens.sectionSurface, borderColor: tokens.border }}
    >
      {isEditor && (
        <button
          onClick={() => removePracticalCard(card.id)}
          className="absolute top-4 right-4 text-xs transition"
          style={{ color: tokens.mutedText }}
        >
          ×
        </button>
      )}
      <div className="flex items-start gap-4">
        <span className="text-xl shrink-0 mt-0.5 select-none">{card.icon ?? "ℹ"}</span>
        <div className="flex-1 min-w-0">
          <div
            className="font-semibold text-[13.5px] mb-2 outline-none"
            style={{ color: tokens.headingText, fontFamily: `'${theme.bodyFont}', sans-serif` }}
            contentEditable={isEditor}
            suppressContentEditableWarning
            onBlur={(e) => updatePracticalCard(card.id, { title: e.currentTarget.textContent ?? card.title })}
          >
            {card.title}
          </div>
          <div
            className="text-[13px] leading-[1.85] outline-none"
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
  );

  // ── Icon-list — compact list with icons ──────────────────────────────────────
  if (variant === "icon-list") {
    return (
      <div className="py-2 md:py-3 px-8 md:px-20" style={{ background: tokens.sectionSurface }}>
        <div className="max-w-3xl mx-auto">
          <SectionHeading tokens={tokens} theme={theme} />
          <div className="space-y-6">
            {practicalInfo.map((card) => (
              <div key={card.id} className="relative flex items-start gap-5 pb-6" style={{ borderBottom: `1px solid ${tokens.border}` }}>
                {isEditor && (
                  <button onClick={() => removePracticalCard(card.id)} className="absolute top-0 right-0 text-xs" style={{ color: tokens.mutedText }}>×</button>
                )}
                <span className="text-lg shrink-0 mt-0.5 select-none">{card.icon ?? "ℹ"}</span>
                <div className="flex-1 min-w-0">
                  <div
                    className="font-semibold text-sm mb-1 outline-none"
                    style={{ color: tokens.headingText }}
                    contentEditable={isEditor} suppressContentEditableWarning
                    onBlur={(e) => updatePracticalCard(card.id, { title: e.currentTarget.textContent ?? card.title })}
                  >{card.title}</div>
                  <div
                    className="text-[13px] leading-[1.8] outline-none"
                    style={{ color: tokens.bodyText, fontFamily: `'${theme.bodyFont}', sans-serif` }}
                    contentEditable={isEditor} suppressContentEditableWarning
                    onBlur={(e) => updatePracticalCard(card.id, { body: e.currentTarget.textContent ?? card.body })}
                  >{card.body}</div>
                </div>
              </div>
            ))}
          </div>
          {isEditor && (
            <button onClick={addPracticalCard} className="mt-5 w-full py-4 rounded-xl border-2 border-dashed text-sm font-medium transition hover:opacity-80"
              style={{ borderColor: tokens.border, color: tokens.mutedText }}>+ Add tip</button>
          )}
        </div>
      </div>
    );
  }

  // ── Accordion-style — bold title blocks ────────────────────────────────────
  if (variant === "accordion-style") {
    return (
      <div className="py-2 md:py-3 px-8 md:px-20" style={{ background: tokens.sectionSurface }}>
        <div className="max-w-4xl mx-auto">
          <SectionHeading tokens={tokens} theme={theme} />
          {practicalInfo.map((card) => (
            <div key={card.id} className="relative py-6" style={{ borderBottom: `1px solid ${tokens.border}` }}>
              {isEditor && (
                <button onClick={() => removePracticalCard(card.id)} className="absolute top-6 right-0 text-xs" style={{ color: tokens.mutedText }}>×</button>
              )}
              <div className="flex items-start gap-4">
                <span className="text-base shrink-0 select-none mt-0.5" style={{ color: tokens.accent }}>{card.icon ?? "ℹ"}</span>
                <div className="flex-1">
                  <h4
                    className="text-base font-bold mb-2 outline-none"
                    style={{ color: tokens.headingText, fontFamily: `'${theme.displayFont}', serif` }}
                    contentEditable={isEditor} suppressContentEditableWarning
                    onBlur={(e) => updatePracticalCard(card.id, { title: e.currentTarget.textContent ?? card.title })}
                  >{card.title}</h4>
                  <div
                    className="text-[13px] leading-[1.85] outline-none"
                    style={{ color: tokens.bodyText, fontFamily: `'${theme.bodyFont}', sans-serif` }}
                    contentEditable={isEditor} suppressContentEditableWarning
                    onBlur={(e) => updatePracticalCard(card.id, { body: e.currentTarget.textContent ?? card.body })}
                  >{card.body}</div>
                </div>
              </div>
            </div>
          ))}
          {isEditor && (
            <button onClick={addPracticalCard} className="mt-5 w-full py-4 rounded-xl border-2 border-dashed text-sm font-medium transition hover:opacity-80"
              style={{ borderColor: tokens.border, color: tokens.mutedText }}>+ Add tip</button>
          )}
        </div>
      </div>
    );
  }

  // ── Default: card-grid or two-column-notes ──────────────────────────────────
  const isGrid = variant === "card-grid";

  return (
    <div className="py-2 md:py-3 px-8 md:px-20" style={{ background: tokens.sectionSurface }}>
      <div className="max-w-5xl mx-auto">
        <SectionHeading tokens={tokens} theme={theme} />

        <div className={`${isGrid ? "grid grid-cols-1 md:grid-cols-2 gap-5" : "space-y-4"}`}>
          {practicalInfo.map(renderCard)}
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
