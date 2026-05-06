"use client";

import { useEffect, useMemo } from "react";
import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import { SectionChrome } from "@/components/editor/SectionChrome";
import { composePdfPages, type PdfPage } from "@/lib/composePdfPages";
import { PdfPageRenderer } from "./PdfPageRenderer";
import type { Section } from "@/lib/types";

// ─── PrintProposalDocument — orchestrator for the printed deck ───────────
//
// Calls composePdfPages() to turn the proposal's section list into a
// list of A4-page descriptors (cover+note merge, map+summary merge,
// closing+footer merge, day/property fan-out, etc.) and dispatches
// each descriptor through PdfPageRenderer. Section-level edit chrome
// (variant switcher, color picker, drag handle) wraps consecutive
// pages that derive from the same source section, so multi-page groups
// like Day-by-Day or Properties keep one chrome envelope around all
// their pages.
//
// Debug mode (?debugPdf=true on the URL) draws per-page outlines and
// logs any page whose content overflows. Useful for finding sections
// that need design changes without exporting + opening the PDF.

export function PrintProposalDocument({ debug = false }: { debug?: boolean }) {
  const { proposal } = useProposalStore();

  const pages: PdfPage[] = useMemo(
    () => composePdfPages(proposal),
    [proposal],
  );
  const groups = useMemo(() => groupPagesBySource(pages), [pages]);

  // ── Overflow detection — runs after every render in debug mode.
  //    Stamps each .pdf-page with a "used / total" readout, flags
  //    overflowing pages with a heavier outline, and walks the page's
  //    descendants to find the deepest child whose bottom exceeds
  //    the page's bottom — that's the element causing the overflow.
  useEffect(() => {
    if (!debug) return;
    const id = window.setTimeout(() => {
      const pageEls = document.querySelectorAll<HTMLElement>(".pdf-page");
      const report: Array<{
        label: string;
        usedPx: number;
        totalPx: number;
        overflowPx: number;
        underfillPct: number;
        offender: string | null;
        continuation: boolean;
        status: "OK" | "OVERFLOW" | "UNDERFILLED";
      }> = [];

      // Pages that use less than this fraction of A4 height get
      // flagged as UNDERFILLED — feels accidentally empty rather than
      // an intentional luxury whitespace.
      const UNDERFILL_THRESHOLD = 0.65;

      pageEls.forEach((page) => {
        const child = page.firstElementChild as HTMLElement | null;
        const usedPx = child?.scrollHeight ?? page.scrollHeight;
        const totalPx = page.clientHeight;
        const overflowPx = Math.max(0, usedPx - totalPx);

        // Clear prior debug state
        page.classList.remove("pdf-page--overflow");
        page.querySelectorAll<HTMLElement>(".pdf-overflow-source").forEach((el) => {
          el.classList.remove("pdf-overflow-source");
        });

        // Underfill — only meaningful when there's no overflow.
        const fillRatio = totalPx > 0 ? usedPx / totalPx : 0;
        const isUnderfilled = overflowPx <= 4 && fillRatio < UNDERFILL_THRESHOLD;
        page.classList.remove("pdf-page--underfill");

        // Stamp the per-page used/total label. OVERFLOW > UNDERFILLED > OK.
        page.style.setProperty("--pdf-used", `${Math.round(usedPx)}`);
        page.style.setProperty("--pdf-total", `${Math.round(totalPx)}`);
        if (overflowPx > 4) {
          page.dataset.pdfUsage = `OVER by ${Math.round(overflowPx)}px (${Math.round(usedPx)} / ${Math.round(totalPx)})`;
        } else if (isUnderfilled) {
          page.dataset.pdfUsage = `UNDERFILLED ${Math.round(fillRatio * 100)}% (${Math.round(usedPx)} / ${Math.round(totalPx)})`;
        } else {
          page.dataset.pdfUsage = `${Math.round(usedPx)} / ${Math.round(totalPx)}px`;
        }

        let offender: string | null = null;
        if (overflowPx > 4) {
          page.classList.add("pdf-page--overflow");
          offender = highlightOverflowSource(page);
        } else if (isUnderfilled) {
          page.classList.add("pdf-page--underfill");
        }

        const status: "OK" | "OVERFLOW" | "UNDERFILLED" =
          overflowPx > 4 ? "OVERFLOW" : isUnderfilled ? "UNDERFILLED" : "OK";

        report.push({
          label: page.dataset.pdfLabel || "(unlabelled)",
          usedPx: Math.round(usedPx),
          totalPx: Math.round(totalPx),
          overflowPx: Math.round(overflowPx),
          underfillPct: Math.round(fillRatio * 100),
          offender,
          continuation: page.dataset.continuation === "true",
          status,
        });
      });

      const continuations = report.filter((r) => r.continuation);
      if (continuations.length > 0) {
        console.info(
          `[pdf] ${continuations.length} continuation page${continuations.length === 1 ? "" : "s"} created (auto-split):`,
          continuations.map((c) => c.label),
        );
      }

      const overflows = report.filter((r) => r.status === "OVERFLOW");
      const underfilled = report.filter((r) => r.status === "UNDERFILLED");

      // Single console.table covering every page so it's easy to spot
      // OVERFLOW (red, content clipped) vs UNDERFILLED (designed
      // intentionally? maybe accidentally empty) vs OK at a glance.
      console.info(`[pdf] ${report.length} pages — ${overflows.length} overflow, ${underfilled.length} underfilled`);
      console.table(report);

      if (overflows.length > 0) {
        console.warn(
          `[pdf] ${overflows.length} OVERFLOW page${overflows.length === 1 ? "" : "s"} will clip:`,
          overflows.map((r) => r.label),
        );
      }
      if (underfilled.length > 0) {
        console.warn(
          `[pdf] ${underfilled.length} UNDERFILLED page${underfilled.length === 1 ? "" : "s"} (<65% used) — consider intentional fillers:`,
          underfilled.map((r) => `${r.label} (${r.underfillPct}%)`),
        );
      }
    }, 250);
    return () => window.clearTimeout(id);
  }, [debug, pages.length, proposal.id]);

  return (
    <div className={`pdf-document ${debug ? "pdf-document--debug" : ""}`}>
      {groups.map((group, gi) => (
        <ChromedSection key={`g-${gi}-${group.sourceSection?.id ?? "anon"}`} section={group.sourceSection}>
          {group.pages.map((page, pi) => (
            <PdfPageRenderer key={`p-${gi}-${pi}`} page={page} />
          ))}
        </ChromedSection>
      ))}
    </div>
  );
}

