"use client";

import { useEffect, type ReactNode } from "react";
import { useProposalStore } from "@/store/proposalStore";
import { SectionRenderer } from "@/components/editor/SectionRenderer";
import { PdfPage } from "./PdfPage";
import { PrintPropertyPage } from "./PrintPropertyPage";
import { PrintPracticalInfoPage, CARDS_PER_PAGE } from "./PrintPracticalInfoPage";
import {
  PrintDayPageMain,
  PrintDayPageTail,
  dayHasTailContent,
  resolveDayProperty,
} from "./PrintDayPage";
import { resolveTokens } from "@/lib/theme";
import { resolveDayCard } from "@/components/sections/day-card/resolve";
import type { Section, SectionType, TierKey } from "@/lib/types";

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
        underfillPct: number;
        offender: string | null;
        continuation: boolean;
        status: "OK" | "OVERFLOW" | "UNDERFILLED";
      }> = [];

      // Pages that use less than this fraction of A4 height get
      // flagged as UNDERFILLED — feels accidentally empty rather than
      // an intentional luxury whitespace.
      const UNDERFILL_THRESHOLD = 0.65;

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
  const total = properties.length;
  return (
    <>
      {properties.map((property, idx) => (
        <PdfPage
          key={property.id}
          label={`Property ${idx + 1} of ${total} · ${property.name}`}
          bleed
        >
          <div data-section-type="propertyShowcase" data-property-id={property.id}>
            <PrintPropertyPage
              property={property}
              theme={proposal.theme}
              tokens={tokens}
              indexLabel={`Property ${idx + 1} of ${total}`}
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
  const proposal = useProposalStore((s) => s.proposal);
  const days = proposal.days;
  if (days.length === 0) {
    return (
      <PdfPage label="Day-by-day (empty)" bleed={false}>
        <div data-section-type="dayJourney">
          <SectionRenderer section={section} />
        </div>
      </PdfPage>
    );
  }
  // Each day renders into a print-specific main page (story half) and
  // — when the day actually has activities or accommodation — a
  // dedicated continuation page. This pre-empts the overflow problem:
  // we do not let a day try to fit hero + narrative + activities +
  // accommodation gallery in a single A4 frame. Instead we split
  // intentionally and label both halves so a guest reading the PDF
  // immediately sees "Day 3 · Continued" rather than a clipped page.
  const tokens = resolveTokens(proposal.theme.tokens, section.styleOverrides);
  const activeTier = proposal.activeTier as TierKey;
  return (
    <>
      {days.map((day) => {
        // Resolve the day's stay so the tail page can render the
        // accommodation block; also drives the has-tail decision.
        const property = resolveDayProperty(day, proposal.properties, activeTier);
        const hasTail = dayHasTailContent(day, property);
        // Reuse the day-card data resolver just for date formatting —
        // it owns the UTC-safe arrival-date math so we stay consistent
        // with the on-screen view.
        const dayData = resolveDayCard(day, proposal, activeTier, "editorial-stack");
        return (
          <Fragmented key={day.id}>
            <PdfPage
              label={`Day ${day.dayNumber}${day.destination ? " · " + day.destination : ""}`}
              bleed
            >
              <div
                data-section-type="dayJourney"
                data-day-number={day.dayNumber}
                data-day-page="main"
                data-has-continuation={hasTail ? "yes" : "no"}
              >
                <PrintDayPageMain
                  day={day}
                  dayDate={dayData.dayDate}
                  theme={proposal.theme}
                  tokens={tokens}
                  totalDays={days.length}
                  property={property}
                  hasTail={hasTail}
                />
              </div>
            </PdfPage>
            {hasTail && (
              <PdfPage
                label={`Day ${day.dayNumber} · Continued${day.destination ? " · " + day.destination : ""}`}
                bleed
                continuation
              >
                <div
                  data-section-type="dayJourney"
                  data-day-number={day.dayNumber}
                  data-day-page="tail"
                  data-continuation="true"
                >
                  <PrintDayPageTail
                    day={day}
                    property={property}
                    theme={proposal.theme}
                    tokens={tokens}
                    totalDays={days.length}
                  />
                </div>
              </PdfPage>
            )}
          </Fragmented>
        );
      })}
    </>
  );
}

// Tiny key-stable fragment wrapper. React's Fragment doesn't accept a
// data-attribute; using a plain Fragment with a key is enough for the
// outer .map(). Wrapping in a function gives us a single source of
// truth for the day-pair structure if we later need to attach extra
// metadata (e.g. break-before hints).
function Fragmented({ children }: { children: ReactNode }) {
  return <>{children}</>;
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
