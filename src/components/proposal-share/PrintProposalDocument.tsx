"use client";

import { useEffect } from "react";
import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import { SectionRenderer } from "@/components/editor/SectionRenderer";
import { SectionChrome } from "@/components/editor/SectionChrome";
import { PdfPage } from "./PdfPage";
import { PdfFitCoverPage } from "./PdfFit/PdfFitCoverPage";
import { PdfFitDayPage } from "./PdfFit/PdfFitDayPage";
import { PdfFitPropertyPage } from "./PdfFit/PdfFitPropertyPage";
import { PdfFitPersonalNotePage } from "./PdfFit/PdfFitPersonalNotePage";
import { PdfFitPricingPage } from "./PdfFit/PdfFitPricingPage";
import { PdfFitPracticalInfoPages } from "./PdfFit/PdfFitPracticalInfoPage";
import { PdfFitTripSummaryPage } from "./PdfFit/PdfFitTripSummaryPage";
import { PdfFitClosingPage } from "./PdfFit/PdfFitClosingPage";
import { PdfFitFooterPage } from "./PdfFit/PdfFitFooterPage";
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

// Return true when the section is one of the content-only types AND
// its body is empty enough that printing it on its own A4 page would
// produce a near-empty page. Each section type's "content" lives at
// a different content-key — operator's editor writes those keys, so
// we whitelist the keys we know carry the meaningful body. Other
// section types (cover, dayJourney, propertyShowcase, etc.) are
// excluded from the check because they have rich computed content
// from elsewhere on the proposal.
function isContentlessSection(section: Section): boolean {
  if (section.type === "customText" || section.type === "quote") {
    const content = section.content as Record<string, unknown> | undefined;
    const body = strField(content?.body) ?? strField(content?.text) ?? strField(content?.quote);
    return !body || body.length === 0;
  }
  if (section.type === "gallery") {
    const content = section.content as Record<string, unknown> | undefined;
    const images = Array.isArray(content?.images) ? content.images : [];
    return images.length === 0;
  }
  if (section.type === "inclusions") {
    const content = section.content as Record<string, unknown> | undefined;
    const items = Array.isArray(content?.items) ? content.items : [];
    return items.length === 0;
  }
  return false;
}

function strField(v: unknown): string | null {
  if (typeof v !== "string") return null;
  // Strip HTML and whitespace before length-checking — operators
  // sometimes paste an empty <p></p> from a rich editor that looks
  // empty visually but isn't a zero-length string.
  const stripped = v.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
  return stripped.length > 0 ? stripped : null;
}

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
      {visible.map((section) => (
        <ChromedSection key={section.id} section={section}>
          {renderSection(section, proposal.id, proposal.sections)}
        </ChromedSection>
      ))}
    </div>
  );
}

// Wraps each PdfFit page in SectionChrome ONLY in editor mode so the
// operator gets the same hover-detected colour pickers, drag handle,
// variant switcher, visibility toggle, and per-section style picker
// they have on the Magazine view. In print + share modes, no chrome
// is added so the rendered pages stay pixel-clean.
function ChromedSection({
  section,
  children,
}: {
  section: Section;
  children: React.ReactNode;
}) {
  const mode = useEditorStore((s) => s.mode);
  if (children == null) return null;
  if (mode !== "editor") {
    return <>{children}</>;
  }
  return <SectionChrome section={section}>{children}</SectionChrome>;
}

