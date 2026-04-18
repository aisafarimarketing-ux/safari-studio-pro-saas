"use client";

import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { CustomSectionItem } from "./types";

// Per-property extra rich sections (Children's program, Wine list,
// Conservation work, etc.). Drag to reorder, eye icon to hide-from-client,
// trash to delete. Default-visible.

export function CustomSectionsEditor({
  sections,
  onChange,
}: {
  sections: CustomSectionItem[];
  onChange: (next: CustomSectionItem[]) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function add() {
    onChange([
      ...sections,
      { title: "New section", body: "", visible: true, order: sections.length },
    ]);
  }

  function update(idx: number, patch: Partial<CustomSectionItem>) {
    onChange(sections.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }

  function remove(idx: number) {
    onChange(reorder(sections.filter((_, i) => i !== idx)));
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const fromIdx = sections.findIndex((s) => keyOf(s) === active.id);
    const toIdx = sections.findIndex((s) => keyOf(s) === over.id);
    if (fromIdx < 0 || toIdx < 0) return;
    onChange(reorder(arrayMove(sections, fromIdx, toIdx)));
  }

  return (
    <div>
      {sections.length === 0 ? (
        <p className="text-[13px] text-black/45 mb-3">
          No custom sections yet.
        </p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sections.map(keyOf)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3 mb-3">
              {sections.map((s, i) => (
                <SortableSection
                  key={keyOf(s)}
                  section={s}
                  onPatch={(p) => update(i, p)}
                  onRemove={() => remove(i)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <button
        type="button"
        onClick={add}
        className="w-full px-4 py-2.5 rounded-xl border-2 border-dashed border-black/15 text-sm text-black/50 hover:bg-black/[0.03] hover:text-black/70 hover:border-black/25 transition"
      >
        + Add custom section
      </button>
    </div>
  );
}

function reorder(items: CustomSectionItem[]): CustomSectionItem[] {
  return items.map((s, i) => ({ ...s, order: i }));
}

function keyOf(s: CustomSectionItem): string {
  return s.id ?? `new:${s.order}:${s.title}`;
}

function SortableSection({
  section,
  onPatch,
  onRemove,
}: {
  section: CustomSectionItem;
  onPatch: (p: Partial<CustomSectionItem>) => void;
  onRemove: () => void;
}) {
  const id = keyOf(section);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-xl border bg-white overflow-hidden ${
        section.visible ? "border-black/10" : "border-black/8 bg-black/[0.02]"
      }`}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-black/8">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="text-black/30 hover:text-black/60 cursor-grab active:cursor-grabbing px-1"
          aria-label="Drag to reorder"
          title="Drag to reorder"
        >
          ⋮⋮
        </button>
        <input
          type="text"
          value={section.title}
          onChange={(e) => onPatch({ title: e.target.value })}
          placeholder="Section title"
          className="flex-1 px-2 py-1 text-sm font-medium text-black/85 bg-transparent outline-none"
        />
        <button
          type="button"
          onClick={() => onPatch({ visible: !section.visible })}
          className={`px-2 py-1 rounded-md text-[11px] font-medium transition ${
            section.visible
              ? "bg-[#1b3a2d]/[0.08] text-[#1b3a2d]"
              : "bg-black/[0.05] text-black/45"
          }`}
          title={section.visible ? "Visible to clients" : "Hidden from clients"}
        >
          {section.visible ? "Visible" : "Hidden"}
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="text-black/30 hover:text-[#b34334] text-base leading-none px-1"
          aria-label="Delete section"
          title="Delete"
        >
          ×
        </button>
      </div>
      <textarea
        value={section.body ?? ""}
        onChange={(e) => onPatch({ body: e.target.value })}
        rows={4}
        placeholder="Section content…"
        className="w-full px-3 py-2 text-sm text-black/80 bg-transparent outline-none resize-y placeholder:text-black/30"
      />
    </div>
  );
}
