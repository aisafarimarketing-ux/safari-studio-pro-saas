"use client";

import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import type { Section, TierKey } from "@/lib/types";

const TIER_KEYS: TierKey[] = ["classic", "premier", "signature"];

export function PricingSection({ section }: { section: Section }) {
  const { proposal, setActiveTier, updateTierPrice, updatePricingNotes } = useProposalStore();
  const { mode } = useEditorStore();
  const isEditor = mode === "editor";
  const { pricing, activeTier, visibleTiers, days, theme, client } = proposal;
  const tokens = theme.tokens;
  const nights = days.length || proposal.trip.nights;
  const visibleKeys = TIER_KEYS.filter((t) => visibleTiers[t]);

  return (
    <div className="py-20 px-8 md:px-16" style={{ background: tokens.sectionSurface }}>
      <div className="max-w-5xl mx-auto">

        {/* Section header */}
        <div className="mb-14 text-center">
          <div className="text-[11px] uppercase tracking-[0.22em] mb-3" style={{ color: tokens.mutedText }}>
            Investment
          </div>
          <div
            className="text-[2.5rem] font-bold"
            style={{ color: tokens.headingText, fontFamily: `'${theme.displayFont}', serif` }}
          >
            Choose your experience
          </div>
          <p className="mt-3 text-sm max-w-md mx-auto" style={{ color: tokens.mutedText, fontFamily: `'${theme.bodyFont}', sans-serif` }}>
            Each tier uses the same itinerary — only the level of accommodation changes.
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
                {/* Recommended ribbon */}
                {isHighlighted && (
                  <div
                    className="text-[9px] font-bold uppercase tracking-widest text-center py-1.5"
                    style={{ background: tokens.secondaryAccent, color: tokens.accent }}
                  >
                    Recommended
                  </div>
                )}

                <div className="p-7">
                  {/* Tier label */}
                  <div
                    className="text-[10px] font-bold uppercase tracking-[0.2em] mb-6"
                    style={{ color: isHighlighted ? "rgba(255,255,255,0.55)" : tokens.mutedText }}
                  >
                    {p.label}
                  </div>

                  {/* Price */}
                  <div className="mb-1">
                    <span
                      className="text-xs align-top mt-2 inline-block mr-0.5"
                      style={{ color: isHighlighted ? "rgba(255,255,255,0.6)" : tokens.mutedText }}
                    >
                      {p.currency}
                    </span>
                    <span
                      contentEditable={isEditor}
                      suppressContentEditableWarning
                      className="text-[2.8rem] font-bold leading-none outline-none"
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
                    className="text-xs mb-8"
                    style={{ color: isHighlighted ? "rgba(255,255,255,0.45)" : tokens.mutedText }}
                  >
                    per person · {nights} nights
                  </div>

                  {/* Thin divider */}
                  <div
                    className="mb-5"
                    style={{ height: "1px", background: isHighlighted ? "rgba(255,255,255,0.15)" : tokens.border }}
                  />

                  {/* Total (derived) */}
                  {client.pax && (
                    <div className="mb-5">
                      <div
                        className="text-[9px] uppercase tracking-widest mb-0.5"
                        style={{ color: isHighlighted ? "rgba(255,255,255,0.4)" : tokens.mutedText }}
                      >
                        Total
                      </div>
                      <div
                        className="text-sm font-semibold"
                        style={{ color: isHighlighted ? "rgba(255,255,255,0.8)" : tokens.headingText }}
                      >
                        {p.currency} {(parseInt(p.pricePerPerson.replace(/,/g, "")) * (parseInt(client.pax) || 1)).toLocaleString()}
                      </div>
                    </div>
                  )}

                  {/* Select button */}
                  <button
                    className={`w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition ${
                      isActive ? "" : "hover:opacity-80"
                    }`}
                    style={{
                      background: isActive
                        ? tokens.secondaryAccent
                        : isHighlighted
                        ? "rgba(255,255,255,0.15)"
                        : tokens.border,
                      color: isActive
                        ? tokens.accent
                        : isHighlighted
                        ? "white"
                        : tokens.mutedText,
                      border: isActive ? "none" : `1px solid ${isHighlighted ? "rgba(255,255,255,0.2)" : tokens.border}`,
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
