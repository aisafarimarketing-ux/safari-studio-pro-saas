"use client";

import { useState } from "react";
import { resolveTokens } from "@/lib/theme";
import { ImageSlot } from "../../ImageSlot";
import { DayNotesRail } from "../DayNotesRail";
import type { StayChapter, ChapterLayoutProps } from "../types";
import type { Section } from "@/lib/types";

// Magazine Cover (Safariportal-inspired).
//
//   ┌────────────────────────┬──────────────────────────────┐
//   │                        │  PROPERTY NAME (h1)          │
//   │   LEFT — full-height   │  Property overview           │
//   │   property image       │  ─────────────────────        │
//   │   · "Day 3-5" accent   │  Description, 2-3 paras       │
//   │   · big uppercase      │                              │
//   │     PROPERTY NAME      │  [ gallery slider ]           │
//   │     on image           │                              │
//   │   · location pin tag   │  Experience & Activities      │
//   │     bottom left        │  ─────────────────────        │
//   │                        │  Activities paras             │
//   │                        │                              │
//   │                        │  Fast Facts                   │
//   │                        │  ✦ Highlights: ···            │
//   │                        │  ◎ Quick facts: rooms / pool  │
//   │                        │                              │
//   │                        │  Day notes rail ▼            │
//   └────────────────────────┴──────────────────────────────┘

