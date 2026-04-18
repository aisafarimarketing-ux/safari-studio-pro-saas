"use client";

import { useRef, useState } from "react";
import { Field, TextArea, TextInput } from "./Field";
import { fileToOptimizedDataUrl } from "@/lib/fileToDataUrl";
import type { BrandDNAForm } from "./types";

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

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const url = await fileToOptimizedDataUrl(file, { maxDimension: 800 });
      update({ logoUrl: url });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
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

      <div className="grid md:grid-cols-[220px_1fr] gap-8">
        {/* Logo uploader */}
        <div>
          <div className="text-[13px] font-medium text-black/70 mb-1.5">Logo</div>
          <div className="rounded-xl border border-dashed border-black/15 bg-white p-4 flex flex-col items-center justify-center aspect-[4/3]">
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
          </div>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="flex-1 px-3 py-1.5 rounded-lg text-sm border border-black/12 text-black/65 hover:bg-black/5 transition disabled:opacity-50"
            >
              {uploading ? "Uploading…" : form.logoUrl ? "Replace" : "Upload"}
            </button>
            {form.logoUrl && (
              <button
                type="button"
                onClick={() => update({ logoUrl: "" })}
                className="px-3 py-1.5 rounded-lg text-sm text-black/45 hover:text-[#b34334] hover:bg-[#b34334]/5 transition"
              >
                Remove
              </button>
            )}
          </div>
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
