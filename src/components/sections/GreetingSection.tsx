"use client";

import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import { resolveTokens } from "@/lib/theme";
import { AIWriteButton } from "@/components/editor/AIWriteButton";
import { RichEditable } from "@/components/editor/RichEditable";
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
  const tripStyleLabel = trip.tripStyle?.trim();
  const availabilityNote =
    (section.content.availabilityNote as string) ||
    "Camps on this route fill quickly during peak dates — we're holding this plan based on current availability.";
  const consultantCredit =
    (section.content.consultantCredit as string) ||
    `Designed by ${operator.consultantName || "your consultant"}${tripStyleLabel ? `, who plans ${tripStyleLabel.toLowerCase()} routes` : ""}, based on current camp availability and seasonal movement.`;

  // The greeting body now supports inline color + font-size (rich-text
  // toolbar). Save innerHTML, sanitised to the allow-list, so the
  // toolbar's spans round-trip through preview / share / PDF.
  const onBodyChange = (next: string) =>
    updateSectionContent(section.id, { body: next });
  const onAvailabilityNoteChange = (next: string) =>
    updateSectionContent(section.id, { availabilityNote: next });
  const onConsultantCreditChange = (next: string) =>
    updateSectionContent(section.id, { consultantCredit: next });

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
      <div className="py-6 relative" style={{ background: tokens.sectionSurface }}>
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
            <ConsultantCredit
              value={consultantCredit}
              isEditor={isEditor}
              tokens={tokens}
              onChange={onConsultantCreditChange}
            />
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
            <AvailabilityNote
              value={availabilityNote}
              isEditor={isEditor}
              tokens={tokens}
              onChange={onAvailabilityNoteChange}
            />
            <BigQuote theme={theme} tokens={tokens} />
            <RichEditable
              isEditor={isEditor}
              as="div"
              value={body || ""}
              onChange={onBodyChange}
              className="text-body-lg leading-loose whitespace-pre-line outline-none relative z-10"
              style={{ color: tokens.bodyText, fontFamily: `'${theme.displayFont}', serif` }}
              dataAttrs={{ "data-ai-editable": "greeting" }}
            />
          </div>
        </div>
      </div>
    );
  }

  // ── Centered-minimal ───────────────────────────────────────────────────────
  if (variant === "centered-minimal") {
    return (
      <div className="py-6 text-center relative" style={{ background: tokens.sectionSurface }}>
        {aiButton}
        <div className="ed-narrow">
          <div
            className="text-label ed-label mb-12"
            style={{ color: tokens.accent }}
          >
            Welcome
          </div>
          <AvailabilityNote
            value={availabilityNote}
            isEditor={isEditor}
            tokens={tokens}
            onChange={onAvailabilityNoteChange}
            align="center"
          />
          <RichEditable
            isEditor={isEditor}
            as="div"
            value={body || ""}
            onChange={onBodyChange}
            className="text-body-lg leading-loose whitespace-pre-line outline-none"
            style={{ color: tokens.headingText, fontFamily: `'${theme.displayFont}', serif` }}
            dataAttrs={{ "data-ai-editable": "greeting" }}
          />
          <div className="mt-12 inline-flex flex-col items-center gap-2">
            <div className="inline-flex items-center gap-3">
              <ConsultantAvatar operator={operator} tokens={tokens} size={32} textSize="text-small" />
              <span className="text-small font-medium" style={{ color: tokens.headingText }}>
                {operator.consultantName}
              </span>
            </div>
            <ConsultantCredit
              value={consultantCredit}
              isEditor={isEditor}
              tokens={tokens}
              onChange={onConsultantCreditChange}
              align="center"
            />
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
        <div className="flex-1 py-6">
          <div className="ed-narrow !mx-0 md:!mx-[clamp(2rem,8vw,6rem)] !max-w-[620px]">
            <div
              className="text-label ed-label mb-12"
              style={{ color: tokens.mutedText }}
            >
              A personal note
            </div>
            <AvailabilityNote
              value={availabilityNote}
              isEditor={isEditor}
              tokens={tokens}
              onChange={onAvailabilityNoteChange}
            />
            <RichEditable
              isEditor={isEditor}
              as="div"
              value={body || ""}
              onChange={onBodyChange}
              className="text-body-lg leading-loose whitespace-pre-line outline-none"
              style={{ color: tokens.bodyText, fontFamily: `'${theme.bodyFont}', sans-serif` }}
              dataAttrs={{ "data-ai-editable": "greeting" }}
            />
            <div className="mt-12 flex items-center gap-4">
              <ConsultantAvatar operator={operator} tokens={tokens} size={40} textSize="text-small" />
              <div>
                <div className="text-small font-semibold" style={{ color: tokens.headingText }}>
                  {operator.consultantName}
                </div>
                <div className="text-label" style={{ color: tokens.mutedText, textTransform: "none", letterSpacing: "0", fontWeight: 400 }}>
                  {operator.companyName}
                </div>
                <ConsultantCredit
                  value={consultantCredit}
                  isEditor={isEditor}
                  tokens={tokens}
                  onChange={onConsultantCreditChange}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Editorial-letter (default) ─────────────────────────────────────────────
  return (
    <div className="py-6 relative" style={{ background: tokens.sectionSurface }}>
      {aiButton}
      <div className="ed-narrow">
        <div
          className="text-label ed-label mb-12"
          style={{ color: tokens.accent }}
        >
          A personal note
        </div>

        <AvailabilityNote
          value={availabilityNote}
          isEditor={isEditor}
          tokens={tokens}
          onChange={onAvailabilityNoteChange}
        />

        <BigQuote theme={theme} tokens={tokens} />

        <RichEditable
          isEditor={isEditor}
          as="div"
          value={body || ""}
          onChange={onBodyChange}
          className="text-body-lg leading-loose whitespace-pre-line outline-none relative z-10"
          style={{ color: tokens.headingText, fontFamily: `'${theme.displayFont}', serif` }}
          dataAttrs={{ "data-ai-editable": "greeting" }}
        />

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
            <ConsultantCredit
              value={consultantCredit}
              isEditor={isEditor}
              tokens={tokens}
              onChange={onConsultantCreditChange}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Shared bits ────────────────────────────────────────────────────────────

function AvailabilityNote({
  value,
  isEditor,
  tokens,
  onChange,
  align = "left",
}: {
  value: string;
  isEditor: boolean;
  tokens: { mutedText: string };
  onChange: (next: string) => void;
  align?: "left" | "center";
}) {
  return (
    <p
      className="text-[12.5px] italic leading-relaxed -mt-8 mb-10 outline-none"
      style={{
        color: tokens.mutedText,
        textAlign: align,
        maxWidth: align === "center" ? undefined : "44ch",
      }}
      contentEditable={isEditor}
      suppressContentEditableWarning
      onBlur={(e) => onChange(e.currentTarget.textContent ?? "")}
    >
      {value}
    </p>
  );
}

function ConsultantCredit({
  value,
  isEditor,
  tokens,
  onChange,
  align = "left",
}: {
  value: string;
  isEditor: boolean;
  tokens: { mutedText: string };
  onChange: (next: string) => void;
  align?: "left" | "center";
}) {
  return (
    <p
      className="text-[11.5px] leading-relaxed mt-2 outline-none"
      style={{
        color: tokens.mutedText,
        textAlign: align,
        maxWidth: align === "center" ? undefined : "48ch",
      }}
      contentEditable={isEditor}
      suppressContentEditableWarning
      onBlur={(e) => onChange(e.currentTarget.textContent ?? "")}
    >
      {value}
    </p>
  );
}

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
