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
    return section.visible ? (
      <div data-section-type={section.type}>{children}</div>
    ) : null;
  }

  const reg = SECTION_REGISTRY[section.type];
  const variants = reg?.variants ?? [];

  // Resolve the actual section background: override > global token
  const overrides = section.styleOverrides as Record<string, string>;
  const resolvedBg = overrides?.sectionSurface ?? proposal.theme.tokens.sectionSurface;

  const handleBgColorClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    openFloatingPicker({
      x: rect.left,
      y: rect.bottom + 6,
      color: resolvedBg,
      token: "sectionSurface",
      sectionId: section.id,
    });
  };

  // Build CSS custom properties from section overrides so child components
  // can pick them up via var(--ss-sectionSurface) etc.
  const cssVars: Record<string, string> = {};
  if (overrides) {
    for (const [key, val] of Object.entries(overrides)) {
      if (val) cssVars[`--ss-${key}`] = val;
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={sortableStyle}
      data-editor-chrome
      data-section-type={section.type}
      id={`section-${section.id}`}
    >
      {/* Inner div handles all visual states — isolated from dnd-kit's transform/transition */}
      <div
        className="relative transition-shadow duration-200"
        style={{
          ...cssVars,
          boxShadow: isSelected
            ? "0 0 0 2px rgba(27,58,45,0.22), 0 4px 16px rgba(27,58,45,0.07)"
            : undefined,
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => {
          editorSelect(section.id);
          useEditorStore.getState().selectDay(null);
          useEditorStore.getState().selectProperty(null);
        }}
      >
        {children}

        {/* ── Hover / selected controls — always mounted, fade in/out ── */}
        <div
          className={`absolute top-2 right-2 z-30 flex gap-1 transition-all duration-150 ${
            showControls ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1 pointer-events-none"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            {...attributes}
            {...listeners}
            className="w-8 h-8 rounded-lg bg-white/92 border border-black/10 flex items-center justify-center text-black/45 hover:text-black/75 cursor-grab shadow-sm transition-all duration-150 active:scale-95"
            title="Drag to reorder"
          >
            ⠿
          </button>

          <button
            onClick={handleBgColorClick}
            className="w-8 h-8 rounded-lg bg-white/92 border border-black/10 flex items-center justify-center shadow-sm transition-all duration-150 hover:border-black/20 active:scale-95"
            title="Section background"
          >
            <span
              className="w-4 h-4 rounded-sm border border-black/15"
              style={{ background: resolvedBg }}
            />
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); duplicateSection(section.id); }}
            className="w-8 h-8 rounded-lg bg-white/92 border border-black/10 flex items-center justify-center text-black/45 hover:text-black/75 shadow-sm transition-all duration-150 text-sm active:scale-95"
            title="Duplicate"
          >
            ⧉
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); toggleSectionVisibility(section.id); }}
            className="w-8 h-8 rounded-lg bg-white/92 border border-black/10 flex items-center justify-center text-black/45 hover:text-black/75 shadow-sm transition-all duration-150 text-sm active:scale-95"
            title={section.visible ? "Hide section" : "Show section"}
          >
            {section.visible ? "◉" : "○"}
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); removeSection(section.id); }}
            className="w-8 h-8 rounded-lg bg-white/92 border border-black/10 flex items-center justify-center text-black/35 hover:text-red-500 hover:border-red-200 shadow-sm transition-all duration-150 text-sm active:scale-95"
            title="Delete section"
          >
            ×
          </button>
        </div>

        {/* ── Inline label + layout variant switcher ── */}
        <div
          className={`absolute top-2 left-2 z-30 flex items-center gap-1 transition-all duration-150 ${
            showControls ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1 pointer-events-none"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-1.5 bg-white/92 border border-black/10 rounded-lg px-2.5 py-1 shadow-sm">
            <span className="text-[10px] font-semibold text-black/40 uppercase tracking-wider">
              {reg?.label ?? section.type}
            </span>
          </div>

          {variants.length > 1 && (
            <div className="flex items-center gap-0.5 bg-white/92 border border-black/10 rounded-lg px-1 py-1 shadow-sm">
              {variants.map((v) => {
                const shortLabel = v.split("-").map((w) => w[0]).join("").toUpperCase();
                const isActive = section.layoutVariant === v;
                return (
                  <button
                    key={v}
                    onClick={() => updateSectionVariant(section.id, v)}
                    title={v}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all duration-150 active:scale-95 ${
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

        {/* ── Hidden badge ── */}
        {!section.visible && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-white/80 backdrop-blur-sm text-xs text-black/40 px-3 py-1.5 rounded-full border border-black/10">
              Hidden in preview
            </div>
          </div>
        )}

        {/* ── Selection indicator label ── */}
        {isSelected && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
            <div className="bg-[#1b3a2d] text-white text-[9px] font-semibold uppercase tracking-wider px-3 py-1 rounded-full shadow-lg">
              Editing: {reg?.label ?? section.type}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
