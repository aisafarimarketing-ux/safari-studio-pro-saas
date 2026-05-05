"use client";

import { useProposalStore } from "@/store/proposalStore";
import { resolveTokens } from "@/lib/theme";
import { RouteMap, type RouteCoord } from "@/components/sections/RouteMap";
import type { Section, Day, TierKey } from "@/lib/types";
import {
  TRIP_SUMMARY_EDITORIAL,
  TRIP_SUMMARY_GEOMETRY,
} from "@/lib/pdfFit/manifests/trip_summary";
import { PdfFitLayout } from "./PdfFitLayout";
import { PdfPage } from "../PdfPage";
import type { SlotContent } from "./PdfFitSlot";

// ─── PDF-Fit "Itinerary at a glance" page ─────────────────────────────────
//
// Renders the locked editorial trip-summary layout. Day blocks (max 3)
// resolved from proposal.days; stats + summary computed from real
// backend trip data (no synthesis of narrative copy).

type Props = { section: Section };

export function PdfFitTripSummaryPage({ section }: Props) {
  const { proposal } = useProposalStore();
  const tokens = resolveTokens(proposal.theme.tokens, section.styleOverrides);

  const activeTier: TierKey =
    proposal.activeTier &&
    ["classic", "premier", "signature"].includes(proposal.activeTier)
      ? proposal.activeTier
      : "premier";

  const days = [...(proposal.days ?? [])].sort(
    (a, b) => a.dayNumber - b.dayNumber,
  );

  // ── Stop list (collapse consecutive same-destination days) ──────────
  const stops = days
    .map((d) => d.destination?.trim())
    .filter((s): s is string => Boolean(s))
    .filter((s, i, arr) => i === 0 || s !== arr[i - 1]);

  // ── Day blocks (max 3) — pick representative days for each stop ─────
  type DayBlock = {
    number: string;
    location: string;
    property: string;
    caption: string;
    imageUrl: string | null;
  };
  const blockDays: DayBlock[] = [];
  const seenStops = new Set<string>();
  for (const day of days) {
    const dest = day.destination?.trim();
    if (!dest || seenStops.has(dest)) continue;
    seenStops.add(dest);
    const property = lookupPropertyForDay(day, proposal.properties, activeTier);
    const propertyName =
      property?.name?.trim() ||
      day.tiers?.[activeTier]?.camp?.trim() ||
      "";
    const captionParts: string[] = [];
    if (day.dayNumber) captionParts.push(`Day ${day.dayNumber}`);
    if (day.subtitle?.trim()) captionParts.push(day.subtitle.trim());
    blockDays.push({
      number: String(day.dayNumber).padStart(2, "0"),
      location: dest,
      property: propertyName,
      caption: captionParts.join(" · "),
      imageUrl: day.heroImageUrl?.trim() || null,
    });
    if (blockDays.length >= TRIP_SUMMARY_GEOMETRY.DAY_BLOCKS_MAX) break;
  }

  // ── Stats — computed from real trip data ───────────────────────────
  const totalNights = days.length;
  const stopCount = stops.length;
  const lodgeCount = countUnique(
    days
      .map((d) =>
        lookupPropertyForDay(d, proposal.properties, activeTier)?.name?.trim() ||
        d.tiers?.[activeTier]?.camp?.trim() ||
        "",
      )
      .filter(Boolean),
  );
  const parkCount = countParks(stops);

  // ── Section title / subtitle from operator content ──────────────────
  const sectionTitle =
    (typeof section.content?.title === "string" && section.content.title.trim()) ||
    "";
  const sectionSubtitle =
    (typeof section.content?.subtitle === "string" && section.content.subtitle.trim()) ||
    "";

  const summary =
    (typeof section.content?.caption === "string" && section.content.caption.trim()) ||
    "";

  // ── Map vector ──────────────────────────────────────────────────────
  const cachedCoords = (section.content?.coords as RouteCoord[] | undefined) ?? undefined;
  const routeMapNode = (
    <div style={{ width: "100%", height: "100%" }}>
      <RouteMap
        days={days}
        cachedCoords={cachedCoords}
        tokens={tokens}
        height="100%"
        presentationMode
      />
    </div>
  );

  // ── Build the contents map ──────────────────────────────────────────
  const contents: Record<string, SlotContent> = {
    section_label: { kind: "text", value: "ITINERARY AT A GLANCE" },
    section_title: { kind: "text", value: sectionTitle },
    section_subtitle: { kind: "text", value: sectionSubtitle },
    map_image: { kind: "vector", node: routeMapNode },
    stats_0_value: { kind: "text", value: String(totalNights) },
    stats_0_label: { kind: "text", value: "Nights" },
    stats_1_value: { kind: "text", value: String(stopCount) },
    stats_1_label: { kind: "text", value: "Stops" },
    stats_2_value: { kind: "text", value: String(lodgeCount) },
    stats_2_label: { kind: "text", value: "Lodges" },
    stats_3_value: { kind: "text", value: String(parkCount) },
    stats_3_label: { kind: "text", value: "Parks" },
    summary_line: { kind: "text", value: summary },
  };

  // Day-block content keys.
  for (let i = 0; i < TRIP_SUMMARY_GEOMETRY.DAY_BLOCKS_MAX; i++) {
    const block = blockDays[i];
    contents[`day_${i + 1}_number`] = {
      kind: "text",
      value: block?.number ?? "",
    };
    contents[`day_${i + 1}_image`] = {
      kind: "image",
      url: block?.imageUrl ?? null,
      alt: block?.location ?? "",
    };
    contents[`day_${i + 1}_location`] = {
      kind: "text",
      value: block?.location ?? "",
    };
    contents[`day_${i + 1}_property`] = {
      kind: "text",
      value: block?.property ?? "",
    };
    contents[`day_${i + 1}_caption`] = {
      kind: "text",
      value: block?.caption ?? "",
    };
  }

  return (
    <PdfPage label="Itinerary at a glance" bleed>
      <div data-section-type="tripSummary" style={{ width: "100%", height: "100%" }}>
        <PdfFitLayout
          manifest={TRIP_SUMMARY_EDITORIAL}
          contents={contents}
          theme={proposal.theme}
          tokens={tokens}
        />
      </div>
    </PdfPage>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function lookupPropertyForDay(
  day: Day,
  properties: { id: string; name: string }[] | undefined,
  activeTier: TierKey,
) {
  const tier = day.tiers?.[activeTier];
  if (!tier?.camp || !properties) return undefined;
  const target = tier.camp.trim().toLowerCase();
  return properties.find((p) => p.name?.trim().toLowerCase() === target);
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
