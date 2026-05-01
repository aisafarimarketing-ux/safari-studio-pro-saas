"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import { resolveTokens } from "@/lib/theme";
import { uploadImage } from "@/lib/uploadImage";
import { DestinationImagePicker } from "@/components/editor/DestinationImagePicker";
import { DayPropertyPicker } from "@/components/editor/DayPropertyPicker";
import type { Day, Property as ProposalProperty, TierKey, Section, Proposal } from "@/lib/types";
import { DayCardChrome } from "./DayCardChrome";
import { resolveDayCard } from "./resolve";
import { pickAutoLayoutForDay } from "./rotation";
import { EditorialStackCard } from "./layouts/EditorialStackCard";
import { FlipCard } from "./layouts/FlipCard";
import type { DayCardLayoutProps, DayCardLayoutVariant } from "./types";
import type { OptionalActivity } from "@/lib/types";

// The single entry point for a day card. Handles:
//   - drag + drop (dnd-kit)
//   - editor chrome (add / duplicate / delete / find-image)
//   - destination image picker + property picker state
//   - resolving data and dispatching to the right layout

export function DayCard({
  day,
  index,
  totalDays,
  section,
  onRequestAddAfter,
  onRequestDuplicate,
}: {
  day: Day;
  index: number;
  totalDays: number;
  section: Section;
  /** Open the AddDayDialog in "after" mode anchored to this day. The
   *  parent (DayJourneySection) owns the dialog state so + Add day
   *  and the per-card menu share one source of truth. */
  onRequestAddAfter?: () => void;
  /** Open the AddDayDialog in "duplicate" mode pre-filled from this
   *  day's destination. */
  onRequestDuplicate?: () => void;
}) {
  const {
    proposal,
    updateDay,
    removeDay,
    addPropertyFromLibrary,
    addOptionalActivity,
    updateOptionalActivity,
    removeOptionalActivity,
    toggleAddOnSelection,
  } = useProposalStore();
  const { mode, selectDay, selectedDayId } = useEditorStore();
  const isEditor = mode === "editor";
  const { activeTier, theme } = proposal;
  const tokens = resolveTokens(theme.tokens, section.styleOverrides);
  const isSelected = selectedDayId === day.id;

  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [propPickerOpen, setPropPickerOpen] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: day.id });
  const sortableStyle = {
    transform: CSS.Transform.toString(transform),
    transition: [transition, "box-shadow 200ms ease"].filter(Boolean).join(", "),
    opacity: isDragging ? 0.4 : 1,
    boxShadow: isSelected
      ? "0 0 0 2px rgba(27,58,45,0.25), 0 8px 32px rgba(27,58,45,0.08)"
      : "0 1px 3px rgba(0,0,0,0.04)",
  };

  const resolvedLayout = pickConcreteLayout(
    day,
    index,
    totalDays,
    proposal,
    activeTier as TierKey,
    section.layoutVariant,
  );
  const data = resolveDayCard(
    day,
    proposal,
    activeTier as TierKey,
    resolvedLayout,
  );

  // ── Text edits ────────────────────────────────────────────────────────
  const onDestinationChange = (next: string) =>
    updateDay(day.id, { destination: next || day.destination });
  const onPhaseLabelChange = (next: string) =>
    updateDay(day.id, { subtitle: next });
  const onNarrativeChange = (next: string) =>
    updateDay(day.id, { description: next });
  const onBoardChange = (next: string) =>
    updateDay(day.id, { board: next || day.board });
  const onMomentOfDayChange = (next: string) =>
    updateDay(day.id, { momentOfDay: next });

  // ── Destination image upload ──────────────────────────────────────────
  const onDestinationImageUpload = async (file: File) => {
    try {
      const dataUrl = await uploadImage(file);
      updateDay(day.id, { heroImageUrl: dataUrl });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Image upload failed");
    }
  };

  // ── Property image upload ─────────────────────────────────────────────
  //
  // Uploading a property image from inside a day card updates the shared
  // library entry (so every day that uses this property gets the new
  // photo). If the camp is a free-text stay (no library entry) we fall
  // back to writing the image onto the day's heroImageUrl.
  const onPropertyImageUpload = async (file: File) => {
    try {
      const dataUrl = await uploadImage(file);
      const campName = day.tiers?.[activeTier as TierKey]?.camp?.trim();
      const match = campName
        ? proposal.properties.find(
            (p) => p.name.trim().toLowerCase() === campName.toLowerCase(),
          )
        : null;
      if (match) {
        // mutate proposal-local property
        useProposalStore.getState().updateProperty(match.id, { leadImageUrl: dataUrl });
      } else {
        updateDay(day.id, { heroImageUrl: dataUrl });
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Image upload failed");
    }
  };

  // ── Property picker ───────────────────────────────────────────────────
  //
  // When the operator re-picks a property that's already in the proposal
  // (e.g. she edited the library after autopilot drafted, deleted some
  // images, and is re-assigning to refresh), we MUST replace the
  // existing snapshot with the freshly-fetched one — otherwise the day
  // card keeps showing the stale autopilot-time copy of the property
  // (including images she's since deleted from the library).
  //
  // Earlier behaviour: if the property name was already in
  // proposal.properties[], we skipped addPropertyFromLibrary() and kept
  // the old snapshot. That was the root cause of "I deleted these
  // images but they keep coming back when I re-pick the property."
  const onAssignProperty = (snapshot: Partial<ProposalProperty>) => {
    if (!snapshot.name) return;
    const nameLc = snapshot.name.trim().toLowerCase();
    const existing = proposal.properties.find(
      (p) => p.name.trim().toLowerCase() === nameLc,
    );
    if (existing) {
      // Replace the stored snapshot — overwrite leadImageUrl, gallery,
      // amenities, summary, all of it. We keep the existing id so any
      // day already pointing at this property's id stays linked.
      useProposalStore.getState().updateProperty(existing.id, {
        ...snapshot,
        id: existing.id,
      });
    } else {
      addPropertyFromLibrary(snapshot);
    }
    const tier = activeTier as TierKey;
    updateDay(day.id, {
      tiers: {
        ...day.tiers,
        [tier]: {
          ...day.tiers[tier],
          camp: snapshot.name,
          location: snapshot.location || day.tiers[tier].location,
          note: "",
        },
      },
    });
    setPropPickerOpen(false);
  };

  const selectedAddOns = proposal.selectedAddOns ?? [];
  const isAddOnSelected = (activityId: string) =>
    selectedAddOns.some((s) => s.dayId === day.id && s.activityId === activityId);

  // "Request in comments" — emit a window event the share view's comment
  // panel listens for. If nothing listens (editor mode, or no panel
  // mounted), the click is a no-op. Keeps coupling loose.
  const onRequestActivityInComments = (activity: OptionalActivity) => {
    const pricePart = activity.priceAmount
      ? ` (${activity.priceCurrency || "USD"} ${activity.priceAmount})`
      : "";
    const message = `Hi — I'd like to add "${activity.title}"${pricePart} on Day ${day.dayNumber}. Could you add it to my itinerary?`;
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("ss:prefillComment", { detail: { message } }));
    }
  };

  const layoutProps: DayCardLayoutProps = {
    data,
    isEditor,
    tokens,
    theme,
    activeTier: activeTier as TierKey,
    dayHeadBg: section.styleOverrides?.dayHeadBg,
    onDestinationChange,
    onPhaseLabelChange,
    onNarrativeChange,
    onBoardChange,
    onMomentOfDayChange,
    onDestinationImageUpload,
    onDestinationImagePickerOpen: () => setImagePickerOpen(true),
    onDestinationImagePositionChange: (next: string) =>
      updateDay(day.id, { heroImagePosition: next }),
    onOpenPropertyPicker: () => setPropPickerOpen(true),
    onPropertyImageUpload,
    onAddOptionalActivity: () => addOptionalActivity(day.id),
    onUpdateOptionalActivity: (activityId, patch) =>
      updateOptionalActivity(day.id, activityId, patch),
    onRemoveOptionalActivity: (activityId) => removeOptionalActivity(day.id, activityId),
    onToggleAddOn: (activityId) => toggleAddOnSelection(day.id, activityId),
    isAddOnSelected,
    onRequestActivityInComments,
  };

  return (
    <div
      ref={setNodeRef}
      id={`day-${day.id}`}
      data-nav-anchor="day"
      data-nav-day-id={day.id}
      data-section-type="dayJourney"
      style={{
        ...sortableStyle,
        background: tokens.sectionSurface,
      }}
      onClick={() => isEditor && selectDay(day.id)}
      // No rounded corners + no inset margin — DayCard now sits
      // edge-to-edge inside the proposal's 900px canvas, magazine-style.
      // overflow-hidden stays so hero images crop cleanly.
      className="dm-card relative overflow-hidden transition-colors duration-150 scroll-mt-32"
    >
      {isEditor && (
        <DayCardChrome
          attributes={attributes}
          listeners={listeners}
          onFindImage={() => setImagePickerOpen(true)}
          // Add-after and Duplicate now go through the parent's
          // AddDayDialog so operators must pick a real destination
          // and nights count — no more silent "New Destination"
          // placeholders polluting the cover route and the map.
          onAddAfter={() => onRequestAddAfter?.()}
          onDuplicate={() => onRequestDuplicate?.()}
          onDelete={() => removeDay(day.id)}
        />
      )}
      {/* Section colour editor moved to SectionChrome (top-right of
          the section as a whole) so editors don't stack inside each
          day card. The hover-pills on SectionChrome already cover
          section bg / day-head / card / accent for the dayJourney
          section type. */}

      <DestinationImagePicker
        open={imagePickerOpen}
        onClose={() => setImagePickerOpen(false)}
        defaultLocation={day.destination}
        onSelect={(c) => updateDay(day.id, { heroImageUrl: c.url })}
      />

      {propPickerOpen && (
        <DayPropertyPicker
          dayDestination={day.destination}
          onClose={() => setPropPickerOpen(false)}
          onSelect={onAssignProperty}
        />
      )}

      {renderLayout(resolvedLayout, layoutProps)}
    </div>
  );
}

