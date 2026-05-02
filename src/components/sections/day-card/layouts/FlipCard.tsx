"use client";

import { ImageSlot } from "../ImageSlot";
import { AIWriteButton } from "@/components/editor/AIWriteButton";
import { RichEditable } from "@/components/editor/RichEditable";
import { sanitizeRichText } from "@/lib/sanitizeRichText";
import type { DayCardLayoutProps } from "../types";

// FlipCard — magazine-spread day card.
//
// Two halves stacked vertically; each half is a side-by-side row of
// (image | narrative) or (narrative | image), depending on `flip`.
//
//   ┌─────────────────────────────────────────────────────────────┐
//   │  [Day badge · destination · phase]              full-width  │  top strip
//   ├─────────────────────────────────────────────────────────────┤
//   │  ┌─ moment of day (italic display serif, optional) ──────┐  │
//   │  │  "Lions hunting at dawn — reserved seats at the hide" │  │
//   │  └───────────────────────────────────────────────────────┘  │
//   ├──────────── LOCATION ACT ───────────────────────────────────┤
//   │   Narrative …………………………………… │   ┌───────────────────┐    │
//   │   Body of the day's prose …  │   │  Location image    │    │  flip=right
//   │   Bullets and highlights …   │   │  (21:9)           │    │
//   │                              │   └───────────────────┘    │
//   ├──────────── PROPERTY ACT ───────────────────────────────────┤
//   │   Where you'll stay tonight  │   ┌───────────────────┐    │
//   │   Property name + summary    │   │  Property gallery  │    │
//   │   Amenities row              │   │  (3-up grid)       │    │
//   │   [Swap property]            │   └───────────────────┘    │
//   └─────────────────────────────────────────────────────────────┘
//
// `flip="left"` mirrors the columns. The two halves of a single card
// always use the same flip direction (cleaner reading); the alternation
// across days is handled at the section level by trip-flip mode.
//
// Mobile (< sm): both halves collapse to single-column, image-above-text,
// regardless of flip direction. The flip is desktop / PDF-landscape only.

