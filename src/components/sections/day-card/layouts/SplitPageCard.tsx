"use client";

import { ImageSlot } from "../ImageSlot";
import type { DayCardLayoutProps } from "../types";
import type { OptionalActivity } from "@/lib/types";

// Split Page — the default day-card layout. Two columns that span the full
// section width, balanced so neither side feels cramped or stretched.
//
//   ┌────────────────────────────┬───────────────────────────┐
//   │  Day 03 · Serengeti        │  ACCOMMODATION · DAY 03   │
//   │  Big serif title           │  Ngorongoro Farm House    │
//   │  Teaser / hero image       │  Property description     │
//   │  Narrative paragraphs      │  Lead image               │
//   │  Meal Plan chip            │  Gallery image            │
//   │  Divider                   │  "Swap property" (editor) │
//   │  Optional · Morning        │                           │
//   │   ◇ Ngorongoro Crater Rim  │                           │
//   │     $55 · Add to itinerary │                           │
//   │   ◇ Olduvai Gorge Visit    │                           │
//   └────────────────────────────┴───────────────────────────┘
//
// The four concrete variants (50-50-left, 50-50-right, 60-40-left,
// 40-60-left) just change the proportions and which side the Activities
// column sits on. Stay goes on the opposite side.

const VARIANT_SPECS: Record<
  string,
  { cols: string; activitiesSide: "left" | "right" }
> = {
  "split-50-50-left": { cols: "1fr 1fr", activitiesSide: "left" },
  "split-50-50-right": { cols: "1fr 1fr", activitiesSide: "right" },
  "split-60-40-left": { cols: "60fr 40fr", activitiesSide: "left" },
  "split-40-60-left": { cols: "40fr 60fr", activitiesSide: "left" },
};

export function SplitPageCard(props: DayCardLayoutProps) {
  const { data, isEditor, tokens, theme } = props;
  const spec = VARIANT_SPECS[data.layoutVariant] ?? VARIANT_SPECS["split-60-40-left"];
  const activitiesFirst = spec.activitiesSide === "left";

  const activitiesColumn = (
    <ActivitiesColumn {...props} />
  );
  const stayColumn = <StayColumn {...props} />;

  return (
    <div
      className="grid min-h-[480px]"
      style={{
        gridTemplateColumns: spec.cols,
        background: tokens.cardBg,
      }}
    >
      <div
        style={{
          order: activitiesFirst ? 1 : 2,
          background: tokens.cardBg,
          borderRight: activitiesFirst ? `1px solid ${tokens.border}` : "none",
          borderLeft: activitiesFirst ? "none" : `1px solid ${tokens.border}`,
        }}
      >
        {activitiesColumn}
      </div>
      <div style={{ order: activitiesFirst ? 2 : 1, background: tokens.sectionSurface }}>
        {stayColumn}
      </div>
    </div>
  );
}

// ─── Activities column ────────────────────────────────────────────────────

