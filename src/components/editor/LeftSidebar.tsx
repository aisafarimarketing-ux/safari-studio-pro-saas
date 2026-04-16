"use client";

import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import { SECTION_REGISTRY } from "@/lib/sectionRegistry";

export function LeftSidebar() {
  const { proposal } = useProposalStore();
  const { selectedSectionId, selectSection } = useEditorStore();
  const sorted = [...proposal.sections].sort((a, b) => a.order - b.order);

  const scrollTo = (id: string) => {
    selectSection(id);
    document.getElementById(`section-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="w-52 border-r border-black/8 bg-[#f7f4ee] flex flex-col shrink-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-black/8 shrink-0">
        <div className="text-[11px] uppercase tracking-widest text-black/40 font-medium">Structure</div>
      </div>
      <div className="flex-1 overflow-auto py-2">
        {sorted.map((section) => {
          const def = SECTION_REGISTRY[section.type];
          const isSelected = selectedSectionId === section.id;
          return (
            <button
              key={section.id}
              onClick={() => scrollTo(section.id)}
              className={`w-full text-left flex items-center gap-2.5 px-3 py-2.5 transition-all duration-150 text-[13px] border-l-[3px] ${
                isSelected
                  ? "bg-[#1b3a2d] text-white border-l-[#c9a84c]"
                  : `hover:bg-black/[0.055] border-l-transparent ${section.visible ? "text-black/65" : "text-black/30"}`
              }`}
            >
              <span className={`text-sm shrink-0 w-5 text-center ${isSelected ? "text-white/65" : "text-black/30"}`}>
                {def?.icon ?? "◻"}
              </span>
              <span className="truncate">{def?.label ?? section.type}</span>
              {!section.visible && (
                <span className={`ml-auto text-[10px] shrink-0 ${isSelected ? "text-white/35" : "text-black/25"}`}>
                  hidden
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
