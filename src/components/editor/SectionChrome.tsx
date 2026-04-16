"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import type { Section } from "@/lib/types";

interface Props {
  section: Section;
  children: React.ReactNode;
}

export function SectionChrome({ section, children }: Props) {
  const [hovered, setHovered] = useState(false);
  const { removeSection, duplicateSection, toggleSectionVisibility } = useProposalStore();
  const { mode, selectSection: editorSelect, selectedSectionId } = useEditorStore();

  const isSelected = selectedSectionId === section.id;

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

  return (
    <div
      ref={setNodeRef}
      style={sortableStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => editorSelect(section.id)}
      className={`relative transition ${isSelected ? "outline outline-2 outline-offset-0 outline-[#1b3a2d]/40" : ""}`}
    >
      {children}

      {/* Hover controls */}
      {(hovered || isSelected) && (
        <div className="absolute top-2 right-2 z-30 flex gap-1">
          {/* Drag handle */}
          <button
            {...attributes}
            {...listeners}
            className="w-8 h-8 rounded-lg bg-white/90 border border-black/10 flex items-center justify-center text-black/50 hover:text-black/80 cursor-grab shadow-sm transition"
            title="Drag to reorder"
          >
            ⠿
          </button>

          {/* Duplicate */}
          <button
            onClick={(e) => { e.stopPropagation(); duplicateSection(section.id); }}
            className="w-8 h-8 rounded-lg bg-white/90 border border-black/10 flex items-center justify-center text-black/50 hover:text-black/80 shadow-sm transition text-sm"
            title="Duplicate"
          >
            ⧉
          </button>

          {/* Hide/show */}
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

      {/* Section type label on hover */}
      {hovered && !isSelected && (
        <div className="absolute top-2 left-2 z-30 bg-white/90 border border-black/10 rounded-lg px-2.5 py-1 text-[11px] font-medium text-black/50 shadow-sm pointer-events-none">
          {section.type}
        </div>
      )}

      {/* Hidden badge */}
      {!section.visible && mode === "editor" && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-white/80 backdrop-blur-sm text-xs text-black/40 px-3 py-1.5 rounded-full border border-black/10">
            Hidden in preview
          </div>
        </div>
      )}
    </div>
  );
}
