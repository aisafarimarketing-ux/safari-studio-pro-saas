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
import type React from "react";
import { SectionChrome } from "./SectionChrome";
import { SectionRenderer } from "./SectionRenderer";
import { AddSectionInserter } from "./AddSectionInserter";

export function ProposalCanvas() {
  const { proposal, moveSection } = useProposalStore();
  const { mode, openFloatingPicker } = useEditorStore();
  const isEditor = mode === "editor";

  // Clicking on the page gutter (outside the proposal card) edits pageBg
  const handleGutterClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isEditor) return;
    // Only fire if the click target is the gutter div itself
    if (e.target !== e.currentTarget) return;
    openFloatingPicker({
      x: e.clientX,
      y: e.clientY,
      color: proposal.theme.tokens.pageBg,
      token: "pageBg",
    });
  };

  const sorted = [...proposal.sections].sort((a, b) => a.order - b.order);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIdx = sorted.findIndex((s) => s.id === active.id);
    const toIdx = sorted.findIndex((s) => s.id === over.id);
    if (fromIdx !== -1 && toIdx !== -1) moveSection(fromIdx, toIdx);
  };

  return (
    <div
      className={`flex-1 overflow-auto${isEditor ? " dm-editing" : ""}`}
      style={{ background: proposal.theme.tokens.pageBg }}
      onClick={handleGutterClick}
      title={isEditor ? "Click to edit page background color" : undefined}
    >
      {/* Proposal width wrapper */}
      <div className="max-w-[900px] mx-auto min-h-full shadow-xl" style={{ background: proposal.theme.tokens.pageBg }}>
        {isEditor ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={sorted.map((s) => s.id)}
              strategy={verticalListSortingStrategy}
            >
              {/* Inserter before first section */}
              <AddSectionInserter afterOrder={-1} />

              {sorted.map((section) => (
                <div key={section.id}>
                  <SectionChrome section={section}>
                    <SectionRenderer section={section} />
                  </SectionChrome>
                  <AddSectionInserter afterOrder={section.order} />
                </div>
              ))}
            </SortableContext>
          </DndContext>
        ) : (
          // Preview / print: no chrome, no inserters
          sorted
            .filter((s) => s.visible)
            .map((section) => (
              <div key={section.id} id={`section-${section.id}`}>
                <SectionRenderer section={section} />
              </div>
            ))
        )}
      </div>
    </div>
  );
}
