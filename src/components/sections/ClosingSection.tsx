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

  // ── Centered-minimal — simple centered sign-off ──────────────────────────
  if (variant === "centered-minimal") {
    return (
      <div className="py-28 md:py-36 px-8 md:px-20 text-center" style={{ background: tokens.sectionSurface }}>
        <div className="max-w-md mx-auto">
          <div className="w-12 mx-auto mb-8" style={{ height: "2px", background: tokens.accent }} />
          <p
            className="text-[1.1rem] leading-[2.0] outline-none mb-8"
            style={{ color: tokens.headingText, fontFamily: `'${theme.displayFont}', serif` }}
            contentEditable={isEditor}
            suppressContentEditableWarning
            onBlur={(e) => updateSectionContent(section.id, { signOff: e.currentTarget.textContent ?? signOff })}
          >
            {signOff}
          </p>
          <div className="text-sm font-semibold" style={{ color: tokens.headingText }}>
            {operator.consultantName}
          </div>
          <div className="text-xs mt-1" style={{ color: tokens.mutedText }}>
            {operator.companyName}
          </div>
        </div>
      </div>
    );
  }

  // ── CTA-card — action-oriented closing with contact card ─────────────────
  if (variant === "cta-card") {
    return (
      <div className="py-20 md:py-28 px-8 md:px-16" style={{ background: tokens.pageBg }}>
        <div
          className="max-w-2xl mx-auto p-10 md:p-14 rounded-2xl text-center"
          style={{ background: tokens.accent }}
        >
          <blockquote
            className="text-[1.4rem] md:text-[1.7rem] font-medium leading-[1.5] outline-none mb-8"
            style={{ color: "rgba(255,255,255,0.92)", fontFamily: `'${theme.displayFont}', serif` }}
            contentEditable={isEditor}
            suppressContentEditableWarning
            onBlur={(e) => updateSectionContent(section.id, { quote: e.currentTarget.textContent ?? quote })}
          >
            {quote}
          </blockquote>
          <div className="w-10 mx-auto mb-8" style={{ height: "1px", background: "rgba(255,255,255,0.2)" }} />
          <div className="text-white/80 text-sm font-semibold">{operator.consultantName}</div>
          <div className="text-white/40 text-xs mt-1">{operator.companyName}</div>
          {(operator.email || operator.whatsapp) && (
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {operator.email && (
                <a href={`mailto:${operator.email}`} className="px-4 py-2 rounded-lg text-xs font-medium transition"
                  style={{ background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.8)" }}>
                  {operator.email}
                </a>
              )}
              {operator.whatsapp && (
                <span className="px-4 py-2 rounded-lg text-xs" style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }}>
                  {operator.whatsapp}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

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
