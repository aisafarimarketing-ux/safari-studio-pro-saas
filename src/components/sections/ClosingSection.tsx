"use client";

import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import type { Section } from "@/lib/types";

export function ClosingSection({ section }: { section: Section }) {
  const { proposal, updateSectionContent } = useProposalStore();
  const { mode } = useEditorStore();
  const isEditor = mode === "editor";
  const { operator, theme } = proposal;
  const tokens = theme.tokens;
  const variant = section.layoutVariant;
  const quote = section.content.quote as string;
  const signOff = section.content.signOff as string;

  if (variant === "letter-style") {
    return (
      <div className="py-20 px-8 md:px-16" style={{ background: tokens.sectionSurface }}>
        <div className="max-w-2xl mx-auto space-y-6">
          <p
            className="text-base leading-relaxed outline-none whitespace-pre-line"
            style={{ color: tokens.bodyText, fontFamily: `'${theme.bodyFont}', sans-serif` }}
            contentEditable={isEditor}
            suppressContentEditableWarning
            onBlur={(e) => updateSectionContent(section.id, { signOff: e.currentTarget.textContent ?? signOff })}
          >
            {signOff}
          </p>
          <div className="pt-4">
            <div className="font-semibold" style={{ color: tokens.headingText, fontFamily: `'${theme.displayFont}', serif` }}>
              {operator.consultantName}
            </div>
            <div className="text-sm" style={{ color: tokens.mutedText }}>{operator.companyName}</div>
          </div>
        </div>
      </div>
    );
  }

  // quote-led
  return (
    <div className="py-24 px-8 md:px-16 text-center" style={{ background: tokens.accent }}>
      <div className="max-w-3xl mx-auto">
        <div className="text-6xl mb-4" style={{ color: tokens.secondaryAccent }}>&ldquo;</div>
        <blockquote
          className="text-2xl md:text-3xl font-medium leading-relaxed outline-none"
          style={{
            color: "rgba(255,255,255,0.9)",
            fontFamily: `'${theme.displayFont}', serif`,
          }}
          contentEditable={isEditor}
          suppressContentEditableWarning
          onBlur={(e) => updateSectionContent(section.id, { quote: e.currentTarget.textContent ?? quote })}
        >
          {quote}
        </blockquote>

        <div className="mt-10 border-t border-white/15 pt-8 text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
          <p
            className="outline-none"
            contentEditable={isEditor}
            suppressContentEditableWarning
            onBlur={(e) => updateSectionContent(section.id, { signOff: e.currentTarget.textContent ?? signOff })}
          >
            {signOff}
          </p>
          <div className="mt-2 font-semibold" style={{ color: "rgba(255,255,255,0.8)" }}>
            {operator.consultantName} · {operator.companyName}
          </div>
          {operator.email && (
            <div className="mt-1">{operator.email}</div>
          )}
          {operator.whatsapp && (
            <div>WhatsApp: {operator.whatsapp}</div>
          )}
        </div>
      </div>
    </div>
  );
}
