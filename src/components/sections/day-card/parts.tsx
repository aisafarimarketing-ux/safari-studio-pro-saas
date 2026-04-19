"use client";

import type { ThemeTokens, ProposalTheme } from "./types";

// Small, shared editable pieces used by every layout — day label, phase
// label, destination title, narrative paragraph, highlights row. Each is
// `contentEditable` in editor mode, with the `data-ai-editable` hook so
// the selection-toolbar can rewrite them.

export function DayLabel({
  dayNumber,
  country,
  board,
  tokens,
  overlay = false,
}: {
  dayNumber: number;
  country: string;
  board: string;
  tokens: ThemeTokens;
  overlay?: boolean;
}) {
  const label = [
    `Day ${String(dayNumber).padStart(2, "0")}`,
    country,
    board,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <div
      className="text-[10px] uppercase tracking-[0.32em] font-semibold"
      style={{ color: overlay ? "rgba(255,255,255,0.68)" : tokens.mutedText }}
    >
      {label}
    </div>
  );
}

export function DestinationTitle({
  value,
  isEditor,
  tokens,
  theme,
  overlay = false,
  size = "lg",
  onChange,
}: {
  value: string;
  isEditor: boolean;
  tokens: ThemeTokens;
  theme: ProposalTheme;
  overlay?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  onChange: (next: string) => void;
}) {
  const fontSize =
    size === "xl"
      ? "clamp(2.4rem, 5vw, 4rem)"
      : size === "lg"
        ? "clamp(1.9rem, 3.6vw, 2.8rem)"
        : size === "md"
          ? "clamp(1.5rem, 2.6vw, 2rem)"
          : "clamp(1.15rem, 1.8vw, 1.4rem)";
  return (
    <h3
      className="font-bold leading-[0.98] tracking-tight outline-none"
      style={{
        color: overlay ? "white" : tokens.headingText,
        fontFamily: `'${theme.displayFont}', serif`,
        fontSize,
        textShadow: overlay ? "0 2px 16px rgba(0,0,0,0.35)" : undefined,
      }}
      contentEditable={isEditor}
      suppressContentEditableWarning
      onBlur={(e) => onChange(e.currentTarget.textContent?.trim() ?? value)}
    >
      {value}
    </h3>
  );
}

export function PhaseLabel({
  value,
  isEditor,
  tokens,
  theme,
  overlay = false,
  onChange,
}: {
  value: string;
  isEditor: boolean;
  tokens: ThemeTokens;
  theme: ProposalTheme;
  overlay?: boolean;
  onChange: (next: string) => void;
}) {
  if (!value && !isEditor) return null;
  return (
    <div
      className="italic text-[14px] outline-none"
      style={{
        color: overlay ? "rgba(255,255,255,0.72)" : tokens.mutedText,
        fontFamily: `'${theme.displayFont}', serif`,
      }}
      contentEditable={isEditor}
      suppressContentEditableWarning
      onBlur={(e) => onChange(e.currentTarget.textContent ?? "")}
    >
      {value || "Add a short phase label (optional)"}
    </div>
  );
}

export function Narrative({
  value,
  isEditor,
  tokens,
  theme,
  overlay = false,
  maxLines = 6,
  onChange,
}: {
  value: string;
  isEditor: boolean;
  tokens: ThemeTokens;
  theme: ProposalTheme;
  overlay?: boolean;
  maxLines?: number;
  onChange: (next: string) => void;
}) {
  return (
    <p
      className={`outline-none`}
      style={{
        color: overlay ? "rgba(255,255,255,0.86)" : tokens.bodyText,
        fontFamily: `'${theme.bodyFont}', sans-serif`,
        fontSize: "14.5px",
        lineHeight: 1.75,
        display: "-webkit-box",
        WebkitBoxOrient: "vertical",
        WebkitLineClamp: isEditor ? undefined : maxLines,
        overflow: isEditor ? "visible" : "hidden",
      }}
      contentEditable={isEditor}
      suppressContentEditableWarning
      data-ai-editable="day"
      onBlur={(e) => onChange(e.currentTarget.textContent ?? "")}
    >
      {value || (isEditor ? "Describe this day…" : "")}
    </p>
  );
}

export function Highlights({
  items,
  tokens,
  overlay = false,
}: {
  items: string[];
  tokens: ThemeTokens;
  overlay?: boolean;
}) {
  if (!items || items.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((h, i) => (
        <li
          key={i}
          className="text-[11px] px-2.5 py-1 rounded-full"
          style={{
            color: overlay ? "rgba(255,255,255,0.82)" : tokens.bodyText,
            background: overlay ? "rgba(255,255,255,0.10)" : `${tokens.accent}12`,
            border: overlay ? "1px solid rgba(255,255,255,0.16)" : `1px solid ${tokens.accent}22`,
            backdropFilter: overlay ? "blur(6px)" : undefined,
          }}
        >
          {h}
        </li>
      ))}
    </ul>
  );
}

export function DayNumeral({
  n,
  tokens,
  theme,
  overlay = false,
  size = "huge",
}: {
  n: number;
  tokens: ThemeTokens;
  theme: ProposalTheme;
  overlay?: boolean;
  size?: "large" | "huge";
}) {
  const fontSize = size === "huge" ? "clamp(6rem, 14vw, 11rem)" : "clamp(3.5rem, 8vw, 6rem)";
  return (
    <div
      aria-hidden
      className="leading-none select-none pointer-events-none"
      style={{
        fontFamily: `'${theme.displayFont}', serif`,
        fontSize,
        color: overlay ? "rgba(255,255,255,0.14)" : `${tokens.accent}20`,
        letterSpacing: "-0.04em",
        lineHeight: 0.84,
      }}
    >
      {String(n).padStart(2, "0")}
    </div>
  );
}
