"use client";

import { ImageSlot } from "../ImageSlot";
import { PropertyTag } from "../shared/PropertyTag";
import { DayText } from "../shared/DayText";
import type { DayCardLayoutProps } from "../types";

// Hero + Inset — the Day 05 composition.
//   ┌──────────────────────────────────────┐
//   │            DESTINATION hero          │
//   ├─────────────────────┬────────────────┤
//   │  DAY 0X · TITLE     │                │
//   │  body               │   PROPERTY     │
//   │  Stay at …          │   interior     │
//   │  ✦ highlight        │   (4:5)        │
//   ├─────────────────────┴────────────────┤
//   │       PROPERTY TAG (footer)          │
//   └──────────────────────────────────────┘

export function HeroInsetCard(props: DayCardLayoutProps) {
  const { data, isEditor, tokens, theme } = props;
  const property = data.property;
  const insetImage =
    property?.leadImageUrl ?? property?.galleryUrls?.[0] ?? null;

  return (
    <div className="flex flex-col" style={{ background: tokens.cardBg }}>
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

      <div className="grid md:grid-cols-[1.5fr_1fr] gap-8 md:gap-10 px-8 md:px-12 py-8 md:py-10 items-start">
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

        <ImageSlot
          url={insetImage}
          alt={property?.name ?? ""}
          isEditor={isEditor}
          tokens={tokens}
          onUpload={props.onPropertyImageUpload}
          placeholderLabel={property ? "Add property photo" : "Pick a property"}
          className="rounded-sm"
          style={{ aspectRatio: "4 / 5" }}
          showChangePill={Boolean(insetImage)}
        />
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
