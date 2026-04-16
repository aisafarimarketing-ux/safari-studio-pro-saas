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
      <div className="py-24 md:py-32 px-8 md:px-20" style={{ background: tokens.sectionSurface }}>
        <div className="max-w-xl mx-auto space-y-8">
          <p
            className="text-[15px] leading-[2.1] outline-none whitespace-pre-line"
            style={{ color: tokens.bodyText, fontFamily: `'${theme.bodyFont}', sans-serif` }}
            contentEditable={isEditor}
            suppressContentEditableWarning
            onBlur={(e) => updateSectionContent(section.id, { signOff: e.currentTarget.textContent ?? signOff })}
          >
            {signOff}
          </p>
          <div className="pt-6 border-t" style={{ borderColor: tokens.border }}>
            <div
              className="text-base font-semibold tracking-wide"
              style={{ color: tokens.headingText, fontFamily: `'${theme.displayFont}', serif` }}
            >
              {operator.consultantName}
            </div>
            <div className="text-sm mt-0.5" style={{ color: tokens.mutedText }}>{operator.companyName}</div>
          </div>
        </div>
      </div>
    );
  }

  // ── Quote-led ──────────────────────────────────────────────────────────────
  return (
    <div className="py-28 md:py-36 px-8 md:px-20 text-center" style={{ background: tokens.accent }}>
      <div className="max-w-2xl mx-auto">
        {/* Opening quote mark */}
        <div
          aria-hidden="true"
          className="select-none leading-none mb-0"
          style={{
            fontFamily: `'${theme.displayFont}', serif`,
            fontSize: "6.5rem",
            color: tokens.secondaryAccent,
            opacity: 0.55,
            lineHeight: 0.9,
          }}
        >
          &ldquo;
        </div>

        {/* Quote body */}
        <blockquote
          className="text-[1.6rem] md:text-[2rem] font-medium leading-[1.55] -mt-3 outline-none"
          style={{
            color: "rgba(255,255,255,0.92)",
            fontFamily: `'${theme.displayFont}', serif`,
          }}
          contentEditable={isEditor}
          suppressContentEditableWarning
          onBlur={(e) => updateSectionContent(section.id, { quote: e.currentTarget.textContent ?? quote })}
        >
          {quote}
        </blockquote>

        {/* Sign-off + contact */}
        <div
          className="mt-14 pt-10 border-t"
          style={{ borderColor: "rgba(255,255,255,0.12)" }}
        >
          <p
            className="text-[14px] leading-relaxed outline-none mb-6 italic"
            style={{
              color: "rgba(255,255,255,0.55)",
              fontFamily: `'${theme.displayFont}', serif`,
            }}
            contentEditable={isEditor}
            suppressContentEditableWarning
            onBlur={(e) => updateSectionContent(section.id, { signOff: e.currentTarget.textContent ?? signOff })}
          >
            {signOff}
          </p>

          <div
            className="text-base font-semibold tracking-wide"
            style={{ color: "rgba(255,255,255,0.85)", fontFamily: `'${theme.displayFont}', serif` }}
          >
            {operator.consultantName}
          </div>
          <div className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
            {operator.companyName}
          </div>

          {(operator.email || operator.whatsapp) && (
            <div className="mt-5 space-y-1 text-[12px]" style={{ color: "rgba(255,255,255,0.3)" }}>
              {operator.email && <div>{operator.email}</div>}
              {operator.whatsapp && <div>{operator.whatsapp}</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
