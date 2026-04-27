"use client";

import { useEffect } from "react";
import { useProposalStore } from "@/store/proposalStore";
import { SectionRenderer } from "@/components/editor/SectionRenderer";
import { DayCard } from "@/components/sections/day-card/DayCard";
import { PdfPage } from "./PdfPage";
import { PrintPropertyPage } from "./PrintPropertyPage";
import { PrintPracticalInfoPage, CARDS_PER_PAGE } from "./PrintPracticalInfoPage";
import { resolveTokens } from "@/lib/theme";
import type { Section, SectionType } from "@/lib/types";

// ─── PrintProposalDocument — orchestrator for the printed deck ───────────
//
// Reads the proposal's section list and renders each as a strict A4
// PdfPage. Two sections get special treatment because they're naturally
// multi-item:
//
//   dayJourney  — splits into one page per Day. Each day renders the
//                 same EditorialStackCard the on-screen proposal uses.
//   propertyShowcase — for now renders as a single page (the carousel
//                 layout). Future commit will split per property.
//
// Every other section gets wrapped in one PdfPage (clipped to A4).
//
// Debug mode (?debugPdf=true on the URL) draws per-page outlines and
// logs any page whose content overflows. Useful for finding sections
// that need design changes without exporting + opening the PDF.

const FULL_BLEED_TYPES = new Set<SectionType>(["cover", "closing", "footer"]);

export function PrintProposalDocument({ debug = false }: { debug?: boolean }) {
  const { proposal } = useProposalStore();
  const visible = [...proposal.sections]
    .filter((s) => s.visible)
    .sort((a, b) => a.order - b.order);

  // ── Overflow detection — runs after every render in debug mode.
  //    Stamps each .pdf-page with a "used / total" readout, flags
  //    overflowing pages with a heavier outline, and walks the page's
  //    descendants to find the deepest child whose bottom exceeds
  //    the page's bottom — that's the element causing the overflow.
  useEffect(() => {
    if (!debug) return;
    const id = window.setTimeout(() => {
      const pages = document.querySelectorAll<HTMLElement>(".pdf-page");
      const report: Array<{
        label: string;
        usedPx: number;
        totalPx: number;
        overflowPx: number;
        offender: string | null;
      }> = [];

      pages.forEach((page) => {
        const child = page.firstElementChild as HTMLElement | null;
        const usedPx = child?.scrollHeight ?? page.scrollHeight;
        const totalPx = page.clientHeight;
        const overflowPx = Math.max(0, usedPx - totalPx);

        // Clear prior debug state
        page.classList.remove("pdf-page--overflow");
        page.querySelectorAll<HTMLElement>(".pdf-overflow-source").forEach((el) => {
          el.classList.remove("pdf-overflow-source");
        });

        // Stamp the per-page used/total label.
        page.style.setProperty("--pdf-used", `${Math.round(usedPx)}`);
        page.style.setProperty("--pdf-total", `${Math.round(totalPx)}`);
        page.dataset.pdfUsage = overflowPx > 4
          ? `OVER by ${Math.round(overflowPx)}px (${Math.round(usedPx)} / ${Math.round(totalPx)})`
          : `${Math.round(usedPx)} / ${Math.round(totalPx)}px`;

        let offender: string | null = null;
        if (overflowPx > 4) {
          page.classList.add("pdf-page--overflow");
          // Find the deepest descendant whose bottom (relative to the
          // page's content top) exceeds the page's bottom. The first
          // descendant that fails is the highest-impact element to
          // flag — text + lists below it would cascade.
          offender = highlightOverflowSource(page);
        }

        report.push({
          label: page.dataset.pdfLabel || "(unlabelled)",
          usedPx: Math.round(usedPx),
          totalPx: Math.round(totalPx),
          overflowPx: Math.round(overflowPx),
          offender,
        });
      });

      const overflows = report.filter((r) => r.overflowPx > 0);
      if (overflows.length > 0) {
        console.warn(
          `[pdf] ${overflows.length} of ${report.length} pages overflow A4 — they will clip in the PDF:`,
        );
        console.table(overflows);
      } else {
        console.info(`[pdf] all ${report.length} pages fit cleanly`);
        // Also log how much room each page has left so the operator
        // can see where they could add content vs trim.
        const tightest = [...report]
          .sort((a, b) => (a.totalPx - a.usedPx) - (b.totalPx - b.usedPx))
          .slice(0, 5)
          .map((r) => ({
            label: r.label,
            remainingPx: r.totalPx - r.usedPx,
          }));
        console.info("[pdf] tightest pages (least remaining vertical space):", tightest);
      }
    }, 250);
    return () => window.clearTimeout(id);
  }, [debug, visible.length, proposal.id]);

  return (
    <div className={`pdf-document ${debug ? "pdf-document--debug" : ""}`}>
      {visible.map((section) => renderSection(section, proposal.id))}
    </div>
  );
}