function renderSection(section: Section, proposalId: string, proposalSections: Section[]) {
  const bleed = FULL_BLEED_TYPES.has(section.type);

  // Divider + spacer sections are visual rhythm controls on the
  // flowing on-screen layout — a thin line, a vertical gap. In the
  // strict A4 print deck they each consumed an entire page that
  // rendered as ~98% empty (just the section's bg + the divider's
  // hairline strip). Skipped here so the printed deck stays
  // continuous; the on-screen view still renders them via the
  // normal SectionRenderer path. Operator brief: "no blank pages."
  if (section.type === "divider" || section.type === "spacer") {
    return null;
  }

  // Empty content sections — operator added a customText / quote /
  // gallery / inclusions block but never filled the body. In the
  // strict A4 deck these render as a section header strip on top
  // of an otherwise empty page. Skip them so the printed deck
  // stays content-dense; on-screen they still render as the
  // operator's reminder to come back and fill them.
  if (isContentlessSection(section)) {
    return null;
  }

  // PDF-Fit layouts — reverse-engineered print system, always on.
  // Slot positions are locked in mm, content is capped per slot, and
  // the manifest decides what fits on each A4 page. No legacy "render
  // the web layout into A4" path — we design for paper first.
  if (section.type === "cover") {
    return <PdfFitCoverPage key={section.id} section={section} />;
  }
  if (section.type === "dayJourney") {
    return <PdfFitDayJourneyPages key={section.id} section={section} />;
  }
  if (section.type === "propertyShowcase") {
    return <PdfFitPropertyShowcasePages key={section.id} section={section} />;
  }
  if (section.type === "personalNote") {
    // Personal note is folded into the cover (cover-letter-spread)
    // when both sections exist — saves a sparse second page. The
    // cover consumer pulls the letter body, signature, and advisor
    // contact info from the personalNote section.
    const hasCover = proposalSections.some((s) => s.type === "cover" && s.visible);
    if (hasCover) return null;
    return <PdfFitPersonalNotePage key={section.id} section={section} />;
  }
  if (section.type === "pricing") {
    return <PdfFitPricingPage key={section.id} section={section} />;
  }
  if (section.type === "practicalInfo") {
    return <PdfFitPracticalInfoPages key={section.id} section={section} />;
  }
  if (section.type === "tripSummary" || section.type === "map") {
    return <PdfFitTripSummaryPage key={section.id} section={section} />;
  }
  if (section.type === "closing") {
    return <PdfFitClosingPage key={section.id} section={section} />;
  }
  if (section.type === "footer") {
    return <PdfFitFooterPage key={section.id} section={section} />;
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


// ─── PDF-Fit multi-page wrappers ──────────────────────────────────────────
//
// PDF-Fit pages are single-shot per day / per property — no tail
// continuation needed because the manifest has fixed slots that cap
// content within the A4 frame. If content exceeds caps we truncate
// (per the operator's spec rules); we never spill into a second page.

// Rotation order for day-card layouts when the operator hasn't set
// one explicitly. Drives the "never the same layout twice in a row"
// rhythm rule in the design brief — Day 1 narrative, Day 2 image-led,
// Day 3 balanced (standard), Day 4 narrative, … so consecutive days
// always feel different. The operator's per-day override always wins.
const DAY_VARIANT_ROTATION = [
  "day-card-narrative",
  "day-card-image-led",
  "day-card-standard",
] as const;

function PdfFitDayJourneyPages({ section }: { section: Section }) {
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
  return (
    <>
      {days.map((day, idx) => {
        // Pick a rotated default unless the day already has its own
        // layoutVariant set; PdfFitDayPage honours `day.layoutVariant`
        // first, so we synthesise one when absent.
        const synthetic = day.layoutVariant
          ? day
          : {
              ...day,
              layoutVariant: DAY_VARIANT_ROTATION[idx % DAY_VARIANT_ROTATION.length],
            };
        return (
          <PdfFitDayPage
            key={day.id}
            section={section}
            day={synthetic}
            totalDays={days.length}
          />
        );
      })}
    </>
  );
}

// Rotation order for property layouts when none is operator-set.
// Drives the "never the same layout twice in a row" rhythm rule —
// gallery → editorial → feature → gallery → … so a 6-property
// showcase reads as a magazine, not a catalogue.
const PROPERTY_VARIANT_ROTATION = [
  "property-card-standard",  // gallery (hero + thumbs)
  "property-card-editorial", // text-left, photo-right
  "property-card-feature",   // dominant photograph + caption
] as const;

function PdfFitPropertyShowcasePages({ section }: { section: Section }) {
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
  return (
    <>
      {properties.map((property, idx) => {
        const synthetic = property.layoutVariant
          ? property
          : {
              ...property,
              layoutVariant:
                PROPERTY_VARIANT_ROTATION[idx % PROPERTY_VARIANT_ROTATION.length],
            };
        return (
          <PdfFitPropertyPage
            key={property.id}
            section={section}
            property={synthetic}
            index={idx}
            total={properties.length}
          />
        );
      })}
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
