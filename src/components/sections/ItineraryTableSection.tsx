"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import { resolveTokens } from "@/lib/theme";
import type { Day, Section } from "@/lib/types";

// "Itinerary at a glance" — multiple variants:
//
//  • horizontal-rows     (default) — magazine table with a dark header bar
//    and zebra-striped rows. Consecutive days that share a destination
//    collapse into a single grouped row ("Days 2-3 · 17-18 May · Tarangire").
//  • editorial-timeline  — vertical journey rail; day-card on the left,
//    activity + accommodation rows on the right linked by a dashed line.
//    Icons are recolourable per section via a hover-revealed style picker.
//  • default             — at-a-glance stats strip + per-day table below.
//  • compact             — same as default but tighter padding (legacy).
//
// Every variant pulls its background from `tokens.sectionSurface` (resolved
// from the section's styleOverrides) so operators can recolour the block
// from the section chrome without code changes.

export function ItineraryTableSection({ section }: { section: Section }) {
  const { proposal, updateSectionContent } = useProposalStore();
  const { days, activeTier, client, trip, theme } = proposal;
  const tokens = resolveTokens(theme.tokens, section.styleOverrides);
  const variant = section.layoutVariant || "horizontal-rows";
  const { mode } = useEditorStore();
  const isEditor = mode === "editor";

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

  if (variant === "editorial-timeline") {
    return (
      <EditorialTimelineLayout
        days={days}
        activeTier={activeTier}
        arrivalDateISO={trip.arrivalDate}
        tokens={tokens}
        theme={theme}
        isEditor={isEditor}
        activityColor={section.content.timelineActivityColor as string | undefined}
        accommodationColor={section.content.timelineAccommodationColor as string | undefined}
        onStyleChange={(next) =>
          updateSectionContent(section.id, {
            timelineActivityColor: next.activityColor,
            timelineAccommodationColor: next.accommodationColor,
          })
        }
      />
    );
  }

  // ── Legacy "default" / "compact" — at-a-glance stats + classic table ──
  const compact = variant === "compact";
  // Route reads "Arusha → Zanzibar" — start to end. Replaced the old
  // "Destinations" cell which jammed up to 6 names into a 25%-width
  // column with awkward middot wrapping. The full route still lives
  // in the day-by-day table below; the at-a-glance just gives clients
  // the trip's geographic arc in one glance.
  const orderedDayDestinations = [...new Set(days.map((d) => d.destination))];
  const allDestinations =
    orderedDayDestinations.length > 0 ? orderedDayDestinations : trip.destinations;
  const route =
    allDestinations.length > 1
      ? `${allDestinations[0]} → ${allDestinations[allDestinations.length - 1]}`
      : allDestinations[0] || "—";
  const duration = trip.nights
    ? `${trip.nights + 1} days · ${trip.nights} nights`
    : days.length
      ? `${days.length} days`
      : trip.dates;
  const stats: { label: string; value: string }[] = [
    { label: "Duration", value: duration || "—" },
    { label: "Route", value: route },
    { label: "Guests", value: client.guestNames || "—" },
    { label: "Style", value: trip.tripStyle || trip.subtitle || "—" },
  ];

  return (
    <div
      className={`${compact ? "py-2" : "py-2 md:py-3"} px-8 md:px-20`}
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
    <div className="py-2 md:py-3 px-8 md:px-20" style={{ background: tokens.sectionSurface }}>
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

// ─── Editorial timeline variant ───────────────────────────────────────────
//
// Vertical journey rail. Each day stacks two rows: a coloured circular
// activity icon + uppercase activity title, then a coloured circular
// accommodation icon + italic "Accommodation" label + uppercase camp
// name. A dashed vertical line links the icons day-to-day.
//
// Activity title source: day.subtitle (operator-written) → fallback to
// day.destination. Day 1 falls back to "ARRIVAL"; the last day falls
// back to "DEPARTURE". Day 1 + last day get an aeroplane icon; mid days
// get a paw print.
//
// Colours are operator-pickable per section via a hover-revealed style
// affordance that mirrors the contact-cards pattern. Glyphs stay white
// for high contrast — no separate glyph-colour exposed.

const DEFAULT_ACTIVITY_COLOR = "#e88c2e";       // warm safari orange
const DEFAULT_ACCOMMODATION_COLOR = "#b34334";  // editorial brick red

function EditorialTimelineLayout({
  days,
  activeTier,
  arrivalDateISO,
  tokens,
  theme,
  isEditor,
  activityColor,
  accommodationColor,
  onStyleChange,
}: {
  days: Day[];
  activeTier: keyof Day["tiers"];
  arrivalDateISO: string | undefined;
  tokens: ReturnType<typeof resolveTokens>;
  theme: { displayFont: string; bodyFont: string };
  isEditor: boolean;
  activityColor?: string;
  accommodationColor?: string;
  onStyleChange: (next: { activityColor?: string; accommodationColor?: string }) => void;
}) {
  const aColor = activityColor || DEFAULT_ACTIVITY_COLOR;
  const accColor = accommodationColor || DEFAULT_ACCOMMODATION_COLOR;

  return (
    <div className="py-12 md:py-16 px-6 md:px-12" style={{ background: tokens.sectionSurface }}>
      <div className="relative group max-w-3xl mx-auto">
        <div
          className="text-[10px] uppercase tracking-[0.3em] mb-10"
          style={{ color: tokens.mutedText }}
        >
          Itinerary at a glance
        </div>

        {days.length === 0 ? (
          <div className="text-center py-14 text-[13px]" style={{ color: tokens.mutedText }}>
            Add days in the Day-by-Day section to populate this timeline.
          </div>
        ) : (
          <ol className="relative">
            {days.map((day, idx) => (
              <TimelineRow
                key={day.id}
                day={day}
                idx={idx}
                lastIdx={days.length - 1}
                activeTier={activeTier}
                arrivalDateISO={arrivalDateISO}
                tokens={tokens}
                theme={theme}
                activityColor={aColor}
                accommodationColor={accColor}
                isEditor={isEditor}
              />
            ))}
          </ol>
        )}

        {isEditor && (
          <TimelineStyleControl
            activityColor={aColor}
            accommodationColor={accColor}
            onChange={onStyleChange}
          />
        )}
      </div>
    </div>
  );
}

function TimelineRow({
  day,
  idx,
  lastIdx,
  activeTier,
  arrivalDateISO,
  tokens,
  theme,
  activityColor,
  accommodationColor,
  isEditor,
}: {
  day: Day;
  idx: number;
  lastIdx: number;
  activeTier: keyof Day["tiers"];
  arrivalDateISO: string | undefined;
  tokens: ReturnType<typeof resolveTokens>;
  theme: { displayFont: string; bodyFont: string };
  activityColor: string;
  accommodationColor: string;
  isEditor: boolean;
}) {
  const isFirst = idx === 0;
  const isLast = idx === lastIdx;
  const dayDate = resolveDayDateLabel(day, arrivalDateISO);

  // Activity title: subtitle wins (operator-written), else destination.
  // Day 1 + last day get the special "ARRIVAL" / "DEPARTURE" fallback so
  // a thin draft still reads like a journey.
  const activityTitle =
    (day.subtitle && day.subtitle.trim()) ||
    (isFirst ? "ARRIVAL" : isLast ? "DEPARTURE" : day.destination || "");

  // Accommodation logic: tiers[activeTier].camp can be empty when the AI
  // didn't pick a property for that tier (or the operator deleted it).
  // - In editor: always render the row so the operator sees the slot
  //   and remembers to fill it (placeholder text in muted colour).
  // - In preview/share: only render when camp is non-empty so clients
  //   never see an empty "Accommodation —" stub.
  // Removed the previous `!isLast` rule — some last-night-before-flight
  // trips legitimately have an accommodation on the final day.
  const camp = day.tiers[activeTier]?.camp?.trim() || "";
  const showAccommodation = !!camp || isEditor;

  // Last row in the list shouldn't extend the dashed connector down past
  // its own content (no next day to connect to).
  const showConnectorBelow = !isLast;

  return (
    <li className="relative pb-10 last:pb-0">
      {/* Dashed connector — runs vertically through the icon column to
          the next day's activity icon. Positioned behind the icons. */}
      {showConnectorBelow && (
        <span
          aria-hidden
          className="absolute"
          style={{
            left: 92,
            top: 18,
            bottom: -10,
            width: 0,
            borderLeft: `1.5px dashed ${tokens.border}`,
          }}
        />
      )}

      {/* Activity row — day card + activity icon + title */}
      <div className="grid grid-cols-[64px_36px_1fr] items-center gap-x-4 mb-6">
        <DayCard dayNumber={day.dayNumber} dateLabel={dayDate} tokens={tokens} theme={theme} />
        <IconChip
          color={activityColor}
          glyph={isFirst || isLast ? <PlaneGlyph /> : <PawGlyph />}
        />
        <div
          className="text-[14px] font-bold uppercase tracking-[0.04em] leading-tight"
          style={{ color: tokens.headingText, fontFamily: `'${theme.bodyFont}', sans-serif` }}
        >
          {activityTitle}
        </div>
      </div>

      {/* Accommodation row — always rendered in editor so operators see
          the slot; in preview only rendered when there's a camp. */}
      {showAccommodation && (
        <div className="grid grid-cols-[64px_36px_1fr] items-start gap-x-4">
          <div /> {/* spacer to align with day-card column */}
          <IconChip color={accommodationColor} glyph={<LodgeGlyph />} />
          <div className="leading-snug">
            <div
              className="text-[12px] italic"
              style={{ color: tokens.mutedText, fontFamily: `'${theme.displayFont}', serif` }}
            >
              Accommodation
            </div>
            <div
              className="text-[13.5px] font-bold uppercase tracking-[0.04em] mt-0.5"
              style={{
                color: camp ? tokens.headingText : tokens.mutedText,
                fontFamily: `'${theme.bodyFont}', sans-serif`,
                fontStyle: camp ? "normal" : "italic",
                fontWeight: camp ? 700 : 400,
                opacity: camp ? 1 : 0.7,
              }}
            >
              {camp || "Set in Day-by-Day section"}
            </div>
          </div>
        </div>
      )}
    </li>
  );
}

function DayCard({
  dayNumber,
  dateLabel,
  tokens,
  theme,
}: {
  dayNumber: number;
  dateLabel: string;
  tokens: ReturnType<typeof resolveTokens>;
  theme: { displayFont: string; bodyFont: string };
}) {
  return (
    <div
      className="rounded-md px-2 py-1.5 text-center shadow-sm"
      style={{
        background: "#ffffff",
        border: `1px solid ${tokens.border}`,
      }}
    >
      <div
        className="text-[20px] font-bold leading-none tabular-nums"
        style={{ color: tokens.headingText, fontFamily: `'${theme.displayFont}', serif` }}
      >
        {dayNumber}
      </div>
      <div
        className="text-[8px] uppercase tracking-[0.18em] font-semibold mt-0.5"
        style={{ color: tokens.mutedText }}
      >
        {dateLabel ? dayShort(dateLabel) : "Day"}
      </div>
    </div>
  );
}

// "29 May 2026" → "29 May" so the day card stays compact.
function dayShort(label: string): string {
  const parts = label.split(/\s+/);
  if (parts.length >= 2) return `${parts[0]} ${parts[1]}`;
  return label;
}

function IconChip({ color, glyph }: { color: string; glyph: React.ReactNode }) {
  return (
    <div
      className="rounded-full flex items-center justify-center shadow-sm"
      style={{
        width: 36,
        height: 36,
        background: color,
        color: "#ffffff",
      }}
      aria-hidden
    >
      {glyph}
    </div>
  );
}

// Lucide-style glyphs sized for the 36px chip.
function PlaneGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>
    </svg>
  );
}

function PawGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="11" cy="4" r="2" />
      <circle cx="18" cy="8" r="2" />
      <circle cx="4" cy="8" r="2" />
      <circle cx="20" cy="14" r="2" />
      <path d="M8.5 11.5C7 13.5 5 15 5 17a4 4 0 0 0 4 4c1 0 2-.5 3-1 1 .5 2 1 3 1a4 4 0 0 0 4-4c0-2-2-3.5-3.5-5.5C14.5 10 13.5 9 12 9s-2.5 1-3.5 2.5z"/>
    </svg>
  );
}

function LodgeGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 21V10l9-6 9 6v11" />
      <path d="M9 21V14h6v7" />
    </svg>
  );
}

// ─── Timeline style picker ───────────────────────────────────────────────
//
// Same hover-pill + portal'd popover pattern as ContactCards. Two
// rows of swatches: activity icon colour, accommodation icon colour.
// Custom-hex picker per row.

const ACTIVITY_PRESETS = [
  { label: "Orange", value: "#e88c2e" },
  { label: "Gold", value: "#c9a84c" },
  { label: "Teal", value: "#1f3a3a" },
  { label: "Sage", value: "#2d5a40" },
  { label: "Copper", value: "#b06a3b" },
  { label: "Charcoal", value: "#1a1a1a" },
];

