"use client";

import type { Property as ProposalProperty, ThemeTokens, ProposalTheme } from "@/lib/types";

// ─── Print: single-property page ──────────────────────────────────────────
//
// One A4 page per property. Designed to fill an A4 frame with a balanced
// composition — half-page hero on top, two-column body below (left:
// editorial copy; right: stay facts + amenities). Avoids the empty-half
// look the old propertyShowcase carousel produced when a single
// property was rendered solo.
//
// Falls back gracefully when fields are missing — every block self-
// suppresses if its data is absent rather than rendering as a blank
// section.

export function PrintPropertyPage({
  property, theme, tokens, indexLabel,
}: {
  property: ProposalProperty;
  theme: ProposalTheme;
  tokens: ThemeTokens;
  /** "Property 1 of 4" — rendered as the eyebrow above the property
   *  name so each printed lodge page reads as part of the same series. */
  indexLabel?: string;
}) {
  const meal = property.mealPlan?.trim();
  const room = property.roomType?.trim();
  const nights = property.nights;
  const checkIn = property.checkInTime?.trim();
  const checkOut = property.checkOutTime?.trim();
  const totalRooms = property.totalRooms;
  const languages = property.spokenLanguages?.filter(Boolean) ?? [];
  const interests = property.specialInterests?.filter(Boolean) ?? [];
  const amenities = property.amenities?.filter(Boolean) ?? [];
  const heroUrl = property.leadImageUrl || property.galleryUrls?.[0] || null;

  return (
    <div
      className="w-full h-full flex flex-col"
      style={{ background: tokens.pageBg, color: tokens.bodyText }}
    >
      {/* Hero — top 48% of the page. Full-bleed cover. */}
      <div
        className="relative shrink-0 w-full"
        style={{
          height: "48%",
          background: tokens.cardBg,
        }}
      >
        {heroUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={heroUrl}
            alt={property.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center text-[12px] uppercase tracking-[0.24em]"
            style={{ color: tokens.mutedText }}
          >
            No image
          </div>
        )}
        {property.tier && (
          <div
            className="absolute top-4 left-4 text-[10px] uppercase tracking-[0.28em] font-bold px-2.5 py-1 rounded"
            style={{ background: "rgba(255,255,255,0.94)", color: tokens.headingText }}
          >
            {property.tier}
          </div>
        )}
      </div>

      {/* Body — flex-1 fills remaining ~52%. */}
      <div className="flex-1 min-h-0 px-12 py-8 flex flex-col">
        {/* Header — editorial rhythm matching every other print page:
            thin hairline, eyebrow, title, optional summary. The eyebrow
            carries "Property N of M · Location" so the deck reads as a
            series rather than a stack of standalone pages. */}
        <header className="mb-5 shrink-0">
          <div
            aria-hidden
            className="mb-3"
            style={{ height: 1, background: tokens.border }}
          />
          <div
            className="text-[10px] uppercase tracking-[0.28em] font-semibold mb-1.5"
            style={{ color: tokens.mutedText }}
          >
            {indexLabel
              ? `${indexLabel}${property.location ? "  ·  " + property.location : ""}`
              : property.location || "Property"}
          </div>
          <h2
            className="font-bold leading-[1.05]"
            style={{
              color: tokens.headingText,
              fontFamily: `'${theme.displayFont}', serif`,
              fontSize: "clamp(24px, 3vw, 32px)",
              letterSpacing: "-0.012em",
            }}
          >
            {property.name}
          </h2>
          {property.shortDesc && (
            <p
              className="mt-3 text-[12.5px] leading-[1.6] max-w-[640px]"
              style={{ color: tokens.bodyText }}
            >
              {property.shortDesc}
            </p>
          )}
        </header>

        {/* Two columns — copy left, facts + amenities right */}
        <div className="flex-1 min-h-0 grid grid-cols-[1.4fr_1fr] gap-8">
          {/* Left — narrative copy */}
          <div className="min-w-0 overflow-hidden">
            {property.description && (
              <Block
                eyebrow="Stay"
                body={property.description}
                tokens={tokens}
                clamp={6}
              />
            )}
            {property.whyWeChoseThis && (
              <Block
                eyebrow="Why we choose this"
                body={property.whyWeChoseThis}
                tokens={tokens}
                clamp={4}
                topMargin
              />
            )}
          </div>

          {/* Right — facts + amenities */}
          <aside className="min-w-0 flex flex-col gap-5">
            <FactsTable
              entries={[
                meal && { k: "Meal plan", v: meal },
                room && { k: "Room type", v: room },
                nights ? { k: "Nights", v: String(nights) } : null,
                totalRooms ? { k: "Total rooms", v: String(totalRooms) } : null,
                checkIn && { k: "Check-in", v: checkIn },
                checkOut && { k: "Check-out", v: checkOut },
              ].filter((e): e is { k: string; v: string } => !!e)}
              tokens={tokens}
            />

            {languages.length > 0 && (
              <ChipBlock
                eyebrow="Languages"
                items={languages}
                tokens={tokens}
              />
            )}
            {interests.length > 0 && (
              <ChipBlock
                eyebrow="Special interests"
                items={interests}
                tokens={tokens}
              />
            )}
            {amenities.length > 0 && (
              <ChipBlock
                eyebrow="Amenities"
                items={amenities.slice(0, 12)}
                tokens={tokens}
              />
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-pieces ───────────────────────────────────────────────────────

function Block({
  eyebrow, body, tokens, clamp, topMargin = false,
}: {
  eyebrow: string;
  body: string;
  tokens: ThemeTokens;
  clamp: number;
  topMargin?: boolean;
}) {
  return (
    <div className={topMargin ? "mt-5" : ""}>
      <div
        className="text-[9.5px] uppercase tracking-[0.28em] font-semibold mb-1.5"
        style={{ color: tokens.mutedText }}
      >
        {eyebrow}
      </div>
      <p
        className="text-[12px] leading-[1.6] whitespace-pre-line"
        style={{
          color: tokens.bodyText,
          display: "-webkit-box",
          WebkitLineClamp: clamp,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {body}
      </p>
    </div>
  );
}

function FactsTable({
  entries, tokens,
}: {
  entries: { k: string; v: string }[];
  tokens: ThemeTokens;
}) {
  if (entries.length === 0) return null;
  return (
    <div
      className="rounded-lg p-4"
      style={{ background: tokens.cardBg, border: `1px solid ${tokens.border}` }}
    >
      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
        {entries.map((e) => (
          <div key={e.k}>
            <div
              className="text-[9px] uppercase tracking-[0.22em] font-semibold mb-0.5"
              style={{ color: tokens.mutedText }}
            >
              {e.k}
            </div>
            <div className="text-[12px] font-medium" style={{ color: tokens.headingText }}>
              {e.v}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChipBlock({
  eyebrow, items, tokens,
}: {
  eyebrow: string;
  items: string[];
  tokens: ThemeTokens;
}) {
  return (
    <div>
      <div
        className="text-[9.5px] uppercase tracking-[0.28em] font-semibold mb-2"
        style={{ color: tokens.mutedText }}
      >
        {eyebrow}
      </div>
      <ul className="flex flex-wrap gap-1.5">
        {items.map((it) => (
          <li
            key={it}
            className="text-[10.5px] font-medium px-2 py-1 rounded"
            style={{
              background: tokens.cardBg,
              color: tokens.bodyText,
              border: `1px solid ${tokens.border}`,
            }}
          >
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}
