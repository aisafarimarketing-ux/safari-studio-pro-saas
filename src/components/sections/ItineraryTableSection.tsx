"use client";

import { useProposalStore } from "@/store/proposalStore";
import { resolveTokens } from "@/lib/theme";
import type { Section } from "@/lib/types";

export function ItineraryTableSection({ section }: { section: Section }) {
  const { proposal } = useProposalStore();
  const { days, activeTier, theme } = proposal;
  const tokens = resolveTokens(theme.tokens, section.styleOverrides);

  return (
    <div className="py-20 px-8 md:px-20" style={{ background: tokens.sectionSurface }}>
      <div className="max-w-5xl mx-auto">
        <div
          className="text-[10px] uppercase tracking-[0.3em] mb-10"
          style={{ color: tokens.mutedText }}
        >
          Itinerary at a glance
        </div>

        <div className="overflow-x-auto">
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