const ACCOMMODATION_PRESETS = [
  { label: "Brick", value: "#b34334" },
  { label: "Burgundy", value: "#7d2e2e" },
  { label: "Teal", value: "#1f3a3a" },
  { label: "Sage", value: "#2d5a40" },
  { label: "Copper", value: "#b06a3b" },
  { label: "Charcoal", value: "#1a1a1a" },
];

function TimelineStyleControl({
  activityColor,
  accommodationColor,
  onChange,
}: {
  activityColor: string;
  accommodationColor: string;
  onChange: (next: { activityColor?: string; accommodationColor?: string }) => void;
}) {
  const ref = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!open) return;
    const recompute = () => {
      if (ref.current) setAnchor(ref.current.getBoundingClientRect());
    };
    recompute();
    window.addEventListener("scroll", recompute, true);
    window.addEventListener("resize", recompute);
    return () => {
      window.removeEventListener("scroll", recompute, true);
      window.removeEventListener("resize", recompute);
    };
  }, [open]);

  return (
    <>
      <button
        ref={ref}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="absolute -top-2 right-0 px-2.5 py-1 rounded-full bg-black/80 text-white text-[10.5px] font-semibold shadow-md hover:bg-black transition-all duration-150 opacity-0 group-hover:opacity-100 backdrop-blur-sm flex items-center gap-1.5 print:hidden"
        title="Customise timeline icon colours"
        style={{ zIndex: 5 }}
      >
        🎨 Style
      </button>

      {open && anchor &&
        createPortal(
          <TimelineStylePopover
            anchor={anchor}
            activityColor={activityColor}
            accommodationColor={accommodationColor}
            onChange={onChange}
            onClose={() => setOpen(false)}
          />,
          document.body,
        )}
    </>
  );
}

