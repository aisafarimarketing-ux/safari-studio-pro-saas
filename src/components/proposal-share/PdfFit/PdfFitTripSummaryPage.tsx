"use client";

import { useProposalStore } from "@/store/proposalStore";
import { resolveTokens } from "@/lib/theme";
import { RouteMap, type RouteCoord } from "@/components/sections/RouteMap";
import { resolveSafariEndpoints } from "@/lib/safariRoutingRules";
import type { Section } from "@/lib/types";
import { TRIP_SUMMARY_EDITORIAL } from "@/lib/pdfFit/manifests/trip_summary";
import { PdfFitLayout } from "./PdfFitLayout";
import { PdfPage } from "../PdfPage";
import type { SlotContent } from "./PdfFitSlot";

// ─── PDF-Fit trip summary page ─────────────────────────────────────────────
//
// Resolves the proposal's days into:
//   - left_itinerary_panel: numbered stop list with destination + nights
//   - map_image: RouteMap vector (uses the section's cached coords if
//     present, otherwise falls back to the schematic route diagram
//     baked into RouteMap)
//   - stats: days, stops, lodges, parks counters
//   - eyebrow / title / caption resolved from section.content with
//     sensible defaults

type Props = { section: Section };

export function PdfFitTripSummaryPage({ section }: Props) {
  const { proposal } = useProposalStore();
  const tokens = resolveTokens(proposal.theme.tokens, section.styleOverrides);

  const variantId =
    typeof section.content?.variantId === "string"
      ? section.content.variantId
      : "balanced";

  const days = proposal.days ?? [];
  const sortedDays = [...days].sort((a, b) => a.dayNumber - b.dayNumber);

  // Stops — collapse runs of the same destination so a 3-night stay
  // shows as one stop, not three.
  const stops = sortedDays
    .map((d) => d.destination?.trim())
    .filter((s): s is string => Boolean(s))
    .filter((s, i, arr) => i === 0 || s !== arr[i - 1]);

  const safari = resolveSafariEndpoints(stops);
  const titleFromContent =
    (typeof section.content?.title === "string" && section.content.title.trim()) || "";
  const sectionTitle =
    titleFromContent ||
    (stops.length <= 1
      ? safari.start || "At a glance"
      : safari.endsInPark
        ? `${safari.start} → ${safari.lastSafariStop}`
        : `${safari.start} to ${safari.lastSafariStop}`);

  const eyebrow =
    (typeof section.content?.eyebrow === "string" && section.content.eyebrow.trim()) ||
    "Trip summary";

  // Itinerary block — magazine-style numbered list. Each stop gets
  // two lines: "NN  Destination" then a muted "Days X–Y · N nights",
  // separated by a blank line so the eye finds each entry quickly.
  const stopLines: string[] = [];
  let cursor = 0;
  for (const stop of stops) {
    cursor += 1;
    const stopDays = sortedDays.filter((d) => d.destination === stop);
    const nights = stopDays.length;
    const dayNumbers = stopDays.map((d) => d.dayNumber);
    const dayRange =
      dayNumbers.length > 1
        ? `Days ${dayNumbers[0]}–${dayNumbers[dayNumbers.length - 1]}`
        : `Day ${dayNumbers[0] ?? cursor}`;
    const nightsLabel = nights === 1 ? "1 night" : `${nights} nights`;
    if (cursor > 1) stopLines.push("");
    stopLines.push(`${pad2(cursor)}    ${stop}`);
    stopLines.push(`        ${dayRange}  ·  ${nightsLabel}`);
  }
  const itineraryText = stopLines.join("\n");

  // Stats
  const lodgeCount = countUnique(
    sortedDays.map((d) => d.board).filter((s) => Boolean(s?.trim())),
  );
  const parkCount = countParks(stops);
  const totalNights = sortedDays.length;

  const statsDays = `${totalNights}\nNights`;
  const statsStops = `${stops.length}\nStops`;
  const statsLodges = `${lodgeCount}\n${lodgeCount === 1 ? "Lodge" : "Lodges"}`;
  const statsParks = `${parkCount}\n${parkCount === 1 ? "Park" : "Parks"}`;

  const caption =
    (typeof section.content?.caption === "string" && section.content.caption.trim()) ||
    `${proposal.trip?.dates ?? ""}`.trim();

  // Route map — render the live RouteMap component into a vector slot.
  const cachedCoords = (section.content?.coords as RouteCoord[] | undefined) ?? undefined;
  const routeMapNode = (
    <div style={{ width: "100%", height: "100%" }}>
      <RouteMap
        days={sortedDays}
        cachedCoords={cachedCoords}
        tokens={tokens}
        height="100%"
        presentationMode
      />
    </div>
  );

  const contents: Record<string, SlotContent> = {
    eyebrow: { kind: "text", value: eyebrow },
    section_title: { kind: "text", value: sectionTitle },
    left_itinerary_panel: { kind: "text", value: itineraryText },
    map_image: { kind: "vector", node: routeMapNode },
    stats_days: { kind: "text", value: statsDays },
    stats_stops: { kind: "text", value: statsStops },
    stats_lodges: { kind: "text", value: statsLodges },
    stats_parks: { kind: "text", value: statsParks },
    caption: { kind: "text", value: caption },
  };

  return (
    <PdfPage label="At a glance" bleed>
      <div data-section-type="tripSummary" style={{ width: "100%", height: "100%" }}>
        <PdfFitLayout
          manifest={TRIP_SUMMARY_EDITORIAL}
          contents={contents}
          theme={proposal.theme}
          tokens={tokens}
          variantId={variantId}
        />
      </div>
    </PdfPage>
  );
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
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
