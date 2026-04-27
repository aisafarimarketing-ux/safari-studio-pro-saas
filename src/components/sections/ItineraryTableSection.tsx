"use client";

import { useProposalStore } from "@/store/proposalStore";
import { resolveTokens } from "@/lib/theme";
import type { Day, Section } from "@/lib/types";

// "Itinerary at a glance" — three variants:
//
//  • horizontal-rows  (default) — magazine table with a dark header bar and
//    zebra-striped rows. Consecutive days that share a destination collapse
//    into a single grouped row ("Days 2-3 · 17-18 May · Tarangire · 2").
//  • default           — at-a-glance stats strip + per-day table below.
//  • compact           — same as default but tighter padding.
//
// Every variant pulls its background from `tokens.sectionSurface` (resolved
// from the section's styleOverrides) so operators can recolour the block
// from the section chrome without code changes.

export function ItineraryTableSection({ section }: { section: Section }) {
  const { proposal } = useProposalStore();
  const { days, activeTier, client, trip, theme } = proposal;
  const tokens = resolveTokens(theme.tokens, section.styleOverrides);
  const variant = section.layoutVariant || "horizontal-rows";

  if (variant === "horizontal-rows") {
    return (
      <HorizontalRowsLayout
        days={days}
        arrivalDateISO={trip.arrivalDate}
        tokens={tokens}
        theme={theme}
      />
    );
  }

  // ── Legacy "default" / "compact" — at-a-glance stats + classic table ──
  const compact = variant === "compact";
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
    <div
      className={`${compact ? "py-6" : "py-6 md:py-8"} px-8 md:px-20`}
      style={{ background: tokens.sectionSurface }}
    >
      <div className="max-w-5xl mx-auto">
        <div
          className="text-[10px] uppercase tracking-[0.3em] mb-10"
          style={{ color: tokens.mutedText }}
        >
          At a glance
        </div>

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
                    {resolveDayDateLabel(day, trip.arrivalDate) || "—"}
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

// ── Horizontal rows variant ───────────────────────────────────────────────

function HorizontalRowsLayout({
  days,
  arrivalDateISO,
  tokens,
  theme,
}: {
  days: Day[];
  arrivalDateISO: string | undefined;
  tokens: ReturnType<typeof resolveTokens>;
  theme: { displayFont: string; bodyFont: string };
}) {
  const groups = groupConsecutive(days, arrivalDateISO);
  const headerBg = tokens.headingText;
  const headerText = "rgba(255,255,255,0.78)";
  const stripeBg = blendForStripe(tokens.sectionSurface, tokens.border);

  return (
    <div className="py-6 md:py-8 px-8 md:px-20" style={{ background: tokens.sectionSurface }}>
      <div className="max-w-6xl mx-auto">
        <div
          className="text-[10px] uppercase tracking-[0.3em] mb-8"
          style={{ color: tokens.mutedText }}
        >
          Trip at a glance
        </div>

        <div className="overflow-x-auto">
          <table className="w-full" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: headerBg }}>
                {["Day", "Date", "Location", "Activities", "Nights"].map((h, i) => (
                  <th
                    key={h}
                    className={`text-[10px] font-semibold uppercase tracking-[0.28em] py-5 ${
                      i === 4 ? "pr-8 text-right" : "px-8 text-left"
                    }`}
                    style={{ color: headerText }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map((g, idx) => (
                <tr
                  key={g.id}
                  style={{
                    background: idx % 2 === 0 ? "transparent" : stripeBg,
                  }}
                >
                  <td
                    className="px-8 py-7 align-top text-[14px]"
                    style={{
                      color: tokens.headingText,
                      fontFamily: `'${theme.displayFont}', serif`,
                    }}
                  >
                    {g.dayLabel}
                  </td>
                  <td
                    className="px-8 py-7 align-top text-[14px]"
                    style={{
                      color: tokens.headingText,
                      fontFamily: `'${theme.displayFont}', serif`,
                    }}
                  >
                    {g.dateLabel}
                  </td>
                  <td
                    className="px-8 py-7 align-top text-[14px]"
                    style={{
                      color: tokens.headingText,
                      fontFamily: `'${theme.displayFont}', serif`,
                    }}
                  >
                    {g.location}
                  </td>
                  <td
                    className="px-8 py-7 align-top text-[14px] leading-[1.55]"
                    style={{ color: tokens.bodyText }}
                  >
                    {g.activities}
                  </td>
                  <td
                    className="pr-8 py-7 align-top text-[14px] text-right tabular-nums"
                    style={{ color: tokens.headingText }}
                  >
                    {g.nights}
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

// ── Helpers ───────────────────────────────────────────────────────────────

interface DayGroup {
  id: string;
  dayLabel: string;
  dateLabel: string;
  location: string;
  activities: string;
  nights: number;
}

function groupConsecutive(days: Day[], arrivalDateISO: string | undefined): DayGroup[] {
  if (days.length === 0) return [];
  const sorted = [...days].sort((a, b) => a.dayNumber - b.dayNumber);
  const groups: Day[][] = [];
  let cur: Day[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const prev = cur[cur.length - 1];
    const d = sorted[i];
    const sameDest =
      d.destination &&
      prev.destination &&
      d.destination.trim().toLowerCase() === prev.destination.trim().toLowerCase();
    const consecutive = d.dayNumber === prev.dayNumber + 1;
    if (sameDest && consecutive) {
      cur.push(d);
    } else {
      groups.push(cur);
      cur = [d];
    }
  }
  groups.push(cur);

  return groups.map((g) => {
    const first = g[0];
    const last = g[g.length - 1];
    const dayLabel =
      g.length === 1
        ? `Day ${first.dayNumber}`
        : `Days ${first.dayNumber}-${last.dayNumber}`;
    const firstDate = resolveDayDateLabel(first, arrivalDateISO);
    const lastDate = resolveDayDateLabel(last, arrivalDateISO);
    const dateLabel = formatDateRange(firstDate, lastDate);
    const location = [first.destination, first.country].filter(Boolean).join(", ");
    const activities = composeActivities(g);
    return {
      id: first.id,
      dayLabel,
      dateLabel,
      location,
      activities,
      nights: g.length,
    };
  });
}

// Resolve a day's date — prefers any explicit `day.date` typed by the
// operator, otherwise derives from the trip's arrival date plus the day
// offset. Mirrors the resolver used by the day cards so both blocks
// agree on what date each day falls on.
function resolveDayDateLabel(day: Day, arrivalDateISO: string | undefined): string {
  const explicit = day.date?.trim();
  if (explicit) {
    const parsed = parseISODate(explicit);
    if (parsed) return formatTableDate(parsed);
    // Operator typed a free-form string like "16 May 2026" — use as-is.
    return explicit;
  }
  if (!arrivalDateISO) return "";
  const start = parseISODate(arrivalDateISO);
  if (!start) return "";
  start.setUTCDate(start.getUTCDate() + Math.max(0, day.dayNumber - 1));
  return formatTableDate(start);
}

function parseISODate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return isNaN(d.getTime()) ? null : d;
}

function formatTableDate(d: Date): string {
  const day = d.toLocaleDateString("en-US", { day: "numeric", timeZone: "UTC" });
  const month = d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  const year = d.toLocaleDateString("en-US", { year: "numeric", timeZone: "UTC" });
  return `${day} ${month} ${year}`;
}

// Collapse a date range. When both endpoints share the same trailing
// tokens (eg. "May 2026") render "16-18 May 2026"; otherwise fall back
// to "16 May – 02 June 2026". Single-day groups just return the date.
function formatDateRange(a: string, b: string): string {
  if (!a) return "—";
  if (!b || a === b) return a;
  const aParts = a.trim().split(/\s+/);
  const bParts = b.trim().split(/\s+/);
  let shared = 0;
  while (
    shared < Math.min(aParts.length, bParts.length) - 1 &&
    aParts[aParts.length - 1 - shared].toLowerCase() ===
      bParts[bParts.length - 1 - shared].toLowerCase()
  ) {
    shared++;
  }
  if (shared > 0) {
    const aHead = aParts.slice(0, aParts.length - shared).join(" ");
    const bHead = bParts.slice(0, bParts.length - shared).join(" ");
    const tail = aParts.slice(aParts.length - shared).join(" ");
    return `${aHead}-${bHead} ${tail}`;
  }
  return `${a} – ${b}`;
}

function composeActivities(group: Day[]): string {
  // Prefer per-day highlights when the operator wrote them; otherwise fall
  // back to the day description, trimmed to one tidy sentence.
  const lines: string[] = [];
  for (const d of group) {
    if (d.highlights && d.highlights.length) {
      lines.push(d.highlights.filter(Boolean).slice(0, 2).join(", "));
    } else if (d.description) {
      lines.push(firstSentence(d.description));
    }
  }
  const filtered = lines.filter(Boolean);
  return filtered.length ? filtered.join(", ") : "—";
}

function firstSentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  const match = /^(.+?[.!?])(\s|$)/.exec(trimmed);
  if (match) return match[1].trim();
  // Otherwise take the first ~120 chars on a word boundary.
  if (trimmed.length <= 140) return trimmed;
  return trimmed.slice(0, 120).replace(/\s+\S*$/, "") + "…";
}

// Mix the section background with its border colour to make a subtle
// alternating-row tint that respects whatever palette the operator picked.
function blendForStripe(surface: string, border: string): string {
  const s = parseColour(surface);
  const b = parseColour(border);
  if (!s || !b) return `rgba(0,0,0,0.025)`;
  const mix = (a: number, c: number) => Math.round(a * 0.94 + c * 0.06);
  return `rgb(${mix(s.r, b.r)}, ${mix(s.g, b.g)}, ${mix(s.b, b.b)})`;
}

function parseColour(input: string): { r: number; g: number; b: number } | null {
  const t = input.trim();
  if (!t) return null;
  if (t.startsWith("#")) {
    const h = t.slice(1);
    const v =
      h.length === 3
        ? h.split("").map((c) => parseInt(c + c, 16))
        : h.length === 6
          ? [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
          : null;
    if (!v) return null;
    return { r: v[0], g: v[1], b: v[2] };
  }
  const m = /rgba?\(([^)]+)\)/.exec(t);
  if (m) {
    const parts = m[1].split(",").map((s) => Number(s.trim()));
    if (parts.length >= 3 && parts.slice(0, 3).every((n) => Number.isFinite(n))) {
      return { r: parts[0], g: parts[1], b: parts[2] };
    }
  }
  return null;
}
