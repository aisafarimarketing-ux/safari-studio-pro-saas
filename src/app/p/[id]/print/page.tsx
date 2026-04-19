"use client";

import { useEffect, useState, use } from "react";
import { useProposalStore } from "@/store/proposalStore";
import { SectionRenderer } from "@/components/editor/SectionRenderer";
import type { Proposal, Section } from "@/lib/types";

// Chrome-free render of a public proposal — same content as /p/[id] but
// without the share header, comment panel, or view tracker. The Playwright
// PDF renderer hits this URL and a "ready" signal (window.__SS_READY__)
// is set once the proposal is loaded so the renderer knows when to capture.

export default function PrintProposalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { proposal } = useProposalStore();
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          useProposalStore.getState().hydrateProposal(content);
          setLoaded(true);
          // Ready flag for the headless PDF renderer.
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              (window as unknown as { __SS_READY__?: boolean }).__SS_READY__ = true;
            });
          });
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Load failed");
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-2xl font-semibold text-black/70">{error}</div>
      </div>
    );
  }

  if (!loaded) {
    return <div className="min-h-screen" />;
  }

  const { theme, operator } = proposal;
  const sorted = [...proposal.sections]
    .filter((s: Section) => s.visible)
    .sort((a: Section, b: Section) => a.order - b.order);

  return (
    <div className="proposal-canvas ss-print-mode" style={{ background: theme.tokens.pageBg }}>
      <style>{`
        .proposal-canvas {
          --font-display: '${theme.displayFont}', Georgia, serif;
          --font-body: '${theme.bodyFont}', system-ui, sans-serif;
        }
        /* Print-mode styling — applies even on screen so the PDF renderer
           captures a clean A4-paginated document. */
        html, body {
          background: ${theme.tokens.pageBg};
          margin: 0;
          padding: 0;
        }
        .ss-print-mode {
          width: 210mm;
          margin: 0 auto;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .ss-print-mode [data-editor-chrome],
        .ss-print-mode .editor-toolbar,
        .ss-print-mode .editor-sidebar,
        .ss-print-mode .context-panel {
          display: none !important;
        }
      `}</style>

      <div style={{ background: theme.tokens.pageBg }}>
        {sorted.map((section: Section) => (
          <SectionRenderer key={section.id} section={section} />
        ))}
      </div>

      {operator.companyName && (
        <footer
          className="border-t py-6 px-6 text-center"
          style={{ background: theme.tokens.pageBg, borderColor: theme.tokens.border }}
        >
          <div className="text-xs tracking-wide" style={{ color: theme.tokens.mutedText }}>
            Proposal by{" "}
            <span style={{ color: theme.tokens.bodyText, fontWeight: 500 }}>
              {operator.companyName}
            </span>
            {operator.email && (
              <>
                {" "}&middot;{" "}
                <span style={{ color: theme.tokens.accent }}>{operator.email}</span>
              </>
            )}
            {operator.phone && <> &middot; {operator.phone}</>}
          </div>
        </footer>
      )}
    </div>
  );
}
