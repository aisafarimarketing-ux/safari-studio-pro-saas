"use client";

import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import { resolveTokens } from "@/lib/theme";
import { RouteMap, type RouteCoord } from "./RouteMap";
import type { Section, TierKey } from "@/lib/types";

// Route variant — two-column editorial spread. Itinerary table on the left
// groups consecutive days with the same destination ("Day 3-4"); the
// interactive Leaflet map lives on the right. Header fields (country name,
// start point, end point) are all contentEditable.

export function MapSection({ section }: { section: Section }) {
  const { proposal, updateSectionContent } = useProposalStore();
  const { mode } = useEditorStore();
  const isEditor = mode === "editor";
  const { theme, days, trip, activeTier } = proposal;
  const tokens = resolveTokens(theme.tokens, section.styleOverrides);
  const variant = section.layoutVariant;

  const caption = (section.content.caption as string | undefined) ?? "";

  // Derived defaults — the operator edits any of these through the UI, we
  // just seed from proposal state the first time.
  const primaryCountry =
    days.find((d) => d.country?.trim())?.country?.trim() ||
    trip.destinations[0] ||
    "";
  const countryName = (section.content.countryName as string) || primaryCountry || "Country";
  const countryFlag = (section.content.countryFlag as string) || flagFor(primaryCountry);
  const startPoint =
    (section.content.startPoint as string) ||
    trip.destinations[0] ||
    days[0]?.destination ||
    "Start point";
  const endPoint =
    (section.content.endPoint as string) ||
    trip.destinations[trip.destinations.length - 1] ||
    days[days.length - 1]?.destination ||
    "End point";

  const stopsFromDays = days
    .slice()
    .sort((a, b) => a.dayNumber - b.dayNumber)
    .map((d) => d.destination)
    .filter((s, i, arr) => i === 0 || s !== arr[i - 1]);
  const stops = stopsFromDays.length > 0 ? stopsFromDays : trip.destinations;

  // ── Interactive route map (Leaflet + OSM) ─────────────────────────────
  if (variant === "route" || variant === "interactive") {
    const cachedCoords = (section.content.coords as RouteCoord[] | undefined) ?? undefined;
    const groupedRows = groupDayRows(days, activeTier as TierKey);

    return (
      <div className="py-20" style={{ background: tokens.sectionSurface }}>
        <div className="max-w-6xl mx-auto px-8 md:px-12">
          {/* Section header — label + title + country line */}
          <div className="mb-10">
            <div
              className="text-[10px] uppercase tracking-[0.3em] mb-3"
              style={{ color: tokens.mutedText }}
            >
              Map
            </div>
            <h2
              className="font-bold leading-tight outline-none"
              style={{
                color: tokens.headingText,
                fontFamily: `'${theme.displayFont}', serif`,
                fontSize: "clamp(1.8rem, 3.4vw, 2.4rem)",
                letterSpacing: "-0.01em",
              }}
            >
              {stops.length > 1 ? `${stops[0]} to ${stops[stops.length - 1]}` : stops[0] ?? "Your route"}
            </h2>
          </div>

          {/* Two-column spread — table left, map right */}
          <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] gap-10 md:gap-14">
            {/* Left — country header + grouped day table */}
            <div className="min-w-0">
              <div className="mb-6">
                <div className="flex items-center gap-2.5">
                  <span className="text-[18px] leading-none" aria-hidden>
                    {countryFlag}
                  </span>
                  <span
                    className="text-[14.5px] font-semibold outline-none"
                    style={{ color: tokens.headingText }}
                    contentEditable={isEditor}
                    suppressContentEditableWarning
                    onBlur={(e) =>
                      updateSectionContent(section.id, { countryName: e.currentTarget.textContent ?? "" })
                    }
                  >
                    {countryName}
                  </span>
                </div>
                <div
                  className="mt-2 text-[13px] outline-none"
                  style={{ color: tokens.bodyText }}
                  contentEditable={isEditor}
                  suppressContentEditableWarning
                  onBlur={(e) =>
                    updateSectionContent(section.id, { startPoint: e.currentTarget.textContent ?? "" })
                  }
                >
                  <span className="font-semibold" style={{ color: tokens.headingText }}>Start Point:</span>{" "}
                  {startPoint}
                </div>
              </div>

              {/* Grouped day table — hairline-only, spacious */}
              <div>
                <div
                  className="grid grid-cols-[88px_1fr] gap-x-4 pb-3"
                  style={{ borderBottom: `1px solid ${tokens.border}` }}
                >
                  <div className="text-[9.5px] uppercase tracking-[0.28em] font-semibold" style={{ color: tokens.mutedText }}>
                    Days
                  </div>
                  <div className="text-[9.5px] uppercase tracking-[0.28em] font-semibold" style={{ color: tokens.mutedText }}>
                    Main Destination
                  </div>
                </div>

                {groupedRows.length > 0 ? (
                  groupedRows.map((row, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-[88px_1fr] gap-x-4 py-4"
                      style={{
                        borderBottom:
                          i === groupedRows.length - 1 ? "none" : `1px solid ${tokens.border}`,
                      }}
                    >
                      <div className="text-[13px] tabular-nums pt-0.5" style={{ color: tokens.mutedText }}>
                        {row.dayLabel}
                      </div>
                      <div className="min-w-0">
                        <div
                          className="text-[15px] font-semibold leading-tight"
                          style={{
                            color: tokens.headingText,
                            fontFamily: `'${theme.displayFont}', serif`,
                          }}
                        >
                          {row.destination}
                        </div>
                        {row.accommodation && (
                          <div
                            className="text-[12.5px] mt-1"
                            style={{ color: tokens.mutedText }}
                          >
                            {row.accommodation}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-10 text-center text-[13px]" style={{ color: tokens.mutedText }}>
                    {isEditor ? "Add days to populate the route." : "Route coming soon."}
                  </div>
                )}
              </div>

              <div
                className="mt-5 text-[13px] outline-none"
                style={{ color: tokens.bodyText }}
                contentEditable={isEditor}
                suppressContentEditableWarning
                onBlur={(e) =>
                  updateSectionContent(section.id, { endPoint: e.currentTarget.textContent ?? "" })
                }
              >
                <span className="font-semibold" style={{ color: tokens.headingText }}>End Point:</span>{" "}
                {endPoint}
              </div>
            </div>

            {/* Right — interactive map */}
            <div className="min-w-0">
              {days.length > 0 ? (
                <div
                  className="overflow-hidden"
                  style={{
                    borderRadius: 6,
                    border: `1px solid ${tokens.border}`,
                    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                  }}
                >
                  <RouteMap
                    days={days}
                    tokens={tokens}
                    cachedCoords={cachedCoords}
                    onCoordsResolved={(coords) => {
                      if (isEditor) {
                        updateSectionContent(section.id, { coords });
                      }
                    }}
                    height={420}
                  />
                </div>
              ) : (
                <div
                  className="flex items-center justify-center text-[13px]"
                  style={{
                    height: 420,
                    background: tokens.cardBg,
                    color: tokens.mutedText,
                    borderRadius: 6,
                    border: `1px solid ${tokens.border}`,
                  }}
                >
                  {isEditor ? "Add days with destinations to draw the route." : "Route coming soon."}
                </div>
              )}

              {(caption || isEditor) && (
                <p
                  className="text-[12px] italic text-center mt-4 outline-none"
                  style={{ color: tokens.mutedText, fontFamily: `'${theme.displayFont}', serif` }}
                  contentEditable={isEditor}
                  suppressContentEditableWarning
                  onBlur={(e) => updateSectionContent(section.id, { caption: e.currentTarget.textContent ?? "" })}
                >
                  {caption || (isEditor ? "Add a caption…" : "")}
                </p>
              )}

              <div
                className="mt-2 text-[10px] tracking-wide text-center"
                style={{ color: tokens.mutedText, fontFamily: `'${theme.bodyFont}', sans-serif`, opacity: 0.55 }}
              >
                Map data © OpenStreetMap contributors
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Typographic timeline (legacy variants) ───────────────────────────
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

// ─── Helpers ──────────────────────────────────────────────────────────────

type GroupedDayRow = {
  dayLabel: string;
  destination: string;
  accommodation: string;
};

// Collapse consecutive days that share a destination into a single row,
// e.g. Day 3-4 · Serengeti NP · Into Wild Africa. The accommodation shown
// is the one from the first day in the group; if it changes inside the
// group it's preserved so the operator sees the mismatch.
function groupDayRows(
  days: { dayNumber: number; destination: string; tiers: Record<string, { camp: string }> }[],
  activeTier: TierKey,
): GroupedDayRow[] {
  if (days.length === 0) return [];
  const rows: GroupedDayRow[] = [];
  const sorted = [...days].sort((a, b) => a.dayNumber - b.dayNumber);

  let i = 0;
  while (i < sorted.length) {
    const current = sorted[i];
    const startDay = current.dayNumber;
    let endDay = current.dayNumber;
    while (
      i + 1 < sorted.length &&
      sorted[i + 1].destination === current.destination &&
      sorted[i + 1].tiers?.[activeTier]?.camp === current.tiers?.[activeTier]?.camp
    ) {
      i++;
      endDay = sorted[i].dayNumber;
    }
    rows.push({
      dayLabel: startDay === endDay ? `Day ${startDay}` : `Day ${startDay}-${endDay}`,
      destination: current.destination || "New Destination",
      accommodation: current.tiers?.[activeTier]?.camp ?? "",
    });
    i++;
  }

  return rows;
}

// Rough country → flag emoji mapping for the most common safari markets.
// Operator-editable via section.content.countryFlag, so unknown countries
// just render blank until the operator sets one.
function flagFor(country: string | undefined): string {
  if (!country) return "";
  const key = country.trim().toLowerCase();
  const table: Record<string, string> = {
    kenya: "🇰🇪",
    tanzania: "🇹🇿",
    uganda: "🇺🇬",
    rwanda: "🇷🇼",
    botswana: "🇧🇼",
    "south africa": "🇿🇦",
    zambia: "🇿🇲",
    zimbabwe: "🇿🇼",
    namibia: "🇳🇦",
    ethiopia: "🇪🇹",
    madagascar: "🇲🇬",
    malawi: "🇲🇼",
    mozambique: "🇲🇿",
    seychelles: "🇸🇨",
    mauritius: "🇲🇺",
  };
  return table[key] ?? "";
}
