"use client";

import type { ResolvedProperty, ThemeTokens, ProposalTheme } from "./types";

// Reusable "Stay at" block. Three presentation modes tuned for the five
// layouts:
//   - panel   : framed card with optional thumbnail (default)
//   - overlay : light-on-dark, for text-over-image compositions
//   - inline  : no frame; text-only row for tight layouts
//
// When property is null we render a polished "No property selected"
// block with a Choose property CTA.

export function StayCard({
  property,
  isEditor,
  tokens,
  theme,
  onChoose,
  variant = "panel",
  withThumbnail = true,
}: {
  property: ResolvedProperty | null;
  isEditor: boolean;
  tokens: ThemeTokens;
  theme: ProposalTheme;
  onChoose: () => void;
  variant?: "panel" | "overlay" | "inline";
  withThumbnail?: boolean;
}) {
  const isOverlay = variant === "overlay";
  const isInline = variant === "inline";

  // Tone-aware colours for the three modes.
  const labelColor = isOverlay ? "rgba(255,255,255,0.65)" : tokens.mutedText;
  const titleColor = isOverlay ? "white" : tokens.headingText;
  const bodyColor = isOverlay ? "rgba(255,255,255,0.75)" : tokens.bodyText;
  const mutedColor = isOverlay ? "rgba(255,255,255,0.55)" : tokens.mutedText;
  const dividerColor = isOverlay ? "rgba(255,255,255,0.14)" : tokens.border;
  const bgColor = isOverlay
    ? "rgba(0,0,0,0.45)"
    : isInline
      ? "transparent"
      : tokens.sectionSurface;

  // ── Empty state ──────────────────────────────────────────────────────
  if (!property) {
    return (
      <div
        className={`relative ${isInline ? "" : "rounded-xl overflow-hidden"}`}
        style={{
          background: bgColor,
          border: isOverlay
            ? "1px solid rgba(255,255,255,0.18)"
            : isInline
              ? "none"
              : `1px dashed ${tokens.border}`,
          backdropFilter: isOverlay ? "blur(8px)" : undefined,
        }}
      >
        <div className={isInline ? "py-2" : "px-5 py-4"}>
          <div
            className="text-[10px] uppercase tracking-[0.26em] font-semibold mb-1.5"
            style={{ color: isOverlay ? "rgba(255,255,255,0.55)" : tokens.accent }}
          >
            Stay at
          </div>
          <div
            className="text-[14px]"
            style={{ color: isOverlay ? "rgba(255,255,255,0.72)" : tokens.mutedText }}
          >
            No property selected
          </div>
          {isEditor && (
            <button
              type="button"
              onClick={onChoose}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold rounded-lg transition"
              style={{
                color: isOverlay ? "white" : tokens.accent,
                background: isOverlay ? "rgba(255,255,255,0.12)" : `${tokens.accent}10`,
                border: isOverlay ? "1px solid rgba(255,255,255,0.25)" : `1px solid ${tokens.accent}30`,
              }}
            >
              <span style={{ color: isOverlay ? "white" : "#c9a84c" }}>◇</span>
              Choose property
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Property present ─────────────────────────────────────────────────
  return (
    <div
      className={`relative ${isInline ? "" : "rounded-xl overflow-hidden"}`}
      style={{
        background: bgColor,
        border: isOverlay
          ? "1px solid rgba(255,255,255,0.16)"
          : isInline
            ? "none"
            : `1px solid ${tokens.border}`,
        backdropFilter: isOverlay ? "blur(8px)" : undefined,
      }}
    >
      <div className={isInline ? "flex gap-3" : "flex gap-3 p-4"}>
        {withThumbnail && property.leadImageUrl && (
          <div
            className="shrink-0 rounded-lg overflow-hidden"
            style={{
              width: 64,
              height: 64,
              background: tokens.cardBg,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={property.leadImageUrl}
              alt={property.name}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div
            className="text-[10px] uppercase tracking-[0.26em] font-semibold mb-1"
            style={{ color: labelColor }}
          >
            Stay at
          </div>
          <div
            className="text-[15px] font-semibold leading-tight truncate"
            style={{ color: titleColor, fontFamily: `'${theme.displayFont}', serif` }}
          >
            {property.name}
          </div>
          {property.location && (
            <div
              className="text-[11.5px] mt-0.5 truncate"
              style={{ color: mutedColor }}
            >
              {property.location}
            </div>
          )}
          {property.summary && !isInline && (
            <p
              className="mt-2 text-[12.5px] leading-snug line-clamp-2"
              style={{ color: bodyColor }}
            >
              {property.summary}
            </p>
          )}
        </div>
      </div>

      {property.highlights.length > 0 && !isInline && (
        <div
          className="px-4 pb-3 pt-2 flex flex-wrap gap-1.5"
          style={{ borderTop: `1px solid ${dividerColor}` }}
        >
          {property.highlights.map((h, i) => (
            <span
              key={i}
              className="text-[10.5px] px-2 py-0.5 rounded-full"
              style={{
                color: isOverlay ? "rgba(255,255,255,0.82)" : tokens.bodyText,
                background: isOverlay ? "rgba(255,255,255,0.10)" : `${tokens.accent}10`,
                border: isOverlay ? "1px solid rgba(255,255,255,0.14)" : `1px solid ${tokens.accent}20`,
              }}
            >
              {h}
            </span>
          ))}
        </div>
      )}

      {isEditor && !isInline && (
        <div
          className="px-4 pb-3 pt-0.5"
          style={{ borderTop: property.highlights.length > 0 ? "none" : `1px solid ${dividerColor}` }}
        >
          <button
            type="button"
            onClick={onChoose}
            className="text-[11px] font-semibold uppercase tracking-[0.2em] hover:opacity-80 transition"
            style={{ color: isOverlay ? "rgba(255,255,255,0.65)" : tokens.accent }}
          >
            Swap property →
          </button>
        </div>
      )}
    </div>
  );
}
