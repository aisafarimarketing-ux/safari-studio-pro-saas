"use client";

import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import { SectionRenderer } from "./SectionRenderer";
import { SectionChrome } from "./SectionChrome";
import {
  sectionLeadImage,
  sectionSpreadLabel,
  sectionSpreadEyebrow,
} from "./sectionLeadImage";
import type { Section } from "@/lib/types";

// ─── SpreadView ─────────────────────────────────────────────────────────
//
// The two-column "spread" rendering used when proposal.viewMode ===
// "spread". Each non-divider, non-footer section renders as a row in
// a 2-column grid:
//
//   ┌─ left column (sticky) ────┐ ┌─ right column (scrolls) ────────┐
//   │                           │ │                                  │
//   │   tall photograph         │ │   section content                │
//   │   white display caps      │ │   (the SAME components we render │
//   │   small italic eyebrow    │ │    in magazine view, just inside │
//   │                           │ │    a narrower column)            │
//   │                           │ │                                  │
//   └───────────────────────────┘ └──────────────────────────────────┘
//
// Sticky-image trick: each row's left column uses position: sticky +
// height: 100vh, top: 0. As the right column scrolls past, the
// browser pins the photo within the row's bounds. When the next row
// starts, its image takes over. No JS / IntersectionObserver needed
// for the basic effect.
//
// Editor still works on the right column — every SectionRenderer
// inside SpreadView receives the same isEditor / SectionChrome
// treatment as in magazine view, so InlineTextToolbar, AI rewrite,
// drag-to-reorder, variant switcher all keep working.
//
// Sections without a sensible single image (Day-by-Day, Property
// Showcase, dividers, footer) render full-width below the spread —
// the day-card / property-block layouts already give those sections
// their own per-card visual rhythm. We don't try to fight that with a
// fake sticky photo.

export function SpreadView() {
  const { proposal } = useProposalStore();
  const { mode } = useEditorStore();
  const isEditor = mode === "editor";

  const sorted = [...proposal.sections]
    .filter((s) => isEditor || s.visible)
    .sort((a, b) => a.order - b.order);

  return (
    <div
      className="flex-1 overflow-auto"
      style={{ background: proposal.theme.tokens.pageBg }}
    >
      <div className="mx-auto" style={{ maxWidth: 1280 }}>
        {sorted.map((section) => {
          const lead = sectionLeadImage(section, proposal);
          // Sections without a stable lead image (day-by-day, property
          // showcase, dividers, footer) render full-width through their
          // existing layout. Those layouts are designed to do their own
          // per-sub-element image rhythm.
          if (!lead) {
            return (
              <FullWidthRow key={section.id} section={section} isEditor={isEditor} />
            );
          }
          return (
            <SpreadRow
              key={section.id}
              section={section}
              leadImageUrl={lead}
              isEditor={isEditor}
            />
          );
        })}
      </div>
    </div>
  );
}

// ── Spread row — sticky image left + scrolling content right ──────────

function SpreadRow({
  section,
  leadImageUrl,
  isEditor,
}: {
  section: Section;
  leadImageUrl: string;
  isEditor: boolean;
}) {
  const label = sectionSpreadLabel(section);
  const eyebrow = sectionSpreadEyebrow(section);
  return (
    <div className="grid grid-cols-1 md:grid-cols-2">
      {/* Left — sticky photograph. md:sticky pins it as the right
          column scrolls; height 100vh keeps it covering the viewport
          for the duration of this row. */}
      <div
        className="relative md:sticky md:top-0 md:h-screen overflow-hidden"
        style={{ minHeight: 320 }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={leadImageUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Soft top-and-bottom gradient so white text reads against
            any photograph. */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(0,0,0,0.32) 0%, rgba(0,0,0,0) 28%, rgba(0,0,0,0) 70%, rgba(0,0,0,0.45) 100%)",
          }}
        />
        {/* Eyebrow + label — bottom-left of the sticky image. */}
        <div className="absolute bottom-10 left-8 md:left-12 right-8 md:right-12 text-white">
          {eyebrow && (
            <div className="text-[12px] italic mb-2 opacity-85">{eyebrow}</div>
          )}
          {label && (
            <div
              className="font-bold leading-[0.95] tracking-tight"
              style={{
                fontSize: "clamp(2rem, 4vw, 3.4rem)",
                letterSpacing: "-0.01em",
              }}
            >
              {label}
            </div>
          )}
        </div>
      </div>

      {/* Right — scrolling content. SectionRenderer renders the SAME
          section component magazine view uses, plus SectionChrome in
          editor mode so all the existing chrome (drag / duplicate /
          colour pills / variant switcher) keeps working. The section's
          own padding usually expects to be the only thing in the row;
          here we constrain its width via the column. */}
      <div className="min-h-screen relative">
        {isEditor ? (
          <SectionChrome section={section}>
            <SectionRenderer section={section} />
          </SectionChrome>
        ) : (
          <SectionRenderer section={section} />
        )}
      </div>
    </div>
  );
}

// Sections that shouldn't be forced into a sticky pane (day-by-day,
// property showcase, dividers, footer) render full-width inline so
// the spread layout doesn't fight their existing per-card / per-band
// visual rhythm.
function FullWidthRow({
  section,
  isEditor,
}: {
  section: Section;
  isEditor: boolean;
}) {
  return (
    <div className="col-span-2">
      {isEditor ? (
        <SectionChrome section={section}>
          <SectionRenderer section={section} />
        </SectionChrome>
      ) : (
        <SectionRenderer section={section} />
      )}
    </div>
  );
}
