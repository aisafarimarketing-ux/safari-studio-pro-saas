"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import { SECTION_REGISTRY } from "@/lib/sectionRegistry";
import type { Section } from "@/lib/types";

interface Props {
  section: Section;
  children: React.ReactNode;
}

export function SectionChrome({ section, children }: Props) {
  const [hovered, setHovered] = useState(false);
  const { removeSection, duplicateSection, toggleSectionVisibility, updateSectionVariant } = useProposalStore();
  const { proposal } = useProposalStore();
  const { mode, selectSection: editorSelect, selectedSectionId, openFloatingPicker } = useEditorStore();

  const isSelected = selectedSectionId === section.id;
  const showControls = hovered || isSelected;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: section.id });

  const sortableStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : section.visible ? 1 : 0.4,
    position: "relative",
  };

  if (mode !== "editor") {
    return section.visible ? <div>{children}</div> : null;
  }

  const reg = SECTION_REGISTRY[section.type];
  const variants = reg?.variants ?? [];

  // Resolve current background for the floating picker
  const currentBg =
    (section.styleOverrides as Record<string, string>)?.sectionSurface ??
    proposal.theme.tokens.sectionSurface;

  const handleBgColorClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    openFloatingPicker({
      x: rect.left,
      y: rect.bottom + 6,
      color: currentBg,
      token: "sectionSurface",
      sectionId: section.id,
    });
  };

  return (
    <div
      ref={setNodeRef}
      style={sortableStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => { editorSelect(section.id); useEditorStore.getState().selectDay(null); useEditorStore.getState().selectProperty(null); }}
      className={`relative transition ${isSelected ? "outline outline-2 outline-offset-0 outline-[#1b3a2d]/40" : ""}`}
    >
      {children}

      {/* ── Hover / selected controls ── */}
      {showControls && (
        <div
          className="absolute top-2 right-2 z-30 flex gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Drag handle */}
          <button
            {...attributes}
            {...listeners}
            className="w-8 h-8 rounded-lg bg-white/90 border border-black/10 flex items-center justify-center text-black/50 hover:text-black/80 cursor-grab shadow-sm transition"
            title="Drag to reorder"
          >
            ⠿
          </button>

          {/* Background color */}
          <button
            onClick={handleBgColorClick}
            className="w-8 h-8 rounded-lg bg-white/90 border border-black/10 flex items-center justify-center shadow-sm transition hover:border-black/20"
            title="Edit section background"
          >
            <span
              className="w-4 h-4 rounded-sm border border-black/15"
              style={{ background: currentBg }}
            />
          </button>

          {/* Duplicate */}
          <button
            onClick={(e) => { e.stopPropagation(); duplicateSection(section.id); }}
            className="w-8 h-8 rounded-lg bg-white/90 border border-black/10 flex items-center justify-center text-black/50 hover:text-black/80 shadow-sm transition text-sm"
            title="Duplicate"
          >
            ⧉
          </button>

          {/* Hide / show */}
          <button
            onClick={(e) => { e.stopPropagation(); toggleSectionVisibility(section.id); }}
            className="w-8 h-8 rounded-lg bg-white/90 border border-black/10 flex items-center justify-center text-black/50 hover:text-black/80 shadow-sm transition text-sm"
            title={section.visible ? "Hide section" : "Show section"}
          >
            {section.visible ? "◉" : "○"}
          </button>

          {/* Delete */}
          <button
            onClick={(e) => { e.stopPropagation(); removeSection(section.id); }}
            className="w-8 h-8 rounded-lg bg-white/90 border border-black/10 flex items-center justify-center text-black/40 hover:text-red-500 hover:border-red-200 shadow-sm transition text-sm"
            title="Delete section"
          >
            ×
          </button>
        </div>
      )}

      {/* ── Inline label + layout variant switcher ── */}
      {showControls && (
        <div
          className="absolute top-2 left-2 z-30 flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Section type chip */}
          <div className="flex items-center gap-1.5 bg-white/90 border border-black/10 rounded-lg px-2.5 py-1 shadow-sm">
            <span className="text-[10px] font-semibold text-black/40 uppercase tracking-wider">
              {reg?.label ?? section.type}
            </span>
          </div>

          {/* Layout variant quick-toggle (only if >1 variant) */}
          {variants.length > 1 && (
            <div className="flex items-center gap-0.5 bg-white/90 border border-black/10 rounded-lg px-1 py-1 shadow-sm">
              {variants.map((v) => {
                const shortLabel = v.split("-").map((w) => w[0]).join("").toUpperCase();
                const isActive = section.layoutVariant === v;
                return (
                  <button
                    key={v}
                    onClick={() => updateSectionVariant(section.id, v)}
                    title={v}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition ${
                      isActive
                        ? "bg-[#1b3a2d] text-white"
                        : "text-black/40 hover:text-black/70 hover:bg-black/5"
                    }`}
                  >
                    {shortLabel}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Hidden badge ── */}
      {!section.visible && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-white/80 backdrop-blur-sm text-xs text-black/40 px-3 py-1.5 rounded-full border border-black/10">
            Hidden in preview
          </div>
        </div>
      )}
    </div>
  );
}
