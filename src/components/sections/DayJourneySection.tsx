"use client";

import { useState } from "react";
import type { ThemeTokens, ProposalTheme, Property as ProposalProperty, TierKey } from "@/lib/types";
import { DestinationImagePicker } from "@/components/editor/DestinationImagePicker";
import { DayPropertyPicker } from "@/components/editor/DayPropertyPicker";
import { DayStayPreview } from "./DayStayPreview";
import { resolveTokens } from "@/lib/theme";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import { fileToOptimizedDataUrl } from "@/lib/fileToDataUrl";
import type { Day, Section } from "@/lib/types";

// ─── Day card ─────────────────────────────────────────────────────────────────

function DayCard({ day, variant }: { day: Day; variant: string }) {
  const { proposal, updateDay, addDayAfter, duplicateDay, removeDay, addPropertyFromLibrary } = useProposalStore();
  const { mode, selectDay, selectedDayId } = useEditorStore();
  const isEditor = mode === "editor";
  const { activeTier, visibleTiers, theme } = proposal;
  const tokens = theme.tokens;
  const isSelected = selectedDayId === day.id;
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [propPickerOpen, setPropPickerOpen] = useState(false);

  // Assign a library property to this day — lifted up to DayCard so both
  // DayContent (inline mode) and the mirror-row layouts (Split/FlipSplit)
  // can share the same opener and handler.
  const handleAssignProperty = (snapshot: Partial<ProposalProperty>) => {
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

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: day.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: [transition, "box-shadow 200ms ease"].filter(Boolean).join(", "),
    opacity: isDragging ? 0.4 : 1,
    boxShadow: isSelected
      ? "0 0 0 2px rgba(27,58,45,0.28), 0 4px 16px rgba(27,58,45,0.08)"
      : undefined,
  };

  const handleHeroUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToOptimizedDataUrl(file);
      updateDay(day.id, { heroImageUrl: dataUrl });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Image upload failed");
    }
  };

  const tierColors: Record<string, string> = {
    classic: tokens.mutedText,
    premier: tokens.secondaryAccent,
    signature: tokens.accent,
  };

  const layoutMap: Record<string, string> = {
    "stacked-image-text": "stacked",
    "compact-timeline": "compact",
    "magazine-spread": "magazine",
    "flip-split": "flip",
    "full-image-overlay": "overlay",
  };
  const layoutType = layoutMap[variant] ?? "split";

  return (
    <div
      ref={setNodeRef}
      id={`day-${day.id}`}
      data-nav-anchor="day"
      data-nav-day-id={day.id}
      style={{ ...style, borderColor: tokens.border, background: tokens.sectionSurface }}
      onClick={() => isEditor && selectDay(day.id)}
      className="dm-card relative rounded-3xl overflow-hidden border transition-colors duration-150 scroll-mt-32"
    >
      {/* Editor action bar — top right */}
      {isEditor && (
        <div className="absolute top-3 right-3 z-20 flex gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            {...attributes}
            {...listeners}
            className="w-7 h-7 rounded-lg flex items-center justify-center bg-black/40 text-white/70 hover:bg-black/60 cursor-grab transition text-xs"
            title="Drag to reorder"
          >
            ⠿
          </button>
          <button
            onClick={() => setImagePickerOpen(true)}
            className="w-7 h-7 rounded-lg flex items-center justify-center bg-black/40 text-[#c9a84c] hover:bg-black/60 transition text-xs"
            title="Find a destination image"
          >✦</button>
          <button
            onClick={() => addDayAfter(day.id)}
            className="w-7 h-7 rounded-lg flex items-center justify-center bg-black/40 text-white/70 hover:bg-black/60 transition text-xs"
            title="Add day after"
          >+</button>
          <button
            onClick={() => duplicateDay(day.id)}
            className="w-7 h-7 rounded-lg flex items-center justify-center bg-black/40 text-white/70 hover:bg-black/60 transition text-xs"
            title="Duplicate"
          >⧉</button>
          <button
            onClick={() => removeDay(day.id)}
            className="w-7 h-7 rounded-lg flex items-center justify-center bg-black/40 text-white/70 hover:bg-red-500/80 transition text-xs"
            title="Delete day"
          >×</button>
        </div>
      )}

      {/* Destination image picker — pre-filtered by this day's destination */}
      <DestinationImagePicker
        open={imagePickerOpen}
        onClose={() => setImagePickerOpen(false)}
        defaultLocation={day.destination}
        onSelect={(c) => updateDay(day.id, { heroImageUrl: c.url })}
      />

      {/* Property picker — opened by SplitLayout / FlipSplitLayout's
          "Browse my properties" affordance alongside the mirror row, or
          by DayContent's inline button for non-mirror layouts. */}
      {propPickerOpen && (
        <DayPropertyPicker
          dayDestination={day.destination}
          onClose={() => setPropPickerOpen(false)}
          onSelect={handleAssignProperty}
        />
      )}

      {layoutType === "flip" ? (
        <FlipSplitLayout day={day} isEditor={isEditor} tokens={tokens} theme={proposal.theme} activeTier={activeTier} visibleTiers={visibleTiers} tierColors={tierColors} handleHeroUpload={handleHeroUpload} updateDay={updateDay} onOpenPicker={() => setPropPickerOpen(true)} />
      ) : layoutType === "overlay" ? (
        <FullOverlayLayout day={day} isEditor={isEditor} tokens={tokens} theme={proposal.theme} activeTier={activeTier} visibleTiers={visibleTiers} tierColors={tierColors} handleHeroUpload={handleHeroUpload} updateDay={updateDay} onOpenPicker={() => setPropPickerOpen(true)} />
      ) : layoutType === "stacked" ? (
        <StackedLayout day={day} isEditor={isEditor} tokens={tokens} theme={proposal.theme} activeTier={activeTier} visibleTiers={visibleTiers} tierColors={tierColors} handleHeroUpload={handleHeroUpload} updateDay={updateDay} onOpenPicker={() => setPropPickerOpen(true)} />
      ) : layoutType === "compact" ? (
        <CompactLayout day={day} isEditor={isEditor} tokens={tokens} theme={proposal.theme} activeTier={activeTier} visibleTiers={visibleTiers} tierColors={tierColors} handleHeroUpload={handleHeroUpload} updateDay={updateDay} onOpenPicker={() => setPropPickerOpen(true)} />
      ) : layoutType === "magazine" ? (
        <MagazineLayout day={day} isEditor={isEditor} tokens={tokens} theme={proposal.theme} activeTier={activeTier} visibleTiers={visibleTiers} tierColors={tierColors} handleHeroUpload={handleHeroUpload} updateDay={updateDay} onOpenPicker={() => setPropPickerOpen(true)} />
      ) : (
        <SplitLayout day={day} isEditor={isEditor} tokens={tokens} theme={proposal.theme} activeTier={activeTier} visibleTiers={visibleTiers} tierColors={tierColors} handleHeroUpload={handleHeroUpload} updateDay={updateDay} onOpenPicker={() => setPropPickerOpen(true)} />
      )}
    </div>
  );
}

