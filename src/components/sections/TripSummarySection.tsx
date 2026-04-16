"use client";

import { useProposalStore } from "@/store/proposalStore";
import type { Section } from "@/lib/types";

export function TripSummarySection({ section }: { section: Section }) {
  const { proposal } = useProposalStore();
  const { client, trip, theme, days, pricing, activeTier } = proposal;
  const tokens = theme.tokens;

  const destinations = [...new Set(days.map((d) => d.destination))];

  const stats = [
    { label: "Guests", value: client.guestNames, large: true },
    { label: "Dates", value: trip.dates },
    { label: "Duration", value: trip.nights ? `${trip.nights} nights` : `${days.length} nights` },
    { label: "Destinations", value: destinations.length ? destinations.join(" · ") : trip.destinations.join(" · ") },
    { label: "Trip style", value: trip.tripStyle },
    { label: "Investment from", value: `${pricing[activeTier].currency} ${pricing[activeTier].pricePerPerson} pp`, accent: true },
  ].filter((s) => !!s.value) as { label: string; value: string; large?: boolean; accent?: boolean }[];

  return (
    <div style={{ background: tokens.pageBg }}>
      {/* Top overline */}
      <div className="px-8 md:px-16 pt-16 pb-8 max-w-5xl mx-auto">
        <div className="text-[11px] uppercase tracking-[0.22em]" style={{ color: tokens.mutedText }}>
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
            className={`px-8 py-7 ${i === 0 ? "col-span-2 md:col-span-1" : ""}`}
            style={{ background: tokens.sectionSurface }}
          >
            <div
              className="text-[9px] uppercase tracking-[0.22em] mb-2"
              style={{ color: tokens.mutedText }}
            >
              {stat.label}
            </div>
            <div
              className={`font-semibold leading-snug ${stat.large ? "text-[1.2rem]" : "text-[15px]"}`}
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

      {/* Bottom spacer */}
      <div className="pb-4" style={{ background: tokens.pageBg }} />
    </div>
  );
}
