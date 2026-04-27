"use client";

import type { PracticalCard, ThemeTokens, ProposalTheme } from "@/lib/types";

// ─── Print: Practical Info / Good to Know page ───────────────────────────
//
// One A4 page rendering up to N cards in a 2-column grid. The print
// orchestrator chunks the proposal's practicalInfo array into multiple
// pages of at most CARDS_PER_PAGE entries; the second+ pages get
// "— Continued" appended to the title so the operator (and reader)
// know they're reading a split section.

const CARDS_PER_PAGE = 6;

export function PrintPracticalInfoPage({
  cards, theme, tokens, partLabel,
}: {
  cards: PracticalCard[];
  theme: ProposalTheme;
  tokens: ThemeTokens;
  /** Empty for the only / first page; e.g. "— Continued" or
   *  "— Part 2 of 3" for follow-ups. */
  partLabel?: string;
}) {
  return (
    <div
      className="w-full h-full flex flex-col px-12 py-10"
      style={{ background: tokens.pageBg, color: tokens.bodyText }}
    >
      <header className="mb-6 shrink-0">
        <div
          className="text-[10px] uppercase tracking-[0.28em] font-semibold mb-2"
          style={{ color: tokens.mutedText }}
        >
          Good to know
        </div>
        <h2
          className="font-bold leading-[1.1]"
          style={{
            color: tokens.headingText,
            fontFamily: `'${theme.displayFont}', serif`,
            fontSize: "clamp(22px, 2.6vw, 30px)",
            letterSpacing: "-0.01em",
          }}
        >
          Practical information
          {partLabel && (
            <span
              className="ml-2 text-[14px] font-normal italic"
              style={{ color: tokens.mutedText }}
            >
              {partLabel}
            </span>
          )}
        </h2>
      </header>

      <div className="flex-1 min-h-0 grid grid-cols-2 gap-4 content-start">
        {cards.map((card) => (
          <article
            key={card.id}
            className="rounded-lg p-4"
            style={{
              background: tokens.cardBg,
              border: `1px solid ${tokens.border}`,
            }}
          >
            <div className="flex items-baseline gap-2 mb-1.5">
              {card.icon && (
                <span aria-hidden className="text-[15px] leading-none">
                  {card.icon}
                </span>
              )}
              <h3
                className="text-[13.5px] font-semibold"
                style={{
                  color: tokens.headingText,
                  fontFamily: `'${theme.displayFont}', serif`,
                }}
              >
                {card.title}
              </h3>
            </div>
            <p
              className="text-[11.5px] leading-[1.55]"
              style={{
                color: tokens.bodyText,
                display: "-webkit-box",
                WebkitLineClamp: 8,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {card.body}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}

export { CARDS_PER_PAGE };
