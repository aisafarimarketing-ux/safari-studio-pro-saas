"use client";

import { ImageSlot } from "../ImageSlot";
import { PropertyTag } from "../shared/PropertyTag";
import { DayText } from "../shared/DayText";
import type { DayCardLayoutProps } from "../types";

// Hero + Pair — the Day 07 composition.
//   ┌──────────────────────────────────────┐
//   │          DESTINATION hero            │
//   ├────────────────────────┬─────────────┤
//   │  DAY 0X · TITLE · body │ PROP tile 1 │
//   │  Stay at …             ├─────────────┤
//   │  ✦ highlight           │ PROP tile 2 │
//   ├────────────────────────┴─────────────┤
//   │       PROPERTY TAG (footer)          │
//   └──────────────────────────────────────┘

export function HeroPairCard(props: DayCardLayoutProps) {
  const { data, isEditor, tokens, theme } = props;
  const property = data.property;
  const gallery = property?.galleryUrls ?? [];
  const tile1 = property?.leadImageUrl ?? gallery[0] ?? null;
  const tile2 = gallery[0] && property?.leadImageUrl ? gallery[0] : gallery[1] ?? null;

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

      <div className="grid md:grid-cols-[1.7fr_auto] gap-8 md:gap-10 px-8 md:px-12 py-8 md:py-10 items-start">
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

        <div className="grid grid-cols-1 gap-2 md:w-[260px] shrink-0">
          <ImageSlot
            url={tile1}
            alt={property?.name ?? ""}
            isEditor={isEditor}
            tokens={tokens}
            onUpload={props.onPropertyImageUpload}
            placeholderLabel={property ? "Add property photo" : "—"}
            className="rounded-sm"
            style={{ aspectRatio: "4 / 3" }}
            showChangePill={Boolean(tile1)}
          />
          <ImageSlot
            url={tile2}
            alt=""
            isEditor={isEditor}
            tokens={tokens}
            onUpload={props.onPropertyImageUpload}
            placeholderLabel={property ? "Second property photo" : "—"}
            className="rounded-sm"
            style={{ aspectRatio: "4 / 3" }}
            showChangePill={Boolean(tile2)}
          />
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
