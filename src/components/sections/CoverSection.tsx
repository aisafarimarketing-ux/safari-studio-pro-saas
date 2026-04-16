"use client";

import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import type { Section } from "@/lib/types";

interface Props {
  section: Section;
}

export function CoverSection({ section }: Props) {
  const { proposal, updateSectionContent } = useProposalStore();
  const { mode } = useEditorStore();
  const isEditor = mode === "editor";

  const { client, trip, operator, theme } = proposal;
  const tokens = theme.tokens;
  const heroUrl = section.content.heroImageUrl as string | undefined;
  const variant = section.layoutVariant;

  const handleHeroUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file)
      updateSectionContent(section.id, {
        heroImageUrl: URL.createObjectURL(file),
      });
  };

  if (variant === "centered-editorial") {
    return (
      <div
        className="relative w-full min-h-[85vh] flex flex-col items-center justify-center text-center px-8 py-20 overflow-hidden"
        style={{ background: tokens.accent }}
      >
        {/* Hero image bg */}
        {heroUrl && (
          <img
            src={heroUrl}
            alt="Cover"
            className="absolute inset-0 w-full h-full object-cover opacity-30"
          />
        )}
        {!heroUrl && isEditor && (
          <label className="absolute inset-0 flex items-center justify-center cursor-pointer opacity-20 hover:opacity-40 transition">
            <input type="file" accept="image/*" className="hidden" onChange={handleHeroUpload} />
            <span className="text-white text-sm">+ Add hero image</span>
          </label>
        )}
        <div className="relative z-10 space-y-6 max-w-2xl">
          {operator.logoUrl ? (
            <img src={operator.logoUrl} alt={operator.companyName} className="h-12 mx-auto object-contain" />
          ) : (
            <div className="text-white/60 text-sm font-medium tracking-widest uppercase">
              {operator.companyName}
            </div>
          )}
          <h1
            className="text-5xl md:text-7xl font-bold text-white leading-tight"
            style={{ fontFamily: `'${theme.displayFont}', serif` }}
            contentEditable={isEditor}
            suppressContentEditableWarning
          >
            {trip.title}
          </h1>
          <p
            className="text-white/70 text-lg leading-relaxed"
            style={{ fontFamily: `'${theme.bodyFont}', sans-serif` }}
            contentEditable={isEditor}
            suppressContentEditableWarning
          >
            {section.content.tagline as string || trip.subtitle}
          </p>
          <div className="border-t border-white/20 pt-6 text-white/60 text-sm space-y-1"
            style={{ fontFamily: `'${theme.bodyFont}', sans-serif` }}>
            <div contentEditable={isEditor} suppressContentEditableWarning className="outline-none">
              {client.guestNames}
            </div>
            <div contentEditable={isEditor} suppressContentEditableWarning className="outline-none">
              {trip.dates}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Default: cinematic-split
  return (
    <div className="relative w-full min-h-[90vh] flex overflow-hidden" style={{ background: tokens.accent }}>
      {/* Left: text */}
      <div
        className="relative z-10 flex flex-col justify-end p-12 md:p-16 w-full md:w-1/2"
        style={{ background: `linear-gradient(to right, ${tokens.accent} 60%, transparent)` }}
      >
        <div className="space-y-5 max-w-md">
          {/* Operator */}
          <div className="flex items-center gap-3 mb-6">
            {operator.logoUrl ? (
              <img src={operator.logoUrl} alt={operator.companyName} className="h-8 object-contain" />
            ) : (
              <span className="text-white/50 text-xs uppercase tracking-widest font-medium">
                {operator.companyName}
              </span>
            )}
          </div>

          {/* Destinations */}
          {trip.destinations.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {trip.destinations.map((d) => (
                <span
                  key={d}
                  className="px-3 py-1 rounded-full text-xs font-semibold"
                  style={{ background: tokens.secondaryAccent, color: tokens.accent }}
                >
                  {d}
                </span>
              ))}
            </div>
          )}

          <h1
            className="text-5xl md:text-6xl font-bold text-white leading-tight"
            style={{ fontFamily: `'${theme.displayFont}', serif` }}
            contentEditable={isEditor}
            suppressContentEditableWarning
          >
            {trip.title}
          </h1>

          <p
            className="text-white/60 text-base leading-relaxed"
            style={{ fontFamily: `'${theme.bodyFont}', sans-serif` }}
            contentEditable={isEditor}
            suppressContentEditableWarning
          >
            {section.content.tagline as string || trip.subtitle}
          </p>

          <div
            className="pt-4 border-t border-white/15 space-y-1 text-sm"
            style={{ color: "rgba(255,255,255,0.55)", fontFamily: `'${theme.bodyFont}', sans-serif` }}
          >
            <div
              contentEditable={isEditor}
              suppressContentEditableWarning
              className="outline-none font-medium"
              style={{ color: "rgba(255,255,255,0.9)" }}
            >
              {client.guestNames}
            </div>
            <div
              contentEditable={isEditor}
              suppressContentEditableWarning
              className="outline-none"
            >
              {trip.dates} · {trip.nights} nights
            </div>
            {client.pax && (
              <div
                contentEditable={isEditor}
                suppressContentEditableWarning
                className="outline-none"
              >
                {client.pax}
              </div>
            )}
          </div>

          {operator.consultantName && (
            <div className="pt-4 text-xs text-white/40" style={{ fontFamily: `'${theme.bodyFont}', sans-serif` }}>
              Prepared by {operator.consultantName}
            </div>
          )}
        </div>
      </div>

      {/* Right: hero image */}
      <div className="absolute inset-0 md:left-1/2 md:inset-y-0 md:right-0">
        {heroUrl ? (
          <img src={heroUrl} alt="Cover" className="w-full h-full object-cover" />
        ) : (
          isEditor && (
            <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer"
              style={{ background: "rgba(255,255,255,0.05)" }}>
              <input type="file" accept="image/*" className="hidden" onChange={handleHeroUpload} />
              <div className="text-white/30 text-center">
                <div className="text-4xl mb-2">+</div>
                <div className="text-sm">Add hero image</div>
              </div>
            </label>
          )
        )}
        {heroUrl && isEditor && (
          <label className="absolute bottom-4 right-4 cursor-pointer bg-black/50 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-black/70 transition">
            <input type="file" accept="image/*" className="hidden" onChange={handleHeroUpload} />
            Change image
          </label>
        )}
        {/* Overlay fade */}
        <div
          className="absolute inset-0 hidden md:block"
          style={{ background: "linear-gradient(to right, transparent, rgba(0,0,0,0.15))" }}
        />
      </div>
    </div>
  );
}
