"use client";

import { useProposalStore } from "@/store/proposalStore";
import { resolveTokens } from "@/lib/theme";
import type { Section } from "@/lib/types";
import { COVER_FULL_BLEED, COVER_LAYOUTS } from "@/lib/pdfFit/manifests/cover";
import { PdfFitLayout } from "./PdfFitLayout";
import { PdfPage } from "../PdfPage";
import type { SlotContent } from "./PdfFitSlot";

// ─── PDF-Fit cover page renderer ──────────────────────────────────────────
//
// Resolves the 7 mandatory backend fields per spec:
//   1. Trip Title           ← proposal.metadata.title || proposal.trip.title
//   2. Destinations         ← proposal.trip.destinations joined with " · "
//   3. Client Name (For)    ← proposal.client.guestNames
//   4. Dates                ← proposal.trip.dates
//   5. Duration             ← strict "X days and Y nights" (from trip.nights)
//   6. Party                ← strict "N adults, M children" (from client adults/children)
//   7. Company Logo         ← proposal.operator.logoUrl
//
// Layout (FULL_BLEED, S64L/R, S55L/R, S46L/R) chosen via
// section.layoutVariant; falls back to FULL_BLEED.

type Props = { section: Section };

export function PdfFitCoverPage({ section }: Props) {
  const { proposal } = useProposalStore();
  const tokens = resolveTokens(proposal.theme.tokens, section.styleOverrides);

  const manifest =
    COVER_LAYOUTS.find((l) => l.id === section.layoutVariant) ?? COVER_FULL_BLEED;

  // Treatment id (FRAMED_LUXURY / TINTED_OVERLAY / FLOATING_CARD /
  // GRADIENT_SPLIT) — visual variant from section.content.treatmentId.
  // Variants live in lib/pdfFit/variants.ts and adjust typography +
  // fills only; positions stay locked.
  const variantId =
    typeof section.content?.treatmentId === "string"
      ? section.content.treatmentId
      : typeof section.content?.variantId === "string"
        ? section.content.variantId
        : "default";

  // ─── 1. Trip title — backend value verbatim, no fallback string ─────
  const tripTitle =
    proposal.metadata?.title?.trim() ||
    proposal.trip?.title?.trim() ||
    "";

  // ─── 2. Destinations (single line, joined with middle dot) ──────────
  const tripDestinations = (proposal.trip?.destinations ?? [])
    .filter((s) => Boolean(s?.trim()))
    .join("  ·  ");

  // ─── 3. Client Name ──────────────────────────────────────────────────
  const clientName = proposal.client?.guestNames?.trim() || "";

  // ─── 4. Dates ────────────────────────────────────────────────────────
  const dates = proposal.trip?.dates?.trim() || "";

  // ─── 5. Duration — strict "X days and Y nights" ──────────────────────
  const nights = numField(proposal.trip?.nights);
  const durationLine = nights
    ? `${nights + 1} days and ${nights} ${nights === 1 ? "night" : "nights"}`
    : "";

  // ─── 6. Party — strict "N adults, M children" ────────────────────────
  const adults = numField(proposal.client?.adults);
  const children = numField(proposal.client?.children) ?? 0;
  const partyLine = (() => {
    if (!adults && !children) return proposal.client?.pax?.trim() || "";
    const adultsLabel =
      adults && adults > 0
        ? `${adults} ${adults === 1 ? "adult" : "adults"}`
        : "";
    const childrenLabel =
      children && children > 0
        ? `${children} ${children === 1 ? "child" : "children"}`
        : "";
    return [adultsLabel, childrenLabel].filter(Boolean).join(", ");
  })();

  // ─── 7. Operator logo ────────────────────────────────────────────────
  const operatorLogoUrl = proposal.operator?.logoUrl?.trim() || null;

  // Hero image — section override > stops[0].heroImageUrl > operator logo.
  const heroImageUrl =
    (section.content?.heroImageUrl as string | undefined)?.trim() ||
    proposal.trip?.stops?.[0]?.heroImageUrl?.trim() ||
    operatorLogoUrl ||
    null;

  // Image positioning — operator's per-section drag/zoom values.
  // Falls back to centered default. Stored on section.content so the
  // editor can persist them through saves.
  const heroImagePosition =
    (section.content?.heroImagePosition as string | undefined) || "50% 50%";
  const heroImageScale = (() => {
    const v = section.content?.heroImageScale;
    if (typeof v === "number" && Number.isFinite(v) && v >= 0.5 && v <= 3) {
      return v;
    }
    return 1;
  })();

  const contents: Record<string, SlotContent> = {
    hero_image: {
      kind: "image",
      url: heroImageUrl,
      alt: tripTitle,
      objectPosition: heroImagePosition,
      scale: heroImageScale,
    },
    operator_logo: { kind: "image", url: operatorLogoUrl, alt: "" },
    trip_title: { kind: "text", value: tripTitle },
    trip_destinations: { kind: "text", value: tripDestinations },
    metaLabel0: { kind: "text", value: "For" },
    meta_0_label: { kind: "text", value: "For" },
    meta_0_value: { kind: "text", value: clientName },
    meta_1_label: { kind: "text", value: "Dates" },
    meta_1_value: { kind: "text", value: dates },
    meta_2_label: { kind: "text", value: "Duration" },
    meta_2_value: { kind: "text", value: durationLine },
    meta_3_label: { kind: "text", value: "Party" },
    meta_3_value: { kind: "text", value: partyLine },
  };

  return (
    <PdfPage label="Cover" bleed>
      <div data-section-type="cover" style={{ width: "100%", height: "100%" }}>
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

function numField(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
  return undefined;
}
