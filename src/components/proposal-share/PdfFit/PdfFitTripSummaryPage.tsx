"use client";

import { useProposalStore } from "@/store/proposalStore";
import { resolveTokens } from "@/lib/theme";
import { RouteMap, type RouteCoord } from "@/components/sections/RouteMap";
import type { Section, Day, TierKey, Property } from "@/lib/types";
import { PdfPage } from "../PdfPage";

// ─── PDF-Fit "Itinerary at a glance" — strict grid layout ────────────────
//
// CSS-grid based per the latest spec. Bypasses PdfFitLayout's absolute
// positioning so the section can use `display: grid` + `flex` for
// real vertical distribution and edge-to-edge map fill.
//
// Hierarchy:
//   .container (210×297mm, grid-template-rows: 82% 12% 6%)
//     .topBlock         (grid-template-columns: 40% 60%)
//       .leftColumn     (flex column, space-between)
//       .rightMap       (height 100%, map fills container)
//     .statsBar         (grid-template-columns: 1fr 1fr 1fr 1fr)
//     .summaryLine      (flex centered)

type Props = { section: Section };

export function PdfFitTripSummaryPage({ section }: Props) {
  const { proposal } = useProposalStore();
  const tokens = resolveTokens(proposal.theme.tokens, section.styleOverrides);
  const theme = proposal.theme;

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

  // ── Day blocks (max 6) — pick representative day per stop ──────────
  type DayBlock = {
    number: string;
    location: string;
    property: string;
    imageUrl: string | null;
  };
  const blocks: DayBlock[] = [];
  const seen = new Set<string>();
  for (const day of days) {
    const dest = day.destination?.trim();
    if (!dest || seen.has(dest)) continue;
    seen.add(dest);
    const property = lookupPropertyForDay(day, proposal.properties, activeTier);
    const propertyName =
      property?.name?.trim() || day.tiers?.[activeTier]?.camp?.trim() || "";
    blocks.push({
      number: String(day.dayNumber).padStart(2, "0"),
      location: dest,
      property: propertyName,
      imageUrl: day.heroImageUrl?.trim() || null,
    });
    if (blocks.length >= 6) break;
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

  const sectionTitle =
    (typeof section.content?.title === "string" && section.content.title.trim()) ||
    "";
  const sectionSubtitle =
    (typeof section.content?.subtitle === "string" && section.content.subtitle.trim()) ||
    "";
  const summary =
    (typeof section.content?.caption === "string" && section.content.caption.trim()) ||
    "";

  const cachedCoords = (section.content?.coords as RouteCoord[] | undefined) ?? undefined;

  // Typography helpers — pull from theme tokens.
  const displayFont = `'${theme.displayFont}', Georgia, serif`;
  const bodyFont = `'${theme.bodyFont}', system-ui, sans-serif`;

  return (
    <PdfPage label="Itinerary at a glance" bleed>
      <div
        data-section-type="tripSummary"
        style={{
          width: "210mm",
          height: "297mm",
          display: "grid",
          gridTemplateRows: "82% 12% 6%",
          background: tokens.sectionSurface,
          color: tokens.bodyText,
          fontFamily: bodyFont,
          overflow: "hidden",
        }}
      >
        {/* ─── TOP BLOCK ─────────────────────────────────────────────── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "40% 60%",
            width: "100%",
            height: "100%",
            overflow: "hidden",
          }}
        >
          {/* LEFT COLUMN — itinerary */}
          <div
            style={{
              height: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              padding: "14mm 12mm 14mm 18mm",
              overflow: "hidden",
              borderRight: `0.3mm solid ${tokens.border}`,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "9pt",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  fontWeight: 600,
                  color: tokens.mutedText,
                  marginBottom: "8mm",
                }}
              >
                Itinerary at a glance
              </div>
              {sectionTitle && (
                <div
                  style={{
                    fontFamily: displayFont,
                    fontSize: "26pt",
                    lineHeight: 1.05,
                    fontWeight: 700,
                    color: tokens.headingText,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {sectionTitle}
                </div>
              )}
              {sectionSubtitle && (
                <div
                  style={{
                    fontSize: "10pt",
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: tokens.mutedText,
                    marginTop: "6mm",
                  }}
                >
                  {sectionSubtitle}
                </div>
              )}
            </div>

            {/* Day timeline — vertical line connecting numbered stops.
                First day gets flex: 1.3 (slightly larger) for visual
                hierarchy; others share remaining space evenly. */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                marginTop: "10mm",
                overflow: "hidden",
              }}
            >
              {blocks.map((block, index) => (
                <DayBlockRow
                  key={block.number + block.location}
                  block={block}
                  isFirst={index === 0}
                  isLast={index === blocks.length - 1}
                  cardBg={tokens.cardBg}
                  surfaceBg={tokens.sectionSurface}
                  headingColor={tokens.headingText}
                  bodyColor={tokens.bodyText}
                  borderColor={tokens.border}
                  displayFont={displayFont}
                />
              ))}
            </div>
          </div>

          {/* RIGHT COLUMN — map fills 100% */}
          <div
            style={{
              height: "100%",
              width: "100%",
              overflow: "hidden",
              position: "relative",
            }}
          >
            <RouteMap
              days={days}
              cachedCoords={cachedCoords}
              tokens={tokens}
              height="100%"
              presentationMode
            />
          </div>
        </div>

        {/* ─── STATS BAR (12%) ──────────────────────────────────────── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            borderTop: `0.3mm solid ${tokens.border}`,
            borderBottom: `0.3mm solid ${tokens.border}`,
            background: tokens.sectionSurface,
          }}
        >
          <StatCell value={String(totalNights)} label="Nights" tokens={tokens} displayFont={displayFont} />
          <StatCell value={String(stopCount)} label="Stops" tokens={tokens} displayFont={displayFont} divider />
          <StatCell value={String(lodgeCount)} label="Lodges" tokens={tokens} displayFont={displayFont} divider />
          <StatCell value={String(parkCount)} label="Parks" tokens={tokens} displayFont={displayFont} divider />
        </div>

        {/* ─── SUMMARY LINE (6%) ────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 18mm",
            background: tokens.sectionSurface,
          }}
        >
          {summary && (
            <span
              style={{
                fontSize: "9pt",
                lineHeight: 1.2,
                color: tokens.mutedText,
                fontStyle: "italic",
                textAlign: "center",
              }}
            >
              {summary}
            </span>
          )}
        </div>
      </div>
    </PdfPage>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────

function DayBlockRow({
  block, isFirst, isLast, cardBg, surfaceBg, headingColor, bodyColor,
  borderColor, displayFont,
}: {
  block: { number: string; location: string; property: string; imageUrl: string | null };
  isFirst: boolean;
  isLast: boolean;
  cardBg: string;
  surfaceBg: string;
  headingColor: string;
  bodyColor: string;
  borderColor: string;
  displayFont: string;
}) {
  // Vertical timeline runs through the centre of the 20mm number
  // column. Painted via a horizontal gradient so the line sits at
  // exactly the column's centre; the number itself draws an opaque
  // chip on top to create the "station" effect.
  const linePosition = "calc(50% - 0.15mm)";
  const lineGradient = `linear-gradient(to right, transparent ${linePosition}, ${borderColor} ${linePosition}, ${borderColor} calc(50% + 0.15mm), transparent calc(50% + 0.15mm))`;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "20mm 1fr",
        gap: "3mm",
        flex: isFirst ? 1.4 : 1,
        minHeight: 0,
        alignItems: "stretch",
      }}
    >
      {/* Number column with continuous timeline line behind. The line
          is drawn for every row except the very top of the first row
          and the very bottom of the last row (handled via mask
          gradients on those edges). */}
      <div
        style={{
          background: lineGradient,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          // For the first block, mask the line above the number so
          // it doesn't bleed into the header area.
          maskImage: isFirst
            ? "linear-gradient(to bottom, transparent 0, transparent 6mm, black 6mm)"
            : isLast
              ? "linear-gradient(to bottom, black 0, black calc(100% - 6mm), transparent calc(100% - 6mm))"
              : undefined,
          WebkitMaskImage: isFirst
            ? "linear-gradient(to bottom, transparent 0, transparent 6mm, black 6mm)"
            : isLast
              ? "linear-gradient(to bottom, black 0, black calc(100% - 6mm), transparent calc(100% - 6mm))"
              : undefined,
        }}
      >
        {/* Station chip — opaque so it interrupts the line visually. */}
        <div
          style={{
            background: surfaceBg,
            padding: "1mm 0",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              fontFamily: displayFont,
              fontSize: isFirst ? "20pt" : "16pt",
              fontWeight: 700,
              lineHeight: 1.0,
              color: headingColor,
            }}
          >
            {block.number}
          </div>
        </div>
      </div>
      {/* Image + text content */}
      <div
        style={{
          display: "grid",
          gridTemplateRows: "1fr auto",
          gap: "2mm",
          minHeight: 0,
        }}
      >
        <div
          style={{
            background: block.imageUrl ? cardBg : "transparent",
            backgroundImage: block.imageUrl ? `url(${block.imageUrl})` : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
            minHeight: 0,
          }}
        />
        <div>
          <div
            style={{
              fontSize: isFirst ? "12pt" : "10.5pt",
              fontWeight: 700,
              letterSpacing: "0.02em",
              color: headingColor,
              lineHeight: 1.1,
            }}
          >
            {block.location.toUpperCase()}
          </div>
          {block.property && (
            <div
              style={{
                fontSize: "8.5pt",
                color: bodyColor,
                marginTop: "0.5mm",
                lineHeight: 1.2,
              }}
            >
              {block.property}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCell({
  value, label, tokens, displayFont, divider,
}: {
  value: string;
  label: string;
  tokens: { headingText: string; mutedText: string; border: string };
  displayFont: string;
  divider?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        borderLeft: divider ? `0.3mm solid ${tokens.border}` : undefined,
      }}
    >
      <div
        style={{
          fontFamily: displayFont,
          fontSize: "26pt",
          fontWeight: 700,
          lineHeight: 1.0,
          color: tokens.headingText,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: "9pt",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: tokens.mutedText,
          fontWeight: 600,
          marginTop: "2.5mm",
        }}
      >
        {label}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function lookupPropertyForDay(
  day: Day,
  properties: Property[] | undefined,
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
