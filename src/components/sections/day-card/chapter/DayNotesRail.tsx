"use client";

import type { Day, ThemeTokens, ProposalTheme } from "@/lib/types";

// Vertical dotted-line timeline listing each day within a chapter — the
// compact "what actually happens today" rail next to the big property
// spread. Karibu-inspired. Narrative is inline-editable.

export function DayNotesRail({
  days,
  isEditor,
  tokens,
  theme,
  onEditDay,
  compact = false,
}: {
  days: Day[];
  isEditor: boolean;
  tokens: ThemeTokens;
  theme: ProposalTheme;
  onEditDay: (dayId: string, patch: Partial<Day>) => void;
  compact?: boolean;
}) {
  if (days.length === 0) return null;

  return (
    <div className="relative" style={{ paddingLeft: compact ? 24 : 32 }}>
      {/* Dotted vertical rail */}
      <div
        aria-hidden
        className="absolute top-2 bottom-2 left-1.5"
        style={{
          width: 0,
          borderLeft: `1.5px dotted ${tokens.border}`,
        }}
      />

      <ul className="space-y-6">
        {days.map((day) => (
          <li key={day.id} className="relative">
            {/* Dot */}
            <span
              aria-hidden
              className="absolute left-[-28px] top-2 w-3 h-3 rounded-full"
              style={{
                background: tokens.accent,
                border: `2px solid ${tokens.sectionSurface}`,
                boxShadow: `0 0 0 1.5px ${tokens.accent}`,
              }}
            />
            <div
              className="text-[10px] uppercase tracking-[0.28em] font-semibold"
              style={{ color: tokens.mutedText }}
            >
              Day {String(day.dayNumber).padStart(2, "0")}
            </div>
            <div
              className="mt-1.5 text-[15px] font-semibold leading-tight outline-none"
              style={{
                color: tokens.headingText,
                fontFamily: `'${theme.displayFont}', serif`,
              }}
              contentEditable={isEditor}
              suppressContentEditableWarning
              onBlur={(e) =>
                onEditDay(day.id, { destination: e.currentTarget.textContent ?? day.destination })
              }
            >
              {day.destination}
            </div>
            {day.subtitle && (
              <div
                className="mt-0.5 text-[12.5px] italic outline-none"
                style={{
                  color: tokens.mutedText,
                  fontFamily: `'${theme.displayFont}', serif`,
                }}
                contentEditable={isEditor}
                suppressContentEditableWarning
                onBlur={(e) => onEditDay(day.id, { subtitle: e.currentTarget.textContent ?? "" })}
              >
                {day.subtitle}
              </div>
            )}
            <p
              className="mt-2 text-[13.5px] leading-[1.75] outline-none"
              style={{
                color: tokens.bodyText,
                fontFamily: `'${theme.bodyFont}', sans-serif`,
              }}
              contentEditable={isEditor}
              suppressContentEditableWarning
              data-ai-editable="day"
              onBlur={(e) => onEditDay(day.id, { description: e.currentTarget.textContent ?? "" })}
            >
              {day.description || (isEditor ? "Describe this day…" : "")}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
