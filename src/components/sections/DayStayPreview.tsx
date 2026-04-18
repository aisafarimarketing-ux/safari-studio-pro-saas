"use client";

import type { Day, Property, ProposalTheme, ThemeTokens } from "@/lib/types";

// "Stay at" — the property preview for a day card.
//
// Two visual modes:
//
//   inline        — small thumbnail + text, nested inside DayContent.
//                   Used by layouts where the day image itself is small
//                   or stacked (Compact, Stacked, Overlay, Magazine).
//
//   mirror-right  — full-width row with image on the RIGHT, same size
//                   as the day image. Used by SplitLayout (day image
//                   is on the LEFT). Creates an editorial ping-pong:
//                   day image left → day text right → property text
//                   left → property image right.
//
//   mirror-left   — full-width row with image on the LEFT. Used by
//                   FlipSplitLayout (day image is on the RIGHT).
//
// When the day's active-tier camp name doesn't match any property in
// proposal.properties, the block falls back to a clean text-only
// preview (no stock image) so the proposal never ships broken visuals.

export type StayPreviewMode = "inline" | "mirror-right" | "mirror-left";

export function DayStayPreview({
  mode = "inline",
  day,
  activeTier,
  visibleTiers,
  tokens,
  theme,
  properties,
}: {
  mode?: StayPreviewMode;
  day: Day;
  activeTier: string;
  visibleTiers: Record<string, boolean>;
  tokens: ThemeTokens;
  theme: ProposalTheme;
  properties: Property[];
}) {
  const tier = activeTier as keyof Day["tiers"];
  const acc = day.tiers[tier];
  if (!acc) return null;

  const matched = findPropertyByName(acc.camp, properties);
  const otherTiers = (["classic", "premier", "signature"] as const).filter(
    (t) => t !== tier && visibleTiers[t],
  );

  if (mode === "mirror-right" || mode === "mirror-left") {
    return (
      <MirrorLayout
        mode={mode}
        acc={acc}
        matched={matched}
        otherTiers={otherTiers}
        day={day}
        tokens={tokens}
        theme={theme}
      />
    );
  }

  return (
    <InlineLayout
      acc={acc}
      matched={matched}
      otherTiers={otherTiers}
      day={day}
      tokens={tokens}
      theme={theme}
    />
  );
}

// ─── Mirror layout ──────────────────────────────────────────────────────────
//
// Full-width row with image on the opposite side of the day image. Sized
// to mirror the day image's proportions so the spread reads as a
// deliberate pair, not two unrelated blocks.

