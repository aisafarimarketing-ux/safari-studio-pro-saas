"use client";

import type React from "react";

// ─── PrintGuard — block CMD+P / File→Print outside Print PDF mode ────────
//
// Web View and Spread are designed for online viewing — printing them
// produces a long-webpage screenshot chopped across pages. This guard
// hides the wrapped canvas in @media print and shows a redirect message
// so the operator (or client) gets clear feedback instead of a broken PDF.
//
// Print PDF is the only mode that should ever pass through to the
// printer. Used in two places:
//   - Editor's ProposalCanvas (Web View + Spread branches)
//   - Public share view at /p/[id] (Spread branch)
//
// The headline + optional body let each call site tailor the message
// to its audience: the editor nudges operators back to Print PDF mode,
// the share view nudges clients to the Print button.

type Props = {
  children: React.ReactNode;
  headline: string;
  /** Optional supporting copy. Defaults to a generic explanation that
   *  works in both editor + share-view contexts. */
  body?: string;
};

export function PrintGuard({ children, headline, body }: Props) {
  const supporting =
    body ??
    "Web View and Spread are designed for online viewing. Printing them would cut sections across pages. Print PDF renders A4-safe pages composed for clean output.";

  return (
    <>
      <style>{`
        .ss-print-guard-message { display: none; }
        @media print {
          .ss-print-guard-canvas { display: none !important; }
          .ss-print-guard-message {
            display: flex !important;
            min-height: 100vh;
            align-items: center;
            justify-content: center;
            padding: 60px 40px;
            text-align: center;
            flex-direction: column;
            gap: 14px;
            background: white;
            color: #1b3a2d;
            font-family: system-ui, -apple-system, sans-serif;
          }
          /* Strip @page margins so the message reads as the only
             content on the page. */
          @page { margin: 16mm; }
        }
      `}</style>
      <div className="ss-print-guard-canvas contents">{children}</div>
      <div className="ss-print-guard-message" aria-hidden="true">
        <div style={{ fontSize: "22px", fontWeight: 600, lineHeight: 1.3 }}>
          {headline}
        </div>
        <div
          style={{
            fontSize: "13px",
            color: "rgba(0,0,0,0.55)",
            maxWidth: "480px",
            lineHeight: 1.55,
          }}
        >
          {supporting}
        </div>
      </div>
    </>
  );
}
