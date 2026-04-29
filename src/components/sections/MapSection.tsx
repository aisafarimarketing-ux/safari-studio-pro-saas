"use client";

import { useState } from "react";
import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import { resolveTokens } from "@/lib/theme";
import { RouteMap, type RouteCoord } from "./RouteMap";
import { resolveSafariEndpoints } from "@/lib/safariRoutingRules";
import { countryOf } from "@/lib/destinationOrdering";

// hasOffshoreStops removed — the main map now renders the FULL
// route including coast extensions, masked outside the route's
// bounds by the spotlight overlay. No paired inset map any more.
import type { Section, TierKey, Day } from "@/lib/types";

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
  // layoutVariant is no longer dispatched on — every map section
  // renders through InteractiveMap. Old proposals' `route` /
  // `default` / `full-width` values are tolerated; the registry
  // exposes only `interactive` going forward.

  const caption = (section.content.caption as string | undefined) ?? "";

  // Derived defaults — the operator edits any of these through the UI, we
  // just seed from proposal state the first time.
  const primaryCountry =
    days.find((d) => d.country?.trim())?.country?.trim() ||
    trip.destinations[0] ||
    "";
  // All unique countries the trip touches, in first-occurrence order.
  // Used to render multiple flags on the rail header for cross-border
  // trips (Tanzania + Kenya, etc.). For each day we prefer
  // `d.country` if it's set on the autopilot output, falling back to
  // `countryOf(d.destination)` for legacy data where country wasn't
  // populated. Either way every day contributes its country to the
  // unique set. Single-country trips show 1 flag; multi-country
  // trips show 2.
  const tripCountries = (() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const d of days) {
      const c = d.country?.trim() || countryOf(d.destination ?? "") || "";
      if (c && !seen.has(c)) {
        seen.add(c);
        out.push(c);
      }
    }
    if (out.length === 0 && primaryCountry) out.push(primaryCountry);
    return out;
  })();
  const countryName =
    (section.content.countryName as string) ||
    (tripCountries.length > 1 ? tripCountries.join(" · ") : tripCountries[0]) ||
    "Country";
  // Single-flag override stays editable for operators on legacy
  // proposals; for cross-border trips we compute every country's
  // flag from `tripCountries` and render them as a row in the rail
  // header. The single-flag fallback (countryFlag) is what shows
  // when the operator has hand-set a flag in section.content.
  const countryFlag = (section.content.countryFlag as string) || flagFor(primaryCountry);
  const countryFlags = tripCountries.map((c) => flagFor(c)).filter(Boolean);
  // Prefer days[] as the source of truth — that's what the itinerary table
  // and per-day sections actually render. trip.destinations is just the
  // original setup input and can drift out of sync after AI drafting.
  // Chronological stops list (kept WITH adjacent dedupe so the rail
  // doesn't read "Serengeti · Serengeti" for a 3-night stay; non-
  // adjacent revisits like Day 1 + Day 7 Arusha do appear twice).
  const stopsFromDays = days
    .slice()
    .sort((a, b) => a.dayNumber - b.dayNumber)
    .map((d) => d.destination)
    .filter((s, i, arr) => i === 0 || s !== arr[i - 1]);
  const stops = stopsFromDays.length > 0 ? stopsFromDays : trip.destinations;

  // Apply safari business rules: trips END at a gateway / airport,
  // never inside a park. If the itinerary appears to end in a park
  // (Tarangire, Serengeti, Ngorongoro, etc.) we surface that as the
  // "last safari stop" and label the drop-off as TBC instead of
  // pretending the park is the trip's terminus.
  const safari = resolveSafariEndpoints(stops);

  const startPoint =
    (section.content.startPoint as string) ||
    safari.start ||
    "Start point";
  const endPoint =
    (section.content.endPoint as string) ||
    safari.finalDropoff ||
    (safari.endsInPark
      ? "Final transfer to be confirmed"
      : safari.lastSafariStop || "End point");

  // Every map variant renders through InteractiveMap — it carries
  // the modern logic (real OSM park polygons, bowed leg curves,
  // spotlight mask, full coast reach, multi-token section pickers).
  // Legacy variant names ("route" / "default" / "full-width") still
  // appear in older proposals' `layoutVariant` field but they render
  // identically here; the SectionChrome variant switcher is hidden
  // because the registry now lists only `interactive`.
  const cachedCoords = (section.content.coords as RouteCoord[] | undefined) ?? undefined;
  return (
    <InteractiveMap
      section={section}
      days={days}
      activeTier={activeTier as TierKey}
      properties={proposal.properties}
      cachedCoords={cachedCoords}
      theme={theme}
      tokens={tokens}
      countryName={countryName}
      countryFlag={countryFlag}
      countryFlags={countryFlags}
      startPoint={startPoint}
      endPoint={endPoint}
      caption={caption}
      isEditor={isEditor}
      stops={stops}
      onCaptionChange={(next) => updateSectionContent(section.id, { caption: next })}
      onStartPointChange={(next) => updateSectionContent(section.id, { startPoint: next })}
      onEndPointChange={(next) => updateSectionContent(section.id, { endPoint: next })}
      onCountryNameChange={(next) => updateSectionContent(section.id, { countryName: next })}
      onCoordsResolved={(coords) => {
        if (isEditor) updateSectionContent(section.id, { coords });
      }}
    />
  );
}


