"use client";

import { useState } from "react";
import type { Proposal } from "@/lib/types";

// Sticky minimal header on the public share view.
//
// Left:  operator logo (if uploaded) + company name
// Right: Share (copy link with confirmation state) + Print
//
// Translucent so the proposal's content shows behind it on scroll. Hides
// during print so it doesn't appear in the PDF export.

export function ShareViewHeader({ proposal }: { proposal: Proposal }) {
  const { operator, theme } = proposal;
  const tokens = theme.tokens;
  const [shareState, setShareState] = useState<"idle" | "copied" | "error">("idle");

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareState("copied");
      setTimeout(() => setShareState("idle"), 2200);
    } catch {
      setShareState("error");
      setTimeout(() => setShareState("idle"), 2200);
    }
  };

  // Print routes through /p/[id]/print, which always renders the
  // composer-driven A4 PrintProposalDocument regardless of the
  // proposal's viewMode. Calling window.print() directly on this
  // page would screenshot the on-screen Web View / Spread layout
  // and chop sections across pages — Print PDF is the only safe
  // export source.
  const handlePrint = () => {
    if (!proposal.id) return;
    const url = `/p/${proposal.id}/print?autoPrint=1`;
    const win = window.open(url, "_blank");
    if (!win) {
      // Popup blocked → fall back to same-tab navigation. The print
      // route auto-fires window.print() once layout has settled.
      window.location.href = url;
    }
  };

  const company = operator.companyName?.trim() || "";

  return (
    <header
      className="sticky top-0 z-30 backdrop-blur-md print:hidden"
      style={{
        background: hexToRgba(tokens.pageBg, 0.85),
        borderBottom: `1px solid ${tokens.border}`,
      }}
    >
      <div className="max-w-[900px] mx-auto px-6 md:px-8 h-14 flex items-center justify-between gap-4">
        {/* Left: logo + name */}
        <div className="flex items-center gap-2.5 min-w-0">
          {operator.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={operator.logoUrl}
              alt={company}
              className="h-7 w-auto object-contain shrink-0"
            />
          )}
          {company && (
            <span
              className="text-[14px] font-semibold tracking-tight truncate"
              style={{ color: tokens.headingText, fontFamily: `'${theme.displayFont}', serif` }}
            >
              {company}
            </span>
          )}
        </div>

        {/* Right: Share + Print */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handlePrint}
            className="px-3 py-1.5 text-[13px] rounded-lg transition active:scale-95 hover:bg-black/5"
            style={{ color: tokens.mutedText, border: `1px solid ${tokens.border}` }}
            title="Open the print-safe A4 view to print or save as PDF"
          >
            Print
          </button>
          <button
            onClick={handleShare}
            className="px-3.5 py-1.5 text-[13px] rounded-lg font-semibold transition active:scale-95 hover:brightness-110"
            style={
              shareState === "copied"
                ? { background: tokens.accent, color: tokens.pageBg }
                : shareState === "error"
                  ? { background: "#b34334", color: "white" }
                  : { background: tokens.headingText, color: tokens.pageBg }
            }
            title="Copy link to this proposal"
          >
            {shareState === "copied" ? "Link copied ✓" : shareState === "error" ? "Copy failed" : "Share"}
          </button>
        </div>
      </div>
    </header>
  );
}

// Convert a hex colour into rgba(...) with a given alpha. Used for the
// translucent backdrop so the underlying proposal palette shows through.
function hexToRgba(hex: string, alpha: number): string {
  const trimmed = hex.replace("#", "").trim();
  if (trimmed.length !== 6 && trimmed.length !== 3) return hex;
  const expand = trimmed.length === 3
    ? trimmed.split("").map((c) => c + c).join("")
    : trimmed;
  const r = parseInt(expand.slice(0, 2), 16);
  const g = parseInt(expand.slice(2, 4), 16);
  const b = parseInt(expand.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return hex;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
