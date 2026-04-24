"use client";

import { useEffect, useState } from "react";
import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import { ProposalCanvas } from "@/components/editor/ProposalCanvas";
import { buildProposalFromTemplate } from "@/lib/templates";
import type { Template } from "@/lib/templates/types";

// ─── TemplateRenderer ──────────────────────────────────────────────────────
//
// Client-side entry point for a public template page. Builds a Proposal
// from the given Template (preview mode — example client populated, demo
// operator block), hydrates the proposal store, pins the editor into
// preview mode, and renders the real ProposalCanvas.
//
// A short "hydrating" placeholder avoids a flash of the store's previous
// contents (e.g. the user's own WIP proposal from /studio) while we
// replace it.

export function TemplateRenderer({ template }: { template: Template }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const prevMode = useEditorStore.getState().mode;
    useEditorStore.getState().setMode("preview");

    const proposal = buildProposalFromTemplate(template, { mode: "preview" });
    useProposalStore.getState().hydrateProposal(proposal);
    setReady(true);

    return () => {
      useEditorStore.getState().setMode(prevMode);
    };
  }, [template]);

  if (!ready) {
    return (
      <div className="h-[50vh] flex items-center justify-center text-black/45">
        <div className="text-sm">Loading template…</div>
      </div>
    );
  }

  return (
    <div className="proposal-canvas">
      <ProposalCanvas />
    </div>
  );
}
