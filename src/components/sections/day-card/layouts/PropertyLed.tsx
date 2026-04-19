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

// Property-Led — the camp is the hero. Large 4:5 property image on the
// left, destination details + narrative on the right, a tight row of two
// property gallery tiles + a small destination accent image below. Best
// for premium stays and multi-night anchors.

export function PropertyLedCard(props: DayCardLayoutProps) {
  const { data, isEditor, tokens, theme } = props;
  const property = data.property;

  const leadImage = property?.leadImageUrl ?? null;
  const gallery = property?.galleryUrls ?? [];
  return (
    <div style={{ background: tokens.sectionSurface }}>
      <div className="grid md:grid-cols-[1fr_1fr] min-h-[560px]">
        {/* Property image — dominant */}
        <ImageSlot
          url={leadImage}
          alt={property?.name ?? data.destinationName}
          isEditor={isEditor}
          tokens={tokens}
          onUpload={props.onPropertyImageUpload}
          placeholderLabel={property ? "Add the property's lead image" : "No property selected"}
          placeholderHint={property ? undefined : "Choose one and its images appear here."}
          className="min-h-[320px] md:min-h-full"
          style={{ aspectRatio: undefined }}
        >
          {!property && isEditor && (
            <div className="absolute inset-0 flex items-end justify-center p-8 pointer-events-none">
              <button
                type="button"
                onClick={props.onOpenPropertyPicker}
                className="pointer-events-auto px-4 py-2 rounded-lg text-[12px] font-semibold text-white transition hover:brightness-110"
                style={{ background: tokens.accent }}
              >
                ◇ Choose property
              </button>
            </div>
          )}
        </ImageSlot>

        {/* Right column — label / title / narrative / stay */}
        <div className="flex flex-col p-8 md:p-12 gap-6">
          <div className="space-y-3">
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
              size="md"
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

          <div className="max-w-[520px]">
            <Narrative
              value={data.narrative}
              isEditor={isEditor}
              tokens={tokens}
              theme={theme}
              onChange={props.onNarrativeChange}
              maxLines={5}
            />
          </div>

          {data.highlights.length > 0 && (
            <Highlights items={data.highlights} tokens={tokens} />
          )}

          <div className="mt-auto">
            <StayCard
              property={property}
              isEditor={isEditor}
              tokens={tokens}
              theme={theme}
              onChoose={props.onOpenPropertyPicker}
              withThumbnail={false}
            />
          </div>
        </div>
      </div>

      {/* Gallery strip — only when we have property images to show */}
      {(gallery.length > 0 || data.destinationImageUrl) && (
        <div
          className="grid grid-cols-3 gap-0.5"
          style={{ borderTop: `1px solid ${tokens.border}` }}
        >
          {[gallery[0], gallery[1], data.destinationImageUrl].map((url, i) => (
            <div
              key={i}
              className="relative"
              style={{ aspectRatio: "4 / 3", background: tokens.cardBg }}
            >
              {url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt="" className="absolute inset-0 w-full h-full object-cover" />
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
