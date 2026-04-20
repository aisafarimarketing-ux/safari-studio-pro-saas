"use client";

import { useRef, useState } from "react";
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
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { uploadImage } from "@/lib/uploadImage";
import type { ImageItem } from "./types";

const MAX_IMAGES = 24;

// Photo manager: upload, drag-reorder, set-as-cover, delete.
// Uses dnd-kit (already in deps) for drag handling. Cover state is
// mutually exclusive — exactly one image is the cover at a time, and
// "set as cover" also moves it to position 0 so it leads the gallery.

export function PhotosSection({
  images,
  onChange,
}: {
  images: ImageItem[];
  onChange: (next: ImageItem[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadError(null);
    const added: ImageItem[] = [];
    try {
      for (const file of Array.from(files)) {
        if (images.length + added.length >= MAX_IMAGES) break;
        const url = await uploadImage(file, { maxDimension: 2200 });
        added.push({
          url,
          caption: null,
          order: images.length + added.length,
          // First-ever image becomes the cover by default.
          isCover: images.length + added.length === 0,
        });
      }
      onChange([...images, ...added]);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function setCover(idx: number) {
    // Move the chosen image to the front and mark it cover; clear all others.
    const next = images.map((img, i) => ({ ...img, isCover: i === idx }));
    if (idx > 0) {
      const [moved] = next.splice(idx, 1);
      next.unshift(moved);
    }
    onChange(reorder(next));
  }

  function removeImage(idx: number) {
    const wasCover = images[idx]?.isCover;
    const next = images.filter((_, i) => i !== idx);
    if (wasCover && next.length > 0) next[0].isCover = true;
    onChange(reorder(next));
  }

  function updateCaption(idx: number, caption: string) {
    const next = images.map((img, i) => (i === idx ? { ...img, caption } : img));
    onChange(next);
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const fromIdx = images.findIndex((img) => keyOf(img) === active.id);
    const toIdx = images.findIndex((img) => keyOf(img) === over.id);
    if (fromIdx < 0 || toIdx < 0) return;
    onChange(reorder(arrayMove(images, fromIdx, toIdx)));
  }

  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <h3 className="text-[15px] font-semibold text-black/85">Photos</h3>
          <p className="text-[12px] text-black/45 mt-0.5">
            Drag to reorder. Click the star to set as cover.
          </p>
        </div>
        <span className="text-[11px] text-black/35">
          {images.length}/{MAX_IMAGES}
        </span>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={images.map(keyOf)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {images.map((img, i) => (
              <SortableImage
                key={keyOf(img)}
                image={img}
                onSetCover={() => setCover(i)}
                onRemove={() => removeImage(i)}
                onCaption={(c) => updateCaption(i, c)}
              />
            ))}
            {images.length < MAX_IMAGES && (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className="aspect-[4/3] rounded-xl border-2 border-dashed border-black/15 text-sm text-black/40 hover:bg-black/[0.03] hover:text-black/70 hover:border-black/25 transition disabled:opacity-50 flex items-center justify-center"
              >
                {uploading ? "Uploading…" : "+ Add photos"}
              </button>
            )}
          </div>
        </SortableContext>
      </DndContext>

      {uploadError && <div className="mt-2 text-[12px] text-[#b34334]">{uploadError}</div>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}

function reorder(items: ImageItem[]): ImageItem[] {
  return items.map((img, i) => ({ ...img, order: i }));
}

function keyOf(img: ImageItem): string {
  return img.id ?? `new:${img.url.slice(-32)}:${img.order}`;
}

function SortableImage({
  image,
  onSetCover,
  onRemove,
  onCaption,
}: {
  image: ImageItem;
  onSetCover: () => void;
  onRemove: () => void;
  onCaption: (c: string) => void;
}) {
  const id = keyOf(image);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative aspect-[4/3] rounded-xl overflow-hidden bg-black/5 border border-black/8"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image.url}
        alt={image.caption ?? ""}
        className="absolute inset-0 w-full h-full object-cover"
        {...attributes}
        {...listeners}
      />

      {/* Cover badge */}
      {image.isCover && (
        <div className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-full bg-[#c9a84c] text-[#1b3a2d] text-[10px] font-bold uppercase tracking-wider">
          Cover
        </div>
      )}

      {/* Hover toolbar */}
      <div className="absolute top-1.5 right-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
        {!image.isCover && (
          <button
            type="button"
            onClick={onSetCover}
            className="w-7 h-7 rounded-full bg-black/55 hover:bg-black/75 text-white text-sm flex items-center justify-center"
            title="Set as cover"
            aria-label="Set as cover"
          >
            ★
          </button>
        )}
        <button
          type="button"
          onClick={onRemove}
          className="w-7 h-7 rounded-full bg-black/55 hover:bg-[#b34334] text-white text-sm flex items-center justify-center"
          title="Remove"
          aria-label="Remove"
        >
          ×
        </button>
      </div>

      {/* Caption (always editable, hidden until hover for clean grid) */}
      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition">
        <input
          type="text"
          value={image.caption ?? ""}
          onChange={(e) => onCaption(e.target.value)}
          placeholder="Caption (optional)"
          className="w-full px-2 py-1 text-[12px] rounded bg-black/55 text-white placeholder:text-white/50 outline-none border border-white/15"
          onPointerDown={(e) => e.stopPropagation()}
        />
      </div>
    </div>
  );
}
