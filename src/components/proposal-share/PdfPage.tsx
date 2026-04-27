"use client";

import type { ReactNode } from "react";

// ─── PdfPage — strict A4 page wrapper for the print view ─────────────────
//
// Every section the print document renders gets wrapped in one of these.
// The wrapper enforces:
//   - exact 210mm × 297mm dimensions
//   - overflow: hidden so a section that doesn't fit is CLIPPED (not
//     spilled onto a phantom page that breaks the deck)
//   - break-after: page so the next section starts on a new page
//   - break-inside: avoid so the page itself never splits
//
// The clip is deliberate: a clipped page is ugly but visible and
// fixable; an uncontrolled spillover produces the blank-page / orphan-
// gallery / split-card issues the operator was seeing.

export type PdfPageProps = {
  children: ReactNode;
  /** Diagnostic label used by debug mode + overflow logger.
   *  e.g. "Cover", "Day 3", "Property — Angama Mara". */
  label?: string;
  /** Skip the default container padding. Used by full-bleed pages
   *  (cover, closing) where the section paints to the page edge. */
  bleed?: boolean;
  /** Optional background — defaults to transparent so the section
   *  itself controls colour. */
  background?: string;
  /** Extra className for one-off page tweaks. */
  className?: string;
  /** Marks this page as a continuation of a prior section (e.g. the
   *  tail half of a day card). Debug mode highlights it in gold so
   *  the operator can see at a glance which days were auto-split. */
  continuation?: boolean;
};

export function PdfPage({
  children,
  label,
  bleed = false,
  background,
  className = "",
  continuation = false,
}: PdfPageProps) {
  return (
    <section
      className={`pdf-page ${bleed ? "pdf-page--bleed" : "pdf-page--padded"} ${className}`}
      data-pdf-label={label ?? ""}
      data-continuation={continuation ? "true" : undefined}
      style={background ? { background } : undefined}
    >
      {children}
    </section>
  );
}
