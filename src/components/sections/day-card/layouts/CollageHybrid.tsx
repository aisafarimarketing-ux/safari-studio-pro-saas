"use client";

import { ImageSlot } from "../ImageSlot";
import { StayCard } from "../StayCard";
import {
  DayLabel,
  DestinationTitle,
  PhaseLabel,
  Narrative,
  Highlights,
  DayNumeral,
} from "../parts";
import type { DayCardLayoutProps } from "../types";

// Collage Hybrid — magazine-spread. Asymmetric 6-column grid on desktop:
//   ┌─────────────────┬──────────────┐
//   │                 │              │
//   │  Destination    │  Property    │
//   │  hero (4×2)     │  lead (2×1)  │
//   │                 ├──────────────┤
//   │                 │  Property    │
//   │                 │  gallery[0]  │
//   │                 │  (2×1)       │
//   ├─────────────────┴──────────────┤
//   │   Text panel (narrative + stay)│
//   └────────────────────────────────┘

export function CollageHybridCard(props: DayCardLayoutProps) {
  const { data, isEditor, tokens, theme } = props;
  const dest = data.destinationImageUrl;
  const pLead = data.property?.leadImageUrl ?? null;
  const pGal0 = data.property?.galleryUrls?.[0] ?? null;

  return (
    <div style={{ background: tokens.sectionSurface }}>
      {/* Collage grid */}
      <div
        className="grid gap-1 md:gap-1.5"
        style={{
          gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
          gridAutoRows: "160px",
        }}
      >
        {/* Destination hero — spans 4 cols, 2 rows */}
        <div style={{ gridColumn: "span 4 / span 4", gridRow: "span 2 / span 2" }}>
          <ImageSlot
            url={dest}
            alt={data.destinationName}
            isEditor={isEditor}
            tokens={tokens}
            onUpload={props.onDestinationImageUpload}
            onPickFromLibrary={props.onDestinationImagePickerOpen}
            placeholderLabel="Add destination photo"
            className="w-full h-full"
            overlay="bottom"
          >
            {/* Corner numeral + label */}
            <div className="absolute inset-x-0 bottom-0 z-10 p-6 md:p-8 flex items-end justify-between gap-4 pointer-events-none">
              <div className="space-y-1.5">
                <DayLabel
                  dayNumber={data.dayNumber}
                  country={data.destinationCountry}
                  board={data.boardBasis}
                  tokens={tokens}
                  overlay
                />
                <DestinationTitle
                  value={data.destinationName}
                  isEditor={isEditor}
                  tokens={tokens}
                  theme={theme}
                  size="lg"
                  overlay
                  onChange={props.onDestinationChange}
                />
              </div>
              <div className="hidden md:block -mb-2 opacity-70">
                <DayNumeral n={data.dayNumber} tokens={tokens} theme={theme} overlay size="large" />
              </div>
            </div>
          </ImageSlot>
        </div>

        {/* Property lead — 2 cols × 1 row */}
        <div style={{ gridColumn: "span 2 / span 2", gridRow: "span 1 / span 1" }}>
          <ImageSlot
            url={pLead}
            alt={data.property?.name ?? "Property"}
            isEditor={isEditor}
            tokens={tokens}
            onUpload={props.onPropertyImageUpload}
            placeholderLabel={data.property ? "Add property photo" : "—"}
            className="w-full h-full"
            showChangePill={Boolean(data.property)}
          />
        </div>

        {/* Property gallery[0] — 2 cols × 1 row */}
        <div style={{ gridColumn: "span 2 / span 2", gridRow: "span 1 / span 1" }}>
          <ImageSlot
            url={pGal0}
            alt=""
            isEditor={isEditor}
            tokens={tokens}
            onUpload={props.onPropertyImageUpload}
            placeholderLabel={data.property ? "Property gallery" : "—"}
            className="w-full h-full"
            showChangePill={false}
          />
        </div>
      </div>

      {/* Text panel */}
      <div className="grid md:grid-cols-[1.4fr_1fr] gap-10 px-8 md:px-12 py-10">
        <div className="space-y-4 max-w-[580px]">
          <PhaseLabel
            value={data.phaseLabel}
            isEditor={isEditor}
            tokens={tokens}
            theme={theme}
            onChange={props.onPhaseLabelChange}
          />
          <Narrative
            value={data.narrative}
            isEditor={isEditor}
            tokens={tokens}
            theme={theme}
            onChange={props.onNarrativeChange}
          />
          {data.highlights.length > 0 && (
            <div className="pt-2">
              <Highlights items={data.highlights} tokens={tokens} />
            </div>
          )}
        </div>

        <aside className="md:pt-1">
          <StayCard
            property={data.property}
            isEditor={isEditor}
            tokens={tokens}
            theme={theme}
            onChoose={props.onOpenPropertyPicker}
          />
        </aside>
      </div>
    </div>
  );
}
