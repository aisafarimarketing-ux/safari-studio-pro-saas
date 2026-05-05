"use client";

import { useProposalStore } from "@/store/proposalStore";
import { resolveTokens } from "@/lib/theme";
import type { Day, Section, TierKey } from "@/lib/types";
import { DAY_CARD_LAYOUTS, DAY_CARD_STANDARD } from "@/lib/pdfFit/manifests/day_card";
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

  // Per-day layout pick — operator may store layoutVariant on the
  // day record (day.layoutVariant = "day-card-narrative") to mix
  // variants across the deck; the rhythm engine also synthesises
  // one when none is set. Falls back to the section-level
  // layoutVariant, then to the standard balanced layout.
  let dayLayoutVariantRaw = day.layoutVariant ?? section.layoutVariant;
  // Magazine convention — "trip-flip" alternates per day index so
  // even days render as left-flip and odd days as right-flip. We
  // resolve here so each day picks the appropriate manifest.
  if (dayLayoutVariantRaw === "trip-flip") {
    dayLayoutVariantRaw = day.dayNumber % 2 === 0 ? "left-flip" : "right-flip";
  }
  const manifest =
    DAY_CARD_LAYOUTS.find((l) => l.id === dayLayoutVariantRaw) ?? DAY_CARD_STANDARD;

  // ─── Content resolution ──────────────────────────────────────────────
  // Header row: DAY · DATE · LOCATION
  const dayLabel = `Day ${String(day.dayNumber).padStart(2, "0")} of ${totalDays}`;
  const dayDate = day.date?.trim() || "";
  const destination = day.destination?.trim() || "";
  const headerMeta = [dayLabel, dayDate, destination]
    .filter(Boolean)
    .join("  ·  ");

  // Title — destination + subtitle pair when both exist; subtitle
  // alone if no destination.
  const titleParts = [destination, day.subtitle?.trim()].filter(Boolean);
  const title = titleParts.join(" — ");

  // Intro line — momentOfDay (the operator-curated one-liner hook)
  // when present, else fall back to subtitle.
  const introText =
    day.momentOfDay?.trim() ||
    day.subtitle?.trim() ||
    "";

  // Strip HTML for narrative — PDF text slots render plain text only.
  const narrative = stripHtml(day.description ?? "").trim();

  // ─── Accommodation block — strict backend binding ───────────────
  // All property data comes from the proposal's properties library
  // resolved against the day's active-tier camp name. AI may rewrite
  // descriptions but never invent property facts; missing fields
  // render empty (operator sees the gap and adds / swaps a property
  // via the editor chrome).
  const tier = day.tiers?.[activeTier];
  const property = proposal.properties?.find(
    (p) => p.name?.trim().toLowerCase() === tier?.camp?.trim().toLowerCase(),
  );
  const hasProperty = Boolean(property || tier?.camp?.trim());

  const lodgeImageUrl =
    property?.leadImageUrl?.trim() ||
    property?.galleryUrls?.[0]?.trim() ||
    null;

  // When NO property has been linked to this day, the eyebrow flips
  // to a CTA so the operator (and the print itself) makes the gap
  // obvious. The text-only "+ ADD PROPERTY" reads as a structural
  // empty state, not a button — interactive add/swap controls live
  // in the editor chrome.
  const lodgeEyebrow = hasProperty ? "WHERE YOU'LL STAY" : "+ ADD PROPERTY";

  const lodgePropertyName = property?.name?.trim() || tier?.camp?.trim() || "";
  const lodgeLocation = hasProperty
    ? [
        property?.location?.trim() || tier?.location?.trim() || "",
        property?.mealPlan?.trim() || day.board?.trim() || "",
      ].filter(Boolean).join("  ·  ")
    : "";
  const lodgeDescription = hasProperty
    ? property?.shortDesc?.trim() ||
      stripHtml(property?.description ?? "").trim() ||
      tier?.note?.trim() ||
      ""
    : "";
  const lodgeFeatures = hasProperty
    ? (property?.amenities ?? [])
        .filter(Boolean)
        .slice(0, 5)
        .join("  ·  ")
    : "";

  const contents: Record<string, SlotContent> = {
    header_meta: { kind: "text", value: headerMeta },
    title: { kind: "text", value: title },
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
    lodge_eyebrow: { kind: "text", value: lodgeEyebrow },
    lodge_property_name: { kind: "text", value: lodgePropertyName },
    lodge_location: { kind: "text", value: lodgeLocation },
    lodge_description: { kind: "text", value: lodgeDescription },
    lodge_features: { kind: "text", value: lodgeFeatures },
  };

  return (
    <PdfPage label={`Day ${day.dayNumber}${destination ? ` · ${destination}` : ""}`} bleed>
      <div data-section-type="dayJourney" style={{ width: "100%", height: "100%" }}>
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

