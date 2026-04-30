"use client";

import { useRef, useState } from "react";
import { CURATED_FONTS, IMAGE_STYLES, type BrandColor, type BrandImage } from "@/lib/brandDNA";
import { Chip, Field, TextInput } from "./Field";
import { uploadImage } from "@/lib/uploadImage";
import type { BrandDNAForm } from "./types";

const COLOR_ROLES = ["primary", "secondary", "accent", "text", "background"] as const;
const MAX_COLORS = 5;
const MAX_IMAGES = 20;

export function VisualStyleTab({
  form,
  update,
}: {
  form: BrandDNAForm;
  update: (patch: Partial<BrandDNAForm>) => void;
}) {
  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-lg font-semibold text-black/85 tracking-tight">
          Visual style
        </h2>
        <p className="mt-1.5 text-[14px] text-black/55 max-w-2xl leading-relaxed">
          Colours, fonts, and the kind of photography you lean on. Every
          section is optional — partial answers still help.
        </p>
      </div>

      <ColorsSection form={form} update={update} />
      <FontsSection form={form} update={update} />
      <ImageStylesSection form={form} update={update} />
      <ImageLibrarySection form={form} update={update} />
    </div>
  );
}

// ─── Colors ─────────────────────────────────────────────────────────────────

function ColorsSection({
  form,
  update,
}: {
  form: BrandDNAForm;
  update: (patch: Partial<BrandDNAForm>) => void;
}) {
  const addColor = () => {
    if (form.brandColors.length >= MAX_COLORS) return;
    update({
      brandColors: [...form.brandColors, { hex: "#1b3a2d", role: "primary" }],
    });
  };
  const updateColor = (i: number, patch: Partial<BrandColor>) => {
    const next = form.brandColors.map((c, idx) => (idx === i ? { ...c, ...patch } : c));
    update({ brandColors: next });
  };
  const removeColor = (i: number) => {
    update({ brandColors: form.brandColors.filter((_, idx) => idx !== i) });
  };

  return (
    <section>
      <SectionHeading>Brand colours</SectionHeading>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {form.brandColors.map((c, i) => (
          <div
            key={i}
            className="flex items-center gap-3 p-3 rounded-xl border border-black/8 bg-white"
          >
            <label className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-black/10 cursor-pointer">
              <div className="absolute inset-0" style={{ background: c.hex }} />
              <input
                type="color"
                value={c.hex}
                onChange={(e) => updateColor(i, { hex: e.target.value })}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </label>
            <div className="flex-1 min-w-0">
              <input
                type="text"
                value={c.hex}
                onChange={(e) => updateColor(i, { hex: e.target.value })}
                className="w-full text-[13px] font-mono text-black/70 bg-transparent outline-none"
              />
              <select
                value={c.role ?? ""}
                onChange={(e) => updateColor(i, { role: e.target.value || undefined })}
                className="mt-0.5 text-[11px] text-black/50 bg-transparent outline-none -ml-0.5"
              >
                <option value="">No role</option>
                {COLOR_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => removeColor(i)}
              className="text-black/30 hover:text-[#b34334] text-lg leading-none shrink-0"
              aria-label="Remove colour"
            >
              ×
            </button>
          </div>
        ))}
        {form.brandColors.length < MAX_COLORS && (
          <button
            type="button"
            onClick={addColor}
            className="p-3 rounded-xl border border-dashed border-black/15 text-sm text-black/50 hover:bg-black/5 hover:text-black/70 transition"
          >
            + Add colour
          </button>
        )}
      </div>
    </section>
  );
}

// ─── Fonts ──────────────────────────────────────────────────────────────────

function FontsSection({
  form,
  update,
}: {
  form: BrandDNAForm;
  update: (patch: Partial<BrandDNAForm>) => void;
}) {
  const serifs = CURATED_FONTS.filter((f) => f.family === "serif" || f.family === "display");
  const sans = CURATED_FONTS.filter((f) => f.family === "sans");
  return (
    <section>
      <SectionHeading>Typography</SectionHeading>
      <div className="grid md:grid-cols-2 gap-5">
        <Field label="Heading font">
          <FontSelect
            value={form.headingFont}
            options={[...serifs, ...sans]}
            onChange={(v) => update({ headingFont: v })}
            preview="The Anderson Family Safari"
            previewStyle={{ fontSize: "22px", fontWeight: 600 }}
          />
        </Field>
        <Field label="Body font">
          <FontSelect
            value={form.bodyFont}
            options={[...sans, ...serifs]}
            onChange={(v) => update({ bodyFont: v })}
            preview="Seven nights across the Masai Mara and Amboseli."
            previewStyle={{ fontSize: "14px" }}
          />
        </Field>
      </div>
      <div className="mt-4">
        <Field label="Custom font URL (optional)" hint=".woff / .woff2">
          <TextInput
            value={form.customFontUrl}
            onChange={(v) => update({ customFontUrl: v })}
            placeholder="https://cdn.example.com/fonts/BrandFont.woff2"
            type="url"
          />
        </Field>
      </div>
    </section>
  );
}

function FontSelect({
  value,
  options,
  onChange,
  preview,
  previewStyle,
}: {
  value: string;
  options: { name: string; css: string }[];
  onChange: (v: string) => void;
  preview: string;
  previewStyle: React.CSSProperties;
}) {
  const found = options.find((o) => o.name === value);
  return (
    <div className="rounded-lg border border-black/12 bg-white overflow-hidden">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 text-sm text-black/80 bg-white outline-none border-b border-black/8"
      >
        <option value="">— Select a font —</option>
        {options.map((o) => (
          <option key={o.name} value={o.name}>
            {o.name}
          </option>
        ))}
      </select>
      <div
        className="px-3 py-3 text-black/70"
        style={{ fontFamily: found?.css ?? "system-ui", ...previewStyle }}
      >
        {preview}
      </div>
    </div>
  );
}

