"use client";

import { useEffect } from "react";
import { useProposalStore } from "@/store/proposalStore";
import { SectionRenderer } from "@/components/editor/SectionRenderer";
import { DayCard } from "@/components/sections/day-card/DayCard";
import { PdfPage } from "./PdfPage";
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
  //    Logs any pdf-page whose scrollHeight exceeds clientHeight.
  //    Threshold of 4px tolerates sub-pixel differences from font
  //    metric quirks without spamming the console for non-issues.
  useEffect(() => {
    if (!debug) return;
    const id = window.setTimeout(() => {
      const pages = document.querySelectorAll<HTMLElement>(".pdf-page");
      const overflows: { label: string; over: number }[] = [];
      pages.forEach((p) => {
        // We measure the deepest scrollable child since the page
        // itself has overflow:hidden. Fall back to the page's own
        // scrollHeight if no child overflows.
        const child = p.firstElementChild as HTMLElement | null;
        const measured = child?.scrollHeight ?? p.scrollHeight;
        const limit = p.clientHeight;
        const diff = measured - limit;
        if (diff > 4) {
          overflows.push({
            label: p.dataset.pdfLabel || "(unlabelled)",
            over: diff,
          });
          p.classList.add("pdf-page--overflow");
        } else {
          p.classList.remove("pdf-page--overflow");
        }
      });
      if (overflows.length > 0) {
        console.warn(
          "[pdf] page overflow detected — these pages will clip in the PDF:",
          overflows,
        );
      } else {
        console.info("[pdf] all pages fit cleanly");
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

  // dayJourney — split into one PdfPage per day so each day reads as a
  // designed full-page spread instead of a vertical scroll printed onto
  // multiple uncontrolled pages.
  if (section.type === "dayJourney") {
    return <DayJourneyPages key={section.id} section={section} />;
  }

  // Every other section — single page, clipped to A4.
  return (
    <PdfPage
      key={section.id}
      label={labelFor(section)}
      bleed={bleed}
      data-section-type={section.type}
    >
      <div data-section-type={section.type} data-proposal-id={proposalId}>
        <SectionRenderer section={section} />
      </div>
    </PdfPage>
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
