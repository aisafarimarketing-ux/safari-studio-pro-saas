"use client";

import { ImageSlot } from "../ImageSlot";
import { PropertyTag } from "../shared/PropertyTag";
import { DayText } from "../shared/DayText";
import type { DayCardLayoutProps } from "../types";

// Twin Frame — the "arrival" composition (Day 01 in tmp/reflayout/full.png).
//
//   ┌──────────────┬──────────────┐
//   │ DESTINATION  │  PROPERTY    │   1) twin top — two images side-by-side
//   │   image      │  lead image  │
//   ├──────────────┴──────┬───────┤
//   │  DAY 0X · TITLE     │ inset │
//   │  body               │ tile  │   2) text left, two stacked portrait
//   │  Stay at …          │ pair  │      property images right
//   │  ✦ chip   ✦ chip    │       │
//   ├─────────────────────┴───────┤
//   │  WIDE LANDSCAPE A   │   B   │   3) twin bottom — two landscape tiles
//   ├─────────────────────┴───────┤
//   │     PROPERTY TAG (footer)   │
//   └─────────────────────────────┘
//
// Image slots are filled in this order, with graceful fallback to fewer
// rows when the property doesn't have enough imagery yet:
//   top-left   = destination hero
//   top-right  = property lead image
//   inset 1+2  = property gallery [0] and [1]
//   bottom 1+2 = property gallery [2] and [3]

export function TwinFrameCard(props: DayCardLayoutProps) {
  const { data, isEditor, tokens, theme } = props;
  const property = data.property;
  const gallery = property?.galleryUrls ?? [];

  const destinationImage = data.destinationImageUrl;
  const propertyImage = property?.leadImageUrl ?? gallery[0] ?? null;
  const insetA = gallery[0] ?? null;
  const insetB = gallery[1] ?? null;
  const bottomA = gallery[2] ?? null;
  const bottomB = gallery[3] ?? null;

  // Only render the optional rows when there's at least one image to fill
  // them — empty placeholders look like broken UI, not editorial restraint.
  const showInsetColumn = isEditor || Boolean(insetA || insetB);
  const showBottomRow = isEditor || Boolean(bottomA || bottomB);

  return (
    <div className="flex flex-col" style={{ background: tokens.cardBg }}>
      {/* Row 1 — twin top */}
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

      {/* Row 2 — body text, optional portrait inset pair on the right */}
      <div
        className={
          showInsetColumn
            ? "grid md:grid-cols-[1.6fr_auto] gap-8 md:gap-10 px-8 md:px-12 py-8 md:py-10 items-start"
            : "px-8 md:px-12 py-8 md:py-10 max-w-[720px]"
        }
      >
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

        {showInsetColumn && (
          <div className="grid grid-cols-1 gap-2 md:w-[220px] shrink-0">
            <ImageSlot
              url={insetA}
              alt={property?.name ?? ""}
              isEditor={isEditor}
              tokens={tokens}
              onUpload={props.onPropertyImageUpload}
              placeholderLabel={property ? "Property interior" : "—"}
              className="rounded-sm"
              style={{ aspectRatio: "4 / 5" }}
              showChangePill={Boolean(insetA)}
            />
            <ImageSlot
              url={insetB}
              alt=""
              isEditor={isEditor}
              tokens={tokens}
              onUpload={props.onPropertyImageUpload}
              placeholderLabel={property ? "Property detail" : "—"}
              className="rounded-sm"
              style={{ aspectRatio: "4 / 5" }}
              showChangePill={Boolean(insetB)}
            />
          </div>
        )}
      </div>

      {/* Row 3 — twin bottom landscape pair (architecture + sunset feel) */}
      {showBottomRow && (
        <div className="grid grid-cols-2 gap-0.5" style={{ background: tokens.cardBg }}>
          <ImageSlot
            url={bottomA}
            alt=""
            isEditor={isEditor}
            tokens={tokens}
            onUpload={props.onPropertyImageUpload}
            placeholderLabel={property ? "Property landscape" : "—"}
            style={{ aspectRatio: "4 / 3" }}
            showChangePill={Boolean(bottomA)}
          />
          <ImageSlot
            url={bottomB}
            alt=""
            isEditor={isEditor}
            tokens={tokens}
            onUpload={props.onPropertyImageUpload}
            placeholderLabel={property ? "Property atmosphere" : "—"}
            style={{ aspectRatio: "4 / 3" }}
            showChangePill={Boolean(bottomB)}
          />
        </div>
      )}

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
