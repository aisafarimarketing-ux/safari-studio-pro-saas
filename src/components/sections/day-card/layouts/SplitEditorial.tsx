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

// Split Editorial — 55% text panel left, 45% dominant image right.
// Balanced default. Stay card inset beneath the narrative.

export function SplitEditorialCard(props: DayCardLayoutProps) {
  const { data, isEditor, tokens, theme } = props;
  const primaryImage = data.destinationImageUrl || data.property?.leadImageUrl || null;
  return (
    <div
      className="relative grid md:grid-cols-[1.25fr_1fr] min-h-[520px]"
      style={{ background: tokens.sectionSurface }}
    >
      {/* Text column */}
      <div className="relative flex flex-col justify-between p-8 md:p-12 overflow-hidden">
        <div className="absolute -top-2 -left-4 pointer-events-none">
          <DayNumeral n={data.dayNumber} tokens={tokens} theme={theme} size="large" />
        </div>

        <div className="relative space-y-3 pt-6">
          <DayLabel
            dayNumber={data.dayNumber}
            country={data.destinationCountry}
            board={data.boardBasis}
            tokens={tokens}
          />
          <DestinationTitle
            value={data.destinationName}
            isEditor={isEditor}
            tokens={tokens}
            theme={theme}
            size="lg"
            onChange={props.onDestinationChange}
          />
          <PhaseLabel
            value={data.phaseLabel}
            isEditor={isEditor}
            tokens={tokens}
            theme={theme}
            onChange={props.onPhaseLabelChange}
          />
        </div>

        <div className="relative mt-6 mb-6 max-w-[540px]">
          <Narrative
            value={data.narrative}
            isEditor={isEditor}
            tokens={tokens}
            theme={theme}
            onChange={props.onNarrativeChange}
            maxLines={6}
          />
          {data.highlights.length > 0 && (
            <div className="mt-4">
              <Highlights items={data.highlights} tokens={tokens} />
            </div>
          )}
        </div>

        <div className="relative">
          <StayCard
            property={data.property}
            isEditor={isEditor}
            tokens={tokens}
            theme={theme}
            onChoose={props.onOpenPropertyPicker}
          />
        </div>
      </div>

      {/* Image column */}
      <ImageSlot
        url={primaryImage}
        alt={data.destinationName}
        isEditor={isEditor}
        tokens={tokens}
        onUpload={(f) =>
          data.property?.leadImageUrl && !data.destinationImageUrl
            ? props.onPropertyImageUpload(f)
            : props.onDestinationImageUpload(f)
        }
        onPickFromLibrary={props.onDestinationImagePickerOpen}
        placeholderLabel={data.property ? "Add destination or property photo" : "Add destination photo"}
        className="min-h-[320px] md:min-h-full"
        style={{ aspectRatio: undefined }}
      />
    </div>
  );
}
