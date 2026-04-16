"use client";

import { useEffect, useState } from "react";
import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import { SectionRenderer } from "@/components/editor/SectionRenderer";
import type { Section } from "@/lib/types";

export default function ClientProposalPage() {
  const { proposal } = useProposalStore();
  const { setMode } = useEditorStore();
  const [mounted, setMounted] = useState(false);

  // Force preview mode — no editor UI
  useEffect(() => {
    setMode("preview");
    setMounted(true);
  }, [setMode]);

  if (!mounted) return null;

  const { theme, operator } = proposal;
  const sorted = [...proposal.sections]
    .filter((s: Section) => s.visible)
    .sort((a: Section, b: Section) => a.order - b.order);

  return (
    <div className="min-h-screen proposal-canvas" style={{ background: theme.tokens.pageBg }}>
      {/* Dynamic font injection */}
      <style>{`
        .proposal-canvas {
          --font-display: '${theme.displayFont}', Georgia, serif;
          --font-body: '${theme.bodyFont}', system-ui, sans-serif;
        }
      `}</style>

      {/* Clean proposal document */}
      <div className="max-w-[900px] mx-auto" style={{ background: theme.tokens.pageBg }}>
        {sorted.map((section: Section) => (
          <SectionRenderer key={section.id} section={section} />
        ))}
      </div>

      {/* Optional operator footer */}
      {operator.companyName && (
        <footer
          className="border-t py-8 px-6 text-center"
          style={{
            background: theme.tokens.pageBg,
            borderColor: theme.tokens.border,
          }}
        >
          <div
            className="text-xs tracking-wide"
            style={{ color: theme.tokens.mutedText }}
          >
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
            {operator.phone && (
              <>
                {" "}
                &middot; {operator.phone}
              </>
            )}
          </div>
          {operator.website && (
            <div
              className="text-[11px] mt-1"
              style={{ color: theme.tokens.mutedText }}
            >
              {operator.website}
            </div>
          )}
        </footer>
      )}
    </div>
  );
}
