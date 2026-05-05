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
  const dayLayoutVariantRaw = day.layoutVariant ?? section.layoutVariant;
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

  // Accommodation block — image + text resolved from the active tier.
  const tier = day.tiers?.[activeTier];
  const property = proposal.properties?.find(
    (p) => p.name?.trim().toLowerCase() === tier?.camp?.trim().toLowerCase(),
  );
  const lodgeImageUrl =
    property?.leadImageUrl?.trim() ||
    property?.galleryUrls?.[0]?.trim() ||
    null;

  const lodgeEyebrow = "WHERE YOU'LL STAY";
  const lodgePropertyName = tier?.camp?.trim() || property?.name?.trim() || "";
  const lodgeLocation = [
    tier?.location?.trim() || property?.location?.trim() || "",
    property?.mealPlan?.trim() || day.board?.trim() || "",
  ].filter(Boolean).join("  ·  ");
  const lodgeDescription =
    property?.shortDesc?.trim() ||
    stripHtml(property?.description ?? "").trim() ||
    tier?.note?.trim() ||
    "";
  const lodgeFeatures = (property?.amenities ?? [])
    .filter(Boolean)
    .slice(0, 5)
    .join("  ·  ");

  // Trip-wide stats — same as the trip summary section. Each day
  // card carries the strip as a bottom anchor so the document feels
  // unified.
  const allDays = [...(proposal.days ?? [])].sort(
    (a, b) => a.dayNumber - b.dayNumber,
  );
  const stops = allDays
    .map((d) => d.destination?.trim())
    .filter((s): s is string => Boolean(s))
    .filter((s, i, arr) => i === 0 || s !== arr[i - 1]);
  const totalNights = allDays.length;
  const stopCount = stops.length;
  const lodgeCount = countUnique(
    allDays
      .map(
        (d) =>
          proposal.properties?.find(
            (p) =>
              p.name?.trim().toLowerCase() ===
              d.tiers?.[activeTier]?.camp?.trim().toLowerCase(),
          )?.name?.trim() ||
          d.tiers?.[activeTier]?.camp?.trim() ||
          "",
      )
      .filter(Boolean),
  );
  const parkCount = countParks(stops);

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
    stats_nights_value: { kind: "text", value: String(totalNights) },
    stats_nights_label: { kind: "text", value: "Nights" },
    stats_stops_value: { kind: "text", value: String(stopCount) },
    stats_stops_label: { kind: "text", value: "Stops" },
    stats_lodges_value: { kind: "text", value: String(lodgeCount) },
    stats_lodges_label: { kind: "text", value: "Lodges" },
    stats_parks_value: { kind: "text", value: String(parkCount) },
    stats_parks_label: { kind: "text", value: "Parks" },
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

function countUnique(arr: string[]): number {
  return new Set(arr.map((s) => s.trim().toLowerCase())).size;
}

function countParks(stops: string[]): number {
  const parkKeywords = [
    "serengeti", "ngorongoro", "tarangire", "lake manyara", "ruaha",
    "selous", "nyerere", "mikumi", "katavi", "saadani", "arusha np",
    "masai mara", "amboseli", "tsavo", "samburu", "lake nakuru",
    "aberdare", "meru", "lake naivasha",
  ];
  return stops.filter((s) =>
    parkKeywords.some((p) => s.toLowerCase().includes(p)),
  ).length;
}
