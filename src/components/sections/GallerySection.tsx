"use client";

import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import { resolveTokens } from "@/lib/theme";
import { uploadImage } from "@/lib/uploadImage";
import type { Section } from "@/lib/types";

export function GallerySection({ section }: { section: Section }) {
  const { proposal, updateSectionContent } = useProposalStore();
  const { mode } = useEditorStore();
  const isEditor = mode === "editor";
  const { theme } = proposal;
  const tokens = resolveTokens(theme.tokens, section.styleOverrides);

  const variant = section.layoutVariant;
  const images = (section.content.images as string[]) ?? [];

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    try {
      const urls = await Promise.all(files.map((f) => uploadImage(f)));
      updateSectionContent(section.id, { images: [...images, ...urls] });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Image upload failed");
    }
  };

  const removeImage = (idx: number) => {
    const updated = images.filter((_, i) => i !== idx);
    updateSectionContent(section.id, { images: updated });
  };

  // ── Editorial Mosaic — Are.na / Frank Ocean asymmetric grid. The first
  //    image gets a wide span; the rest cycle through a tasteful pattern of
  //    spans to feel curated rather than uniform.
  if (variant === "editorial-mosaic") {
    // Span pattern repeats every 6 images; the first image is the hero.
    // Each tuple is (colSpan, rowSpan).
    const PATTERN: Array<[number, number]> = [
      [4, 2], // hero
      [2, 1],
      [2, 1],
      [2, 1],
      [2, 1],
      [3, 1],
      [3, 1],
    ];
    return (
      <div className="py-2 md:py-3" style={{ background: tokens.pageBg }}>
        <div className="ed-wide">
          <div
            className="text-[10px] uppercase tracking-[0.32em] mb-8"
            style={{ color: tokens.mutedText, fontFamily: `'${theme.bodyFont}', sans-serif` }}
          >
            Plates from the road
          </div>

          {images.length === 0 && !isEditor && (
            <div
              className="text-center py-16 text-small"
              style={{ color: tokens.mutedText }}
            >
              No images yet.
            </div>
          )}

          <div
            className="grid gap-3 md:gap-4"
            style={{
              gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
              gridAutoRows: "120px",
            }}
          >
            {images.map((url, i) => {
              const [colSpan, rowSpan] = PATTERN[i % PATTERN.length];
              return (
                <div
                  key={i}
                  className="relative overflow-hidden rounded-md group"
                  style={{
                    gridColumn: `span ${colSpan} / span ${colSpan}`,
                    gridRow: `span ${rowSpan} / span ${rowSpan}`,
                    background: tokens.cardBg,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  {isEditor && (
                    <button
                      onClick={() => removeImage(i)}
                      className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 text-white text-xs opacity-0 group-hover:opacity-100 transition"
                      title="Remove"
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}

            {isEditor && (
              <label
                className="relative flex flex-col items-center justify-center cursor-pointer rounded-md border-2 border-dashed transition hover:opacity-80"
                style={{
                  borderColor: tokens.border,
                  background: tokens.cardBg,
                  gridColumn: "span 2 / span 2",
                  gridRow: "span 1 / span 1",
                }}
              >
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
                <div className="text-2xl opacity-30">+</div>
                <div className="text-xs mt-1 opacity-50">Add images</div>
              </label>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Column variants (2 / 3 / 4) ─────────────────────────────────────────
  const cols = variant === "2-column" ? 2 : variant === "4-column" ? 4 : 3;

  return (
    <div className="py-12 px-8 md:px-16" style={{ background: tokens.sectionSurface }}>
      <div className="max-w-5xl mx-auto">
        <div
          className={`grid gap-3`}
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {images.map((url, i) => (
            <div key={i} className="relative aspect-[4/3] rounded-xl overflow-hidden group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
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
