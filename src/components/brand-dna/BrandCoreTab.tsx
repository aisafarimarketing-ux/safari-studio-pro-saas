"use client";

import { useRef, useState } from "react";
import { Field, TextArea, TextInput } from "./Field";
import { uploadImage } from "@/lib/uploadImage";
import { removeLogoBackground } from "@/lib/removeLogoBackground";
import type { BrandDNAForm } from "./types";

// Cleaning state for the "Remove background" flow.
//   - idle:    no cleaned variant yet, button is offered
//   - working: ML model is downloading + processing
//   - review:  cleaned variant ready, side-by-side preview shown
//   - error:   removal failed (CORS, OOM, model fetch); explain to operator
type CleanState =
  | { kind: "idle" }
  | { kind: "working"; pct: number }
  | { kind: "review"; cleanedDataUrl: string }
  | { kind: "error"; message: string };

export function BrandCoreTab({
  form,
  update,
}: {
  form: BrandDNAForm;
  update: (patch: Partial<BrandDNAForm>) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [clean, setClean] = useState<CleanState>({ kind: "idle" });

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    setClean({ kind: "idle" });
    try {
      const url = await uploadImage(file, { maxDimension: 800 });
      update({ logoUrl: url });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleRemoveBackground() {
    if (!form.logoUrl) return;
    setClean({ kind: "working", pct: 0 });
    try {
      const { dataUrl } = await removeLogoBackground(form.logoUrl, (loaded, total) => {
        const pct = total > 0 ? Math.min(99, Math.round((loaded / total) * 100)) : 0;
        setClean((prev) => (prev.kind === "working" ? { kind: "working", pct } : prev));
      });
      setClean({ kind: "review", cleanedDataUrl: dataUrl });
    } catch (err) {
      setClean({
        kind: "error",
        message: err instanceof Error ? err.message : "Background removal failed",
      });
    }
  }

  async function applyCleaned() {
    if (clean.kind !== "review") return;
    setUploading(true);
    setUploadError(null);
    try {
      // Re-upload through the same pipeline so the cleaned PNG ends up
      // on Supabase Storage instead of bloating the proposal JSON as a
      // multi-MB data URL.
      const blob = await (await fetch(clean.cleanedDataUrl)).blob();
      const file = new File([blob], "logo-cleaned.png", { type: "image/png" });
      const url = await uploadImage(file, { maxDimension: 800 });
      update({ logoUrl: url });
      setClean({ kind: "idle" });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Couldn't save cleaned logo");
    } finally {
      setUploading(false);
    }
  }

  function discardCleaned() {
    setClean({ kind: "idle" });
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-black/85 tracking-tight">
          Brand basics
        </h2>
        <p className="mt-1.5 text-[14px] text-black/55 max-w-2xl leading-relaxed">
          Logo, tagline, and a short description. These anchor every proposal
          cover and give the AI an identity to write from.
        </p>
      </div>

      <div className="grid md:grid-cols-[260px_1fr] gap-8">
        {/* Logo uploader */}
        <div>
          <div className="text-[13px] font-medium text-black/70 mb-1.5">Logo</div>

          {clean.kind === "review" ? (
            <BeforeAfterPreview
              originalUrl={form.logoUrl}
              cleanedUrl={clean.cleanedDataUrl}
            />
          ) : (
            <div className="rounded-xl border border-dashed border-black/15 bg-white p-4 flex flex-col items-center justify-center aspect-[4/3] relative overflow-hidden">
              {form.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={form.logoUrl}
                  alt="Brand logo"
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <div className="text-[12px] text-black/35 text-center">
                  PNG, JPG, or SVG<br />
                  Up to 10 MB
                </div>
              )}
              {clean.kind === "working" && (
                <div className="absolute inset-0 bg-white/85 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
                  <div className="text-[12px] text-black/60 font-medium">
                    Removing background…
                  </div>
                  <div className="w-32 h-1 rounded-full bg-black/8 overflow-hidden">
                    <div
                      className="h-full bg-[#1b3a2d] transition-all"
                      style={{ width: `${clean.pct}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-black/40 tabular-nums">
                    {clean.pct}%
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action row — adapts to current state */}
          {clean.kind === "review" ? (
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={applyCleaned}
                disabled={uploading}
                className="flex-1 px-3 py-1.5 rounded-lg text-sm bg-[#1b3a2d] text-white hover:bg-[#2d5a40] transition disabled:opacity-50"
              >
                {uploading ? "Saving…" : "Use cleaned"}
              </button>
              <button
                type="button"
                onClick={discardCleaned}
                disabled={uploading}
                className="px-3 py-1.5 rounded-lg text-sm border border-black/12 text-black/60 hover:bg-black/5 transition disabled:opacity-50"
              >
                Keep original
              </button>
            </div>
          ) : (
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={uploading || clean.kind === "working"}
                className="flex-1 px-3 py-1.5 rounded-lg text-sm border border-black/12 text-black/65 hover:bg-black/5 transition disabled:opacity-50"
              >
                {uploading ? "Uploading…" : form.logoUrl ? "Replace" : "Upload"}
              </button>
              {form.logoUrl && (
                <button
                  type="button"
                  onClick={() => {
                    update({ logoUrl: "" });
                    setClean({ kind: "idle" });
                  }}
                  disabled={clean.kind === "working"}
                  className="px-3 py-1.5 rounded-lg text-sm text-black/45 hover:text-[#b34334] hover:bg-[#b34334]/5 transition disabled:opacity-50"
                >
                  Remove
                </button>
              )}
            </div>
          )}

          {/* Background-removal entry point — only shown when there's a
              logo to clean and we're not mid-flow. */}
          {form.logoUrl && clean.kind === "idle" && (
            <button
              type="button"
              onClick={handleRemoveBackground}
              disabled={uploading}
              className="mt-2 w-full px-3 py-1.5 rounded-lg text-[12px] font-medium text-[#1b3a2d] border border-[#1b3a2d]/20 bg-[#1b3a2d]/5 hover:bg-[#1b3a2d]/10 transition disabled:opacity-50"
            >
              ✨ Remove background
            </button>
          )}

          {clean.kind === "error" && (
            <div className="mt-2 text-[12px] text-[#b34334]">
              {clean.message}{" "}
              <button
                type="button"
                onClick={() => setClean({ kind: "idle" })}
                className="underline hover:no-underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {form.logoUrl && clean.kind === "idle" && (
            <p className="mt-2 text-[11px] leading-relaxed text-black/40">
              Cleans up coloured backgrounds so the logo sits flush on any
              cover photo. Runs in your browser — first use downloads a small
              model (~5MB), then it&apos;s cached.
            </p>
          )}

          {uploadError && (
            <div className="mt-2 text-[12px] text-[#b34334]">{uploadError}</div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </div>

        {/* Core fields */}
        <div className="space-y-5">
          <Field label="Brand name">
            <TextInput
              value={form.brandName}
              onChange={(v) => update({ brandName: v })}
              placeholder="Savanna Horizons Safaris"
            />
          </Field>
          <div className="grid md:grid-cols-2 gap-5">
            <Field label="Website">
              <TextInput
                value={form.websiteUrl}
                onChange={(v) => update({ websiteUrl: v })}
                placeholder="https://savannahorizons.com"
                type="url"
              />
            </Field>
            <Field label="Tagline">
              <TextInput
                value={form.tagline}
                onChange={(v) => update({ tagline: v })}
                placeholder="Crafted safaris across East Africa."
              />
            </Field>
          </div>
          <Field
            label="Short description"
            hint={`${form.shortDescription.length}/280`}
          >
            <TextArea
              value={form.shortDescription}
              onChange={(v) => update({ shortDescription: v })}
              placeholder="Two or three sentences about who you are and who you design trips for."
              rows={4}
              maxLength={280}
            />
          </Field>
        </div>
      </div>
    </div>
  );
}

// ─── Before/after preview ────────────────────────────────────────────────
//
// The cleaned variant is rendered against a checker pattern so transparent
// pixels are unmistakable — without this, a transparent PNG on a white
// preview tile looks identical to the white-bg original and operators have
// no way to verify the removal worked.

function BeforeAfterPreview({
  originalUrl,
  cleanedUrl,
}: {
  originalUrl: string;
  cleanedUrl: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <PreviewCell label="Original" url={originalUrl} />
      <PreviewCell label="Cleaned" url={cleanedUrl} checker />
    </div>
  );
}

function PreviewCell({
  label,
  url,
  checker = false,
}: {
  label: string;
  url: string;
  checker?: boolean;
}) {
  const checkerBg = checker
    ? {
        backgroundImage:
          "linear-gradient(45deg, rgba(0,0,0,0.06) 25%, transparent 25%), linear-gradient(-45deg, rgba(0,0,0,0.06) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(0,0,0,0.06) 75%), linear-gradient(-45deg, transparent 75%, rgba(0,0,0,0.06) 75%)",
        backgroundSize: "12px 12px",
        backgroundPosition: "0 0, 0 6px, 6px -6px, -6px 0",
      }
    : undefined;
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-black/40 mb-1 font-medium">
        {label}
      </div>
      <div
        className="rounded-lg border border-black/10 bg-white p-3 flex items-center justify-center aspect-square overflow-hidden"
        style={checkerBg}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={label}
          className="max-h-full max-w-full object-contain"
        />
      </div>
    </div>
  );
}