function renderSection(section: Section, proposalId: string) {
  const bleed = FULL_BLEED_TYPES.has(section.type);

  // dayJourney — one PdfPage per day.
  if (section.type === "dayJourney") {
    return <DayJourneyPages key={section.id} section={section} />;
  }

  // propertyShowcase — one PdfPage per property using a print-specific
  // single-property layout. Replaces the carousel which left half a
  // page empty when there were < 4 properties.
  if (section.type === "propertyShowcase") {
    return <PropertyPages key={section.id} section={section} />;
  }

  // practicalInfo — chunk into pages of CARDS_PER_PAGE so a long list
  // splits cleanly instead of overflowing a single page. Second+ pages
  // get a "— Continued" subtitle.
  if (section.type === "practicalInfo") {
    return <PracticalInfoPages key={section.id} />;
  }

  // Every other section — single page, clipped to A4.
  return (
    <PdfPage
      key={section.id}
      label={labelFor(section)}
      bleed={bleed}
    >
      <div data-section-type={section.type} data-proposal-id={proposalId}>
        <SectionRenderer section={section} />
      </div>
    </PdfPage>
  );
}

function PropertyPages({ section }: { section: Section }) {
  const proposal = useProposalStore((s) => s.proposal);
  const properties = proposal.properties ?? [];
  if (properties.length === 0) {
    return (
      <PdfPage label="Properties (empty)" bleed>
        <div data-section-type="propertyShowcase">
          <SectionRenderer section={section} />
        </div>
      </PdfPage>
    );
  }
  const tokens = resolveTokens(proposal.theme.tokens, section.styleOverrides);
  return (
    <>
      {properties.map((property) => (
        <PdfPage
          key={property.id}
          label={`Property — ${property.name}`}
          bleed
        >
          <div data-section-type="propertyShowcase" data-property-id={property.id}>
            <PrintPropertyPage
              property={property}
              theme={proposal.theme}
              tokens={tokens}
            />
          </div>
        </PdfPage>
      ))}
    </>
  );
}

function PracticalInfoPages() {
  const proposal = useProposalStore((s) => s.proposal);
  const cards = proposal.practicalInfo ?? [];
  if (cards.length === 0) return null;

  const chunks: typeof cards[] = [];
  for (let i = 0; i < cards.length; i += CARDS_PER_PAGE) {
    chunks.push(cards.slice(i, i + CARDS_PER_PAGE));
  }
  // Use the practicalInfo section's overrides if it exists, otherwise
  // theme defaults.
  const section = proposal.sections.find((s) => s.type === "practicalInfo");
  const tokens = resolveTokens(proposal.theme.tokens, section?.styleOverrides);

  return (
    <>
      {chunks.map((chunk, idx) => {
        const partLabel =
          chunks.length > 1 && idx > 0
            ? chunks.length === 2
              ? "— Continued"
              : `— Part ${idx + 1} of ${chunks.length}`
            : undefined;
        return (
          <PdfPage
            key={`pi-${idx}`}
            label={`Good to know${partLabel ? " " + partLabel.replace("— ", "") : ""}`}
            bleed
          >
            <div data-section-type="practicalInfo">
              <PrintPracticalInfoPage
                cards={chunk}
                theme={proposal.theme}
                tokens={tokens}
                partLabel={partLabel}
              />
            </div>
          </PdfPage>
        );
      })}
    </>
  );
}

function DayJourneyPages({ section }: { section: Section }) {
  const days = useProposalStore((s) => s.proposal.days);
  if (days.length === 0) {
    return (
      <PdfPage label="Day-by-day (empty)" bleed={false}>
        <div data-section-type="dayJourney">
          <SectionRenderer section={section} />
        </div>
      </PdfPage>
    );
  }
  // One page per day. DayCard already renders the editorial stack the
  // on-screen view uses, so the PDF layout matches the share view —
  // just framed inside an A4 container instead of flowing on a webpage.
  return (
    <>
      {days.map((day, i) => (
        <PdfPage
          key={day.id}
          label={`Day ${day.dayNumber}${day.destination ? " · " + day.destination : ""}`}
          bleed
        >
          <div data-section-type="dayJourney" data-day-number={day.dayNumber}>
            <DayCard day={day} index={i} totalDays={days.length} section={section} />
          </div>
        </PdfPage>
      ))}
    </>
  );
}

function labelFor(section: Section): string {
  const map: Record<SectionType, string> = {
    operatorHeader: "Header",
    cover: "Cover",
    personalNote: "Personal note",
    greeting: "Greeting",
    tripSummary: "Trip summary",
    itineraryTable: "Itinerary at a glance",
    map: "Map",
    dayJourney: "Day-by-day",
    propertyShowcase: "Properties",
    pricing: "Investment",
    inclusions: "Inclusions",
    practicalInfo: "Good to know",
    closing: "Closing",
    footer: "Contact",
    customText: "Custom",
    quote: "Quote",
    gallery: "Gallery",
    divider: "Divider",
    spacer: "Spacer",
  };
  return map[section.type] ?? section.type;
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