function TimelineStylePopover({
  anchor,
  activityColor,
  accommodationColor,
  onChange,
  onClose,
}: {
  anchor: DOMRect;
  activityColor: string;
  accommodationColor: string;
  onChange: (next: { activityColor?: string; accommodationColor?: string }) => void;
  onClose: () => void;
}) {
  const W = 280;
  const left = Math.max(8, Math.min(anchor.right - W, window.innerWidth - W - 8));
  const top = anchor.bottom + 8;

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 10000 }} />
      <div
        className="ss-popover-in"
        style={{ position: "fixed", top, left, width: W, zIndex: 10001 }}
      >
        <div className="bg-white rounded-2xl shadow-2xl border border-black/8 overflow-hidden">
          <ColourSection
            label="Activity icon"
            presets={ACTIVITY_PRESETS}
            current={activityColor}
            onPick={(v) => onChange({ activityColor: v, accommodationColor })}
          />
          <ColourSection
            label="Accommodation icon"
            presets={ACCOMMODATION_PRESETS}
            current={accommodationColor}
            onPick={(v) => onChange({ activityColor, accommodationColor: v })}
          />
        </div>
      </div>
    </>
  );
}

function ColourSection({
  label,
  presets,
  current,
  onPick,
}: {
  label: string;
  presets: Array<{ label: string; value: string }>;
  current: string;
  onPick: (v: string) => void;
}) {
  return (
    <div className="px-4 py-3 border-t border-black/6 first:border-t-0">
      <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-black/45 mb-2">
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => (
          <button
            key={p.value}
            type="button"
            title={p.label}
            onClick={() => onPick(p.value)}
            className={`w-7 h-7 rounded-full transition ${
              current === p.value
                ? "ring-2 ring-[#1b3a2d] ring-offset-1"
                : "hover:scale-105"
            }`}
            style={{
              background: p.value,
              border:
                current === p.value
                  ? "1px solid rgba(255,255,255,0.6)"
                  : "1px solid rgba(0,0,0,0.08)",
            }}
          />
        ))}
      </div>
      <div className="mt-2.5 flex items-center gap-2">
        <input
          type="color"
          value={current.startsWith("#") && current.length === 7 ? current : "#101828"}
          onChange={(e) => onPick(e.target.value)}
          className="w-7 h-7 rounded border border-black/10 cursor-pointer p-0"
          title={`Custom ${label.toLowerCase()}`}
        />
        <span className="text-[11px] text-black/45">Custom hex</span>
      </div>
    </div>
  );
}
