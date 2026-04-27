"use client";

import { useEffect, useState, use } from "react";
import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import { SectionRenderer } from "@/components/editor/SectionRenderer";
import { CommentPanel } from "@/components/proposal-share/CommentPanel";
import { ShareViewHeader } from "@/components/proposal-share/ShareViewHeader";
import { ViewTracker } from "@/components/proposal-share/ViewTracker";
import { DepositPayButton } from "@/components/proposal-share/DepositPayButton";
import type { Proposal, Section } from "@/lib/types";

export default function ClientProposalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { proposal } = useProposalStore();
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Share view is strictly client-facing — force the editor store into
  // "preview" mode on mount and clamp it back every render. The store
  // defaults to "editor" (used by the /proposals editor), which means
  // every isEditor check across every section leaks editor chrome into
  // the public page unless we reset it here. Also re-clamp on every
  // render so any in-page code that accidentally flips mode back can't
  // silently re-expose editor controls to a guest.
  useEffect(() => {
    const { setMode } = useEditorStore.getState();
    setMode("preview");
    const unsub = useEditorStore.subscribe((state) => {
      if (state.mode !== "preview") state.setMode("preview");
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/public/proposals/${id}`);
        if (res.status === 404) {
          if (!cancelled) setError("Proposal not found");
          return;
        }
        if (!res.ok) {
          if (!cancelled) setError(`Error ${res.status}`);
          return;
        }
        const data = await res.json();
        const content = data?.proposal?.contentJson as Proposal | undefined;
        if (!cancelled && content) {
          // Hydrate the global store so section components can read it.
          useProposalStore.getState().hydrateProposal(content);
          setLoaded(true);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Load failed");
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f5ef]">
        <div className="text-center">
          <div className="text-2xl font-semibold text-black/70 mb-2">{error}</div>
          <div className="text-sm text-black/45">This proposal link may have expired or been removed.</div>
        </div>
      </div>
    );
  }

  if (!loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f5ef] text-black/50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-black/15 border-t-[#1b3a2d] animate-spin" />
          <div className="text-sm tracking-wide">Loading proposal…</div>
        </div>
      </div>
    );
  }

  const { theme, operator } = proposal;
  const sorted = [...proposal.sections]
    .filter((s: Section) => s.visible)
    .sort((a: Section, b: Section) => a.order - b.order);

  return (
    <div className="min-h-screen proposal-canvas" style={{ background: theme.tokens.pageBg }}>
      <style>{`
        .proposal-canvas {
          --font-display: '${theme.displayFont}', Georgia, serif;
          --font-body: '${theme.bodyFont}', system-ui, sans-serif;
        }
      `}</style>

      <ShareViewHeader proposal={proposal} />

      <div
        className="max-w-[900px] mx-auto space-y-6 md:space-y-8"
        style={{ background: theme.tokens.pageBg }}
      >
        {sorted.map((section: Section) => (
          <SectionRenderer key={section.id} section={section} />
        ))}
      </div>

      {proposal.depositConfig?.enabled && (
        <DepositPayButton
          proposalId={id}
          config={proposal.depositConfig}
          accent={theme.tokens.accent}
        />
      )}

      {operator.companyName && (
        <footer
          className="border-t py-8 px-6 text-center"
          style={{ background: theme.tokens.pageBg, borderColor: theme.tokens.border }}
        >
          <div className="text-xs tracking-wide" style={{ color: theme.tokens.mutedText }}>
            Proposal by{" "}
            <span style={{ color: theme.tokens.bodyText, fontWeight: 500 }}>
              {operator.companyName}
            </span>
            {operator.email && (
              <>
                {" "}
                &middot;{" "}
                <a
                  href={`mailto:${operator.email}`}
                  style={{ color: theme.tokens.accent }}
                  className="hover:underline"
                >
                  {operator.email}
                </a>
              </>
            )}
            {operator.phone && <> &middot; {operator.phone}</>}
          </div>
          {operator.website && (
            <div className="text-[11px] mt-1" style={{ color: theme.tokens.mutedText }}>
              {operator.website}
            </div>
          )}
        </footer>
      )}

      <CommentPanel proposalId={id} />
      <ViewTracker proposalId={id} />
    </div>
  );
}
