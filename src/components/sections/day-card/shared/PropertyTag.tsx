"use client";

import { AmenityIcon } from "./AmenityIcon";
import type { ResolvedProperty, ThemeTokens, ProposalTheme } from "../types";

// Cream footer "property tag" banner — the magazine-byline element at the
// bottom of every new day card. Tiny lodge monogram + property name in
// serif + italic tagline + 2-3 amenity chips with line-art icons.
//
// Empty state: if no property is selected, the tag shrinks to a single
// "Choose property →" CTA so the day card still looks intentional.

export function PropertyTag({
  property,
  isEditor,
  tokens,
  theme,
  onChoose,
  highlights,
}: {
  property: ResolvedProperty | null;
  isEditor: boolean;
  tokens: ThemeTokens;
  theme: ProposalTheme;
  onChoose: () => void;
  /** Amenity chip labels — passed separately so day-level highlights can
   *  appear here too, not just property amenities. */
  highlights: string[];
}) {
  if (!property) {
    return (
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{
          background: `linear-gradient(to right, ${tokens.cardBg}, ${tokens.sectionSurface})`,
        }}
      >
        <div
          className="text-[11px] uppercase tracking-[0.28em] font-semibold"
          style={{ color: tokens.mutedText }}
        >
          No property selected
        </div>
        {isEditor && (
          <button
            type="button"
            onClick={onChoose}
            className="text-[11.5px] font-semibold px-3 py-1.5 rounded-md transition hover:opacity-85"
            style={{
              color: tokens.accent,
              background: `${tokens.accent}14`,
              border: `1px solid ${tokens.accent}30`,
            }}
          >
            ◇ Choose property →
          </button>
        )}
      </div>
    );
  }

  const chips = highlights.slice(0, 3);
  return (
    <div
      className="grid grid-cols-[auto_1fr_auto] items-center gap-5 px-5 py-3.5"
      style={{ background: tokens.sectionSurface }}
    >
      {/* Monogram + property name + tagline */}
      <div className="flex items-center gap-3">
        <Monogram tokens={tokens} />
        <div className="min-w-0">
          <div
            className="text-[15px] font-semibold leading-tight tracking-tight truncate"
            style={{ color: tokens.headingText, fontFamily: `'${theme.displayFont}', serif` }}
          >
            {property.name}
          </div>
          {(property.summary || property.location) && (
            <div
              className="text-[11.5px] italic mt-0.5 truncate"
              style={{
                color: tokens.mutedText,
                fontFamily: `'${theme.displayFont}', serif`,
              }}
            >
              {property.summary || property.location}
            </div>
          )}
        </div>
      </div>

      {/* Spacer */}
      <div />

      {/* Amenity chips (aligned right) */}
      {chips.length > 0 ? (
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {chips.map((label, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap"
              style={{
                color: tokens.bodyText,
                background: `${tokens.accent}10`,
                border: `1px solid ${tokens.accent}22`,
              }}
            >
              <span style={{ color: tokens.accent }}>
                <AmenityIcon label={label} />
              </span>
              <span>{label}</span>
            </span>
          ))}
        </div>
      ) : (
        <div className="text-[11px] italic" style={{ color: tokens.mutedText }}>
          {isEditor ? "Add a day highlight to see a chip here" : ""}
        </div>
      )}
    </div>
  );
}

// Tiny hand-drawn lodge mark used as the property monogram. Consistent
// across every property (the editorial magazine feel comes from *every*
// property having one, not from personalised marks).
function Monogram({ tokens }: { tokens: ThemeTokens }) {
  return (
    <div
      className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
      style={{
        background: tokens.cardBg,
        border: `1px solid ${tokens.border}`,
      }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        {/* Simple thatched lodge silhouette */}
        <path
          d="M3 12l9-7 9 7"
          stroke={tokens.accent}
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M5.5 11v6.5a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V11"
          stroke={tokens.accent}
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M10 18.5v-3.5a2 2 0 1 1 4 0v3.5"
          stroke={tokens.accent}
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
