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
      <div className="py-28 md:py-36 px-8 md:px-20" style={{ background: tokens.sectionSurface }}>
        <div className="max-w-4xl mx-auto grid md:grid-cols-[200px_1fr] gap-16 items-start">

          {/* Consultant sidebar */}
          <div className="md:pt-12">
            <div
              className="w-20 h-20 rounded-2xl overflow-hidden mb-5"
              style={{ background: tokens.cardBg }}
            >
              {operator.consultantPhoto ? (
                <img src={operator.consultantPhoto} alt={operator.consultantName} className="w-full h-full object-cover" />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center text-2xl font-bold"
                  style={{ color: tokens.accent }}
                >
                  {operator.consultantName?.charAt(0) ?? "?"}
                </div>
              )}
            </div>
            <div className="text-sm font-semibold mb-0.5" style={{ color: tokens.headingText }}>
              {operator.consultantName}
            </div>
            <div className="text-xs leading-relaxed" style={{ color: tokens.mutedText }}>
              {operator.companyName}
            </div>
            {/* Thin accent rule */}
            <div
              className="mt-8 w-8"
              style={{ height: "2px", background: tokens.accent, opacity: 0.3 }}
            />
          </div>

          {/* Letter body */}
          <div>
            <div className="text-[10px] uppercase tracking-[0.28em] mb-10" style={{ color: tokens.mutedText }}>
              A note from your consultant
            </div>

            {/* Decorative opening quote */}
            <div
              className="select-none mb-[-1.2rem]"
              aria-hidden="true"
              style={{
                fontFamily: `'${theme.displayFont}', serif`,
                fontSize: "7rem",
                lineHeight: 1,
                color: tokens.accent,
                opacity: 0.12,
              }}
            >
              &#8220;
            </div>

            <div
              contentEditable={isEditor}
              suppressContentEditableWarning
              className="text-[1.1rem] leading-[2.15] outline-none whitespace-pre-line relative z-10"
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

  // ── Centered-minimal — clean centered letter, no sidebar ────────────────────
  if (variant === "centered-minimal") {
    return (
      <div className="py-28 md:py-36 px-8 md:px-20 text-center" style={{ background: tokens.sectionSurface }}>
        <div className="max-w-[560px] mx-auto">
          <div className="text-[10px] uppercase tracking-[0.3em] mb-10" style={{ color: tokens.accent }}>
            Welcome
          </div>
          <div
            contentEditable={isEditor}
            suppressContentEditableWarning
            className="text-[1.15rem] leading-[2.2] outline-none whitespace-pre-line"
            style={{ color: tokens.headingText, fontFamily: `'${theme.displayFont}', serif` }}
            onBlur={(e) => updateSectionContent(section.id, { body: e.currentTarget.textContent ?? "" })}
          >
            {section.content.body as string}
          </div>
          <div className="mt-12 inline-flex items-center gap-3">
            <div className="w-8 h-8 rounded-full overflow-hidden shrink-0" style={{ background: tokens.cardBg }}>
              {operator.consultantPhoto ? (
                <img src={operator.consultantPhoto} alt={operator.consultantName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs font-bold" style={{ color: tokens.accent }}>
                  {operator.consultantName?.charAt(0) ?? "?"}
                </div>
              )}
            </div>
            <span className="text-sm font-medium" style={{ color: tokens.headingText }}>{operator.consultantName}</span>
          </div>
        </div>
      </div>
    );
  }

  // ── Sidebar-accent — colored accent bar left, letter right ─────────────────
  if (variant === "sidebar-accent") {
    return (
      <div className="flex" style={{ background: tokens.sectionSurface }}>
        {/* Accent sidebar */}
        <div className="hidden md:block w-2 shrink-0" style={{ background: tokens.accent }} />
        <div className="flex-1 py-24 md:py-32 px-10 md:px-16">
          <div className="max-w-[620px]">
            <div className="text-[10px] uppercase tracking-[0.28em] mb-10" style={{ color: tokens.mutedText }}>
              A personal note
            </div>
            <div
              contentEditable={isEditor}
              suppressContentEditableWarning
              className="text-[1.05rem] leading-[2.1] outline-none whitespace-pre-line"
              style={{ color: tokens.bodyText, fontFamily: `'${theme.bodyFont}', sans-serif` }}
              onBlur={(e) => updateSectionContent(section.id, { body: e.currentTarget.textContent ?? "" })}
            >
              {section.content.body as string}
            </div>
            <div className="mt-14 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full overflow-hidden shrink-0" style={{ background: tokens.cardBg }}>
                {operator.consultantPhoto ? (
                  <img src={operator.consultantPhoto} alt={operator.consultantName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-sm font-bold" style={{ color: tokens.accent }}>
                    {operator.consultantName?.charAt(0) ?? "?"}
                  </div>
                )}
              </div>
              <div>
                <div className="text-sm font-semibold" style={{ color: tokens.headingText }}>{operator.consultantName}</div>
                <div className="text-xs mt-0.5" style={{ color: tokens.mutedText }}>{operator.companyName}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Editorial-letter (default) ─────────────────────────────────────────────
  return (
    <div className="py-28 md:py-36 px-8 md:px-20" style={{ background: tokens.sectionSurface }}>
      <div className="max-w-[620px] mx-auto">

        {/* Overline */}
        <div
          className="text-[10px] uppercase tracking-[0.3em] mb-12"
          style={{ color: tokens.accent }}
        >
          A personal note
        </div>

        {/* Opening quote mark — large, barely visible */}
        <div
          aria-hidden="true"
          className="select-none mb-[-1.8rem]"
          style={{
            fontFamily: `'${theme.displayFont}', serif`,
            fontSize: "7.5rem",
            lineHeight: 1,
            color: tokens.accent,
            opacity: 0.13,
          }}
        >
          &#8220;
        </div>

        {/* Letter body */}
        <div
          contentEditable={isEditor}
          suppressContentEditableWarning
          className="text-[1.1rem] md:text-[1.2rem] leading-[2.2] outline-none whitespace-pre-line relative z-10"
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
          className="mt-20 pt-10 flex items-center gap-5"
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
            <div className="text-sm font-semibold tracking-wide" style={{ color: tokens.headingText }}>
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
