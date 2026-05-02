"use client";

import { useState } from "react";
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
import { AddDayDialog, type AddDayDialogMode } from "@/components/editor/AddDayDialog";
import type { Section } from "@/lib/types";

// Section wrapper for the Day-by-Day Journey. Every day renders through
// DayCard → EditorialStackCard — one layout, no chapter grouping, no
// variant switching. Dragging a card reorders the days.

export function DayJourneySection({ section }: { section: Section }) {
  const { proposal, moveDay, updateDay } = useProposalStore();
  const { mode } = useEditorStore();
  const isEditor = mode === "editor";
  const { days, theme } = proposal;
  const tokens = resolveTokens(theme.tokens, section.styleOverrides);

  // Dialog state — single source of truth for "user is about to insert
  // days". Children (DayCard) ask to open it via setAddDayMode; the
  // dialog reads the mode object to decide whether to pre-fill from a
  // source day (duplicate) or start blank (after / append).
  const [addDayMode, setAddDayMode] = useState<AddDayDialogMode | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  // Drag-to-reorder. We add ONE safeguard: if the move would split a
  // multi-day stay (e.g. dragging Day 2 of a 2-3 Tarangire run away
  // from Day 3), confirm before committing. Plain drags within or
  // across single-stop runs commit silently as before.
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIdx = days.findIndex((d) => d.id === active.id);
    const toIdx = days.findIndex((d) => d.id === over.id);
    if (fromIdx === -1 || toIdx === -1) return;
    const moving = days[fromIdx];
    const left = days[fromIdx - 1];
    const right = days[fromIdx + 1];
    const wasInRun =
      (left && left.destination === moving.destination) ||
      (right && right.destination === moving.destination);
    if (wasInRun) {
      const ok = window.confirm(
        `This will split the ${moving.destination} stay across the trip. Continue?`,
      );
      if (!ok) return;
    }
    moveDay(fromIdx, toIdx);
  };

  return (
    <div style={{ background: tokens.sectionSurface }}>
      {/* Outer bg = sectionSurface (cream) so the section flows
          continuously into Map (cream) above and Property Showcase
          (cream) below — no visible green page-bg strips between
          sections. Day cards inside use their own bg as before. */}
      <div className="px-5 md:px-12 pt-3 pb-2">
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
              Detailed Itinerary
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
                {/* Day-to-day divider — visible band between every
                    pair of consecutive days. Operator brief:
                    "introduce on default at generation divider for
                    days. each day separated by divider." Same #5e4f33
                    palette as the section-level divider band; sits
                    above the drive-time chip. Skipped above day 1. */}
                {i > 0 && (
                  <div className="px-5 md:px-12 mt-3 mb-3">
                    <div
                      aria-hidden
                      style={{
                        height: 2,
                        background: "#5e4f33",
                        borderRadius: 1,
                      }}
                    />
                  </div>
                )}
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
                  onRequestAddAfter={() =>
                    setAddDayMode({ kind: "after", afterDayId: day.id })
                  }
                  onRequestDuplicate={() =>
                    setAddDayMode({ kind: "duplicate", sourceDayId: day.id })
                  }
                />
              </div>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {days.length === 0 && (
        <div className="px-5 md:px-12">
          <div
            className="text-center py-16 rounded-2xl border-2 border-dashed text-small"
            style={{ borderColor: tokens.border, color: tokens.mutedText }}
          >
            No days yet. {isEditor ? "Add one to start the story." : ""}
          </div>
        </div>
      )}

      {isEditor && (
        <div className="px-5 md:px-12 mt-2 mb-1 text-right">
          {/* Small inline add — was a full-width 80px dashed button
              that compounded the gap to the next section. Inline
              link reads as editor chrome, doesn't push sections
              apart. */}
          <button
            onClick={() => setAddDayMode({ kind: "append" })}
            className="text-[11.5px] font-semibold uppercase tracking-[0.18em] transition hover:opacity-75"
            style={{ color: tokens.accent }}
          >
            + Add day
          </button>
        </div>
      )}

      <AddDayDialog mode={addDayMode} onClose={() => setAddDayMode(null)} />
    </div>
  );
}
