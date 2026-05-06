"use client";

import type { PdfPage } from "@/lib/composePdfPages";
import type { Section, SectionType } from "@/lib/types";
import { SectionRenderer } from "@/components/editor/SectionRenderer";
import { PdfPage as PdfPageWrapper } from "./PdfPage";
import { PdfFitCoverPage } from "./PdfFit/PdfFitCoverPage";
import { PdfFitCoverWithNotePage } from "./PdfFit/PdfFitCoverWithNotePage";
import { PdfFitPersonalNotePage } from "./PdfFit/PdfFitPersonalNotePage";
import { PdfFitTripSummaryPage } from "./PdfFit/PdfFitTripSummaryPage";
import { PdfFitDayPage } from "./PdfFit/PdfFitDayPage";
import { PdfFitPropertyPage } from "./PdfFit/PdfFitPropertyPage";
import { PdfFitPricingPage } from "./PdfFit/PdfFitPricingPage";
import { PdfFitPracticalInfoPages } from "./PdfFit/PdfFitPracticalInfoPage";
import { PdfFitClosingPage } from "./PdfFit/PdfFitClosingPage";

// ─── PdfPageRenderer — dispatches a composed PdfPage to its renderer ─────
//
// Pure switch over the PdfPage union from composePdfPages. Each case
// hands the composed descriptor to an existing PdfFit*Page component.
// No layout logic lives here — this is the seam between the composer
// (what goes on each page) and the page components (how it looks).

const FULL_BLEED_TYPES = new Set<SectionType>(["cover", "closing", "footer"]);

export function PdfPageRenderer({ page }: { page: PdfPage }) {
  switch (page.kind) {
    case "coverNote": {
      if (page.cover && page.note) {
        return (
          <PdfFitCoverWithNotePage
            coverSection={page.cover}
            noteSection={page.note}
          />
        );
      }
      if (page.cover) {
        return <PdfFitCoverPage section={page.cover} />;
      }
      if (page.note) {
        return <PdfFitPersonalNotePage section={page.note} />;
      }
      return null;
    }

    case "mapSummary": {
      // PdfFitTripSummaryPage already renders the merged map + stats
      // page. The anchor section provides theme styleOverrides; the
      // page pulls everything else from proposal-level data.
      const anchor = page.map ?? page.summary;
      if (!anchor) return null;
      return <PdfFitTripSummaryPage section={anchor} />;
    }

    case "day":
      return (
        <PdfFitDayPage
          section={page.sourceSection}
          day={page.day}
          totalDays={page.totalDays}
        />
      );

    case "property":
      return (
        <PdfFitPropertyPage
          section={page.sourceSection}
          property={page.property}
          index={page.index}
          total={page.total}
        />
      );

    case "pricing":
      return <PdfFitPricingPage section={page.section} />;

    case "practicalInfo":
      return <PdfFitPracticalInfoPages section={page.section} />;

    case "closing": {
      // Closing present (with or without absorbed footer) → render the
      // closing page directly. PdfFitClosingPage already pulls
      // operator contact rows from operator profile, so an adjacent
      // footer is implicitly represented; we don't duplicate its data.
      if (page.closing) {
        return <PdfFitClosingPage section={page.closing} />;
      }
      // Lone footer → synthesize a minimal closing section from the
      // footer's content so the closing page renders without the deck
      // ending on a thin contact-only A4. Tagline becomes the headline,
      // closingLine becomes the body. Operator contact rows still come
      // from operator profile via PdfFitClosingPage.
      if (page.footer) {
        const synthetic: Section = {
          ...page.footer,
          type: "closing",
          layoutVariant: "closing-minimal",
          content: {
            ...page.footer.content,
            headline: page.footer.content?.tagline ?? "",
            letter: page.footer.content?.closingLine ?? "",
          },
        };
        return <PdfFitClosingPage section={synthetic} />;
      }
      return null;
    }

    case "passthrough": {
      // Sections without a dedicated PdfFit page (customText, quote,
      // gallery, operatorHeader, greeting, lone itineraryTable, lone
      // tripSummary). Wrap in a single A4 page and delegate to the
      // web SectionRenderer — preserves today's behavior so no
      // operator loses content they relied on.
      return (
        <PdfPageWrapper
          label={labelFor(page.section)}
          bleed={FULL_BLEED_TYPES.has(page.section.type)}
        >
          <div data-section-type={page.section.type}>
            <SectionRenderer section={page.section} />
          </div>
        </PdfPageWrapper>
      );
    }
  }
}

function labelFor(section: Section): string {
  const map: Partial<Record<SectionType, string>> = {
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
