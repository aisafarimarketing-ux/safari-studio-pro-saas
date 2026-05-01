"use client";

import type { Section } from "@/lib/types";

// ─── SectionHeaderStrip ─────────────────────────────────────────────────
//
// The coloured top strip every section (except cover, personal note,
// and day cards) wears like a hat. Identical visual register to the
// day card's day-head strip — same height, same typography — so the
// proposal reads as one rhythm of coloured bands.
//
// **Editor chrome lives in SectionChrome, not here.** This component
// used to carry its own inline 🎨 popover with strip / section /
// accent tabs, but that duplicated the per-section colour pills
// SectionChrome already renders top-right of every section. Two
// editors stacked on the same surface — operators couldn't reach
// the one underneath. SectionChrome now exposes a `headerBg`
// picker for sections that wear this strip, so the colour edit
// flows through the same unified path.
//
// Storage:
//   color → section.styleOverrides.headerBg
//
// Falls back to section.content.color (legacy band-divider entries
// migrate cleanly) and finally to a sensible gold so a freshly-
// added strip is never invisible.

const DEFAULT_HEADER_COLOR = "#c9a84c";

export function SectionHeaderStrip({
  section,
  title,
  subtitle,
  variant = "default",
}: {
  section: Section;
  /** UPPERCASE label rendered as the strip's primary text. */
  title: string;
  /** Optional secondary text rendered after a · separator. */
  subtitle?: string;
  /** "compact" reduces the strip's height to ~40px (used between
   *  properties in the accommodation showcase so the rhythm stays
   *  readable when there are 4-6 properties stacked). Default 52px
   *  matches the day-card head strip. */
  variant?: "default" | "compact";
}) {
  const overrides = section.styleOverrides ?? {};
  const headerBg =
    (overrides.headerBg as string | undefined) ||
    (section.content.color as string | undefined) ||
    DEFAULT_HEADER_COLOR;

  const height = variant === "compact" ? 40 : 52;
  const titleSize = variant === "compact" ? "11px" : "13px";

  return (
    <div
      className="relative w-full flex items-center gap-3 px-6 md:px-10"
      style={{
        background: headerBg,
        height,
        color: autoTextOnHex(headerBg),
      }}
    >
      <span
        className="font-bold uppercase tracking-[0.24em] truncate"
        style={{ fontSize: titleSize }}
      >
        {title}
      </span>
      {subtitle && (
        <span
          className="uppercase tracking-[0.2em] truncate opacity-80"
          style={{ fontSize: variant === "compact" ? "9.5px" : "11px" }}
        >
          · {subtitle}
        </span>
      )}
    </div>
  );
}

// Pick black or white text against the strip's bg luminance.
// Exported so per-property header bands in PropertyShowcaseSection share
// the same readability rule without duplicating the WCAG math.
export function autoTextOnHex(bg: string): string {
  const cleaned = bg.replace(/^#/, "");
  const full = cleaned.length === 3 ? cleaned.split("").map((c) => c + c).join("") : cleaned.slice(0, 6);
  if (full.length !== 6) return "#101828";
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  const channel = (n: number) => {
    const v = n / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const lum = 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  return lum > 0.55 ? "#101828" : "#ffffff";
}
