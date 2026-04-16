"use client";

import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import { resolveTokens } from "@/lib/theme";
import type { Section } from "@/lib/types";

export function GallerySection({ section }: { section: Section }) {
  const { proposal, updateSectionContent } = useProposalStore();
  const { mode } = useEditorStore();
  const isEditor = mode === "editor";
  const { theme } = proposal;
  const tokens = resolveTokens(theme.tokens, section.styleOverrides);

  const cols = section.layoutVariant === "2-column" ? 2 : section.layoutVariant === "4-column" ? 4 : 3;
  const images = (section.content.images as string[]) ?? [];

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const urls = files.map((f) => URL.createObjectURL(f));
    updateSectionContent(section.id, { images: [...images, ...urls] });
  };

  const removeImage = (idx: number) => {
    const updated = images.filter((_, i) => i !== idx);
    updateSectionContent(section.id, { images: updated });
  };

  return (
    <div className="py-12 px-8 md:px-16" style={{ background: tokens.sectionSurface }}>
      <div className="max-w-5xl mx-auto">
        <div
          className={`grid gap-3`}
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {images.map((url, i) => (
            <div key={i} className="relative aspect-[4/3] rounded-xl overflow-hidden group">
              <img src={url} alt="" className="w-full h-full object-cover" />
              {isEditor && (
                <button
                  onClick={() => removeImage(i)}
                  className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 text-white text-xs opacity-0 group-hover:opacity-100 transition"
                >
                  ×
                </button>
              )}
            </div>
          ))}

          {isEditor && (
            <label className="aspect-[4/3] rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer hover:opacity-80 transition"
              style={{ borderColor: tokens.border }}>
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
              <div className="text-2xl opacity-30">+</div>
              <div className="text-xs mt-1 opacity-40">Add images</div>
            </label>
          )}
        </div>
      </div>
    </div>
  );
}
