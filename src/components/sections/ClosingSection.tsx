"use client";

import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import { resolveTokens } from "@/lib/theme";
import type { Section } from "@/lib/types";

// Closing — 4 layout variants on the editorial scale.

export function ClosingSection({ section }: { section: Section }) {
  const { proposal, updateSectionContent } = useProposalStore();
  const { mode } = useEditorStore();
  const isEditor = mode === "editor";
  const { operator, theme } = proposal;
  const tokens = resolveTokens(theme.tokens, section.styleOverrides);
  const variant = section.layoutVariant;
  const quote = section.content.quote as string;
  const signOff = section.content.signOff as string;

  const onSignOff = (e: React.FocusEvent<HTMLElement>) =>
    updateSectionContent(section.id, { signOff: e.currentTarget.textContent ?? signOff });
  const onQuote = (e: React.FocusEvent<HTMLElement>) =>
    updateSectionContent(section.id, { quote: e.currentTarget.textContent ?? quote });

  // ── Centered-minimal ──────────────────────────────────────────────────────
  if (variant === "centered-minimal") {
    return (
      <div className="py-24 text-center" style={{ background: tokens.sectionSurface }}>
        <div className="ed-narrow" style={{ maxWidth: 480 }}>
          <div className="w-12 mx-auto mb-8" style={{ height: "2px", background: tokens.accent }} />
          <p
            className="text-body-lg leading-loose mb-8 outline-none"
            style={{ color: tokens.headingText, fontFamily: `'${theme.displayFont}', serif` }}
            contentEditable={isEditor}
            suppressContentEditableWarning
            onBlur={onSignOff}
          >
            {signOff}
          </p>
          <div className="text-small font-semibold" style={{ color: tokens.headingText }}>
            {operator.consultantName}
          </div>
          <div className="text-label" style={{ color: tokens.mutedText, textTransform: "none", letterSpacing: "0", fontWeight: 400 }}>
            {operator.companyName}
          </div>
        </div>
      </div>
    );
  }

  // ── CTA-card ──────────────────────────────────────────────────────────────
  if (variant === "cta-card") {
    return (
      <div className="py-24" style={{ background: tokens.pageBg }}>
        <div className="ed-narrow">
          <div
            className="p-12 md:p-16 rounded-2xl text-center"
            style={{ background: tokens.accent }}
          >
            <blockquote
              className="text-h2 font-medium mb-8 outline-none"
              style={{ color: "rgba(255,255,255,0.92)", fontFamily: `'${theme.displayFont}', serif` }}
              contentEditable={isEditor}
              suppressContentEditableWarning
              onBlur={onQuote}
            >
              {quote}
            </blockquote>
            <div className="w-10 mx-auto mb-8" style={{ height: "1px", background: "rgba(255,255,255,0.2)" }} />
            <div className="text-small font-semibold text-white/85">{operator.consultantName}</div>
            <div className="text-label text-white/50" style={{ textTransform: "none", letterSpacing: "0", fontWeight: 400 }}>
              {operator.companyName}
            </div>
            {(operator.email || operator.whatsapp) && (
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                {operator.email && (
                  <a
                    href={`mailto:${operator.email}`}
                    className="px-4 py-2 rounded-lg text-small font-medium transition"
                    style={{ background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.85)" }}
                  >
                    {operator.email}
                  </a>
                )}
                {operator.whatsapp && (
                  <span
                    className="px-4 py-2 rounded-lg text-small"
                    style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)" }}
                  >
                    {operator.whatsapp}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Letter-style ──────────────────────────────────────────────────────────
  if (variant === "letter-style") {
    return (
      <div className="py-24" style={{ background: tokens.sectionSurface }}>
        <div className="ed-narrow space-y-8" style={{ maxWidth: 580 }}>
          <p
            className="text-body leading-loose whitespace-pre-line outline-none"
            style={{ color: tokens.bodyText, fontFamily: `'${theme.bodyFont}', sans-serif` }}
            contentEditable={isEditor}
            suppressContentEditableWarning
            onBlur={onSignOff}
          >
            {signOff}
          </p>
          <div className="pt-6 border-t" style={{ borderColor: tokens.border }}>
            <div
              className="text-h3 font-semibold"
              style={{ color: tokens.headingText, fontFamily: `'${theme.displayFont}', serif` }}
            >
              {operator.consultantName}
            </div>
            <div className="text-small" style={{ color: tokens.mutedText }}>{operator.companyName}</div>
          </div>
        </div>
      </div>
    );
  }

  // ── Quote-led (default) ──────────────────────────────────────────────────
  return (
    <div className="py-24 text-center" style={{ background: tokens.accent }}>
      <div className="ed-narrow">
        <div
          aria-hidden
          className="select-none leading-none"
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

        <blockquote
          className="text-h1 font-medium -mt-3 outline-none"
          style={{ color: "rgba(255,255,255,0.92)", fontFamily: `'${theme.displayFont}', serif` }}
          contentEditable={isEditor}
          suppressContentEditableWarning
          onBlur={onQuote}
        >
          {quote}
        </blockquote>

        <div className="mt-12 pt-10 border-t" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
          <p
            className="text-small italic mb-6 outline-none"
            style={{ color: "rgba(255,255,255,0.6)", fontFamily: `'${theme.displayFont}', serif` }}
            contentEditable={isEditor}
            suppressContentEditableWarning
            onBlur={onSignOff}
          >
            {signOff}
          </p>
          <div
            className="text-h3 font-semibold"
            style={{ color: "rgba(255,255,255,0.88)", fontFamily: `'${theme.displayFont}', serif` }}
          >
            {operator.consultantName}
          </div>
          <div className="text-small mt-1 text-white/45">{operator.companyName}</div>
          {(operator.email || operator.whatsapp) && (
            <div className="mt-4 space-y-1 text-label" style={{ color: "rgba(255,255,255,0.35)", textTransform: "none", letterSpacing: "0", fontWeight: 400 }}>
              {operator.email && <div>{operator.email}</div>}
              {operator.whatsapp && <div>{operator.whatsapp}</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
