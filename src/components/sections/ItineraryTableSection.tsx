"use client";

import { useProposalStore } from "@/store/proposalStore";
import { resolveTokens } from "@/lib/theme";
import type { Section } from "@/lib/types";

// "At a glance" + itinerary table as a single editorial spread. The top row
// is a slim meta strip (4 label/value pairs); a hairline separates it from
// the day-by-day table below. Replaces the old split between TripSummary
// and ItineraryTable — two sections that always sat next to each other and
// said the same thing twice.

export function ItineraryTableSection({ section }: { section: Section }) {
  const { proposal } = useProposalStore();
  const { days, activeTier, client, trip, theme } = proposal;
  const tokens = resolveTokens(theme.tokens, section.styleOverrides);

  // ── At-a-glance stats ──────────────────────────────────────────────────
  const destinations = [...new Set(days.map((d) => d.destination))];
  const destinationsLine = destinations.length
    ? destinations.join(" · ")
    : trip.destinations.join(" · ");
  const duration = trip.nights
    ? `${trip.nights + 1} days · ${trip.nights} nights`
    : days.length
      ? `${days.length} days`
      : trip.dates;
  const stats: { label: string; value: string }[] = [
    { label: "Duration", value: duration || "—" },
    { label: "Destinations", value: destinationsLine || "—" },
    { label: "Guests", value: client.guestNames || "—" },
    { label: "Style", value: trip.tripStyle || trip.subtitle || "—" },
  ];

  return (
    <div className="py-20 px-8 md:px-20" style={{ background: tokens.sectionSurface }}>
      <div className="max-w-5xl mx-auto">
        <div
          className="text-[10px] uppercase tracking-[0.3em] mb-10"
          style={{ color: tokens.mutedText }}
        >
          At a glance
        </div>

        {/* Slim meta strip — 4 label/value pairs, no card chrome */}
        <div
          className="grid grid-cols-2 md:grid-cols-4 gap-x-10 gap-y-8 pb-10"
          style={{ borderBottom: `1px solid ${tokens.border}` }}
        >
          {stats.map((stat) => (
            <div key={stat.label} className="min-w-0">
              <div
                className="text-[9.5px] uppercase tracking-[0.28em] font-semibold mb-2"
                style={{ color: tokens.mutedText }}
              >
                {stat.label}
              </div>
              <div
                className="text-[16px] leading-snug"
                style={{
                  color: tokens.headingText,
                  fontFamily: `'${theme.displayFont}', serif`,
                  fontWeight: 500,
                }}
              >
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        {/* Day-by-day table */}
        <div className="overflow-x-auto pt-6">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: `1px solid ${tokens.border}` }}>
                {["Day", "Date", "Destination", "Accommodation", "Board"].map((h) => (
                  <th
                    key={h}
                    className="text-left pb-4 pr-8 text-[9px] font-semibold uppercase tracking-[0.25em]"
                    style={{ color: tokens.mutedText }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {days.map((day) => (
                <tr
                  key={day.id}
                  style={{ borderBottom: `1px solid ${tokens.border}` }}
                >
                  <td
                    className="py-5 pr-8 text-[13px] font-semibold tabular-nums"
                    style={{ color: tokens.accent }}
                  >
                    {String(day.dayNumber).padStart(2, "0")}
                  </td>
                  <td className="py-5 pr-8 text-[13px]" style={{ color: tokens.mutedText }}>
                    {day.date ?? "—"}
                  </td>
                  <td className="py-5 pr-8" style={{ color: tokens.headingText }}>
                    <span className="text-[13.5px] font-medium">{day.destination}</span>
                    {day.country && (
                      <span className="text-[12px] font-normal ml-1.5" style={{ color: tokens.mutedText }}>
                        {day.country}
                      </span>
                    )}
                  </td>
                  <td className="py-5 pr-8">
                    <span className="text-[13px]" style={{ color: tokens.bodyText }}>
                      {day.tiers[activeTier].camp}
                    </span>
                    {day.tiers[activeTier].location && (
                      <span className="block text-[11.5px] mt-0.5" style={{ color: tokens.mutedText }}>
                        {day.tiers[activeTier].location}
                      </span>
                    )}
                  </td>
                  <td className="py-5 text-[12.5px]" style={{ color: tokens.mutedText }}>
                    {day.board}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {days.length === 0 && (
          <div className="text-center py-14 text-[13px]" style={{ color: tokens.mutedText }}>
            Add days in the Day-by-Day section to populate this table.
          </div>
        )}
      </div>
    </div>
  );
}
