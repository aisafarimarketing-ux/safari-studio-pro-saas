"use client";

import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import { resolveTokens } from "@/lib/theme";
import type { Section, ThemeTokens, ProposalTheme } from "@/lib/types";

// ─── PricingSection ──────────────────────────────────────────────────────
//
// Editorial pricing section. Sequence on the page:
//
//   1. "Your Investment" header
//   2. Breakdown of Costs card (the operator's preferred shape — one
//      row of qty × type × unit price → subtotal → total)
//   3. Pricing notes (italic line under the card)
//   4. Included + Not included (side-by-side editable lists)
//   5. Payment / Cancellation / Insurance / T&Cs (2x2 grid)
//
// The previous multi-tier rail (classic / premier / signature columns)
// has been replaced with the single Breakdown card per operator
// brief. Everything ELSE — inclusions, exclusions, policies, T&Cs —
// remains exactly as it was. Existing pricing data still lives under
// the activeTier slot, which is where the breakdown reads from.
//
// Edit paths on the breakdown card:
//   • quantity   → client.adults  (updateClient)
//   • type label → section.content.partyLabel
//   • unit price → pricing[activeTier].pricePerPerson
//   • currency   → pricing[activeTier].currency

export function PricingSection({ section }: { section: Section }) {
  const {
    proposal,
    updateClient,
    updateTierPrice,
    updateTierCurrency,
    updatePricingNotes,
    updateSectionContent,
    updateInclusions,
    updateExclusions,
  } = useProposalStore();
  const { mode } = useEditorStore();
  const isEditor = mode === "editor";
  const { theme, client, pricing, activeTier, inclusions, exclusions } = proposal;
  const tokens = resolveTokens(theme.tokens, section.styleOverrides);

  // ── Breakdown values ────────────────────────────────────────────
  const qty = client.adults && client.adults > 0 ? client.adults : 1;
  const partyLabel = (section.content.partyLabel as string) || "Adult";
  const tier = pricing[activeTier];
  const currency = tier.currency || "USD";
  const unitPriceNum = parseFloat(tier.pricePerPerson || "0") || 0;
  const subtotalNum = qty * unitPriceNum;

  const formatMoney = (n: number) =>
    new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);

  const fmtSubtotal = `${currencySymbol(currency)}${formatMoney(subtotalNum)}`;

  // ── Auxiliary content (unchanged from previous version) ─────────
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
      className="py-2 md:py-3 px-8 md:px-16"
      style={{ background: tokens.sectionSurface }}
    >
      <div className="max-w-5xl mx-auto space-y-10 md:space-y-12">
        {/* ── 1 · Header ─────────────────────────────────────── */}
        <header className="max-w-2xl">
          <Eyebrow tokens={tokens} theme={theme}>
            Your Investment
          </Eyebrow>
          <h2
            className="mt-2 font-bold leading-[1.05]"
            style={{
              color: tokens.headingText,
              fontFamily: `'${theme.displayFont}', serif`,
              fontSize: "clamp(1.75rem, 3.2vw, 2.25rem)",
              letterSpacing: "-0.01em",
            }}
          >
            Breakdown of Costs
          </h2>
        </header>

        {/* ── 2 · Breakdown card ─────────────────────────────── */}
        <section>
          <div
            className="rounded-md"
            style={{
              background: tokens.cardBg,
              border: `1px solid ${tokens.border}`,
            }}
          >
            {/* Single row: type | calc | subtotal */}
            <div
              className="grid items-baseline gap-6 px-6 md:px-8 py-5"
              style={{ gridTemplateColumns: "1.4fr 1fr 1fr" }}
            >
              {/* Left: "{qty}× {label}" */}
              <div
                className="text-[14px] font-semibold"
                style={{ color: tokens.headingText }}
              >
                <EditableNumber
                  value={qty}
                  isEditor={isEditor}
                  onChange={(n) => updateClient({ adults: n })}
                  style={{ color: tokens.headingText, fontWeight: 600 }}
                />
                <span aria-hidden style={{ opacity: 0.55, margin: "0 4px" }}>
                  ×
                </span>
                <EditableText
                  value={partyLabel}
                  isEditor={isEditor}
                  onChange={(v) =>
                    updateSectionContent(section.id, {
                      partyLabel: v.trim() || "Adult",
                    })
                  }
                  style={{ color: tokens.headingText, fontWeight: 600 }}
                />
              </div>

              {/* Mid: "{qty}× {currency}{unit}" — calculation display */}
              <div
                className="text-[13.5px] text-right"
                style={{ color: tokens.mutedText }}
              >
                <span>{qty}×&nbsp;</span>
                <span>{currencySymbol(currency)}</span>
                <EditableNumber
                  value={unitPriceNum}
                  isEditor={isEditor}
                  onChange={(n) => updateTierPrice(activeTier, n.toString())}
                  decimals={2}
                  style={{ color: tokens.mutedText }}
                />
              </div>

              {/* Right: subtotal — computed, not editable */}
              <div
                className="text-[14px] text-right font-semibold"
                style={{ color: tokens.headingText }}
              >
                {fmtSubtotal}
              </div>
            </div>

            {/* Hairline divider */}
            <div
              className="mx-6 md:mx-8"
              style={{ height: 1, background: tokens.border, opacity: 0.7 }}
            />

            {/* Total row */}
            <div
              className="grid items-baseline gap-6 px-6 md:px-8 py-4"
              style={{ gridTemplateColumns: "1.4fr 1fr 1fr" }}
            >
              <div />
              <div
                className="text-[13px] text-right uppercase"
                style={{ color: tokens.headingText, letterSpacing: "0.04em" }}
              >
                Total in&nbsp;
                <EditableText
                  value={currency}
                  isEditor={isEditor}
                  onChange={(v) =>
                    updateTierCurrency(
                      activeTier,
                      v.trim().toUpperCase() || "USD",
                    )
                  }
                  style={{
                    color: tokens.headingText,
                    fontWeight: 600,
                    textTransform: "uppercase",
                  }}
                />
              </div>
              <div
                className="text-[15px] text-right font-bold"
                style={{ color: tokens.headingText }}
              >
                {fmtSubtotal}
              </div>
            </div>
          </div>

          {/* Pricing notes — italic line below the card. */}
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
              {pricing.notes ||
                (isEditor
                  ? "Optional: price notes, validity window, what affects quote…"
                  : "")}
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
            onChange={(v) =>
              updateSectionContent(section.id, { paymentSchedule: v })
            }
          />
          <BodyBlock
            label="Cancellation policy"
            tokens={tokens}
            theme={theme}
            isEditor={isEditor}
            value={cancellationPolicy}
            onChange={(v) =>
              updateSectionContent(section.id, { cancellationPolicy: v })
            }
          />
          <BodyBlock
            label="Travel insurance"
            tokens={tokens}
            theme={theme}
            isEditor={isEditor}
            value={travelInsurance}
            onChange={(v) =>
              updateSectionContent(section.id, { travelInsurance: v })
            }
          />

          {/* Terms & Conditions — same 2x2 policy grid */}
          <section>
            <Eyebrow tokens={tokens} theme={theme}>
              Terms &amp; Conditions
            </Eyebrow>
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
                  <span className="ml-2" aria-hidden>
                    →
                  </span>
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
      <Eyebrow tokens={tokens} theme={theme}>
        {label}
      </Eyebrow>
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
      <Eyebrow tokens={tokens} theme={theme}>
        {label}
      </Eyebrow>
      {subhead && (
        <div
          className="mt-1 text-[12.5px]"
          style={{ color: tokens.mutedText }}
        >
          {subhead}
        </div>
      )}
      <ul className="mt-3 space-y-2 max-w-2xl">
        {items.map((item, i) => (
          <li
            key={i}
            className="group flex items-start gap-2.5 text-[13.5px] leading-[1.5]"
            style={{ color: tokens.bodyText }}
          >
            {/* Outline-style ✓/× — matches the trust-badge glyph used in
                the booking-recap closing so the two lists look like
                kin. */}
            <span
              aria-hidden
              className="shrink-0 inline-flex items-center justify-center mt-[1.5px]"
              style={{ width: 16, height: 16 }}
            >
              {accentBullet ? (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle
                    cx="8"
                    cy="8"
                    r="7.25"
                    stroke={tokens.accent}
                    strokeOpacity="0.4"
                    strokeWidth="1.2"
                  />
                  <path
                    d="M5 8.4 L7 10.4 L11 6.2"
                    stroke={tokens.accent}
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle
                    cx="8"
                    cy="8"
                    r="7.25"
                    stroke={tokens.mutedText}
                    strokeOpacity="0.4"
                    strokeWidth="1.2"
                  />
                  <path
                    d="M5.4 5.4 L10.6 10.6 M10.6 5.4 L5.4 10.6"
                    stroke={tokens.mutedText}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </span>
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

// ─── Inline editable primitives ──────────────────────────────────────────

function EditableText({
  value,
  isEditor,
  onChange,
  style,
}: {
  value: string;
  isEditor: boolean;
  onChange: (next: string) => void;
  style?: React.CSSProperties;
}) {
  return (
    <span
      contentEditable={isEditor}
      suppressContentEditableWarning
      onBlur={(e) => onChange(e.currentTarget.textContent ?? "")}
      style={{ outline: "none", ...style }}
    >
      {value}
    </span>
  );
}

function EditableNumber({
  value,
  isEditor,
  onChange,
  decimals = 0,
  style,
}: {
  value: number;
  isEditor: boolean;
  onChange: (next: number) => void;
  decimals?: number;
  style?: React.CSSProperties;
}) {
  const display =
    decimals > 0
      ? new Intl.NumberFormat(undefined, {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        }).format(value)
      : String(value);
  return (
    <span
      contentEditable={isEditor}
      suppressContentEditableWarning
      onBlur={(e) => {
        const text = (e.currentTarget.textContent ?? "")
          .replace(/[^\d.\-]/g, "")
          .trim();
        const n = parseFloat(text);
        if (isFinite(n)) onChange(n);
      }}
      style={{ outline: "none", ...style }}
    >
      {display}
    </span>
  );
}

// ─── Currency symbols ────────────────────────────────────────────────────

function currencySymbol(code: string): string {
  const upper = (code || "USD").toUpperCase();
  switch (upper) {
    case "USD":
    case "AUD":
    case "CAD":
    case "NZD":
    case "SGD":
      return "$";
    case "EUR":
      return "€";
    case "GBP":
      return "£";
    case "JPY":
      return "¥";
    case "ZAR":
      return "R";
    case "KES":
      return "KSh ";
    case "TZS":
      return "TSh ";
    default:
      return `${upper} `;
  }
}