// ── Split layout: image LEFT, content RIGHT. Two-row structure when a
//    property is in scope — the property image sits on the OPPOSITE side,
//    same proportion as the day image, creating the editorial ping-pong.

function SplitLayout({ day, isEditor, tokens, theme, activeTier, visibleTiers, tierColors, handleHeroUpload, updateDay, onOpenPicker }: {
  day: Day; isEditor: boolean; tokens: ThemeTokens;
  theme: ProposalTheme;
  activeTier: string; visibleTiers: Record<string, boolean>;
  tierColors: Record<string, string>;
  handleHeroUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  updateDay: (id: string, patch: Partial<Day>) => void;
  onOpenPicker?: () => void;
}) {
  const { proposal } = useProposalStore();
  return (
    <div>
      {/* Row 1 — Day image left (2fr), Day narrative right (3fr) */}
      <div className="grid md:grid-cols-[2fr_3fr] min-h-[440px]">
        <div className="relative bg-[#e8e2d7] min-h-[280px] md:min-h-0 overflow-hidden">
          {day.heroImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={day.heroImageUrl} alt={day.destination} className="w-full h-full object-cover absolute inset-0" />
          ) : (
            isEditor && (
              <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer hover:bg-black/5 transition dm-image">
                <input type="file" accept="image/*" className="hidden" onChange={handleHeroUpload} />
                <div className="text-3xl mb-2 opacity-30">+</div>
                <div className="text-sm opacity-40">Add photo</div>
              </label>
            )
          )}
          <div
            className="absolute bottom-0 left-0 leading-none select-none pointer-events-none"
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: "clamp(6rem, 18vw, 10rem)",
              color: "rgba(255,255,255,0.12)",
              lineHeight: 0.85,
              paddingLeft: "0.1em",
            }}
          >
            {String(day.dayNumber).padStart(2, "0")}
          </div>
          <div
            className="absolute top-4 left-4 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider"
            style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}
          >
            Day {day.dayNumber}
          </div>
          {day.heroImageUrl && isEditor && (
            <label className="absolute bottom-3 left-3 cursor-pointer bg-black/45 text-white text-[10px] px-2.5 py-1 rounded-md hover:bg-black/65 transition backdrop-blur-sm">
              <input type="file" accept="image/*" className="hidden" onChange={handleHeroUpload} />
              Change
            </label>
          )}
        </div>

        <div className="flex flex-col justify-between p-8 md:p-10" style={{ background: tokens.sectionSurface }}>
          <DayContent
            day={day}
            isEditor={isEditor}
            tokens={tokens}
            theme={theme}
            activeTier={activeTier}
            visibleTiers={visibleTiers}
            tierColors={tierColors}
            updateDay={updateDay}
            embedStayPreview={false}
          />
        </div>
      </div>

      {/* Row 2 — mirror. Property text LEFT (3fr), property image RIGHT (2fr).
          Together with Row 1 this forms a cross-pattern ping-pong. */}
      <DayStayPreview
        mode="mirror-right"
        day={day}
        activeTier={activeTier}
        visibleTiers={visibleTiers}
        tokens={tokens}
        theme={theme}
        properties={proposal.properties}
      />

      {isEditor && onOpenPicker && (
        <div className="px-8 md:px-10 py-3" style={{ background: tokens.sectionSurface }}>
          <button
            type="button"
            onClick={onOpenPicker}
            className="inline-flex items-center gap-1.5 text-label font-semibold transition hover:opacity-80"
            style={{ color: tokens.accent, textTransform: "none", letterSpacing: "0.02em" }}
          >
            <span aria-hidden>◇</span>
            <span>Browse my properties</span>
          </button>
        </div>
      )}
    </div>
  );
}

