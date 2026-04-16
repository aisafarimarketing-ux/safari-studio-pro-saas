"use client";

import { useState, useRef, useEffect } from "react";
import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import { ADDABLE_SECTIONS, SECTION_REGISTRY } from "@/lib/sectionRegistry";
import type { SectionType } from "@/lib/types";

interface Props {
  afterOrder: number;
}

export function AddSectionInserter({ afterOrder }: Props) {
  const [open, setOpen] = useState(false);
  const { addSection } = useProposalStore();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleAdd = (type: SectionType) => {
    addSection(type, afterOrder);
    setOpen(false);
  };

  return (
    <div className="relative z-20 flex items-center justify-center h-0 group" ref={ref}>
      {/* Insertion line */}
      <div className="absolute inset-x-0 h-px bg-transparent group-hover:bg-[#1b3a2d]/20 transition" />

      {/* + button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative w-7 h-7 rounded-full bg-white border-2 border-[#1b3a2d]/30 text-[#1b3a2d] text-sm font-bold opacity-0 group-hover:opacity-100 transition hover:scale-110 hover:border-[#1b3a2d] shadow-sm flex items-center justify-center"
        title="Add section"
      >
        +
      </button>

      {open && (
        <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-white rounded-2xl shadow-2xl border border-black/10 p-4 w-80 z-50 ss-popover-in">
          <div className="text-[11px] uppercase tracking-widest text-black/40 mb-3">
            Add section
          </div>
          <div className="grid grid-cols-2 gap-1.5 max-h-80 overflow-auto">
            {ADDABLE_SECTIONS.map((type) => {
              const def = SECTION_REGISTRY[type];
              return (
                <button
                  key={type}
                  onClick={() => handleAdd(type)}
                  className="text-left px-3 py-2.5 rounded-xl hover:bg-[#f3f0ea] transition group/item"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base w-6 text-center text-black/40 group-hover/item:text-[#1b3a2d]">
                      {def.icon}
                    </span>
                    <span className="text-sm font-medium text-black/70 group-hover/item:text-[#1b3a2d]">
                      {def.label}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
