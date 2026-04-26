"use client";

import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import { SECTION_REGISTRY, ADDABLE_SECTIONS } from "@/lib/sectionRegistry";
import type { Section, SectionType } from "@/lib/types";

// Left structure panel. Shows the full catalog of section types — sections
// currently in the proposal carry reorder + visibility controls and jump
// to themselves on click; sections that have been deleted appear beneath
// them, dimmed, with an "add" affordance so the operator can re-insert any
// section they dropped by mistake without digging through the + popover.

export function LeftSidebar() {
  const { proposal, moveSection, toggleSectionVisibility, addSection } = useProposalStore();
  const { selectedSectionId, selectSection } = useEditorStore();
  const sorted: Section[] = [...proposal.sections].sort((a, b) => a.order - b.order);
  const inProposal = new Set<SectionType>(sorted.map((s) => s.type));
  const missing: SectionType[] = ADDABLE_SECTIONS.filter((t) => !inProposal.has(t));

  const scrollTo = (id: string) => {
    selectSection(id);
    document.getElementById(`section-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const move = (idx: number, dir: -1 | 1) => {
    const next = idx + dir;
    if (next < 0 || next >= sorted.length) return;
    moveSection(idx, next);
  };

  return (
    <div className="w-56 border-r border-black/10 bg-[#faf8f3] flex flex-col shrink-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-black/8 shrink-0 flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.22em] text-black/45 font-semibold">
          Structure
        </div>
        <div className="text-[10px] text-black/30 tabular-nums">{sorted.length}</div>
      </div>

      <div className="flex-1 overflow-auto py-1">
        {sorted.map((section, idx) => {
          const def = SECTION_REGISTRY[section.type];
          const isSelected = selectedSectionId === section.id;
          const isFirst = idx === 0;
          const isLast = idx === sorted.length - 1;
          return (
            <div
              key={section.id}
              className={`group flex items-stretch border-l-[3px] transition ${
                isSelected
                  ? "bg-[#1b3a2d] border-l-[#c9a84c]"
                  : "border-l-transparent hover:bg-black/[0.035]"
              }`}
            >
              {/* Move arrows — tight column on the left */}
              <div className="flex flex-col justify-center py-1 pl-1 gap-px shrink-0">
                <RowIconButton
                  disabled={isFirst}
                  onClick={(e) => { e.stopPropagation(); move(idx, -1); }}
                  label="Move up"
                  selected={isSelected}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
                    <path d="M2 6.5 L5 3.5 L8 6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </RowIconButton>
                <RowIconButton
                  disabled={isLast}
                  onClick={(e) => { e.stopPropagation(); move(idx, 1); }}
                  label="Move down"
                  selected={isSelected}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
                    <path d="M2 3.5 L5 6.5 L8 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </RowIconButton>
              </div>

              {/* Label — scroll / select */}
              <button
                type="button"
                onClick={() => scrollTo(section.id)}
                className={`flex-1 min-w-0 flex items-center gap-2 pl-1 pr-2 py-2 text-[13px] text-left transition ${
                  isSelected
                    ? "text-white"
                    : section.visible
                      ? "text-black/75"
                      : "text-black/35 italic"
                }`}
              >
                <span
                  className={`shrink-0 w-5 text-center text-[13px] ${
                    isSelected ? "text-white/70" : section.visible ? "text-black/35" : "text-black/20"
                  }`}
                >
                  {def?.icon ?? "◻"}
                </span>
                <span className="truncate">{def?.label ?? section.type}</span>
              </button>

              {/* Visibility toggle — always visible */}
              <div className="flex items-center pr-1.5 shrink-0">
                <RowIconButton
                  onClick={(e) => { e.stopPropagation(); toggleSectionVisibility(section.id); }}
                  label={section.visible ? "Hide section" : "Show section"}
                  selected={isSelected}
                  active={!section.visible}
                >
                  {section.visible ? <EyeIcon /> : <EyeOffIcon />}
                </RowIconButton>
              </div>
            </div>
          );
        })}

        {/* Missing section catalog — sections that aren't in the proposal
            right now. One click re-adds at the end; operators can drag
            from there into position if they want it elsewhere. */}
        {missing.length > 0 && (
          <>
            <div className="mt-3 px-4 pt-2 pb-1.5 text-[9.5px] uppercase tracking-[0.24em] text-black/40 font-semibold border-t border-black/8">
              Not in proposal
            </div>
            {missing.map((type) => {
              const def = SECTION_REGISTRY[type];
              const lastOrder = sorted.length > 0 ? sorted[sorted.length - 1].order : -1;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => addSection(type, lastOrder)}
                  title={`Add ${def.label}`}
                  className="w-full flex items-center gap-2 pl-[34px] pr-1.5 py-1.5 text-[13px] text-left text-black/40 hover:text-black/75 hover:bg-black/[0.035] transition group"
                >
                  <span className="shrink-0 w-5 text-center text-black/25 group-hover:text-black/55">
                    {def?.icon ?? "◻"}
                  </span>
                  <span className="truncate">{def?.label ?? type}</span>
                  <span className="ml-auto shrink-0 text-[12px] leading-none text-black/25 group-hover:text-[#1b3a2d]">
                    +
                  </span>
                </button>
              );
            })}
          </>
        )}
      </div>

      <div className="px-4 py-2.5 border-t border-black/8 text-[10.5px] text-black/35 leading-snug">
        Delete removes from proposal · click below to re-add.
      </div>
    </div>
  );
}

function RowIconButton({
  children,
  onClick,
  label,
  disabled,
  selected,
  active,
}: {
  children: React.ReactNode;
  onClick: (e: React.MouseEvent) => void;
  label: string;
  disabled?: boolean;
  selected?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`w-5 h-5 rounded flex items-center justify-center transition ${
        disabled
          ? selected
            ? "text-white/20 cursor-default"
            : "text-black/15 cursor-default"
          : selected
            ? active
              ? "text-[#c9a84c] hover:bg-white/10"
              : "text-white/60 hover:text-white hover:bg-white/10"
            : active
              ? "text-[#c9a84c] hover:bg-[#c9a84c]/10"
              : "text-black/40 hover:text-black/80 hover:bg-black/[0.06]"
      }`}
    >
      {children}
    </button>
  );
}

function EyeIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M1 6s1.8-3.5 5-3.5S11 6 11 6s-1.8 3.5-5 3.5S1 6 1 6Z" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="6" cy="6" r="1.5" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M2 2.5 10 9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M1 6s1.8-3.5 5-3.5S11 6 11 6s-1.8 3.5-5 3.5S1 6 1 6Z" stroke="currentColor" strokeWidth="1.2" opacity="0.6" />
    </svg>
  );
}

// ─── Collapsed sidebar rail ──────────────────────────────────────────────
//
// Narrow ~52px column with section-type icons. Rendered in Edit and
// Style modes — the canvas dominates but the operator can still jump
// between sections at a glance. Top of the rail has an "expand"
// button that flips the editor view to Structure for full reordering.
//
// Click an icon → selects + scrolls to that section. Hover → tooltip
// with the section label. Selected section gets the forest-green
// pill treatment that mirrors the expanded sidebar's selection cue.

export function CollapsedSidebarRail() {
  const { proposal } = useProposalStore();
  const selectedSectionId = useEditorStore((s) => s.selectedSectionId);
  const selectSection = useEditorStore((s) => s.selectSection);
  const setEditorView = useEditorStore((s) => s.setEditorView);

  const sorted: Section[] = [...proposal.sections]
    .filter((s) => s.visible)
    .sort((a, b) => a.order - b.order);

  const scrollTo = (id: string) => {
    selectSection(id);
    document.getElementById(`section-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div
      className="border-r border-black/10 bg-[#faf8f3] flex flex-col shrink-0 overflow-hidden"
      style={{ width: 52 }}
    >
      {/* Expand → Structure mode */}
      <button
        type="button"
        onClick={() => setEditorView("structure")}
        title="Open Structure view (rearrange sections)"
        className="h-12 flex items-center justify-center border-b border-black/8 text-black/40 hover:text-black/70 hover:bg-black/[0.04] transition shrink-0"
        aria-label="Open structure view"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M2 4 H12 M2 7 H12 M2 10 H8" />
        </svg>
      </button>

      <div className="flex-1 overflow-y-auto py-1.5">
        {sorted.map((section) => {
          const def = SECTION_REGISTRY[section.type];
          const isSelected = selectedSectionId === section.id;
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => scrollTo(section.id)}
              title={def?.label ?? section.type}
              aria-label={def?.label ?? section.type}
              className="group relative w-full flex items-center justify-center transition"
              style={{
                height: 40,
              }}
            >
              {/* Active indicator — gold left bar that mirrors the expanded sidebar. */}
              <span
                aria-hidden
                className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r"
                style={{
                  background: isSelected ? "#c9a84c" : "transparent",
                  transition: "background 140ms",
                }}
              />
              <span
                className="flex items-center justify-center transition"
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: isSelected ? "#1b3a2d" : "transparent",
                  color: isSelected ? "white" : "rgba(0,0,0,0.55)",
                  fontSize: 14,
                  lineHeight: 1,
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.background = "rgba(0,0,0,0.05)";
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.background = "transparent";
                }}
              >
                {def?.icon ?? "▣"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
