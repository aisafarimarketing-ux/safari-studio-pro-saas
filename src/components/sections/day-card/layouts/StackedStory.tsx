"use client";

import { ImageSlot } from "../ImageSlot";
import { StayCard } from "../StayCard";
import {
  DayLabel,
  DestinationTitle,
  PhaseLabel,
  Narrative,
  Highlights,
} from "../parts";
import type { DayCardLayoutProps } from "../types";

// Stacked Story — full-width 21:9 destination image on top, narrow
// editorial narrative below, stay card anchored to the right. Clean and
// readable; best for standard safari days.

export function StackedStoryCard(props: DayCardLayoutProps) {
  const { data, isEditor, tokens, theme } = props;
  return (
    <div style={{ background: tokens.sectionSurface }}>
      <ImageSlot
        url={data.destinationImageUrl}
        alt={data.destinationName}
        isEditor={isEditor}
        tokens={tokens}
        onUpload={props.onDestinationImageUpload}
        onPickFromLibrary={props.onDestinationImagePickerOpen}
        placeholderLabel="Add destination photo"
        style={{ aspectRatio: "21 / 9" }}
      />

      {/* Body — narrative left, stay right */}
      <div className="px-8 md:px-12 py-10 grid md:grid-cols-[1.5fr_1fr] gap-10">
        <div className="space-y-4 max-w-[620px]">
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
          <div className="pt-2">
            <Narrative
              value={data.narrative}
              isEditor={isEditor}
              tokens={tokens}
              theme={theme}
              onChange={props.onNarrativeChange}
            />
          </div>
          {data.highlights.length > 0 && (
            <Highlights items={data.highlights} tokens={tokens} />
          )}
        </div>

        <aside className="md:pt-12">
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