function MirrorLayout({
  mode,
  acc,
  matched,
  otherTiers,
  day,
  tokens,
  theme,
}: {
  mode: "mirror-right" | "mirror-left";
  acc: { camp: string; location: string; note?: string };
  matched: Property | null;
  otherTiers: readonly ("classic" | "premier" | "signature")[];
  day: Day;
  tokens: ThemeTokens;
  theme: ProposalTheme;
}) {
  const imageOnRight = mode === "mirror-right";
  // Grid columns flip per mode — text-heavy side gets 3fr, image gets 2fr.
  // These proportions mirror SplitLayout's 2fr:3fr (image:content), so
  // the two rows form a tidy cross-pattern on the page.
  const gridCols = imageOnRight ? "md:grid-cols-[3fr_2fr]" : "md:grid-cols-[2fr_3fr]";

  const image = matched
    ? matched.leadImageUrl ?? matched.galleryUrls?.[0] ?? null
    : null;
  const locationLine = matched?.location?.trim() || acc.location;
  const desc = matched
    ? (matched.shortDesc?.trim() || matched.description?.trim() || acc.note || "")
    : (acc.note || "");
  const amenities = matched?.amenities?.slice(0, 6) ?? [];
  const displayName = matched?.name ?? acc.camp;

  const imageColumn = (
    <div
      className="relative min-h-[280px] md:min-h-[380px] overflow-hidden"
      style={{ background: tokens.cardBg }}
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt={displayName}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center text-label"
          style={{ color: tokens.mutedText, textTransform: "none", letterSpacing: "0", fontWeight: 400 }}
        >
          <div className="text-h3" style={{ color: tokens.accent, opacity: 0.4 }}>◇</div>
          <div className="mt-2">No property image yet</div>
        </div>
      )}
    </div>
  );

  const textColumn = (
    <div className="flex flex-col justify-center px-6 md:px-10 py-10 md:py-12" style={{ background: tokens.sectionSurface }}>
      <div className="text-label ed-label mb-4" style={{ color: tokens.mutedText }}>
        Stay at
      </div>
      <h3
        className="text-h2 font-bold tracking-tight"
        style={{ color: tokens.headingText, fontFamily: `'${theme.displayFont}', serif` }}
      >
        {displayName}
      </h3>
      {locationLine && (
        <div
          className="text-small mt-2"
          style={{ color: tokens.mutedText, fontFamily: `'${theme.bodyFont}', sans-serif` }}
        >
          {locationLine}
        </div>
      )}
      {desc && (
        <p
          className="text-body mt-5"
          style={{ color: tokens.bodyText, fontFamily: `'${theme.bodyFont}', sans-serif` }}
        >
          {desc}
        </p>
      )}
      {amenities.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {amenities.map((a) => (
            <span
              key={a}
              className="px-3 py-1 rounded-full text-label font-medium"
              style={{
                background: tokens.cardBg,
                color: tokens.bodyText,
                border: `1px solid ${tokens.border}`,
                textTransform: "none",
                letterSpacing: "0",
                fontWeight: 500,
              }}
            >
              {a}
            </span>
          ))}
        </div>
      )}
      {otherTiers.length > 0 && (
        <div className="mt-6 pt-4 border-t" style={{ borderColor: tokens.border }}>
          <div
            className="text-label ed-label mb-2"
            style={{ color: tokens.mutedText, letterSpacing: "0.15em" }}
          >
            Or
          </div>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            {otherTiers.map((t) => {
              const a = day.tiers[t];
              if (!a) return null;
              return (
                <div key={t} className="text-small flex items-baseline gap-2">
                  <span
                    className="text-label ed-label"
                    style={{ color: tokens.mutedText, letterSpacing: "0.15em" }}
                  >
                    {t}
                  </span>
                  <span style={{ color: tokens.bodyText }}>{a.camp}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className={`grid grid-cols-1 ${gridCols}`}>
      {imageOnRight ? (
        <>
          {textColumn}
          {imageColumn}
        </>
      ) : (
        <>
          {imageColumn}
          {textColumn}
        </>
      )}
    </div>
  );
}

// ─── Inline layout (legacy, used by non-split day variants) ────────────────

function InlineLayout({
  acc,
  matched,
  otherTiers,
  day,
  tokens,
  theme,
}: {
  acc: { camp: string; location: string; note?: string };
  matched: Property | null;
  otherTiers: readonly ("classic" | "premier" | "signature")[];
  day: Day;
  tokens: ThemeTokens;
  theme: ProposalTheme;
}) {
  return (
    <div className="pt-6" style={{ borderTop: `1px solid ${tokens.border}` }}>
      <div className="text-label ed-label mb-4" style={{ color: tokens.mutedText }}>
        Stay at
      </div>

      {matched ? (
        <RichInline property={matched} fallbackLocation={acc.location} tokens={tokens} theme={theme} />
      ) : (
        <TextInline acc={acc} tokens={tokens} theme={theme} />
      )}

      {otherTiers.length > 0 && (
        <div className="mt-4 pt-3 border-t" style={{ borderColor: tokens.border }}>
          <div
            className="text-label ed-label mb-2"
            style={{ color: tokens.mutedText, letterSpacing: "0.15em" }}
          >
            Or
          </div>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            {otherTiers.map((t) => {
              const a = day.tiers[t];
              if (!a) return null;
              return (
                <div key={t} className="text-small flex items-baseline gap-2">
                  <span
                    className="text-label ed-label"
                    style={{ color: tokens.mutedText, letterSpacing: "0.15em" }}
                  >
                    {t}
                  </span>
                  <span style={{ color: tokens.bodyText }}>{a.camp}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function RichInline({
  property,
  fallbackLocation,
  tokens,
  theme,
}: {
  property: Property;
  fallbackLocation: string;
  tokens: ThemeTokens;
  theme: ProposalTheme;
}) {
  const image = property.leadImageUrl ?? property.galleryUrls?.[0] ?? null;
  const desc = property.shortDesc?.trim() || property.description?.trim() || "";
  const amenities = property.amenities?.slice(0, 5) ?? [];
  const location = property.location?.trim() || fallbackLocation;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-4 items-start">
      <div
        className="w-full aspect-[4/3] sm:aspect-square rounded-lg overflow-hidden shrink-0"
        style={{ background: tokens.cardBg }}
      >
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={property.name} className="w-full h-full object-cover" />
        )}
      </div>
      <div className="min-w-0">
        <div
          className="text-h3 font-bold"
          style={{ color: tokens.headingText, fontFamily: `'${theme.displayFont}', serif` }}
        >
          {property.name}
        </div>
        {location && (
          <div
            className="text-label mt-1"
            style={{ color: tokens.mutedText, textTransform: "none", letterSpacing: "0", fontWeight: 400 }}
          >
            {location}
          </div>
        )}
        {desc && (
          <p
            className="text-small mt-3"
            style={{ color: tokens.bodyText, fontFamily: `'${theme.bodyFont}', sans-serif` }}
          >
            {desc}
          </p>
        )}
        {amenities.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {amenities.map((a) => (
              <span
                key={a}
                className="px-3 py-1 rounded-full text-label"
                style={{
                  background: tokens.cardBg,
                  color: tokens.bodyText,
                  border: `1px solid ${tokens.border}`,
                  textTransform: "none",
                  letterSpacing: "0",
                  fontWeight: 400,
                }}
              >
                {a}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TextInline({
  acc,
  tokens,
  theme,
}: {
  acc: { camp: string; location: string; note?: string };
  tokens: ThemeTokens;
  theme: ProposalTheme;
}) {
  return (
    <div>
      <div
        className="text-h3 font-bold"
        style={{ color: tokens.headingText, fontFamily: `'${theme.displayFont}', serif` }}
      >
        {acc.camp}
      </div>
      {acc.location && (
        <div
          className="text-label mt-1"
          style={{ color: tokens.mutedText, textTransform: "none", letterSpacing: "0", fontWeight: 400 }}
        >
          {acc.location}
        </div>
      )}
      {acc.note && (
        <p
          className="text-small mt-3"
          style={{ color: tokens.bodyText, fontFamily: `'${theme.bodyFont}', sans-serif` }}
        >
          {acc.note}
        </p>
      )}
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function findPropertyByName(name: string, properties: Property[]): Property | null {
  const target = name.trim().toLowerCase();
  if (!target) return null;
  for (const p of properties) {
    if (p.name.trim().toLowerCase() === target) return p;
  }
  // Soft match: ignore "Camp" / "Lodge" suffix so "Mara Plains" matches
  // "Mara Plains Camp".
  const trim = (s: string) =>
    s.replace(/\s+(camp|lodge|tented camp|villa|house|hotel)\s*$/i, "").trim().toLowerCase();
  const targetTrim = trim(name);
  for (const p of properties) {
    if (trim(p.name) === targetTrim) return p;
  }
  return null;
}
