"use client";

import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import { resolveTokens } from "@/lib/theme";
import type { Section, ThemeTokens, ProposalTheme } from "@/lib/types";

// Inclusions & Exclusions — five layout variants, each driven by the
// section's resolved theme tokens (so operator-set background colours
// flow through unchanged).
//
//  • inline-ribbon   (default) — small flat chips on a single horizontal
//                                line per side, packed tight.
//  • stacked-clean             — minimal two-column stack, no chip boxes.
//  • two-tone-bands            — full-width green/grey alternating bands.
//  • split-columns             — generous editorial side-by-side columns.
//  • default                   — legacy chip-card layout (kept for back-
//                                compat; not the recommended choice).

export function InclusionsSection({ section }: { section: Section }) {
  const { proposal, updateInclusions, updateExclusions } = useProposalStore();
  const { mode } = useEditorStore();
  const isEditor = mode === "editor";
  const { inclusions, exclusions, theme } = proposal;
  const tokens = resolveTokens(theme.tokens, section.styleOverrides);
  const variant = section.layoutVariant || "inline-ribbon";

  const onInclusion = (i: number, v: string) => {
    const next = [...inclusions];
    next[i] = v;
    updateInclusions(next.filter((s) => s.trim()));
  };
  const onExclusion = (i: number, v: string) => {
    const next = [...exclusions];
    next[i] = v;
    updateExclusions(next.filter((s) => s.trim()));
  };
  const addItem = (kind: "inclusion" | "exclusion") => {
    if (kind === "inclusion") updateInclusions([...inclusions, "New item"]);
    else updateExclusions([...exclusions, "New item"]);
  };

  if (variant === "inline-ribbon") {
    return (
      <InlineRibbon
        inclusions={inclusions}
        exclusions={exclusions}
        onInclusion={onInclusion}
        onExclusion={onExclusion}
        addItem={addItem}
        isEditor={isEditor}
        tokens={tokens}
        theme={theme}
      />
    );
  }

  if (variant === "stacked-clean") {
    return (
      <StackedClean
        inclusions={inclusions}
        exclusions={exclusions}
        onInclusion={onInclusion}
        onExclusion={onExclusion}
        addItem={addItem}
        isEditor={isEditor}
        tokens={tokens}
        theme={theme}
      />
    );
  }

  if (variant === "two-tone-bands") {
    return (
      <TwoToneBands
        inclusions={inclusions}
        exclusions={exclusions}
        onInclusion={onInclusion}
        onExclusion={onExclusion}
        addItem={addItem}
        isEditor={isEditor}
        tokens={tokens}
        theme={theme}
      />
    );
  }

  if (variant === "split-columns") {
    return (
      <SplitColumns
        inclusions={inclusions}
        exclusions={exclusions}
        onInclusion={onInclusion}
        onExclusion={onExclusion}
        addItem={addItem}
        isEditor={isEditor}
        tokens={tokens}
        theme={theme}
      />
    );
  }

  // Legacy chip-card "default" — kept so old proposals don't shift.
  return (
    <Default
      inclusions={inclusions}
      exclusions={exclusions}
      onInclusion={onInclusion}
      onExclusion={onExclusion}
      addItem={addItem}
      isEditor={isEditor}
      tokens={tokens}
      theme={theme}
    />
  );
}

// ── Shared types ─────────────────────────────────────────────────────────

type LayoutProps = {
  inclusions: string[];
  exclusions: string[];
  onInclusion: (i: number, v: string) => void;
  onExclusion: (i: number, v: string) => void;
  addItem: (kind: "inclusion" | "exclusion") => void;
  isEditor: boolean;
  tokens: ThemeTokens;
  theme: ProposalTheme;
};

function Eyebrow({
  children,
  color,
}: {
  children: React.ReactNode;
  color: string;
}) {
  return (
    <div
      className="text-[10px] uppercase tracking-[0.3em] font-semibold mb-3"
      style={{ color }}
    >
      {children}
    </div>
  );
}

