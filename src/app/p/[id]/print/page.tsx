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

  // PDF metadata title — set the document title from the proposal's
  // metadata so PDF readers (Preview, Acrobat) show a meaningful
  // window title / document property instead of a bare URL. Playwright
  // bakes the document.title at capture time into the PDF's "Title"
  // metadata field, so this is the cheapest possible upgrade to the
  // exported file's first impression.
  useEffect(() => {
    if (!loaded) return;
    const title =
      proposal.metadata?.title?.trim() ||
      proposal.trip?.title?.trim() ||
      "Safari proposal";
    const operator = proposal.operator?.companyName?.trim();
    document.title = operator ? `${title} — ${operator}` : title;
  }, [loaded, proposal]);

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

      // Leaflet tile-layer wait. Tile <img> elements share the same
      // load lifecycle the loop above caught, but tiles trickle in
      // *after* the map mounts (which can be after this point). We
      // poll briefly for any .leaflet-tile elements still marked
      // .leaflet-tile-loading and resolve when none remain or the
      // budget runs out. Belt-and-braces — without this, occasional
      // exports captured a half-rendered map with grey gaps.
      await waitForLeafletTiles(4000);
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
      // Page total injection — count rendered .pdf-page elements
      // after layout settle and stamp the total on .pdf-document as
      // a CSS custom property. The page-number pseudo-element below
      // reads it via var() so the footer reads "1 / 12" instead of
      // a bare "1". Done here (after compression + settle, before
      // __SS_READY__) so Playwright captures the final value.
      try {
        const pageCount = document.querySelectorAll(".pdf-page").length;
        const docEl = document.querySelector(".pdf-document") as HTMLElement | null;
        if (docEl && pageCount > 0) {
          docEl.style.setProperty(
            "--pdf-total-text",
            `"${pageCount}"`,
          );
        }
      } catch {
        /* fail silent — falls back to bare page numbers */
      }
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
         @page rule takes over and this column becomes the page itself.
         counter-reset on the document seeds the page-number counter
         that each .pdf-page increments — a CSS-only pagination that
         works cleanly through Playwright's rendering without sidecar
         changes. */
      .pdf-document {
        width: 210mm;
        margin: 0 auto;
        background: ${pageBg};
        counter-reset: pdf-page;
      }

      /* ── Strict A4 page ──────────────────────────────────────────
         Fixed dimensions, clipped overflow, hard page breaks. Every
         major section renders inside one of these.
         print-color-adjust: exact on the page itself (in addition to
         html/body) ensures section backgrounds and brand colours
         render exactly as designed instead of being "optimised" by
         the printer driver. */
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
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
        color-adjust: exact;
      }
      .pdf-page:last-child {
        break-after: auto;
        page-break-after: auto;
      }
      .pdf-page > * {
        max-width: 100%;
      }
      /* Page-number counter — seeded on .pdf-document, incremented
         on each .pdf-page. Renders bottom-right via the ::before
         pseudo-element below. */
      .pdf-page {
        counter-increment: pdf-page;
      }
      /* Bottom-of-page anchor — a hairline ~10mm from the foot of
         every page. Sections that fill the full page cover it; on
         pages where the section ends short, the hairline shows
         through and reads as "intentional whitespace" rather than
         "missing content". z-index 0 + pointer-events: none keeps
         it cosmetic. */
      .pdf-page::after {
        content: "";
        position: absolute;
        left: 18mm;
        right: 18mm;
        bottom: 10mm;
        height: 0.5pt;
        background: rgba(10, 20, 17, 0.10);
        z-index: 0;
        pointer-events: none;
      }
      /* Page number — bottom-right, sitting on the hairline. Tabular
         numerals + small caps tracking gives a premium-brochure feel
         instead of a generic browser footer. Hidden on full-bleed
         pages (cover, closing, footer) where the layout paints to
         the page edge and a number would land mid-image.
         Format: "1 / 12" via the page counter + an injected
         CSS custom property (--pdf-total-text). The fallback empty
         string means the footer reads as a bare "1" if the JS
         injection ran late or failed — still readable, never broken. */
      .pdf-page::before {
        content: counter(pdf-page) var(--pdf-total-separator, " / ") var(--pdf-total-text, "");
        position: absolute;
        right: 18mm;
        bottom: 7mm;
        z-index: 1;
        font-size: 8.5pt;
        font-feature-settings: "tnum";
        letter-spacing: 0.04em;
        color: rgba(10, 20, 17, 0.45);
        font-family: var(--font-body, system-ui, sans-serif);
        pointer-events: none;
      }
      /* When the total hasn't been injected yet (or no separator
         configured), suppress the separator so the footer reads "1"
         not "1 / ". Achieved by overriding the separator var to an
         empty string when the total is also empty — this rule fires
         until the JS pass replaces the total. */
      .pdf-document:not([style*="--pdf-total-text"]) .pdf-page::before {
        content: counter(pdf-page);
      }
      /* Suppress the anchor + page number on full-bleed pages — those
         paint to the page edge and the hairline / number would land
         mid-image. Cover, closing, and footer use the bleed class. */
      .pdf-page--bleed::after,
      .pdf-page--bleed::before {
        display: none;
      }

      /* ── Print-only section fills ──
         The on-screen sections were designed for a flowing webpage —
         they size to their content. In a fixed A4 frame that leaves
         huge bottom strips of pageBg for Cover, PersonalNote, and
         ItineraryTable when the user's content happens to be short.
         Force these sections to fill the entire PdfPage so the PDF
         doesn't end up with 30-50% of every page empty. */
      .pdf-page > [data-section-type="cover"],
      .pdf-page > [data-section-type="personalNote"],
      .pdf-page > [data-section-type="itineraryTable"],
      .pdf-page > [data-section-type="map"],
      .pdf-page > [data-section-type="closing"],
      .pdf-page > [data-section-type="pricing"] {
        min-height: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
      }
      .pdf-page > [data-section-type="cover"] > *,
      .pdf-page > [data-section-type="personalNote"] > *,
      .pdf-page > [data-section-type="itineraryTable"] > *,
      .pdf-page > [data-section-type="map"] > *,
      .pdf-page > [data-section-type="closing"] > *,
      .pdf-page > [data-section-type="pricing"] > * {
        flex: 1 1 auto;
        min-height: 100%;
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
      /* Strip all interactive booking / CTA chrome — these have no
         meaning on a printed PDF and operator screenshots showed
         "Secure This Safari", "Share", "Download", "Request Changes",
         "Visit Our Website" CTAs rendering in the closing/footer
         sections. Strengthened selector covers anchor tags styled
         as buttons (which Tailwind-based UIs frequently emit) plus
         the named CTA classes — the previous rule only caught
         <button> elements, missing the <a>-styled variants the
         operator actually had. */
      .pdf-page button:not([data-print-keep]),
      .pdf-page [role="button"]:not([data-print-keep]),
      .pdf-page a[role="button"]:not([data-print-keep]),
      .pdf-page a.btn:not([data-print-keep]),
      .pdf-page a[class*="ss-button"]:not([data-print-keep]),
      .pdf-page a[class*="ss-cta"]:not([data-print-keep]),
      .pdf-page a[href*="reserve"]:not([data-print-keep]),
      .pdf-page a[href*="deposit"]:not([data-print-keep]),
      .pdf-page a[href*="share"]:not([data-print-keep]),
      [data-print-hide],
      [data-cta-block],
      .ss-cta-block,
      .ss-share-bar,
      .ss-deposit-button,
      .ss-reserve-bar,
      .ss-secure-bar,
      .ss-action-bar,
      [data-section-type="footer"] button,
      [data-section-type="footer"] [role="button"],
      [data-section-type="footer"] a[role="button"],
      [data-section-type="closing"] button,
      [data-section-type="closing"] [role="button"],
      [data-section-type="closing"] a[role="button"] {
        display: none !important;
      }

      /* ── Force personalNote to stay side-by-side ─────────────────
         Tailwind's md: prefix is viewport-based, so a print view
         opened in a narrow window OR a sidecar with non-standard
         viewport falls back to single-column — leaving a giant
         image area on top of the letter. Inside .pdf-page we know
         we're at A4 width; force the grid columns explicitly so
         the layout can't collapse regardless of how the page is
         opened. */
      .pdf-page [data-section-type="personalNote"] [class*="grid-cols-1"][class*="md:grid-cols"] {
        grid-template-columns: 3fr 2fr !important;
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
        /* Crisp hairlines for print. A 1px screen border becomes a
           chunky, fuzzy line on paper — most printers can't honour
           sub-pixel widths and round up. 0.5pt (≈ 0.18mm) prints
           crisply and reads premium. Targets the common border
           classes Tailwind generates without painting over the
           per-section style overrides operators set explicitly. */
        .pdf-page [class*="border-"]:not([style*="border"]):not([style*="border:"]) {
          border-width: 0.5pt;
        }
      }

      /* ── Debug mode (only when ?debugPdf=true) ─────────────────── */
      .pdf-document--debug .pdf-page {
        outline: 2px dashed rgba(27, 58, 45, 0.4);
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
      /* Per-page usage readout — appears bottom-right of every page in
         debug mode. Shows used vs total px so the operator can see how
         much room each page has left. Shifts to a red OVER-by readout
         when the page overflows. */
      .pdf-document--debug .pdf-page::after {
        content: attr(data-pdf-usage);
        position: absolute;
        bottom: 8px;
        right: 8px;
        z-index: 9999;
        background: rgba(13, 38, 32, 0.85);
        color: rgba(255, 255, 255, 0.92);
        font-size: 10px;
        font-weight: 600;
        padding: 3px 8px;
        border-radius: 3px;
        font-family: ui-monospace, "SF Mono", Menlo, monospace;
        letter-spacing: 0;
        pointer-events: none;
      }
      .pdf-document--debug .pdf-page--overflow {
        outline-color: #dc2626;
        outline-width: 4px;
      }
      /* Underfilled (<65% used) — distinct yellow so it doesn't get
         confused with the gold continuation marker. Pure diagnostic;
         we want to encourage adding intentional filler content
         (image strip, route summary, quote, etc.) on these pages. */
      .pdf-document--debug .pdf-page--underfill {
        outline-color: #eab308;
        outline-style: dashed;
        outline-width: 4px;
      }
      .pdf-document--debug .pdf-page--underfill::after {
        background: #eab308;
        color: #1a1a1a;
      }
      /* Continuation page marker — small chip in the top-left so the
         operator can see at a glance which day pages were split into
         a tail. Read alongside the main label chip in the top-right. */
      .pdf-document--debug .pdf-page[data-continuation="true"]::before {
        content: attr(data-pdf-label);
      }
      .pdf-document--debug .pdf-page[data-continuation="true"] {
        outline-color: rgba(201, 168, 76, 0.85); /* gold */
        outline-style: solid;
      }
      .pdf-document--debug .pdf-page--overflow::after {
        background: #dc2626;
        color: white;
      }
      /* The deepest overflowing element gets a thick red outline +
         a label so the operator can immediately see WHICH child blew
         the page budget. */
      .pdf-document--debug .pdf-overflow-source {
        outline: 3px solid #dc2626 !important;
        outline-offset: 2px;
        position: relative;
      }
      .pdf-document--debug .pdf-overflow-source::before {
        content: "OVERFLOW SOURCE";
        position: absolute;
        top: -14px;
        left: 0;
        background: #dc2626;
        color: white;
        font-size: 9px;
        font-weight: 700;
        padding: 1px 6px;
        border-radius: 2px;
        font-family: system-ui, sans-serif;
        letter-spacing: 0.08em;
        z-index: 9998;
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

// Poll briefly for Leaflet tiles to finish loading. When react-leaflet
// mounts the <MapContainer />, tile images stream in over the next
// 100-1500ms depending on connection + cache. We wait until no tile
// is still in `.leaflet-tile-loading` state (Leaflet flips the class
// to `.leaflet-tile-loaded` after each tile decodes) or the budget
// runs out. Resolves silently — the PDF still exports if a tile fails;
// it just keeps any half-loaded grid from being captured.
async function waitForLeafletTiles(budgetMs: number): Promise<void> {
  const start = Date.now();
  // If no map mounted, skip immediately.
  if (!document.querySelector(".leaflet-container")) return;
  return new Promise<void>((resolve) => {
    const tick = () => {
      const stillLoading = document.querySelectorAll(".leaflet-tile-loading").length;
      const elapsed = Date.now() - start;
      if (stillLoading === 0) return resolve();
      if (elapsed >= budgetMs) return resolve();
      window.setTimeout(tick, 120);
    };
    // Give Leaflet ~80ms to start enqueuing tile requests before we
    // start polling — avoids a false-positive zero on first tick.
    window.setTimeout(tick, 80);
  });
}
