"use client";

import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import { resolveTokens } from "@/lib/theme";
import type { Section } from "@/lib/types";

// Route map — editorial timeline rather than an iframe placeholder. Reads
// the trip's destinations (or derives from days) and renders them as a
// horizontal sequence of stops connected by a forest hairline.
//
// We intentionally moved away from a Google Maps embed: a luxury safari
// brochure rarely benefits from a satellite map and most operators don't
// want the hostname leaking into their proposal. The timeline reads as
// "this is the journey shape" without competing visually.

export function MapSection({ section }: { section: Section }) {
  const { proposal, updateSectionContent } = useProposalStore();
  const { mode } = useEditorStore();
  const isEditor = mode === "editor";
  const { theme, days, trip } = proposal;
  const tokens = resolveTokens(theme.tokens, section.styleOverrides);
  const caption = (section.content.caption as string | undefined) ?? "";

  // Prefer destinations as they actually appear in the day-by-day list —
  // that's the real route. Fall back to the trip-level destinations if the
  // operator hasn't built days yet.
  const stopsFromDays = days
    .slice()
    .sort((a, b) => a.dayNumber - b.dayNumber)
    .map((d) => d.destination)
    .filter((s, i, arr) => i === 0 || s !== arr[i - 1]);  // collapse consecutive dupes
  const stops = stopsFromDays.length > 0 ? stopsFromDays : trip.destinations;

  return (
    <div className="px-6 md:px-16 py-20 md:py-24" style={{ background: tokens.sectionSurface }}>
      <div className="max-w-5xl mx-auto">
        <div
          className="text-[10px] uppercase tracking-[0.3em] mb-3 text-center font-semibold"
          style={{ color: tokens.mutedText }}
        >
          The route
        </div>
        <h2
          className="text-[1.8rem] md:text-[2.2rem] font-bold tracking-tight text-center mb-12"
          style={{ color: tokens.headingText, fontFamily: `'${theme.displayFont}', serif` }}
        >
          {stops.length > 1 ? `${stops[0]} to ${stops[stops.length - 1]}` : stops[0] ?? "Your journey"}
        </h2>

        {/* Timeline */}
        {stops.length > 0 ? (
          <div className="relative pt-8">
            {/* Connector hairline */}
            <div
              className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px"
              style={{ background: `${tokens.accent}55`, marginTop: "0.5rem" }}
            />
            <div className="relative grid items-start" style={{ gridTemplateColumns: `repeat(${stops.length}, minmax(0, 1fr))` }}>
              {stops.map((stop, i) => (
                <div key={`${stop}-${i}`} className="flex flex-col items-center text-center px-2">
                  {/* Stop dot */}
                  <div
                    className="w-3 h-3 rounded-full mb-3 shrink-0 relative z-10"
                    style={{ background: tokens.accent, boxShadow: `0 0 0 4px ${tokens.sectionSurface}` }}
                    aria-hidden
                  />
                  {/* Number */}
                  <div
                    className="text-[10px] uppercase tracking-[0.22em] mb-1 font-semibold"
                    style={{ color: tokens.mutedText }}
                  >
                    Stop {i + 1}
                  </div>
                  {/* Stop name */}
                  <div
                    className="text-[14px] md:text-[15px] font-semibold leading-tight"
                    style={{ color: tokens.headingText, fontFamily: `'${theme.displayFont}', serif` }}
                  >
                    {stop}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center text-sm py-8" style={{ color: tokens.mutedText }}>
            {isEditor ? "Add days to draw the route." : "Route coming soon."}
          </div>
        )}

        {/* Caption — editable */}
        {(caption || isEditor) && (
          <p
            className="mt-12 text-sm text-center outline-none italic"
            style={{ color: tokens.mutedText, fontFamily: `'${theme.displayFont}', serif` }}
            contentEditable={isEditor}
            suppressContentEditableWarning
            onBlur={(e) => updateSectionContent(section.id, { caption: e.currentTarget.textContent ?? "" })}
            data-placeholder={isEditor && !caption ? "Add a caption…" : undefined}
          >
            {caption || (isEditor ? "Add a caption…" : "")}
          </p>
        )}
      </div>
    </div>
  );
}
