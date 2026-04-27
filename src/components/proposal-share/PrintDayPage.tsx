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

// True when a day carries content that warrants a second printed page.
// Signal: optional activities OR a resolved property with enough material
// to be more than a single chip line.
export function dayHasTailContent(
  day: Day,
  property: ResolvedProperty | null,
): boolean {
  const hasActivities = (day.optionalActivities ?? []).length > 0;
  const hasProperty = !!property;
  return hasActivities || hasProperty;
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

// ─── Page 1 — story ────────────────────────────────────────────────────────

export function PrintDayPageMain({
  day, dayDate, theme, tokens, totalDays,
}: {
  day: Day;
  dayDate: string | null;
  theme: ProposalTheme;
  tokens: ThemeTokens;
  totalDays: number;
}) {
  const destination = day.destination?.trim() || "New Destination";
  const phase = day.subtitle?.trim() || "";
  const narrative = day.description?.trim() || "";
  const board = day.board?.trim() || "";
  const heroUrl = day.heroImageUrl?.trim() || null;

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

      {/* Hero — large editorial image. Aspect-ratio capped via flex-grow
          on the main column so a tall image never crowds the narrative. */}
      <div
        className="relative w-full shrink-0 overflow-hidden"
        style={{
          height: "44%",
          background: tokens.cardBg,
          borderTop: `1px solid ${tokens.border}`,
          borderBottom: `1px solid ${tokens.border}`,
        }}
      >
        {heroUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={heroUrl}
            alt={destination}
            className="absolute inset-0 w-full h-full object-cover"
            style={{ objectPosition: day.heroImagePosition || "center" }}
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center text-[12px] uppercase tracking-[0.24em]"
            style={{ color: tokens.mutedText }}
          >
            No image
          </div>
        )}
      </div>

      {/* Narrative — flex-1 fills remaining vertical room. Body
          line-clamps at a height the page can fit so a runaway essay
          never blows the page; the tail page picks up activities + stay. */}
      <div className="flex-1 min-h-0 px-12 pt-8 pb-10 flex flex-col">
        {narrative ? (
          <NarrativeBody narrative={narrative} tokens={tokens} />
        ) : (
          <p className="text-[13px] italic" style={{ color: tokens.mutedText }}>
            (No narrative for this day.)
          </p>
        )}

        {board && (
          <div
            className="mt-auto pt-5 text-[10.5px] uppercase tracking-[0.28em] font-semibold"
            style={{ color: tokens.mutedText, borderTop: `1px solid ${tokens.border}` }}
          >
            {board}
          </div>
        )}
      </div>
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

function NarrativeBody({
  narrative, tokens,
}: {
  narrative: string;
  tokens: ThemeTokens;
}) {
  const paragraphs = narrative
    .split(/\n{2,}|\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (paragraphs.length === 0) return null;
  const [lead, ...rest] = paragraphs;
  return (
    <div className="space-y-3.5 max-w-[68ch]">
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

  return (
    <section className="flex flex-col min-h-0">
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
          {property.mealPlan && (
            <span
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium"
              style={{
                color: tokens.bodyText,
                background: `${tokens.accent}12`,
                border: `1px solid ${tokens.accent}26`,
              }}
            >
              <span style={{ color: tokens.accent }}>●</span>
              {property.mealPlan}
            </span>
          )}
          {property.amenities.slice(0, 3).map((h) => (
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
              <div
                className="w-full h-full flex items-center justify-center text-[10px] uppercase tracking-[0.22em]"
                style={{ color: tokens.mutedText }}
              >
                {i === 0 ? "No photo" : ""}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
