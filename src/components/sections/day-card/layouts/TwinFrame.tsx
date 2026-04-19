"use client";

import { ImageSlot } from "../ImageSlot";
import { PropertyTag } from "../shared/PropertyTag";
import { DayText } from "../shared/DayText";
import type { DayCardLayoutProps } from "../types";

// Twin Frame — the "arrival" composition from the reference.
//   ┌─────────────┬─────────────┐
//   │ DESTINATION │   PROPERTY  │   two images, 50/50
//   │   image     │   image     │
//   ├─────────────┴─────────────┤
//   │  DAY 0X · TITLE · body    │
//   │  Stay at …                │
//   │  ✦ highlight              │
//   ├───────────────────────────┤
//   │  PROPERTY TAG (footer)    │
//   └───────────────────────────┘

export function TwinFrameCard(props: DayCardLayoutProps) {
  const { data, isEditor, tokens, theme } = props;
  const property = data.property;
  const destinationImage = data.destinationImageUrl;
  const propertyImage = property?.leadImageUrl ?? property?.galleryUrls?.[0] ?? null;

  return (
    <div className="flex flex-col" style={{ background: tokens.cardBg }}>
      {/* Top — twin images */}
      <div className="grid grid-cols-2 gap-0.5" style={{ background: tokens.cardBg }}>
        <ImageSlot
          url={destinationImage}
          alt={data.destinationName}
          isEditor={isEditor}
          tokens={tokens}
          onUpload={props.onDestinationImageUpload}
          onPickFromLibrary={props.onDestinationImagePickerOpen}
          placeholderLabel="Add destination photo"
          style={{ aspectRatio: "4 / 3" }}
        />
        <ImageSlot
          url={propertyImage}
          alt={property?.name ?? "Property"}
          isEditor={isEditor}
          tokens={tokens}
          onUpload={props.onPropertyImageUpload}
          placeholderLabel={property ? "Add property photo" : "Pick a property"}
          style={{ aspectRatio: "4 / 3" }}
        />
      </div>

      {/* Body */}
      <div className="px-8 md:px-12 py-8 md:py-10 max-w-[720px]">
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
      </div>

      {/* Footer property tag */}
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
