"use client";

import { useState } from "react";
import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import { SECTION_REGISTRY } from "@/lib/sectionRegistry";

export function LeftSidebar() {
  const { proposal, moveSection, toggleSectionVisibility } = useProposalStore();
  const { selectedSectionId, selectSection } = useEditorStore();
  const sorted = [...proposal.sections].sort((a, b) => a.order - b.order);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const scrollTo = (id: string) => {
    selectSection(id);
    document.getElementById(`section-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleMoveUp = (e: React.MouseEvent, idx: number) => {
    e.stopPropagation();
    if (idx > 0) moveSection(idx, idx - 1);
  };

  const handleMoveDown = (e: React.MouseEvent, idx: number) => {
    e.stopPropagation();
    if (idx < sorted.length - 1) moveSection(idx, idx + 1);
  };

  const handleToggleVisibility = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    toggleSectionVisibility(id);
  };

  return (
    <div className="w-52 border-r border-black/8 bg-[#f7f4ee] flex flex-col shrink-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-black/8 shrink-0">
        <div className="text-[11px] uppercase tracking-widest text-black/40 font-medium">Structure</div>
      </div>
      <div className="flex-1 overflow-auto py-1">
        {sorted.map((section, idx) => {
          const def = SECTION_REGISTRY[section.type];
          const isSelected = selectedSectionId === section.id;
          const isHovered = hoveredId === section.id;
          const showControls = isHovered && !isSelected;
          return (
            <div
              key={section.id}
              className="relative group"
              onMouseEnter={() => setHoveredId(section.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <button
                onClick={() => scrollTo(section.id)}
                className={`w-full text-left flex items-center gap-2 px-3 py-2 transition-all duration-150 text-[13px] border-l-[3px] ${
                  isSelected
                    ? "bg-[#1b3a2d] text-white border-l-[#c9a84c]"
                    : `hover:bg-black/[0.04] border-l-transparent ${section.visible ? "text-black/65" : "text-black/25 italic"}`
                }`}
              >
                <span className={`text-sm shrink-0 w-5 text-center ${isSelected ? "text-white/65" : section.visible ? "text-black/30" : "text-black/15"}`}>
                  {def?.icon ?? "◻"}
                </span>
                <span className="truncate flex-1">{def?.label ?? section.type}</span>
                {!section.visible && !isHovered && (
                  <span className={`text-[9px] shrink-0 ${isSelected ? "text-white/30" : "text-black/20"}`}>
                    hidden
                  </span>
                )}
              </button>

              {/* Hover controls — move up / down / visibility */}
              {showControls && (
                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 ss-fade-in">
                  <button
                    onClick={(e) => handleMoveUp(e, idx)}
                    disabled={idx === 0}
                    className="w-5 h-5 rounded flex items-center justify-center text-[10px] text-black/40 hover:text-black/70 hover:bg-black/8 disabled:opacity-20 disabled:cursor-default transition"
                    title="Move up"
                  >
                    ▲
                  </button>
                  <button
                    onClick={(e) => handleMoveDown(e, idx)}
                    disabled={idx === sorted.length - 1}
                    className="w-5 h-5 rounded flex items-center justify-center text-[10px] text-black/40 hover:text-black/70 hover:bg-black/8 disabled:opacity-20 disabled:cursor-default transition"
                    title="Move down"
                  >
                    ▼
                  </button>
                  <button
                    onClick={(e) => handleToggleVisibility(e, section.id)}
                    className={`w-5 h-5 rounded flex items-center justify-center text-[10px] transition ${
                      section.visible
                        ? "text-black/40 hover:text-black/70 hover:bg-black/8"
                        : "text-amber-500 hover:text-amber-600 hover:bg-amber-50"
                    }`}
                    title={section.visible ? "Hide section" : "Show section"}
                  >
                    {section.visible ? "◉" : "○"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
