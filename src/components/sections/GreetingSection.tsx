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

  if (variant === "two-column-consultant") {
    return (
      <div
        className="py-20 px-8 md:px-16"
        style={{ background: tokens.sectionSurface }}
      >
        <div className="max-w-5xl mx-auto grid md:grid-cols-[1fr_2fr] gap-12 items-start">
          {/* Consultant card */}
          <div className="text-center md:text-left space-y-3">
            <div
              className="w-20 h-20 rounded-full mx-auto md:mx-0 overflow-hidden"
              style={{ background: tokens.cardBg }}
            >
              {operator.consultantPhoto ? (
                <img src={operator.consultantPhoto} alt={operator.consultantName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl font-bold"
                  style={{ color: tokens.accent }}>
                  {operator.consultantName.charAt(0)}
                </div>
              )}
            </div>
            <div>
              <div className="font-semibold text-sm" style={{ color: tokens.headingText }}>
                {operator.consultantName}
              </div>
              <div className="text-xs" style={{ color: tokens.mutedText }}>
                {operator.companyName}
              </div>
            </div>
          </div>

          {/* Letter */}
          <div>
            <div
              className="text-[11px] uppercase tracking-[0.22em] mb-4"
              style={{ color: tokens.mutedText }}
            >
              A note from your consultant
            </div>
            <div
              contentEditable={isEditor}
              suppressContentEditableWarning
              className="text-lg leading-[2] outline-none whitespace-pre-line"
              style={{
                color: tokens.bodyText,
                fontFamily: `'${theme.displayFont}', serif`,
              }}
              onBlur={(e) =>
                updateSectionContent(section.id, {
                  body: e.currentTarget.textContent ?? "",
                })
              }
            >
              {section.content.body as string}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // editorial-letter (default)
  return (
    <div
      className="py-20 px-8 md:px-16"
      style={{ background: tokens.sectionSurface }}
    >
      <div className="max-w-3xl mx-auto">
        <div
          className="text-[11px] uppercase tracking-[0.22em] mb-6"
          style={{ color: tokens.mutedText }}
        >
          A personal note
        </div>
        <div
          contentEditable={isEditor}
          suppressContentEditableWarning
          className="text-xl md:text-2xl leading-[1.9] outline-none whitespace-pre-line"
          style={{
            color: tokens.headingText,
            fontFamily: `'${theme.displayFont}', serif`,
          }}
          onBlur={(e) =>
            updateSectionContent(section.id, {
              body: e.currentTarget.textContent ?? "",
            })
          }
        >
          {section.content.body as string}
        </div>

        <div className="mt-10 flex items-center gap-4">
          <div
            className="w-10 h-10 rounded-full overflow-hidden shrink-0"
            style={{ background: tokens.cardBg }}
          >
            {operator.consultantPhoto ? (
              <img src={operator.consultantPhoto} alt={operator.consultantName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-sm font-bold"
                style={{ color: tokens.accent }}>
                {operator.consultantName.charAt(0)}
              </div>
            )}
          </div>
          <div>
            <div className="text-sm font-semibold" style={{ color: tokens.headingText }}>
              {operator.consultantName}
            </div>
            <div className="text-xs" style={{ color: tokens.mutedText }}>
              {operator.companyName}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
