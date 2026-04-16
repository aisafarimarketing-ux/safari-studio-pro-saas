"use client";

import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import type { Property, Section, ThemeTokens, ProposalTheme } from "@/lib/types";

function PropertyCard({ property, variant }: { property: Property; variant: string }) {
  const { proposal, updateProperty, removeProperty } = useProposalStore();
  const { mode, selectProperty, selectedPropertyId } = useEditorStore();
  const isEditor = mode === "editor";
  const { theme } = proposal;
  const tokens = theme.tokens;
  const isSelected = selectedPropertyId === property.id;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: property.id });

  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };

  const handleLeadImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) updateProperty(property.id, { leadImageUrl: URL.createObjectURL(file) });
  };

  const isLargeImage = variant === "large-image-detail-block";

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, borderColor: tokens.border, background: tokens.sectionSurface }}
      onClick={() => isEditor && selectProperty(property.id)}
      className={`rounded-2xl overflow-hidden border transition ${isSelected ? "ring-2 ring-offset-2" : ""}`}
    >
      {isEditor && (
        <div className="absolute top-3 right-3 z-10 flex gap-1">
          <button {...attributes} {...listeners} className="w-7 h-7 rounded-md bg-black/30 text-white/70 text-xs flex items-center justify-center cursor-grab hover:bg-black/50 transition" title="Drag">⠿</button>
          <button onClick={(e) => { e.stopPropagation(); removeProperty(property.id); }} className="w-7 h-7 rounded-md bg-black/30 text-white/70 text-xs flex items-center justify-center hover:bg-red-500/80 transition" title="Remove">×</button>
        </div>
      )}

      {isLargeImage ? (
        <div>
          {/* Large image */}
          <div className="relative w-full h-64 bg-[#e8e2d7]">
            {property.leadImageUrl ? (
              <img src={property.leadImageUrl} alt={property.name} className="w-full h-full object-cover" />
            ) : isEditor ? (
              <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer hover:bg-black/5 transition">
                <input type="file" accept="image/*" className="hidden" onChange={handleLeadImage} />
                <div className="text-3xl opacity-30 mb-1">+</div>
                <div className="text-sm opacity-40">Add photo</div>
              </label>
            ) : null}
          </div>
          <div className="p-8" style={{ background: tokens.sectionSurface }}>
            <PropertyDetails property={property} isEditor={isEditor} tokens={tokens} theme={theme} updateProperty={updateProperty} />
          </div>
        </div>
      ) : (
        // image-left-details-right
        <div className="grid md:grid-cols-[40%_60%]">
          <div className="relative min-h-[260px] bg-[#e8e2d7]">
            {property.leadImageUrl ? (
              <img src={property.leadImageUrl} alt={property.name} className="w-full h-full object-cover absolute inset-0" />
            ) : isEditor ? (
              <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer hover:bg-black/5 transition">
                <input type="file" accept="image/*" className="hidden" onChange={handleLeadImage} />
                <div className="text-3xl opacity-30 mb-1">+</div>
                <div className="text-sm opacity-40">Add photo</div>
              </label>
            ) : null}
          </div>
          <div className="p-8 md:p-10" style={{ background: tokens.sectionSurface }}>
            <PropertyDetails property={property} isEditor={isEditor} tokens={tokens} theme={theme} updateProperty={updateProperty} />
          </div>
        </div>
      )}
    </div>
  );
}

function PropertyDetails({ property, isEditor, tokens, theme, updateProperty }: {
  property: Property;
  isEditor: boolean;
  tokens: ThemeTokens;
  theme: ProposalTheme;
  updateProperty: (id: string, patch: Partial<Property>) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3
          className="text-2xl font-bold outline-none"
          style={{ color: tokens.headingText, fontFamily: `'${theme.displayFont}', serif` }}
          contentEditable={isEditor}
          suppressContentEditableWarning
          onBlur={(e) => updateProperty(property.id, { name: e.currentTarget.textContent ?? property.name })}
        >
          {property.name}
        </h3>
        <div
          className="text-sm mt-0.5 outline-none"
          style={{ color: tokens.mutedText }}
          contentEditable={isEditor}
          suppressContentEditableWarning
          onBlur={(e) => updateProperty(property.id, { location: e.currentTarget.textContent ?? property.location })}
        >
          {property.location}
        </div>
      </div>

      <p
        className="text-sm leading-relaxed outline-none"
        style={{ color: tokens.bodyText, fontFamily: `'${theme.bodyFont}', sans-serif` }}
        contentEditable={isEditor}
        suppressContentEditableWarning
        onBlur={(e) => updateProperty(property.id, { description: e.currentTarget.textContent ?? property.description })}
      >
        {property.description}
      </p>

      {property.whyWeChoseThis && (
        <div className="pt-3 border-t" style={{ borderColor: tokens.border }}>
          <div className="text-[10px] uppercase tracking-widest mb-1.5" style={{ color: tokens.accent }}>
            Why we chose this
          </div>
          <p
            className="text-sm leading-relaxed outline-none italic"
            style={{ color: tokens.bodyText }}
            contentEditable={isEditor}
            suppressContentEditableWarning
            onBlur={(e) => updateProperty(property.id, { whyWeChoseThis: e.currentTarget.textContent ?? property.whyWeChoseThis })}
          >
            {property.whyWeChoseThis}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 pt-2">
        {[
          { label: "Meal plan", value: property.mealPlan },
          { label: "Room type", value: property.roomType },
          { label: "Nights", value: `${property.nights} nights` },
        ].map((item) => item.value ? (
          <div key={item.label}>
            <div className="text-[10px] uppercase tracking-widest" style={{ color: tokens.mutedText }}>{item.label}</div>
            <div className="text-sm font-medium mt-0.5" style={{ color: tokens.headingText }}>{item.value}</div>
          </div>
        ) : null)}
      </div>

      {property.amenities.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {property.amenities.map((a) => (
            <span key={a} className="text-xs px-2.5 py-1 rounded-full" style={{ background: tokens.cardBg, color: tokens.bodyText }}>
              {a}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function PropertyShowcaseSection({ section }: { section: Section }) {
  const { proposal, moveProperty, addProperty } = useProposalStore();
  const { mode } = useEditorStore();
  const isEditor = mode === "editor";
  const { properties, theme } = proposal;
  const tokens = theme.tokens;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIdx = properties.findIndex((p) => p.id === active.id);
    const toIdx = properties.findIndex((p) => p.id === over.id);
    if (fromIdx !== -1 && toIdx !== -1) moveProperty(fromIdx, toIdx);
  };

  return (
    <div className="py-16 px-8 md:px-16" style={{ background: tokens.pageBg }}>
      <div className="max-w-5xl mx-auto">
        <div className="text-[11px] uppercase tracking-[0.22em] mb-10" style={{ color: tokens.mutedText }}>
          Your properties
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={properties.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-6">
              {properties.map((property) => (
                <div className="relative" key={property.id}>
                  <PropertyCard property={property} variant={section.layoutVariant} />
                </div>
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {properties.length === 0 && (
          <div className="text-center py-16 rounded-2xl border-2 border-dashed" style={{ borderColor: tokens.border, color: tokens.mutedText }}>
            No properties yet.
          </div>
        )}

        {isEditor && (
          <button
            onClick={addProperty}
            className="mt-6 w-full py-4 rounded-2xl border-2 border-dashed text-sm font-medium transition hover:opacity-80"
            style={{ borderColor: tokens.accent, color: tokens.accent }}
          >
            + Add property
          </button>
        )}
      </div>
    </div>
  );
}
