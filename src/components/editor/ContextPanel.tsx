"use client";

import { useEditorStore } from "@/store/editorStore";
import { useProposalStore } from "@/store/proposalStore";
import { ThemePanel } from "./panels/ThemePanel";
import { SectionPanel } from "./panels/SectionPanel";
import { ProposalSettingsPanel } from "./panels/ProposalSettingsPanel";
import type { ContextTab } from "@/store/editorStore";

const TABS: { id: ContextTab; label: string }[] = [
  { id: "content", label: "Content" },
  { id: "style", label: "Style" },
  { id: "layout", label: "Layout" },
  { id: "advanced", label: "Theme" },
];

export function ContextPanel() {
  const { selectedSectionId, contextTab, setContextTab } = useEditorStore();
  const { proposal } = useProposalStore();

  const section = proposal.sections.find((s) => s.id === selectedSectionId);

  return (
    <div className="w-72 border-l border-black/8 bg-[#f7f4ee] flex flex-col shrink-0 overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-black/8 shrink-0">
        <div className="font-semibold text-sm text-black/70">
          {section ? section.type.replace(/([A-Z])/g, " $1").trim() : "Proposal"}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-black/8 shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setContextTab(tab.id)}
            className={`flex-1 text-[11px] py-2.5 font-medium transition ${
              contextTab === tab.id
                ? "text-[#1b3a2d] border-b-2 border-[#1b3a2d]"
                : "text-black/40 hover:text-black/65"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Panel body */}
      <div className="flex-1 overflow-auto p-4">
        {contextTab === "advanced" && <ThemePanel />}
        {contextTab === "style" && <SectionPanel />}
        {contextTab === "layout" && <SectionPanel />}
        {contextTab === "content" && (
          section ? (
            <div className="space-y-3">
              <div className="text-xs text-black/40">
                Use the section label in the left sidebar or click directly on text in the canvas to edit content inline.
              </div>
              <div className="border rounded-xl p-4 bg-white text-xs space-y-1" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
                <div className="font-semibold text-black/60">Section: {section.type}</div>
                <div className="text-black/40">Variant: {section.layoutVariant}</div>
                <div className="text-black/40">Visible: {section.visible ? "Yes" : "Hidden"}</div>
              </div>
            </div>
          ) : (
            <ProposalSettingsPanel />
          )
        )}
      </div>
    </div>
  );
}