export function FlipCard(props: DayCardLayoutProps & { flip: "left" | "right" }) {
  const {
    data,
    isEditor,
    tokens,
    theme,
    flip,
    dayHeadBg,
    propertyBg,
    onDestinationChange,
    onPhaseLabelChange,
    onNarrativeChange,
    onMomentOfDayChange,
    onDestinationImageUpload,
    onDestinationImagePickerOpen,
    onDestinationImagePositionChange,
    onOpenPropertyPicker,
    onPropertyImageUpload,
  } = props;

  // Per-act column placement. Default: Act I uses `flip` directly,
  // Act II uses the opposite side so each day card reads as a proper
  // flip. Operator brief: "Location image on the right and day's
  // narration on the left, then property picture on the left and the
  // property details on the right — to produce a proper flip on the
  // day cards."
  //
  // Per-day overrides (`data.locationImageSide` / `data.propertyImageSide`)
  // win when present, so an operator can mix layouts day-by-day:
  // operator brief "allow editor to function the location layout and
  // the day's accommodation separately to give different variation".
  // The cross-card alternation (trip-flip) still kicks in at the
  // section level via DayCard.pickConcreteLayout when no override is
  // set.
  //
  // Image side is wider (1.5fr vs 1fr text = roughly 60/40). The
  // location photo IS the day's identity — it should dominate the
  // spread, not share the row 50/50 with body copy. Same ratio on
  // Act II so the property gallery scales with it.
  const flipAlt: "left" | "right" = flip === "right" ? "left" : "right";
  const actIFlip: "left" | "right" = data.locationImageSide ?? flip;
  const actIIFlip: "left" | "right" = data.propertyImageSide ?? flipAlt;
  const colsFor = (f: "left" | "right") =>
    f === "right" ? "1fr 1.5fr" : "1.5fr 1fr";
  const imageOrderFor = (f: "left" | "right") =>
    f === "right" ? "md:order-2" : "md:order-1";
  const textOrderFor = (f: "left" | "right") =>
    f === "right" ? "md:order-1" : "md:order-2";

  const actICols = colsFor(actIFlip);
  const actIImageOrder = imageOrderFor(actIFlip);
  const actITextOrder = textOrderFor(actIFlip);

  const actIICols = colsFor(actIIFlip);
  const actIIImageOrder = imageOrderFor(actIIFlip);
  const actIITextOrder = textOrderFor(actIIFlip);

  return (
    <div className="flex flex-col" style={{ background: tokens.cardBg }}>
      {/* Top strip — same as editorial-stack so trip-flip + stack
          variants on the same proposal stay visually consistent.
          Background honours the dayHeadBg override when set. */}
      <div
        className="flex items-center gap-4 px-10 md:px-14 py-5"
        style={{ background: dayHeadBg ?? tokens.sectionSurface }}
      >
        <div
          className="shrink-0 inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-[0.18em]"
          style={{
            background: tokens.accent,
            color: "white",
            fontFamily: `'${theme.bodyFont}', sans-serif`,
          }}
        >
          <span className="tabular-nums">
            Day {String(data.dayNumber).padStart(2, "0")}
          </span>
          {data.dayDate && (
            <>
              <span aria-hidden style={{ opacity: 0.55 }}>·</span>
              <span className="tabular-nums" style={{ opacity: 0.92 }}>
                {data.dayDate}
              </span>
            </>
          )}
        </div>
        <div className="flex-1 min-w-0 flex items-baseline gap-3 flex-wrap">
          <span
            className="text-[13px] uppercase tracking-[0.24em] font-bold outline-none"
            style={{ color: tokens.headingText }}
            contentEditable={isEditor}
            suppressContentEditableWarning
            data-ai-editable="day-destination"
            onBlur={(e) =>
              onDestinationChange(e.currentTarget.textContent?.trim() ?? data.destinationName)
            }
          >
            {data.destinationName || "Destination"}
          </span>
          {(data.phaseLabel || isEditor) && (
            <>
              <span
                className="text-[12px]"
                style={{ color: tokens.mutedText }}
                aria-hidden
              >
                ·
              </span>
              <span
                className="text-[12px] uppercase tracking-[0.2em] outline-none"
                style={{ color: tokens.mutedText }}
                contentEditable={isEditor}
                suppressContentEditableWarning
                onBlur={(e) =>
                  onPhaseLabelChange(e.currentTarget.textContent?.trim() ?? data.phaseLabel)
                }
              >
                {data.phaseLabel || (isEditor ? "Add a phase label" : "")}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Moment of the day — editorial pull-quote. AI button writes a
          single evocative line; operator edits inline. Hidden in
          preview when empty so the strip doesn't show a stub; visible
          in editor with a hint + AI write button so operators see the
          slot. */}
      {(data.momentOfDay || isEditor) && (
        <div
          className="relative px-10 md:px-14 pt-8 pb-2"
          style={{ background: tokens.cardBg }}
        >
          {isEditor && (
            <div className="absolute top-6 right-8 md:right-12 z-[35]">
              <AIWriteButton
                kind="day-moment"
                currentText={data.momentOfDay}
                context={{
                  dayNumber: data.dayNumber,
                  destination: data.destinationName,
                  country: data.destinationCountry,
                  phaseLabel: data.phaseLabel,
                  highlights: data.highlights,
                }}
                onResult={(text) => onMomentOfDayChange(text.trim())}
                compact
              />
            </div>
          )}
          <div
            className="outline-none italic leading-snug pr-24"
            style={{
              color: tokens.headingText,
              fontFamily: `'${theme.displayFont}', serif`,
              fontSize: "clamp(18px, 2.2vw, 24px)",
              opacity: data.momentOfDay ? 0.9 : 0.4,
            }}
            contentEditable={isEditor}
            suppressContentEditableWarning
            data-ai-editable="day-moment"
            onBlur={(e) => onMomentOfDayChange(e.currentTarget.textContent?.trim() ?? "")}
          >
            {data.momentOfDay ||
              (isEditor
                ? "The moment of the day — one signature line. Click ✨ to draft."
                : "")}
          </div>
        </div>
      )}

      {/* ── Act I: Location ─────────────────────────────────────────── */}
      <div
        className="grid grid-cols-1 md:gap-10 lg:gap-14 px-10 md:px-14 pt-6 pb-10"
        style={{ gridTemplateColumns: undefined }}
      >
        <div
          className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10 items-stretch"
          style={{ gridTemplateColumns: actICols }}
        >
          {/* Image — stretches to fill the row's height so it no longer
              floats with cream around it. Aspect ratio bumped from 4:3
              to 3:2 (wider / more cinematic landscape) to match the
              wider grid column and to make the photo dominate the
              spread visually. */}
          <div className={`min-w-0 h-full ${actIImageOrder}`}>
            <ImageSlot
              url={data.destinationImageUrl}
              alt={data.destinationName}
              isEditor={isEditor}
              tokens={tokens}
              onUpload={onDestinationImageUpload}
              onPickFromLibrary={onDestinationImagePickerOpen}
              placeholderLabel="Add a wildlife or location photo"
              placeholderHint="Pick something cinematic — the face of the day."
              style={{
                aspectRatio: "3 / 2",
                borderRadius: 8,
                minHeight: "100%",
              }}
              position={data.destinationImagePosition ?? undefined}
              onPositionChange={onDestinationImagePositionChange}
            />
          </div>

          {/* Narrative */}
          <div className={`min-w-0 relative ${actITextOrder}`}>
            {isEditor && (
              <div className="absolute -top-2 right-0 z-[35]">
                <AIWriteButton
                  kind="day-narrative"
                  currentText={data.narrative}
                  context={{
                    dayNumber: data.dayNumber,
                    destination: data.destinationName,
                    country: data.destinationCountry,
                    phaseLabel: data.phaseLabel,
                    board: data.boardBasis,
                    highlights: data.highlights,
                  }}
                  onResult={(text) => onNarrativeChange(text)}
                  compact
                />
              </div>
            )}
            <div
              className="text-[10.5px] uppercase tracking-[0.28em] font-semibold mb-3"
              style={{ color: tokens.mutedText }}
            >
              Today
            </div>
            {isEditor ? (
              <RichEditable
                isEditor
                as="div"
                value={data.narrative || ""}
                onChange={onNarrativeChange}
                className="text-[15px] leading-[1.85] whitespace-pre-line outline-none"
                style={{ color: tokens.bodyText }}
                dataAttrs={{ "data-ai-editable": "day-narrative" }}
              />
            ) : (
              <div
                className="text-[15px] leading-[1.85] whitespace-pre-line"
                style={{ color: tokens.bodyText }}
                dangerouslySetInnerHTML={{
                  __html: sanitizeRichText(data.narrative ?? ""),
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Act II: Property ────────────────────────────────────────── */}
      {(data.property || isEditor) && (
        <div
          className="px-10 md:px-14 pt-8 pb-12"
          style={{
            // propertyBg is the operator-picked colour for the
            // "where you'll stay" half of every flip card; falls
            // back to the section's own sectionSurface when unset.
            // See SectionChrome's "Property column background" pill.
            background: propertyBg ?? tokens.sectionSurface,
            borderTop: `1px solid ${tokens.border}`,
          }}
        >
          <div
            className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10 items-stretch"
            style={{ gridTemplateColumns: actIICols }}
          >
            {/* Property gallery — sits OPPOSITE to Act I's image so
                the day card reads as a flip (Act I image left ⇄
                property image right, or vice-versa). items-stretch
                lets the gallery scale to match the narrative column's
                natural height instead of floating small in the
                middle. */}
            <div className={`min-w-0 h-full ${actIIImageOrder}`}>
              <PropertyGallery
                property={data.property}
                isEditor={isEditor}
                tokens={tokens}
                onUpload={onPropertyImageUpload}
                onPickProperty={onOpenPropertyPicker}
              />
            </div>

            {/* Property narrative */}
            <div className={`min-w-0 ${actIITextOrder}`}>
              <div
                className="text-[10.5px] uppercase tracking-[0.28em] font-semibold mb-3"
                style={{ color: tokens.mutedText }}
              >
                Where you&apos;ll stay
              </div>
              <div
                className="text-[18px] md:text-[20px] font-bold leading-tight mb-2"
                style={{
                  color: tokens.headingText,
                  fontFamily: `'${theme.displayFont}', serif`,
                }}
              >
                {data.property?.name || (isEditor ? "Pick a property" : "—")}
              </div>
              {data.property?.location && (
                <div
                  className="text-[12px] uppercase tracking-[0.2em] mb-4"
                  style={{ color: tokens.mutedText }}
                >
                  {data.property.location}
                </div>
              )}
              {data.property?.summary && (
                <p
                  className="text-[14.5px] leading-[1.8] mb-4"
                  style={{ color: tokens.bodyText }}
                >
                  {data.property.summary}
                </p>
              )}
              {data.property?.highlights &&
                data.property.highlights.length > 0 && (
                  <ul
                    className="grid grid-cols-2 gap-x-4 gap-y-1.5 mb-4 list-none"
                    style={{ color: tokens.mutedText }}
                  >
                    {data.property.highlights.map((h) => (
                      <li
                        key={h}
                        className="text-[12px] uppercase tracking-[0.18em] flex items-center gap-2"
                      >
                        <span
                          aria-hidden
                          className="inline-block w-1 h-1 rounded-full"
                          style={{ background: tokens.accent }}
                        />
                        {h}
                      </li>
                    ))}
                  </ul>
                )}
              {isEditor && (
                <button
                  type="button"
                  onClick={onOpenPropertyPicker}
                  className="text-[11px] font-semibold uppercase tracking-[0.22em] transition hover:opacity-75"
                  style={{ color: tokens.accent }}
                >
                  {data.property ? "Swap property →" : "+ Pick property"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Property gallery — 1 large + small grid ─────────────────────────────

function PropertyGallery({
  property,
  isEditor,
  tokens,
  onUpload,
  onPickProperty,
}: {
  property: DayCardLayoutProps["data"]["property"];
  isEditor: boolean;
  tokens: DayCardLayoutProps["tokens"];
  onUpload: (file: File) => void;
  onPickProperty: () => void;
}) {
  const lead = property?.leadImageUrl;
  const thumbs = (property?.galleryUrls ?? []).slice(0, 2);

  if (!property) {
    return (
      <button
        type="button"
        onClick={onPickProperty}
        disabled={!isEditor}
        className="w-full h-full flex items-center justify-center text-[11.5px] uppercase tracking-[0.22em] transition disabled:opacity-50"
        style={{
          aspectRatio: "3 / 2",
          minHeight: "100%",
          background: tokens.cardBg,
          border: `1px dashed ${tokens.border}`,
          borderRadius: 8,
          color: tokens.mutedText,
        }}
      >
        {isEditor ? "+ Pick property" : "Property to be confirmed"}
      </button>
    );
  }

  return (
    <div
      className="grid gap-2 h-full"
      style={{
        gridTemplateColumns: thumbs.length > 0 ? "2fr 1fr" : "1fr",
      }}
    >
      <div
        className="relative overflow-hidden h-full"
        style={{
          // Lead photo follows Act I's 3:2 cinematic ratio when there
          // are no thumbs (single hero); when thumbs are present the
          // lead is square (1:1) and the thumbs stack to its right.
          aspectRatio: thumbs.length > 0 ? "1 / 1" : "3 / 2",
          background: tokens.cardBg,
          borderRadius: 8,
        }}
      >
        {lead ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={lead}
            alt={property.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <button
            type="button"
            onClick={onPickProperty}
            disabled={!isEditor}
            className="absolute inset-0 flex items-center justify-center text-[11px] uppercase tracking-[0.22em]"
            style={{ color: tokens.mutedText }}
          >
            {isEditor ? "+ Add lead photo" : ""}
          </button>
        )}
        {isEditor && lead && (
          <label
            className="absolute bottom-2 right-2 cursor-pointer text-[10px] uppercase tracking-[0.2em] font-semibold px-2 py-1 rounded backdrop-blur-sm"
            style={{ background: "rgba(0,0,0,0.55)", color: "white" }}
          >
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUpload(f);
              }}
            />
            Replace
          </label>
        )}
      </div>
      {thumbs.length > 0 && (
        <div className="grid grid-rows-2 gap-2">
          {thumbs.map((url, i) => (
            <div
              key={i}
              className="overflow-hidden"
              style={{
                background: tokens.cardBg,
                borderRadius: 8,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt=""
                className="w-full h-full object-cover"
                style={{ aspectRatio: "1 / 1" }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
