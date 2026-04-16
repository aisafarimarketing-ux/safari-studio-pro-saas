"use client";

import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import type { Section } from "@/lib/types";

export function CoverSection({ section }: { section: Section }) {
  const { proposal, updateSectionContent, updateTrip, updateClient } = useProposalStore();
  const { mode } = useEditorStore();
  const isEditor = mode === "editor";

  const { client, trip, operator, theme } = proposal;
  const tokens = theme.tokens;
  const heroUrl = section.content.heroImageUrl as string | undefined;
  const variant = section.layoutVariant;

  const handleHeroUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) updateSectionContent(section.id, { heroImageUrl: URL.createObjectURL(file) });
  };

  // ── Centered-editorial ─────────────────────────────────────────────────────
  if (variant === "centered-editorial") {
    return (
      <div
        className="relative w-full min-h-screen flex flex-col overflow-hidden"
        style={{ background: tokens.accent }}
      >
        {/* Full-bleed hero */}
        {heroUrl ? (
          <img src={heroUrl} alt="Cover" className="absolute inset-0 w-full h-full object-cover" />
        ) : isEditor ? (
          <label className="absolute inset-0 cursor-pointer">
            <input type="file" accept="image/*" className="hidden" onChange={handleHeroUpload} />
          </label>
        ) : null}

        {/* Deep gradient overlay — heavier at top and bottom */}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to bottom,
              rgba(0,0,0,0.55) 0%,
              rgba(0,0,0,0.1) 40%,
              rgba(0,0,0,0.15) 60%,
              rgba(0,0,0,0.7) 100%
            )`,
          }}
        />

        {/* Top bar */}
        <div className="relative z-10 flex items-center justify-between px-10 pt-10">
          {operator.logoUrl ? (
            <img src={operator.logoUrl} alt={operator.companyName} className="h-9 object-contain" />
          ) : (
            <span className="text-white/70 text-xs uppercase tracking-[0.25em] font-semibold">
              {operator.companyName}
            </span>
          )}
          {operator.consultantName && (
            <span className="text-white/50 text-xs tracking-wide">
              Prepared by {operator.consultantName}
            </span>
          )}
        </div>

        {/* Centre — destination tags + giant title */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-8 py-16">
          {trip.destinations.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 mb-8">
              {trip.destinations.map((d) => (
                <span
                  key={d}
                  className="px-3 py-1 rounded-full text-[11px] font-semibold tracking-wider uppercase"
                  style={{ background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.85)", backdropFilter: "blur(6px)" }}
                >
                  {d}
                </span>
              ))}
            </div>
          )}

          <h1
            className="text-[clamp(2.8rem,8vw,6rem)] font-bold leading-[1.05] text-white max-w-3xl outline-none"
            style={{ fontFamily: `'${theme.displayFont}', serif`, textShadow: "0 2px 24px rgba(0,0,0,0.3)" }}
            contentEditable={isEditor}
            suppressContentEditableWarning
            onBlur={(e) => updateTrip({ title: e.currentTarget.textContent?.trim() ?? trip.title })}
          >
            {trip.title}
          </h1>

          <p
            className="mt-5 text-white/65 text-lg max-w-xl leading-relaxed outline-none"
            style={{ fontFamily: `'${theme.bodyFont}', sans-serif` }}
            contentEditable={isEditor}
            suppressContentEditableWarning
            onBlur={(e) => updateSectionContent(section.id, { tagline: e.currentTarget.textContent ?? "" })}
          >
            {(section.content.tagline as string) || trip.subtitle}
          </p>

          {isEditor && !heroUrl && (
            <label className="mt-10 px-5 py-2.5 rounded-xl text-white/60 border border-white/25 text-sm cursor-pointer hover:border-white/50 hover:text-white/80 transition">
              <input type="file" accept="image/*" className="hidden" onChange={handleHeroUpload} />
              + Add hero image
            </label>
          )}
        </div>

        {/* Bottom bar — client details */}
        <div className="relative z-10 px-10 pb-10">
          <div className="max-w-3xl mx-auto flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div style={{ fontFamily: `'${theme.bodyFont}', sans-serif` }}>
              <div
                className="text-xl font-semibold text-white outline-none"
                contentEditable={isEditor}
                suppressContentEditableWarning
                onBlur={(e) => updateClient({ guestNames: e.currentTarget.textContent?.trim() ?? client.guestNames })}
              >
                {client.guestNames}
              </div>
              <div className="text-white/55 text-sm mt-0.5 outline-none" contentEditable={isEditor} suppressContentEditableWarning
                onBlur={(e) => updateTrip({ dates: e.currentTarget.textContent?.trim() ?? trip.dates })}>
                {trip.dates}{trip.nights ? ` · ${trip.nights} nights` : ""}
              </div>
            </div>
            {client.pax && (
              <div className="text-white/45 text-sm" style={{ fontFamily: `'${theme.bodyFont}', sans-serif` }}>
                {client.pax}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Cinematic-split (default) ───────────────────────────────────────────────
  return (
    <div className="relative w-full min-h-screen flex overflow-hidden">
      {/* Right: full-bleed image */}
      <div className="absolute inset-0">
        {heroUrl ? (
          <img src={heroUrl} alt="Cover" className="w-full h-full object-cover" />
        ) : isEditor ? (
          <label
            className="w-full h-full flex flex-col items-center justify-center cursor-pointer"
            style={{ background: tokens.accent }}
          >
            <input type="file" accept="image/*" className="hidden" onChange={handleHeroUpload} />
            <div className="text-white/30 text-center">
              <div className="text-5xl mb-3">+</div>
              <div className="text-sm">Add hero image</div>
            </div>
          </label>
        ) : (
          <div style={{ background: tokens.accent, width: "100%", height: "100%" }} />
        )}
        {/* Gradient: full left coverage, fadeout mid */}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(105deg,
              ${tokens.accent} 0%,
              ${tokens.accent} 38%,
              rgba(0,0,0,0.55) 60%,
              rgba(0,0,0,0.2) 100%
            )`,
          }}
        />
      </div>

      {/* Left: text column */}
      <div className="relative z-10 flex flex-col justify-between w-full md:w-[52%] min-h-screen px-10 md:px-14 py-10">
        {/* Top: operator */}
        <div className="flex items-center gap-3">
          {operator.logoUrl ? (
            <img src={operator.logoUrl} alt={operator.companyName} className="h-8 object-contain" />
          ) : (
            <span className="text-white/60 text-xs uppercase tracking-[0.25em] font-semibold">
              {operator.companyName}
            </span>
          )}
        </div>

        {/* Middle: destinations + title + tagline */}
        <div className="space-y-6">
          {trip.destinations.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {trip.destinations.map((d) => (
                <span
                  key={d}
                  className="px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider"
                  style={{
                    background: "rgba(255,255,255,0.12)",
                    color: "rgba(255,255,255,0.8)",
                    backdropFilter: "blur(4px)",
                    border: "1px solid rgba(255,255,255,0.18)",
                  }}
                >
                  {d}
                </span>
              ))}
            </div>
          )}

          <h1
            className="text-[clamp(2.5rem,5.5vw,4.5rem)] font-bold text-white leading-[1.0] outline-none"
            style={{ fontFamily: `'${theme.displayFont}', serif`, textShadow: "0 2px 20px rgba(0,0,0,0.2)" }}
            contentEditable={isEditor}
            suppressContentEditableWarning
            onBlur={(e) => updateTrip({ title: e.currentTarget.textContent?.trim() ?? trip.title })}
          >
            {trip.title}
          </h1>

          <p
            className="text-white/60 text-[15px] leading-relaxed max-w-sm outline-none"
            style={{ fontFamily: `'${theme.bodyFont}', sans-serif` }}
            contentEditable={isEditor}
            suppressContentEditableWarning
            onBlur={(e) => updateSectionContent(section.id, { tagline: e.currentTarget.textContent ?? "" })}
          >
            {(section.content.tagline as string) || trip.subtitle}
          </p>
        </div>

        {/* Bottom: client info + consultant */}
        <div style={{ fontFamily: `'${theme.bodyFont}', sans-serif` }}>
          <div
            className="w-8 mb-5"
            style={{ height: "1px", background: "rgba(255,255,255,0.25)" }}
          />
          <div
            className="text-lg font-semibold text-white mb-1 outline-none"
            contentEditable={isEditor}
            suppressContentEditableWarning
            onBlur={(e) => updateClient({ guestNames: e.currentTarget.textContent?.trim() ?? client.guestNames })}
          >
            {client.guestNames}
          </div>
          <div
            className="text-white/55 text-sm outline-none"
            contentEditable={isEditor}
            suppressContentEditableWarning
            onBlur={(e) => updateTrip({ dates: e.currentTarget.textContent?.trim() ?? trip.dates })}
          >
            {trip.dates}{trip.nights ? ` · ${trip.nights} nights` : ""}
            {client.pax ? ` · ${client.pax}` : ""}
          </div>
          {operator.consultantName && (
            <div className="mt-3 text-white/35 text-xs">
              Prepared by {operator.consultantName}
            </div>
          )}
        </div>
      </div>

      {/* Change image button (editor) */}
      {heroUrl && isEditor && (
        <label className="absolute bottom-5 right-5 z-20 cursor-pointer bg-black/50 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-black/70 transition backdrop-blur-sm">
          <input type="file" accept="image/*" className="hidden" onChange={handleHeroUpload} />
          Change image
        </label>
      )}
    </div>
  );
}
