"use client";

import type { ReactNode } from "react";
import { useProposalStore } from "@/store/proposalStore";

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
//
// Footer: every non-bleed page renders a thin brand strip at the
// bottom — brand name on the left, page number on the right (CSS
// counter; see globals/print stylesheet). The page number is a
// pseudo-element so it doesn't touch React state; the brand name is
// real DOM so it can read the live operator.companyName from the
// proposal store. Both are pointer-events:none + low z-index so
// section content that fills the page covers them; sections that
// end short surface them as an intentional brand anchor.

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
  // Brand name pulled from the live proposal — operator.companyName
  // is the canonical source-of-truth for "what to call this brand"
  // across the whole deck. Falls back to empty string when not set
  // so the footer simply doesn't render the brand half.
  const brandName = useProposalStore(
    (s) => s.proposal.operator?.companyName?.trim() ?? "",
  );

  return (
    <section
      className={`pdf-page ${bleed ? "pdf-page--bleed" : "pdf-page--padded"} ${className}`}
      data-pdf-label={label ?? ""}
      data-continuation={continuation ? "true" : undefined}
      style={background ? { background } : undefined}
    >
      {children}
      {!bleed && brandName && (
        <span
          className="pdf-page-brand"
          aria-hidden
          // Inline style keeps this self-contained; avoids depending
          // on Tailwind classes that could be tree-shaken or whose
          // print rendering is unpredictable.
          style={{
            position: "absolute",
            left: "18mm",
            bottom: "7mm",
            zIndex: 1,
            fontSize: "8.5pt",
            letterSpacing: "0.04em",
            color: "rgba(10, 20, 17, 0.45)",
            fontFamily: "var(--font-body, system-ui, sans-serif)",
            pointerEvents: "none",
            // Truncate runaway brand names so the footer can't wrap
            // and overlap the page number on the right.
            maxWidth: "120mm",
            overflow: "hidden",
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
          }}
        >
          {brandName}
        </span>
      )}
    </section>
  );
}
