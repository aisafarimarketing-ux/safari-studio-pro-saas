"use client";

import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import { resolveTokens } from "@/lib/theme";
import type {
  Section,
  TierKey,
  ThemeTokens,
  ProposalTheme,
  PricingData,
} from "@/lib/types";

// Pricing — single "editorial" variant that matches the Royal-Portfolio
// reference: generous whitespace, narrow text columns, caps wayfinding
// labels, serif display heads, hairline dividers only. Carries everything
// a luxury operator needs to close a sale on one page:
//
//   1. Your Investment header
//   2. Tier rail (classic / premier / signature)
//   3. What's included      (from proposal.inclusions)
//   4. What's not included  (from proposal.exclusions)
//   5. Payment schedule     (section.content.paymentSchedule)
//   6. Cancellation policy  (section.content.cancellationPolicy)
//   7. Travel insurance     (section.content.travelInsurance)
//   8. Terms & Conditions   (section.content.termsLabel + termsUrl)
//
// Every field is contentEditable; lists add/remove via the existing
// inclusions / exclusions store actions.

const TIER_KEYS: TierKey[] = ["classic", "premier", "signature"];

export function PricingSection({ section }: { section: Section }) {
  const {
    proposal,
    setActiveTier,
    updateTierPrice,
    updateTierCurrency,
    updateTierLabel,
    updatePricingNotes,
    updateSectionContent,
    updateInclusions,
    updateExclusions,
  } = useProposalStore();
  const { mode } = useEditorStore();
  const isEditor = mode === "editor";
  const { pricing, activeTier, visibleTiers, days, theme, client, inclusions, exclusions } = proposal;
  const tokens = resolveTokens(theme.tokens, section.styleOverrides);
  const nights = days.length || proposal.trip.nights;
  const visibleKeys = TIER_KEYS.filter((t) => visibleTiers[t]);

  const paymentSchedule =
    (section.content.paymentSchedule as string) ||
    "A 30% deposit secures your booking. The balance is due 30 days before departure. Payments accepted via international wire transfer or online credit card (card payments attract a 3.5% surcharge).";
  const cancellationPolicy =
    (section.content.cancellationPolicy as string) ||
    "Cancellations made 60+ days before arrival receive a full refund minus a 10% admin fee. Between 60 and 30 days, 50% of the total is refundable. Cancellations inside 30 days are non-refundable. We strongly recommend comprehensive travel insurance.";
  const travelInsurance =
    (section.content.travelInsurance as string) ||
    "Travel insurance is not included and is strongly recommended. Your policy should cover trip cancellation, curtailment, medical evacuation, and personal effects. We can suggest reputable providers on request.";
  const termsLabel =
    (section.content.termsLabel as string) || "Download full terms & conditions";
  const termsUrl = (section.content.termsUrl as string) || "";

  return (
    <div
      className="py-20 md:py-24 px-8 md:px-16"
      style={{ background: tokens.sectionSurface }}
    >
      <div className="max-w-5xl mx-auto space-y-10 md:space-y-12">
        {/* ── 1 · Header ─────────────────────────────────────── */}
        <header className="max-w-2xl">
          <Eyebrow tokens={tokens} theme={theme}>Your Investment</Eyebrow>
          <h2
            className="mt-2 font-bold leading-[1.05]"
            style={{
              color: tokens.headingText,
              fontFamily: `'${theme.displayFont}', serif`,
              fontSize: "clamp(1.75rem, 3.2vw, 2.25rem)",
              letterSpacing: "-0.01em",
            }}
          >
            Choose your experience
          </h2>
          <p
            className="mt-2 text-[14px] leading-[1.6]"
            style={{ color: tokens.bodyText }}
          >
            Same itinerary at three levels — only the accommodation shifts between tiers.
          </p>
        </header>

        {/* ── 2 · Tier rail + notes ─────────────────────────── */}
        <section>
          <TierRail
            pricing={pricing}
            visibleKeys={visibleKeys}
            activeTier={activeTier}
            onSelect={setActiveTier}
            onUpdatePrice={updateTierPrice}
            onUpdateCurrency={updateTierCurrency}
            onUpdateLabel={updateTierLabel}
            nights={nights}
            client={client}
            isEditor={isEditor}
            tokens={tokens}
            theme={theme}
          />

          {(pricing.notes || isEditor) && (
            <p
              className="mt-4 text-[12.5px] max-w-2xl italic outline-none"
              style={{
                color: tokens.mutedText,
                fontFamily: `'${theme.displayFont}', serif`,
              }}
              contentEditable={isEditor}
              suppressContentEditableWarning
              onBlur={(e) => updatePricingNotes(e.currentTarget.textContent ?? "")}
            >
              {pricing.notes || (isEditor ? "Optional: price notes, validity window, what affects quote…" : "")}
            </p>
          )}
        </section>

        {/* ── 3 · Included + Not included (side by side) ────── */}
        <div className="grid md:grid-cols-2 gap-10 md:gap-14">
          <EditableList
            label="Included"
            items={inclusions}
            onChange={updateInclusions}
            isEditor={isEditor}
            tokens={tokens}
            theme={theme}
            accentBullet
          />
          <EditableList
            label="Not included"
            items={exclusions}
            onChange={updateExclusions}
            isEditor={isEditor}
            tokens={tokens}
            theme={theme}
          />
        </div>

        {/* ── 4 · Policies + T&Cs (2-col grid) ──────────────── */}
        <div className="grid md:grid-cols-2 gap-10 md:gap-14">
          <BodyBlock
            label="Payment schedule"
            tokens={tokens}
            theme={theme}
            isEditor={isEditor}
            value={paymentSchedule}
            onChange={(v) => updateSectionContent(section.id, { paymentSchedule: v })}
          />
          <BodyBlock
            label="Cancellation policy"
            tokens={tokens}
            theme={theme}
            isEditor={isEditor}
            value={cancellationPolicy}
            onChange={(v) => updateSectionContent(section.id, { cancellationPolicy: v })}
          />
          <BodyBlock
            label="Travel insurance"
            tokens={tokens}
            theme={theme}
            isEditor={isEditor}
            value={travelInsurance}
            onChange={(v) => updateSectionContent(section.id, { travelInsurance: v })}
          />

          {/* ── Terms & Conditions — in the same 2x2 policy grid ────── */}
          <section>
            <Eyebrow tokens={tokens} theme={theme}>Terms &amp; Conditions</Eyebrow>
            <div className="mt-3 flex items-center gap-2.5">
              <CrownGlyph color={tokens.accent} />
              {termsUrl ? (
                <a
                  href={termsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[14px] underline underline-offset-[4px] hover:opacity-80 transition"
                  style={{ color: tokens.headingText }}
                >
                  <span
                    className="outline-none"
                    contentEditable={isEditor}
                    suppressContentEditableWarning
                    onBlur={(e) =>
                      updateSectionContent(section.id, {
                        termsLabel: e.currentTarget.textContent ?? termsLabel,
                      })
                    }
                  >
                    {termsLabel}
                  </span>
                  <span className="ml-2" aria-hidden>→</span>
                </a>
              ) : (
                <div className="text-[14px]" style={{ color: tokens.mutedText }}>
                  <span
                    className="outline-none"
                    contentEditable={isEditor}
                    suppressContentEditableWarning
                    onBlur={(e) =>
                      updateSectionContent(section.id, {
                        termsLabel: e.currentTarget.textContent ?? termsLabel,
                      })
                    }
                  >
                    {termsLabel}
                  </span>
                </div>
              )}
            </div>
            {isEditor && (
              <div
                className="mt-2 text-[11px]"
                style={{ color: tokens.mutedText }}
              >
                URL:{" "}
                <span
                  className="outline-none px-2 py-0.5 rounded"
                  style={{
                    background: `${tokens.accent}10`,
                    color: tokens.headingText,
                  }}
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) =>
                    updateSectionContent(section.id, {
                      termsUrl: e.currentTarget.textContent?.trim() ?? "",
                    })
                  }
                >
                  {termsUrl || "https://example.com/terms.pdf"}
                </span>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

// ─── Shared bits ──────────────────────────────────────────────────────────

function Eyebrow({
  children,
  tokens,
  theme,
}: {
  children: React.ReactNode;
  tokens: ThemeTokens;
  theme: ProposalTheme;
}) {
  return (
    <div
      className="text-[10.5px] uppercase tracking-[0.3em] font-bold"
      style={{
        color: tokens.mutedText,
        fontFamily: `'${theme.bodyFont}', sans-serif`,
      }}
    >
      {children}
    </div>
  );
}

function BodyBlock({
  label,
  tokens,
  theme,
  isEditor,
  value,
  onChange,
}: {
  label: string;
  tokens: ThemeTokens;
  theme: ProposalTheme;
  isEditor: boolean;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <section>
      <Eyebrow tokens={tokens} theme={theme}>{label}</Eyebrow>
      <div
        className="mt-3 max-w-2xl text-[14.5px] leading-[1.7] whitespace-pre-line outline-none"
        style={{ color: tokens.bodyText }}
        contentEditable={isEditor}
        suppressContentEditableWarning
        onBlur={(e) => onChange(e.currentTarget.textContent ?? "")}
      >
        {value}
      </div>
    </section>
  );
}

function EditableList({
  label,
  subhead,
  items,
  onChange,
  isEditor,
  tokens,
  theme,
  accentBullet,
}: {
  label: string;
  subhead?: string;
  items: string[];
  onChange: (next: string[]) => void;
  isEditor: boolean;
  tokens: ThemeTokens;
  theme: ProposalTheme;
  accentBullet?: boolean;
}) {
  if (items.length === 0 && !isEditor) return null;

  return (
    <section>
      <Eyebrow tokens={tokens} theme={theme}>{label}</Eyebrow>
      {subhead && (
        <div
          className="mt-1 text-[12.5px]"
          style={{ color: tokens.mutedText }}
        >
          {subhead}
        </div>
      )}
      <ul className="mt-3 grid sm:grid-cols-2 gap-x-8 gap-y-1.5 max-w-2xl">
        {items.map((item, i) => (
          <li
            key={i}
            className="group flex items-start gap-3 text-[14px] leading-[1.55]"
            style={{ color: tokens.bodyText }}
          >
            <span
              aria-hidden
              className="shrink-0 mt-[9px]"
              style={{
                width: 4,
                height: 4,
                borderRadius: 999,
                background: accentBullet ? tokens.accent : tokens.border,
              }}
            />
            <span
              className="flex-1 outline-none"
              contentEditable={isEditor}
              suppressContentEditableWarning
              onBlur={(e) => {
                const next = [...items];
                next[i] = e.currentTarget.textContent?.trim() ?? item;
                onChange(next.filter(Boolean));
              }}
            >
              {item}
            </span>
            {isEditor && (
              <button
                type="button"
                onClick={() => onChange(items.filter((_, idx) => idx !== i))}
                className="shrink-0 text-[14px] text-black/30 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                title="Remove"
              >
                ×
              </button>
            )}
          </li>
        ))}
      </ul>
      {isEditor && (
        <button
          type="button"
          onClick={() => onChange([...items, "New item"])}
          className="mt-4 text-[11.5px] font-semibold uppercase tracking-[0.22em] transition hover:opacity-75"
          style={{ color: tokens.accent }}
        >
          + Add item
        </button>
      )}
    </section>
  );
}

function TierRail({
  pricing,
  visibleKeys,
  activeTier,
  onSelect,
  onUpdatePrice,
  onUpdateCurrency,
  onUpdateLabel,
  nights,
  client,
  isEditor,
  tokens,
  theme,
}: {
  pricing: PricingData;
  visibleKeys: TierKey[];
  activeTier: TierKey;
  onSelect: (tier: TierKey) => void;
  onUpdatePrice: (tier: TierKey, price: string) => void;
  onUpdateCurrency: (tier: TierKey, currency: string) => void;
  onUpdateLabel: (tier: TierKey, label: string) => void;
  nights: number;
  client: { pax?: string };
  isEditor: boolean;
  tokens: ThemeTokens;
  theme: ProposalTheme;
}) {
  const pax = parseInt((client.pax || "").trim(), 10) || 0;

  return (
    <section>
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
          const total =
            pax > 0
              ? (parseInt(p.pricePerPerson.replace(/,/g, ""), 10) || 0) * pax
              : null;
          return (
            <div
              key={tier}
              onClick={() => onSelect(tier)}
              className="relative cursor-pointer py-8 px-5 md:px-6 transition"
              style={{
                borderLeft: i > 0 ? `1px solid ${tokens.border}` : undefined,
              }}
            >
              {isActive && (
                <div
                  className="absolute left-0 right-0 -top-px h-0.5"
                  style={{ background: tokens.accent }}
                />
              )}

              <div className="flex items-center justify-between mb-8">
                <div
                  className="text-[10.5px] font-bold uppercase tracking-[0.28em] outline-none"
                  style={{
                    color: isActive ? tokens.accent : tokens.mutedText,
                  }}
                  contentEditable={isEditor}
                  suppressContentEditableWarning
                  onBlur={(e) => onUpdateLabel(tier, e.currentTarget.textContent?.trim() ?? p.label)}
                >
                  {p.label}
                </div>
                {isRecommended && (
                  <span
                    className="text-[9px] uppercase tracking-[0.2em] font-semibold"
                    style={{ color: tokens.accent }}
                  >
                    Recommended
                  </span>
                )}
              </div>

              <div className="flex items-baseline gap-1.5">
                <span
                  className="text-[11.5px] font-medium outline-none"
                  style={{ color: tokens.mutedText }}
                  contentEditable={isEditor}
                  suppressContentEditableWarning
                  onBlur={(e) =>
                    onUpdateCurrency(tier, e.currentTarget.textContent?.trim() ?? p.currency)
                  }
                >
                  {p.currency}
                </span>
                <span
                  className="font-bold leading-none outline-none tracking-tight tabular-nums"
                  contentEditable={isEditor}
                  suppressContentEditableWarning
                  style={{
                    color: tokens.headingText,
                    fontFamily: `'${theme.displayFont}', serif`,
                    fontSize: "clamp(2rem, 3.6vw, 2.75rem)",
                  }}
                  onBlur={(e) =>
                    onUpdatePrice(tier, e.currentTarget.textContent?.trim() ?? p.pricePerPerson)
                  }
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
                    style={{ color: tokens.mutedText }}
                  >
                    Total
                  </span>
                  <span
                    className="text-[15px] font-semibold"
                    style={{
                      color: tokens.headingText,
                      fontFamily: `'${theme.displayFont}', serif`,
                    }}
                  >
                    {p.currency} {total.toLocaleString()}
                  </span>
                </div>
              )}

              <div
                className="mt-6 text-[11px] font-semibold uppercase tracking-[0.22em]"
                style={{
                  color: isActive ? tokens.accent : tokens.mutedText,
                }}
              >
                {isActive ? "Selected ✓" : "Select →"}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function CrownGlyph({ color }: { color: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 8l4 5 5-6 5 6 4-5v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z" />
      <circle cx="7" cy="6" r="1" fill={color} stroke="none" />
      <circle cx="12" cy="4.5" r="1" fill={color} stroke="none" />
      <circle cx="17" cy="6" r="1" fill={color} stroke="none" />
    </svg>
  );
}
