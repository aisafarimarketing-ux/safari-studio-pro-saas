"use client";

import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import { resolveTokens } from "@/lib/theme";
import { AIWriteButton } from "@/components/editor/AIWriteButton";
import type { Section } from "@/lib/types";

export function CustomTextSection({ section }: { section: Section }) {
  const { proposal, updateSectionContent } = useProposalStore();
  const { mode } = useEditorStore();
  const isEditor = mode === "editor";
  const { theme, trip } = proposal;
  const tokens = resolveTokens(theme.tokens, section.styleOverrides);
  const isCentered = section.layoutVariant === "centered";
  const heading = section.content.heading as string;
  const body = section.content.body as string;

  return (
    <div className={`relative py-4 md:py-6 px-8 md:px-16 ${isCentered ? "text-center" : ""}`} style={{ background: tokens.pageBg }}>
      {isEditor && (
        <div className="absolute top-14 right-4 z-[35]">
          <AIWriteButton
            kind="custom"
            currentText={body ?? ""}
            context={{ heading, destinations: trip.destinations }}
            onResult={(text) => updateSectionContent(section.id, { body: text })}
            compact
          />
        </div>
      )}
      <div className="max-w-3xl mx-auto space-y-4">
        {(heading || isEditor) && (
          <h2
            className="text-3xl font-bold outline-none"
            style={{ color: tokens.headingText, fontFamily: `'${theme.displayFont}', serif` }}
            contentEditable={isEditor}
            suppressContentEditableWarning
            onBlur={(e) => updateSectionContent(section.id, { heading: e.currentTarget.textContent ?? "" })}
          >
            {heading || (isEditor ? "Section heading" : "")}
          </h2>
        )}
        <div
          className="text-base leading-[1.9] outline-none whitespace-pre-line"
          style={{ color: tokens.bodyText, fontFamily: `'${theme.bodyFont}', sans-serif` }}
          contentEditable={isEditor}
          suppressContentEditableWarning
          data-ai-editable="custom"
          onBlur={(e) => updateSectionContent(section.id, { body: e.currentTarget.textContent ?? "" })}
        >
          {body || (isEditor ? "Click to start typing..." : "")}
        </div>
      </div>
    </div>
  );
}
