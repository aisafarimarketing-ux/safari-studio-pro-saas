"use client";

import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import type { Section } from "@/lib/types";

const HEIGHTS: Record<string, number> = { sm: 40, md: 80, lg: 120, xl: 200 };

export function SpacerSection({ section }: { section: Section }) {
  const { proposal } = useProposalStore();
  const { mode } = useEditorStore();
  const isEditor = mode === "editor";
  const tokens = proposal.theme.tokens;
  const height = HEIGHTS[section.layoutVariant] ?? 80;

  return (
    <div
      className={`relative ${isEditor ? "border-y border-dashed" : ""}`}
      style={{
        height,
        background: tokens.pageBg,
        borderColor: isEditor ? tokens.border : "transparent",
      }}
    >
      {isEditor && (
        <div className="absolute inset-0 flex items-center justify-center text-xs" style={{ color: tokens.mutedText }}>
          Spacer · {section.layoutVariant}
        </div>
      )}
    </div>
  );
}
