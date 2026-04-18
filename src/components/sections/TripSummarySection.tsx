"use client";

import { useProposalStore } from "@/store/proposalStore";
import { resolveTokens } from "@/lib/theme";
import type { Section } from "@/lib/types";

// "At a glance" — the 4-card editorial grid. The brief is explicit:
// duration / destinations / guests / style. We render each in the same
// hierarchy: tiny label, then a one-line value in display font.

export function TripSummarySection({ section }: { section: Section }) {
  const { proposal } = useProposalStore();
  const { client, trip, theme, days } = proposal;
  const tokens = resolveTokens(theme.tokens, section.styleOverrides);

  const destinations = [...new Set(days.map((d) => d.destination))];
  const destinationsLine = destinations.length
    ? destinations.join(" · ")
    : trip.destinations.join(" · ");
  const duration = trip.nights
    ? `${trip.nights} nights`
    : days.length
      ? `${days.length} nights`
      : trip.dates;

  const cards: { label: string; value: string }[] = [
    { label: "Duration", value: duration || "—" },
    { label: "Destinations", value: destinationsLine || "—" },
    { label: "Guests", value: client.guestNames || "—" },
    { label: "Style", value: trip.tripStyle || trip.subtitle || "—" },
  ];

  return (
    <div className="px-8 md:px-16 py-20 md:py-24" style={{ background: tokens.pageBg }}>
      <div className="max-w-5xl mx-auto">
        {/* Section label */}
        <div
          className="text-[10px] uppercase tracking-[0.3em] mb-10 font-semibold text-center"
          style={{ color: tokens.mutedText }}
        >
          At a glance
        </div>

        {/* Four-card grid — borderless, generous spacing, faint dividers */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px overflow-hidden"
          style={{ background: tokens.border }}
        >
          {cards.map((card) => (
            <div
              key={card.label}
              className="px-6 md:px-8 py-8 text-center"
              style={{ background: tokens.sectionSurface }}
            >
              <div
                className="text-[9px] uppercase tracking-[0.28em] mb-3 font-semibold"
                style={{ color: tokens.mutedText }}
              >
                {card.label}
              </div>
              <div
                className="text-[1.1rem] md:text-[1.2rem] font-semibold leading-snug"
                style={{
                  color: tokens.headingText,
                  fontFamily: `'${theme.displayFont}', serif`,
                }}
              >
                {card.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