function Tick({ color }: { color: string }) {
  return (
    <svg
      width="9"
      height="9"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden
      className="shrink-0"
    >
      <path
        d="M2.5 6.5 L5 9 L9.5 3.5"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Cross({ color }: { color: string }) {
  return (
    <svg
      width="9"
      height="9"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden
      className="shrink-0"
    >
      <path
        d="M3 3 L9 9 M9 3 L3 9"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ── Inline ribbon (default) ──────────────────────────────────────────────
// Items run inline as small flat chips, wrapping onto 1-2 lines, packed
// close together. No card backgrounds.

function InlineRibbon({
  inclusions,
  exclusions,
  onInclusion,
  onExclusion,
  addItem,
  isEditor,
  tokens,
  theme,
}: LayoutProps) {
  return (
    <div
      className="py-6 md:py-8 px-8 md:px-20"
      style={{ background: tokens.sectionSurface }}
    >
      <div className="max-w-6xl mx-auto space-y-10">
        <div>
          <Eyebrow color={tokens.accent}>What&apos;s included</Eyebrow>
          <ul
            className="flex flex-wrap items-center gap-x-5 gap-y-2"
            style={{
              color: tokens.bodyText,
              fontFamily: `'${theme.bodyFont}', sans-serif`,
            }}
          >
            {inclusions.map((item, i) => (
              <li
                key={i}
                className="inline-flex items-center gap-1.5 text-[12.5px] leading-tight"
              >
                <Tick color={tokens.accent} />
                <span
                  className="outline-none"
                  contentEditable={isEditor}
                  suppressContentEditableWarning
                  onBlur={(e) => onInclusion(i, e.currentTarget.textContent ?? item)}
                >
                  {item}
                </span>
              </li>
            ))}
            {isEditor && (
              <li>
                <button
                  onClick={() => addItem("inclusion")}
                  className="text-[11px]"
                  style={{ color: tokens.mutedText }}
                >
                  + Add
                </button>
              </li>
            )}
          </ul>
        </div>

        <div>
          <Eyebrow color={tokens.mutedText}>Not included</Eyebrow>
          <ul
            className="flex flex-wrap items-center gap-x-5 gap-y-2"
            style={{
              color: tokens.mutedText,
              fontFamily: `'${theme.bodyFont}', sans-serif`,
            }}
          >
            {exclusions.map((item, i) => (
              <li
                key={i}
                className="inline-flex items-center gap-1.5 text-[12.5px] leading-tight"
              >
                <Cross color={tokens.mutedText} />
                <span
                  className="outline-none"
                  contentEditable={isEditor}
                  suppressContentEditableWarning
                  onBlur={(e) => onExclusion(i, e.currentTarget.textContent ?? item)}
                >
                  {item}
                </span>
              </li>
            ))}
            {isEditor && (
              <li>
                <button
                  onClick={() => addItem("exclusion")}
                  className="text-[11px]"
                  style={{ color: tokens.mutedText }}
                >
                  + Add
                </button>
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ── Stacked clean ────────────────────────────────────────────────────────
// Two-column minimalist list — small text, no chip backgrounds, items
// stack vertically with a tight rhythm.

function StackedClean({
  inclusions,
  exclusions,
  onInclusion,
  onExclusion,
  addItem,
  isEditor,
  tokens,
  theme,
}: LayoutProps) {
  return (
    <div
      className="py-6 md:py-8 px-8 md:px-20"
      style={{ background: tokens.sectionSurface }}
    >
      <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-x-14 gap-y-10">
        <div>
          <Eyebrow color={tokens.accent}>What&apos;s included</Eyebrow>
          <ul
            className="space-y-1.5"
            style={{
              color: tokens.bodyText,
              fontFamily: `'${theme.bodyFont}', sans-serif`,
            }}
          >
            {inclusions.map((item, i) => (
              <li key={i} className="flex items-center gap-2 text-[13px] leading-snug">
                <Tick color={tokens.accent} />
                <span
                  className="outline-none flex-1"
                  contentEditable={isEditor}
                  suppressContentEditableWarning
                  onBlur={(e) => onInclusion(i, e.currentTarget.textContent ?? item)}
                >
                  {item}
                </span>
              </li>
            ))}
            {isEditor && (
              <li>
                <button
                  onClick={() => addItem("inclusion")}
                  className="text-[11px] pt-1"
                  style={{ color: tokens.mutedText }}
                >
                  + Add item
                </button>
              </li>
            )}
          </ul>
        </div>

        <div>
          <Eyebrow color={tokens.mutedText}>Not included</Eyebrow>
          <ul
            className="space-y-1.5"
            style={{
              color: tokens.mutedText,
              fontFamily: `'${theme.bodyFont}', sans-serif`,
            }}
          >
            {exclusions.map((item, i) => (
              <li key={i} className="flex items-center gap-2 text-[13px] leading-snug">
                <Cross color={tokens.mutedText} />
                <span
                  className="outline-none flex-1"
                  contentEditable={isEditor}
                  suppressContentEditableWarning
                  onBlur={(e) => onExclusion(i, e.currentTarget.textContent ?? item)}
                >
                  {item}
                </span>
              </li>
            ))}
            {isEditor && (
              <li>
                <button
                  onClick={() => addItem("exclusion")}
                  className="text-[11px] pt-1"
                  style={{ color: tokens.mutedText }}
                >
                  + Add item
                </button>
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ── Two-tone bands ───────────────────────────────────────────────────────
// Two horizontal bands stacked: an accent-tinted band for inclusions and a
// neutral muted band for exclusions, with items in inline-flow.

function TwoToneBands({
  inclusions,
  exclusions,
  onInclusion,
  onExclusion,
  addItem,
  isEditor,
  tokens,
  theme,
}: LayoutProps) {
  return (
    <div style={{ background: tokens.sectionSurface }}>
      <div
        className="px-8 md:px-20 py-12 md:py-14"
        style={{ background: `${tokens.accent}10` }}
      >
        <div className="max-w-6xl mx-auto">
          <Eyebrow color={tokens.accent}>What&apos;s included</Eyebrow>
          <ul
            className="flex flex-wrap items-center gap-x-6 gap-y-2.5"
            style={{
              color: tokens.headingText,
              fontFamily: `'${theme.bodyFont}', sans-serif`,
            }}
          >
            {inclusions.map((item, i) => (
              <li
                key={i}
                className="inline-flex items-center gap-1.5 text-[13px] leading-tight"
              >
                <Tick color={tokens.accent} />
                <span
                  className="outline-none"
                  contentEditable={isEditor}
                  suppressContentEditableWarning
                  onBlur={(e) => onInclusion(i, e.currentTarget.textContent ?? item)}
                >
                  {item}
                </span>
              </li>
            ))}
            {isEditor && (
              <li>
                <button
                  onClick={() => addItem("inclusion")}
                  className="text-[11px]"
                  style={{ color: tokens.mutedText }}
                >
                  + Add
                </button>
              </li>
            )}
          </ul>
        </div>
      </div>

      <div
        className="px-8 md:px-20 py-12 md:py-14"
        style={{ background: `${tokens.mutedText}0e` }}
      >
        <div className="max-w-6xl mx-auto">
          <Eyebrow color={tokens.mutedText}>Not included</Eyebrow>
          <ul
            className="flex flex-wrap items-center gap-x-6 gap-y-2.5"
            style={{
              color: tokens.bodyText,
              fontFamily: `'${theme.bodyFont}', sans-serif`,
            }}
          >
            {exclusions.map((item, i) => (
              <li
                key={i}
                className="inline-flex items-center gap-1.5 text-[13px] leading-tight"
              >
                <Cross color={tokens.mutedText} />
                <span
                  className="outline-none"
                  contentEditable={isEditor}
                  suppressContentEditableWarning
                  onBlur={(e) => onExclusion(i, e.currentTarget.textContent ?? item)}
                >
                  {item}
                </span>
              </li>
            ))}
            {isEditor && (
              <li>
                <button
                  onClick={() => addItem("exclusion")}
                  className="text-[11px]"
                  style={{ color: tokens.mutedText }}
                >
                  + Add
                </button>
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ── Split columns (kept from old layout, generous spacing) ──────────────

function SplitColumns({
  inclusions,
  exclusions,
  onInclusion,
  onExclusion,
  addItem,
  isEditor,
  tokens,
  theme,
}: LayoutProps) {
  return (
    <div
      className="py-6 md:py-8 px-8 md:px-20"
      style={{ background: tokens.sectionSurface }}
    >
      <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12 md:gap-16">
        <div>
          <div
            className="text-[11px] uppercase tracking-[0.22em] font-semibold mb-7 pb-4 border-b"
            style={{ color: tokens.accent, borderColor: `${tokens.accent}25` }}
          >
            What&apos;s included
          </div>
          <ul className="space-y-2">
            {inclusions.map((item, i) => (
              <li
                key={i}
                className="flex items-center gap-2 text-[13px] leading-snug"
                style={{
                  color: tokens.bodyText,
                  fontFamily: `'${theme.bodyFont}', sans-serif`,
                }}
              >
                <Tick color={tokens.accent} />
                <span
                  className="outline-none flex-1"
                  contentEditable={isEditor}
                  suppressContentEditableWarning
                  onBlur={(e) => onInclusion(i, e.currentTarget.textContent ?? item)}
                >
                  {item}
                </span>
              </li>
            ))}
            {isEditor && (
              <li>
                <button
                  onClick={() => addItem("inclusion")}
                  className="text-xs pt-2"
                  style={{ color: tokens.mutedText }}
                >
                  + Add item
                </button>
              </li>
            )}
          </ul>
        </div>

        <div>
          <div
            className="text-[11px] uppercase tracking-[0.22em] font-semibold mb-7 pb-4 border-b"
            style={{ color: tokens.mutedText, borderColor: tokens.border }}
          >
            Not included
          </div>
          <ul className="space-y-2">
            {exclusions.map((item, i) => (
              <li
                key={i}
                className="flex items-center gap-2 text-[13px] leading-snug"
                style={{
                  color: tokens.mutedText,
                  fontFamily: `'${theme.bodyFont}', sans-serif`,
                }}
              >
                <Cross color={tokens.mutedText} />
                <span
                  className="outline-none flex-1"
                  contentEditable={isEditor}
                  suppressContentEditableWarning
                  onBlur={(e) => onExclusion(i, e.currentTarget.textContent ?? item)}
                >
                  {item}
                </span>
              </li>
            ))}
            {isEditor && (
              <li>
                <button
                  onClick={() => addItem("exclusion")}
                  className="text-xs pt-2"
                  style={{ color: tokens.mutedText }}
                >
                  + Add item
                </button>
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ── Legacy default (chip cards) ─────────────────────────────────────────

function Default({
  inclusions,
  exclusions,
  onInclusion,
  onExclusion,
  addItem,
  isEditor,
  tokens,
  theme,
}: LayoutProps) {
  return (
    <div
      className="py-6 md:py-8 px-8 md:px-20"
      style={{ background: tokens.sectionSurface }}
    >
      <div className="max-w-5xl mx-auto">
        <div className="text-[10px] uppercase tracking-[0.3em] mb-12" style={{ color: tokens.mutedText }}>
          Inclusions &amp; exclusions
        </div>

        <div className="grid md:grid-cols-2 gap-12 md:gap-16">
          <div>
            <div
              className="text-[11px] uppercase tracking-[0.22em] font-semibold mb-7 pb-4 border-b"
              style={{ color: tokens.accent, borderColor: `${tokens.accent}25` }}
            >
              What&apos;s included
            </div>
            <ul className="space-y-1.5">
              {inclusions.map((item, i) => (
                <li
                  key={i}
                  className="flex items-center gap-3 py-1.5 px-2.5 rounded-md"
                  style={{ background: `${tokens.accent}0a` }}
                >
                  <span
                    className="shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full"
                    style={{ background: tokens.accent, color: "white" }}
                    aria-hidden
                  >
                    <Tick color="#fff" />
                  </span>
                  <span
                    className="text-[13.5px] leading-snug outline-none flex-1"
                    style={{ color: tokens.bodyText, fontFamily: `'${theme.bodyFont}', sans-serif` }}
                    contentEditable={isEditor}
                    suppressContentEditableWarning
                    onBlur={(e) => onInclusion(i, e.currentTarget.textContent ?? item)}
                  >
                    {item}
                  </span>
                </li>
              ))}
              {isEditor && (
                <li>
                  <button
                    onClick={() => addItem("inclusion")}
                    className="text-xs pl-2 pt-2"
                    style={{ color: tokens.mutedText }}
                  >
                    + Add item
                  </button>
                </li>
              )}
            </ul>
          </div>

          <div>
            <div
              className="text-[11px] uppercase tracking-[0.22em] font-semibold mb-7 pb-4 border-b"
              style={{ color: tokens.mutedText, borderColor: tokens.border }}
            >
              Not included
            </div>
            <ul className="space-y-1.5">
              {exclusions.map((item, i) => (
                <li
                  key={i}
                  className="flex items-center gap-3 py-1.5 px-2.5 rounded-md"
                  style={{ background: `${tokens.border}30` }}
                >
                  <span
                    className="shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-bold leading-none"
                    style={{ background: tokens.mutedText, color: "white" }}
                    aria-hidden
                  >
                    X
                  </span>
                  <span
                    className="text-[13.5px] leading-snug outline-none flex-1"
                    style={{ color: tokens.mutedText, fontFamily: `'${theme.bodyFont}', sans-serif` }}
                    contentEditable={isEditor}
                    suppressContentEditableWarning
                    onBlur={(e) => onExclusion(i, e.currentTarget.textContent ?? item)}
                  >
                    {item}
                  </span>
                </li>
              ))}
              {isEditor && (
                <li>
                  <button
                    onClick={() => addItem("exclusion")}
                    className="text-xs pl-2 pt-2"
                    style={{ color: tokens.mutedText }}
                  >
                    + Add item
                  </button>
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
