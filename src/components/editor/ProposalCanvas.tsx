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
import { SpreadView } from "./SpreadView";
import { PrintProposalDocument } from "@/components/proposal-share/PrintProposalDocument";
import { PrintGuard } from "@/components/proposal-share/PrintGuard";

const EDITOR_PRINT_GUARD_HEADLINE =
  "Please switch to Print PDF mode to print or export this proposal.";

export function ProposalCanvas() {
  const { proposal, moveSection } = useProposalStore();
  const { mode, openFloatingPicker } = useEditorStore();
  const isEditor = mode === "editor";

  // Hooks first — react-hooks/rules-of-hooks. The viewMode branch
  // happens after, in the JSX.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // Spread view = the two-column sticky-photo layout (the Safari
  // Portal-style render). Same data, same store, same editor — just
  // a different chrome around each section. proposal.viewMode falsy
  // → magazine (the original full-width flow); set to "spread" to
  // switch. The toggle lives in the editor toolbar.
  if (proposal.viewMode === "spread") {
    return (
      <PrintGuard headline={EDITOR_PRINT_GUARD_HEADLINE}>
        <SpreadView />
      </PrintGuard>
    );
  }

  // PDF-Fit view = exactly the layout the printed PDF will produce.
  // Operator sees the editorial pages stacked vertically (210×297mm
  // each) and edits inline via the Layout / Content panels — no
  // mental reconciliation between "what I see" and "what prints."
  // Inline section chrome is intentionally muted here because the
  // PdfFit components own their own layout; structural edits move
  // to the side panels. No PrintGuard here — Print PDF is the only
  // mode allowed to reach the printer.
  if (proposal.viewMode === "pdf-fit") {
    return (
      <div
        className="flex-1 overflow-auto"
        style={{ background: proposal.theme.tokens.pageBg }}
      >
        <div
          className="mx-auto"
          style={{ background: proposal.theme.tokens.pageBg, maxWidth: "210mm" }}
        >
          <PrintProposalDocument />
        </div>
      </div>
    );
  }

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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIdx = sorted.findIndex((s) => s.id === active.id);
    const toIdx = sorted.findIndex((s) => s.id === over.id);
    if (fromIdx !== -1 && toIdx !== -1) moveSection(fromIdx, toIdx);
  };

  return (
    <PrintGuard headline={EDITOR_PRINT_GUARD_HEADLINE}>
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
            // Preview / print: no chrome, no inserters. Standalone
            // Inclusions blocks are also suppressed here — their data
            // already renders inside the Pricing page's editorial
            // variant, so showing the legacy block would duplicate the
            // Included/Not Included rows. Editor mode still renders the
            // block (with a deprecation badge) so operators can delete it.
            sorted
              .filter((s) => s.visible && s.type !== "inclusions")
              .map((section) => (
                <div key={section.id} id={`section-${section.id}`}>
                  <SectionRenderer section={section} />
                </div>
              ))
          )}
        </div>
      </div>
    </PrintGuard>
  );
}

