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

// Cinematic Hero — full-bleed 16:9 destination image. Overlay title block
// at bottom-left. Floating property card bottom-right. For arrival days
// and iconic destinations.

export function CinematicHeroCard(props: DayCardLayoutProps) {
  const { data, isEditor, tokens, theme } = props;
  return (
    <div className="relative" style={{ background: tokens.sectionSurface }}>
      <ImageSlot
        url={data.destinationImageUrl}
        alt={data.destinationName}
        isEditor={isEditor}
        tokens={tokens}
        onUpload={props.onDestinationImageUpload}
        onPickFromLibrary={props.onDestinationImagePickerOpen}
        placeholderLabel="Add destination photo"
        placeholderHint="This is the hero of the day — pick something cinematic."
        style={{ aspectRatio: "16 / 9" }}
        overlay="both"
      >
        {/* Bottom-left text block overlay */}
        <div className="absolute inset-x-0 bottom-0 z-10 p-8 md:p-12 flex items-end justify-between gap-8 pointer-events-none">
          <div className="max-w-[560px] space-y-3 pointer-events-auto">
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
              size="xl"
              overlay
              onChange={props.onDestinationChange}
            />
            <PhaseLabel
              value={data.phaseLabel}
              isEditor={isEditor}
              tokens={tokens}
              theme={theme}
              overlay
              onChange={props.onPhaseLabelChange}
            />
            <div className="hidden md:block max-w-[440px] pt-1">
              <Narrative
                value={data.narrative}
                isEditor={isEditor}
                tokens={tokens}
                theme={theme}
                overlay
                maxLines={3}
                onChange={props.onNarrativeChange}
              />
            </div>
            {data.highlights.length > 0 && (
              <div className="pt-2">
                <Highlights items={data.highlights} tokens={tokens} overlay />
              </div>
            )}
          </div>

          {/* Floating property card */}
          <div
            className="hidden md:block w-[280px] shrink-0 pointer-events-auto"
            style={{ filter: "drop-shadow(0 20px 40px rgba(0,0,0,0.4))" }}
          >
            <StayCard
              property={data.property}
              isEditor={isEditor}
              tokens={tokens}
              theme={theme}
              onChoose={props.onOpenPropertyPicker}
              variant="overlay"
            />
          </div>
        </div>
      </ImageSlot>

      {/* Mobile: narrative + stay below the image since there's no room */}
      <div className="md:hidden px-6 py-6 space-y-4" style={{ background: tokens.sectionSurface }}>
        <Narrative
          value={data.narrative}
          isEditor={isEditor}
          tokens={tokens}
          theme={theme}
          onChange={props.onNarrativeChange}
        />
        <StayCard
          property={data.property}
          isEditor={isEditor}
          tokens={tokens}
          theme={theme}
          onChoose={props.onOpenPropertyPicker}
        />
      </div>
    </div>
  );
}
