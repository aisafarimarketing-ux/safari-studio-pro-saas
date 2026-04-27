"use client";

import type { ProposalTheme, ThemeTokens } from "@/lib/types";

// ─── Editorial section header for print pages ────────────────────────────
//
// Shared by every per-page print component (day, property, practical info,
// payment, closing, etc.) so the operator's deck reads as one cohesive
// magazine — not a stack of component-specific layouts.
//
// Visual rhythm (top → down):
//
//   ─── thin hairline ────────────────────────────────
//   EYEBROW · UPPERCASE · TRACKED OUT
//   Title in display serif, large
//   Optional small subtitle in muted italic
//
// Compact (`compact`) trims the top spacing for pages that already
// have a strong header treatment of their own (e.g. property hero).

export function PrintSectionHeader({
  eyebrow,
  title,
  subtitle,
  theme,
  tokens,
  padded = true,
  compact = false,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  theme: ProposalTheme;
  tokens: ThemeTokens;
  /** Add the standard horizontal page padding. Set false when the
   *  consumer wraps the header in its own padding context. */
  padded?: boolean;
  /** Tighter spacing — used when the header sits inside a smaller frame. */
  compact?: boolean;
}) {
  return (
    <header
      className={[
        padded ? "px-12" : "",
        compact ? "pt-6 pb-4" : "pt-8 pb-6",
        "shrink-0",
      ].join(" ")}
    >
      <div
        aria-hidden
        className="mb-3"
        style={{
          height: 1,
          background: tokens.border,
        }}
      />
      {eyebrow && (
        <div
          className={[
            "uppercase font-semibold mb-1.5",
            compact ? "text-[9.5px] tracking-[0.26em]" : "text-[10px] tracking-[0.28em]",
          ].join(" ")}
          style={{ color: tokens.mutedText }}
        >
          {eyebrow}
        </div>
      )}
      <h1
        className="font-bold leading-[1.05]"
        style={{
          color: tokens.headingText,
          fontFamily: `'${theme.displayFont}', serif`,
          fontSize: compact
            ? "clamp(20px, 2.4vw, 26px)"
            : "clamp(24px, 3vw, 34px)",
          letterSpacing: "-0.012em",
        }}
      >
        {title}
      </h1>
      {subtitle && (
        <div
          className="mt-2 text-[12.5px] italic"
          style={{ color: tokens.mutedText }}
        >
          {subtitle}
        </div>
      )}
    </header>
  );
}