export function MagazineCoverChapter({
  chapter,
  isEditor,
  section,
  onPropertyImageUpload,
  onDestinationImageUpload,
  onEditDay,
  onOpenPropertyPicker,
  onOpenDestinationPicker,
  proposal,
}: ChapterLayoutProps & { section: Section }) {
  const { theme } = proposal;
  const tokens = resolveTokens(theme.tokens, section.styleOverrides);
  const property = chapter.property;
  const gallery = property?.galleryUrls ?? [];
  const [galleryIndex, setGalleryIndex] = useState(0);

  const heroImage =
    property?.leadImageUrl ||
    chapter.days[0].heroImageUrl ||
    null;

  const galleryImage = gallery[galleryIndex] ?? chapter.days[0].heroImageUrl ?? null;

  const dayRangeLabel =
    chapter.nights > 1
      ? `Day ${chapter.startDayNumber}-${chapter.endDayNumber}`
      : `Day ${chapter.startDayNumber}`;

  return (
    <div
      className="grid md:grid-cols-[1.05fr_1fr]"
      style={{ background: tokens.sectionSurface }}
    >
      {/* ── LEFT: full-height cover image ─────────────────────────────── */}
      <ImageSlot
        url={heroImage}
        alt={property?.name ?? chapter.destinationName}
        isEditor={isEditor}
        tokens={tokens}
        onUpload={(f) =>
          property
            ? onPropertyImageUpload(f)
            : onDestinationImageUpload(chapter.days[0].id, f)
        }
        onPickFromLibrary={onOpenDestinationPicker}
        placeholderLabel={property ? "Add property photo" : "Add destination photo"}
        className="relative min-h-[520px] md:min-h-[680px]"
        overlay="both"
        showChangePill
      >
        {/* Day accent — top left */}
        <div className="absolute top-8 left-8 z-10 flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block"
            style={{
              width: 18,
              height: 2,
              background: "#c9a84c",
            }}
          />
          <span
            className="italic text-white/85 text-[13px]"
            style={{ fontFamily: `'${theme.displayFont}', serif` }}
          >
            {dayRangeLabel}
          </span>
        </div>

        {/* Massive uppercase cover title */}
        <div className="absolute left-8 right-8 top-[40%] z-10">
          <h2
            className="font-bold uppercase tracking-tight outline-none"
            style={{
              color: "white",
              fontFamily: `'${theme.displayFont}', serif`,
              fontSize: "clamp(2.2rem, 5.4vw, 4.8rem)",
              lineHeight: 0.95,
              letterSpacing: "-0.01em",
              textShadow: "0 2px 28px rgba(0,0,0,0.45)",
            }}
            contentEditable={isEditor}
            suppressContentEditableWarning
            onBlur={(e) => {
              // Editing the title — only meaningful when we have a
              // property to target. For phantom stays we edit day[0]
              // destination as a fallback.
              const next = e.currentTarget.textContent?.trim() ?? "";
              if (!next) return;
              if (property) {
                // Property names live in proposal.properties; for now we
                // don't mutate the library from here — we flag it as TODO.
              } else {
                onEditDay(chapter.days[0].id, { destination: next });
              }
            }}
          >
            {property?.name ?? chapter.destinationName}
          </h2>
        </div>

        {/* Bottom-left location pin */}
        <div
          className="absolute bottom-6 left-8 z-10 flex items-center gap-2 text-white/85 text-[12px]"
          style={{ fontFamily: `'${theme.bodyFont}', sans-serif` }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
            <path d="M7 13s-5-4.4-5-8a5 5 0 1 1 10 0c0 3.6-5 8-5 8Z" stroke="currentColor" strokeWidth="1.4" />
            <circle cx="7" cy="5" r="1.8" stroke="currentColor" strokeWidth="1.4" />
          </svg>
          <span>
            {[chapter.destinationName, chapter.destinationCountry].filter(Boolean).join(", ")}
          </span>
        </div>

        {/* Editor-only: choose property CTA when none selected */}
        {!property && isEditor && (
          <div className="absolute inset-x-0 bottom-20 z-10 flex justify-center pointer-events-none">
            <button
              type="button"
              onClick={onOpenPropertyPicker}
              className="pointer-events-auto px-4 py-2 rounded-lg text-[12px] font-semibold text-white transition hover:brightness-110"
              style={{ background: "#c9a84c" }}
            >
              ◇ Choose property
            </button>
          </div>
        )}
      </ImageSlot>

      {/* ── RIGHT: editorial info panel ─────────────────────────────── */}
      <div className="p-8 md:p-12">
        {/* Property heading */}
        <h3
          className="font-bold tracking-tight"
          style={{
            color: tokens.headingText,
            fontFamily: `'${theme.displayFont}', serif`,
            fontSize: "clamp(1.6rem, 2.4vw, 2rem)",
            lineHeight: 1.1,
          }}
        >
          {property?.name ?? chapter.destinationName}
        </h3>
        <div
          className="mt-1 italic text-[14px]"
          style={{
            color: tokens.mutedText,
            fontFamily: `'${theme.displayFont}', serif`,
          }}
        >
          Property overview · {chapter.nights} night{chapter.nights === 1 ? "" : "s"}
        </div>
        <div
          className="mt-5 mb-5 h-px"
          style={{ background: tokens.border }}
        />

        {/* Description */}
        {property?.summary ? (
          <p
            className="text-[14.5px] leading-[1.8]"
            style={{
              color: tokens.bodyText,
              fontFamily: `'${theme.bodyFont}', sans-serif`,
            }}
          >
            {property.summary}
          </p>
        ) : (
          <p
            className="text-[14px] italic"
            style={{ color: tokens.mutedText }}
          >
            {isEditor
              ? "Choose a property and its summary will appear here."
              : "—"}
          </p>
        )}

        {/* Gallery slider */}
        {property && (
          <div className="mt-6">
            <div
              className="relative rounded-lg overflow-hidden"
              style={{ aspectRatio: "3 / 2", background: tokens.cardBg }}
            >
              {galleryImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={galleryImage}
                  alt={property.name}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : null}
              {gallery.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setGalleryIndex((i) => (i - 1 + gallery.length) % gallery.length)
                    }
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/85 hover:bg-white flex items-center justify-center text-black/70 text-sm shadow-md"
                    aria-label="Previous image"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    onClick={() => setGalleryIndex((i) => (i + 1) % gallery.length)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/85 hover:bg-white flex items-center justify-center text-black/70 text-sm shadow-md"
                    aria-label="Next image"
                  >
                    ›
                  </button>
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {gallery.map((_, i) => (
                      <span
                        key={i}
                        className="w-1.5 h-1.5 rounded-full transition"
                        style={{
                          background: i === galleryIndex ? "white" : "rgba(255,255,255,0.5)",
                        }}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Fast Facts — highlights + quick facts */}
        {property && (property.highlights.length > 0 || chapter.boardBasis) && (
          <div className="mt-7">
            <div
              className="italic text-[14px] mb-2"
              style={{
                color: tokens.mutedText,
                fontFamily: `'${theme.displayFont}', serif`,
              }}
            >
              Fast Facts
            </div>
            <div
              className="h-px mb-4"
              style={{ background: tokens.border }}
            />
            {property.highlights.length > 0 && (
              <FactRow icon="✦" label="Highlights" tokens={tokens} theme={theme}>
                {property.highlights.slice(0, 4).join(" · ")}
              </FactRow>
            )}
            {chapter.boardBasis && (
              <FactRow icon="◎" label="Board" tokens={tokens} theme={theme}>
                {chapter.boardBasis}
              </FactRow>
            )}
            <FactRow icon="☽" label="Stay" tokens={tokens} theme={theme}>
              {chapter.nights} night{chapter.nights === 1 ? "" : "s"} ·{" "}
              {dayRangeLabel}
            </FactRow>
          </div>
        )}

        {/* Choose property button when empty */}
        {!property && isEditor && (
          <button
            type="button"
            onClick={onOpenPropertyPicker}
            className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold transition"
            style={{
              color: tokens.accent,
              background: `${tokens.accent}12`,
              border: `1px solid ${tokens.accent}40`,
            }}
          >
            <span style={{ color: "#c9a84c" }}>◇</span>
            Choose property
          </button>
        )}

        {/* Day notes rail — only when there are multiple days */}
        {chapter.nights > 1 && (
          <div className="mt-10 pt-8" style={{ borderTop: `1px solid ${tokens.border}` }}>
            <div
              className="italic text-[13px] mb-5"
              style={{
                color: tokens.mutedText,
                fontFamily: `'${theme.displayFont}', serif`,
              }}
            >
              Your days here
            </div>
            <DayNotesRail
              days={chapter.days}
              isEditor={isEditor}
              tokens={tokens}
              theme={theme}
              onEditDay={onEditDay}
              compact
            />
          </div>
        )}

        {/* Single-day: inline narrative */}
        {chapter.nights === 1 && (
          <div className="mt-8">
            <div
              className="italic text-[13px] mb-3"
              style={{
                color: tokens.mutedText,
                fontFamily: `'${theme.displayFont}', serif`,
              }}
            >
              Today
            </div>
            <p
              className="text-[14px] leading-[1.8] outline-none"
              style={{
                color: tokens.bodyText,
                fontFamily: `'${theme.bodyFont}', sans-serif`,
              }}
              contentEditable={isEditor}
              suppressContentEditableWarning
              data-ai-editable="day"
              onBlur={(e) =>
                onEditDay(chapter.days[0].id, {
                  description: e.currentTarget.textContent ?? "",
                })
              }
            >
              {chapter.days[0].description ||
                (isEditor ? "Describe this day…" : "")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function FactRow({
  icon,
  label,
  children,
  tokens,
  theme,
}: {
  icon: string;
  label: string;
  children: React.ReactNode;
  tokens: ReturnType<typeof resolveTokens>;
  theme: ChapterLayoutProps["proposal"]["theme"];
}) {
  return (
    <div className="flex gap-3 py-1.5">
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[13px]"
        style={{
          background: `${tokens.accent}14`,
          color: tokens.accent,
          border: `1px solid ${tokens.accent}28`,
        }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div
          className="text-[11px] uppercase tracking-[0.24em] font-semibold"
          style={{
            color: tokens.mutedText,
            fontFamily: `'${theme.bodyFont}', sans-serif`,
          }}
        >
          {label}
        </div>
        <div
          className="mt-0.5 text-[13px]"
          style={{
            color: tokens.bodyText,
            fontFamily: `'${theme.bodyFont}', sans-serif`,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
