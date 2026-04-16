"use client";

import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import { resolveTokens } from "@/lib/theme";
import type { Section } from "@/lib/types";

export function MapSection({ section }: { section: Section }) {
  const { proposal, updateSectionContent } = useProposalStore();
  const { mode } = useEditorStore();
  const isEditor = mode === "editor";
  const { theme } = proposal;
  const tokens = resolveTokens(theme.tokens, section.styleOverrides);
  const embedUrl = section.content.embedUrl as string;
  const caption = section.content.caption as string;
  const isFullWidth = section.layoutVariant === "full-width";

  return (
    <div className="py-16 px-8 md:px-16" style={{ background: tokens.sectionSurface }}>
      <div className={`${isFullWidth ? "w-full" : "max-w-5xl mx-auto"}`}>
        <div
          className="rounded-2xl overflow-hidden border"
          style={{ borderColor: tokens.border }}
        >
          {embedUrl ? (
            <iframe
              src={embedUrl}
              className="w-full h-[400px]"
              loading="lazy"
              title="Safari Route Map"
            />
          ) : (
            <div
              className="w-full h-[400px] flex flex-col items-center justify-center"
              style={{ background: tokens.cardBg }}
            >
              <div className="text-4xl mb-3 opacity-30">◎</div>
              <div className="text-sm font-medium mb-1" style={{ color: tokens.headingText }}>
                Route Map
              </div>
              <div className="text-xs mb-4" style={{ color: tokens.mutedText }}>
                {isEditor ? "Paste a Google Maps embed URL in the panel →" : "Map coming soon"}
              </div>
              {/* Route dots placeholder */}
              <div className="flex items-center gap-2">
                {(proposal.trip.destinations.length > 0
                  ? proposal.trip.destinations
                  : ["Nairobi", "Masai Mara", "Amboseli"]
                ).map((d, i, arr) => (
                  <div key={d} className="flex items-center gap-2">
                    <span
                      className="text-xs font-medium px-2 py-1 rounded-full"
                      style={{ background: tokens.accent, color: "white" }}
                    >
                      {d}
                    </span>
                    {i < arr.length - 1 && (
                      <span style={{ color: tokens.mutedText }}>→</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {caption && (
          <p
            className="mt-3 text-sm text-center outline-none"
            style={{ color: tokens.mutedText }}
            contentEditable={isEditor}
            suppressContentEditableWarning
            onBlur={(e) => updateSectionContent(section.id, { caption: e.currentTarget.textContent ?? "" })}
          >
            {caption}
          </p>
        )}
      </div>
    </div>
  );
}
