"use client";

import { useProposalStore } from "@/store/proposalStore";
import { resolveTokens } from "@/lib/theme";
import type { Section, TierKey } from "@/lib/types";
import { PRICING_LAYOUTS, PRICING_STANDARD } from "@/lib/pdfFit/manifests/pricing";
import { PdfFitLayout } from "./PdfFitLayout";
import { PdfPage } from "../PdfPage";
import type { SlotContent } from "./PdfFitSlot";

// ─── PDF-Fit pricing page ──────────────────────────────────────────────────
//
// Resolves pricing data into the manifest's table-row structure.
// Two-row simple table — operator's pricing.classic / .premier /
// .signature for the active tier becomes row 1; if the proposal has
// adults + children, row 2 = children pricing. Otherwise row 2 stays
// empty.
//
// Included / excluded — bulletted text from proposal.inclusions /
// .exclusions, line-broken with "•" prefixes.

type Props = { section: Section };

export function PdfFitPricingPage({ section }: Props) {
  const { proposal } = useProposalStore();
  const tokens = resolveTokens(proposal.theme.tokens, section.styleOverrides);

  const variantId =
    typeof section.content?.variantId === "string"
      ? section.content.variantId
      : "clean_financial";

  const manifest =
    PRICING_LAYOUTS.find((l) => l.id === section.layoutVariant) ?? PRICING_STANDARD;

  const activeTier: TierKey =
    proposal.activeTier && ["classic", "premier", "signature"].includes(proposal.activeTier)
      ? proposal.activeTier
      : "premier";

  const tier = proposal.pricing?.[activeTier];
  const currency = tier?.currency?.trim() || "USD";
  const perPersonRaw = tier?.pricePerPerson?.trim() || "";
  const perPerson = parsePrice(perPersonRaw);

  const adults = numField(proposal.client?.adults) ?? 2;
  const children = numField(proposal.client?.children) ?? 0;

  // Row 1 — adults
  const row1Label = `Adults · ${tier?.label ?? activeTier} tier`;
  const row1Calc = perPerson
    ? `${formatMoney(currency, perPerson)} × ${adults}`
    : "";
  const row1Total = perPerson ? formatMoney(currency, perPerson * adults) : "—";

  // Row 2 — children (only when present + we have a children price)
  const row2Label = children > 0 ? `Children (${children})` : "";
  const row2Calc = "";
  const row2Total = "";

  const grandTotal = perPerson
    ? `Total: ${formatMoney(currency, perPerson * adults)}`
    : "";

  const includedList = (proposal.inclusions ?? [])
    .filter(Boolean)
    .slice(0, 12)
    .map((s) => `•  ${s}`)
    .join("\n");
  const excludedList = (proposal.exclusions ?? [])
    .filter(Boolean)
    .slice(0, 12)
    .map((s) => `•  ${s}`)
    .join("\n");
  // Empty-state copy — when the operator hasn't entered any
  // inclusions / exclusions, the lists need a placeholder so the
  // header label + the slot don't read as broken.
  const includedDisplay =
    includedList || "—";
  const excludedDisplay =
    excludedList || "—";

  // Structural defaults — these labels and policy stubs are part of
  // the layout's identity (same role as "Karibu —" on the personal
  // note or "FOR / DATES" on the cover). The operator overrides any
  // of them by typing into section.content.{paymentBlock,
  // cancellationBlock, footerBlocks, title, intro}; empty backend
  // → these defaults render so the printed page never reads as
  // unfinished.
  const sectionTitle = strField(section.content?.title) ?? "Pricing";
  const sectionIntro =
    strField(section.content?.intro) ??
    "A clear breakdown of your safari investment.";
  const paymentBlock =
    strField(section.content?.paymentBlock) ??
    "PAYMENT TERMS\nA deposit secures the booking. Balance due 60 days before arrival. Wire transfer or operator-issued card link accepted.";
  const cancellationBlock =
    strField(section.content?.cancellationBlock) ??
    "CANCELLATION POLICY\nCancellation terms apply per the operator's standard policy. Travel insurance strongly recommended.";
  const footerBlocks =
    strField(section.content?.footerBlocks) ??
    `Pricing in ${currency}. Quoted per-person rates assume double-occupancy unless otherwise noted; we can adjust based on your dates and lodge preferences.`;

  // ── Magazine-clone "editorial" variant content ──────────────────
  // Mirrors PricingSection.tsx: party label · adults calc · subtotal,
  // optional child row, total in <currency>, value framing line,
  // pricing notes italic, four 2x2 policy quadrants.
  const partyLabel =
    strField(section.content?.partyLabel) ?? "Adult";
  const childLabel =
    strField(section.content?.childLabel) ?? "Child";
  const childPriceRaw =
    strField(section.content?.childPrice) ?? "";
  const childPrice = parsePrice(childPriceRaw);
  const ccy = (currency || "USD").toUpperCase();
  const adultsCalcLine = perPerson
    ? `${adults}× ${formatMoney(currency, perPerson)}`
    : "";
  const adultsSubtotalLine = perPerson
    ? formatMoney(currency, perPerson * adults)
    : "—";
  const childCalcLine = childPrice
    ? `${children}× ${formatMoney(currency, childPrice)}`
    : "";
  const childSubtotalLine = childPrice
    ? formatMoney(currency, childPrice * children)
    : "";
  const totalAmountValue = (() => {
    const a = perPerson ? perPerson * adults : 0;
    const c = childPrice ? childPrice * children : 0;
    const total = a + c;
    return total > 0 ? formatMoney(currency, total) : "—";
  })();
  const valueFraming =
    strField(section.content?.valueFraming) ??
    "Includes private guiding, hand-picked lodges, and seamless internal transfers — arranged end-to-end.";
  const pricingNotes =
    strField(proposal.pricing?.notes) ??
    strField(section.content?.pricingNotes) ??
    "";
  const paymentSchedule =
    strField(section.content?.paymentSchedule) ??
    "A 30% deposit secures your booking. The balance is due 30 days before departure. Payments accepted via international wire transfer or online credit card (card payments attract a 3.5% surcharge).";
  const cancellationPolicy =
    strField(section.content?.cancellationPolicy) ??
    "Cancellations made 60+ days before arrival receive a full refund minus a 10% admin fee. Between 60 and 30 days, 50% of the total is refundable. Cancellations inside 30 days are non-refundable. We strongly recommend comprehensive travel insurance.";
  const travelInsurance =
    strField(section.content?.travelInsurance) ??
    "Travel insurance is not included and is strongly recommended. Your policy should cover trip cancellation, curtailment, medical evacuation, and personal effects. We can suggest reputable providers on request.";
  const termsValue =
    strField(section.content?.termsLabel) ??
    "Download full terms & conditions";
  const termsUrl = strField(section.content?.termsUrl) ?? "";

  const contents: Record<string, SlotContent> = {
    // Original PRICING_STANDARD slots — still populated so that
    // manifest renders correctly when picked.
    section_title: { kind: "text", value: sectionTitle },
    section_intro: { kind: "text", value: sectionIntro },
    row_1_label: { kind: "text", value: row1Label },
    row_1_calc: { kind: "text", value: row1Calc },
    row_1_total: { kind: "text", value: row1Total },
    row_2_label: { kind: "text", value: row2Label },
    row_2_calc: { kind: "text", value: row2Calc },
    row_2_total: { kind: "text", value: row2Total },
    grand_total: { kind: "text", value: grandTotal },
    total_label: { kind: "text", value: "Total investment" },
    included_label: { kind: "text", value: "INCLUDED" },
    included_list: { kind: "text", value: includedDisplay },
    excluded_label: { kind: "text", value: "NOT INCLUDED" },
    excluded_list: { kind: "text", value: excludedDisplay },
    payment_block: { kind: "text", value: paymentBlock },
    cancellation_block: { kind: "text", value: cancellationBlock },
    footer_blocks: { kind: "text", value: footerBlocks },

    // PRICING_EDITORIAL (magazine-clone) slots.
    section_eyebrow: { kind: "text", value: "YOUR INVESTMENT" },
    value_framing: { kind: "text", value: valueFraming },
    adults_label: { kind: "text", value: `${adults} × ${partyLabel}` },
    adults_calc: { kind: "text", value: adultsCalcLine },
    adults_subtotal: { kind: "text", value: adultsSubtotalLine },
    child_label: {
      kind: "text",
      value: children > 0 ? `${children} × ${childLabel}` : "",
    },
    child_calc: { kind: "text", value: childCalcLine },
    child_subtotal: { kind: "text", value: childSubtotalLine },
    total_amount: { kind: "text", value: totalAmountValue },
    pricing_notes: { kind: "text", value: pricingNotes },
    payment_label: { kind: "text", value: "PAYMENT SCHEDULE" },
    payment_schedule: { kind: "text", value: paymentSchedule },
    cancellation_label: { kind: "text", value: "CANCELLATION POLICY" },
    cancellation_policy: { kind: "text", value: cancellationPolicy },
    insurance_label: { kind: "text", value: "TRAVEL INSURANCE" },
    travel_insurance: { kind: "text", value: travelInsurance },
    terms_label: { kind: "text", value: "TERMS & CONDITIONS" },
    terms_value: { kind: "text", value: termsValue },
    terms_url: { kind: "text", value: termsUrl },
  };

  // Section title flips to "Breakdown of Costs" when the editorial
  // manifest is in play (matches the magazine layout).
  if (manifest.id === "editorial") {
    contents.section_title = {
      kind: "text",
      value: strField(section.content?.title) ?? "Breakdown of Costs",
    };
  }

  // Total label includes the currency code so the row reads
  // "TOTAL IN USD · 20,000".
  contents.total_label = {
    kind: "text",
    value: `Total in ${ccy}`,
  };

  return (
    <PdfPage label="Pricing" bleed>
      <div data-section-type="pricing" style={{ width: "100%", height: "100%" }}>
        <PdfFitLayout
          manifest={manifest}
          contents={contents}
          theme={proposal.theme}
          tokens={tokens}
          variantId={variantId}
        />
      </div>
    </PdfPage>
  );
}

function strField(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

function numField(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
  return undefined;
}

function parsePrice(s: string): number | null {
  if (!s) return null;
  const cleaned = s.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function formatMoney(currency: string, amount: number): string {
  const formatted = Math.round(amount).toLocaleString("en-US");
  return currency ? `${currency} ${formatted}` : formatted;
}
