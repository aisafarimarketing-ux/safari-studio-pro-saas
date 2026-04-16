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
    transition,
    opacity: isDragging ? 0.4 : 1,
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
      className={`dm-card relative rounded-3xl overflow-hidden border transition ${
        isSelected ? "ring-2 ring-offset-2 ring-[#1b3a2d]/30" : ""
      }`}
    >
      {/* Drag handle + actions — editor only */}
      {isEditor && (
        <div className="absolute top-3 right-3 z-20 flex gap-1">
          <button
            {...attributes}
            {...listeners}
            className="w-8 h-8 rounded-lg flex items-center justify-center bg-black/40 text-white/70 hover:bg-black/60 cursor-grab transition"
            title="Drag to reorder"
          >
            ⠿
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); addDayAfter(day.id); }}
            className="w-8 h-8 rounded-lg flex items-center justify-center bg-black/40 text-white/70 hover:bg-black/60 transition text-xs"
            title="Add day after"
          >+</button>
          <button
            onClick={(e) => { e.stopPropagation(); duplicateDay(day.id); }}
            className="w-8 h-8 rounded-lg flex items-center justify-center bg-black/40 text-white/70 hover:bg-black/60 transition text-xs"
            title="Duplicate"
          >⧉</button>
          <button
            onClick={(e) => { e.stopPropagation(); removeDay(day.id); }}
            className="w-8 h-8 rounded-lg flex items-center justify-center bg-black/40 text-white/70 hover:bg-red-500/80 transition text-xs"
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

function SplitLayout({ day, isEditor, tokens, theme, activeTier, visibleTiers, tierColors, handleHeroUpload, updateDay }: {
  day: Day; isEditor: boolean; tokens: ThemeTokens;
  theme: ProposalTheme;
  activeTier: string; visibleTiers: Record<string, boolean>;
  tierColors: Record<string, string>;
  handleHeroUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  updateDay: (id: string, patch: Partial<Day>) => void;
}) {
  return (
    <div className="grid md:grid-cols-2 min-h-[420px]">
      {/* Image */}
      <div className="relative bg-[#e8e2d7] min-h-[300px] md:min-h-0">
        {day.heroImageUrl ? (
          <img src={day.heroImageUrl} alt={day.destination} className="w-full h-full object-cover absolute inset-0" />
        ) : (
          isEditor && (
            <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer hover:bg-black/5 transition">
              <input type="file" accept="image/*" className="hidden" onChange={handleHeroUpload} />
              <div className="text-3xl mb-2 opacity-30">+</div>
              <div className="text-sm opacity-40">Add photo</div>
            </label>
          )
        )}
        {/* Day badge */}
        <div className="absolute top-4 left-4 text-white text-xs font-semibold px-3 py-1 rounded-full"
          style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}>
          Day {day.dayNumber}
        </div>
      </div>

      {/* Content */}
      <div className="p-8 md:p-10 flex flex-col justify-center" style={{ background: tokens.sectionSurface }}>
        <TextContent day={day} isEditor={isEditor} tokens={tokens} theme={theme} activeTier={activeTier} visibleTiers={visibleTiers} tierColors={tierColors} updateDay={updateDay} />
      </div>
    </div>
  );
}

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
      <div className="relative w-full h-[280px] bg-[#e8e2d7]">
        {day.heroImageUrl ? (
          <img src={day.heroImageUrl} alt={day.destination} className="w-full h-full object-cover" />
        ) : (
          isEditor && (
            <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer hover:bg-black/5 transition">
              <input type="file" accept="image/*" className="hidden" onChange={handleHeroUpload} />
              <div className="text-3xl mb-2 opacity-30">+</div>
              <div className="text-sm opacity-40">Add photo</div>
            </label>
          )
        )}
        <div className="absolute top-4 left-4 text-white text-xs font-semibold px-3 py-1 rounded-full"
          style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}>
          Day {day.dayNumber}
        </div>
      </div>
      <div className="p-8 md:p-10" style={{ background: tokens.sectionSurface }}>
        <TextContent day={day} isEditor={isEditor} tokens={tokens} theme={theme} activeTier={activeTier} visibleTiers={visibleTiers} tierColors={tierColors} updateDay={updateDay} />
      </div>
    </div>
  );
}