function ActivitiesColumn(props: DayCardLayoutProps) {
  const {
    data,
    isEditor,
    tokens,
    theme,
    onDestinationChange,
    onNarrativeChange,
    onBoardChange,
    onDestinationImageUpload,
    onDestinationImagePickerOpen,
  } = props;

  return (
    <div className="flex flex-col h-full">
      {/* Day label + destination title */}
      <div className="px-10 md:px-14 pt-10 pb-6">
        <div
          className="text-[10.5px] uppercase tracking-[0.28em] font-semibold mb-3"
          style={{ color: tokens.accent }}
        >
          Day {String(data.dayNumber).padStart(2, "0")}
          {data.destinationCountry ? ` · ${data.destinationCountry}` : ""}
        </div>
        <h3
          className="font-bold leading-[1.05] outline-none"
          style={{
            color: tokens.headingText,
            fontFamily: `'${theme.displayFont}', serif`,
            fontSize: "clamp(1.75rem, 2.6vw, 2.25rem)",
            letterSpacing: "-0.01em",
          }}
          contentEditable={isEditor}
          suppressContentEditableWarning
          data-ai-editable="day-destination"
          onBlur={(e) => onDestinationChange(e.currentTarget.textContent?.trim() ?? data.destinationName)}
        >
          {data.destinationName}
        </h3>
      </div>

      {/* Teaser / hero image */}
      <div className="px-10 md:px-14">
        <ImageSlot
          url={data.destinationImageUrl}
          alt={data.destinationName}
          isEditor={isEditor}
          tokens={tokens}
          onUpload={onDestinationImageUpload}
          onPickFromLibrary={onDestinationImagePickerOpen}
          placeholderLabel="Add a teaser photo"
          placeholderHint="Animal, landscape, or cityscape that sets the mood."
          className="rounded-md"
          style={{ aspectRatio: "16 / 9" }}
        />
      </div>

      {/* Narrative body */}
      <div className="px-10 md:px-14 pt-8 flex-1">
        <div
          className="text-[14.5px] leading-[1.72] whitespace-pre-line outline-none"
          style={{ color: tokens.bodyText }}
          contentEditable={isEditor}
          suppressContentEditableWarning
          data-ai-editable="day-narrative"
          onBlur={(e) => onNarrativeChange(e.currentTarget.textContent ?? "")}
        >
          {data.narrative || (isEditor ? "Write the activity narrative for this day…" : "")}
        </div>

        {/* Meal plan chip */}
        <div className="mt-6 inline-flex items-center gap-2 text-[11.5px] font-semibold">
          <span
            className="uppercase tracking-[0.22em]"
            style={{ color: tokens.mutedText }}
          >
            Meal plan
          </span>
          <span
            className="px-2.5 py-1 rounded-full outline-none"
            style={{
              color: tokens.headingText,
              background: `${tokens.accent}14`,
              border: `1px solid ${tokens.accent}30`,
            }}
            contentEditable={isEditor}
            suppressContentEditableWarning
            onBlur={(e) => onBoardChange(e.currentTarget.textContent?.trim() ?? data.boardBasis)}
          >
            {data.boardBasis || "—"}
          </span>
        </div>
      </div>

      {/* Optional activities — upsell block */}
      <OptionalBlock {...props} />
    </div>
  );
}

// ─── Optional activities block ────────────────────────────────────────────

function OptionalBlock(props: DayCardLayoutProps) {
  const {
    data,
    isEditor,
    tokens,
    onAddOptionalActivity,
  } = props;

  const activities = data.optionalActivities ?? [];

  if (activities.length === 0 && !isEditor) return null;

  // Group by timeOfDay so "Morning" / "Afternoon" / "All Day" get their
  // own subhead like the reference.
  const byTime = new Map<string, OptionalActivity[]>();
  for (const a of activities) {
    const k = (a.timeOfDay?.trim() || "Anytime").trim();
    if (!byTime.has(k)) byTime.set(k, []);
    byTime.get(k)!.push(a);
  }

  return (
    <div
      className="mt-10 mx-10 md:mx-14 mb-10 pt-8"
      style={{ borderTop: `1px solid ${tokens.border}` }}
    >
      <div
        className="text-[10.5px] uppercase tracking-[0.28em] font-semibold mb-5"
        style={{ color: tokens.mutedText }}
      >
        Optional add-ons
      </div>

      {byTime.size > 0 ? (
        Array.from(byTime.entries()).map(([time, list]) => (
          <div key={time} className="mb-5 last:mb-0">
            <div
              className="text-[12px] font-semibold mb-2"
              style={{ color: tokens.headingText }}
            >
              {time}
            </div>
            <div className="space-y-2.5">
              {list.map((a) => (
                <OptionalRow key={a.id} activity={a} {...props} />
              ))}
            </div>
          </div>
        ))
      ) : isEditor ? (
        <div className="text-[12.5px] italic" style={{ color: tokens.mutedText }}>
          No optional activities yet.
        </div>
      ) : null}

      {isEditor && (
        <button
          type="button"
          onClick={onAddOptionalActivity}
          className="mt-4 text-[12px] font-semibold uppercase tracking-[0.22em] px-3 py-1.5 rounded-md transition hover:opacity-80"
          style={{
            color: tokens.accent,
            background: `${tokens.accent}12`,
            border: `1px dashed ${tokens.accent}55`,
          }}
        >
          + Add optional activity
        </button>
      )}
    </div>
  );
}