// Wraps each PdfFit page (or page group) in SectionChrome ONLY in
// editor mode so the operator gets the same hover-detected colour
// pickers, drag handle, variant switcher, visibility toggle, and
// per-section style picker they have on the Web View. In print + share
// modes, no chrome is added so the rendered pages stay pixel-clean.
//
// section is null for composed pages with no source section (rare —
// only the lone-footer-as-closing case via the synthetic section, and
// the dispatcher already handles that). When null, we skip chrome.
function ChromedSection({
  section,
  children,
}: {
  section: Section | null;
  children: React.ReactNode;
}) {
  const mode = useEditorStore((s) => s.mode);
  if (children == null) return null;
  if (mode !== "editor" || section == null) {
    return <>{children}</>;
  }
  return <SectionChrome section={section}>{children}</SectionChrome>;
}

// Anchor section a composed page binds to for editor chrome / DOM
// attribution. Returns null when the page has no representative
// source section (e.g., synthesized lone-footer closing).
function anchorSection(page: PdfPage): Section | null {
  switch (page.kind) {
    case "coverNote":
      return page.cover ?? page.note ?? null;
    case "mapSummary":
      return page.map ?? page.summary ?? null;
    case "day":
    case "property":
      return page.sourceSection;
    case "pricing":
    case "practicalInfo":
    case "passthrough":
      return page.section;
    case "closing":
      return page.closing ?? page.footer ?? null;
  }
}

// Fold consecutive pages that share an anchor section into one group
// so the operator's per-section chrome (variant switcher, color
// picker, etc.) wraps the entire run. Day-by-day's N day pages and
// Properties' M property pages each become one chromed group.
function groupPagesBySource(
  pages: PdfPage[],
): Array<{ sourceSection: Section | null; pages: PdfPage[] }> {
  const groups: Array<{ sourceSection: Section | null; pages: PdfPage[] }> = [];
  for (const page of pages) {
    const source = anchorSection(page);
    const last = groups[groups.length - 1];
    if (last && last.sourceSection?.id === source?.id) {
      last.pages.push(page);
    } else {
      groups.push({ sourceSection: source, pages: [page] });
    }
  }
  return groups;
}

// Walk the page's descendants and find the FIRST element whose
// bottom edge exceeds the page's bottom — that's the offender that
// caused the overflow. Returns a short tag-summary string for the
// console report (e.g. "div.dm-card · 'Day 3 · Serengeti'") and
// outlines the element with the .pdf-overflow-source class so the
// debug overlay highlights it visually.
function highlightOverflowSource(page: HTMLElement): string | null {
  const pageRect = page.getBoundingClientRect();
  const pageBottom = pageRect.bottom;
  // Walk all elements depth-first; we want the SHALLOWEST node
  // whose bottom exceeds pageBottom (the deepest would just be a
  // single character, which isn't actionable).
  const all = page.querySelectorAll<HTMLElement>("*");
  for (const el of all) {
    if (el.classList.contains("pdf-page")) continue;
    const r = el.getBoundingClientRect();
    if (r.height < 4 || r.width < 4) continue;
    if (r.bottom > pageBottom + 4) {
      el.classList.add("pdf-overflow-source");
      const tag = el.tagName.toLowerCase();
      const cls = el.className && typeof el.className === "string"
        ? "." + el.className.split(/\s+/).filter(Boolean).slice(0, 2).join(".")
        : "";
      const text = (el.textContent || "").trim().slice(0, 40);
      return `${tag}${cls}${text ? ` · "${text}${text.length === 40 ? "…" : ""}"` : ""}`;
    }
  }
  return null;
}
