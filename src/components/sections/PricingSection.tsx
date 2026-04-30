"use client";

import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import { resolveTokens } from "@/lib/theme";
import type { Section } from "@/lib/types";

// ─── PricingSection ──────────────────────────────────────────────────────
//
// Minimal "Breakdown of Costs" card. One editable row showing:
//
//   {qty}× {type}     {qty}× {unitPrice}    {subtotal}
//   ───────────────────────────────────────────────────
//                              Total in {currency}    {total}
//
// Operator brief: "show only one editable pricing". The previous
// multi-tier layout (classic / premier / signature with inclusions,
// exclusions, payment schedule, T&Cs) is gone — this section is now
// purely the price breakdown card. Auxiliary info (payment terms,
// cancellation, etc.) belongs on separate sections if needed.
//
// Edit paths:
//   • quantity     → client.adults  (via updateClient)
//   • type label   → section.content.partyLabel
//   • unit price   → pricing[activeTier].pricePerPerson
//   • currency     → pricing[activeTier].currency
//
// Subtotal and total are computed (qty × unitPrice). Numbers format
// with locale-aware thousands separators and 2 decimal places.

export function PricingSection({ section }: { section: Section }) {
  const {
    proposal,
    updateClient,
    updateTierPrice,
    updateTierCurrency,
    updateSectionContent,
  } = useProposalStore();
  const { mode } = useEditorStore();
  const isEditor = mode === "editor";
  const { theme, client, pricing, activeTier } = proposal;
  const tokens = resolveTokens(theme.tokens, section.styleOverrides);

  // ── Read current values ─────────────────────────────────────────
  // Quantity: prefer client.adults; if blank/zero, default to 1.
  const qty = client.adults && client.adults > 0 ? client.adults : 1;
  // Type label — operator-editable; default "Adult".
  const partyLabel = (section.content.partyLabel as string) || "Adult";
  // Currency + unit price come from the active tier slot. Even though
  // we no longer render tier choices, we keep using the activeTier
  // record as the storage location so existing data migrates cleanly.
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

  return (
    <div
      className="py-6 md:py-10 px-8 md:px-16"
      style={{ background: tokens.sectionSurface }}
    >
      <div className="max-w-3xl mx-auto">
        {/* ── Title ───────────────────────────────────────────────── */}
        <h2
          className="text-[20px] md:text-[22px] font-bold mb-6"
          style={{
            color: tokens.headingText,
            fontFamily: `'${theme.displayFont}', serif`,
          }}
        >
          Breakdown of Costs
        </h2>

        {/* ── Card ────────────────────────────────────────────────── */}
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
                  updateSectionContent(section.id, { partyLabel: v.trim() || "Adult" })
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
                onChange={(n) =>
                  updateTierPrice(activeTier, n.toString())
                }
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
                  updateTierCurrency(activeTier, v.trim().toUpperCase() || "USD")
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
      </div>
    </div>
  );
}

// ─── Subcomponents ───────────────────────────────────────────────────────

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
      style={{
        outline: "none",
        ...style,
      }}
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
      style={{
        outline: "none",
        ...style,
      }}
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
