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
  const variant = section.layoutVariant;

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
  // proposals; multi-country trips compute fresh from tripCountries.
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

  // ── Interactive variant — lodge carousel sidebar + big map ────────────
  if (variant === "interactive") {
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

  // ── Route variant — editorial table + map ─────────────────────────────
  // Note on padding: dropped from py-12/14 to py-4/6 so this section
  // doesn't create a visible "frame" of sectionSurface above and below
  // the map content. Combined with using pageBg as the section
  // background, the map butts up against neighbouring sections like
  // Cover and PersonalNote do.
  if (variant === "route") {
    const cachedCoords = (section.content.coords as RouteCoord[] | undefined) ?? undefined;
    const groupedRows = groupDayRows(days, activeTier as TierKey);

    // Resolve a property by camp name so each rail card can show its
    // lead image. Same case-insensitive match the interactive variant
    // uses — keeps matching behaviour consistent across map variants.
    const findProperty = (campName: string) => {
      if (!campName) return null;
      const lc = campName.trim().toLowerCase();
      return proposal.properties.find((p) => p.name.trim().toLowerCase() === lc) ?? null;
    };

    // MAP_HEIGHT removed — the map now stretches to match the rail's
    // natural height via the grid's items-stretch. Short trips get a
    // smaller map, long trips get a taller one. No imposed minimum
    // beyond what the rail's content provides.

    return (
      <div className="py-2 md:py-3" style={{ background: tokens.sectionSurface }}>
        <div className="mx-auto px-4 md:px-6" style={{ maxWidth: 1280 }}>
          {/* Card-rail (240px) + dominant map. The title + country chip
              live inside the rail header — no separate full-width title
              row, so the map can stretch the full container height
              without competing for vertical space. */}
          <div className="grid grid-cols-1 md:grid-cols-[240px_minmax(0,1fr)] gap-4 md:gap-5 items-stretch">
            {/* ── Left rail ───────────────────────────────────────── */}
            <aside className="min-w-0 flex flex-col">
              {/* Rail header — eyebrow ("Itinerary at a glance") +
                  dynamic A→B title + country chip(s). The eyebrow is
                  the section's editorial title; the H2 below is the
                  trip-specific subhead. */}
              <div className="mb-3">
                <div
                  className="text-[9.5px] uppercase tracking-[0.28em] font-semibold mb-1"
                  style={{ color: tokens.mutedText }}
                >
                  Itinerary at a glance
                </div>
                <h2
                  className="font-bold leading-[1.15] outline-none"
                  style={{
                    color: tokens.headingText,
                    fontFamily: `'${theme.displayFont}', serif`,
                    fontSize: "clamp(16px, 1.6vw, 19px)",
                    letterSpacing: "-0.005em",
                  }}
                >
                  {stops.length > 1 ? `${stops[0]} to ${stops[stops.length - 1]}` : stops[0] ?? "Your route"}
                </h2>
                <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                  {countryFlags.length > 0 ? (
                    countryFlags.map((f, i) => (
                      <span key={i} className="text-[14px] leading-none" aria-hidden>
                        {f}
                      </span>
                    ))
                  ) : (
                    countryFlag && (
                      <span className="text-[14px] leading-none" aria-hidden>
                        {countryFlag}
                      </span>
                    )
                  )}
                  <span
                    className="text-[12px] font-semibold outline-none"
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
              </div>

              {/* Start point */}
              <div
                className="pb-2.5 mb-2.5"
                style={{ borderBottom: `1px solid ${tokens.border}` }}
              >
                <div
                  className="text-[9px] uppercase tracking-[0.22em] font-semibold mb-0.5"
                  style={{ color: tokens.mutedText }}
                >
                  Start
                </div>
                <div
                  className="text-[12.5px] outline-none"
                  style={{ color: tokens.headingText }}
                  contentEditable={isEditor}
                  suppressContentEditableWarning
                  onBlur={(e) =>
                    updateSectionContent(section.id, { startPoint: e.currentTarget.textContent ?? "" })
                  }
                >
                  {startPoint}
                </div>
              </div>

              {/* Day cards — thumbnail + label + place + property name */}
              {groupedRows.length > 0 ? (
                <ul className="space-y-1.5 flex-1">
                  {groupedRows.map((row, i) => {
                    const prop = findProperty(row.accommodation);
                    const thumb = prop?.leadImageUrl ?? null;
                    return (
                      <li
                        key={i}
                        className="flex items-center gap-2.5 p-2 rounded-md transition"
                        style={{
                          background: tokens.cardBg,
                          border: `1px solid ${tokens.border}`,
                        }}
                      >
                        {thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={thumb}
                            alt=""
                            className="shrink-0 object-cover"
                            style={{ width: 40, height: 40, borderRadius: 4 }}
                          />
                        ) : (
                          <div
                            className="shrink-0 flex items-center justify-center font-bold tabular-nums"
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: 4,
                              background: `${tokens.accent}1c`,
                              color: tokens.accent,
                              fontSize: 12,
                            }}
                          >
                            {row.startDay}
                          </div>
                        )}
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
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="flex-1 py-6 text-center text-[12px]" style={{ color: tokens.mutedText }}>
                  {isEditor ? "Add days to populate the route." : "Route coming soon."}
                </div>
              )}

              {/* End point — when the itinerary ends in a park, the
                  rail labels it as "Last safari stop" and shows the
                  TBC drop-off note instead of pretending the park is
                  the trip's terminus. */}
              <div
                className="pt-2.5 mt-2.5"
                style={{ borderTop: `1px solid ${tokens.border}` }}
              >
                <div
                  className="text-[9px] uppercase tracking-[0.22em] font-semibold mb-0.5"
                  style={{ color: tokens.mutedText }}
                >
                  {safari.endsInPark ? "Last safari stop" : "End"}
                </div>
                <div
                  className="text-[12.5px] outline-none"
                  style={{ color: tokens.headingText }}
                  contentEditable={isEditor}
                  suppressContentEditableWarning
                  onBlur={(e) =>
                    updateSectionContent(section.id, { endPoint: e.currentTarget.textContent ?? "" })
                  }
                >
                  {safari.endsInPark ? safari.lastSafariStop : endPoint}
                </div>
                {safari.endsInPark && (
                  <div
                    className="mt-1.5 text-[10.5px] italic"
                    style={{ color: tokens.mutedText }}
                  >
                    Final transfer to be confirmed
                  </div>
                )}
              </div>

              {/* Tiny attribution + optional caption tucked at the
                  bottom of the rail so the map column stays clean.
                  Caption stays editable; map-data attribution is fixed. */}
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
                  onBlur={(e) =>
                    updateSectionContent(section.id, { caption: e.currentTarget.textContent ?? "" })
                  }
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
            </aside>

            {/* ── Map — stretches to MATCH the rail's natural height
                via the grid's items-stretch. The main map zooms tight
                on inland-only stops; if the trip has offshore
                destinations (Zanzibar, Mombasa, etc.) a small inset
                in the bottom-right shows them in geographic context. */}
            <div className="min-w-0 flex flex-col relative">
              {days.length > 0 ? (
                <div className="overflow-hidden flex-1 min-h-0 relative">
                  <RouteMap
                    days={days}
                    tokens={tokens}
                    cachedCoords={cachedCoords}
                    onCoordsResolved={(coords) => {
                      if (isEditor) {
                        updateSectionContent(section.id, { coords });
                      }
                    }}
                    height="100%"
                    presentationMode={!isEditor}
                    viewportMode="inland-only"
                  />
                  {/* Inset overview removed — the main map now carries
                      the full route including offshore extensions to
                      the coast (Zanzibar etc.), with a spotlight mask
                      dimming the unvisited geography around it. The
                      inset duplicated information without adding
                      geographic context the spotlight doesn't already
                      give. */}
                </div>
              ) : (
                <div
                  className="flex items-center justify-center text-[13px] flex-1"
                  style={{
                    background: tokens.cardBg,
                    color: tokens.mutedText,
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

  // ── Typographic timeline (legacy variants) ───────────────────────────
  return (
    <div className="py-2 md:py-3" style={{ background: tokens.sectionSurface }}>
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

  // Bumped from 720 → 880 to match the route variant — wider geographic
  // bounds need more vertical pixel space to keep the route lines and
  // badge labels readable.
  const MAP_HEIGHT = 880;

  // Use tokens.sectionSurface, never tokens.pageBg — every map variant
  // (route / interactive / default / full-width) needs its own
  // configurable section background so operators can recolour the
  // block from the section chrome. Using pageBg makes the section
  // adopt page-level cream instead and looks like a missing wrapper.
  // See memory/map_and_routing_rules.md (rule 5 for map variants).
  return (
    <div className="py-2 md:py-3" style={{ background: tokens.sectionSurface }}>
      <div className="mx-auto px-4 md:px-6" style={{ maxWidth: 1280 }}>
        {/* Card-rail (240px) + dominant map. Title + country chip live
            inside the rail header so the map can stretch the section's
            full vertical room. Same proportions as the route variant. */}
        <div className="grid grid-cols-1 md:grid-cols-[240px_minmax(0,1fr)] gap-4 md:gap-5 items-stretch">
          {/* Sidebar */}
          <div
            className="flex flex-col pr-1 overflow-y-auto"
            style={{ maxHeight: MAP_HEIGHT }}
          >
            {/* Rail header */}
            <div className="mb-3">
              <div
                className="text-[9.5px] uppercase tracking-[0.28em] font-semibold mb-1"
                style={{ color: tokens.mutedText }}
              >
                Map
              </div>
              <h2
                className="font-bold leading-[1.15]"
                style={{
                  color: tokens.headingText,
                  fontFamily: `'${theme.displayFont}', serif`,
                  fontSize: "clamp(16px, 1.6vw, 19px)",
                  letterSpacing: "-0.005em",
                }}
              >
                {stops.length > 1 ? `${stops[0]} to ${stops[stops.length - 1]}` : stops[0] ?? "Your route"}
              </h2>
              <div className="mt-2 flex items-center gap-1.5">
                {countryFlag && (
                  <span className="text-[14px] leading-none" aria-hidden>
                    {countryFlag}
                  </span>
                )}
                <span
                  className="text-[12px] font-semibold outline-none"
                  style={{ color: tokens.headingText }}
                  contentEditable={isEditor}
                  suppressContentEditableWarning
                  onBlur={(e) => onCountryNameChange(e.currentTarget.textContent ?? "")}
                >
                  {countryName}
                </span>
              </div>
            </div>

            {/* Start point */}
            <div
              className="pb-2.5 mb-2.5"
              style={{ borderBottom: `1px solid ${tokens.border}` }}
            >
              <div
                className="text-[9px] uppercase tracking-[0.22em] font-semibold mb-0.5"
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

          {/* ── Map — dominant column ─────────────────────────── */}
          <div className="min-w-0">
            {days.length > 0 ? (
              <div
                className="overflow-hidden"
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
                  height={MAP_HEIGHT}
                  selectedDayId={selectedDayId}
                  presentationMode={!isEditor}
                />
              </div>
            ) : (
              <div
                className="flex items-center justify-center text-[13px]"
                style={{
                  height: MAP_HEIGHT,
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
