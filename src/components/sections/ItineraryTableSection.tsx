"use client";

import { useProposalStore } from "@/store/proposalStore";
import type { Section } from "@/lib/types";

export function ItineraryTableSection({ section }: { section: Section }) {
  const { proposal } = useProposalStore();
  const { days, activeTier, theme } = proposal;
  const tokens = theme.tokens;

  return (
    <div className="py-16 px-8 md:px-16" style={{ background: tokens.sectionSurface }}>
      <div className="max-w-5xl mx-auto">
        <div
          className="text-[11px] uppercase tracking-[0.22em] mb-8"
          style={{ color: tokens.mutedText }}
        >
          Itinerary at a glance
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: `2px solid ${tokens.border}` }}>
                {["Day", "Date", "Destination", "Accommodation", "Board"].map((h) => (
                  <th
                    key={h}
                    className="text-left py-3 pr-6 font-semibold text-[11px] uppercase tracking-widest"
                    style={{ color: tokens.mutedText }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {days.map((day, i) => (
                <tr
                  key={day.id}
                  style={{
                    borderBottom: `1px solid ${tokens.border}`,
                    background: i % 2 === 0 ? tokens.sectionSurface : tokens.cardBg,
                  }}
                >
                  <td
                    className="py-4 pr-6 font-semibold tabular-nums"
                    style={{ color: tokens.accent }}
                  >
                    {day.dayNumber}
                  </td>
                  <td className="py-4 pr-6" style={{ color: tokens.mutedText }}>
                    {day.date ?? "—"}
                  </td>
                  <td className="py-4 pr-6 font-medium" style={{ color: tokens.headingText }}>
                    {day.destination}
                    {day.country && (
                      <span className="font-normal ml-1" style={{ color: tokens.mutedText }}>
                        · {day.country}
                      </span>
                    )}
                  </td>
                  <td className="py-4 pr-6" style={{ color: tokens.bodyText }}>
                    {day.tiers[activeTier].camp}
                    {day.tiers[activeTier].location && (
                      <span className="block text-xs" style={{ color: tokens.mutedText }}>
                        {day.tiers[activeTier].location}
                      </span>
                    )}
                  </td>
                  <td className="py-4" style={{ color: tokens.mutedText }}>
                    {day.board}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {days.length === 0 && (
          <div className="text-center py-12" style={{ color: tokens.mutedText }}>
            Add days in the Day-by-Day section to populate this table.
          </div>
        )}
      </div>
    </div>
  );
}
