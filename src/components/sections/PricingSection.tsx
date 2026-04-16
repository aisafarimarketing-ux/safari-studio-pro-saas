"use client";

import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import type { Section, TierKey } from "@/lib/types";

const TIER_KEYS: TierKey[] = ["classic", "premier", "signature"];

export function PricingSection({ section }: { section: Section }) {
  const { proposal, setActiveTier, updateTierPrice, updatePricingNotes } = useProposalStore();
  const { mode } = useEditorStore();
  const isEditor = mode === "editor";
  const { pricing, activeTier, visibleTiers, days, theme } = proposal;
  const tokens = theme.tokens;
  const nights = days.length || proposal.trip.nights;

  return (
    <div className="py-16 px-8 md:px-16" style={{ background: tokens.sectionSurface }}>
      <div className="max-w-5xl mx-auto">
        <div className="text-[11px] uppercase tracking-[0.22em] mb-10" style={{ color: tokens.mutedText }}>
          Investment
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {TIER_KEYS.filter((t) => visibleTiers[t]).map((tier) => {
            const p = pricing[tier];
            const isHighlighted = p.highlighted;
            const isActive = activeTier === tier;

            return (
              <div
                key={tier}
                onClick={() => setActiveTier(tier)}
                className={`rounded-2xl p-7 border-2 cursor-pointer transition ${isActive ? "" : "hover:opacity-90"}`}
                style={{
                  background: isHighlighted ? tokens.accent : tokens.cardBg,
                  borderColor: isActive ? tokens.secondaryAccent : "transparent",
                }}
              >
                <div
                  className="text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2"
                  style={{ color: isHighlighted ? tokens.secondaryAccent : tokens.mutedText }}
                >
                  {p.label}
                  {isHighlighted && (
                    <span
                      className="text-[9px] px-2 py-0.5 rounded-full font-bold"
                      style={{ background: tokens.secondaryAccent, color: tokens.accent }}
                    >
                      RECOMMENDED
                    </span>
                  )}
                </div>

                <div
                  className="text-3xl font-bold mb-1"
                  style={{ color: isHighlighted ? "white" : tokens.headingText }}
                >
                  {p.currency}{" "}
                  <span
                    contentEditable={isEditor}
                    suppressContentEditableWarning
                    className="outline-none"
                    onBlur={(e) =>
                      updateTierPrice(tier, e.currentTarget.textContent ?? p.pricePerPerson)
                    }
                  >
                    {p.pricePerPerson}
                  </span>
                </div>
                <div
                  className="text-xs"
                  style={{ color: isHighlighted ? "rgba(255,255,255,0.5)" : tokens.mutedText }}
                >
                  per person · {nights} nights
                </div>

                {isActive && (
                  <div
                    className="mt-4 text-xs font-semibold px-3 py-1.5 rounded-full text-center"
                    style={{ background: tokens.secondaryAccent, color: tokens.accent }}
                  >
                    Currently selected
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {pricing.notes && (
          <p
            className="mt-6 text-sm outline-none"
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
