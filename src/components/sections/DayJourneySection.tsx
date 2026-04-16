"use client";

import type { ThemeTokens, ProposalTheme } from "@/lib/types";
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
import type { Day, Section } from "@/lib/types";

// ─── Day card ─────────────────────────────────────────────────────────────────

function DayCard({ day, variant }: { day: Day; variant: string }) {
  const { proposal, updateDay, addDayAfter, duplicateDay, removeDay } = useProposalStore();
  const { mode, selectDay, selectedDayId } = useEditorStore();
  const isEditor = mode === "editor";
  const { activeTier, visibleTiers, theme } = proposal;
  const tokens = theme.tokens;
  const isSelected = selectedDayId === day.id;

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

  const handleHeroUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) updateDay(day.id, { heroImageUrl: URL.createObjectURL(file) });
  };

  const tierColors: Record<string, string> = {
    classic: tokens.mutedText,
    premier: tokens.secondaryAccent,
    signature: tokens.accent,
  };

  const isStacked = variant === "stacked-image-text";

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, borderColor: tokens.border, background: tokens.sectionSurface }}
      onClick={() => isEditor && selectDay(day.id)}
      className="dm-card relative rounded-3xl overflow-hidden border transition-colors duration-150"
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

      {isStacked ? (
        <StackedLayout day={day} isEditor={isEditor} tokens={tokens} theme={proposal.theme} activeTier={activeTier} visibleTiers={visibleTiers} tierColors={tierColors} handleHeroUpload={handleHeroUpload} updateDay={updateDay} />
      ) : (
        <SplitLayout day={day} isEditor={isEditor} tokens={tokens} theme={proposal.theme} activeTier={activeTier} visibleTiers={visibleTiers} tierColors={tierColors} handleHeroUpload={handleHeroUpload} updateDay={updateDay} />
      )}
    </div>
  );
}

// ── Split layout: image left, structured content right ──────────────────────

