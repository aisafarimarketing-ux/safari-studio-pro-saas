"use client";

import { useProposalStore } from "@/store/proposalStore";
import { resolveTokens } from "@/lib/theme";
import type { Section, TierKey } from "@/lib/types";
import { PRICING_STANDARD } from "@/lib/pdfFit/manifests/pricing";
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

  const paymentBlock =
    strField(section.content?.paymentBlock) ??
    "Deposit holds the booking. Balance due ahead of arrival.";
  const cancellationBlock =
    strField(section.content?.cancellationBlock) ??
    "Cancellation terms apply per the operator's policy.";
  const footerBlocks =
    strField(section.content?.footerBlocks) ??
    "Pricing in " + currency + ". We can adjust based on your dates and lodge preferences.";

  const sectionTitle =
    strField(section.content?.title) ?? "Pricing";
  const sectionIntro =
    strField(section.content?.intro) ??
    "Here's a clear breakdown of your safari pricing.";

  const contents: Record<string, SlotContent> = {
    section_title: { kind: "text", value: sectionTitle },
    section_intro: { kind: "text", value: sectionIntro },
    row_1_label: { kind: "text", value: row1Label },
    row_1_calc: { kind: "text", value: row1Calc },
    row_1_total: { kind: "text", value: row1Total },
    row_2_label: { kind: "text", value: row2Label },
    row_2_calc: { kind: "text", value: row2Calc },
    row_2_total: { kind: "text", value: row2Total },
    grand_total: { kind: "text", value: grandTotal },
    included_list: { kind: "text", value: includedList },
    excluded_list: { kind: "text", value: excludedList },
    payment_block: { kind: "text", value: paymentBlock },
    cancellation_block: { kind: "text", value: cancellationBlock },
    footer_blocks: { kind: "text", value: footerBlocks },
  };

  return (
    <PdfPage label="Pricing" bleed>
      <div data-section-type="pricing" style={{ width: "100%", height: "100%" }}>
        <PdfFitLayout
          manifest={PRICING_STANDARD}
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
