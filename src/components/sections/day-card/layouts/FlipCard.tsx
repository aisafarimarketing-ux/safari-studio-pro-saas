"use client";

import { useEffect, useRef, useState } from "react";
import { ImageSlot } from "../ImageSlot";
import { AIWriteButton } from "@/components/editor/AIWriteButton";
import { RichEditable } from "@/components/editor/RichEditable";
import { sanitizeRichText } from "@/lib/sanitizeRichText";
import { PropertyImageCarousel } from "../shared/PropertyImageCarousel";
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

  // Per-day overrides win over section-level pickers. Operator brief:
  // "Day card to have editor function for both location and
  // accommodation section separately to change layout, color and
  // more independently." Falls back through the layered defaults so
  // a section-level recolour still applies wherever a day hasn't
  // overridden.
  const locationBg = data.locationBg ?? tokens.cardBg;
  const propertyBgFinal =
    data.propertyBgPerDay ?? propertyBg ?? tokens.sectionSurface;

  return (
    // overflow-hidden as a structural guard so absolutely-positioned
    // chrome (AI pills, per-act editors, etc.) and any oddly-sized
    // child can never bleed across the card boundary into another
    // day. Without it, the operator's stale screenshots showed
    // narrative text bleeding INTO the destination image cell.
    <div
      className="flex flex-col relative overflow-hidden"
      style={{ background: locationBg }}
    >
      {/* Top strip — same as editorial-stack so trip-flip + stack
          variants on the same proposal stay visually consistent.
          Background honours the dayHeadBg override when set. */}
      <div
        className="flex items-center gap-4 px-5 md:px-14 py-5"
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
          className="relative px-5 md:px-14 pt-8 pb-2"
          style={{ background: locationBg }}
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
      <div className="relative group/act px-5 md:px-14 pt-6 pb-10">
        {isEditor && props.onSetLocationImageSide && props.onSetLocationBg && (
          <ActHoverEditor
            label="Location"
            imageSide={data.locationImageSide}
            onImageSideChange={props.onSetLocationImageSide}
            bg={data.locationBg}
            onBgChange={props.onSetLocationBg}
          />
        )}
        {/* `.ss-act-grid` (defined in globals.css) renders single-column
            on narrow viewports and switches to the inline-set md
            columns on md+. Drives off the --act-cols-md custom prop
            so the same class works for both flip directions and for
            both acts. */}
        <div
          className="ss-act-grid"
          style={{ "--act-cols-md": actICols } as React.CSSProperties}
        >
          {/* Image — stretches to fill the row's height so it no longer
              floats with cream around it. Aspect ratio bumped from 4:3
              to 3:2 (wider / more cinematic landscape) to match the
              wider grid column and to make the photo dominate the
              spread visually.
              overflow-hidden on the grid cell as a hard guard against
              the absolutely-positioned image inside ImageSlot bleeding
              into the adjacent narrative cell. The image was rendering
              under text on certain widths because the cell wasn't
              clipping its absolute children. */}
          <div className={`min-w-0 h-full overflow-hidden ${actIImageOrder}`}>
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
                // height:100% + an absolute floor (240px) keeps the
                // image cell from over-stretching when the narrative
                // column is unusually long. minHeight:100% (the
                // previous value) was forcing the image wrapper to
                // match a tall text cell, breaking the aspect ratio.
                height: "100%",
                minHeight: 240,
              }}
              position={data.destinationImagePosition ?? undefined}
              onPositionChange={onDestinationImagePositionChange}
            />
          </div>

          {/* Narrative — overflow-hidden keeps long unbroken words /
              edge-case URLs from bleeding into the image column;
              break-words forces wrap on anything that won't fit the
              track width. */}
          <div className={`min-w-0 relative overflow-hidden break-words ${actITextOrder}`}>
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
          className="relative group/act px-5 md:px-14 pt-8 pb-12"
          style={{
            // Per-day propertyBgPerDay wins, then section-level
            // propertyBg, then the section's own sectionSurface.
            background: propertyBgFinal,
            borderTop: `1px solid ${tokens.border}`,
          }}
        >
          {isEditor && props.onSetPropertyImageSide && props.onSetPropertyBgPerDay && (
            <ActHoverEditor
              label="Accommodation"
              imageSide={data.propertyImageSide}
              onImageSideChange={props.onSetPropertyImageSide}
              bg={data.propertyBgPerDay}
              onBgChange={props.onSetPropertyBgPerDay}
            />
          )}
          <div
            className="ss-act-grid"
            style={{ "--act-cols-md": actIICols } as React.CSSProperties}
          >
            {/* Property gallery — sits OPPOSITE to Act I's image so
                the day card reads as a flip (Act I image left ⇄
                property image right, or vice-versa). items-stretch
                lets the gallery scale to match the narrative column's
                natural height instead of floating small in the
                middle.
                overflow-hidden — same fix as Act I's image cell:
                clips the absolutely-positioned gallery image from
                bleeding into the adjacent property-details column. */}
            <div className={`min-w-0 h-full overflow-hidden ${actIIImageOrder}`}>
              <PropertyGallery
                property={data.property}
                isEditor={isEditor}
                tokens={tokens}
                onUpload={onPropertyImageUpload}
                onPickProperty={onOpenPropertyPicker}
              />
            </div>

            {/* Property narrative */}
            <div className={`min-w-0 overflow-hidden break-words ${actIITextOrder}`}>
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