// ── Stacked layout: full-width image top, content below ────────────────────

function StackedLayout({ day, isEditor, tokens, theme, activeTier, visibleTiers, tierColors, handleHeroUpload, updateDay, onOpenPicker }: {
  day: Day; isEditor: boolean; tokens: ThemeTokens;
  theme: ProposalTheme;
  activeTier: string; visibleTiers: Record<string, boolean>;
  tierColors: Record<string, string>;
  handleHeroUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  updateDay: (id: string, patch: Partial<Day>) => void;
  onOpenPicker?: () => void;
}) {
  return (
    <div>
      {/* Full-width image */}
      <div className="relative w-full h-[300px] bg-[#e8e2d7] overflow-hidden">
        {day.heroImageUrl ? (
          <img src={day.heroImageUrl} alt={day.destination} className="w-full h-full object-cover" />
        ) : (
          isEditor && (
            <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer hover:bg-black/5 transition dm-image">
              <input type="file" accept="image/*" className="hidden" onChange={handleHeroUpload} />
              <div className="text-3xl mb-2 opacity-30">+</div>
              <div className="text-sm opacity-40">Add photo</div>
            </label>
          )
        )}
        {/* Watermark number */}
        <div
          className="absolute bottom-0 right-4 leading-none select-none pointer-events-none"
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: "clamp(5rem, 14vw, 8rem)",
            color: "rgba(255,255,255,0.12)",
            lineHeight: 0.85,
          }}
        >
          {String(day.dayNumber).padStart(2, "0")}
        </div>
        <div
          className="absolute top-4 left-4 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider"
          style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}
        >
          Day {day.dayNumber}
        </div>
        {day.heroImageUrl && isEditor && (
          <label className="absolute bottom-3 left-3 cursor-pointer bg-black/45 text-white text-[10px] px-2.5 py-1 rounded-md hover:bg-black/65 transition backdrop-blur-sm">
            <input type="file" accept="image/*" className="hidden" onChange={handleHeroUpload} />
            Change
          </label>
        )}
      </div>
      <div className="p-8 md:p-10" style={{ background: tokens.sectionSurface }}>
        <DayContent day={day} isEditor={isEditor} tokens={tokens} theme={theme} activeTier={activeTier} visibleTiers={visibleTiers} tierColors={tierColors} updateDay={updateDay} onOpenPicker={onOpenPicker} />
      </div>
    </div>
  );
}

