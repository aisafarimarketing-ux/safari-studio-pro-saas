"use client";

import { AmenityIcon } from "./AmenityIcon";
import type { ThemeTokens, ProposalTheme } from "../types";

// Editorial text block used inside all four new day layouts. Matches the
// reference typography: "DAY 0X" overline, uppercase serif destination
// title, sans narrative, italic "Stay at …" line, amenity bullets with
// line-art icons.

export function DayText({
  dayNumber,
  destination,
  narrative,
  stayAt,
  highlights,
  isEditor,
  tokens,
  theme,
  onDestinationChange,
  onNarrativeChange,
  narrativeClamp = 4,
}: {
  dayNumber: number;
  destination: string;
  narrative: string;
  stayAt: string | null;
  highlights: string[];
  isEditor: boolean;
  tokens: ThemeTokens;
  theme: ProposalTheme;
  onDestinationChange: (next: string) => void;
  onNarrativeChange: (next: string) => void;
  /** Max lines of narrative to show in the card body (editor can exceed). */
  narrativeClamp?: number;
}) {
  return (
    <div className="flex flex-col h-full">
      <div
        className="text-[11px] uppercase tracking-[0.32em] font-semibold mb-3"
        style={{
          color: tokens.mutedText,
          fontFamily: `'${theme.bodyFont}', sans-serif`,
        }}
      >
        Day {String(dayNumber).padStart(2, "0")}
      </div>

      <h3
        className="font-bold uppercase tracking-tight outline-none"
        style={{
          color: tokens.headingText,
          fontFamily: `'${theme.displayFont}', serif`,
          fontSize: "clamp(1.75rem, 3.2vw, 2.6rem)",
          lineHeight: 0.98,
          letterSpacing: "-0.01em",
        }}
        contentEditable={isEditor}
        suppressContentEditableWarning
        onBlur={(e) => onDestinationChange(e.currentTarget.textContent?.trim() ?? destination)}
      >
        {destination}
      </h3>

      <p
        className="mt-4 outline-none"
        style={{
          color: tokens.bodyText,
          fontFamily: `'${theme.bodyFont}', sans-serif`,
          fontSize: "14.5px",
          lineHeight: 1.7,
          display: "-webkit-box",
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: isEditor ? undefined : narrativeClamp,
          overflow: isEditor ? "visible" : "hidden",
        }}
        contentEditable={isEditor}
        suppressContentEditableWarning
        data-ai-editable="day"
        onBlur={(e) => onNarrativeChange(e.currentTarget.textContent ?? "")}
      >
        {narrative || (isEditor ? "Describe this day…" : "")}
      </p>

      {stayAt && (
        <div
          className="mt-5 text-[14px] italic"
          style={{
            color: tokens.bodyText,
            fontFamily: `'${theme.displayFont}', serif`,
          }}
        >
          <span style={{ color: tokens.mutedText }}>Stay at </span>
          <span style={{ color: tokens.headingText, fontWeight: 600 }}>
            {stayAt}
          </span>
        </div>
      )}

      {highlights.length > 0 && (
        <ul className="mt-5 space-y-2 pt-4" style={{ borderTop: `1px solid ${tokens.border}` }}>
          {highlights.slice(0, 3).map((h, i) => (
            <li
              key={i}
              className="flex items-center gap-2.5 text-[13.5px]"
              style={{
                color: tokens.bodyText,
                fontFamily: `'${theme.bodyFont}', sans-serif`,
              }}
            >
              <span style={{ color: tokens.accent }}>
                <AmenityIcon label={h} size={15} />
              </span>
              <span>{h}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
