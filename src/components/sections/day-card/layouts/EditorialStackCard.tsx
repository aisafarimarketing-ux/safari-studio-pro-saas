"use client";

import { ImageSlot } from "../ImageSlot";
import { AIWriteButton } from "@/components/editor/AIWriteButton";
import type { DayCardLayoutProps } from "../types";
import type { OptionalActivity } from "@/lib/types";

// Editorial Stack — a single-column, magazine-style day card.
//
//   ┌────────────────────────────────────────────────────┐
//   │  (N)   SERENGETI NATIONAL PARK  ·  SOUTH SIDE      │   top header
//   ├────────────────────────────────────────────────────┤
//   │                                                    │
//   │                HERO IMAGE (wildlife)               │
//   │                                                    │
//   ├────────────────────────────────────────────────────┤
//   │  Narrative paragraphs that take the full width and │
//   │  read like an editorial feature, not a data row.   │
//   ├────────────────────────────────────────────────────┤
//   │  OPTIONAL ADD-ONS (small, subtle, grouped)         │
//   ├────────────────────────────────────────────────────┤
//   │  ACCOMMODATION                                     │
//   │  KYSANI MARIDADI CAMP                              │
//   │  [property image]  short description · meal · wifi │
//   └────────────────────────────────────────────────────┘

