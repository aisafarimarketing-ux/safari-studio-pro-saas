"use client";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import { resolveTokens } from "@/lib/theme";
import { DayCard } from "./day-card/DayCard";
import { ChapterCard } from "./day-card/chapter/ChapterCard";
import { resolveChapters } from "./day-card/chapter/resolve";
import { isChapterVariant } from "./day-card/chapter/types";
import type { Section, TierKey } from "@/lib/types";

// Section wrapper for the Day-by-Day Journey.
//
// Renders in one of two modes:
//   1. Chapter mode — variant is "auto" (when trip has multi-night stays)
//      or one of the chapter-* variants. Consecutive days sharing a camp
//      collapse into a single StayChapter with a rich property spread.
//   2. Day mode — variant is one of the five signature day layouts. Each
//      day renders as its own card.
//
// When the user picks "auto" we decide per-trip: if any camp is used ≥ 2
// nights, chapter mode wins (Karibu/Safariportal behaviour). Otherwise
// per-day layouts preserve rhythm for short transit-heavy trips.

export function DayJourneySection({ section }: { section: Section }) {
  const { proposal, moveDay, addDay } = useProposalStore();
  const { mode } = useEditorStore();
  const isEditor = mode === "editor";
  const { days, theme, activeTier } = proposal;
  const tokens = resolveTokens(theme.tokens, section.styleOverrides);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIdx = days.findIndex((d) => d.id === active.id);
    const toIdx = days.findIndex((d) => d.id === over.id);
    if (fromIdx !== -1 && toIdx !== -1) moveDay(fromIdx, toIdx);
  };

  const { renderMode, effectiveVariant } = resolveRenderMode(section.layoutVariant, proposal.days, activeTier as TierKey);

  const chapters = renderMode === "chapter"
    ? resolveChapters(days, proposal, activeTier as TierKey)
    : null;

  return (
    <div className="py-24 md:py-28" style={{ background: tokens.pageBg }}>
      <div className="ed-wide">
        {/* Section header */}
        <div className="flex items-end justify-between mb-16 gap-6 flex-wrap">
          <div>
            <div
              className="text-label ed-label mb-3"
              style={{ color: tokens.mutedText }}
            >
              Day-by-day
            </div>
            <h2
              className="text-h1 font-bold tracking-tight"
              style={{ color: tokens.headingText, fontFamily: `'${theme.displayFont}', serif` }}
            >
              Your journey
            </h2>
          </div>
          <div className="text-small pb-1 text-right" style={{ color: tokens.mutedText }}>
            {days.length} {days.length === 1 ? "day" : "days"}
            {renderMode === "chapter" && chapters ? (
              <span className="ml-2 opacity-75">
                · {chapters.length} chapter{chapters.length === 1 ? "" : "s"}
              </span>
            ) : null}
            {section.layoutVariant === "auto" && (
              <div className="text-[10.5px] uppercase tracking-[0.22em] mt-1 opacity-60">
                {renderMode === "chapter" ? "Grouped by stay" : "Day layouts vary"}
              </div>
            )}
          </div>
        </div>

        {renderMode === "chapter" && chapters ? (
          <div className="space-y-16 md:space-y-20">
            {chapters.map((chapter) => (
              <ChapterCard
                key={chapter.id}
                chapter={chapter}
                section={section}
                variant={isChapterVariant(effectiveVariant) ? effectiveVariant : "chapter-magazine"}
              />
            ))}
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext
              items={days.map((d) => d.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-20 md:space-y-24">
                {days.map((day, i) => (
                  <DayCard
                    key={day.id}
                    day={day}
                    index={i}
                    totalDays={days.length}
                    section={section}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {days.length === 0 && (
          <div
            className="text-center py-16 rounded-2xl border-2 border-dashed text-small"
            style={{ borderColor: tokens.border, color: tokens.mutedText }}
          >
            No days yet. {isEditor ? "Add one to start the story." : ""}
          </div>
        )}

        {isEditor && (
          <button
            onClick={addDay}
            className="mt-12 w-full py-4 rounded-2xl border-2 border-dashed text-small font-semibold transition hover:opacity-80"
            style={{ borderColor: tokens.accent, color: tokens.accent }}
          >
            + Add day
          </button>
        )}
      </div>
    </div>
  );
}

// Decides how to render based on section.layoutVariant + the trip shape.
//
//   - "auto": chapter mode if any camp is shared across ≥ 2 days; else day mode.
//   - "chapter-magazine" / "chapter-destination": chapter mode, specific layout.
//   - Any of the day-card variants: day mode.
function resolveRenderMode(
  variant: string,
  days: import("@/lib/types").Day[],
  activeTier: TierKey,
): { renderMode: "chapter" | "day"; effectiveVariant: string } {
  if (isChapterVariant(variant)) {
    return { renderMode: "chapter", effectiveVariant: variant };
  }
  if (variant === "auto") {
    const hasMultiNightStay = detectMultiNightStay(days, activeTier);
    if (hasMultiNightStay) {
      return { renderMode: "chapter", effectiveVariant: "chapter-magazine" };
    }
    return { renderMode: "day", effectiveVariant: "auto" };
  }
  return { renderMode: "day", effectiveVariant: variant };
}

function detectMultiNightStay(
  days: import("@/lib/types").Day[],
  activeTier: TierKey,
): boolean {
  const counts = new Map<string, number>();
  for (const day of days) {
    const camp = day.tiers?.[activeTier]?.camp?.trim().toLowerCase();
    if (!camp) continue;
    counts.set(camp, (counts.get(camp) ?? 0) + 1);
  }
  for (const n of counts.values()) if (n >= 2) return true;
  return false;
}
