"use client";

import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import { resolveTokens } from "@/lib/theme";
import type { Section } from "@/lib/types";

export function QuoteSection({ section }: { section: Section }) {
  const { proposal, updateSectionContent } = useProposalStore();
  const { mode } = useEditorStore();
  const isEditor = mode === "editor";
  const { theme } = proposal;
  const tokens = resolveTokens(theme.tokens, section.styleOverrides);

  return (
    <div className="py-20 px-8 md:px-16 text-center" style={{ background: tokens.sectionSurface }}>
      <div className="max-w-3xl mx-auto">
        <div className="text-5xl mb-4" style={{ color: tokens.secondaryAccent }}>&ldquo;</div>
        <blockquote
          className="text-2xl font-medium leading-relaxed outline-none"
          style={{ color: tokens.headingText, fontFamily: `'${theme.displayFont}', serif` }}
          contentEditable={isEditor}
          suppressContentEditableWarning
          onBlur={(e) => updateSectionContent(section.id, { quote: e.currentTarget.textContent ?? "" })}
        >
          {section.content.quote as string || (isEditor ? "Your quote here..." : "")}
        </blockquote>
        {(section.content.attribution || isEditor) && (
          <div
            className="mt-5 text-sm outline-none"
            style={{ color: tokens.mutedText }}
            contentEditable={isEditor}
            suppressContentEditableWarning
            onBlur={(e) => updateSectionContent(section.id, { attribution: e.currentTarget.textContent ?? "" })}
          >
            {section.content.attribution as string || (isEditor ? "— Attribution" : "")}
          </div>
        )}
      </div>
    </div>
  );
}
