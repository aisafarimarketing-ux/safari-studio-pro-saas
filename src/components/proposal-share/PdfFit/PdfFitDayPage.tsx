"use client";

import { useProposalStore } from "@/store/proposalStore";
import { resolveTokens } from "@/lib/theme";
import type { Day, Section, TierKey } from "@/lib/types";
import { DAY_CARD_STANDARD } from "@/lib/pdfFit/manifests/day_card";
import { PdfFitLayout } from "./PdfFitLayout";
import { PdfPage } from "../PdfPage";
import type { SlotContent } from "./PdfFitSlot";

// ─── PDF-Fit day page renderer ─────────────────────────────────────────────
//
// One PdfPage per Day. Resolves content for the day_card_standard
// manifest:
//
//   day_label           ← "Day 03 · Mon 1 Jun"
//   destination         ← day.destination
//   intro_text          ← day.subtitle (the moment-of-day pull-quote)
//   narrative           ← day.description (HTML stripped to plain text)
//   destinationImageUrl ← day.heroImageUrl
//   lodge_image         ← active-tier accommodation's first image
//   lodge_text          ← "Stay: {camp}" + meal plan + a one-line note
//
// Variants come from the section's content.variantId (image_lead /
// narrative / balanced); fallback is "balanced" — neutral emphasis.

type Props = {
  section: Section;
  day: Day;
  totalDays: number;
};

export function PdfFitDayPage({ section, day, totalDays }: Props) {
  const { proposal } = useProposalStore();
  const tokens = resolveTokens(proposal.theme.tokens, section.styleOverrides);
  const activeTier: TierKey =
    proposal.activeTier && ["classic", "premier", "signature"].includes(proposal.activeTier)
      ? proposal.activeTier
      : "premier";

  const variantId =
    typeof section.content?.variantId === "string"
      ? section.content.variantId
      : "balanced";

  // ─── Content resolution ──────────────────────────────────────────────
  const dayDate = day.date?.trim() || null;
  const dayLabel =
    `Day ${String(day.dayNumber).padStart(2, "0")} of ${totalDays}` +
    (dayDate ? ` · ${dayDate}` : "");

  const destination = day.destination?.trim() || "Destination";
  const introText = day.subtitle?.trim() || day.momentOfDay?.trim() || "";

  // Strip HTML for narrative — PDF text slots render plain text only.
  const narrative = stripHtml(day.description ?? "").trim();

  const tier = day.tiers?.[activeTier];
  const property = proposal.properties?.find(
    (p) => p.name?.trim().toLowerCase() === tier?.camp?.trim().toLowerCase(),
  );
  const lodgeImageUrl =
    property?.leadImageUrl?.trim() ||
    property?.galleryUrls?.[0]?.trim() ||
    null;

  const lodgeText = formatLodgeText({
    campName: tier?.camp ?? property?.name ?? "",
    location: tier?.location ?? property?.location ?? "",
    mealPlan: property?.mealPlan ?? day.board ?? "",
    shortDesc: property?.shortDesc ?? "",
  });

  const contents: Record<string, SlotContent> = {
    day_label: { kind: "text", value: dayLabel },
    location_title: { kind: "text", value: destination },
    intro_text: { kind: "text", value: introText },
    body_text: { kind: "text", value: narrative },
    main_image: {
      kind: "image",
      url: day.heroImageUrl?.trim() || null,
      alt: destination,
    },
    lodge_image: {
      kind: "image",
      url: lodgeImageUrl,
      alt: tier?.camp ?? "",
    },
    lodge_text_block: { kind: "text", value: lodgeText },
  };

  return (
    <PdfPage label={`Day ${day.dayNumber}${destination ? ` · ${destination}` : ""}`} bleed>
      <div data-section-type="dayJourney" style={{ width: "100%", height: "100%" }}>
        <PdfFitLayout
          manifest={DAY_CARD_STANDARD}
          contents={contents}
          theme={proposal.theme}
          tokens={tokens}
          variantId={variantId}
        />
      </div>
    </PdfPage>
  );
}

function formatLodgeText({
  campName, location, mealPlan, shortDesc,
}: {
  campName: string;
  location: string;
  mealPlan: string;
  shortDesc: string;
}): string {
  const lines: string[] = [];
  if (campName) lines.push(`Stay: ${campName}${location ? ` (${location})` : ""}`);
  if (mealPlan) lines.push(`Board: ${mealPlan}`);
  if (shortDesc) lines.push("");
  if (shortDesc) lines.push(shortDesc);
  return lines.join("\n");
}

function stripHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div)>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