// ─── Helpers ──────────────────────────────────────────────────────────────

type GroupedDayRow = {
  dayLabel: string;
  startDay: number;
  endDay: number;
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
      startDay,
      endDay,
      destination: current.destination || "New Destination",
      accommodation: current.tiers?.[activeTier]?.camp ?? "",
    });
    i++;
  }

  return rows;
}

// ─── Interactive variant component ────────────────────────────────────────

function InteractiveMap({
  section,
  days,
  activeTier,
  properties,
  cachedCoords,
  theme,
  tokens,
  countryName,
  countryFlag,
  countryFlags,
  startPoint,
  endPoint,
  caption,
  isEditor,
  stops,
  onCaptionChange,
  onStartPointChange,
  onEndPointChange,
  onCountryNameChange,
  onCoordsResolved,
}: {
  section: Section;
  days: Day[];
  activeTier: TierKey;
  properties: import("@/lib/types").Property[];
  cachedCoords?: RouteCoord[];
  theme: import("@/lib/types").ProposalTheme;
  tokens: import("@/lib/types").ThemeTokens;
  countryName: string;
  countryFlag: string;
  countryFlags: string[];
  startPoint: string;
  endPoint: string;
  caption: string;
  isEditor: boolean;
  stops: string[];
  onCaptionChange: (next: string) => void;
  onStartPointChange: (next: string) => void;
  onEndPointChange: (next: string) => void;
  onCountryNameChange: (next: string) => void;
  onCoordsResolved: (coords: RouteCoord[]) => void;
}) {
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const groupedRows = groupDayRows(days, activeTier);

  // Map row.startDay → the first day.id in that group so card selection
  // can drive RouteMap.selectedDayId.
  const sortedDays = [...days].sort((a, b) => a.dayNumber - b.dayNumber);

  const findDayIdForRow = (startDay: number): string | undefined =>
    sortedDays.find((d) => d.dayNumber === startDay)?.id;

  const findPropertyFor = (campName: string) => {
    if (!campName) return null;
    const lc = campName.trim().toLowerCase();
    return properties.find((p) => p.name.trim().toLowerCase() === lc) ?? null;
  };

  // The map renders at 100% of its grid cell. Using `items-stretch` on
  // the parent grid means the cell's height matches the rail's natural
  // content height — so the map and the day-card list sit at the same
  // height, bottom-aligned. No fixed MAP_HEIGHT any more.

  return (
    <div className="py-2 md:py-3" style={{ background: tokens.sectionSurface }}>
      <div className="mx-auto px-4 md:px-6" style={{ maxWidth: 1280 }}>
        {/* ── Header band — full width across both columns ────────────
            Row 1: "Itinerary at a glance" eyebrow on the left, country
            flag(s) and the dynamic A→B title on the right. Row 2:
            START · place. Both rows live above the rail+map grid so
            the section reads as one editorial block, not two columns
            with separate headers. */}
        <header className="mb-3 md:mb-4">
          <div className="flex items-baseline gap-3 flex-wrap">
            <div
              className="text-[9.5px] uppercase tracking-[0.28em] font-semibold"
              style={{ color: tokens.mutedText }}
            >
              Itinerary at a glance
            </div>
            <div className="ml-auto flex items-center gap-2 flex-wrap">
              {countryFlags.length > 1 ? (
                countryFlags.map((f, i) => (
                  <span key={i} className="text-[16px] leading-none" aria-hidden>
                    {f}
                  </span>
                ))
              ) : (
                countryFlag && (
                  <span className="text-[16px] leading-none" aria-hidden>
                    {countryFlag}
                  </span>
                )
              )}
              <span
                className="text-[11.5px] uppercase tracking-[0.18em] font-semibold outline-none"
                style={{ color: tokens.mutedText }}
                contentEditable={isEditor}
                suppressContentEditableWarning
                onBlur={(e) => onCountryNameChange(e.currentTarget.textContent ?? "")}
              >
                {countryName}
              </span>
              <h2
                className="font-bold leading-[1.15]"
                style={{
                  color: tokens.headingText,
                  fontFamily: `'${theme.displayFont}', serif`,
                  fontSize: "clamp(18px, 1.8vw, 22px)",
                  letterSpacing: "-0.005em",
                }}
              >
                {stops.length > 1 ? `${stops[0]} to ${stops[stops.length - 1]}` : stops[0] ?? "Your route"}
              </h2>
            </div>
          </div>
          <div
            className="mt-2 flex items-baseline gap-2"
            style={{ borderBottom: `1px solid ${tokens.border}`, paddingBottom: 8 }}
          >
            <div
              className="text-[9px] uppercase tracking-[0.24em] font-semibold"
              style={{ color: tokens.mutedText }}
            >
              Start
            </div>
            <div
              className="text-[12.5px] outline-none"
              style={{ color: tokens.headingText }}
              contentEditable={isEditor}
              suppressContentEditableWarning
              onBlur={(e) => onStartPointChange(e.currentTarget.textContent ?? "")}
            >
              {startPoint}
            </div>
          </div>
        </header>

        {/* Rail (day cards + END) ‖ map. items-stretch makes the map
            cell match the rail's natural content height — they sit at
            the same height, bottom-aligned. */}
        <div className="grid grid-cols-1 md:grid-cols-[240px_minmax(0,1fr)] gap-4 md:gap-5 items-stretch">
          {/* Sidebar */}
          <div className="flex flex-col pr-1">
            {/* Day cards — clickable, fly the map to the selected pin.
                Wrapped in a flex-1 container so the rail's End block
                can flex to the bottom of the column. */}
            <div className="space-y-1.5 flex-1">
              {groupedRows.map((row, idx) => {
                const rowDayId = findDayIdForRow(row.startDay);
                const isSelected = rowDayId && rowDayId === selectedDayId;
                const prop = findPropertyFor(row.accommodation);
                const thumb = prop?.leadImageUrl ?? null;

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedDayId(rowDayId ?? null)}
                    className="w-full text-left flex items-center gap-2.5 p-2 rounded-md transition"
                    style={{
                      background: isSelected ? `${tokens.accent}18` : tokens.cardBg,
                      border: `1px solid ${isSelected ? tokens.accent : tokens.border}`,
                      boxShadow: isSelected ? "0 2px 8px rgba(0,0,0,0.05)" : "none",
                    }}
                  >
                    <div
                      className="shrink-0 overflow-hidden"
                      style={{ width: 40, height: 40, borderRadius: 4, background: tokens.sectionSurface }}
                    >
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumb} alt={row.accommodation} className="w-full h-full object-cover" />
                      ) : (
                        <div
                          className="w-full h-full flex items-center justify-center font-bold tabular-nums"
                          style={{
                            background: `${tokens.accent}1c`,
                            color: tokens.accent,
                            fontSize: 12,
                          }}
                        >
                          {row.startDay}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div
                        className="text-[9.5px] uppercase tracking-[0.18em] font-semibold"
                        style={{ color: tokens.mutedText }}
                      >
                        {row.dayLabel}
                      </div>
                      <div
                        className="text-[12.5px] font-semibold leading-tight truncate"
                        style={{
                          color: tokens.headingText,
                          fontFamily: `'${theme.displayFont}', serif`,
                        }}
                      >
                        {row.destination}
                      </div>
                      {row.accommodation && (
                        <div
                          className="text-[11px] truncate"
                          style={{ color: tokens.mutedText }}
                        >
                          {row.accommodation}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* End point */}
            <div
              className="pt-2.5 mt-2.5"
              style={{ borderTop: `1px solid ${tokens.border}` }}
            >
              <div
                className="text-[9px] uppercase tracking-[0.22em] font-semibold mb-0.5"
                style={{ color: tokens.mutedText }}
              >
                End
              </div>
              <div
                className="text-[12.5px] outline-none"
                style={{ color: tokens.headingText }}
                contentEditable={isEditor}
                suppressContentEditableWarning
                onBlur={(e) => onEndPointChange(e.currentTarget.textContent ?? "")}
              >
                {endPoint}
              </div>
            </div>

            {/* Caption + attribution at the bottom of the rail */}
            {(caption || isEditor) && (
              <div
                className="mt-3 pt-3 text-[11px] italic outline-none"
                style={{
                  color: tokens.mutedText,
                  fontFamily: `'${theme.displayFont}', serif`,
                  borderTop: `1px solid ${tokens.border}`,
                }}
                contentEditable={isEditor}
                suppressContentEditableWarning
                onBlur={(e) => onCaptionChange(e.currentTarget.textContent ?? "")}
              >
                {caption || (isEditor ? "Add a caption…" : "")}
              </div>
            )}
            <div
              className="mt-2 text-[9px] tracking-wide"
              style={{
                color: tokens.mutedText,
                fontFamily: `'${theme.bodyFont}', sans-serif`,
                opacity: 0.5,
              }}
            >
              Map data © OpenStreetMap contributors
            </div>
          </div>

          {/* ── Map — fills the grid cell so its height matches the
              rail's natural content height. items-stretch on the
              parent grid + height="100%" on RouteMap is what couples
              the two. ─────────────────────────── */}
          <div className="min-w-0 flex">
            {days.length > 0 ? (
              <div
                className="overflow-hidden flex-1 min-h-0 relative"
                style={{
                  borderRadius: 10,
                  border: `1px solid ${tokens.border}`,
                }}
              >
                <RouteMap
                  days={days}
                  tokens={tokens}
                  cachedCoords={cachedCoords}
                  onCoordsResolved={onCoordsResolved}
                  height="100%"
                  selectedDayId={selectedDayId}
                  presentationMode={!isEditor}
                />
              </div>
            ) : (
              <div
                className="flex flex-1 items-center justify-center text-[13px]"
                style={{
                  background: tokens.cardBg,
                  color: tokens.mutedText,
                  borderRadius: 10,
                  border: `1px solid ${tokens.border}`,
                }}
              >
                {isEditor ? "Add days with destinations to draw the route." : "Route coming soon."}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
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