export function EditorialStackCard(props: DayCardLayoutProps) {
  const {
    data,
    isEditor,
    tokens,
    theme,
    onDestinationChange,
    onPhaseLabelChange,
    onNarrativeChange,
    onDestinationImageUpload,
    onDestinationImagePickerOpen,
    onDestinationImagePositionChange,
  } = props;

  return (
    <div className="flex flex-col" style={{ background: tokens.cardBg }}>
      {/* Top strip — day badge + destination label + optional phase */}
      <div
        className="flex items-center gap-4 px-10 md:px-14 py-5"
        style={{ background: tokens.sectionSurface }}
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
            className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
            style={{ background: tokens.accent }}
            aria-hidden
          />
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
                onBlur={(e) => onPhaseLabelChange(e.currentTarget.textContent?.trim() ?? data.phaseLabel)}
              >
                {data.phaseLabel || (isEditor ? "Add a phase label" : "")}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Hero image — dominant. Operator can drag it in editor mode to
          recompose the crop. */}
      <ImageSlot
        url={data.destinationImageUrl}
        alt={data.destinationName}
        isEditor={isEditor}
        tokens={tokens}
        onUpload={onDestinationImageUpload}
        onPickFromLibrary={onDestinationImagePickerOpen}
        placeholderLabel="Add a wildlife or location photo"
        placeholderHint="Pick something cinematic — this is the face of the day."
        style={{ aspectRatio: "21 / 9" }}
        position={data.destinationImagePosition ?? undefined}
        onPositionChange={onDestinationImagePositionChange}
      />

      {/* Narrative body + AI write/rewrite */}
      <div className="relative px-10 md:px-14 py-10">
        {isEditor && (
          <div className="absolute top-14 right-8 md:right-10 z-[35]">
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

        {/* Activity / Activities Day N — pluralizes when optional add-ons exist */}
        <div className="mb-2">
          <h3
            className="text-[20px] font-bold leading-tight"
            style={{ color: tokens.headingText }}
          >
            {(data.optionalActivities?.length ?? 0) > 0 ? "Activities" : "Activity"}{" "}
            <span style={{ color: tokens.mutedText, fontWeight: 500 }}>
              Day {data.dayNumber}
            </span>
          </h3>
        </div>

        {/* Time-of-day subhead for the main activity block */}
        <div
          className="text-[11px] uppercase tracking-[0.22em] font-semibold mb-3"
          style={{ color: tokens.headingText }}
        >
          All Day
        </div>

        {isEditor ? (
          <div
            className="text-[15px] leading-[1.85] whitespace-pre-line outline-none max-w-[68ch]"
            style={{ color: tokens.bodyText }}
            contentEditable
            suppressContentEditableWarning
            data-ai-editable="day-narrative"
            onBlur={(e) => onNarrativeChange(e.currentTarget.textContent ?? "")}
          >
            {data.narrative || "Write the day's narrative… use **bold** for place names."}
          </div>
        ) : (
          <NarrativeBody narrative={data.narrative ?? ""} tokens={tokens} />
        )}
      </div>

      {/* Optional add-ons — subtle upsell block */}
      <OptionalBlock {...props} />

      {/* Accommodation */}
      <AccommodationBlock {...props} />
    </div>
  );
}

// ─── Optional add-ons block ──────────────────────────────────────────────

function OptionalBlock(props: DayCardLayoutProps) {
  const { data, isEditor, tokens, onAddOptionalActivity } = props;
  const activities = data.optionalActivities ?? [];
  if (activities.length === 0 && !isEditor) return null;

  const byTime = new Map<string, OptionalActivity[]>();
  for (const a of activities) {
    const k = (a.timeOfDay?.trim() || "Anytime").trim();
    if (!byTime.has(k)) byTime.set(k, []);
    byTime.get(k)!.push(a);
  }

  return (
    <div
      className="mx-10 md:mx-14 mb-2 pt-4 pb-6"
      style={{ borderTop: `1px solid ${tokens.border}` }}
    >
      <div className="flex items-baseline justify-between mb-3">
        <div
          className="text-[10.5px] uppercase tracking-[0.28em] font-semibold"
          style={{ color: tokens.mutedText }}
        >
          Optional
        </div>
        {isEditor && (
          <button
            type="button"
            onClick={onAddOptionalActivity}
            className="text-[10.5px] font-semibold uppercase tracking-[0.22em] transition hover:opacity-75"
            style={{ color: tokens.accent }}
          >
            + Add
          </button>
        )}
      </div>

      {byTime.size > 0 ? (
        <div className="space-y-3">
          {Array.from(byTime.entries()).map(([time, list]) => (
            <div key={time}>
              <div
                className="text-[10.5px] uppercase tracking-[0.2em] font-semibold mb-1"
                style={{ color: tokens.mutedText }}
              >
                {time}
              </div>
              <div>
                {list.map((a) => (
                  <OptionalRow key={a.id} activity={a} {...props} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : isEditor ? (
        <div className="text-[11.5px] italic" style={{ color: tokens.mutedText }}>
          No optional activities yet.
        </div>
      ) : null}
    </div>
  );
}

function OptionalRow({
  activity,
  isEditor,
  tokens,
  onUpdateOptionalActivity,
  onRemoveOptionalActivity,
  onToggleAddOn,
  isAddOnSelected,
  onRequestActivityInComments,
}: { activity: OptionalActivity } & DayCardLayoutProps) {
  const selected = isAddOnSelected(activity.id);
  const priceLine = activity.priceAmount
    ? `${activity.priceCurrency || "USD"} ${activity.priceAmount}`
    : "";

  // Single-line row: leading marker + inline-editable title + (location)
  // muted suffix + trailing price / remove. Description shows only when
  // set (or editor); kept to one line to avoid the "chunky" past version.
  return (
    <div
      className="group grid grid-cols-[auto_1fr_auto] gap-3 items-center py-1.5 px-2 rounded-sm transition"
      style={{
        background: selected ? `${tokens.accent}0c` : "transparent",
        borderBottom: `1px solid ${tokens.border}`,
      }}
    >
      {/* Marker — arrow (editor) or checkbox (share view) */}
      <div>
        {isEditor ? (
          <span className="text-[13px]" style={{ color: tokens.accent }}>→</span>
        ) : (
          <button
            type="button"
            onClick={() => onToggleAddOn(activity.id)}
            aria-label={selected ? "Remove from itinerary" : "Add to itinerary"}
            className="w-4 h-4 rounded border transition flex items-center justify-center"
            style={{
              borderColor: selected ? tokens.accent : tokens.border,
              background: selected ? tokens.accent : "transparent",
            }}
          >
            {selected && (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 5.5 L4 7.5 L8 3" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        )}
      </div>

      <div className="min-w-0 flex items-baseline gap-2 flex-wrap">
        <span
          className="text-[13px] font-medium leading-snug outline-none truncate"
          style={{ color: tokens.headingText }}
          contentEditable={isEditor}
          suppressContentEditableWarning
          onBlur={(e) =>
            onUpdateOptionalActivity(activity.id, {
              title: e.currentTarget.textContent?.trim() ?? activity.title,
            })
          }
        >
          {activity.title}
        </span>
        {(activity.location || isEditor) && (
          <span
            className="text-[11.5px] italic outline-none truncate"
            style={{ color: tokens.mutedText }}
            contentEditable={isEditor}
            suppressContentEditableWarning
            onBlur={(e) =>
              onUpdateOptionalActivity(activity.id, {
                location: e.currentTarget.textContent?.trim() ?? activity.location ?? "",
              })
            }
          >
            {activity.location || (isEditor ? "location" : "")}
          </span>
        )}
      </div>

      <div className="shrink-0 flex items-center gap-2 text-right text-[12px]">
        {isEditor ? (
          <>
            <span
              className="outline-none px-1.5 py-0.5 rounded"
              style={{ background: `${tokens.accent}0e`, color: tokens.bodyText, minWidth: 68, display: "inline-block" }}
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) =>
                onUpdateOptionalActivity(activity.id, {
                  timeOfDay: e.currentTarget.textContent?.trim() ?? activity.timeOfDay ?? "",
                })
              }
            >
              {activity.timeOfDay || "Morning"}
            </span>
            <span
              className="outline-none px-1.5 py-0.5 rounded tabular-nums"
              style={{ background: `${tokens.accent}0e`, color: tokens.bodyText, minWidth: 56, display: "inline-block" }}
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) =>
                onUpdateOptionalActivity(activity.id, {
                  priceAmount: e.currentTarget.textContent?.trim() ?? "",
                })
              }
            >
              {activity.priceAmount ? `${activity.priceCurrency || "USD"} ${activity.priceAmount}` : "Price"}
            </span>
            <button
              type="button"
              onClick={() => onRemoveOptionalActivity(activity.id)}
              className="text-[13px] text-black/30 hover:text-red-500 transition opacity-0 group-hover:opacity-100"
              title="Remove"
            >
              ×
            </button>
          </>
        ) : priceLine ? (
          <>
            <span
              className="font-semibold tabular-nums"
              style={{ color: tokens.headingText }}
            >
              {priceLine}
            </span>
            <button
              type="button"
              onClick={() => onRequestActivityInComments(activity)}
              className="text-[10.5px] uppercase tracking-[0.18em] hover:opacity-75 transition"
              style={{ color: tokens.mutedText }}
              title="Request in comments"
            >
              Request
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}

// ─── Accommodation block ─────────────────────────────────────────────────

function AccommodationBlock(props: DayCardLayoutProps) {
  const {
    data,
    isEditor,
    tokens,
    theme,
    onOpenPropertyPicker,
    onPropertyImageUpload,
  } = props;
  const property = data.property;

  return (
    <div
      className="mx-10 md:mx-14 mt-0 mb-10 pt-8"
      style={{ borderTop: `1px solid ${tokens.border}` }}
    >
      <div className="flex items-baseline gap-3 mb-4">
        <span
          className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
          style={{ background: tokens.accent }}
          aria-hidden
        />
        <span
          className="text-[11.5px] uppercase tracking-[0.28em] font-bold"
          style={{ color: tokens.mutedText }}
        >
          Accommodation
        </span>
      </div>

      {property ? (
        <>
          {/* Name + location — concise, not chatty. Full description lives
              in the Property Showcase section; day card stays visual. */}
          <div className="mb-5 flex items-baseline justify-between flex-wrap gap-3">
            <div className="min-w-0">
              <h4
                className="text-[17px] uppercase tracking-[0.08em] font-bold"
                style={{
                  color: tokens.headingText,
                  fontFamily: `'${theme.displayFont}', serif`,
                }}
              >
                {property.name}
              </h4>
              {property.location && (
                <div
                  className="text-[11.5px] italic mt-0.5"
                  style={{ color: tokens.mutedText }}
                >
                  {property.location}
                </div>
              )}
            </div>

            {/* Slim chip row — meal plan + up to 2 amenities, nothing more. */}
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {data.boardBasis && (
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium"
                  style={{
                    color: tokens.bodyText,
                    background: `${tokens.accent}12`,
                    border: `1px solid ${tokens.accent}26`,
                  }}
                >
                  <span style={{ color: tokens.accent }}>●</span>
                  {data.boardBasis}
                </span>
              )}
              {property.highlights.slice(0, 2).map((h, i) => (
                <span
                  key={i}
                  className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px]"
                  style={{
                    color: tokens.bodyText,
                    background: `${tokens.cardBg}`,
                    border: `1px solid ${tokens.border}`,
                  }}
                >
                  {h}
                </span>
              ))}
            </div>
          </div>

          {/* Image strip — three equal tiles spanning the full card width.
              Negative horizontal margin breaks out of the AccommodationBlock's
              mx-10/14 container so each tile gains the full card width
              (~25% more pixels per image). The day card's overflow-hidden
              outer wrapper clips cleanly. */}
          <div
            className="-mx-10 md:-mx-14 grid grid-cols-3 gap-1.5"
            style={{ background: tokens.cardBg }}
          >
            {[
              property.leadImageUrl ?? null,
              property.galleryUrls?.[0] ?? null,
              property.galleryUrls?.[1] ?? null,
            ].map((url, i) => (
              <ImageSlot
                key={i}
                url={url}
                alt={i === 0 ? property.name : ""}
                isEditor={isEditor}
                tokens={tokens}
                onUpload={onPropertyImageUpload}
                placeholderLabel={i === 0 ? "Add property photo" : "Gallery photo"}
                style={{ aspectRatio: "1 / 1" }}
                showChangePill={Boolean(url)}
              />
            ))}
          </div>

          {isEditor && (
            <button
              type="button"
              onClick={onOpenPropertyPicker}
              className="mt-4 text-[11.5px] font-semibold uppercase tracking-[0.2em] hover:opacity-75 transition"
              style={{ color: tokens.accent }}
            >
              Swap property →
            </button>
          )}
        </>
      ) : (
        <div className="flex items-center justify-between gap-4">
          <div className="text-[13px]" style={{ color: tokens.mutedText }}>
            No property selected for this day.
          </div>
          {isEditor && (
            <button
              type="button"
              onClick={onOpenPropertyPicker}
              className="text-[11.5px] font-semibold uppercase tracking-[0.2em] px-3 py-1.5 rounded-md transition hover:opacity-85"
              style={{
                color: tokens.accent,
                background: `${tokens.accent}12`,
                border: `1px solid ${tokens.accent}40`,
              }}
            >
              ◇ Pick from library
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Narrative body (read-mode renderer) ──────────────────────────────────
// Splits the day's prose into a lead arrow line + supporting paragraphs.
// Recognizes **bold** for inline place-name emphasis. Editor mode keeps the
// raw markdown so contentEditable doesn't strip our formatting on save.

function NarrativeBody({
  narrative,
  tokens,
}: {
  narrative: string;
  tokens: DayCardLayoutProps["tokens"];
}) {
  const paragraphs = narrative
    .split(/\n{2,}|\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (paragraphs.length === 0) return null;
  const [lead, ...rest] = paragraphs;
  return (
    <div className="max-w-[68ch] space-y-4">
      <div
        className="flex gap-3 text-[15px] leading-[1.85]"
        style={{ color: tokens.bodyText }}
      >
        <span
          className="shrink-0 select-none"
          style={{ color: tokens.accent }}
          aria-hidden
        >
          →
        </span>
        <span>{renderInlineBold(lead)}</span>
      </div>
      {rest.map((p, i) => (
        <p
          key={i}
          className="text-[15px] leading-[1.85]"
          style={{ color: tokens.bodyText }}
        >
          {renderInlineBold(p)}
        </p>
      ))}
    </div>
  );
}

function renderInlineBold(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} style={{ fontWeight: 700 }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}