type ConcreteLayoutVariant = Exclude<DayCardLayoutVariant, "auto" | "trip-flip">;

function renderLayout(variant: ConcreteLayoutVariant, props: DayCardLayoutProps) {
  switch (variant) {
    case "right-flip":
      return <FlipCard {...props} flip="right" />;
    case "left-flip":
      return <FlipCard {...props} flip="left" />;
    case "editorial-stack":
    default:
      return <EditorialStackCard {...props} />;
  }
}

// Resolve the section-level variant into a concrete per-card variant.
// trip-flip alternates by day index — odd days (1, 3, 5) render as
// right-flip, even days (2, 4, 6) as left-flip. Each day card itself
// always uses ONE consistent flip direction; the alternation lives at
// the day-to-day rhythm level so a 7-day proposal reads like a real
// magazine spread.
function pickConcreteLayout(
  day: Day,
  index: number,
  totalDays: number,
  proposal: Proposal,
  activeTier: TierKey,
  sectionVariant: string,
): ConcreteLayoutVariant {
  if (sectionVariant === "auto" || !sectionVariant) {
    return pickAutoLayoutForDay(day, index, totalDays, proposal, activeTier);
  }
  if (sectionVariant === "trip-flip") {
    // dayNumber is 1-indexed in the data; index is 0-indexed array
    // position. Use index for stable alternation regardless of any
    // dayNumber gaps.
    return index % 2 === 0 ? "right-flip" : "left-flip";
  }
  if (sectionVariant === "right-flip" || sectionVariant === "left-flip") {
    return sectionVariant;
  }
  if (sectionVariant === "editorial-stack") {
    return "editorial-stack";
  }
  // Legacy variant names from prior generations quietly map through.
  return "editorial-stack";
}
