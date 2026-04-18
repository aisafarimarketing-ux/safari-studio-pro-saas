"use client";

import { useEffect, useState } from "react";
import { useEditorStore } from "@/store/editorStore";
import { useProposalStore } from "@/store/proposalStore";
import { EditorToolbar } from "./EditorToolbar";
import { EditorDayNav } from "./EditorDayNav";
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
  const [hydrated, setHydrated] = useState(false);

  // On mount, try to restore the last-saved proposal for this user.
  // 1) If localStorage has activeProposalId, fetch it.
  // 2) Otherwise list the user's proposals and pick the newest.
  // Falls through to the default proposal if none exist.
  useEffect(() => {
    let cancelled = false;

    async function loadOne(id: string) {
      const res = await fetch(`/api/proposals/${id}`);
      if (res.status === 409) { window.location.href = "/select-organization"; return false; }
      if (res.status === 404 || res.status === 403) {
        localStorage.removeItem("activeProposalId");
        return false;
      }
      if (!res.ok) return false;
      const data = await res.json();
      const content = data?.proposal?.contentJson;
      if (content && typeof content === "object" && !cancelled) {
        useProposalStore.getState().hydrateProposal(content as typeof proposal);
        return true;
      }
      return false;
    }

    (async () => {
      try {
        const stored = localStorage.getItem("activeProposalId");
        if (stored && (await loadOne(stored))) return;

        const list = await fetch("/api/proposals");
        if (list.status === 409) { window.location.href = "/select-organization"; return; }
        if (!list.ok) return;
        const { proposals } = await list.json();
        const latest = Array.isArray(proposals) && proposals[0]?.id;
        if (latest) {
          localStorage.setItem("activeProposalId", latest);
          await loadOne(latest);
        }
      } catch (err) {
        console.warn("[ProposalEditor] load failed:", err);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Block first paint until the DB load settles — avoids flashing the default proposal.
  if (!hydrated) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#f8f5ef] text-black/50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-black/15 border-t-[#1b3a2d] animate-spin" />
          <div className="text-sm tracking-wide">Loading proposal…</div>
        </div>
      </div>
    );
  }

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
          <EditorDayNav />
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
