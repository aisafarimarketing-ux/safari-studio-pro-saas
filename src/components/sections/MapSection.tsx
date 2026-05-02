"use client";

import { useState } from "react";
import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import { resolveTokens } from "@/lib/theme";
// Real cartographic map — Carto Voyager basemap via MapLibre GL.
// Replaces RouteSchematic (parchment-style SVG diagram). Operators
// asked for actual geography back: real coastlines, real park outlines
// via the basemap, real road network reference. RouteSchematic stays
// in the repo for reference but is no longer imported anywhere.
import { RouteRealMap } from "./RouteRealMap";
import { resolveSafariEndpoints } from "@/lib/safariRoutingRules";

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
  return (
    <InteractiveMap
      days={days}
      activeTier={activeTier as TierKey}
      properties={proposal.properties}
      theme={theme}
      tokens={tokens}
      startPoint={startPoint}
      endPoint={endPoint}
      caption={caption}
      isEditor={isEditor}
      stops={stops}
      onCaptionChange={(next) => updateSectionContent(section.id, { caption: next })}
      onStartPointChange={(next) => updateSectionContent(section.id, { startPoint: next })}
      onEndPointChange={(next) => updateSectionContent(section.id, { endPoint: next })}
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
  days,
  activeTier,
  properties,
  theme,
  tokens,
  startPoint,
  endPoint,
  caption,
  isEditor,
  stops,
  onCaptionChange,
  onStartPointChange,
  onEndPointChange,
}: {
  days: Day[];
  activeTier: TierKey;
  properties: import("@/lib/types").Property[];
  theme: import("@/lib/types").ProposalTheme;
  tokens: import("@/lib/types").ThemeTokens;
  startPoint: string;
  endPoint: string;
  caption: string;
  isEditor: boolean;
  stops: string[];
  onCaptionChange: (next: string) => void;
  onStartPointChange: (next: string) => void;
  onEndPointChange: (next: string) => void;
}) {
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const groupedRows = groupDayRows(days, activeTier);

  // Map row.startDay → the first day.id in that group so card selection
  // can drive the rail's highlight (the schematic itself doesn't
  // animate to a stop — pure SVG static layout).
  const sortedDays = [...days].sort((a, b) => a.dayNumber - b.dayNumber);

  const findDayIdForRow = (startDay: number): string | undefined =>
    sortedDays.find((d) => d.dayNumber === startDay)?.id;

  const findPropertyFor = (campName: string) => {
    if (!campName) return null;
    const lc = campName.trim().toLowerCase();
    return properties.find((p) => p.name.trim().toLowerCase() === lc) ?? null;
  };

  // Equal heights for rail + map: the grid uses items-stretch so
  // both cells share the row's height (driven by the rail's natural
  // content). The SVG inside the map cell uses preserveAspectRatio
  // "xMidYMid meet" — content stays undistorted, any slack inside
  // the cell is absorbed by the SVG's own parchment / land fill.
  // computeSchematicAspect retained as a no-op shim for backwards
  // compat; aspect is no longer applied as CSS.

  return (
    <div style={{ background: tokens.sectionSurface }}>
      {/* ── Header band — padded so it sits clear of the section
          edges, but the rail+map below goes flush to the full
          section width. Operator brief: no gray section surface
          should bleed around the map. */}
      <div className="px-4 md:px-6 pt-3 md:pt-4">
        {/* Header — LEFT-aligned, single column.
            Title:      "Itinerary at a glance" (the section's name).
            Subtitle:   "Arusha to {final destination}" — the trip arc.
            Start row:  the actual start-of-trip place.
            Operator brief: nothing on the right side. The previous
            country-flags + country-name + eyebrow block was removed —
            the country flag was leaking unrelated countries from
            placeholder days that snuck in via Add Day. */}
        <header className="mb-3 md:mb-4">
          <h2
            className="font-bold leading-[1.1]"
            style={{
              color: tokens.headingText,
              fontFamily: `'${theme.displayFont}', serif`,
              fontSize: "clamp(18px, 1.7vw, 22px)",
              letterSpacing: "-0.005em",
            }}
          >
            Itinerary at a glance
          </h2>
          {stops.length > 0 && (
            <div
              className="mt-1 text-[12.5px] uppercase tracking-[0.18em] font-semibold"
              style={{ color: tokens.mutedText }}
            >
              {stops.length > 1
                ? `${stops[0]} to ${stops[stops.length - 1]}`
                : stops[0]}
            </div>
          )}
          <div
            className="mt-2.5 flex items-baseline gap-2"
            style={{ paddingBottom: 8 }}
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
      </div>

      {/* Rail ‖ map — full-bleed under the header band. Vertical
          divider between rail and map, horizontal dividers between
          rail rows. items-stretch keeps both columns the same height.
          No outer rounded card any more — the section's own surface
          carries to the edges so the gold strip on top sits flush
          against the map below. */}
      <div
        style={{
          background: tokens.cardBg,
        }}
      >
        <div className="grid grid-cols-1 md:grid-cols-[240px_minmax(0,1fr)] items-stretch">
          {/* Sidebar — stacked table of day rows with horizontal
              dividers, vertical divider on the right edge separating
              from the map. */}
          <div
            className="flex flex-col"
            style={{ borderRight: `1px solid ${tokens.border}` }}
          >
            {/* Day cards — clickable; the rail's END block + caption
                stack at the bottom via flex-1 on the card list. */}
            <div className="flex-1 flex flex-col">
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
                    className="w-full text-left flex items-center gap-2.5 px-3 py-2.5 transition"
                    style={{
                      background: isSelected ? `${tokens.accent}18` : "transparent",
                      borderBottom: `1px solid ${tokens.border}`,
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

            {/* End point — sits in the rail's footer */}
            <div
              className="px-3 py-2.5"
              style={{ borderBottom: `1px solid ${tokens.border}` }}
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

            {(caption || isEditor) && (
              <div
                className="px-3 py-2.5 text-[11px] italic outline-none"
                style={{
                  color: tokens.mutedText,
                  fontFamily: `'${theme.displayFont}', serif`,
                }}
                contentEditable={isEditor}
                suppressContentEditableWarning
                onBlur={(e) => onCaptionChange(e.currentTarget.textContent ?? "")}
              >
                {caption || (isEditor ? "Add a caption…" : "")}
              </div>
            )}
          </div>

          {/* ── Map column — fills the grid cell flush. No rounded
              corners so the basemap covers every pixel of the
              section width and the section surface never bleeds
              through. The map fits its bounds to the route on
              first paint and re-fits when stops change. */}
          <div
            className="min-w-0 relative overflow-hidden"
            style={{ background: tokens.cardBg, minHeight: 360 }}
          >
            <RouteRealMap
              days={days}
              activeTier={activeTier}
              tokens={tokens}
              theme={theme}
              isEditor={isEditor}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

