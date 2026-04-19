"use client";

import { useState } from "react";
import { resolveTokens } from "@/lib/theme";
import { ImageSlot } from "../../ImageSlot";
import { DayNotesRail } from "../DayNotesRail";
import type { ChapterLayoutProps } from "../types";
import type { Section } from "@/lib/types";

// Destination + Property (Karibu-inspired).
//
// Two stacked blocks per chapter:
//   1. DESTINATION — narrow left sidebar with label + name + day range +
//      description; wide right gallery area with tabs (Gallery / Map).
//   2. ACCOMMODATION — narrow left sidebar with property name + day range
//      + Your Stay + Fast Facts; wide right gallery area with tabs
//      (Gallery / Rooms / Activities / Information).
// Day notes rail between / under them.

type Tab = "gallery" | "map" | "rooms" | "activities" | "information";

export function DestinationPropertyChapter({
  chapter,
  isEditor,
  section,
  proposal,
  onPropertyImageUpload,
  onDestinationImageUpload,
  onEditDay,
  onOpenPropertyPicker,
  onOpenDestinationPicker,
}: ChapterLayoutProps & { section: Section }) {
  const { theme } = proposal;
  const tokens = resolveTokens(theme.tokens, section.styleOverrides);
  const property = chapter.property;
  const gallery = property?.galleryUrls ?? [];
  const [destTab, setDestTab] = useState<Tab>("gallery");
  const [propTab, setPropTab] = useState<Tab>("gallery");
  const [propGalleryIndex, setPropGalleryIndex] = useState(0);

  const dayRangeLabel =
    chapter.nights > 1
      ? `Day ${chapter.startDayNumber} - ${chapter.endDayNumber}`
      : `Day ${chapter.startDayNumber}`;

  const destHero = chapter.days[0].heroImageUrl ?? null;
  const propHero = property?.leadImageUrl ?? null;

  return (
    <div style={{ background: tokens.sectionSurface }}>
      {/* ─── Destination block ─────────────────────────────────────── */}
      <div className="grid md:grid-cols-[0.9fr_1.6fr] gap-8 md:gap-12 pt-10 md:pt-14 px-8 md:px-12">
        <aside className="md:pt-4">
          <div
            className="text-[10px] uppercase tracking-[0.28em] font-semibold mb-1.5"
            style={{
              color: tokens.mutedText,
              fontFamily: `'${theme.bodyFont}', sans-serif`,
            }}
          >
            Destination
          </div>
          <h3
            className="font-bold tracking-tight outline-none"
            style={{
              color: tokens.headingText,
              fontFamily: `'${theme.displayFont}', serif`,
              fontSize: "clamp(1.7rem, 3vw, 2.4rem)",
              lineHeight: 1.05,
            }}
            contentEditable={isEditor}
            suppressContentEditableWarning
            onBlur={(e) =>
              onEditDay(chapter.days[0].id, {
                destination: e.currentTarget.textContent?.trim() ?? chapter.destinationName,
              })
            }
          >
            {chapter.destinationName}
          </h3>
          <div
            className="mt-1 text-[11px] uppercase tracking-[0.2em]"
            style={{ color: tokens.mutedText }}
          >
            {dayRangeLabel}
          </div>

          <p
            className="mt-5 text-[13.5px] leading-[1.75] outline-none"
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
              (isEditor
                ? "Describe the destination — a paragraph or two on what makes this place matter."
                : "")}
          </p>
        </aside>

        <div>
          <Tabs
            tabs={[
              { id: "gallery", label: "Gallery" },
              { id: "map", label: "Map" },
            ]}
            active={destTab}
            onChange={(t) => setDestTab(t as Tab)}
            tokens={tokens}
          />
          <div className="mt-3">
            {destTab === "gallery" ? (
              <ImageSlot
                url={destHero}
                alt={chapter.destinationName}
                isEditor={isEditor}
                tokens={tokens}
                onUpload={(f) => onDestinationImageUpload(chapter.days[0].id, f)}
                onPickFromLibrary={onOpenDestinationPicker}
                placeholderLabel="Add destination photo"
                className="rounded-md"
                style={{ aspectRatio: "3 / 2" }}
              />
            ) : (
              <div
                className="rounded-md flex items-center justify-center text-[13px]"
                style={{
                  aspectRatio: "3 / 2",
                  background: tokens.cardBg,
                  color: tokens.mutedText,
                }}
              >
                Route map appears at the itinerary level
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Accommodation block ───────────────────────────────────── */}
      <div className="grid md:grid-cols-[0.9fr_1.6fr] gap-8 md:gap-12 pt-12 md:pt-16 pb-12 md:pb-16 px-8 md:px-12">
        <aside>
          <div
            className="text-[10px] uppercase tracking-[0.28em] font-semibold mb-1.5"
            style={{
              color: tokens.mutedText,
              fontFamily: `'${theme.bodyFont}', sans-serif`,
            }}
          >
            Accommodation
          </div>
          <h3
            className="font-bold tracking-tight"
            style={{
              color: tokens.headingText,
              fontFamily: `'${theme.displayFont}', serif`,
              fontSize: "clamp(1.5rem, 2.4vw, 1.95rem)",
              lineHeight: 1.1,
            }}
          >
            {property?.name ?? (isEditor ? "No property selected" : "—")}
          </h3>
          <div
            className="mt-1 text-[11px] uppercase tracking-[0.2em]"
            style={{ color: tokens.mutedText }}
          >
            {[chapter.destinationName, dayRangeLabel].filter(Boolean).join(" · ")}
          </div>

          {/* Your Stay */}
          <FactBlock icon="◈" title="Your Stay" tokens={tokens} theme={theme}>
            <Row label="Nights" tokens={tokens}>{chapter.nights}</Row>
            {chapter.boardBasis && (
              <Row label="Basis" tokens={tokens}>
                {chapter.boardBasis}
              </Row>
            )}
          </FactBlock>

          {/* Fast Facts */}
          {property && property.highlights.length > 0 && (
            <FactBlock icon="✦" title="Fast Facts" tokens={tokens} theme={theme}>
              <Row label="Amenities" tokens={tokens}>
                {property.highlights.slice(0, 5).join(" · ")}
              </Row>
              {property.location && (
                <Row label="Location" tokens={tokens}>
                  {property.location}
                </Row>
              )}
            </FactBlock>
          )}

          {isEditor && !property && (
            <button
              type="button"
              onClick={onOpenPropertyPicker}
              className="mt-4 inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-[12px] font-semibold transition"
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

          {isEditor && property && (
            <button
              type="button"
              onClick={onOpenPropertyPicker}
              className="mt-4 text-[11px] font-semibold uppercase tracking-[0.22em] hover:opacity-80 transition"
              style={{ color: tokens.accent }}
            >
              Swap property →
            </button>
          )}
        </aside>

        <div>
          <Tabs
            tabs={[
              { id: "gallery", label: "Gallery" },
              { id: "rooms", label: "Rooms" },
              { id: "activities", label: "Activities" },
              { id: "information", label: "Information" },
            ]}
            active={propTab}
            onChange={(t) => setPropTab(t as Tab)}
            tokens={tokens}
          />
          <div className="mt-3">
            {propTab === "gallery" ? (
              <div
                className="relative rounded-md overflow-hidden"
                style={{ aspectRatio: "3 / 2", background: tokens.cardBg }}
              >
                <ImageSlot
                  url={gallery[propGalleryIndex] ?? propHero}
                  alt={property?.name ?? ""}
                  isEditor={isEditor}
                  tokens={tokens}
                  onUpload={(f) => onPropertyImageUpload(f)}
                  placeholderLabel={property ? "Add property photo" : "Choose a property first"}
                  className="w-full h-full"
                  showChangePill={Boolean(property?.leadImageUrl)}
                />
                {gallery.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setPropGalleryIndex((i) => (i - 1 + gallery.length) % gallery.length)
                      }
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/85 hover:bg-white flex items-center justify-center text-black/70 text-sm shadow-md"
                      aria-label="Previous"
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      onClick={() => setPropGalleryIndex((i) => (i + 1) % gallery.length)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/85 hover:bg-white flex items-center justify-center text-black/70 text-sm shadow-md"
                      aria-label="Next"
                    >
                      ›
                    </button>
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                      {gallery.map((_, i) => (
                        <span
                          key={i}
                          className="w-1.5 h-1.5 rounded-full"
                          style={{
                            background: i === propGalleryIndex ? "white" : "rgba(255,255,255,0.55)",
                          }}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <TabPlaceholder tokens={tokens} label={tabPlaceholderLabel(propTab, Boolean(property))} />
            )}
          </div>

          {/* Property summary under the tab panel */}
          {property?.summary && (
            <p
              className="mt-5 text-[13.5px] leading-[1.75]"
              style={{
                color: tokens.bodyText,
                fontFamily: `'${theme.bodyFont}', sans-serif`,
              }}
            >
              {property.summary}
            </p>
          )}
        </div>
      </div>

      {/* ─── Day-by-day rail within this chapter ──────────────────── */}
      {chapter.nights > 1 && (
        <div
          className="px-8 md:px-12 pb-12 md:pb-16 pt-2"
          style={{ borderTop: `1px solid ${tokens.border}` }}
        >
          <div className="pt-8 grid md:grid-cols-[0.9fr_1.6fr] gap-8 md:gap-12">
            <aside className="md:pt-1">
              <div
                className="text-[10px] uppercase tracking-[0.28em] font-semibold"
                style={{
                  color: tokens.mutedText,
                  fontFamily: `'${theme.bodyFont}', sans-serif`,
                }}
              >
                Experiences
              </div>
              <h4
                className="mt-2 font-bold tracking-tight"
                style={{
                  color: tokens.headingText,
                  fontFamily: `'${theme.displayFont}', serif`,
                  fontSize: "clamp(1.5rem, 2.2vw, 1.9rem)",
                  lineHeight: 1.1,
                }}
              >
                Your days here
              </h4>
              <div
                className="mt-1 text-[11px] uppercase tracking-[0.2em]"
                style={{ color: tokens.mutedText }}
              >
                {dayRangeLabel}
              </div>
            </aside>

            <div>
              <DayNotesRail
                days={chapter.days}
                isEditor={isEditor}
                tokens={tokens}
                theme={theme}
                onEditDay={onEditDay}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Tabs({
  tabs,
  active,
  onChange,
  tokens,
}: {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
  tokens: ReturnType<typeof resolveTokens>;
}) {
  return (
    <div className="flex gap-1 items-center">
      {tabs.map((t) => {
        const isActive = t.id === active;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className="px-3.5 py-1.5 text-[11.5px] font-semibold uppercase tracking-[0.14em] rounded-md transition"
            style={{
              color: isActive ? "white" : tokens.mutedText,
              background: isActive ? tokens.accent : "transparent",
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

function TabPlaceholder({
  tokens,
  label,
}: {
  tokens: ReturnType<typeof resolveTokens>;
  label: string;
}) {
  return (
    <div
      className="rounded-md flex items-center justify-center text-[13px] italic"
      style={{
        aspectRatio: "3 / 2",
        background: tokens.cardBg,
        color: tokens.mutedText,
        border: `1px dashed ${tokens.border}`,
      }}
    >
      {label}
    </div>
  );
}

function tabPlaceholderLabel(tab: Tab, hasProperty: boolean): string {
  if (!hasProperty) return "Choose a property to see its details";
  switch (tab) {
    case "rooms":
      return "Room types will appear here";
    case "activities":
      return "Activities & services will appear here";
    case "information":
      return "Practical info will appear here";
    default:
      return "—";
  }
}

function FactBlock({
  icon,
  title,
  children,
  tokens,
  theme,
}: {
  icon: string;
  title: string;
  children: React.ReactNode;
  tokens: ReturnType<typeof resolveTokens>;
  theme: ChapterLayoutProps["proposal"]["theme"];
}) {
  return (
    <div className="mt-6">
      <div className="flex items-center gap-2.5 mb-3">
        <span
          className="w-7 h-7 rounded-full flex items-center justify-center text-[12px]"
          style={{
            background: `${tokens.accent}14`,
            color: tokens.accent,
            border: `1px solid ${tokens.accent}28`,
          }}
        >
          {icon}
        </span>
        <span
          className="text-[13px] font-semibold"
          style={{
            color: tokens.headingText,
            fontFamily: `'${theme.displayFont}', serif`,
          }}
        >
          {title}
        </span>
      </div>
      <div className="pl-10 space-y-1.5">{children}</div>
    </div>
  );
}

function Row({
  label,
  children,
  tokens,
}: {
  label: string;
  children: React.ReactNode;
  tokens: ReturnType<typeof resolveTokens>;
}) {
  return (
    <div className="flex gap-2 text-[12.5px]">
      <span className="font-semibold" style={{ color: tokens.headingText }}>
        {label}:
      </span>
      <span style={{ color: tokens.bodyText }}>{children}</span>
    </div>
  );
}