function OptionalRow({
  activity,
  isEditor,
  tokens,
  theme,
  onUpdateOptionalActivity,
  onRemoveOptionalActivity,
  onToggleAddOn,
  isAddOnSelected,
  onRequestActivityInComments,
}: { activity: OptionalActivity } & DayCardLayoutProps) {
  const selected = isAddOnSelected(activity.id);
  const priceLine =
    activity.priceAmount && activity.priceAmount.trim()
      ? `${activity.priceCurrency || "USD"} ${activity.priceAmount} per person`
      : "";

  return (
    <div className="grid grid-cols-[auto_1fr_auto] gap-3 items-start py-2.5 px-3 rounded-md group transition"
      style={{
        background: selected ? `${tokens.accent}10` : "transparent",
        border: `1px solid ${selected ? tokens.accent + "40" : "transparent"}`,
      }}
    >
      {/* Leading marker — arrow-bullet in editor, checkbox in share view */}
      <div className="pt-1">
        {isEditor ? (
          <span style={{ color: tokens.accent }}>→</span>
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

      {/* Title + location + description + price */}
      <div className="min-w-0">
        <div
          className="text-[13.5px] font-semibold leading-snug outline-none"
          style={{ color: tokens.headingText, fontFamily: `'${theme.displayFont}', serif` }}
          contentEditable={isEditor}
          suppressContentEditableWarning
          onBlur={(e) => onUpdateOptionalActivity(activity.id, { title: e.currentTarget.textContent?.trim() ?? activity.title })}
        >
          {activity.title}
        </div>
        {(activity.location || isEditor) && (
          <div
            className="text-[11.5px] italic mt-0.5 outline-none"
            style={{ color: tokens.mutedText }}
            contentEditable={isEditor}
            suppressContentEditableWarning
            onBlur={(e) => onUpdateOptionalActivity(activity.id, { location: e.currentTarget.textContent?.trim() ?? activity.location ?? "" })}
          >
            {activity.location || "Location"}
          </div>
        )}
        {(activity.description || isEditor) && (
          <div
            className="text-[12.5px] leading-[1.6] mt-1 outline-none"
            style={{ color: tokens.bodyText }}
            contentEditable={isEditor}
            suppressContentEditableWarning
            onBlur={(e) => onUpdateOptionalActivity(activity.id, { description: e.currentTarget.textContent ?? "" })}
          >
            {activity.description || (isEditor ? "Short description…" : "")}
          </div>
        )}
        {priceLine && !isEditor && (
          <div className="text-[11.5px] mt-1" style={{ color: tokens.mutedText }}>
            {priceLine}
          </div>
        )}
        {isEditor && (
          <div className="mt-1.5 flex items-center gap-2 text-[11px]" style={{ color: tokens.mutedText }}>
            <span>When:</span>
            <span
              className="outline-none px-1.5 py-0.5 rounded"
              style={{ background: `${tokens.accent}10`, color: tokens.headingText }}
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => onUpdateOptionalActivity(activity.id, { timeOfDay: e.currentTarget.textContent?.trim() ?? activity.timeOfDay ?? "" })}
            >
              {activity.timeOfDay || "Morning"}
            </span>
            <span>· Price:</span>
            <span
              className="outline-none px-1.5 py-0.5 rounded"
              style={{ background: `${tokens.accent}10`, color: tokens.headingText }}
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => onUpdateOptionalActivity(activity.id, { priceAmount: e.currentTarget.textContent?.trim() ?? "" })}
            >
              {activity.priceAmount || "—"}
            </span>
            <span
              className="outline-none px-1.5 py-0.5 rounded"
              style={{ background: `${tokens.accent}10`, color: tokens.headingText }}
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => onUpdateOptionalActivity(activity.id, { priceCurrency: e.currentTarget.textContent?.trim() ?? "USD" })}
            >
              {activity.priceCurrency || "USD"}
            </span>
          </div>
        )}
      </div>

      {/* Trailing — price (view) or remove (editor) or request (view, no add-on) */}
      <div className="shrink-0 self-start pt-1">
        {isEditor ? (
          <button
            type="button"
            onClick={() => onRemoveOptionalActivity(activity.id)}
            className="text-[11px] text-black/35 hover:text-red-500 transition"
            title="Remove"
          >
            ×
          </button>
        ) : priceLine ? (
          <div className="text-right">
            <div
              className="text-[13px] font-semibold tabular-nums"
              style={{ color: tokens.headingText }}
            >
              {activity.priceCurrency || "USD"} {activity.priceAmount}
            </div>
            <button
              type="button"
              onClick={() => onRequestActivityInComments(activity)}
              className="mt-1 text-[10.5px] uppercase tracking-[0.18em] font-semibold hover:opacity-75 transition"
              style={{ color: tokens.mutedText }}
            >
              Request in comments
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ─── Stay column ──────────────────────────────────────────────────────────

function StayColumn(props: DayCardLayoutProps) {
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
    <div className="flex flex-col h-full px-10 md:px-14 py-10">
      <div
        className="text-[10.5px] uppercase tracking-[0.28em] font-semibold mb-3"
        style={{ color: tokens.mutedText }}
      >
        Accommodation · Day {String(data.dayNumber).padStart(2, "0")}
      </div>

      {property ? (
        <>
          <h3
            className="font-bold leading-tight"
            style={{
              color: tokens.headingText,
              fontFamily: `'${theme.displayFont}', serif`,
              fontSize: "clamp(1.5rem, 2.2vw, 1.9rem)",
              letterSpacing: "-0.01em",
            }}
          >
            {property.name}
          </h3>
          {property.location && (
            <div
              className="text-[12.5px] italic mt-1"
              style={{ color: tokens.mutedText }}
            >
              {property.location}
            </div>
          )}

          {property.summary && (
            <p
              className="text-[13.5px] leading-[1.7] mt-4"
              style={{ color: tokens.bodyText }}
            >
              {property.summary}
            </p>
          )}

          {/* Lead image */}
          <div className="mt-6">
            <ImageSlot
              url={property.leadImageUrl}
              alt={property.name}
              isEditor={isEditor}
              tokens={tokens}
              onUpload={onPropertyImageUpload}
              placeholderLabel="Add a property photo"
              className="rounded-md"
              style={{ aspectRatio: "4 / 3" }}
              showChangePill={Boolean(property.leadImageUrl)}
            />
          </div>

          {/* Secondary image — gallery[0] if available */}
          {(property.galleryUrls[0] || isEditor) && (
            <div className="mt-2">
              <ImageSlot
                url={property.galleryUrls[0] ?? null}
                alt=""
                isEditor={isEditor}
                tokens={tokens}
                onUpload={onPropertyImageUpload}
                placeholderLabel="Second photo"
                className="rounded-md"
                style={{ aspectRatio: "16 / 10" }}
                showChangePill={Boolean(property.galleryUrls[0])}
              />
            </div>
          )}

          {/* Amenity chips */}
          {property.highlights.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-1.5">
              {property.highlights.map((h, i) => (
                <span
                  key={i}
                  className="text-[11px] px-2 py-0.5 rounded-full"
                  style={{
                    color: tokens.bodyText,
                    background: `${tokens.accent}10`,
                    border: `1px solid ${tokens.accent}22`,
                  }}
                >
                  {h}
                </span>
              ))}
            </div>
          )}

          {isEditor && (
            <button
              type="button"
              onClick={onOpenPropertyPicker}
              className="mt-auto pt-8 text-[11.5px] font-semibold uppercase tracking-[0.2em] text-left hover:opacity-75 transition"
              style={{ color: tokens.accent }}
            >
              Swap property from library →
            </button>
          )}
        </>
      ) : (
        <div
          className="flex-1 flex flex-col items-center justify-center text-center"
          style={{ color: tokens.mutedText }}
        >
          <div className="text-[13px] mb-3">No property selected for this day.</div>
          {isEditor ? (
            <button
              type="button"
              onClick={onOpenPropertyPicker}
              className="text-[12px] font-semibold uppercase tracking-[0.2em] px-4 py-2 rounded-md transition hover:opacity-85"
              style={{
                color: tokens.accent,
                background: `${tokens.accent}12`,
                border: `1px solid ${tokens.accent}40`,
              }}
            >
              ◇ Pick from library
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
