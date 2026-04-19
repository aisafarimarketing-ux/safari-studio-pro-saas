"use client";

import { useState } from "react";
import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import { fileToOptimizedDataUrl } from "@/lib/fileToDataUrl";
import { DestinationImagePicker } from "@/components/editor/DestinationImagePicker";
import { DayPropertyPicker } from "@/components/editor/DayPropertyPicker";
import { MagazineCoverChapter } from "./layouts/MagazineCover";
import { DestinationPropertyChapter } from "./layouts/DestinationProperty";
import type { StayChapter, ChapterLayoutVariant } from "./types";
import type { Day, Property as ProposalProperty, Section, TierKey } from "@/lib/types";

// Chapter dispatcher. Takes a resolved StayChapter + section + variant
// and renders the right layout. Handles the interaction wiring (image
// uploads, picker state) at this level so layouts stay presentational.

export function ChapterCard({
  chapter,
  section,
  variant,
}: {
  chapter: StayChapter;
  section: Section;
  variant: ChapterLayoutVariant;
}) {
  const { proposal, updateDay, updateProperty, addPropertyFromLibrary } = useProposalStore();
  const { mode } = useEditorStore();
  const isEditor = mode === "editor";
  const activeTier = proposal.activeTier as TierKey;

  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [propPickerOpen, setPropPickerOpen] = useState(false);
  const [activeDayForPicker, setActiveDayForPicker] = useState<string | null>(null);

  const onEditDay = (dayId: string, patch: Partial<Day>) => updateDay(dayId, patch);

  const onPropertyImageUpload = async (file: File) => {
    try {
      const dataUrl = await fileToOptimizedDataUrl(file);
      if (chapter.property && !chapter.property.id.startsWith("phantom-")) {
        updateProperty(chapter.property.id, { leadImageUrl: dataUrl });
      } else {
        // Phantom (free-text) stay → fall back to the first day's hero.
        updateDay(chapter.days[0].id, { heroImageUrl: dataUrl });
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Image upload failed");
    }
  };

  const onDestinationImageUpload = async (dayId: string, file: File) => {
    try {
      const dataUrl = await fileToOptimizedDataUrl(file);
      updateDay(dayId, { heroImageUrl: dataUrl });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Image upload failed");
    }
  };

  const onAssignProperty = (snapshot: Partial<ProposalProperty>) => {
    if (!snapshot.name) return;
    const nameLc = snapshot.name.trim().toLowerCase();
    const already = proposal.properties.some(
      (p) => p.name.trim().toLowerCase() === nameLc,
    );
    if (!already) addPropertyFromLibrary(snapshot);
    // Write the camp onto every day in this chapter so the chapter stays
    // coherent after re-resolve.
    for (const day of chapter.days) {
      updateDay(day.id, {
        tiers: {
          ...day.tiers,
          [activeTier]: {
            ...day.tiers[activeTier],
            camp: snapshot.name,
            location: snapshot.location || day.tiers[activeTier].location,
            note: "",
          },
        },
      });
    }
    setPropPickerOpen(false);
  };

  const chapterProps = {
    chapter,
    isEditor,
    section,
    proposal,
    activeTier,
    onEditDay,
    onPropertyImageUpload,
    onDestinationImageUpload,
    onOpenPropertyPicker: () => setPropPickerOpen(true),
    onOpenDestinationPicker: () => {
      setActiveDayForPicker(chapter.days[0].id);
      setImagePickerOpen(true);
    },
  };

  return (
    <div
      id={`chapter-${chapter.id}`}
      data-chapter-anchor
      className="relative rounded-3xl overflow-hidden"
      style={{
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}
    >
      {variant === "chapter-magazine" ? (
        <MagazineCoverChapter {...chapterProps} />
      ) : (
        <DestinationPropertyChapter {...chapterProps} />
      )}

      {/* Pickers are editor-only; skip mounting entirely in preview/share
          so they never fire network calls during PDF capture. */}
      {isEditor && (
        <>
          <DestinationImagePicker
            open={imagePickerOpen}
            onClose={() => setImagePickerOpen(false)}
            defaultLocation={chapter.destinationName}
            onSelect={(c) => {
              if (activeDayForPicker) {
                updateDay(activeDayForPicker, { heroImageUrl: c.url });
              }
            }}
          />
          {propPickerOpen && (
            <DayPropertyPicker
              dayDestination={chapter.destinationName}
              onClose={() => setPropPickerOpen(false)}
              onSelect={onAssignProperty}
            />
          )}
        </>
      )}
    </div>
  );
}
