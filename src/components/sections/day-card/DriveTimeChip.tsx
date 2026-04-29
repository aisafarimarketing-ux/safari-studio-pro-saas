"use client";

import type { ThemeTokens } from "@/lib/types";

// Drive-time chip — sits BETWEEN day cards, captioning how the
// traveller gets from one day's location to the next. Operators write
// the text directly: "→ 2.5 hr scenic drive · Manyara to Tarangire"
// or "✈ 1 hr flight to Zanzibar". Free-form so a single component
// works for drives, flights, transfers, walks, etc.
//
// Editor mode shows a placeholder hint and a contentEditable target so
// the operator can type inline. Preview hides the chip entirely when
// blank — never show "Add transition…" placeholder text to clients.
//
// Visual register: tracked-out small caps in a thin horizontal row,
// with a hairline above and below. Sits in the space-y gap of
// DayJourneySection, full-width, no chrome.

export function DriveTimeChip({
  value,
  isEditor,
  tokens,
  onChange,
}: {
  value: string;
  isEditor: boolean;
  tokens: ThemeTokens;
  onChange: (next: string) => void;
}) {
  if (!value && !isEditor) return null;

  return (
    <div
      className="px-10 md:px-14 py-3"
      style={{ background: tokens.sectionSurface }}
    >
      <div className="flex items-center gap-3 max-w-3xl mx-auto">
        <span
          aria-hidden
          className="flex-1 h-px"
          style={{ background: tokens.border }}
        />
        <span
          className="text-[10.5px] uppercase tracking-[0.32em] font-semibold outline-none text-center"
          style={{
            color: tokens.mutedText,
            opacity: value ? 1 : 0.55,
          }}
          contentEditable={isEditor}
          suppressContentEditableWarning
          onBlur={(e) => onChange(e.currentTarget.textContent?.trim() ?? "")}
        >
          {value ||
            (isEditor
              ? "Describe the transfer between days — drive, flight, transfer, …"
              : "")}
        </span>
        <span
          aria-hidden
          className="flex-1 h-px"
          style={{ background: tokens.border }}
        />
      </div>
    </div>
  );
}
