"use client";

import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import type { Section } from "@/lib/types";

export function GreetingSection({ section }: { section: Section }) {
  const { proposal, updateSectionContent } = useProposalStore();
  const { mode } = useEditorStore();
  const isEditor = mode === "editor";
  const { operator, theme } = proposal;
  const tokens = theme.tokens;
  const variant = section.layoutVariant;

  // ── Two-column-consultant ──────────────────────────────────────────────────
  if (variant === "two-column-consultant") {
    return (
      <div className="py-24 px-8 md:px-16" style={{ background: tokens.sectionSurface }}>
        <div className="max-w-5xl mx-auto grid md:grid-cols-[220px_1fr] gap-16 items-start">

          {/* Consultant sidebar — sticky card */}
          <div className="md:pt-14">
            <div
              className="w-24 h-24 rounded-2xl overflow-hidden mb-4"
              style={{ background: tokens.cardBg }}
            >
              {operator.consultantPhoto ? (
                <img src={operator.consultantPhoto} alt={operator.consultantName} className="w-full h-full object-cover" />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center text-3xl font-bold"
                  style={{ color: tokens.accent }}
                >
                  {operator.consultantName?.charAt(0) ?? "?"}
                </div>
              )}
            </div>
            <div className="text-sm font-semibold mb-0.5" style={{ color: tokens.headingText }}>
              {operator.consultantName}
            </div>
            <div className="text-xs" style={{ color: tokens.mutedText }}>
              {operator.companyName}
            </div>
            {/* Decorative dot motif */}
            <div className="mt-8 flex gap-1.5">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-full"
                  style={{
                    width: 6,
                    height: 6,
                    background: i === 0 ? tokens.accent : tokens.border,
                  }}
                />
              ))}
            </div>
          </div>

          {/* Letter body */}
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] mb-8" style={{ color: tokens.mutedText }}>
              A note from your consultant
            </div>

            {/* Large decorative opening quote */}
            <div
              className="text-[5rem] leading-none select-none mb-2"
              style={{
                color: tokens.accent,
                fontFamily: `'${theme.displayFont}', serif`,
                opacity: 0.35,
                lineHeight: 0.8,
              }}
            >
              &#8220;
            </div>

            <div
              contentEditable={isEditor}
              suppressContentEditableWarning
              className="text-[1.2rem] leading-[2.1] outline-none whitespace-pre-line"
              style={{
                color: tokens.bodyText,
                fontFamily: `'${theme.displayFont}', serif`,
              }}
              onBlur={(e) => updateSectionContent(section.id, { body: e.currentTarget.textContent ?? "" })}
            >
              {section.content.body as string}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Editorial-letter (default) ─────────────────────────────────────────────
  return (
    <div className="py-24 px-8 md:px-16" style={{ background: tokens.sectionSurface }}>
      <div className="max-w-[680px] mx-auto">

        {/* Overline */}
        <div
          className="text-[11px] uppercase tracking-[0.22em] mb-10"
          style={{ color: tokens.accent }}
        >
          A personal note
        </div>

        {/* Opening quote mark — huge, decorative, accent colour */}
        <div
          aria-hidden="true"
          className="select-none mb-[-1.5rem]"
          style={{
            fontFamily: `'${theme.displayFont}', serif`,
            fontSize: "9rem",
            lineHeight: 1,
            color: tokens.accent,
            opacity: 0.2,
          }}
        >
          &#8220;
        </div>

        {/* Letter body */}
        <div
          contentEditable={isEditor}
          suppressContentEditableWarning
          className="text-[1.25rem] md:text-[1.4rem] leading-[2.0] outline-none whitespace-pre-line relative z-10"
          style={{
            color: tokens.headingText,
            fontFamily: `'${theme.displayFont}', serif`,
          }}
          onBlur={(e) => updateSectionContent(section.id, { body: e.currentTarget.textContent ?? "" })}
        >
          {section.content.body as string}
        </div>

        {/* Consultant sign-off */}
        <div
          className="mt-14 pt-8 flex items-center gap-4"
          style={{ borderTop: `1px solid ${tokens.border}` }}
        >
          <div
            className="w-11 h-11 rounded-full overflow-hidden shrink-0"
            style={{ background: tokens.cardBg }}
          >
            {operator.consultantPhoto ? (
              <img src={operator.consultantPhoto} alt={operator.consultantName} className="w-full h-full object-cover" />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center text-sm font-bold"
                style={{ color: tokens.accent }}
              >
                {operator.consultantName?.charAt(0) ?? "?"}
              </div>
            )}
          </div>
          <div>
            <div className="text-sm font-semibold" style={{ color: tokens.headingText }}>
              {operator.consultantName}
            </div>
            <div className="text-xs mt-0.5" style={{ color: tokens.mutedText }}>
              {operator.companyName}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
