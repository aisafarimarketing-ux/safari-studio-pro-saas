"use client";

import { useEffect, useRef, useState } from "react";
import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import { ProposalCanvas } from "@/components/editor/ProposalCanvas";
import { buildProposalFromTemplate } from "@/lib/templates";
import { uploadImage } from "@/lib/uploadImage";
import type { Template } from "@/lib/templates/types";

// ─── TemplateRenderer ──────────────────────────────────────────────────────
//
// Client-side entry point for a public template page. Builds a Proposal
// from the given Template (preview mode — example client populated, demo
// operator block), hydrates the proposal store, pins the editor into
// preview mode, and renders the real ProposalCanvas.
//
// Operator affordance: an optional "Your photos" strip above the preview
// lets a visitor drop in their own brand images. On every change we
// rebuild the proposal with the new image pool — so cover hero, every
// day card, every property carousel adopts their photos live. Mirrors
// /demo's uploader; same component patterns.

const MAX_USER_IMAGES = 12;

export function TemplateRenderer({ template }: { template: Template }) {
  const [userImages, setUserImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [ready, setReady] = useState(false);

  // Pin preview mode + rebuild the store whenever the template or the
  // image pool changes. Running on every userImages change keeps the
  // live-branding demo feeling instant.
  useEffect(() => {
    const prevMode = useEditorStore.getState().mode;
    useEditorStore.getState().setMode("preview");
    const proposal = buildProposalFromTemplate(template, {
      mode: "preview",
      userImages,
    });
    useProposalStore.getState().hydrateProposal(proposal);
    setReady(true);
    return () => {
      useEditorStore.getState().setMode(prevMode);
    };
  }, [template, userImages]);

  const handleAddImages = async (files: FileList | File[]) => {
    const pending = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, MAX_USER_IMAGES - userImages.length);
    if (pending.length === 0) return;
    setUploading(true);
    try {
      const dataUrls: string[] = [];
      for (const file of pending) {
        try {
          const url = await uploadImage(file, { maxDimension: 1600, quality: 0.82 });
          dataUrls.push(url);
        } catch (err) {
          console.warn("[TemplateRenderer] image rejected:", err);
        }
      }
      if (dataUrls.length > 0) {
        setUserImages((prev) => [...prev, ...dataUrls].slice(0, MAX_USER_IMAGES));
      }
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = (index: number) => {
    setUserImages((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <>
      <BrandImageStrip
        images={userImages}
        uploading={uploading}
        onAddImages={handleAddImages}
        onRemove={handleRemoveImage}
      />

      {!ready ? (
        <div className="h-[50vh] flex items-center justify-center text-black/45">
          <div className="text-sm">Loading template…</div>
        </div>
      ) : (
        <div className="proposal-canvas">
          <ProposalCanvas />
        </div>
      )}
    </>
  );
}

// ─── Optional brand-image strip ────────────────────────────────────────────
//
// Calm, collapsible strip above the preview. Encourages but never demands
// — the template renders perfectly without any uploads.

function BrandImageStrip({
  images,
  uploading,
  onAddImages,
  onRemove,
}: {
  images: string[];
  uploading: boolean;
  onAddImages: (files: FileList | File[]) => void;
  onRemove: (idx: number) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const atCap = images.length >= MAX_USER_IMAGES;

  const active = images.length > 0 || expanded;

  return (
    <section
      className="border-b"
      style={{
        background: active ? "rgba(201,168,76,0.04)" : "white",
        borderColor: "rgba(0,0,0,0.06)",
      }}
    >
      <div className="max-w-5xl mx-auto px-6 py-4">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-baseline justify-between gap-3 w-full text-left group"
        >
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] font-semibold" style={{ color: "#1b3a2d" }}>
              Use your photos
            </div>
            <div className="text-[13px] text-black/55 mt-0.5">
              {images.length > 0
                ? `${images.length} of ${MAX_USER_IMAGES} — the preview below is using your brand`
                : "Optional · drop lodge + destination photos to replace the stock imagery below"}
            </div>
          </div>
          <div className="text-[11px] text-black/40 group-hover:text-black/65 transition shrink-0">
            {active ? "Hide" : "Open"} {active ? "▲" : "▼"}
          </div>
        </button>

        {active && (
          <div className="mt-4 space-y-3">
            {images.length > 0 && (
              <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
                {images.map((src, i) => (
                  <div
                    key={`${i}-${src.slice(0, 24)}`}
                    className="relative aspect-[4/3] rounded-md overflow-hidden border bg-black/5 group/thumb"
                    style={{ borderColor: "rgba(0,0,0,0.08)" }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => onRemove(i)}
                      aria-label="Remove image"
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-[10px] leading-none opacity-0 group-hover/thumb:opacity-100 hover:bg-black/80 transition"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {!atCap && (
              <div
                role="button"
                tabIndex={0}
                onClick={() => inputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  if (e.dataTransfer.files?.length) onAddImages(e.dataTransfer.files);
                }}
                className={`rounded-lg border-2 border-dashed px-4 py-4 text-center cursor-pointer transition ${
                  dragOver
                    ? "bg-[rgba(201,168,76,0.1)] border-[#c9a84c]"
                    : "bg-white border-black/10 hover:border-black/25"
                }`}
              >
                <div className="text-[13px] text-black/60">
                  {uploading ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="w-3.5 h-3.5 rounded-full border-2 border-black/20 border-t-[#1b3a2d] animate-spin" />
                      Processing…
                    </span>
                  ) : (
                    <>
                      <span className="font-medium text-black/75">Drop photos here</span>
                      <span className="text-black/40"> · or click to choose · JPG / PNG / WebP · resized for you</span>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) onAddImages(e.target.files);
            e.currentTarget.value = "";
          }}
        />
      </div>
    </section>
  );
}
