"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import { resolveTokens } from "@/lib/theme";
import { fileToOptimizedDataUrl } from "@/lib/fileToDataUrl";
import { DestinationImagePicker } from "@/components/editor/DestinationImagePicker";
import { DayPropertyPicker } from "@/components/editor/DayPropertyPicker";
import type { Day, Property as ProposalProperty, TierKey, Section, Proposal } from "@/lib/types";
import { DayCardChrome } from "./DayCardChrome";
import { resolveDayCard } from "./resolve";
import { pickAutoLayoutForDay } from "./rotation";
import { SplitPageCard } from "./layouts/SplitPageCard";
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
}: {
  day: Day;
  index: number;
  totalDays: number;
  section: Section;
}) {
  const {
    proposal,
    updateDay,
    addDayAfter,
    duplicateDay,
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

  // ── Destination image upload ──────────────────────────────────────────
  const onDestinationImageUpload = async (file: File) => {
    try {
      const dataUrl = await fileToOptimizedDataUrl(file);
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
      const dataUrl = await fileToOptimizedDataUrl(file);
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
  const onAssignProperty = (snapshot: Partial<ProposalProperty>) => {
    if (!snapshot.name) return;
    const nameLc = snapshot.name.trim().toLowerCase();
    const already = proposal.properties.some((p) => p.name.trim().toLowerCase() === nameLc);
    if (!already) addPropertyFromLibrary(snapshot);
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
    onDestinationChange,
    onPhaseLabelChange,
    onNarrativeChange,
    onBoardChange,
    onDestinationImageUpload,
    onDestinationImagePickerOpen: () => setImagePickerOpen(true),
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
      className="dm-card relative rounded-3xl overflow-hidden transition-colors duration-150 scroll-mt-32"
    >
      {isEditor && (
        <DayCardChrome
          attributes={attributes}
          listeners={listeners}
          onFindImage={() => setImagePickerOpen(true)}
          onAddAfter={() => addDayAfter(day.id)}
          onDuplicate={() => duplicateDay(day.id)}
          onDelete={() => removeDay(day.id)}
        />
      )}

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

type ConcreteLayoutVariant = Exclude<DayCardLayoutVariant, "auto">;

function renderLayout(variant: ConcreteLayoutVariant, props: DayCardLayoutProps) {
  // All four variants share the same component — proportions + side are
  // driven by props.data.layoutVariant inside SplitPageCard.
  return <SplitPageCard {...props} />;
}

// Map the section-level variant (which can be "auto" or one of the four)
// to the concrete layout used for this specific day. Called at render
// time so rotation is always in sync with the current proposal state.
//
// Legacy aliases: old proposals stored variant names from previous layout
// generations ("twin-frame", "split-editorial", etc.). Map them onto the
// closest new split-page variant so existing work doesn't fall back to
// the same default for every day.
const LEGACY_VARIANT_ALIASES: Record<string, ConcreteLayoutVariant> = {
  // v3 → v4 (Twin-frame → Split-page)
  "twin-frame": "split-50-50-left",
  "hero-thumbs": "split-60-40-left",
  "hero-inset": "split-60-40-left",
  "hero-pair": "split-50-50-left",
  // v2 → v4
  "split-editorial": "split-60-40-left",
  "cinematic-hero": "split-50-50-left",
  "stacked-story": "split-60-40-left",
  "property-led": "split-40-60-left",
  "collage-hybrid": "split-50-50-left",
};

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
  const allowed = [
    "split-50-50-left",
    "split-50-50-right",
    "split-60-40-left",
    "split-40-60-left",
  ] as const;
  if ((allowed as readonly string[]).includes(sectionVariant)) {
    return sectionVariant as ConcreteLayoutVariant;
  }
  return LEGACY_VARIANT_ALIASES[sectionVariant] ?? "split-60-40-left";
}
