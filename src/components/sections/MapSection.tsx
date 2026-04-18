"use client";

import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import { resolveTokens } from "@/lib/theme";
import type { Section } from "@/lib/types";

// Route timeline — editorial type scale.

export function MapSection({ section }: { section: Section }) {
  const { proposal, updateSectionContent } = useProposalStore();
  const { mode } = useEditorStore();
  const isEditor = mode === "editor";
  const { theme, days, trip } = proposal;
  const tokens = resolveTokens(theme.tokens, section.styleOverrides);
  const caption = (section.content.caption as string | undefined) ?? "";

  const stopsFromDays = days
    .slice()
    .sort((a, b) => a.dayNumber - b.dayNumber)
    .map((d) => d.destination)
    .filter((s, i, arr) => i === 0 || s !== arr[i - 1]);
  const stops = stopsFromDays.length > 0 ? stopsFromDays : trip.destinations;

  return (
    <div className="py-24" style={{ background: tokens.sectionSurface }}>
      <div className="ed-wide">
        <div
          className="text-label ed-label text-center mb-3"
          style={{ color: tokens.mutedText }}
        >
          The route
        </div>
        <h2
          className="text-h2 font-bold text-center mb-16"
          style={{ color: tokens.headingText, fontFamily: `'${theme.displayFont}', serif` }}
        >
          {stops.length > 1 ? `${stops[0]} to ${stops[stops.length - 1]}` : stops[0] ?? "Your journey"}
        </h2>

        {stops.length > 0 ? (
          <div className="relative pt-8">
            {/* Connector hairline */}
            <div
              className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px"
              style={{ background: `${tokens.accent}55`, marginTop: "0.5rem" }}
            />
            <div
              className="relative grid items-start"
              style={{ gridTemplateColumns: `repeat(${stops.length}, minmax(0, 1fr))` }}
            >
              {stops.map((stop, i) => (
                <div key={`${stop}-${i}`} className="flex flex-col items-center text-center px-2">
                  <div
                    className="w-3 h-3 rounded-full mb-3 shrink-0 relative z-10"
                    style={{ background: tokens.accent, boxShadow: `0 0 0 4px ${tokens.sectionSurface}` }}
                    aria-hidden
                  />
                  <div
                    className="text-label ed-label mb-1"
                    style={{ color: tokens.mutedText }}
                  >
                    Stop {i + 1}
                  </div>
                  <div
                    className="text-small font-semibold"
                    style={{ color: tokens.headingText, fontFamily: `'${theme.displayFont}', serif` }}
                  >
                    {stop}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-small text-center py-8" style={{ color: tokens.mutedText }}>
            {isEditor ? "Add days to draw the route." : "Route coming soon."}
          </div>
        )}

        {(caption || isEditor) && (
          <p
            className="text-small italic text-center mt-12 outline-none"
            style={{ color: tokens.mutedText, fontFamily: `'${theme.displayFont}', serif` }}
            contentEditable={isEditor}
            suppressContentEditableWarning
            onBlur={(e) => updateSectionContent(section.id, { caption: e.currentTarget.textContent ?? "" })}
          >
            {caption || (isEditor ? "Add a caption…" : "")}
          </p>
        )}
      </div>
    </div>
  );
}
