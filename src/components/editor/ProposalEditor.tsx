"use client";

import { useEffect } from "react";
import { useEditorStore } from "@/store/editorStore";
import { useProposalStore } from "@/store/proposalStore";
import { buildGoogleFontsUrl } from "@/lib/theme";
import { EditorToolbar } from "./EditorToolbar";
import { LeftSidebar } from "./LeftSidebar";
import { ProposalCanvas } from "./ProposalCanvas";
import { ContextPanel } from "./ContextPanel";
import { NewProposalDialog } from "@/components/ui/NewProposalDialog";
import { InlineTextToolbar } from "@/components/ui/InlineTextToolbar";

export function ProposalEditor() {
  const { mode } = useEditorStore();
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

      <div className="flex flex-1 min-h-0">
        <LeftSidebar />

        <div className="flex-1 min-w-0 proposal-canvas">
          <ProposalCanvas />
        </div>

        <ContextPanel />
      </div>

      {/* Floating inline text toolbar */}
      <InlineTextToolbar />

      {/* New Proposal dialog */}
      <NewProposalDialog />
    </div>
  );
}