function SplitLayout({ day, isEditor, tokens, theme, activeTier, visibleTiers, tierColors, handleHeroUpload, updateDay }: {
  day: Day; isEditor: boolean; tokens: ThemeTokens;
  theme: ProposalTheme;
  activeTier: string; visibleTiers: Record<string, boolean>;
  tierColors: Record<string, string>;
  handleHeroUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  updateDay: (id: string, patch: Partial<Day>) => void;
}) {
  return (
    <div className="grid md:grid-cols-[2fr_3fr] min-h-[440px]">
      {/* Image column */}
      <div className="relative bg-[#e8e2d7] min-h-[280px] md:min-h-0 overflow-hidden">
        {day.heroImageUrl ? (
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
        {/* Large typographic day number watermark */}
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
        {/* Day badge */}
        <div
          className="absolute top-4 left-4 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider"
          style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}
        >
          Day {day.dayNumber}
        </div>
        {/* Swap image button (editor) */}
        {day.heroImageUrl && isEditor && (
          <label className="absolute bottom-3 left-3 cursor-pointer bg-black/45 text-white text-[10px] px-2.5 py-1 rounded-md hover:bg-black/65 transition backdrop-blur-sm">
            <input type="file" accept="image/*" className="hidden" onChange={handleHeroUpload} />
            Change
          </label>
        )}
      </div>

      {/* Content column */}
      <div className="flex flex-col justify-between p-8 md:p-10" style={{ background: tokens.sectionSurface }}>
        <DayContent day={day} isEditor={isEditor} tokens={tokens} theme={theme} activeTier={activeTier} visibleTiers={visibleTiers} tierColors={tierColors} updateDay={updateDay} />
      </div>
    </div>
  );
}

// ── Stacked layout: full-width image top, content below ────────────────────

function StackedLayout({ day, isEditor, tokens, theme, activeTier, visibleTiers, tierColors, handleHeroUpload, updateDay }: {
  day: Day; isEditor: boolean; tokens: ThemeTokens;
  theme: ProposalTheme;
  activeTier: string; visibleTiers: Record<string, boolean>;
  tierColors: Record<string, string>;
  handleHeroUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  updateDay: (id: string, patch: Partial<Day>) => void;
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
        <DayContent day={day} isEditor={isEditor} tokens={tokens} theme={theme} activeTier={activeTier} visibleTiers={visibleTiers} tierColors={tierColors} updateDay={updateDay} />
      </div>
    </div>
  );
}

// ── Day content: destination + description + accommodation ──────────────────

function DayContent({ day, isEditor, tokens, theme, activeTier, visibleTiers, tierColors, updateDay }: {
  day: Day; isEditor: boolean; tokens: ThemeTokens;
  theme: ProposalTheme;
  activeTier: string; visibleTiers: Record<string, boolean>;
  tierColors: Record<string, string>;
  updateDay: (id: string, patch: Partial<Day>) => void;
}) {
  return (
    <div className="flex flex-col h-full gap-5">
      {/* Header block */}
      <div>
        <div className="text-[9px] uppercase tracking-[0.28em] mb-2.5" style={{ color: tokens.mutedText }}>
          {day.country}{day.board ? ` · ${day.board}` : ""}
        </div>
        <h2
          className="text-[2rem] md:text-[2.4rem] font-bold leading-[1.05] tracking-tight outline-none"
          style={{ color: tokens.headingText, fontFamily: `'${theme.displayFont}', serif` }}
          contentEditable={isEditor}
          suppressContentEditableWarning
          onBlur={(e) => updateDay(day.id, { destination: e.currentTarget.textContent ?? day.destination })}
        >
          {day.destination}
        </h2>
        {day.subtitle && (
          <div
            className="text-[12px] mt-2 outline-none italic"
            style={{ color: tokens.mutedText, fontFamily: `'${theme.bodyFont}', sans-serif` }}
            contentEditable={isEditor}
            suppressContentEditableWarning
            onBlur={(e) => updateDay(day.id, { subtitle: e.currentTarget.textContent ?? day.subtitle })}
          >
            {day.subtitle}
          </div>
        )}
      </div>

      {/* Description */}
      <p
        className="text-[13.5px] leading-[2.0] outline-none flex-1"
        style={{ color: tokens.bodyText, fontFamily: `'${theme.bodyFont}', sans-serif` }}
        contentEditable={isEditor}
        suppressContentEditableWarning
        onBlur={(e) => updateDay(day.id, { description: e.currentTarget.textContent ?? day.description })}
      >
        {day.description}
      </p>

      {/* Accommodation tiers */}
      <div className="pt-5" style={{ borderTop: `1px solid ${tokens.border}` }}>
        <div className="text-[9px] uppercase tracking-[0.28em] mb-3.5" style={{ color: tokens.mutedText }}>
          Where you&apos;ll stay
        </div>
        <div className="space-y-2.5">
          {(["classic", "premier", "signature"] as const).map((tier) => {
            if (!visibleTiers[tier]) return null;
            const acc = day.tiers[tier];
            const isActive = activeTier === tier;
            return (
              <div key={tier} className="flex items-baseline gap-3">
                <span
                  className="text-[8px] uppercase tracking-[0.18em] font-semibold shrink-0 w-[48px]"
                  style={{ color: isActive ? tierColors[tier] : `${tierColors[tier]}60` }}
                >
                  {tier}
                </span>
                <div className="min-w-0 flex flex-col">
                  <span
                    className={`leading-snug outline-none truncate ${isActive ? "text-[13px] font-semibold" : "text-[12px]"}`}
                    style={{ color: isActive ? tokens.headingText : tokens.bodyText }}
                    contentEditable={isEditor}
                    suppressContentEditableWarning
                  >
                    {acc.camp}
                  </span>
                  <span
                    className="text-[10.5px] truncate outline-none"
                    style={{ color: tokens.mutedText }}
                    contentEditable={isEditor}
                    suppressContentEditableWarning
                  >
                    {acc.location}{acc.note ? ` · ${acc.note}` : ""}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

export function DayJourneySection({ section }: { section: Section }) {
  const { proposal, moveDay, addDay } = useProposalStore();
  const { mode } = useEditorStore();
  const isEditor = mode === "editor";
  const { days, theme } = proposal;
  const tokens = theme.tokens;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIdx = days.findIndex((d) => d.id === active.id);
    const toIdx = days.findIndex((d) => d.id === over.id);
    if (fromIdx !== -1 && toIdx !== -1) moveDay(fromIdx, toIdx);
  };

  return (
    <div className="py-24 md:py-28 px-8 md:px-16" style={{ background: tokens.pageBg }}>
      <div className="max-w-5xl mx-auto">
        {/* Section header */}
        <div className="flex items-end justify-between mb-14">
          <div>
            <div className="text-[10px] uppercase tracking-[0.28em] mb-3" style={{ color: tokens.mutedText }}>
              Day-by-day
            </div>
            <div
              className="text-[2.75rem] md:text-[3rem] font-bold leading-[1.0] tracking-tight"
              style={{ color: tokens.headingText, fontFamily: `'${theme.displayFont}', serif` }}
            >
              Your journey
            </div>
          </div>
          <div className="text-[12px] pb-1" style={{ color: tokens.mutedText }}>
            {days.length} {days.length === 1 ? "day" : "days"}
          </div>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={days.map((d) => d.id)} strategy={verticalListSortingStrategy}>
            {/* Timeline connector */}
            <div className="relative">
              {/* Vertical line on large screens */}
              <div
                className="hidden md:block absolute left-[-2rem] top-8 bottom-8 w-px"
                style={{ background: `linear-gradient(to bottom, transparent, ${tokens.border} 15%, ${tokens.border} 85%, transparent)` }}
              />

              <div className="space-y-5">
                {days.map((day, i) => (
                  <div key={day.id} className="relative">
                    {/* Timeline dot */}
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
            className="text-center py-16 rounded-2xl border-2 border-dashed"
            style={{ borderColor: tokens.border, color: tokens.mutedText }}
          >
            No days yet.
          </div>
        )}

        {isEditor && (
          <button
            onClick={addDay}
            className="mt-6 w-full py-4 rounded-2xl border-2 border-dashed text-sm font-medium transition hover:opacity-80"
            style={{ borderColor: tokens.accent, color: tokens.accent }}
          >
            + Add day
          </button>
        )}
      </div>
    </div>
  );
}
