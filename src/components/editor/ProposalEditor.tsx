"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useEditorStore } from "@/store/editorStore";
import { useProposalStore } from "@/store/proposalStore";
import { EditorToolbar } from "./EditorToolbar";
import { LeftSidebar, CollapsedSidebarRail } from "./LeftSidebar";
import { ProposalCanvas } from "./ProposalCanvas";
import { AISelectionToolbar } from "./AISelectionToolbar";
import { ContextPanel } from "./ContextPanel";
import { useAutoSaveProposal } from "./useAutoSaveProposal";
import { NewProposalDialog } from "@/components/ui/NewProposalDialog";
import { InlineTextToolbar } from "@/components/ui/InlineTextToolbar";
import { FloatingColorPicker } from "@/components/ui/FloatingColorPicker";

type LoadOutcome =
  | { kind: "loaded" }
  | { kind: "empty" }                   // user has no proposals, show fresh template
  | { kind: "notFound"; staleId: string }
  | { kind: "forbidden"; staleId: string }
  | { kind: "error"; message: string };

export function ProposalEditor() {
  const { mode, leftPanelOpen, rightPanelOpen, toggleLeftPanel, toggleRightPanel } = useEditorStore();
  const { proposal } = useProposalStore();
  const { displayFont, bodyFont } = proposal.theme;
  const [outcome, setOutcome] = useState<LoadOutcome | null>(null);

  // Auto-save once loaded. Debounces proposal-store changes by 800ms.
  const autoSave = useAutoSaveProposal(outcome?.kind === "loaded");

  // On mount, try to restore the last-saved proposal for this user.
  // 1) If localStorage has activeProposalId, fetch it.
  // 2) Otherwise list the user's proposals and pick the newest.
  // 3) Otherwise: show an empty state that links to /dashboard → Trip Setup.
  //
  // Notable outcomes that now surface visibly instead of silently falling
  // back onto the default template (which caused "phantom proposal" edits):
  //   notFound   — the stored id no longer exists. Show a clear message.
  //   forbidden  — the user can't see it (different org etc.). Same.
  //   error      — network or server error. Offer retry.
  useEffect(() => {
    let cancelled = false;

    async function loadOne(id: string): Promise<LoadOutcome> {
      const res = await fetch(`/api/proposals/${id}`);
      if (res.status === 409) { window.location.href = "/select-organization"; return { kind: "error", message: "Redirecting…" }; }
      if (res.status === 404) {
        localStorage.removeItem("activeProposalId");
        return { kind: "notFound", staleId: id };
      }
      if (res.status === 403) {
        localStorage.removeItem("activeProposalId");
        return { kind: "forbidden", staleId: id };
      }
      if (!res.ok) return { kind: "error", message: `HTTP ${res.status}` };

      const data = await res.json().catch(() => ({}));
      const content = data?.proposal?.contentJson;
      if (content && typeof content === "object" && !cancelled) {
        useProposalStore.getState().hydrateProposal(content as typeof proposal);
        return { kind: "loaded" };
      }
      return { kind: "error", message: "Invalid proposal payload" };
    }

    (async () => {
      try {
        const stored = localStorage.getItem("activeProposalId");
        if (stored) {
          const result = await loadOne(stored);
          if (result.kind === "loaded") {
            if (!cancelled) setOutcome(result);
            return;
          }
          // If the stored id failed, surface the specific failure — don't
          // silently fall through to someone else's most-recent proposal.
          if (!cancelled) setOutcome(result);
          return;
        }

        // No stored id — try the user's most recent proposal.
        const list = await fetch("/api/proposals");
        if (list.status === 409) { window.location.href = "/select-organization"; return; }
        if (!list.ok) {
          if (!cancelled) setOutcome({ kind: "error", message: `Couldn't load proposals (${list.status})` });
          return;
        }
        const { proposals } = await list.json();
        const latest = Array.isArray(proposals) && proposals[0]?.id;
        if (latest) {
          localStorage.setItem("activeProposalId", latest);
          const result = await loadOne(latest);
          if (!cancelled) setOutcome(result);
          return;
        }
        // User genuinely has no proposals — land them on a helpful empty state.
        if (!cancelled) setOutcome({ kind: "empty" });
      } catch (err) {
        console.warn("[ProposalEditor] load failed:", err);
        if (!cancelled) {
          setOutcome({
            kind: "error",
            message: err instanceof Error ? err.message : "Load failed",
          });
        }
      }
    })();

    return () => { cancelled = true; };
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
  if (outcome === null) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#f8f5ef] text-black/50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-black/15 border-t-[#1b3a2d] animate-spin" />
          <div className="text-sm tracking-wide">Loading proposal…</div>
        </div>
      </div>
    );
  }

  // Recoverable error states — no silent fallback onto the default template.
  if (outcome.kind === "notFound" || outcome.kind === "forbidden") {
    const title = outcome.kind === "notFound" ? "Proposal not found" : "No access to this proposal";
    const body =
      outcome.kind === "notFound"
        ? "This proposal doesn't exist — it may have been deleted. If you were mid-edit and this surprises you, please report it with the id below."
        : "Your current organization doesn't have access to this proposal. Switch organizations from the user menu, or open one of your own proposals.";
    return (
      <StudioFallback title={title} body={body} staleId={outcome.staleId} />
    );
  }

  if (outcome.kind === "error") {
    return (
      <StudioFallback
        title="Couldn't load proposal"
        body={outcome.message}
        actionHref="/studio"
        actionLabel="Retry"
      />
    );
  }

  if (outcome.kind === "empty") {
    return (
      <StudioFallback
        title="No proposals yet"
        body="Start a proposal from the dashboard — Trip Setup captures the essentials in 30 seconds."
        actionHref="/dashboard"
        actionLabel="Open dashboard"
      />
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
      <EditorToolbar
        autoSaveState={autoSave.state}
        autoSaveError={autoSave.error}
        lastSavedAt={autoSave.lastSavedAt}
      />

      <div className="flex flex-1 min-h-0 relative">
        {/* Left sidebar — full when leftPanelOpen, collapsed icon rail
            otherwise. The rail keeps section navigation reachable in
            Edit / Style modes without breaking the canvas-first feel.
            Click any rail icon to jump to that section; click the rail
            header to expand into Structure mode for reordering. */}
        {leftPanelOpen ? <LeftSidebar /> : <CollapsedSidebarRail />}

        {/* Left panel toggle — escape hatch alongside the toolbar's
            Edit / Structure / Style switch. Useful for power users
            who want to keep Edit-view chrome but hide the rail
            entirely (e.g., screen-share). */}
        <button
          onClick={toggleLeftPanel}
          className={`absolute z-40 top-3 flex items-center justify-center w-6 h-6 rounded-full bg-white border border-black/10 shadow-sm text-black/40 hover:text-black/70 hover:bg-black/5 text-[10px] transition-all duration-200 ${
            leftPanelOpen ? "left-[212px]" : "left-[44px]"
          }`}
          title={leftPanelOpen ? "Collapse sidebar" : "Expand sidebar"}
        >
          {leftPanelOpen ? "◂" : "▸"}
        </button>

        <div className="flex-1 min-w-0 flex flex-col proposal-canvas">
          <ProposalCanvas />
          <AISelectionToolbar />
        </div>

        {/* Right panel toggle */}
        <button
          onClick={toggleRightPanel}
          className={`absolute z-40 top-3 flex items-center justify-center w-6 h-6 rounded-full bg-white border border-black/10 shadow-sm text-black/40 hover:text-black/70 hover:bg-black/5 text-[10px] transition-all duration-200 ${
            rightPanelOpen ? "right-[308px]" : "right-2"
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

// ─── Fallback screens ─────────────────────────────────────────────────────
//
// Shown when the editor can't load a proposal. Always informative,
// always gives a way out — no "ghost proposal" editing experience.

function StudioFallback({
  title,
  body,
  staleId,
  actionHref = "/proposals",
  actionLabel = "Open proposals",
}: {
  title: string;
  body: string;
  staleId?: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="h-screen flex items-center justify-center bg-[#f8f5ef] px-6">
      <div className="max-w-md w-full text-center">
        <div
          className="w-12 h-12 mx-auto rounded-2xl flex items-center justify-center text-[#c9a84c] text-xl font-bold mb-5"
          style={{ background: "rgba(201,168,76,0.15)" }}
        >
          !
        </div>
        <h1 className="text-h2 font-bold tracking-tight text-black/85">{title}</h1>
        <p className="mt-3 text-body text-black/55">{body}</p>
        {staleId && (
          <p className="mt-3 text-label text-black/35 font-mono" style={{ textTransform: "none", letterSpacing: "0", fontWeight: 400 }}>
            id: {staleId}
          </p>
        )}
        <div className="mt-8 flex items-center justify-center gap-2">
          <Link
            href="/dashboard"
            className="px-4 py-2 text-small rounded-lg border border-black/12 text-black/65 hover:bg-black/5 transition"
          >
            ← Dashboard
          </Link>
          <Link
            href={actionHref}
            className="px-4 py-2 text-small rounded-lg bg-[#1b3a2d] text-white font-semibold hover:bg-[#2d5a40] active:scale-95 transition"
          >
            {actionLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}
