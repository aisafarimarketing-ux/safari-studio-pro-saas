"use client";

import type {
  Day,
  Property,
  ProposalTheme,
  ThemeTokens,
  TierKey,
  OptionalActivity,
} from "@/lib/types";
import { PrintSectionHeader } from "./PrintSectionHeader";

// ─── Print: per-day pages ─────────────────────────────────────────────────
//
// Two-page-per-day pagination for the printed deck. Page 1 carries the
// "story" of the day (badge, hero photo, narrative). Page 2 — only
// rendered when the day actually has tail content — is the practical
// half (optional add-ons + accommodation gallery). The orchestrator
// asks `dayHasTailContent()` to decide whether to emit the second
// PdfPage; if false, the day is one clean A4 page.
//
// This keeps every day visually intentional and cap-bound:
//   - Long narratives no longer collide with optional rows
//   - Days with rich optional + accommodation content get the room
//     they need for legibility
//   - Days that are pure "transit" or "rest" stay one page
//
// All copy is non-editable in print mode — these components are
// share/print-only so we don't need contentEditable plumbing.

export type ResolvedProperty = {
  name: string;
  location: string;
  shortDesc: string;
  mealPlan?: string;
  amenities: string[];
  leadImageUrl: string | null;
  galleryUrls: string[];
};

// True when a day carries enough content to warrant a second printed
// page. Bar set HIGH so most days render as one full A4 page.
//
// Real-world data (live debug overlay): days with continuations were
// running 32% on main + 60% on tail — i.e. the split was making both
// pages worse, not better. New rule: only split when the day genuinely
// can't fit on one page.
//
// Triggers (any one):
//   - 5+ optional activities (a chip strip caps at ~4)
//   - narrative > 1500 chars (an 8-line clamp can hold ~1200; beyond
//     that we'd start losing meaningful prose)
//   - property has 4+ gallery images we want to show full-size
//
// Everything else stays single-page. The main page already absorbs
// the accommodation summary + a 3-tile gallery strip + activity chips,
// so a typical day fills 75-90% of A4 with no tail.
export function dayHasTailContent(
  day: Day,
  property: ResolvedProperty | null,
): boolean {
  const activities = day.optionalActivities ?? [];
  const narrativeLen = (day.description ?? "").trim().length;
  const galleryCount = property
    ? property.galleryUrls.filter(Boolean).length + (property.leadImageUrl ? 1 : 0)
    : 0;

  const manyActivities = activities.length >= 5;
  const longNarrative = narrativeLen > 1500;
  const richGallery = galleryCount >= 4;

  return manyActivities || longNarrative || richGallery;
}

export function resolveDayProperty(
  day: Day,
  properties: Property[],
  activeTier: TierKey,
): ResolvedProperty | null {
  const camp = day.tiers?.[activeTier]?.camp?.trim();
  if (!camp) return null;
  const match = properties.find(
    (p) => p.name.trim().toLowerCase() === camp.toLowerCase(),
  );
  if (!match) {
    return {
      name: camp,
      location: day.tiers?.[activeTier]?.location ?? "",
      shortDesc: day.tiers?.[activeTier]?.note ?? "",
      mealPlan: day.board ?? "",
      amenities: [],
      leadImageUrl: null,
      galleryUrls: [],
    };
  }
  return {
    name: match.name,
    location: match.location || "",
    shortDesc: (match.shortDesc || match.description || "").trim(),
    mealPlan: match.mealPlan || day.board || "",
    amenities: (match.amenities ?? []).slice(0, 4),
    leadImageUrl: match.leadImageUrl || null,
    galleryUrls: (match.galleryUrls ?? []).filter(Boolean),
  };
}

// ─── Page 1 — story (and accommodation summary when no tail) ──────────────

