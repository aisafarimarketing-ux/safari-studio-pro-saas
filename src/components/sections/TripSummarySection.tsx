"use client";

import { useProposalStore } from "@/store/proposalStore";
import { resolveTokens } from "@/lib/theme";
import type { Section } from "@/lib/types";

// "At a glance" — 4-card editorial grid, on the strict editorial type scale.

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
    <div className="py-6 md:py-8" style={{ background: tokens.pageBg }}>
      <div className="ed-wide">
        <div
          className="text-label ed-label text-center mb-12"
          style={{ color: tokens.mutedText }}
        >
          At a glance
        </div>

        <div
          className="grid grid-cols-2 md:grid-cols-4 gap-px overflow-hidden"
          style={{ background: tokens.border }}
        >
          {cards.map((card) => (
            <div
              key={card.label}
              className="px-8 py-8 text-center"
              style={{ background: tokens.sectionSurface }}
            >
              <div
                className="text-label ed-label mb-3"
                style={{ color: tokens.mutedText }}
              >
                {card.label}
              </div>
              <div
                className="text-h3 font-semibold"
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
