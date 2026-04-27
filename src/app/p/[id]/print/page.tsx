"use client";

import { useEffect, useState, use } from "react";
import { useSearchParams } from "next/navigation";
import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import { PrintProposalDocument } from "@/components/proposal-share/PrintProposalDocument";
import { compressPrintImages } from "@/lib/compressImagesForPrint";
import type { Proposal } from "@/lib/types";

// ─── Print proposal page ───────────────────────────────────────────────────
//
// Chrome-free render of a public proposal — same content as /p/[id] but
// without the share header, comment panel, or view tracker. Hosted at
// `/p/[id]/print` and consumed by the Playwright PDF sidecar (which hits
// the URL with networkidle waits) plus the in-app "Open print view"
// fallback (`?autoPrint=1`).
//
// Strict A4 page system: every section renders inside a fixed-height
// .pdf-page div with overflow:hidden + break-after:page. The previous
// "let the browser break wherever" approach produced blank pages,
// orphaned image strips, and split cards. This page enforces that one
// section = one page; clipping is preferred to spillover so problem
// sections are visible and fixable instead of silently breaking.
//
// Debug mode: append `?debugPdf=true` on the URL to draw per-page
// outlines + log any page whose content overflows the A4 frame.

export default function PrintProposalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const autoPrint = searchParams?.get("autoPrint") === "1";
  const debugPdf = searchParams?.get("debugPdf") === "true";
  const { proposal } = useProposalStore();
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Print view is strictly client-facing — force + re-clamp "print" mode
  // so no editor chrome (swap buttons, × removes, + adds, AI rewrite
  // popovers, hover controls) ever bleeds into the PDF.
  useEffect(() => {
    const { setMode } = useEditorStore.getState();
    setMode("print");
    const unsub = useEditorStore.subscribe((state) => {
      if (state.mode !== "print") state.setMode("print");
    });
    return () => unsub();
  }, []);

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
  // ready flag and optionally trigger print. Also wait one paint after
  // image compression so the layout has settled before the PDF capture.
  useEffect(() => {
    if (!loaded) return;
    let cancelled = false;
    const settle = async () => {
      try {
        const fonts = (document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts;
        if (fonts?.ready) await fonts.ready;
      } catch {}
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
      try {
        const stats = await compressPrintImages();
        if (stats.processed > 0) {
          const savedMb = Math.round((stats.bytesBefore - stats.bytesAfter) / 1024 / 1024 * 10) / 10;
          console.info(
            `[print-compress] ${stats.processed} image${stats.processed === 1 ? "" : "s"} · saved ~${savedMb}MB`,
          );
        }
      } catch (err) {
        console.warn("[print-compress] failed; continuing with originals:", err);
      }
      // Two requestAnimationFrames so layout settles after the
      // compressed image swap-ins, then flag ready.
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      if (cancelled) return;
      (window as unknown as { __SS_READY__?: boolean }).__SS_READY__ = true;
      if (autoPrint) setTimeout(() => window.print(), 60);
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

  const { theme } = proposal;

  return (
    <div className="ss-print-mode" style={{ background: theme.tokens.pageBg }}>
      <PrintCss pageBg={theme.tokens.pageBg} displayFont={theme.displayFont} bodyFont={theme.bodyFont} />
      <PrintProposalDocument debug={debugPdf} />
    </div>
  );
}

// ─── Print CSS ────────────────────────────────────────────────────────────
//
// Inline <style> rather than a static stylesheet so the page-bg colour
// follows the proposal's theme. The strict @page + .pdf-page rules
// enforce the slide-deck pagination; the `[data-editor-chrome]` selectors
// nuke any editor affordances that might have leaked into the print DOM.

function PrintCss({
  pageBg, displayFont, bodyFont,
}: {
  pageBg: string;
  displayFont: string;
  bodyFont: string;
}) {
  return (
    <style>{`
      /* ── Page setup ─────────────────────────────────────────────── */
      @page {
        size: A4;
        margin: 0;
      }

      html, body {
        background: ${pageBg};
        margin: 0;
        padding: 0;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
        color-adjust: exact;
      }

      * { box-sizing: border-box; }

      .ss-print-mode {
        --font-display: '${displayFont}', Georgia, serif;
        --font-body: '${bodyFont}', system-ui, sans-serif;
      }

      /* ── Document column ─────────────────────────────────────────
         On screen, centre an A4-width column so the operator previews
         the printed output before exporting. In actual print, the
         @page rule takes over and this column becomes the page itself. */
      .pdf-document {
        width: 210mm;
        margin: 0 auto;
        background: ${pageBg};
      }

      /* ── Strict A4 page ──────────────────────────────────────────
         Fixed dimensions, clipped overflow, hard page breaks. Every
         major section renders inside one of these. */
      .pdf-page {
        position: relative;
        width: 210mm;
        height: 297mm;
        overflow: hidden;
        break-after: page;
        page-break-after: always;
        break-inside: avoid;
        page-break-inside: avoid;
        background: ${pageBg};
      }
      .pdf-page:last-child {
        break-after: auto;
        page-break-after: auto;
      }
      .pdf-page > * {
        max-width: 100%;
      }

      /* ── Avoid breaking key blocks across pages ────────────────── */
      .avoid-break,
      .dm-card,
      .day-card,
      .property-card,
      .payment-card,
      .map-card,
      .gallery,
      .activity-table,
      .accommodation-block,
      [data-section-type="cover"] > *,
      [data-section-type="map"] > *,
      [data-section-type="pricing"] > div,
      [data-section-type="propertyShowcase"] .dm-card {
        break-inside: avoid-page;
        page-break-inside: avoid;
      }

      /* Headings never orphan. */
      h1, h2, h3 {
        break-after: avoid-page;
        page-break-after: avoid;
      }

      /* Images: crisp edges; never break across pages. */
      img {
        image-rendering: -webkit-optimize-contrast;
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
        break-inside: avoid;
        page-break-inside: avoid;
      }

      /* ── Strip editor + interactive chrome ─────────────────────── */
      [data-editor-chrome],
      .editor-toolbar,
      .editor-sidebar,
      .context-panel,
      .left-sidebar,
      .leaflet-control-zoom,
      .leaflet-control-attribution + *,
      button[title*="Drag"],
      button[title*="Delete"],
      button[title*="Duplicate"] {
        display: none !important;
      }
      /* Keep map attribution — Carto / OSM ToS require it visible. */
      .leaflet-control-attribution {
        display: block !important;
        font-size: 7px !important;
        opacity: 0.5;
      }

      /* ── Print refinements ────────────────────────────────────── */
      @media print {
        .ss-print-mode { width: auto; margin: 0; }
        body { font-size: 10.5pt; }
        a { color: inherit !important; text-decoration: none !important; }
        /* The on-screen document container loses its visible width
           in actual print — the page IS the canvas. */
        .pdf-document { width: auto; }
        .pdf-page { box-shadow: none !important; }
      }

      /* ── Debug mode (only when ?debugPdf=true) ─────────────────── */
      .pdf-document--debug .pdf-page {
        outline: 2px dashed rgba(220, 38, 38, 0.5);
        outline-offset: -2px;
      }
      .pdf-document--debug .pdf-page::before {
        content: attr(data-pdf-label);
        position: absolute;
        top: 8px;
        right: 8px;
        z-index: 9999;
        background: #1b3a2d;
        color: white;
        font-size: 10px;
        font-weight: 700;
        padding: 3px 8px;
        border-radius: 3px;
        font-family: system-ui, sans-serif;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        pointer-events: none;
      }
      .pdf-document--debug .pdf-page--overflow {
        outline-color: #dc2626;
        outline-width: 4px;
      }
      .pdf-document--debug .pdf-page--overflow::after {
        content: "⚠ OVERFLOW";
        position: absolute;
        bottom: 8px;
        right: 8px;
        z-index: 9999;
        background: #dc2626;
        color: white;
        font-size: 11px;
        font-weight: 700;
        padding: 4px 10px;
        border-radius: 3px;
        font-family: system-ui, sans-serif;
        letter-spacing: 0.06em;
        pointer-events: none;
      }
      /* Hide debug chrome in actual print regardless of the URL flag. */
      @media print {
        .pdf-document--debug .pdf-page { outline: none; }
        .pdf-document--debug .pdf-page::before,
        .pdf-document--debug .pdf-page--overflow::after { display: none; }
      }

      /* ── Screen-only: visually separate pages so the operator can
         scroll through them in the browser preview. Print drops this. */
      @media screen {
        body {
          background: #1a1a1a;
        }
        .pdf-document {
          padding: 24px 0;
        }
        .pdf-page {
          margin: 0 auto 24px;
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
        }
        .pdf-page:last-child { margin-bottom: 0; }
      }
    `}</style>
  );
}
