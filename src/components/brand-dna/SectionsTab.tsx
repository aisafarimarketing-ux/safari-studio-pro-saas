"use client";

import { useState } from "react";
import type { SectionType } from "@/lib/types";
import type { BrandDNAForm } from "./types";
import { Field } from "./Field";

// ─── SectionsTab ────────────────────────────────────────────────────────
//
// Per-section style overrides on Brand DNA. Owner picks a default
// section bg, accent, heading font, etc., for each section type.
// On proposal clone the values seed each section's styleOverrides
// (template overrides win — operator can still customise per
// proposal via SectionChrome).
//
// Layout: a section-type picker + a sticky form below editing the
// chosen type's fields. Empty values fall through to the global
// theme (no per-section override applied).

const SECTION_OPTIONS: { id: SectionType; label: string; description: string }[] = [
  { id: "cover", label: "Cover", description: "The proposal's opening page" },
  { id: "personalNote", label: "Personal Note", description: "Greeting / consultant intro" },
  { id: "itineraryTable", label: "Itinerary Table", description: "Day-by-day at a glance" },
  { id: "map", label: "Map", description: "Itinerary route diagram" },
  { id: "dayJourney", label: "Day-by-Day Journey", description: "Detailed day cards" },
  { id: "propertyShowcase", label: "Property Showcase", description: "Camp / lodge cards" },
  { id: "pricing", label: "Pricing", description: "Breakdown + inclusions / policies" },
  { id: "practicalInfo", label: "Practical Info", description: "Visa, payment, packing" },
  { id: "closing", label: "Closing", description: "Final letter + Secure-This-Safari CTA" },
  { id: "footer", label: "Footer", description: "Operator contacts + branding" },
];

const STYLE_FIELDS: {
  key: keyof NonNullable<BrandDNAForm["sectionStyles"][SectionType]>;
  label: string;
  type: "color" | "text";
  placeholder?: string;
}[] = [
  { key: "sectionSurface", label: "Section background", type: "color" },
  { key: "cardBg", label: "Card background", type: "color" },
  { key: "accent", label: "Accent (badges / pills / icons)", type: "color" },
  { key: "headingText", label: "Heading text colour", type: "color" },
  { key: "bodyText", label: "Body text colour", type: "color" },
  { key: "border", label: "Border / divider colour", type: "color" },
  { key: "dayHeadBg", label: "Day-card head bg (Day-Journey only)", type: "color" },
];

export function SectionsTab({
  form,
  update,
}: {
  form: BrandDNAForm;
  update: (patch: Partial<BrandDNAForm>) => void;
}) {
  const [activeType, setActiveType] = useState<SectionType>("cover");
  const styles = form.sectionStyles ?? {};
  const current = styles[activeType] ?? {};

  const setField = (
    key: keyof NonNullable<BrandDNAForm["sectionStyles"][SectionType]>,
    value: string,
  ) => {
    const trimmed = value.trim();
    const nextEntry: Record<string, string> = { ...(current as Record<string, string>) };
    if (trimmed) {
      nextEntry[key] = trimmed;
    } else {
      delete nextEntry[key];
    }
    const nextStyles = { ...styles };
    if (Object.keys(nextEntry).length === 0) {
      delete nextStyles[activeType];
    } else {
      nextStyles[activeType] = nextEntry as NonNullable<
        BrandDNAForm["sectionStyles"][SectionType]
      >;
    }
    update({ sectionStyles: nextStyles });
  };

  const clearSection = () => {
    const nextStyles = { ...styles };
    delete nextStyles[activeType];
    update({ sectionStyles: nextStyles });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[15px] font-semibold text-black/85">
          Per-section defaults
        </h2>
        <p className="mt-1 text-[12.5px] text-black/55 max-w-2xl">
          Pick the colours your sections should default to. These apply when
          new proposals are generated. Operators can still override per
          proposal from the section&apos;s edit chrome — these are the
          starting point.
        </p>
      </div>

      {/* Section type picker */}
      <div className="flex flex-wrap gap-1.5">
        {SECTION_OPTIONS.map((opt) => {
          const hasOverrides = !!styles[opt.id] && Object.keys(styles[opt.id] ?? {}).length > 0;
          const isActive = opt.id === activeType;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setActiveType(opt.id)}
              className={`px-3 py-1.5 rounded-lg text-[12.5px] font-medium transition border ${
                isActive
                  ? "bg-[#1b3a2d] text-white border-[#1b3a2d]"
                  : "bg-white text-black/65 border-black/10 hover:border-black/25"
              }`}
            >
              {opt.label}
              {hasOverrides && !isActive && (
                <span
                  aria-hidden
                  className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-[#c9a84c]"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Active section editor */}
      <div className="rounded-xl border border-black/8 bg-white p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[14px] font-semibold text-black/85">
              {SECTION_OPTIONS.find((o) => o.id === activeType)?.label}
            </div>
            <div className="text-[11.5px] text-black/55">
              {SECTION_OPTIONS.find((o) => o.id === activeType)?.description}
            </div>
          </div>
          {Object.keys(current).length > 0 && (
            <button
              type="button"
              onClick={clearSection}
              className="text-[11.5px] text-black/45 hover:text-[#b34334] transition"
            >
              Clear all
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {STYLE_FIELDS.map((field) => {
            const value = (current[field.key] as string | undefined) ?? "";
            return (
              <Field key={String(field.key)} label={field.label}>
                <div className="flex items-center gap-2">
                  {field.type === "color" && (
                    <input
                      type="color"
                      value={value || "#ffffff"}
                      onChange={(e) => setField(field.key, e.target.value)}
                      className="w-9 h-9 rounded-md border border-black/10 cursor-pointer"
                    />
                  )}
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => setField(field.key, e.target.value)}
                    placeholder={field.placeholder ?? "Use theme default"}
                    className="flex-1 px-3 py-2 rounded-lg border border-black/10 text-[13px] font-mono outline-none focus:border-[#1b3a2d]"
                  />
                </div>
              </Field>
            );
          })}
        </div>

        <p className="mt-4 text-[11px] text-black/45">
          Leave a field empty to fall through to the global theme.
        </p>
      </div>
    </div>
  );
}
