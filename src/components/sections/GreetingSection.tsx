"use client";

import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import { resolveTokens } from "@/lib/theme";
import { AIWriteButton } from "@/components/editor/AIWriteButton";
import type { Section } from "@/lib/types";

// Greeting — 4 layout variants, all on the editorial scale.

export function GreetingSection({ section }: { section: Section }) {
  const { proposal, updateSectionContent } = useProposalStore();
  const { mode } = useEditorStore();
  const isEditor = mode === "editor";
  const { operator, theme, client, trip } = proposal;
  const tokens = resolveTokens(theme.tokens, section.styleOverrides);
  const variant = section.layoutVariant;
  const body = section.content.body as string;

  const onBodyBlur = (e: React.FocusEvent<HTMLDivElement>) =>
    updateSectionContent(section.id, { body: e.currentTarget.textContent ?? "" });

  const aiButton = isEditor ? (
    <div className="absolute top-14 right-4 z-[35]">
      <AIWriteButton
        kind="greeting"
        currentText={body ?? ""}
        context={{
          clientName: client.guestNames,
          consultantName: operator.consultantName,
          destinations: trip.destinations,
          nights: trip.nights,
          dates: trip.dates,
          tripStyle: trip.tripStyle,
        }}
        onResult={(text) => updateSectionContent(section.id, { body: text })}
        compact
      />
    </div>
  ) : null;

  // ── Two-column-consultant ──────────────────────────────────────────────────
  if (variant === "two-column-consultant") {
    return (
      <div className="py-12 relative" style={{ background: tokens.sectionSurface }}>
        {aiButton}
        <div className="ed-wide grid md:grid-cols-[200px_1fr] gap-16 items-start">
          {/* Consultant sidebar */}
          <div className="md:pt-12">
            <ConsultantAvatar operator={operator} tokens={tokens} size={80} />
            <div className="mt-6 text-small font-semibold" style={{ color: tokens.headingText }}>
              {operator.consultantName}
            </div>
            <div className="text-small" style={{ color: tokens.mutedText }}>
              {operator.companyName}
            </div>
            <div className="mt-8 w-8" style={{ height: "2px", background: tokens.accent, opacity: 0.3 }} />
          </div>

          {/* Letter body */}
          <div>
            <div
              className="text-label ed-label mb-12"
              style={{ color: tokens.mutedText }}
            >
              A note from your consultant
            </div>
            <BigQuote theme={theme} tokens={tokens} />
            <div
              contentEditable={isEditor}
              suppressContentEditableWarning
              data-ai-editable="greeting"
              className="text-body-lg leading-loose whitespace-pre-line outline-none relative z-10"
              style={{ color: tokens.bodyText, fontFamily: `'${theme.displayFont}', serif` }}
              onBlur={onBodyBlur}
            >
              {body}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Centered-minimal ───────────────────────────────────────────────────────
  if (variant === "centered-minimal") {
    return (
      <div className="py-12 text-center relative" style={{ background: tokens.sectionSurface }}>
        {aiButton}
        <div className="ed-narrow">
          <div
            className="text-label ed-label mb-12"
            style={{ color: tokens.accent }}
          >
            Welcome
          </div>
          <div
            contentEditable={isEditor}
            suppressContentEditableWarning
            data-ai-editable="greeting"
            className="text-body-lg leading-loose whitespace-pre-line outline-none"
            style={{ color: tokens.headingText, fontFamily: `'${theme.displayFont}', serif` }}
            onBlur={onBodyBlur}
          >
            {body}
          </div>
          <div className="mt-12 inline-flex items-center gap-3">
            <ConsultantAvatar operator={operator} tokens={tokens} size={32} textSize="text-small" />
            <span className="text-small font-medium" style={{ color: tokens.headingText }}>
              {operator.consultantName}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ── Sidebar-accent ─────────────────────────────────────────────────────────
  if (variant === "sidebar-accent") {
    return (
      <div className="flex relative" style={{ background: tokens.sectionSurface }}>
        {aiButton}
        <div className="hidden md:block w-2 shrink-0" style={{ background: tokens.accent }} />
        <div className="flex-1 py-12">
          <div className="ed-narrow !mx-0 md:!mx-[clamp(2rem,8vw,6rem)] !max-w-[620px]">
            <div
              className="text-label ed-label mb-12"
              style={{ color: tokens.mutedText }}
            >
              A personal note
            </div>
            <div
              contentEditable={isEditor}
              suppressContentEditableWarning
              className="text-body-lg leading-loose whitespace-pre-line outline-none"
              style={{ color: tokens.bodyText, fontFamily: `'${theme.bodyFont}', sans-serif` }}
              onBlur={onBodyBlur}
            >
              {body}
            </div>
            <div className="mt-12 flex items-center gap-4">
              <ConsultantAvatar operator={operator} tokens={tokens} size={40} textSize="text-small" />
              <div>
                <div className="text-small font-semibold" style={{ color: tokens.headingText }}>
                  {operator.consultantName}
                </div>
                <div className="text-label" style={{ color: tokens.mutedText, textTransform: "none", letterSpacing: "0", fontWeight: 400 }}>
                  {operator.companyName}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Editorial-letter (default) ─────────────────────────────────────────────
  return (
    <div className="py-12 relative" style={{ background: tokens.sectionSurface }}>
      {aiButton}
      <div className="ed-narrow">
        <div
          className="text-label ed-label mb-12"
          style={{ color: tokens.accent }}
        >
          A personal note
        </div>

        <BigQuote theme={theme} tokens={tokens} />

        <div
          contentEditable={isEditor}
          suppressContentEditableWarning
          data-ai-editable="greeting"
          className="text-body-lg leading-loose whitespace-pre-line outline-none relative z-10"
          style={{ color: tokens.headingText, fontFamily: `'${theme.displayFont}', serif` }}
          onBlur={onBodyBlur}
        >
          {body}
        </div>

        <div
          className="mt-16 pt-12 flex items-center gap-6"
          style={{ borderTop: `1px solid ${tokens.border}` }}
        >
          <ConsultantAvatar operator={operator} tokens={tokens} size={44} textSize="text-small" />
          <div>
            <div className="text-small font-semibold" style={{ color: tokens.headingText }}>
              {operator.consultantName}
            </div>
            <div className="text-label" style={{ color: tokens.mutedText, textTransform: "none", letterSpacing: "0", fontWeight: 400 }}>
              {operator.companyName}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Shared bits ────────────────────────────────────────────────────────────

function ConsultantAvatar({
  operator,
  tokens,
  size,
  textSize = "text-h3",
}: {
  operator: { consultantName: string };
  tokens: { cardBg: string; accent: string };
  size: number;
  textSize?: string;
}) {
  // Shows the consultant's initial only. The consultant photo lives on the
  // hero-letter cover's branded footer — rendering it here as well makes the
  // same face appear across every cover variant's greeting, which the
  // operator didn't ask for.
  return (
    <div
      className="rounded-2xl overflow-hidden shrink-0 flex items-center justify-center"
      style={{ background: tokens.cardBg, width: size, height: size }}
    >
      <div
        className={`w-full h-full flex items-center justify-center font-bold ${textSize}`}
        style={{ color: tokens.accent }}
      >
        {operator.consultantName?.charAt(0) ?? "?"}
      </div>
    </div>
  );
}

function BigQuote({
  theme,
  tokens,
}: {
  theme: { displayFont: string };
  tokens: { accent: string };
}) {
  return (
    <div
      aria-hidden
      className="select-none -mb-8"
      style={{
        fontFamily: `'${theme.displayFont}', serif`,
        fontSize: "7rem",
        lineHeight: 1,
        color: tokens.accent,
        opacity: 0.13,
      }}
    >
      &#8220;
    </div>
  );
}
