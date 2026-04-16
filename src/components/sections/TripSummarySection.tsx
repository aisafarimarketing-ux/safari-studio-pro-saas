"use client";

import { useProposalStore } from "@/store/proposalStore";
import type { Section } from "@/lib/types";

export function TripSummarySection({ section: _section }: { section: Section }) {
  const { proposal } = useProposalStore();
  const { client, trip, theme, days, pricing, activeTier } = proposal;
  const tokens = theme.tokens;

  const destinations = [...new Set(days.map((d) => d.destination))];

  const stats = [
    { label: "Guests", value: client.guestNames, large: true },
    { label: "Dates", value: trip.dates },
    { label: "Duration", value: trip.nights ? `${trip.nights} nights` : days.length ? `${days.length} nights` : undefined },
    { label: "Destinations", value: destinations.length ? destinations.join(" · ") : trip.destinations.join(" · ") || undefined },
    { label: "Trip style", value: trip.tripStyle },
    { label: "Investment from", value: `${pricing[activeTier].currency} ${pricing[activeTier].pricePerPerson} pp`, accent: true },
  ].filter((s) => !!s.value) as { label: string; value: string; large?: boolean; accent?: boolean }[];

  return (
    <div style={{ background: tokens.pageBg }}>
      {/* Overline */}
      <div className="px-8 md:px-20 pt-20 pb-10 max-w-5xl mx-auto">
        <div className="text-[10px] uppercase tracking-[0.3em]" style={{ color: tokens.mutedText }}>
          At a glance
        </div>
      </div>

      {/* Stats strip — full-bleed border-collapse grid */}
      <div
        className="grid grid-cols-2 md:grid-cols-3 gap-px"
        style={{ background: tokens.border }}
      >
        {stats.map((stat, i) => (
          <div
            key={stat.label}
            className={`px-8 md:px-10 py-9 ${i === 0 ? "col-span-2 md:col-span-1" : ""}`}
            style={{ background: tokens.sectionSurface }}
          >
            <div
              className="text-[9px] uppercase tracking-[0.28em] mb-3"
              style={{ color: tokens.mutedText }}
            >
              {stat.label}
            </div>
            <div
              className={`font-semibold leading-snug ${stat.large ? "text-[1.25rem]" : "text-[14px]"}`}
              style={{
                color: stat.accent ? tokens.accent : tokens.headingText,
                fontFamily: stat.large
                  ? `'${theme.displayFont}', serif`
                  : `'${theme.bodyFont}', sans-serif`,
              }}
            >
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      <div className="h-px" style={{ background: tokens.border }} />
    </div>
  );
}
