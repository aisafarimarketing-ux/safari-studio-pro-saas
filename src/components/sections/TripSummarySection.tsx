"use client";

import { useProposalStore } from "@/store/proposalStore";
import type { Section } from "@/lib/types";

export function TripSummarySection({ section }: { section: Section }) {
  const { proposal } = useProposalStore();
  const { client, trip, theme, days, pricing, activeTier } = proposal;
  const tokens = theme.tokens;

  const stats = [
    { label: "Guests", value: client.pax || client.guestNames },
    { label: "Dates", value: trip.dates },
    { label: "Duration", value: `${trip.nights} nights` },
    { label: "Destinations", value: [...new Set(days.map((d) => d.destination))].join(" · ") || trip.destinations.join(" · ") },
    { label: "Trip style", value: trip.tripStyle ?? "" },
    { label: "Investment from", value: `${pricing[activeTier].currency} ${pricing[activeTier].pricePerPerson} pp` },
  ].filter((s) => s.value);

  return (
    <div className="py-16 px-8 md:px-16" style={{ background: tokens.pageBg }}>
      <div className="max-w-5xl mx-auto">
        <div
          className="text-[11px] uppercase tracking-[0.22em] mb-8"
          style={{ color: tokens.mutedText }}
        >
          At a glance
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-px" style={{ background: tokens.border }}>
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="p-6"
              style={{ background: tokens.sectionSurface }}
            >
              <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: tokens.mutedText }}>
                {stat.label}
              </div>
              <div
                className="text-base font-medium leading-snug"
                style={{ color: tokens.headingText, fontFamily: `'${theme.bodyFont}', sans-serif` }}
              >
                {stat.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
