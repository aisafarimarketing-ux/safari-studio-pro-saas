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
import { DriveTimeChip } from "./day-card/DriveTimeChip";
import type { Section } from "@/lib/types";

// Section wrapper for the Day-by-Day Journey. Every day renders through
// DayCard → EditorialStackCard — one layout, no chapter grouping, no
// variant switching. Dragging a card reorders the days.

export function DayJourneySection({ section }: { section: Section }) {
  const { proposal, moveDay, addDay, updateDay } = useProposalStore();
  const { mode } = useEditorStore();
  const isEditor = mode === "editor";
  const { days, theme } = proposal;
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

  return (
    <div style={{ background: tokens.sectionSurface }}>
      {/* Outer bg = sectionSurface (cream) so the section flows
          continuously into Map (cream) above and Property Showcase
          (cream) below — no visible green page-bg strips between
          sections. Day cards inside use their own bg as before. */}
      <div className="px-8 md:px-12 pt-3 pb-2">
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <div
              className="text-label ed-label mb-1"
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
          </div>
        </div>
      </div>

      {/* Day cards — rendered OUTSIDE the header's px container so each
          card spans the full 900px canvas edge-to-edge. Magazine-feel:
          one card flows into the next, no inset framing. */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={days.map((d) => d.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2 md:space-y-3">
            {days.map((day, i) => (
              <div key={day.id}>
                {/* Drive-time chip — appears ABOVE every day except
                    Day 1 (no preceding day to transfer from). Editor
                    mode shows the slot even when blank so operators
                    see where to fill in the transfer note. Preview
                    hides it entirely when empty. */}
                {i > 0 && (
                  <DriveTimeChip
                    value={day.driveTimeBefore?.trim() ?? ""}
                    isEditor={isEditor}
                    tokens={tokens}
                    onChange={(next) => updateDay(day.id, { driveTimeBefore: next })}
                  />
                )}
                <DayCard
                  day={day}
                  index={i}
                  totalDays={days.length}
                  section={section}
                />
              </div>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {days.length === 0 && (
        <div className="px-8 md:px-12">
          <div
            className="text-center py-16 rounded-2xl border-2 border-dashed text-small"
            style={{ borderColor: tokens.border, color: tokens.mutedText }}
          >
            No days yet. {isEditor ? "Add one to start the story." : ""}
          </div>
        </div>
      )}

      {isEditor && (
        <div className="px-8 md:px-12 mt-2 mb-1 text-right">
          {/* Small inline add — was a full-width 80px dashed button
              that compounded the gap to the next section. Inline
              link reads as editor chrome, doesn't push sections
              apart. */}
          <button
            onClick={addDay}
            className="text-[11.5px] font-semibold uppercase tracking-[0.18em] transition hover:opacity-75"
            style={{ color: tokens.accent }}
          >
            + Add day
          </button>
        </div>
      )}
    </div>
  );
}
