"use client";

import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import { resolveTokens } from "@/lib/theme";
import type { Section, TierKey } from "@/lib/types";

const TIER_KEYS: TierKey[] = ["classic", "premier", "signature"];

export function PricingSection({ section }: { section: Section }) {
  const { proposal, setActiveTier, updateTierPrice, updatePricingNotes } = useProposalStore();
  const { mode } = useEditorStore();
  const isEditor = mode === "editor";
  const { pricing, activeTier, visibleTiers, days, theme, client } = proposal;
  const tokens = resolveTokens(theme.tokens, section.styleOverrides);
  const nights = days.length || proposal.trip.nights;
  const visibleKeys = TIER_KEYS.filter((t) => visibleTiers[t]);

  // ── Horizontal — side-by-side tier comparison ─────────────────────────────
  if (section.layoutVariant === "horizontal") {
    return (
      <div className="py-24 md:py-28 px-8 md:px-16" style={{ background: tokens.sectionSurface }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-[10px] uppercase tracking-[0.3em] mb-10" style={{ color: tokens.mutedText }}>
            Investment
          </div>
          <div className="space-y-3">
            {visibleKeys.map((tier) => {
              const p = pricing[tier];
              const isActive = activeTier === tier;
              return (
                <div
                  key={tier}
                  onClick={() => setActiveTier(tier)}
                  className="flex items-center justify-between p-6 rounded-xl cursor-pointer transition-all duration-200 hover:shadow-md"
                  style={{
                    background: isActive ? `${tokens.accent}10` : tokens.cardBg,
                    border: `1.5px solid ${isActive ? tokens.accent : tokens.border}`,
                  }}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="w-3 h-3 rounded-full border-2"
                      style={{ borderColor: tokens.accent, background: isActive ? tokens.accent : "transparent" }}
                    />
                    <div>
                      <div className="text-[13px] font-semibold" style={{ color: tokens.headingText }}>{p.label}</div>
                      {p.highlighted && <span className="text-[9px] uppercase tracking-wider" style={{ color: tokens.secondaryAccent }}>Recommended</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className="text-2xl font-bold outline-none"
                      style={{ color: tokens.headingText, fontFamily: `'${theme.displayFont}', serif` }}
                      contentEditable={isEditor}
                      suppressContentEditableWarning
                      onBlur={(e) => updateTierPrice(tier, e.currentTarget.textContent ?? p.pricePerPerson)}
                    >
                      {p.currency} {p.pricePerPerson}
                    </span>
                    <div className="text-[11px]" style={{ color: tokens.mutedText }}>per person · {nights} nights</div>
                  </div>
                </div>
              );
            })}
          </div>
          {pricing.notes && (
            <p className="mt-8 text-sm text-center outline-none" style={{ color: tokens.mutedText }}
              contentEditable={isEditor} suppressContentEditableWarning
              onBlur={(e) => updatePricingNotes(e.currentTarget.textContent ?? "")}>{pricing.notes}</p>
          )}
        </div>
      </div>
    );
  }

  // ── Minimal — clean single-line pricing ──────────────────────────────────────
  if (section.layoutVariant === "minimal") {
    return (
      <div className="py-20 md:py-24 px-8 md:px-20" style={{ background: tokens.sectionSurface }}>
        <div className="max-w-3xl mx-auto">
          <div className="text-[10px] uppercase tracking-[0.3em] mb-12" style={{ color: tokens.mutedText }}>
            Investment
          </div>
          {visibleKeys.map((tier) => {
            const p = pricing[tier];
            const isActive = activeTier === tier;
            return (
              <div
                key={tier}
                className="flex items-baseline justify-between py-5 cursor-pointer"
                style={{ borderBottom: `1px solid ${tokens.border}` }}
                onClick={() => setActiveTier(tier)}
              >
                <div className="flex items-baseline gap-3">
                  <span className="text-sm font-semibold" style={{ color: isActive ? tokens.accent : tokens.headingText }}>
                    {p.label}
                  </span>
                  {isActive && <span className="text-[9px]" style={{ color: tokens.accent }}>Selected</span>}
                </div>
                <span
                  className="text-xl font-bold outline-none"
                  style={{ color: tokens.headingText, fontFamily: `'${theme.displayFont}', serif` }}
                  contentEditable={isEditor}
                  suppressContentEditableWarning
                  onBlur={(e) => updateTierPrice(tier, e.currentTarget.textContent ?? p.pricePerPerson)}
                >
                  {p.currency} {p.pricePerPerson}
                </span>
              </div>
            );
          })}
          {pricing.notes && (
            <p className="mt-8 text-[13px] outline-none" style={{ color: tokens.mutedText }}
              contentEditable={isEditor} suppressContentEditableWarning
              onBlur={(e) => updatePricingNotes(e.currentTarget.textContent ?? "")}>{pricing.notes}</p>
          )}
        </div>
      </div>
    );
  }

  // ── Tiered Rail — Linear/Stripe-clean horizontal pricing rail. The active
  //    tier is elevated by a thin gold underline; no shadows, no chrome.
  if (section.layoutVariant === "tiered-rail") {
    return (
      <div className="py-24 md:py-28" style={{ background: tokens.sectionSurface }}>
        <div className="ed-wide">
          {/* Header */}
          <div className="mb-12">
            <div
              className="text-[10px] uppercase tracking-[0.32em] mb-3"
              style={{ color: tokens.mutedText, fontFamily: `'${theme.bodyFont}', sans-serif` }}
            >
              Investment
            </div>
            <h2
              className="font-bold tracking-tight"
              style={{
                color: tokens.headingText,
                fontFamily: `'${theme.displayFont}', serif`,
                fontSize: "clamp(1.9rem, 3.6vw, 2.6rem)",
                lineHeight: 1.05,
              }}
            >
              Choose your experience
            </h2>
            <p
              className="mt-3 text-[14px] max-w-xl"
              style={{ color: tokens.mutedText, fontFamily: `'${theme.bodyFont}', sans-serif` }}
            >
              The same itinerary at three levels. Pick the one that fits the trip; everything else stays the same.
            </p>
          </div>

          {/* Rail */}
          <div
            className="grid grid-cols-1 md:grid-cols-3"
            style={{
              borderTop: `1px solid ${tokens.border}`,
              borderBottom: `1px solid ${tokens.border}`,
            }}
          >
            {visibleKeys.map((tier, i) => {
              const p = pricing[tier];
              const isActive = activeTier === tier;
              const isRecommended = p.highlighted;
              const total = client.pax
                ? (parseInt(p.pricePerPerson.replace(/,/g, ""), 10) || 0) * (parseInt(client.pax, 10) || 1)
                : null;
              return (
                <div
                  key={tier}
                  onClick={() => setActiveTier(tier)}
                  className="relative cursor-pointer transition py-10 px-8"
                  style={{
                    borderLeft: i > 0 ? `1px solid ${tokens.border}` : undefined,
                    background: isActive ? tokens.cardBg : "transparent",
                  }}
                >
                  {/* Active underline */}
                  {isActive && (
                    <div
                      className="absolute left-0 right-0 -top-px h-0.5"
                      style={{ background: tokens.accent }}
                    />
                  )}

                  {/* Header row */}
                  <div className="flex items-center justify-between mb-6">
                    <div
                      className="text-[10px] font-semibold uppercase tracking-[0.28em]"
                      style={{
                        color: isActive ? tokens.accent : tokens.mutedText,
                        fontFamily: `'${theme.bodyFont}', sans-serif`,
                      }}
                    >
                      {p.label}
                    </div>
                    {isRecommended && (
                      <span
                        className="text-[9px] uppercase tracking-[0.2em] px-2 py-0.5 rounded-full"
                        style={{
                          color: tokens.accent,
                          background: `${tokens.accent}15`,
                          border: `1px solid ${tokens.accent}40`,
                        }}
                      >
                        Recommended
                      </span>
                    )}
                  </div>

                  {/* Price */}
                  <div className="flex items-baseline gap-1.5">
                    <span
                      className="text-[12px] font-medium"
                      style={{ color: tokens.mutedText }}
                    >
                      {p.currency}
                    </span>
                    <span
                      className="font-bold leading-none outline-none tracking-tight"
                      contentEditable={isEditor}
                      suppressContentEditableWarning
                      style={{
                        color: tokens.headingText,
                        fontFamily: `'${theme.displayFont}', serif`,
                        fontSize: "clamp(2.4rem, 4.2vw, 3.2rem)",
                      }}
                      onBlur={(e) => updateTierPrice(tier, e.currentTarget.textContent ?? p.pricePerPerson)}
                    >
                      {p.pricePerPerson}
                    </span>
                  </div>
                  <div
                    className="mt-2 text-[11px]"
                    style={{ color: tokens.mutedText }}
                  >
                    per person · {nights} night{nights === 1 ? "" : "s"}
                  </div>

                  {total !== null && total > 0 && (
                    <div
                      className="mt-6 pt-5 flex items-baseline justify-between"
                      style={{ borderTop: `1px solid ${tokens.border}` }}
                    >
                      <span
                        className="text-[10px] uppercase tracking-[0.24em]"
                        style={{ color: tokens.mutedText, fontFamily: `'${theme.bodyFont}', sans-serif` }}
                      >
                        Total
                      </span>
                      <span
                        className="text-[15px] font-semibold"
                        style={{ color: tokens.headingText, fontFamily: `'${theme.displayFont}', serif` }}
                      >
                        {p.currency} {total.toLocaleString()}
                      </span>
                    </div>
                  )}

                  {/* Select affordance */}
                  <div
                    className="mt-6 text-[11px] font-semibold uppercase tracking-[0.22em]"
                    style={{
                      color: isActive ? tokens.accent : tokens.mutedText,
                      fontFamily: `'${theme.bodyFont}', sans-serif`,
                    }}
                  >
                    {isActive ? "Selected ✓" : "Select →"}
                  </div>
                </div>
              );
            })}
          </div>

          {pricing.notes && (
            <p
              className="mt-8 text-[13px] max-w-2xl outline-none"
              style={{ color: tokens.mutedText, fontFamily: `'${theme.bodyFont}', sans-serif` }}
              contentEditable={isEditor}
              suppressContentEditableWarning
              onBlur={(e) => updatePricingNotes(e.currentTarget.textContent ?? "")}
            >
              {pricing.notes}
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── Default — tier cards ──────────────────────────────────────────────────
  return (
    <div className="py-24 md:py-28 px-8 md:px-16" style={{ background: tokens.sectionSurface }}>
      <div className="max-w-5xl mx-auto">

        {/* Section header */}
        <div className="mb-14 text-center">
          <div className="text-[10px] uppercase tracking-[0.3em] mb-4" style={{ color: tokens.mutedText }}>
            Investment
          </div>
          <div
            className="text-[2.75rem] md:text-[3rem] font-bold tracking-tight leading-[1.05]"
            style={{ color: tokens.headingText, fontFamily: `'${theme.displayFont}', serif` }}
          >
            Choose your experience
          </div>
          <p className="mt-4 text-[13.5px] max-w-sm mx-auto leading-relaxed" style={{ color: tokens.mutedText, fontFamily: `'${theme.bodyFont}', sans-serif` }}>
            Same itinerary. Same days. Only the level of accommodation changes.
          </p>
        </div>

        {/* Tier cards */}
        <div className={`grid gap-4 ${visibleKeys.length === 1 ? "max-w-sm mx-auto" : visibleKeys.length === 2 ? "md:grid-cols-2 max-w-2xl mx-auto" : "md:grid-cols-3"}`}>
          {visibleKeys.map((tier) => {
            const p = pricing[tier];
            const isHighlighted = p.highlighted;
            const isActive = activeTier === tier;

            return (
              <div
                key={tier}
                onClick={() => setActiveTier(tier)}
                className={`relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 ${
                  isHighlighted ? "md:-translate-y-3 md:shadow-2xl shadow-lg" : "hover:shadow-md"
                }`}
                style={{
                  background: isHighlighted ? tokens.accent : tokens.cardBg,
                  border: `2px solid ${isActive ? tokens.secondaryAccent : isHighlighted ? "transparent" : tokens.border}`,
                  boxShadow: isHighlighted && isActive ? `0 0 0 3px ${tokens.secondaryAccent}` : undefined,
                }}
              >
                {/* Recommended — slim top accent line */}
                {isHighlighted && (
                  <div
                    className="h-0.5 w-full"
                    style={{ background: tokens.secondaryAccent }}
                  />
                )}

                <div className="p-8">
                  {/* Tier label + recommended badge */}
                  <div className="flex items-center justify-between mb-7">
                    <div
                      className="text-[9px] font-semibold uppercase tracking-[0.22em]"
                      style={{ color: isHighlighted ? "rgba(255,255,255,0.5)" : tokens.mutedText }}
                    >
                      {p.label}
                    </div>
                    {isHighlighted && (
                      <span
                        className="text-[9px] uppercase tracking-widest font-semibold px-2 py-0.5 rounded"
                        style={{ background: `${tokens.secondaryAccent}25`, color: tokens.secondaryAccent }}
                      >
                        Recommended
                      </span>
                    )}
                  </div>

                  {/* Price */}
                  <div className="mb-1.5">
                    <span
                      className="text-[11px] align-top mt-3 inline-block mr-1 font-medium"
                      style={{ color: isHighlighted ? "rgba(255,255,255,0.55)" : tokens.mutedText }}
                    >
                      {p.currency}
                    </span>
                    <span
                      contentEditable={isEditor}
                      suppressContentEditableWarning
                      className="text-[3rem] font-bold leading-none outline-none tracking-tight"
                      style={{
                        color: isHighlighted ? "white" : tokens.headingText,
                        fontFamily: `'${theme.displayFont}', serif`,
                      }}
                      onBlur={(e) => updateTierPrice(tier, e.currentTarget.textContent ?? p.pricePerPerson)}
                    >
                      {p.pricePerPerson}
                    </span>
                  </div>
                  <div
                    className="text-[11px] mb-8 leading-relaxed"
                    style={{ color: isHighlighted ? "rgba(255,255,255,0.4)" : tokens.mutedText }}
                  >
                    per person · {nights} nights
                  </div>

                  {/* Divider */}
                  <div
                    className="mb-6"
                    style={{ height: "1px", background: isHighlighted ? "rgba(255,255,255,0.12)" : tokens.border }}
                  />

                  {/* Total (derived) */}
                  {client.pax && (
                    <div className="mb-6">
                      <div
                        className="text-[9px] uppercase tracking-[0.2em] mb-1"
                        style={{ color: isHighlighted ? "rgba(255,255,255,0.35)" : tokens.mutedText }}
                      >
                        Total investment
                      </div>
                      <div
                        className="text-[14px] font-semibold"
                        style={{ color: isHighlighted ? "rgba(255,255,255,0.8)" : tokens.headingText }}
                      >
                        {p.currency} {(parseInt(p.pricePerPerson.replace(/,/g, "")) * (parseInt(client.pax) || 1)).toLocaleString()}
                      </div>
                    </div>
                  )}

                  {/* Select button */}
                  <button
                    className={`w-full py-3 rounded-xl text-[11px] font-semibold uppercase tracking-widest transition ${
                      isActive ? "" : "hover:opacity-80"
                    }`}
                    style={{
                      background: isActive
                        ? tokens.secondaryAccent
                        : isHighlighted
                        ? "rgba(255,255,255,0.12)"
                        : "transparent",
                      color: isActive
                        ? tokens.accent
                        : isHighlighted
                        ? "rgba(255,255,255,0.85)"
                        : tokens.mutedText,
                      border: `1px solid ${isActive ? "transparent" : isHighlighted ? "rgba(255,255,255,0.18)" : tokens.border}`,
                    }}
                  >
                    {isActive ? "Selected ✓" : "Select"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Notes */}
        {pricing.notes && (
          <p
            className="mt-10 text-sm text-center outline-none max-w-lg mx-auto"
            style={{ color: tokens.mutedText, fontFamily: `'${theme.bodyFont}', sans-serif` }}
            contentEditable={isEditor}
            suppressContentEditableWarning
            onBlur={(e) => updatePricingNotes(e.currentTarget.textContent ?? "")}
          >
            {pricing.notes}
          </p>
        )}
      </div>
    </div>
  );
}
