"use client";

import { useEffect, useState, use } from "react";
import { useSearchParams } from "next/navigation";
import { useProposalStore } from "@/store/proposalStore";
import { SectionRenderer } from "@/components/editor/SectionRenderer";
import type { Proposal, Section } from "@/lib/types";

// Chrome-free render of a public proposal — same content as /p/[id] but
// without the share header, comment panel, or view tracker. The Playwright
// PDF renderer hits this URL; the in-app "Open print view" fallback opens
// it with ?autoPrint=1 and we call window.print() once fonts + images are
// settled.
//
// A ready flag (window.__SS_READY__) is set after a short settle window so
// the headless renderer (and auto-print) know when to capture.

export default function PrintProposalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const autoPrint = searchParams?.get("autoPrint") === "1";
  const { proposal } = useProposalStore();
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/public/proposals/${id}`);
        if (res.status === 404) {
          if (!cancelled) setError("Proposal not found");
          return;
        }
        if (!res.ok) {
          if (!cancelled) setError(`Error ${res.status}`);
          return;
        }
        const data = await res.json();
        const content = data?.proposal?.contentJson as Proposal | undefined;
        if (!cancelled && content) {
          useProposalStore.getState().hydrateProposal(content);
          setLoaded(true);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Load failed");
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  // Once the proposal has rendered, wait for fonts + images, then flip the
  // ready flag and optionally trigger print. We deliberately wait a beat
  // longer than strictly necessary — better a slow PDF than a half-rendered
  // one.
  useEffect(() => {
    if (!loaded) return;
    let cancelled = false;
    const settle = async () => {
      try {
        // Fonts: wait until the browser has loaded every @font-face used.
        const fonts = (document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts;
        if (fonts?.ready) await fonts.ready;
      } catch {}
      // Images: wait for each image on the page to decode.
      const imgs = Array.from(document.querySelectorAll<HTMLImageElement>("img"));
      await Promise.all(
        imgs.map((img) =>
          img.complete
            ? Promise.resolve()
            : new Promise<void>((r) => {
                img.addEventListener("load", () => r(), { once: true });
                img.addEventListener("error", () => r(), { once: true });
              }),
        ),
      );
      // One extra paint to let layout settle after images land.
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      if (cancelled) return;
      (window as unknown as { __SS_READY__?: boolean }).__SS_READY__ = true;
      if (autoPrint) {
        // Defer a tick so the ready flag is set before the print dialog
        // mirrors the on-screen DOM.
        setTimeout(() => window.print(), 60);
      }
    };
    void settle();
    return () => { cancelled = true; };
  }, [loaded, autoPrint]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-2xl font-semibold text-black/70">{error}</div>
      </div>
    );
  }

  if (!loaded) {
    return <div className="min-h-screen" />;
  }

  const { theme, operator } = proposal;
  const sorted = [...proposal.sections]
    .filter((s: Section) => s.visible)
    .sort((a: Section, b: Section) => a.order - b.order);

  return (
    <div className="proposal-canvas ss-print-mode" style={{ background: theme.tokens.pageBg }}>
      <style>{`
        /* ── Page setup — A4 with zero default margin so sections can go
           edge-to-edge when they choose to. Individual section wrappers
           already control their own padding. */
        @page {
          size: A4;
          margin: 0;
        }

        html, body {
          background: ${theme.tokens.pageBg};
          margin: 0;
          padding: 0;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          color-adjust: exact;
        }

        .proposal-canvas {
          --font-display: '${theme.displayFont}', Georgia, serif;
          --font-body: '${theme.bodyFont}', system-ui, sans-serif;
        }

        /* On screen — centre a single A4-width column so the page *looks*
           like the printed output before the user hits print. */
        .ss-print-mode {
          width: 210mm;
          margin: 0 auto;
        }

        /* Every major section starts on a new page. The "section-*"
           wrappers are rendered by SectionRenderer below; we target
           top-level children of the proposal column. */
        .ss-print-mode > div > section,
        .ss-print-mode > div > div {
          break-inside: avoid-page;
        }

        /* Cover is a full page — force a page break after it. */
        [data-section-type="cover"] {
          break-after: page;
          page-break-after: always;
        }

        /* Keep day cards, property cards, and pricing tiers intact on
           the same page when possible. */
        .dm-card,
        [data-section-type="dayJourney"] .dm-card,
        [data-section-type="propertyShowcase"] .dm-card,
        [data-section-type="pricing"] > div {
          break-inside: avoid-page;
          page-break-inside: avoid;
        }

        /* Headings never orphan. */
        h1, h2, h3 {
          break-after: avoid-page;
          page-break-after: avoid;
        }

        /* Images: crisp edges, no shadows that smear in print. */
        img {
          image-rendering: -webkit-optimize-contrast;
          print-color-adjust: exact;
          -webkit-print-color-adjust: exact;
        }

        /* Strip any editor chrome that might leak into the print DOM. */
        [data-editor-chrome],
        .editor-toolbar,
        .editor-sidebar,
        .context-panel,
        .left-sidebar,
        button[title*="Drag"],
        button[title*="Delete"],
        button[title*="Duplicate"] {
          display: none !important;
        }

        /* Print-specific refinements — fonts render sharper at actual
           print DPI than at screen DPI, so we step up a touch. */
        @media print {
          .ss-print-mode {
            width: auto;
            margin: 0;
          }
          body {
            font-size: 10.5pt;
          }
          a {
            color: inherit !important;
            text-decoration: none !important;
          }
        }
      `}</style>

      <div style={{ background: theme.tokens.pageBg }}>
        {sorted.map((section: Section) => (
          <div key={section.id} data-section-type={section.type}>
            <SectionRenderer section={section} />
          </div>
        ))}
      </div>

      {operator.companyName && (
        <footer
          className="border-t py-6 px-6 text-center"
          style={{ background: theme.tokens.pageBg, borderColor: theme.tokens.border }}
        >
          <div className="text-xs tracking-wide" style={{ color: theme.tokens.mutedText }}>
            Proposal by{" "}
            <span style={{ color: theme.tokens.bodyText, fontWeight: 500 }}>
              {operator.companyName}
            </span>
            {operator.email && (
              <>
                {" "}&middot;{" "}
                <span style={{ color: theme.tokens.accent }}>{operator.email}</span>
              </>
            )}
            {operator.phone && <> &middot; {operator.phone}</>}
          </div>
        </footer>
      )}
    </div>
  );
}