// ─── Image style preferences ────────────────────────────────────────────────

function ImageStylesSection({
  form,
  update,
}: {
  form: BrandDNAForm;
  update: (patch: Partial<BrandDNAForm>) => void;
}) {
  const toggle = (id: string) => {
    const has = form.preferredImageStyles.includes(id);
    update({
      preferredImageStyles: has
        ? form.preferredImageStyles.filter((x) => x !== id)
        : [...form.preferredImageStyles, id],
    });
  };

  return (
    <section>
      <SectionHeading hint="What you like to see in your proposals">
        Preferred photography
      </SectionHeading>
      <div className="flex flex-wrap gap-2">
        {IMAGE_STYLES.map((s) => (
          <Chip
            key={s.id}
            active={form.preferredImageStyles.includes(s.id)}
            onClick={() => toggle(s.id)}
          >
            {s.label}
          </Chip>
        ))}
      </div>
    </section>
  );
}

// ─── Image library ──────────────────────────────────────────────────────────

function ImageLibrarySection({
  form,
  update,
}: {
  form: BrandDNAForm;
  update: (patch: Partial<BrandDNAForm>) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadError(null);
    const added: BrandImage[] = [];
    try {
      for (const file of Array.from(files)) {
        if (form.imageLibrary.length + added.length >= MAX_IMAGES) break;
        const url = await uploadImage(file, { maxDimension: 2000 });
        added.push({ url });
      }
      update({ imageLibrary: [...form.imageLibrary, ...added] });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const remove = (i: number) => {
    update({ imageLibrary: form.imageLibrary.filter((_, idx) => idx !== i) });
  };

  const setLocations = (i: number, locations: string[]) => {
    update({
      imageLibrary: form.imageLibrary.map((img, idx) =>
        idx === i ? { ...img, locations } : img,
      ),
    });
  };

  return (
    <section>
      <SectionHeading
        hint={`${form.imageLibrary.length}/${MAX_IMAGES}`}
      >
        Image library
      </SectionHeading>
      <p className="text-[13px] text-black/50 mb-3 -mt-2 max-w-xl">
        Drop in your best photography — camps, wildlife, people. Tag each
        with the destinations it represents (Tarangire, Serengeti, Zanzibar
        …) and the app will auto-pick it as the day&apos;s hero on every
        new proposal that visits that destination.
      </p>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {form.imageLibrary.map((img, i) => (
          <ImageCard
            key={i}
            image={img}
            onRemove={() => remove(i)}
            onLocationsChange={(locs) => setLocations(i, locs)}
          />
        ))}
        {form.imageLibrary.length < MAX_IMAGES && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="aspect-[4/3] rounded-lg border border-dashed border-black/15 text-sm text-black/45 hover:bg-black/5 hover:text-black/70 transition disabled:opacity-50 flex items-center justify-center"
          >
            {uploading ? "…" : "+ Add"}
          </button>
        )}
      </div>
      {uploadError && <div className="mt-2 text-[12px] text-[#b34334]">{uploadError}</div>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />
    </section>
  );
}

// ─── Image card with location tagging ──────────────────────────────────────

function ImageCard({
  image,
  onRemove,
  onLocationsChange,
}: {
  image: BrandImage;
  onRemove: () => void;
  onLocationsChange: (locations: string[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(
    (image.locations ?? []).join(", "),
  );

  const saveDraft = () => {
    const locs = draft
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    onLocationsChange(locs);
    setEditing(false);
  };

  return (
    <div className="rounded-lg overflow-hidden bg-black/5 group flex flex-col">
      <div className="relative aspect-[4/3] bg-black/5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.url}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
        <button
          type="button"
          onClick={onRemove}
          className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/55 text-white text-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
          aria-label="Remove image"
        >
          ×
        </button>
      </div>

      {/* Location tags row */}
      <div className="px-2 py-2 bg-white border-t border-black/5">
        {editing ? (
          <div className="flex items-stretch gap-1.5">
            <input
              type="text"
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  saveDraft();
                }
                if (e.key === "Escape") {
                  setDraft((image.locations ?? []).join(", "));
                  setEditing(false);
                }
              }}
              placeholder="Tarangire, Serengeti…"
              className="flex-1 min-w-0 px-2 py-1 rounded-md border border-black/10 text-[11.5px] outline-none focus:border-[#1b3a2d]"
            />
            <button
              type="button"
              onClick={saveDraft}
              className="px-2 py-1 rounded-md bg-[#1b3a2d] text-white text-[11px] font-semibold"
            >
              Save
            </button>
          </div>
        ) : (image.locations && image.locations.length > 0) ? (
          <div className="flex items-center gap-1 flex-wrap">
            {image.locations.map((loc) => (
              <span
                key={loc}
                className="px-1.5 py-0.5 rounded text-[10.5px] font-medium"
                style={{
                  background: "rgba(27,58,45,0.08)",
                  color: "#1b3a2d",
                }}
              >
                {loc}
              </span>
            ))}
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-[10.5px] text-black/45 hover:text-black/75 transition ml-1"
            >
              edit
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-[11px] text-black/45 hover:text-black/75 transition"
          >
            + Tag locations
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Shared heading ─────────────────────────────────────────────────────────

function SectionHeading({
  children,
  hint,
}: {
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex items-baseline justify-between mb-3">
      <h3 className="text-[14px] font-semibold text-black/75">{children}</h3>
      {hint && <span className="text-[11px] text-black/35">{hint}</span>}
    </div>
  );
}
