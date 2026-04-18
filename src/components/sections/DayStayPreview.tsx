"use client";

import type { Day, Property, ProposalTheme, ThemeTokens } from "@/lib/types";

// "Stay at" preview — the rich, editorial replacement for the per-tier camp
// list inside each day card. Sourced by matching the day's active-tier camp
// name against the proposal's properties; falls back to a clean text-only
// version when no match is found (preserves the old behaviour for proposals
// where the operator hasn't linked properties yet).

export function DayStayPreview({
  day,
  activeTier,
  visibleTiers,
  tokens,
  theme,
  properties,
}: {
  day: Day;
  activeTier: string;
  visibleTiers: Record<string, boolean>;
  tokens: ThemeTokens;
  theme: ProposalTheme;
  properties: Property[];
}) {
  const tier = (activeTier as keyof Day["tiers"]);
  const acc = day.tiers[tier];
  if (!acc) return null;

  const matched = findPropertyByName(acc.camp, properties);
  const otherTiers = (["classic", "premier", "signature"] as const).filter(
    (t) => t !== tier && visibleTiers[t],
  );

  return (
    <div className="pt-6" style={{ borderTop: `1px solid ${tokens.border}` }}>
      <div
        className="text-label ed-label mb-4"
        style={{ color: tokens.mutedText }}
      >
        Stay at
      </div>

      {matched ? (
        <RichPreview
          property={matched}
          fallbackLocation={acc.location}
          tokens={tokens}
          theme={theme}
        />
      ) : (
        <TextPreview acc={acc} tokens={tokens} theme={theme} />
      )}

      {/* Other-tier alternates — single line, quiet */}
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

// ─── Rich preview (matched property in proposal.properties) ─────────────────

function RichPreview({
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
      {/* Image */}
      <div
        className="w-full aspect-[4/3] sm:aspect-square rounded-lg overflow-hidden shrink-0"
        style={{ background: tokens.cardBg }}
      >
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={property.name}
            className="w-full h-full object-cover"
          />
        )}
      </div>

      {/* Detail */}
      <div className="min-w-0">
        <div
          className="text-h3 font-bold"
          style={{ color: tokens.headingText, fontFamily: `'${theme.displayFont}', serif` }}
        >
          {property.name}
        </div>
        {location && (
          <div className="text-label mt-1" style={{ color: tokens.mutedText, textTransform: "none", letterSpacing: "0", fontWeight: 400 }}>
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

// ─── Text-only fallback (no matching property) ─────────────────────────────

function TextPreview({
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
        <div className="text-label mt-1" style={{ color: tokens.mutedText, textTransform: "none", letterSpacing: "0", fontWeight: 400 }}>
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
  const trim = (s: string) => s.replace(/\s+(camp|lodge|tented camp|villa|house|hotel)\s*$/i, "").trim().toLowerCase();
  const targetTrim = trim(name);
  for (const p of properties) {
    if (trim(p.name) === targetTrim) return p;
  }
  return null;
}
