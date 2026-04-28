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
import type { Section } from "@/lib/types";

// Section wrapper for the Day-by-Day Journey. Every day renders through
// DayCard → EditorialStackCard — one layout, no chapter grouping, no
// variant switching. Dragging a card reorders the days.

export function DayJourneySection({ section }: { section: Section }) {
  const { proposal, moveDay, addDay } = useProposalStore();
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
    <div className="py-2 md:py-3" style={{ background: tokens.pageBg }}>
      {/* Header is constrained with horizontal padding so the eyebrow
          + title don't kiss the canvas edge. Day cards below are
          rendered edge-to-edge (no max-w, no px) so they fill the
          full 900px proposal canvas — matches the Cover ↔ PersonalNote
          "continuous magazine" treatment. */}
      <div className="px-8 md:px-12">
        <div className="flex items-end justify-between mb-3 gap-6 flex-wrap">
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
        <div className="px-8 md:px-12">
          <button
            onClick={addDay}
            className="mt-6 w-full py-4 rounded-2xl border-2 border-dashed text-small font-semibold transition hover:opacity-80"
            style={{ borderColor: tokens.accent, color: tokens.accent }}
          >
            + Add day
          </button>
        </div>
      )}
    </div>
  );
}
