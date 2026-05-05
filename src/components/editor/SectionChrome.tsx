"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import { SECTION_REGISTRY } from "@/lib/sectionRegistry";
import type { Section } from "@/lib/types";

interface Props {
  section: Section;
  children: React.ReactNode;
}

export function SectionChrome({ section, children }: Props) {
  const [hovered, setHovered] = useState(false);
  const { removeSection, duplicateSection, toggleSectionVisibility, updateSectionVariant } = useProposalStore();
  const { proposal } = useProposalStore();
  const { mode, selectSection: editorSelect, selectedSectionId, openFloatingPicker } = useEditorStore();

  const isSelected = selectedSectionId === section.id;
  const showControls = hovered || isSelected;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: section.id });

  const sortableStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : section.visible ? 1 : 0.4,
    position: "relative",
  };

  if (mode !== "editor") {
    return section.visible ? (
      <div data-section-type={section.type}>{children}</div>
    ) : null;
  }

  const reg = SECTION_REGISTRY[section.type];
  const variants = reg?.variants ?? [];

  // Resolve actual rendered colours per token: override > global token.
  const overrides = section.styleOverrides as Record<string, string>;
  const resolvedBg = overrides?.sectionSurface ?? proposal.theme.tokens.sectionSurface;
  const themeTokens = proposal.theme.tokens;

  // Per-section-type token pickers. Every section gets the section bg
  // pill; the day-cards section gets extra pills covering the structural
  // tokens that drive its small objects so the operator can recolour
  // the day head, the card body, and the accent (day-number badge,
  // tier pill, amenity icon, carousel dot — all `tokens.accent`)
  // independently from one swatch row. Other sections-with-cards
  // (property showcase) get card bg + accent.
  type PickerSpec = {
    token: keyof typeof themeTokens | "dayHeadBg" | "headerBg" | "propertyBg";
    title: string;
    swatch: string;
  };
  const pickerSpecs: PickerSpec[] = [
    {
      token: "sectionSurface",
      title: "Section background",
      swatch: resolvedBg,
    },
  ];
  // Sections that wear a SectionHeaderStrip at the top expose a
  // headerBg picker so operators can recolour the strip from the
  // section's chrome — replaces the inline 🎨 popover the strip used
  // to carry, eliminating the duplicate editor that was layering on
  // top of SectionChrome's controls.
  // propertyShowcase removed: its title is rendered as a plain
  // editorial heading now (operator brief: "no need for color in
  // the title of the Accommodation section"), so the strip-bg pill
  // would be a pill that paints nothing.
  const HAS_HEADER_STRIP: Record<string, boolean> = {
    itineraryTable: true,
  };
  if (HAS_HEADER_STRIP[section.type]) {
    pickerSpecs.push({
      token: "headerBg",
      title: "Header strip",
      swatch: overrides?.headerBg ?? themeTokens.accent ?? "#c9a84c",
    });
  }
  if (section.type === "dayJourney") {
    pickerSpecs.push(
      {
        token: "dayHeadBg",
        title: "Day-head background",
        swatch: overrides?.dayHeadBg ?? themeTokens.sectionSurface,
      },
      {
        token: "cardBg",
        title: "Destination column background",
        swatch: overrides?.cardBg ?? themeTokens.cardBg,
      },
      {
        // Operator brief: "Allow color selections for daycard
        // property section, separately from the destination text
        // section for all the daycards." propertyBg paints the
        // property-act half of every flip card; falls back to the
        // section's own sectionSurface when unset.
        token: "propertyBg",
        title: "Property column background",
        swatch: (overrides?.propertyBg as string | undefined) ?? themeTokens.sectionSurface,
      },
      {
        token: "accent",
        title: "Accent — day badge, tier pill, icons",
        swatch: overrides?.accent ?? themeTokens.accent,
      },
    );
  } else if (section.type === "propertyShowcase") {
    pickerSpecs.push(
      {
        token: "cardBg",
        title: "Card background",
        swatch: overrides?.cardBg ?? themeTokens.cardBg,
      },
      {
        token: "accent",
        title: "Accent — amenity icons, carousel dots",
        swatch: overrides?.accent ?? themeTokens.accent,
      },
    );
  } else if (section.type === "cover") {
    // Cover spec — section color is already exposed above; add text
    // color (writes headingText, drives the trip title + meta values)
    // and accent (drives the destinations line). These three pills
    // together let the operator recolour every visible element on
    // every cover layout (FULL_BLEED + 6 splits) without touching
    // the global theme.
    pickerSpecs.push(
      {
        token: "headingText",
        title: "Text color — title and meta values",
        swatch: overrides?.headingText ?? themeTokens.headingText,
      },
      {
        token: "accent",
        title: "Accent — destinations line",
        swatch: overrides?.accent ?? themeTokens.accent,
      },
    );
  } else if (section.type === "personalNote") {
    // Personal Note carries multiple sub-surfaces beyond the section
    // bg: the side-image cell + consultant-photo tile (cardBg), and
    // the consultant-initial fallback glyph (accent). Expose them as
    // dedicated pills so the operator's colour change actually
    // re-themes every visible patch — section bg alone left the side
    // image cell + photo tile painting a stale cardBg, which read as
    // "section colour didn't apply."
    pickerSpecs.push(
      {
        token: "cardBg",
        title: "Image / photo tile background",
        swatch: overrides?.cardBg ?? themeTokens.cardBg,
      },
      {
        token: "accent",
        title: "Accent — consultant initial fallback",
        swatch: overrides?.accent ?? themeTokens.accent,
      },
    );
  }

  const handlePickerClick = (
    e: React.MouseEvent,
    token: PickerSpec["token"],
    swatch: string,
  ) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    openFloatingPicker({
      x: rect.left,
      y: rect.bottom + 6,
      color: swatch,
      token,
      sectionId: section.id,
    });
  };

  // Build CSS custom properties from section overrides so child components
  // can pick them up via var(--ss-sectionSurface) etc.
  const cssVars: Record<string, string> = {};
  if (overrides) {
    for (const [key, val] of Object.entries(overrides)) {
      if (val) cssVars[`--ss-${key}`] = val;
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={sortableStyle}
      data-editor-chrome
      data-section-type={section.type}
      id={`section-${section.id}`}
    >
      {/* Inner div handles all visual states — isolated from dnd-kit's transform/transition */}
      <div
        className="relative transition-shadow duration-200"
        style={{
          ...cssVars,
          boxShadow: isSelected
            ? "0 0 0 2px rgba(27,58,45,0.22), 0 4px 16px rgba(27,58,45,0.07)"
            : undefined,
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => {
          editorSelect(section.id);
          useEditorStore.getState().selectDay(null);
          useEditorStore.getState().selectProperty(null);
        }}
      >
        {children}

        {/* ── Hover / selected controls — always mounted, fade in/out ──
            z-[700] is deliberate: Leaflet's map panes default to z-200
            (tiles) / z-400 (markers) / z-600 (popups). Anything below
            ~z-700 gets buried under the map in the Map section. Sized
            below the side panel and modal layers (z-9999+) so this
            chrome doesn't escape its containing section. */}
        <div
          className={`absolute top-2 right-2 z-[700] flex gap-1 transition-all duration-150 ${
            showControls ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1 pointer-events-none"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            {...attributes}
            {...listeners}
            className="w-8 h-8 rounded-lg bg-white/92 border border-black/10 flex items-center justify-center text-black/45 hover:text-black/75 cursor-grab shadow-sm transition-all duration-150 active:scale-95"
            title="Drag to reorder"
          >
            ⠿
          </button>

          {/* Divider sections store their colour in section.content.color
              and have their own inline colour picker (click the band).
              The default sectionSurface pill writes to styleOverrides
              which the divider doesn't read — wiring it up was a
              non-functional pill that also made "Reset to theme" appear
              to do nothing on dividers. Hide it. */}
          {section.type !== "divider" &&
            pickerSpecs.map((spec) => (
              <button
                key={spec.token}
                onClick={(e) => handlePickerClick(e, spec.token, spec.swatch)}
                className="w-8 h-8 rounded-lg bg-white/92 border border-black/10 flex items-center justify-center shadow-sm transition-all duration-150 hover:border-black/20 active:scale-95"
                title={spec.title}
              >
                <span
                  className="w-4 h-4 rounded-sm border border-black/15"
                  style={{ background: spec.swatch }}
                />
              </button>
            ))}

          <button
            onClick={(e) => { e.stopPropagation(); duplicateSection(section.id); }}
            className="w-8 h-8 rounded-lg bg-white/92 border border-black/10 flex items-center justify-center text-black/45 hover:text-black/75 shadow-sm transition-all duration-150 text-sm active:scale-95"
            title="Duplicate"
          >
            ⧉
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); toggleSectionVisibility(section.id); }}
            className="w-8 h-8 rounded-lg bg-white/92 border border-black/10 flex items-center justify-center text-black/45 hover:text-black/75 shadow-sm transition-all duration-150 text-sm active:scale-95"
            title={section.visible ? "Hide section" : "Show section"}
          >
            {section.visible ? "◉" : "○"}
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); removeSection(section.id); }}
            className="w-8 h-8 rounded-lg bg-white/92 border border-black/10 flex items-center justify-center text-black/35 hover:text-red-500 hover:border-red-200 shadow-sm transition-all duration-150 text-sm active:scale-95"
            title="Delete section"
          >
            ×
          </button>
        </div>

        {/* ── Inline label + layout variant switcher ── */}
        <div
          className={`absolute top-2 left-2 z-[700] flex items-center gap-1 transition-all duration-150 ${
            showControls ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1 pointer-events-none"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-1.5 bg-white/92 border border-black/10 rounded-lg px-2.5 py-1 shadow-sm">
            <span className="text-[10px] font-semibold text-black/40 uppercase tracking-wider">
              {reg?.label ?? section.type}
            </span>
          </div>

          {variants.length > 1 && (
            <div className="flex items-center gap-0.5 bg-white/92 border border-black/10 rounded-lg px-1 py-1 shadow-sm">
              {variants.map((v) => {
                const shortLabel = v.split("-").map((w) => w[0]).join("").toUpperCase();
                const isActive = section.layoutVariant === v;
                return (
                  <button
                    key={v}
                    onClick={() => updateSectionVariant(section.id, v)}
                    title={v}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all duration-150 active:scale-95 ${
                      isActive
                        ? "bg-[#1b3a2d] text-white"
                        : "text-black/40 hover:text-black/70 hover:bg-black/5"
                    }`}
                  >
                    {shortLabel}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Hidden badge ── */}
        {!section.visible && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-white/80 backdrop-blur-sm text-xs text-black/40 px-3 py-1.5 rounded-full border border-black/10">
              Hidden in preview
            </div>
          </div>
        )}

        {/* ── Selection indicator label ──
            Anchored at the TOP of the section (not the bottom) so the
            badge is never buried under the next section's chrome.
            Operator brief: "the editor in the Closing section hides
            in the footer — unhide it." z-[700] matches the rest of
            the section chrome so it stacks above sibling sections. */}
        {isSelected && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[700] pointer-events-none">
            <div className="bg-[#1b3a2d] text-white text-[9px] font-semibold uppercase tracking-wider px-3 py-1 rounded-full shadow-lg">
              Editing: {reg?.label ?? section.type}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