function TextContent({ day, isEditor, tokens, theme, activeTier, visibleTiers, tierColors, updateDay }: {
  day: Day; isEditor: boolean; tokens: ThemeTokens;
  theme: ProposalTheme;
  activeTier: string; visibleTiers: Record<string, boolean>;
  tierColors: Record<string, string>;
  updateDay: (id: string, patch: Partial<Day>) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <div className="text-[11px] uppercase tracking-[0.22em] mb-1" style={{ color: tokens.mutedText }}>
          Day {day.dayNumber} · {day.country} · {day.board}
        </div>
        <h2
          className="text-4xl md:text-5xl font-bold leading-tight outline-none"
          style={{ color: tokens.headingText, fontFamily: `'${theme.displayFont}', serif` }}
          contentEditable={isEditor}
          suppressContentEditableWarning
          onBlur={(e) => updateDay(day.id, { destination: e.currentTarget.textContent ?? day.destination })}
        >
          {day.destination}
        </h2>
        {day.subtitle && (
          <div
            className="text-sm mt-1 outline-none"
            style={{ color: tokens.mutedText, fontFamily: `'${theme.bodyFont}', sans-serif` }}
            contentEditable={isEditor}
            suppressContentEditableWarning
            onBlur={(e) => updateDay(day.id, { subtitle: e.currentTarget.textContent ?? day.subtitle })}
          >
            {day.subtitle}
          </div>
        )}
      </div>

      <p
        className="text-[15px] leading-[1.85] outline-none"
        style={{ color: tokens.bodyText, fontFamily: `'${theme.bodyFont}', sans-serif` }}
        contentEditable={isEditor}
        suppressContentEditableWarning
        onBlur={(e) => updateDay(day.id, { description: e.currentTarget.textContent ?? day.description })}
      >
        {day.description}
      </p>

      {/* Accommodation tiers */}
      <div className="pt-3 border-t space-y-2" style={{ borderColor: tokens.border }}>
        <div className="text-[10px] uppercase tracking-widest" style={{ color: tokens.mutedText }}>
          Accommodation options
        </div>
        {(["classic", "premier", "signature"] as const).map((tier) => {
          if (!visibleTiers[tier]) return null;
          const acc = day.tiers[tier];
          const isActive = activeTier === tier;
          return (
            <div key={tier} className="flex items-start gap-3">
              <span
                className="text-[11px] font-bold uppercase px-2.5 py-1 rounded-full shrink-0 min-w-[72px] text-center"
                style={{
                  background: isActive ? tierColors[tier] : "transparent",
                  color: isActive ? "white" : tierColors[tier],
                  border: `1px solid ${tierColors[tier]}`,
                }}
              >
                {tier}
              </span>
              <div>
                <div
                  className="text-sm font-medium outline-none"
                  style={{ color: tokens.headingText }}
                  contentEditable={isEditor}
                  suppressContentEditableWarning
                >
                  {acc.camp}
                </div>
                <div
                  className="text-xs outline-none"
                  style={{ color: tokens.mutedText }}
                  contentEditable={isEditor}
                  suppressContentEditableWarning
                >
                  {acc.location}{acc.note ? ` · ${acc.note}` : ""}
                </div>
              </div>
            </div>
          );
        })}
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
    <div className="py-16 px-8 md:px-16" style={{ background: tokens.pageBg }}>
      <div className="max-w-5xl mx-auto">
        <div
          className="text-[11px] uppercase tracking-[0.22em] mb-10"
          style={{ color: tokens.mutedText }}
        >
          Day-by-day journey
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={days.map((d) => d.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-6">
              {days.map((day) => (
                <DayCard key={day.id} day={day} variant={section.layoutVariant} />
              ))}
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