export function PrintDayPageMain({
  day, dayDate, theme, tokens, totalDays, property, hasTail,
}: {
  day: Day;
  dayDate: string | null;
  theme: ProposalTheme;
  tokens: ThemeTokens;
  totalDays: number;
  /** Resolved property for THIS day. Surfaced inline on the main page
   *  when there's no continuation page so the day still feels complete. */
  property: ResolvedProperty | null;
  /** When false, the main page is the only page for this day, so we
   *  pack accommodation summary + few activities into the bottom. */
  hasTail: boolean;
}) {
  const destination = day.destination?.trim() || "New Destination";
  const phase = day.subtitle?.trim() || "";
  const narrative = day.description?.trim() || "";
  const heroUrl = day.heroImageUrl?.trim() || null;
  const activities = day.optionalActivities ?? [];

  return (
    <div
      className="w-full h-full flex flex-col"
      style={{ background: tokens.pageBg, color: tokens.bodyText }}
    >
      <PrintSectionHeader
        eyebrow={`Day ${String(day.dayNumber).padStart(2, "0")} of ${totalDays}${dayDate ? `  ·  ${dayDate}` : ""}`}
        title={destination}
        subtitle={phase || undefined}
        theme={theme}
        tokens={tokens}
        padded
      />

      {/* Hero — when this day has a tail page (rich content), the hero
          is generous (44%). Single-page days get a slightly shorter hero
          (38%) so the bottom can carry accommodation + activities.
          Skipped entirely when the day has no heroImageUrl: the
          previous "branded fallback" rendered a gradient + destination
          label inside the wrapper, but on dark themes both gradient
          and text colour collapsed into the page bg, leaving a 38%
          tall black rectangle with no readable content. Better to
          give that space back to narrative + accommodation. */}
      {heroUrl && (
        <div
          className="relative w-full shrink-0 overflow-hidden"
          style={{
            height: hasTail ? "44%" : "38%",
            background: tokens.cardBg,
            borderTop: `1px solid ${tokens.border}`,
            borderBottom: `1px solid ${tokens.border}`,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={heroUrl}
            alt={destination}
            className="absolute inset-0 w-full h-full object-cover"
            style={{ objectPosition: day.heroImagePosition || "center" }}
          />
        </div>
      )}

      <div className="flex-1 min-h-0 px-12 pt-7 pb-9 flex flex-col gap-5">
        {/* Narrative — clamped so a runaway essay never blows the page.
            When there's a tail page, give the narrative full room. When
            single-page, clamp tighter so accommodation + activities fit. */}
        {narrative ? (
          <NarrativeBody
            narrative={narrative}
            tokens={tokens}
            clamp={hasTail ? undefined : 8}
          />
        ) : (
          <p className="text-[13px] italic" style={{ color: tokens.mutedText }}>
            (No narrative for this day.)
          </p>
        )}

        {/* Accommodation summary + property gallery strip + activity
            chips — packs the bottom of single-page days so the page
            actually fills A4. When this day HAS a tail page, only the
            accommodation header chips live here; the full gallery +
            full activity table go on the tail. */}
        {!hasTail && property && (
          <div className="mt-auto space-y-4">
            <MainPageAccommodation property={property} theme={theme} tokens={tokens} />
            <MainPageGallery property={property} tokens={tokens} />
            {activities.length > 0 && (
              <MainPageActivityChips activities={activities} tokens={tokens} />
            )}
          </div>
        )}
        {!hasTail && !property && activities.length > 0 && (
          <div className="mt-auto">
            <MainPageActivityChips activities={activities} tokens={tokens} />
          </div>
        )}
      </div>
    </div>
  );
}

// Compact accommodation row for single-page days — name + location +
// meal/amenity chips on one line, no big gallery (gallery + description
// are reserved for the tail page when one exists).
function MainPageAccommodation({
  property, theme, tokens,
}: {
  property: ResolvedProperty;
  theme: ProposalTheme;
  tokens: ThemeTokens;
}) {
  const meal = humaniseMealPlan(property.mealPlan);
  return (
    <div
      className="flex items-baseline justify-between gap-3 flex-wrap pt-3"
      style={{ borderTop: `1px solid ${tokens.border}` }}
    >
      <div className="min-w-0">
        <div
          className="text-[9.5px] uppercase tracking-[0.28em] font-semibold mb-0.5"
          style={{ color: tokens.mutedText }}
        >
          Accommodation
        </div>
        <h3
          className="text-[15px] font-bold leading-[1.15]"
          style={{
            color: tokens.headingText,
            fontFamily: `'${theme.displayFont}', serif`,
          }}
        >
          {property.name}
        </h3>
        {property.location && (
          <div
            className="text-[11px] italic"
            style={{ color: tokens.mutedText }}
          >
            {property.location}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5 flex-wrap justify-end">
        {meal && (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-medium"
            style={{
              color: tokens.bodyText,
              background: `${tokens.accent}12`,
              border: `1px solid ${tokens.accent}26`,
            }}
          >
            <span style={{ color: tokens.accent }}>●</span>
            {meal}
          </span>
        )}
        {property.amenities.slice(0, 3).map((a) => (
          <span
            key={a}
            className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px]"
            style={{
              color: tokens.bodyText,
              background: tokens.cardBg,
              border: `1px solid ${tokens.border}`,
            }}
          >
            {a}
          </span>
        ))}
      </div>
    </div>
  );
}

// 3-tile gallery strip for single-page days. Lead image + first two
// gallery URLs. Same fallback as the tail-page version: empty tiles
// render a soft gradient + accent rule, never "No photo" text.
function MainPageGallery({
  property, tokens,
}: {
  property: ResolvedProperty;
  tokens: ThemeTokens;
}) {
  const tiles = [
    property.leadImageUrl,
    property.galleryUrls[0] ?? null,
    property.galleryUrls[1] ?? null,
  ];
  const hasAny = tiles.some(Boolean);
  if (!hasAny) return null;
  return (
    <div
      className="grid grid-cols-3 gap-1.5"
      style={{ height: 130, background: tokens.cardBg }}
    >
      {tiles.map((url, i) => (
        <div
          key={i}
          className="overflow-hidden h-full"
          style={{ background: tokens.cardBg }}
        >
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={i === 0 ? property.name : ""}
              className="w-full h-full object-cover"
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${tokens.cardBg} 0%, ${tokens.sectionSurface} 100%)`,
              }}
              aria-hidden
            >
              <div
                className="h-px"
                style={{ width: 16, background: tokens.accent, opacity: 0.55 }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function MainPageActivityChips({
  activities, tokens,
}: {
  activities: OptionalActivity[];
  tokens: ThemeTokens;
}) {
  return (
    <div>
      <div
        className="text-[9.5px] uppercase tracking-[0.28em] font-semibold mb-2"
        style={{ color: tokens.mutedText }}
      >
        Optional · {activities.length} {activities.length === 1 ? "add-on" : "add-ons"}
      </div>
      <ul className="flex flex-wrap gap-1.5">
        {activities.slice(0, 4).map((a) => (
          <li
            key={a.id}
            className="text-[11px] px-2.5 py-1 rounded-full"
            style={{
              color: tokens.bodyText,
              background: tokens.cardBg,
              border: `1px solid ${tokens.border}`,
            }}
          >
            {a.title}
            {a.timeOfDay ? ` · ${a.timeOfDay}` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Page 2 — continuation ────────────────────────────────────────────────

export function PrintDayPageTail({
  day, property, theme, tokens, totalDays,
}: {
  day: Day;
  property: ResolvedProperty | null;
  theme: ProposalTheme;
  tokens: ThemeTokens;
  totalDays: number;
}) {
  const destination = day.destination?.trim() || "New Destination";
  const activities = day.optionalActivities ?? [];

  return (
    <div
      className="w-full h-full flex flex-col"
      style={{ background: tokens.pageBg, color: tokens.bodyText }}
    >
      <PrintSectionHeader
        eyebrow={`Day ${String(day.dayNumber).padStart(2, "0")} of ${totalDays}  ·  Continued`}
        title={destination}
        subtitle="Activities & Accommodation"
        theme={theme}
        tokens={tokens}
        padded
      />

      <div className="flex-1 min-h-0 px-12 pt-7 pb-10 flex flex-col gap-6 overflow-hidden">
        {activities.length > 0 && (
          <OptionalBlock activities={activities} theme={theme} tokens={tokens} />
        )}

        {property && (
          <AccommodationBlock property={property} theme={theme} tokens={tokens} />
        )}

        {activities.length === 0 && !property && (
          <p
            className="text-[12.5px] italic"
            style={{ color: tokens.mutedText }}
          >
            (No additional activities or accommodation set for this day.)
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Sub-pieces ──────────────────────────────────────────────────────────

// Convert the operator's saved HTML narrative into plain-text
// paragraphs the print typography can render. The on-screen view
// uses dangerouslySetInnerHTML; the print view splits into a
// "lead with arrow + rest" pattern and so needs strings, not HTML.
// Without this conversion, React's escaping rendered raw `<span
// style="...">` as visible text in the PDF.
function htmlNarrativeToParagraphs(html: string): string[] {
  if (!html) return [];
  // <br> and closing block tags become paragraph breaks so the
  // operator's intended paragraphing survives the conversion.
  let s = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div)>/gi, "\n\n");
  // Convert <strong>/<b> to **markdown** so the existing
  // renderInlineBold path picks them up.
  s = s.replace(/<\s*(strong|b)\s*>/gi, "**").replace(/<\s*\/\s*(strong|b)\s*>/gi, "**");
  // Strip everything else.
  s = s.replace(/<[^>]+>/g, "");
  // Decode the common entities the rich editor emits.
  s = s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
  return s
    .split(/\n{2,}|\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function NarrativeBody({
  narrative, tokens, clamp,
}: {
  narrative: string;
  tokens: ThemeTokens;
  /** When set, applies a CSS line-clamp at the WHOLE block level so
   *  long narratives on single-page days don't push accommodation +
   *  activity chips off the page. */
  clamp?: number;
}) {
  const paragraphs = htmlNarrativeToParagraphs(narrative);
  if (paragraphs.length === 0) return null;
  const [lead, ...rest] = paragraphs;
  const clampStyle = clamp
    ? {
        display: "-webkit-box" as const,
        WebkitLineClamp: clamp,
        WebkitBoxOrient: "vertical" as const,
        overflow: "hidden" as const,
      }
    : {};
  return (
    <div className="space-y-3.5 max-w-[68ch]" style={clampStyle}>
      <div
        className="flex gap-3 text-[13px] leading-[1.7]"
        style={{ color: tokens.bodyText }}
      >
        <span aria-hidden style={{ color: tokens.accent }}>→</span>
        <span>{renderInlineBold(lead)}</span>
      </div>
      {rest.map((p, i) => (
        <p
          key={i}
          className="text-[12.5px] leading-[1.7]"
          style={{ color: tokens.bodyText }}
        >
          {renderInlineBold(p)}
        </p>
      ))}
    </div>
  );
}

function renderInlineBold(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} style={{ fontWeight: 700 }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function OptionalBlock({
  activities, theme, tokens,
}: {
  activities: OptionalActivity[];
  theme: ProposalTheme;
  tokens: ThemeTokens;
}) {
  // Group by time-of-day
  const groups = new Map<string, OptionalActivity[]>();
  for (const a of activities) {
    const k = (a.timeOfDay?.trim() || "Anytime").trim();
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(a);
  }

  return (
    <section>
      <div
        className="text-[10px] uppercase tracking-[0.28em] font-semibold mb-3"
        style={{ color: tokens.mutedText }}
      >
        Optional Activities
      </div>
      <div className="space-y-3">
        {Array.from(groups.entries()).map(([time, list]) => (
          <div key={time}>
            <div
              className="text-[9.5px] uppercase tracking-[0.22em] font-semibold mb-1"
              style={{ color: tokens.mutedText }}
            >
              {time}
            </div>
            <ul>
              {list.map((a) => (
                <li
                  key={a.id}
                  className="grid grid-cols-[1fr_auto] gap-3 items-baseline py-1.5"
                  style={{ borderBottom: `1px solid ${tokens.border}` }}
                >
                  <div className="min-w-0">
                    <span
                      className="text-[12px] font-medium"
                      style={{
                        color: tokens.headingText,
                        fontFamily: `'${theme.displayFont}', serif`,
                      }}
                    >
                      {a.title}
                    </span>
                    {a.location && (
                      <span
                        className="text-[11px] italic ml-2"
                        style={{ color: tokens.mutedText }}
                      >
                        · {a.location}
                      </span>
                    )}
                  </div>
                  {a.priceAmount && (
                    <span
                      className="text-[11.5px] font-semibold tabular-nums"
                      style={{ color: tokens.headingText }}
                    >
                      {a.priceCurrency || "USD"} {a.priceAmount}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function AccommodationBlock({
  property, theme, tokens,
}: {
  property: ResolvedProperty;
  theme: ProposalTheme;
  tokens: ThemeTokens;
}) {
  const tiles = [
    property.leadImageUrl,
    property.galleryUrls[0] ?? null,
    property.galleryUrls[1] ?? null,
  ];
  const hasAnyImage = tiles.some((u) => Boolean(u));
  const meal = humaniseMealPlan(property.mealPlan);
  const allAmenities = property.amenities.filter(Boolean);

  return (
    <section className="flex flex-col min-h-0 flex-1">
      <div
        className="text-[10px] uppercase tracking-[0.28em] font-semibold mb-3"
        style={{ color: tokens.mutedText }}
      >
        Accommodation
      </div>

      <div className="flex items-baseline justify-between gap-4 flex-wrap mb-3">
        <div className="min-w-0">
          <h3
            className="text-[18px] font-bold"
            style={{
              color: tokens.headingText,
              fontFamily: `'${theme.displayFont}', serif`,
              letterSpacing: "-0.01em",
            }}
          >
            {property.name}
          </h3>
          {property.location && (
            <div
              className="text-[11.5px] italic"
              style={{ color: tokens.mutedText }}
            >
              {property.location}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {meal && (
            <span
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium"
              style={{
                color: tokens.bodyText,
                background: `${tokens.accent}12`,
                border: `1px solid ${tokens.accent}26`,
              }}
            >
              <span style={{ color: tokens.accent }}>●</span>
              {meal}
            </span>
          )}
          {allAmenities.slice(0, 3).map((h) => (
            <span
              key={h}
              className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px]"
              style={{
                color: tokens.bodyText,
                background: tokens.cardBg,
                border: `1px solid ${tokens.border}`,
              }}
            >
              {h}
            </span>
          ))}
        </div>
      </div>

      {/* When the property has no images, give the descriptive copy
          full breathing room — no clamp — and surface every amenity as
          a chip block below. The previous layout reserved ~50% of the
          A4 for an image grid that only rendered placeholder tiles,
          leaving the bottom half of the continuation page blank. */}
      {!hasAnyImage ? (
        <>
          {property.shortDesc && (
            <p
              className="text-[12.5px] leading-[1.7] mb-5 max-w-[68ch]"
              style={{ color: tokens.bodyText }}
            >
              {property.shortDesc}
            </p>
          )}
          {allAmenities.length > 0 && (
            <div className="mt-1">
              <div
                className="text-[10px] uppercase tracking-[0.26em] font-semibold mb-2"
                style={{ color: tokens.mutedText }}
              >
                What&apos;s at the lodge
              </div>
              <ul className="flex flex-wrap gap-1.5">
                {allAmenities.slice(0, 16).map((a) => (
                  <li
                    key={a}
                    className="text-[11px] px-2.5 py-1 rounded-full"
                    style={{
                      color: tokens.bodyText,
                      background: tokens.cardBg,
                      border: `1px solid ${tokens.border}`,
                    }}
                  >
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        <>
          {property.shortDesc && (
            <p
              className="text-[11.5px] leading-[1.55] mb-4"
              style={{
                color: tokens.bodyText,
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {property.shortDesc}
            </p>
          )}

          <div
            className="grid grid-cols-3 gap-1.5 flex-1 min-h-0"
            style={{ background: tokens.cardBg }}
          >
            {tiles.map((url, i) => (
              <div
                key={i}
                className="overflow-hidden"
                style={{ background: tokens.cardBg, minHeight: 120 }}
              >
                {url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={url}
                    alt={i === 0 ? property.name : ""}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  /* Empty tile — render a soft gradient with a tiny
                     editorial mark instead of "No photo" text, so the
                     printed page reads as designed rather than missing. */
                  <div
                    className="w-full h-full flex items-center justify-center"
                    style={{
                      background: `linear-gradient(135deg, ${tokens.cardBg} 0%, ${tokens.sectionSurface} 100%)`,
                    }}
                    aria-hidden
                  >
                    <div
                      className="h-px"
                      style={{ width: 18, background: tokens.accent, opacity: 0.55 }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

// Format database meal-plan strings for display. The Property model
// stores values like "half_board" / "full_board" / "all_inclusive";
// rendering them raw with underscores in a guest-facing print page
// reads as a leaked database value rather than a chip the operator
// would set. Title-cases the words and replaces underscores.
function humaniseMealPlan(raw?: string): string {
  if (!raw) return "";
  const cleaned = raw.replace(/[_-]+/g, " ").trim();
  if (!cleaned) return "";
  // Already prose-cased? Leave it.
  if (/[A-Z]/.test(cleaned[0]) && cleaned.includes(" ")) return cleaned;
  return cleaned
    .toLowerCase()
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}