// ─── Property gallery — single big lead image, click-to-next ────────────
//
// Operator brief: "in property section in the day card have one big
// lead image on all layouts with allow to click to see next." Wraps
// PropertyImageCarousel (lead + galleryUrls in order) and adds a
// "Replace" affordance for the operator on top of the lead. Onclick
// of the image cycles through the property's photos; the carousel
// component renders an index pill and indicator dots so guests
// understand the image is interactive.

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
  const urls = property
    ? [property.leadImageUrl, ...(property.galleryUrls ?? [])]
    : [];

  return (
    <div className="relative w-full h-full">
      <PropertyImageCarousel
        urls={urls}
        alt={property?.name ?? ""}
        isEditor={isEditor}
        tokens={tokens}
        onPickProperty={onPickProperty}
        aspect="3 / 2"
        radius={8}
      />
      {isEditor && property?.leadImageUrl && (
        <label
          className="absolute top-3 right-3 cursor-pointer text-[10px] uppercase tracking-[0.2em] font-semibold px-2 py-1 rounded backdrop-blur-sm z-10"
          style={{ background: "rgba(0,0,0,0.55)", color: "white" }}
          onClick={(e) => e.stopPropagation()}
          title="Replace this property's lead image"
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
  );
}

// ─── ActHoverEditor — per-act hover-revealed chrome ─────────────────────
//
// Operator brief: "we have editor for daycards there but separate so if
// you hover over the accommodation section you see the editor for that
// section, and if you hover over the destination you meet the
// destination hover."
//
// Sits at the top-right of either Act I (Location) or Act II
// (Accommodation). Only the act being hovered shows its own editor;
// the unhovered act stays clean. Each editor lets the operator:
//   • flip the image side independently for that act (Auto / Left /
//     Right) — overrides the section-level trip-flip rhythm
//   • set a per-day background for that act, with a Reset that drops
//     back to the section default
//
// `group/act` is set on the parent so we can use Tailwind's named-
// group hover (group-hover/act:opacity-100) to scope the reveal to
// THIS act only — hovering Act II doesn't show Act I's editor and
// vice versa.

function ActHoverEditor({
  label,
  imageSide,
  onImageSideChange,
  bg,
  onBgChange,
}: {
  label: string;
  imageSide: "left" | "right" | undefined;
  onImageSideChange: (next: "left" | "right" | undefined) => void;
  bg: string | undefined;
  onBgChange: (next: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const popRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div
      data-editor-chrome
      className="absolute top-3 right-3 z-30 opacity-0 group-hover/act:opacity-100 focus-within:opacity-100 transition"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="px-2.5 py-1 rounded-full text-[10.5px] uppercase tracking-[0.18em] font-semibold bg-black/55 text-white hover:bg-black/75 transition backdrop-blur-sm shadow-md flex items-center gap-1.5"
        title={`Edit ${label.toLowerCase()} layout & colour`}
      >
        <span aria-hidden>✎</span>
        <span>{label}</span>
      </button>
      {open && (
        <div
          ref={popRef}
          className="absolute right-0 mt-2 w-[240px] bg-[#0d0d0d] text-white/90 rounded-xl shadow-2xl border border-white/10 p-3"
          style={{ fontSize: 12 }}
        >
          <div className="text-[10px] uppercase tracking-[0.22em] text-[#c9a84c] mb-2 font-semibold">
            {label}
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-white/55 mb-1.5 font-semibold">
              Image side
            </div>
            <div className="flex gap-1.5">
              {(
                [
                  { target: undefined, text: "Auto" },
                  { target: "left", text: "Left" },
                  { target: "right", text: "Right" },
                ] as { target: "left" | "right" | undefined; text: string }[]
              ).map(({ target, text }) => {
                const active =
                  imageSide === target ||
                  (target === undefined && imageSide === undefined);
                return (
                  <button
                    key={text}
                    type="button"
                    onClick={() => onImageSideChange(target)}
                    className={`flex-1 px-2 py-1.5 rounded-md text-[11px] font-semibold uppercase tracking-[0.16em] transition ${
                      active
                        ? "bg-[#c9a84c] text-black"
                        : "bg-white/5 text-white/65 hover:bg-white/10"
                    }`}
                  >
                    {text}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="mt-3">
            <div className="text-[10px] uppercase tracking-[0.18em] text-white/55 mb-1.5 font-semibold">
              Background
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={hexFor(bg) || "#f8f5ef"}
                onChange={(e) => onBgChange(e.target.value)}
                className="w-7 h-7 rounded border border-white/15 cursor-pointer p-0 bg-transparent"
                title={`Custom ${label.toLowerCase()} background`}
              />
              <input
                type="text"
                value={bg ?? ""}
                onChange={(e) => onBgChange(e.target.value || undefined)}
                placeholder="theme"
                className="flex-1 bg-white/5 border border-white/10 rounded-md px-2 py-1 text-[11px] text-white/85 outline-none focus:border-white/30 transition-colors font-mono uppercase"
              />
              {bg && (
                <button
                  type="button"
                  onClick={() => onBgChange(undefined)}
                  className="text-[10px] text-white/55 hover:text-white/85 px-2 py-1 rounded hover:bg-white/5 transition"
                  title="Reset to section default"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
          <p className="mt-3 text-[10px] text-white/45 leading-snug">
            Affects this {label.toLowerCase()} only. Auto / theme = follow the
            section default.
          </p>
        </div>
      )}
    </div>
  );
}

function hexFor(v: string | undefined): string | undefined {
  if (!v) return undefined;
  const m = /^#([0-9a-f]{6})$/i.exec(v.trim());
  return m ? `#${m[1]}` : undefined;
}
