"use client";

import { RouteMap, type RouteCoord } from "@/components/sections/RouteMap";
import { resolveSafariEndpoints } from "@/lib/safariRoutingRules";
import type { Day, Section, ThemeTokens, ProposalTheme } from "@/lib/types";
import { PrintSectionHeader } from "./PrintSectionHeader";

// ─── Print: full-A4 route map page ──────────────────────────────────────
//
// The on-screen MapSection renders a 240px sidebar rail (clickable day
// cards) next to the map. In print that rail eats half the page width;
// the day cards then duplicate info that's already in the day-by-day
// pages right after. Net: map gets 45% of A4 area.
//
// PrintMapPage drops the rail entirely. Map fills the full A4 width
// at the page's tallest possible height (after the editorial header).
// Map area: ~85% of A4, route fills it edge-to-edge.

export function PrintMapPage({
  section, days, theme, tokens,
}: {
  section: Section;
  days: Day[];
  theme: ProposalTheme;
  tokens: ThemeTokens;
}) {
  const cachedCoords = (section.content.coords as RouteCoord[] | undefined) ?? undefined;
  const caption = (section.content.caption as string | undefined) ?? "";
  const stops = days
    .slice()
    .sort((a, b) => a.dayNumber - b.dayNumber)
    .map((d) => d.destination)
    .filter((s, i, arr) => i === 0 || s !== arr[i - 1]);

  // Apply safari business rules for the title — trips don't END in
  // parks. If the itinerary appears to end at Tarangire/Serengeti/
  // etc., show "Arusha → Last safari stop: Serengeti" rather than
  // "Arusha to Serengeti" (which falsely suggests Serengeti is the
  // trip's terminus).
  const safari = resolveSafariEndpoints(stops);
  const title = (() => {
    if (stops.length <= 1) return safari.start || "Your route";
    if (safari.endsInPark) {
      return `${safari.start} → ${safari.lastSafariStop}`;
    }
    return `${safari.start} to ${safari.lastSafariStop}`;
  })();

  // Stats line — country span + nights — packed into the eyebrow so
  // we don't need a second label row stealing height from the map.
  const country =
    days.find((d) => d.country?.trim())?.country?.trim() || "";
  const nights = days.length;
  const eyebrow = [
    "Route map",
    country || null,
    `${stops.length} stops`,
    `${nights} ${nights === 1 ? "night" : "nights"}`,
  ]
    .filter(Boolean)
    .join("  ·  ");

  return (
    <div
      className="w-full h-full flex flex-col"
      style={{ background: tokens.pageBg, color: tokens.bodyText }}
    >
      <PrintSectionHeader
        eyebrow={eyebrow}
        title={title}
        subtitle={
          caption ||
          (safari.endsInPark
            ? "Final transfer details to be confirmed."
            : undefined)
        }
        theme={theme}
        tokens={tokens}
        padded
        compact
      />

      {/* Map area — flex-1 so it claims every remaining pixel of the
          A4 page. Min-height guard keeps it tall even when header is
          short. RouteMap is told to render at this exact height via
          the height prop — Leaflet sizes its tile canvas accordingly. */}
      <div
        className="relative flex-1 min-h-0 w-full overflow-hidden"
        style={{
          borderTop: `1px solid ${tokens.border}`,
          borderBottom: `1px solid ${tokens.border}`,
        }}
      >
        {/* Behind-map text route diagram. Sits at z-index 0 so the
            Leaflet map paints over it when tiles load successfully.
            When tiles fail (sidecar can't reach the tile provider,
            tile cache miss, etc.) this fallback shows through —
            the page reads as an editorial route summary instead of
            a giant black rectangle. Operator brief: "no broken
            pages." */}
        {stops.length > 0 && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center px-16"
            style={{ background: tokens.pageBg, zIndex: 0 }}
          >
            <div
              className="text-[10px] uppercase tracking-[0.24em] font-semibold mb-6"
              style={{ color: tokens.mutedText, opacity: 0.85 }}
            >
              The route
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-3 max-w-[700px]">
              {stops.map((stop, i) => (
                <span
                  key={`${stop}-${i}`}
                  className="inline-flex items-center gap-2"
                >
                  <span
                    className="text-[14px]"
                    style={{
                      color: tokens.headingText,
                      fontFamily: `'${theme.displayFont}', serif`,
                      fontWeight: 700,
                      letterSpacing: "-0.005em",
                    }}
                  >
                    {stop}
                  </span>
                  {i < stops.length - 1 && (
                    <span
                      aria-hidden
                      className="text-[14px]"
                      style={{ color: tokens.accent, opacity: 0.7 }}
                    >
                      →
                    </span>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}
        {days.length > 0 ? (
          <div className="absolute inset-0" style={{ zIndex: 1 }}>
            <RouteMap
              days={days}
              tokens={tokens}
              cachedCoords={cachedCoords}
              height={950}
              presentationMode={true}
            />
          </div>
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center text-[12px] uppercase tracking-[0.24em]"
            style={{ color: tokens.mutedText, zIndex: 1 }}
          >
            Route coming soon
          </div>
        )}
      </div>

      {/* Bottom strip — small route summary line so the page closes
          with intent. Keeps the visual weight on the map. */}
      <div className="px-12 py-3 flex items-center justify-between">
        <div
          className="text-[10px] uppercase tracking-[0.28em] font-semibold"
          style={{ color: tokens.mutedText }}
        >
          {stops.slice(0, 4).join("  ›  ")}
          {stops.length > 4 ? `  ›  +${stops.length - 4}` : ""}
        </div>
        <div
          className="text-[9px] tracking-wide"
          style={{ color: tokens.mutedText, opacity: 0.55 }}
        >
          Map data © OpenStreetMap contributors · CARTO
        </div>
      </div>
    </div>
  );
}
