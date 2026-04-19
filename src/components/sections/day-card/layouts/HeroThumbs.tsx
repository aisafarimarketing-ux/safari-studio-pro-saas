"use client";

import { ImageSlot } from "../ImageSlot";
import { PropertyTag } from "../shared/PropertyTag";
import { DayText } from "../shared/DayText";
import type { DayCardLayoutProps } from "../types";

// Hero + Thumbs — the Day 03 composition.
//   ┌────────────────────────────────────────────┐
//   │                 DESTINATION                │
//   │                     hero                   │
//   ├────────────────────────────┬───────────────┤
//   │  DAY 0X · TITLE · body     │ prop thumb 1  │
//   │  Stay at …                 │ prop thumb 2  │
//   │  ✦ highlight               │ prop thumb 3  │
//   ├────────────────────────────┴───────────────┤
//   │         PROPERTY TAG (footer)              │
//   └────────────────────────────────────────────┘

export function HeroThumbsCard(props: DayCardLayoutProps) {
  const { data, isEditor, tokens, theme } = props;
  const property = data.property;
  const gallery = property?.galleryUrls ?? [];

  // Three stacked property thumbs. Fill with leadImage + first two gallery
  // images; fall back to repeats rather than empty boxes.
  const thumbs: (string | null)[] = [
    property?.leadImageUrl ?? null,
    gallery[0] ?? null,
    gallery[1] ?? null,
  ];

  return (
    <div className="flex flex-col" style={{ background: tokens.cardBg }}>
      {/* Top — destination hero */}
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

      {/* Middle — text left, thumbs right */}
      <div className="grid md:grid-cols-[1.8fr_auto] gap-8 md:gap-10 px-8 md:px-12 py-8 md:py-10 items-start">
        <DayText
          dayNumber={data.dayNumber}
          destination={data.destinationName}
          narrative={data.narrative}
          stayAt={property?.name ?? null}
          highlights={data.highlights}
          isEditor={isEditor}
          tokens={tokens}
          theme={theme}
          onDestinationChange={props.onDestinationChange}
          onNarrativeChange={props.onNarrativeChange}
        />

        <div className="grid grid-cols-1 gap-2 md:w-[220px] shrink-0">
          {thumbs.map((url, i) => (
            <div key={i} style={{ aspectRatio: "4 / 3" }}>
              <ImageSlot
                url={url}
                alt={property?.name ?? ""}
                isEditor={isEditor}
                tokens={tokens}
                onUpload={props.onPropertyImageUpload}
                placeholderLabel={property ? "Add property photo" : "—"}
                className="rounded-sm"
                style={{ aspectRatio: "4 / 3" }}
                showChangePill={Boolean(url)}
              />
            </div>
          ))}
        </div>
      </div>

      <PropertyTag
        property={property}
        isEditor={isEditor}
        tokens={tokens}
        theme={theme}
        onChoose={props.onOpenPropertyPicker}
        highlights={data.highlights}
      />
    </div>
  );
}
