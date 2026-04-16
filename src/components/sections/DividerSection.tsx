"use client";

import { useProposalStore } from "@/store/proposalStore";
import type { Section } from "@/lib/types";

export function DividerSection({ section }: { section: Section }) {
  const { proposal } = useProposalStore();
  const tokens = proposal.theme.tokens;

  if (section.layoutVariant === "ornamental") {
    return (
      <div className="py-8 flex items-center justify-center gap-4" style={{ background: tokens.sectionSurface }}>
        <div className="h-px flex-1 max-w-32" style={{ background: tokens.border }} />
        <span className="text-lg" style={{ color: tokens.secondaryAccent }}>✦</span>
        <div className="h-px flex-1 max-w-32" style={{ background: tokens.border }} />
      </div>
    );
  }
  if (section.layoutVariant === "spacious") {
    return (
      <div className="py-12 px-8 md:px-16" style={{ background: tokens.sectionSurface }}>
        <div className="max-w-5xl mx-auto h-px" style={{ background: tokens.border }} />
      </div>
    );
  }
  return (
    <div className="py-6 px-8 md:px-16" style={{ background: tokens.sectionSurface }}>
      <div className="max-w-5xl mx-auto h-px" style={{ background: tokens.border }} />
    </div>
  );
}