// ── Compact layout: small image left, tight text right ───────────────────────

function CompactLayout({ day, isEditor, tokens, theme, activeTier, visibleTiers, tierColors, handleHeroUpload, updateDay }: {
  day: Day; isEditor: boolean; tokens: ThemeTokens;
  theme: ProposalTheme;
  activeTier: string; visibleTiers: Record<string, boolean>;
  tierColors: Record<string, string>;
  handleHeroUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  updateDay: (id: string, patch: Partial<Day>) => void;
  onOpenPicker?: () => void;
}) {
  return (
    <div className="grid md:grid-cols-[140px_1fr] gap-0" style={{ background: tokens.sectionSurface }}>
      {/* Small square image */}
      <div className="relative h-[140px] md:h-auto overflow-hidden" style={{ background: tokens.cardBg }}>
        {day.heroImageUrl ? (
          <img src={day.heroImageUrl} alt={day.destination} className="w-full h-full object-cover absolute inset-0" />
        ) : isEditor ? (
          <label className="absolute inset-0 flex items-center justify-center cursor-pointer dm-image">
            <input type="file" accept="image/*" className="hidden" onChange={handleHeroUpload} />
            <div className="text-xl opacity-30">+</div>
          </label>
        ) : null}
        <div
          className="absolute bottom-2 left-2 text-[9px] font-bold text-white px-2 py-0.5 rounded-full uppercase tracking-wider"
          style={{ background: "rgba(0,0,0,0.45)" }}
        >
          Day {day.dayNumber}
        </div>
      </div>

      {/* Compact content */}
      <div className="p-5 md:p-6 flex flex-col gap-2">
        <div className="flex items-baseline gap-3">
          <h3
            className="text-lg font-bold leading-tight outline-none"
            style={{ color: tokens.headingText, fontFamily: `'${theme.displayFont}', serif` }}
            contentEditable={isEditor}
            suppressContentEditableWarning
            onBlur={(e) => updateDay(day.id, { destination: e.currentTarget.textContent ?? day.destination })}
          >
            {day.destination}
          </h3>
          <span className="text-[10px] shrink-0" style={{ color: tokens.mutedText }}>
            {day.board}
          </span>
        </div>
        <p
          className="text-[12.5px] leading-[1.8] outline-none line-clamp-3"
          style={{ color: tokens.bodyText, fontFamily: `'${theme.bodyFont}', sans-serif` }}
          contentEditable={isEditor}
          suppressContentEditableWarning
          onBlur={(e) => updateDay(day.id, { description: e.currentTarget.textContent ?? day.description })}
        >
          {day.description}
        </p>
        {/* Inline accommodation */}
        <div className="flex flex-wrap gap-x-5 gap-y-1 mt-1">
          {(["classic", "premier", "signature"] as const).map((tier) => {
            if (!visibleTiers[tier]) return null;
            const acc = day.tiers[tier];
            const isActive = activeTier === tier;
            return (
              <span key={tier} className="text-[11px]" style={{ color: isActive ? tierColors[tier] : tokens.mutedText }}>
                <span className="font-semibold">{acc.camp}</span>
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Magazine layout: alternating full-width image with text overlay ──────────

function MagazineLayout({ day, isEditor, tokens, theme, activeTier, visibleTiers, tierColors, handleHeroUpload, updateDay }: {
  day: Day; isEditor: boolean; tokens: ThemeTokens;
  theme: ProposalTheme;
  activeTier: string; visibleTiers: Record<string, boolean>;
  tierColors: Record<string, string>;
  handleHeroUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  updateDay: (id: string, patch: Partial<Day>) => void;
  onOpenPicker?: () => void;
}) {
  return (
    <div>
      {/* Full-width cinematic image */}
      <div className="relative w-full h-[360px] overflow-hidden" style={{ background: tokens.cardBg }}>
        {day.heroImageUrl ? (
          <img src={day.heroImageUrl} alt={day.destination} className="w-full h-full object-cover" />
        ) : isEditor ? (
          <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer dm-image">
            <input type="file" accept="image/*" className="hidden" onChange={handleHeroUpload} />
            <div className="text-3xl mb-2 opacity-30">+</div>
            <div className="text-sm opacity-40">Add photo</div>
          </label>
        ) : null}
        {/* Gradient overlay */}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.1) 50%, transparent 100%)" }} />
        {/* Overlaid title */}
        <div className="absolute bottom-0 left-0 right-0 p-8 md:p-10">
          <div className="text-[9px] uppercase tracking-[0.28em] text-white/50 mb-2">
            Day {day.dayNumber} · {day.country}
          </div>
          <h2
            className="text-[2rem] md:text-[2.5rem] font-bold text-white leading-tight outline-none"
            style={{ fontFamily: `'${theme.displayFont}', serif`, textShadow: "0 2px 12px rgba(0,0,0,0.3)" }}
            contentEditable={isEditor}
            suppressContentEditableWarning
            onBlur={(e) => updateDay(day.id, { destination: e.currentTarget.textContent ?? day.destination })}
          >
            {day.destination}
          </h2>
        </div>
        {day.heroImageUrl && isEditor && (
          <label className="absolute top-3 right-3 cursor-pointer bg-black/45 text-white text-[10px] px-2.5 py-1 rounded-md hover:bg-black/65 transition backdrop-blur-sm">
            <input type="file" accept="image/*" className="hidden" onChange={handleHeroUpload} />
            Change
          </label>
        )}
      </div>
      {/* Content below */}
      <div className="p-8 md:p-10 grid md:grid-cols-[2fr_1fr] gap-8" style={{ background: tokens.sectionSurface }}>
        <p
          className="text-[13.5px] leading-[2.0] outline-none"
          style={{ color: tokens.bodyText, fontFamily: `'${theme.bodyFont}', sans-serif` }}
          contentEditable={isEditor}
          suppressContentEditableWarning
          onBlur={(e) => updateDay(day.id, { description: e.currentTarget.textContent ?? day.description })}
        >
          {day.description}
        </p>
        <div className="space-y-3 pt-1" style={{ borderLeft: `1px solid ${tokens.border}`, paddingLeft: "1.5rem" }}>
          <div className="text-[9px] uppercase tracking-[0.2em] mb-3" style={{ color: tokens.mutedText }}>
            Where you&apos;ll stay
          </div>
          {(["classic", "premier", "signature"] as const).map((tier) => {
            if (!visibleTiers[tier]) return null;
            const acc = day.tiers[tier];
            const isActive = activeTier === tier;
            return (
              <div key={tier}>
                <div className={`text-[12px] ${isActive ? "font-semibold" : ""}`} style={{ color: isActive ? tokens.headingText : tokens.bodyText }}>
                  {acc.camp}
                </div>
                <div className="text-[10px]" style={{ color: tokens.mutedText }}>{acc.location}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Flip-split: content left, image right. Mirror row flips too. ────────────

function FlipSplitLayout({ day, isEditor, tokens, theme, activeTier, visibleTiers, tierColors, handleHeroUpload, updateDay, onOpenPicker }: {
  day: Day; isEditor: boolean; tokens: ThemeTokens;
  theme: ProposalTheme;
  activeTier: string; visibleTiers: Record<string, boolean>;
  tierColors: Record<string, string>;
  handleHeroUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  updateDay: (id: string, patch: Partial<Day>) => void;
  onOpenPicker?: () => void;
}) {
  const { proposal } = useProposalStore();
  return (
    <div>
      {/* Row 1 — Day content LEFT (3fr), day image RIGHT (2fr) */}
      <div className="grid md:grid-cols-[3fr_2fr] min-h-[440px]">
        <div className="flex flex-col justify-between p-8 md:p-10 order-2 md:order-1" style={{ background: tokens.sectionSurface }}>
          <DayContent
            day={day}
            isEditor={isEditor}
            tokens={tokens}
            theme={theme}
            activeTier={activeTier}
            visibleTiers={visibleTiers}
            tierColors={tierColors}
            updateDay={updateDay}
            embedStayPreview={false}
          />
        </div>
        <div className="relative bg-[#e8e2d7] min-h-[280px] md:min-h-0 overflow-hidden order-1 md:order-2">
          {day.heroImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={day.heroImageUrl} alt={day.destination} className="w-full h-full object-cover absolute inset-0" />
          ) : isEditor ? (
            <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer hover:bg-black/5 transition dm-image">
              <input type="file" accept="image/*" className="hidden" onChange={handleHeroUpload} />
              <div className="text-3xl mb-2 opacity-30">+</div>
              <div className="text-sm opacity-40">Add photo</div>
            </label>
          ) : null}
          <div className="absolute bottom-0 right-0 leading-none select-none pointer-events-none"
            style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(6rem, 18vw, 10rem)", color: "rgba(255,255,255,0.12)", lineHeight: 0.85, paddingRight: "0.1em" }}>
            {String(day.dayNumber).padStart(2, "0")}
          </div>
          <div className="absolute top-4 right-4 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider"
            style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}>
            Day {day.dayNumber}
          </div>
          {day.heroImageUrl && isEditor && (
            <label className="absolute bottom-3 right-3 cursor-pointer bg-black/45 text-white text-[10px] px-2.5 py-1 rounded-md hover:bg-black/65 transition backdrop-blur-sm">
              <input type="file" accept="image/*" className="hidden" onChange={handleHeroUpload} />
              Change
            </label>
          )}
        </div>
      </div>

      {/* Row 2 — mirror. Property image LEFT (2fr), property text RIGHT (3fr). */}
      <DayStayPreview
        mode="mirror-left"
        day={day}
        activeTier={activeTier}
        visibleTiers={visibleTiers}
        tokens={tokens}
        theme={theme}
        properties={proposal.properties}
      />

      {isEditor && onOpenPicker && (
        <div className="px-8 md:px-10 py-3" style={{ background: tokens.sectionSurface }}>
          <button
            type="button"
            onClick={onOpenPicker}
            className="inline-flex items-center gap-1.5 text-label font-semibold transition hover:opacity-80"
            style={{ color: tokens.accent, textTransform: "none", letterSpacing: "0.02em" }}
          >
            <span aria-hidden>◇</span>
            <span>Browse my properties</span>
          </button>
        </div>
      )}
    </div>
  );
}

// ── Full-image-overlay: full image with all content overlaid ─────────────────

function FullOverlayLayout({ day, isEditor, tokens, theme, activeTier, visibleTiers, tierColors, handleHeroUpload, updateDay }: {
  day: Day; isEditor: boolean; tokens: ThemeTokens;
  theme: ProposalTheme;
  activeTier: string; visibleTiers: Record<string, boolean>;
  tierColors: Record<string, string>;
  handleHeroUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  updateDay: (id: string, patch: Partial<Day>) => void;
  onOpenPicker?: () => void;
}) {
  return (
    <div className="relative min-h-[480px]" style={{ background: tokens.cardBg }}>
      {day.heroImageUrl ? (
        <img src={day.heroImageUrl} alt={day.destination} className="absolute inset-0 w-full h-full object-cover" />
      ) : isEditor ? (
        <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer dm-image">
          <input type="file" accept="image/*" className="hidden" onChange={handleHeroUpload} />
          <div className="text-3xl mb-2 opacity-30">+</div>
          <div className="text-sm opacity-40">Add photo</div>
        </label>
      ) : null}
      {/* Heavy gradient overlay */}
      <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 40%, rgba(0,0,0,0.15) 70%, rgba(0,0,0,0.3) 100%)" }} />
      {/* Day badge */}
      <div className="absolute top-4 left-4 z-10 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider"
        style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}>
        Day {day.dayNumber}
      </div>
      {day.heroImageUrl && isEditor && (
        <label className="absolute top-4 right-4 z-10 cursor-pointer bg-black/45 text-white text-[10px] px-2.5 py-1 rounded-md hover:bg-black/65 transition backdrop-blur-sm">
          <input type="file" accept="image/*" className="hidden" onChange={handleHeroUpload} />
          Change
        </label>
      )}
      {/* Content overlaid at bottom */}
      <div className="relative z-10 flex flex-col justify-end min-h-[480px] p-8 md:p-10">
        <div className="max-w-lg">
          <div className="text-[9px] uppercase tracking-[0.28em] text-white/50 mb-2">{day.country}{day.board ? ` · ${day.board}` : ""}</div>
          <h2 className="text-[2rem] md:text-[2.8rem] font-bold text-white leading-[1.0] tracking-tight outline-none mb-4"
            style={{ fontFamily: `'${theme.displayFont}', serif`, textShadow: "0 2px 16px rgba(0,0,0,0.4)" }}
            contentEditable={isEditor} suppressContentEditableWarning
            onBlur={(e) => updateDay(day.id, { destination: e.currentTarget.textContent ?? day.destination })}>
            {day.destination}
          </h2>
          <p className="text-[13px] leading-[1.9] text-white/75 outline-none mb-5"
            style={{ fontFamily: `'${theme.bodyFont}', sans-serif` }}
            contentEditable={isEditor} suppressContentEditableWarning
            onBlur={(e) => updateDay(day.id, { description: e.currentTarget.textContent ?? day.description })}>
            {day.description}
          </p>
          {/* Accommodation inline */}
          <div className="flex flex-wrap gap-x-5 gap-y-1.5 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.15)" }}>
            {(["classic", "premier", "signature"] as const).map((tier) => {
              if (!visibleTiers[tier]) return null;
              const acc = day.tiers[tier];
              const isActive = activeTier === tier;
              return (
                <div key={tier} className="text-[11px]">
                  <span className="text-[8px] uppercase tracking-wider mr-1.5" style={{ color: isActive ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.3)" }}>{tier}</span>
                  <span style={{ color: isActive ? "white" : "rgba(255,255,255,0.55)" }} className={isActive ? "font-semibold" : ""}>{acc.camp}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Day content: destination + description + accommodation ──────────────────

function DayContent({ day, isEditor, tokens, theme, activeTier, visibleTiers, updateDay, embedStayPreview = true, onOpenPicker }: {
  day: Day; isEditor: boolean; tokens: ThemeTokens;
  theme: ProposalTheme;
  activeTier: string; visibleTiers: Record<string, boolean>;
  tierColors: Record<string, string>;
  updateDay: (id: string, patch: Partial<Day>) => void;
  // When false, DayContent omits the "Stay at" block — the parent layout
  // renders DayStayPreview as a sibling row in mirror mode instead.
  embedStayPreview?: boolean;
  onOpenPicker?: () => void;
}) {
  // Read proposal here so we can resolve property previews.
  const { proposal } = useProposalStore();

  return (
    // Editorial rhythm from the brief: image lives in the parent layout,
    // then 32 → title → 16 → text → 24 → "Stay at" property block.
    // The image-edge-to-title gap is enforced by the layout (padding around
    // this DayContent block); within DayContent we control title→text→stay.
    <div className="flex flex-col h-full">
      {/* Header (title + meta) */}
      <div>
        <div
          className="text-label ed-label mb-3"
          style={{ color: tokens.mutedText }}
        >
          {day.country}{day.board ? ` · ${day.board}` : ""}
        </div>
        <h2
          className="text-h1 font-bold tracking-tight outline-none"
          style={{ color: tokens.headingText, fontFamily: `'${theme.displayFont}', serif` }}
          contentEditable={isEditor}
          suppressContentEditableWarning
          onBlur={(e) => updateDay(day.id, { destination: e.currentTarget.textContent ?? day.destination })}
        >
          {day.destination}
        </h2>
        {day.subtitle && (
          <div
            className="text-small mt-3 italic outline-none"
            style={{ color: tokens.mutedText, fontFamily: `'${theme.bodyFont}', sans-serif` }}
            contentEditable={isEditor}
            suppressContentEditableWarning
            onBlur={(e) => updateDay(day.id, { subtitle: e.currentTarget.textContent ?? day.subtitle })}
          >
            {day.subtitle}
          </div>
        )}
      </div>

      {/* 16px gap → narrative */}
      <p
        className="text-body mt-4 outline-none flex-1"
        style={{ color: tokens.bodyText, fontFamily: `'${theme.bodyFont}', sans-serif` }}
        contentEditable={isEditor}
        suppressContentEditableWarning
        onBlur={(e) => updateDay(day.id, { description: e.currentTarget.textContent ?? day.description })}
      >
        {day.description}
      </p>

      {/* Inline mode: "Stay at" block rendered within the content column.
          Layouts that render a mirror-mode sibling row pass
          embedStayPreview={false} and handle the button themselves. */}
      {embedStayPreview && (
        <div className="mt-6">
          <DayStayPreview
            mode="inline"
            day={day}
            activeTier={activeTier}
            visibleTiers={visibleTiers}
            tokens={tokens}
            theme={theme}
            properties={proposal.properties}
          />
          {isEditor && onOpenPicker && (
            <button
              type="button"
              onClick={onOpenPicker}
              className="mt-3 inline-flex items-center gap-1.5 text-label font-semibold transition hover:opacity-80"
              style={{ color: tokens.accent, textTransform: "none", letterSpacing: "0.02em" }}
            >
              <span aria-hidden>◇</span>
              <span>Browse my properties</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

export function DayJourneySection({ section }: { section: Section }) {
  const { proposal, moveDay, addDay } = useProposalStore();
  const { mode } = useEditorStore();
  const isEditor = mode === "editor";
  const { days, theme } = proposal;
  const tokens = resolveTokens(theme.tokens, section.styleOverrides);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIdx = days.findIndex((d) => d.id === active.id);
    const toIdx = days.findIndex((d) => d.id === over.id);
    if (fromIdx !== -1 && toIdx !== -1) moveDay(fromIdx, toIdx);
  };

  return (
    <div className="py-24" style={{ background: tokens.pageBg }}>
      <div className="ed-wide">
        {/* Section header */}
        <div className="flex items-end justify-between mb-16">
          <div>
            <div
              className="text-label ed-label mb-3"
              style={{ color: tokens.mutedText }}
            >
              Day-by-day
            </div>
            <div
              className="text-h1 font-bold tracking-tight"
              style={{ color: tokens.headingText, fontFamily: `'${theme.displayFont}', serif` }}
            >
              Your journey
            </div>
          </div>
          <div className="text-small pb-1" style={{ color: tokens.mutedText }}>
            {days.length} {days.length === 1 ? "day" : "days"}
          </div>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={days.map((d) => d.id)} strategy={verticalListSortingStrategy}>
            <div className="relative">
              {/* Subtle vertical timeline rule on desktop */}
              <div
                className="hidden md:block absolute left-[-2rem] top-8 bottom-8 w-px"
                style={{ background: `linear-gradient(to bottom, transparent, ${tokens.border} 15%, ${tokens.border} 85%, transparent)` }}
              />

              {/* 96px between day cards — the brief's editorial spacing */}
              <div className="space-y-24">
                {days.map((day, i) => (
                  <div key={day.id} className="relative">
                    <div
                      className="hidden md:flex absolute left-[-2.4rem] top-6 w-3 h-3 rounded-full border-2 items-center justify-center"
                      style={{
                        background: i === 0 ? tokens.accent : tokens.sectionSurface,
                        borderColor: tokens.accent,
                      }}
                    />
                    <DayCard day={day} variant={section.layoutVariant} />
                  </div>
                ))}
              </div>
            </div>
          </SortableContext>
        </DndContext>

        {days.length === 0 && (
          <div
            className="text-center py-16 rounded-2xl border-2 border-dashed text-small"
            style={{ borderColor: tokens.border, color: tokens.mutedText }}
          >
            No days yet.
          </div>
        )}

        {isEditor && (
          <button
            onClick={addDay}
            className="mt-12 w-full py-4 rounded-2xl border-2 border-dashed text-small font-medium transition hover:opacity-80"
            style={{ borderColor: tokens.accent, color: tokens.accent }}
          >
            + Add day
          </button>
        )}
      </div>
    </div>
  );
}
