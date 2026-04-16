"use client";

import { useEffect } from "react";
import { useEditorStore } from "@/store/editorStore";
import { useProposalStore } from "@/store/proposalStore";
import { EditorToolbar } from "./EditorToolbar";
import { LeftSidebar } from "./LeftSidebar";
import { ProposalCanvas } from "./ProposalCanvas";
import { ContextPanel } from "./ContextPanel";
import { NewProposalDialog } from "@/components/ui/NewProposalDialog";
import { InlineTextToolbar } from "@/components/ui/InlineTextToolbar";
import { FloatingColorPicker } from "@/components/ui/FloatingColorPicker";

export function ProposalEditor() {
  const { mode, leftPanelOpen, rightPanelOpen, toggleLeftPanel, toggleRightPanel } = useEditorStore();
  const { proposal } = useProposalStore();
  const { displayFont, bodyFont } = proposal.theme;

  // Inject dynamic font CSS variables on font change
  useEffect(() => {
    let styleEl = document.getElementById("ss-font-vars");
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "ss-font-vars";
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = `
      .proposal-canvas {
        --font-display: '${displayFont}', Georgia, serif;
        --font-body: '${bodyFont}', system-ui, sans-serif;
      }
    `;
  }, [displayFont, bodyFont]);

  if (mode === "preview") {
    return (
      <div className="min-h-screen bg-white">
        {/* Preview exit button */}
        <div className="fixed top-4 right-4 z-50">
          <button
            onClick={() => useEditorStore.getState().setMode("editor")}
            className="px-4 py-2 bg-[#1b3a2d] text-white text-sm font-medium rounded-xl shadow-xl hover:bg-[#2d5a40] transition"
          >
            ← Back to editor
          </button>
        </div>
        <div className="proposal-canvas">
          <ProposalCanvas />
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <EditorToolbar />

      <div className="flex flex-1 min-h-0 relative">
        {/* Left sidebar — collapsible */}
        {leftPanelOpen && <LeftSidebar />}

        {/* Left panel toggle */}
        <button
          onClick={toggleLeftPanel}
          className={`absolute z-40 top-3 flex items-center justify-center w-6 h-6 rounded-full bg-white border border-black/10 shadow-sm text-black/40 hover:text-black/70 hover:bg-black/5 text-[10px] transition-all duration-200 ${
            leftPanelOpen ? "left-[196px]" : "left-2"
          }`}
          title={leftPanelOpen ? "Collapse sidebar" : "Expand sidebar"}
        >
          {leftPanelOpen ? "◂" : "▸"}
        </button>

        <div className="flex-1 min-w-0 flex flex-col proposal-canvas">
          <ProposalCanvas />
        </div>

        {/* Right panel toggle */}
        <button
          onClick={toggleRightPanel}
          className={`absolute z-40 top-3 flex items-center justify-center w-6 h-6 rounded-full bg-white border border-black/10 shadow-sm text-black/40 hover:text-black/70 hover:bg-black/5 text-[10px] transition-all duration-200 ${
            rightPanelOpen ? "right-[276px]" : "right-2"
          }`}
          title={rightPanelOpen ? "Collapse panel" : "Expand panel"}
        >
          {rightPanelOpen ? "▸" : "◂"}
        </button>

        {/* Right context panel — collapsible */}
        {rightPanelOpen && <ContextPanel />}
      </div>

      {/* Floating inline text toolbar */}
      <InlineTextToolbar />

      {/* Floating color picker (direct manipulation) */}
      <FloatingColorPicker />

      {/* New Proposal dialog */}
      <NewProposalDialog />
    </div>
  );
}
