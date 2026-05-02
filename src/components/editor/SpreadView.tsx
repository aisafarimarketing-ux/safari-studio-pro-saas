"use client";

import { useState } from "react";
import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import { resolveTokens } from "@/lib/theme";
import { orderDestinations } from "@/lib/destinationOrdering";
import type {
  Proposal,
  Section,
  Day,
  Property,
  TierKey,
  ThemeTokens,
  ProposalTheme,
  PracticalCard,
} from "@/lib/types";

// ─── SpreadView (data-driven) ───────────────────────────────────────────
//
// The two-column sticky-photo layout. Replaces the previous wrap-each-
// section approach because that left day-cards / property-blocks stuck
// in their own internal layouts — left/right scrolled at the same speed
// because the right column had no extra content.
//
// This version reads `proposal` directly and lays out FIXED chapters
// (Cover · Welcome · Map · Day-by-day · Where to stay · Pricing ·
// Good to know · Closing · Footer). Each chapter renders its own rows.
// The chapters that iterate sub-elements (Day-by-day → one row per day;
// Where to stay → one row per property) give each sub-element its own
// sticky-photo + scrolling-content row, so the spread feels alive as
// the photo cycles past every day / every lodge.
//
// Editing in spread mode:
//   - Trip title, dates, party — inline contentEditable, persisted
//     through updateTrip / updateClient.
//   - Day narrative + destination — inline, persisted via updateDay.
//   - Property descriptive fields — inline, persisted via updateProperty.
//   - Closing letter / availability — inline, persisted via
//     updateSectionContent on the closing section (so toggling back to
//     magazine view sees the same edits).
//   - Section variant switcher / per-section colour pills are
//     deliberately NOT exposed here — flipping back to magazine is
//     where operators do that work.
//
// What this view DOESN'T pull from `proposal.sections`:
//   – sections are the magazine flow's source of truth; in spread mode
//     we use proposal.cover (read from sections), proposal.days,
//     proposal.properties, proposal.trip, proposal.operator,
//     proposal.practicalInfo, and the closing section's content.
//   – dividers in the section list are ignored here; the chapter
//     headers (`DAY-BY-DAY`, `ACCOMMODATIONS`, …) take their place.

export function SpreadView() {
  const { proposal } = useProposalStore();
  const { mode } = useEditorStore();
  const isEditor = mode === "editor";
  const tokens = resolveTokens(proposal.theme.tokens);

  return (
    <div
      className="flex-1 overflow-auto"
      style={{
        background: tokens.pageBg,
        fontFamily: `'${proposal.theme.bodyFont}', sans-serif`,
      }}
    >
      <div className="mx-auto" style={{ maxWidth: 1280 }}>
        <CoverChapter proposal={proposal} isEditor={isEditor} tokens={tokens} />
        <WelcomeChapter proposal={proposal} isEditor={isEditor} tokens={tokens} />
        <MapChapter proposal={proposal} isEditor={isEditor} tokens={tokens} />
        <DayByDayChapter proposal={proposal} isEditor={isEditor} tokens={tokens} />
        <AccommodationsChapter proposal={proposal} isEditor={isEditor} tokens={tokens} />
        <PricingChapter proposal={proposal} isEditor={isEditor} tokens={tokens} />
        <GoodToKnowChapter proposal={proposal} isEditor={isEditor} tokens={tokens} />
        <ClosingChapter proposal={proposal} isEditor={isEditor} tokens={tokens} />
        <FooterStrip proposal={proposal} tokens={tokens} />
      </div>
    </div>
  );
}

// ─── Shared row primitives ───────────────────────────────────────────────

interface SpreadRowProps {
  imageUrl: string | null;
  imagePosition?: string;
  eyebrow?: string;
  label?: string;
  /** Bottom-left overlay text on the photo. Defaults to label. */
  overlay?: React.ReactNode;
  children: React.ReactNode;
  /** Override left-side aspect on small screens — defaults to a tall hero. */
  minHeight?: number;
}

// One row of the spread. Left column is `position: sticky` for the
// duration of the row; the photo pins as the right column scrolls
// past, then unpins when the next row starts. minHeight on the left
// cell handles small screens where the columns stack.
function SpreadRow({
  imageUrl,
  imagePosition,
  eyebrow,
  label,
  overlay,
  children,
  minHeight = 320,
}: SpreadRowProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 items-start">
      {/* Left — sticky photograph */}
      <div
        className="relative md:sticky md:top-0 md:h-screen overflow-hidden bg-black"
        style={{ minHeight }}
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            style={{ objectPosition: imagePosition || "50% 50%" }}
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center text-white/35 text-[12px] uppercase tracking-[0.22em]"
          >
            No photo
          </div>
        )}
        {/* Soft top-and-bottom gradient so overlay text reads. */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(0,0,0,0.32) 0%, rgba(0,0,0,0) 28%, rgba(0,0,0,0) 70%, rgba(0,0,0,0.50) 100%)",
          }}
        />
        <div className="absolute bottom-10 left-8 md:left-12 right-8 md:right-12 text-white">
          {overlay ? (
            overlay
          ) : (
            <>
              {eyebrow && (
                <div className="text-[12px] italic mb-2 opacity-85">{eyebrow}</div>
              )}
              {label && (
                <div
                  className="font-bold leading-[0.95] tracking-tight"
                  style={{
                    fontSize: "clamp(2rem, 4vw, 3.4rem)",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {label}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Right — scrolling content */}
      <div className="px-8 md:px-12 py-12 md:py-16 min-h-screen relative">
        {children}
      </div>
    </div>
  );
}

// Full-width chapter banner — used to separate Day-by-day, Accommodations
// etc. so the operator/guest know they're entering a new section group.
function ChapterBanner({
  label,
  subtitle,
  tokens,
  theme,
}: {
  label: string;
  subtitle?: string;
  tokens: ThemeTokens;
  theme: ProposalTheme;
}) {
  return (
    <div
      className="px-8 md:px-12 py-10 md:py-14 text-center"
      style={{ background: tokens.sectionSurface }}
    >
      <div
        className="text-[10.5px] uppercase tracking-[0.34em] font-semibold mb-2"
        style={{ color: tokens.mutedText }}
      >
        — Chapter
      </div>
      <h2
        className="font-bold leading-[1.05]"
        style={{
          color: tokens.headingText,
          fontFamily: `'${theme.displayFont}', serif`,
          fontSize: "clamp(1.8rem, 3.4vw, 2.6rem)",
          letterSpacing: "-0.01em",
        }}
      >
        {label}
      </h2>
      {subtitle && (
        <div
          className="text-[12.5px] uppercase tracking-[0.22em] font-semibold mt-2"
          style={{ color: tokens.accent }}
        >
          {subtitle}
        </div>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function findCoverSection(proposal: Proposal): Section | undefined {
  return proposal.sections.find((s) => s.type === "cover");
}
function findClosingSection(proposal: Proposal): Section | undefined {
  return proposal.sections.find((s) => s.type === "closing");
}
function findPersonalNoteSection(proposal: Proposal): Section | undefined {
  return proposal.sections.find((s) => s.type === "personalNote");
}

function coverHero(proposal: Proposal): string | null {
  const cover = findCoverSection(proposal);
  return (cover?.content?.heroImageUrl as string | undefined) ?? null;
}
function firstDayHero(proposal: Proposal): string | null {
  return (
    proposal.days
      .slice()
      .sort((a, b) => a.dayNumber - b.dayNumber)
      .find((d) => d.heroImageUrl)?.heroImageUrl ?? null
  );
}

function uniqueOrderedDestinations(proposal: Proposal): string[] {
  const fromDays = proposal.days
    .slice()
    .sort((a, b) => a.dayNumber - b.dayNumber)
    .map((d) => d.destination)
    .filter((s, i, arr) => i === 0 || s !== arr[i - 1]);
  const all = fromDays.length > 0 ? fromDays : proposal.trip.destinations ?? [];
  return orderDestinations(Array.from(new Set(all)));
}

function formatDuration(nights: number | undefined): string {
  if (!nights || nights < 1) return "—";
  return `${nights + 1} days · ${nights} nights`;
}

function formatParty(client: Proposal["client"]): string {
  const a = client.adults;
  const c = client.children;
  if (typeof a === "number" && a > 0) {
    const adultPart = `${a} ${a === 1 ? "adult" : "adults"}`;
    if (typeof c === "number" && c > 0) {
      const childPart = `${c} ${c === 1 ? "child" : "children"}`;
      return `${adultPart} + ${childPart}`;
    }
    return adultPart;
  }
  return client.pax || "—";
}

// ─── Chapters ────────────────────────────────────────────────────────────

function CoverChapter({
  proposal,
  isEditor,
  tokens,
}: {
  proposal: Proposal;
  isEditor: boolean;
  tokens: ThemeTokens;
}) {
  const { trip, client, theme } = proposal;
  const updateTrip = useProposalStore((s) => s.updateTrip);
  const updateClient = useProposalStore((s) => s.updateClient);
  const cover = findCoverSection(proposal);
  const heroUrl = (cover?.content?.heroImageUrl as string | undefined) ?? null;
  const heroPos = cover?.content?.heroImagePosition as string | undefined;
  const dests = uniqueOrderedDestinations(proposal);

  return (
    <SpreadRow
      imageUrl={heroUrl}
      imagePosition={heroPos}
      overlay={
        <>
          <div className="text-[12px] italic mb-2 opacity-85">— Your journey begins</div>
          <div
            className="font-bold leading-[0.95] tracking-tight"
            style={{
              fontFamily: `'${theme.displayFont}', serif`,
              fontSize: "clamp(2rem, 4.4vw, 3.6rem)",
              letterSpacing: "-0.01em",
            }}
          >
            {trip.title || "Your Safari"}
          </div>
          {dests.length > 0 && (
            <div className="text-[11px] uppercase tracking-[0.28em] mt-3 opacity-85">
              {dests.slice(0, 4).join(" · ")}
            </div>
          )}
        </>
      }
    >
      <div
        className="text-[10.5px] uppercase tracking-[0.32em] font-semibold mb-3"
        style={{ color: tokens.mutedText }}
      >
        — Welcome
      </div>
      <h1
        className="font-bold leading-[1.0] tracking-tight outline-none mb-6"
        style={{
          color: tokens.headingText,
          fontFamily: `'${theme.displayFont}', serif`,
          fontSize: "clamp(2rem, 3.8vw, 3.2rem)",
          letterSpacing: "-0.01em",
        }}
        contentEditable={isEditor}
        suppressContentEditableWarning
        onBlur={(e) =>
          updateTrip({ title: e.currentTarget.textContent?.trim() ?? trip.title })
        }
      >
        {trip.title || "Your Safari"}
      </h1>
      <div
        className="grid grid-cols-2 gap-x-6 gap-y-5 pt-6"
        style={{ borderTop: `1px solid ${tokens.border}` }}
      >
        <MetaCell label="For" tokens={tokens}>
          <span
            className="outline-none"
            contentEditable={isEditor}
            suppressContentEditableWarning
            onBlur={(e) =>
              updateClient({ guestNames: e.currentTarget.textContent?.trim() ?? client.guestNames })
            }
          >
            {client.guestNames || "Your Guests"}
          </span>
        </MetaCell>
        <MetaCell label="Dates" tokens={tokens}>
          <span
            className="outline-none"
            contentEditable={isEditor}
            suppressContentEditableWarning
            onBlur={(e) =>
              updateTrip({ dates: e.currentTarget.textContent?.trim() ?? trip.dates })
            }
          >
            {trip.dates || "—"}
          </span>
        </MetaCell>
        <MetaCell label="Duration" tokens={tokens}>
          {formatDuration(trip.nights)}
        </MetaCell>
        <MetaCell label="Party" tokens={tokens}>
          {formatParty(client)}
        </MetaCell>
      </div>
    </SpreadRow>
  );
}

function WelcomeChapter({
  proposal,
  isEditor,
  tokens,
}: {
  proposal: Proposal;
  isEditor: boolean;
  tokens: ThemeTokens;
}) {
  const { operator, theme } = proposal;
  const updateSectionContent = useProposalStore((s) => s.updateSectionContent);
  const note = findPersonalNoteSection(proposal);
  const consultantPhoto = operator.consultantPhoto || coverHero(proposal);
  if (!note) return null;
  const body =
    (note.content?.body as string) ||
    "Thank you for the opportunity to put this together for you. Please review the journey below and let me know what you'd like adjusted.";
  const opener = (note.content?.opener as string) || "";
  const signOff = (note.content?.signOff as string) || "Best regards,";

  return (
    <SpreadRow imageUrl={consultantPhoto} eyebrow="— A note from us" label="WELCOME">
      <div
        className="text-[10.5px] uppercase tracking-[0.32em] font-semibold mb-3"
        style={{ color: tokens.mutedText }}
      >
        — From your consultant
      </div>
      <h2
        className="font-bold leading-[1.1] mb-5"
        style={{
          color: tokens.headingText,
          fontFamily: `'${theme.displayFont}', serif`,
          fontSize: "clamp(1.6rem, 2.8vw, 2.2rem)",
          letterSpacing: "-0.005em",
        }}
      >
        {opener || `Dear ${proposal.client.guestNames?.split(/[,&]/)?.[0]?.trim() || "guest"},`}
      </h2>
      <p
        className="text-[14.5px] leading-[1.8] whitespace-pre-line outline-none"
        style={{ color: tokens.bodyText }}
        contentEditable={isEditor}
        suppressContentEditableWarning
        onBlur={(e) =>
          updateSectionContent(note.id, { body: e.currentTarget.textContent ?? "" })
        }
      >
        {body}
      </p>
      <div className="mt-7 flex items-center gap-3">
        {operator.signatureUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={operator.signatureUrl}
            alt="Signature"
            style={{ height: 36, maxWidth: 180, objectFit: "contain" }}
          />
        )}
        <div>
          <div
            className="text-[14px] font-semibold"
            style={{ color: tokens.headingText }}
          >
            {operator.consultantName || "Your consultant"}
          </div>
          <div className="text-[12px]" style={{ color: tokens.mutedText }}>
            {operator.consultantRole || ""}
          </div>
        </div>
      </div>
      <div className="mt-2 text-[12px] italic" style={{ color: tokens.mutedText }}>
        {signOff}
      </div>
    </SpreadRow>
  );
}

function MapChapter({
  proposal,
  isEditor,
  tokens,
}: {
  proposal: Proposal;
  isEditor: boolean;
  tokens: ThemeTokens;
}) {
  const { trip, theme } = proposal;
  void isEditor;
  const dests = uniqueOrderedDestinations(proposal);
  const route =
    dests.length > 1 ? `${dests[0]} to ${dests[dests.length - 1]}` : dests[0] ?? "";

  return (
    <SpreadRow
      imageUrl={firstDayHero(proposal) || coverHero(proposal)}
      eyebrow="— Itinerary details"
      label="MAP"
    >
      <div
        className="text-[10.5px] uppercase tracking-[0.32em] font-semibold mb-3"
        style={{ color: tokens.mutedText }}
      >
        — Visualise your journey
      </div>
      <h2
        className="font-bold leading-[1.1] mb-2"
        style={{
          color: tokens.headingText,
          fontFamily: `'${theme.displayFont}', serif`,
          fontSize: "clamp(1.7rem, 3vw, 2.4rem)",
          letterSpacing: "-0.005em",
        }}
      >
        Itinerary at a glance
      </h2>
      {route && (
        <div
          className="text-[12.5px] uppercase tracking-[0.22em] font-semibold mb-6"
          style={{ color: tokens.accent }}
        >
          {route}
        </div>
      )}
      <div
        className="text-[14px] leading-[1.75]"
        style={{ color: tokens.bodyText }}
      >
        {trip.subtitle ||
          `${proposal.days.length} days across ${dests.length} ${dests.length === 1 ? "stop" : "stops"}.`}
      </div>
      {dests.length > 0 && (
        <div className="mt-8 pt-6" style={{ borderTop: `1px solid ${tokens.border}` }}>
          <div
            className="text-[10.5px] uppercase tracking-[0.32em] font-semibold mb-3"
            style={{ color: tokens.mutedText }}
          >
            Key Areas of Interest
          </div>
          <ol className="space-y-2">
            {dests.map((d, i) => (
              <li
                key={d}
                className="flex items-baseline gap-3 text-[13.5px]"
                style={{ color: tokens.bodyText }}
              >
                <span
                  className="text-[11px] font-bold tabular-nums"
                  style={{ color: tokens.accent, minWidth: 22 }}
                >
                  {i + 1}.
                </span>
                <span>{d}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </SpreadRow>
  );
}

function DayByDayChapter({
  proposal,
  isEditor,
  tokens,
}: {
  proposal: Proposal;
  isEditor: boolean;
  tokens: ThemeTokens;
}) {
  const { theme, days } = proposal;
  const updateDay = useProposalStore((s) => s.updateDay);
  if (days.length === 0) return null;
  const sorted = [...days].sort((a, b) => a.dayNumber - b.dayNumber);

  return (
    <>
      <ChapterBanner
        label="Day by Day"
        subtitle={`${sorted.length} ${sorted.length === 1 ? "day" : "days"}`}
        tokens={tokens}
        theme={theme}
      />
      {sorted.map((day) => (
        <DayRow
          key={day.id}
          day={day}
          isEditor={isEditor}
          tokens={tokens}
          theme={theme}
          onUpdateDay={(patch) => updateDay(day.id, patch)}
        />
      ))}
    </>
  );
}

function DayRow({
  day,
  isEditor,
  tokens,
  theme,
  onUpdateDay,
}: {
  day: Day;
  isEditor: boolean;
  tokens: ThemeTokens;
  theme: ProposalTheme;
  onUpdateDay: (patch: Partial<Day>) => void;
}) {
  return (
    <SpreadRow
      imageUrl={day.heroImageUrl ?? null}
      imagePosition={day.heroImagePosition}
      overlay={
        <>
          <div className="text-[11px] uppercase tracking-[0.28em] mb-2 opacity-85 font-semibold">
            Day {day.dayNumber}
          </div>
          <div
            className="font-bold leading-[1.0] tracking-tight"
            style={{
              fontFamily: `'${theme.displayFont}', serif`,
              fontSize: "clamp(2rem, 4vw, 3.2rem)",
              letterSpacing: "-0.01em",
            }}
          >
            {day.destination || "Destination"}
          </div>
          {day.country && (
            <div className="text-[11px] uppercase tracking-[0.22em] mt-2 opacity-80">
              {day.country}
            </div>
          )}
        </>
      }
    >
      <div
        className="text-[10.5px] uppercase tracking-[0.32em] font-semibold mb-3"
        style={{ color: tokens.mutedText }}
      >
        Day {day.dayNumber}
      </div>
      <h3
        className="font-bold leading-[1.1] mb-2 outline-none"
        style={{
          color: tokens.headingText,
          fontFamily: `'${theme.displayFont}', serif`,
          fontSize: "clamp(1.7rem, 2.8vw, 2.2rem)",
          letterSpacing: "-0.005em",
        }}
        contentEditable={isEditor}
        suppressContentEditableWarning
        onBlur={(e) =>
          onUpdateDay({ destination: e.currentTarget.textContent?.trim() || day.destination })
        }
      >
        {day.destination}
      </h3>
      {(day.subtitle || isEditor) && (
        <div
          className="text-[13px] italic mb-5 outline-none"
          style={{ color: tokens.mutedText }}
          contentEditable={isEditor}
          suppressContentEditableWarning
          onBlur={(e) => onUpdateDay({ subtitle: e.currentTarget.textContent ?? "" })}
        >
          {day.subtitle || (isEditor ? "Day subtitle / phase label" : "")}
        </div>
      )}
      <p
        className="text-[14.5px] leading-[1.8] whitespace-pre-line outline-none"
        style={{ color: tokens.bodyText }}
        contentEditable={isEditor}
        suppressContentEditableWarning
        onBlur={(e) => onUpdateDay({ description: e.currentTarget.textContent ?? "" })}
      >
        {day.description || (isEditor ? "Describe the day…" : "")}
      </p>
      {(day.highlights ?? []).length > 0 && (
        <div className="mt-7 pt-6" style={{ borderTop: `1px solid ${tokens.border}` }}>
          <div
            className="text-[10.5px] uppercase tracking-[0.32em] font-semibold mb-3"
            style={{ color: tokens.mutedText }}
          >
            Highlights
          </div>
          <ul className="space-y-2">
            {(day.highlights ?? []).map((h, i) => (
              <li
                key={i}
                className="flex items-start gap-2.5 text-[13.5px]"
                style={{ color: tokens.bodyText }}
              >
                <span
                  className="mt-1.5 inline-block rounded-full"
                  style={{
                    width: 5,
                    height: 5,
                    background: tokens.accent,
                    flexShrink: 0,
                  }}
                  aria-hidden
                />
                <span>{h}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </SpreadRow>
  );
}

function AccommodationsChapter({
  proposal,
  isEditor,
  tokens,
}: {
  proposal: Proposal;
  isEditor: boolean;
  tokens: ThemeTokens;
}) {
  const { theme, days, properties, activeTier } = proposal;
  // Only properties referenced by the active tier's day picks — same
  // rule the magazine PropertyShowcaseSection follows.
  const referencedCampNames = new Set<string>();
  for (const d of days) {
    const camp = d.tiers?.[activeTier as TierKey]?.camp?.trim().toLowerCase();
    if (camp) referencedCampNames.add(camp);
  }
  const visible = properties.filter((p) =>
    referencedCampNames.has(p.name.trim().toLowerCase()),
  );
  if (visible.length === 0) return null;

  return (
    <>
      <ChapterBanner
        label="Where You'll Stay"
        subtitle={`${visible.length} ${visible.length === 1 ? "lodge" : "lodges"}`}
        tokens={tokens}
        theme={theme}
      />
      {visible.map((p) => (
        <PropertyRow
          key={p.id}
          property={p}
          proposal={proposal}
          isEditor={isEditor}
          tokens={tokens}
          theme={theme}
        />
      ))}
    </>
  );
}

function PropertyRow({
  property,
  proposal,
  isEditor,
  tokens,
  theme,
}: {
  property: Property;
  proposal: Proposal;
  isEditor: boolean;
  tokens: ThemeTokens;
  theme: ProposalTheme;
}) {
  const updateProperty = useProposalStore((s) => s.updateProperty);
  // Compute "Days 2-3" label for this property at the active tier.
  const lcName = property.name.trim().toLowerCase();
  const dayNums = proposal.days
    .filter(
      (d) => d.tiers?.[proposal.activeTier as TierKey]?.camp?.trim().toLowerCase() === lcName,
    )
    .map((d) => d.dayNumber)
    .sort((a, b) => a - b);
  const daysLabel = (() => {
    if (dayNums.length === 0) return "";
    const ranges: string[] = [];
    let start = dayNums[0];
    let prev = dayNums[0];
    for (let i = 1; i < dayNums.length; i++) {
      if (dayNums[i] === prev + 1) {
        prev = dayNums[i];
      } else {
        ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
        start = dayNums[i];
        prev = dayNums[i];
      }
    }
    ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
    return `Days ${ranges.join(", ")}`;
  })();
  const nightsCount = dayNums.length;

  return (
    <SpreadRow
      imageUrl={property.leadImageUrl ?? null}
      overlay={
        <>
          {property.propertyClass && (
            <div className="text-[10.5px] uppercase tracking-[0.32em] mb-2 opacity-85 font-semibold">
              {property.propertyClass}
            </div>
          )}
          <div
            className="font-bold leading-[1.0] tracking-tight"
            style={{
              fontFamily: `'${theme.displayFont}', serif`,
              fontSize: "clamp(1.8rem, 3.6vw, 2.8rem)",
              letterSpacing: "-0.01em",
            }}
          >
            {property.name || "Lodge"}
          </div>
          {property.location && (
            <div className="text-[11px] uppercase tracking-[0.22em] mt-2 opacity-80">
              {property.location}
            </div>
          )}
        </>
      }
    >
      <div
        className="text-[10.5px] uppercase tracking-[0.32em] font-semibold mb-3"
        style={{ color: tokens.mutedText }}
      >
        — Suggested resort
        {daysLabel && <span> · {daysLabel}</span>}
      </div>
      <h3
        className="font-bold leading-[1.1] mb-2"
        style={{
          color: tokens.headingText,
          fontFamily: `'${theme.displayFont}', serif`,
          fontSize: "clamp(1.7rem, 2.8vw, 2.2rem)",
          letterSpacing: "-0.005em",
        }}
      >
        {property.name}
      </h3>
      {property.whyWeChoseThis && (
        <div
          className="text-[14.5px] italic outline-none mb-5"
          style={{
            color: tokens.headingText,
            fontFamily: `'${theme.displayFont}', serif`,
            opacity: 0.9,
          }}
          contentEditable={isEditor}
          suppressContentEditableWarning
          onBlur={(e) =>
            updateProperty(property.id, {
              whyWeChoseThis: e.currentTarget.textContent?.trim() ?? "",
            })
          }
        >
          “{property.whyWeChoseThis}”
        </div>
      )}
      <p
        className="text-[14px] leading-[1.8] whitespace-pre-line outline-none"
        style={{ color: tokens.bodyText }}
        contentEditable={isEditor}
        suppressContentEditableWarning
        onBlur={(e) =>
          updateProperty(property.id, { description: e.currentTarget.textContent ?? "" })
        }
      >
        {property.description || (isEditor ? "Describe the property — setting, character, service, style…" : "")}
      </p>

      {/* Stay snapshot — Nights / Meal / Check-in / Check-out */}
      <div
        className="mt-7 pt-6 grid grid-cols-2 gap-x-6 gap-y-4"
        style={{ borderTop: `1px solid ${tokens.border}` }}
      >
        <MetaCell label="Nights" tokens={tokens}>
          {nightsCount ? String(nightsCount) : "—"}
        </MetaCell>
        <MetaCell label="Meal" tokens={tokens}>
          {property.mealPlan || "—"}
        </MetaCell>
        {property.checkInTime && (
          <MetaCell label="Check-in" tokens={tokens}>
            {property.checkInTime}
          </MetaCell>
        )}
        {property.checkOutTime && (
          <MetaCell label="Check-out" tokens={tokens}>
            {property.checkOutTime}
          </MetaCell>
        )}
      </div>

      {/* At-a-glance amenities */}
      {(property.amenities ?? []).length > 0 && (
        <div className="mt-7">
          <div
            className="text-[10.5px] uppercase tracking-[0.32em] font-semibold mb-3"
            style={{ color: tokens.mutedText }}
          >
            At a glance
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {(property.amenities ?? []).slice(0, 8).map((a) => (
              <span key={a} className="text-[13px]" style={{ color: tokens.bodyText }}>
                · {a}
              </span>
            ))}
          </div>
        </div>
      )}
    </SpreadRow>
  );
}

function PricingChapter({
  proposal,
  isEditor,
  tokens,
}: {
  proposal: Proposal;
  isEditor: boolean;
  tokens: ThemeTokens;
}) {
  const { theme, pricing, activeTier } = proposal;
  void isEditor;
  const tier = pricing?.[activeTier as TierKey];
  if (!tier) return null;

  return (
    <SpreadRow
      imageUrl={coverHero(proposal) || firstDayHero(proposal)}
      eyebrow="— Investment"
      label="PRICING"
    >
      <div
        className="text-[10.5px] uppercase tracking-[0.32em] font-semibold mb-3"
        style={{ color: tokens.mutedText }}
      >
        — Your investment
      </div>
      <h2
        className="font-bold leading-[1.1] mb-2"
        style={{
          color: tokens.headingText,
          fontFamily: `'${theme.displayFont}', serif`,
          fontSize: "clamp(1.7rem, 3vw, 2.4rem)",
          letterSpacing: "-0.005em",
        }}
      >
        {tier.label || "Total"}
      </h2>
      <div
        className="font-bold leading-[1.0] mt-3 mb-2"
        style={{
          color: tokens.accent,
          fontFamily: `'${theme.displayFont}', serif`,
          fontSize: "clamp(2.4rem, 4.6vw, 3.6rem)",
        }}
      >
        {tier.currency || "$"}
        {tier.pricePerPerson || "—"}
      </div>
      <div className="text-[12px]" style={{ color: tokens.mutedText }}>
        Per person, all-inclusive of the items below
      </div>
      {(proposal.inclusions?.length ?? 0) > 0 && (
        <div className="mt-7 pt-6" style={{ borderTop: `1px solid ${tokens.border}` }}>
          <div
            className="text-[10.5px] uppercase tracking-[0.32em] font-semibold mb-3"
            style={{ color: tokens.mutedText }}
          >
            Inclusions
          </div>
          <ul className="space-y-2">
            {proposal.inclusions.map((inc, i) => (
              <li
                key={i}
                className="flex items-start gap-2.5 text-[13.5px]"
                style={{ color: tokens.bodyText }}
              >
                <span
                  className="mt-1.5 inline-block rounded-full"
                  style={{
                    width: 5,
                    height: 5,
                    background: tokens.accent,
                    flexShrink: 0,
                  }}
                  aria-hidden
                />
                <span>{inc}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </SpreadRow>
  );
}

function GoodToKnowChapter({
  proposal,
  isEditor,
  tokens,
}: {
  proposal: Proposal;
  isEditor: boolean;
  tokens: ThemeTokens;
}) {
  const { theme, practicalInfo } = proposal;
  void isEditor;
  if (!practicalInfo || practicalInfo.length === 0) return null;

  return (
    <SpreadRow
      imageUrl={coverHero(proposal) || firstDayHero(proposal)}
      eyebrow="— Good to know"
      label="PRE-TRAVEL INFORMATION"
    >
      <div
        className="text-[10.5px] uppercase tracking-[0.32em] font-semibold mb-3"
        style={{ color: tokens.mutedText }}
      >
        — Prepare for your trip
      </div>
      <h2
        className="font-bold leading-[1.1] mb-6"
        style={{
          color: tokens.headingText,
          fontFamily: `'${theme.displayFont}', serif`,
          fontSize: "clamp(1.7rem, 3vw, 2.4rem)",
          letterSpacing: "-0.005em",
        }}
      >
        Pre-Travel Information
      </h2>
      <div className="space-y-2">
        {practicalInfo.map((card) => (
          <Accordion key={card.id} card={card} tokens={tokens} />
        ))}
      </div>
    </SpreadRow>
  );
}

function Accordion({
  card,
  tokens,
}: {
  card: PracticalCard;
  tokens: ThemeTokens;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: `1px solid ${tokens.border}` }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between py-3.5 text-left"
      >
        <span
          className="text-[14px] font-semibold"
          style={{ color: tokens.headingText }}
        >
          {card.title}
        </span>
        <span
          className="text-[16px] font-light transition-transform"
          style={{
            color: tokens.mutedText,
            transform: open ? "rotate(45deg)" : "rotate(0deg)",
          }}
          aria-hidden
        >
          +
        </span>
      </button>
      {open && (
        <div
          className="pb-4 text-[13.5px] leading-[1.75] whitespace-pre-line"
          style={{ color: tokens.bodyText }}
        >
          {card.body}
        </div>
      )}
    </div>
  );
}

function ClosingChapter({
  proposal,
  isEditor,
  tokens,
}: {
  proposal: Proposal;
  isEditor: boolean;
  tokens: ThemeTokens;
}) {
  const updateSectionContent = useProposalStore((s) => s.updateSectionContent);
  const closing = findClosingSection(proposal);
  if (!closing) return null;
  const { theme } = proposal;
  const themeImage =
    (closing.content?.themeImageUrl as string | undefined) || coverHero(proposal);
  const headline =
    (closing.content?.headline as string) ||
    `Your ${proposal.trip.destinations?.[0] || ""} journey is ready`.replace(/\s+/g, " ").trim();
  const letter =
    (closing.content?.letter as string) ||
    "Now please review every section and let me know what needs adjusting. I'll hold these camp dates while you confirm.";
  const ctaLabel = (closing.content?.ctaLabel as string) || "Secure This Safari";

  return (
    <SpreadRow
      imageUrl={themeImage}
      eyebrow="— Secure your trip"
      label={proposal.trip.tripStyle?.toUpperCase() || "READY?"}
    >
      <div
        className="text-[10.5px] uppercase tracking-[0.32em] font-semibold mb-3"
        style={{ color: tokens.mutedText }}
      >
        — One step left
      </div>
      <h2
        className="font-bold leading-[1.1] mb-5 outline-none"
        style={{
          color: tokens.headingText,
          fontFamily: `'${theme.displayFont}', serif`,
          fontSize: "clamp(1.8rem, 3.2vw, 2.6rem)",
          letterSpacing: "-0.005em",
        }}
        contentEditable={isEditor}
        suppressContentEditableWarning
        onBlur={(e) =>
          updateSectionContent(closing.id, {
            headline: e.currentTarget.textContent?.trim() ?? headline,
          })
        }
      >
        {headline}
      </h2>
      <p
        className="text-[14.5px] leading-[1.8] whitespace-pre-line outline-none mb-7"
        style={{ color: tokens.bodyText }}
        contentEditable={isEditor}
        suppressContentEditableWarning
        onBlur={(e) =>
          updateSectionContent(closing.id, { letter: e.currentTarget.textContent ?? "" })
        }
      >
        {letter}
      </p>
      <button
        type="button"
        className="inline-flex items-center gap-2.5 px-5 py-3 rounded-lg font-semibold transition shadow-md hover:shadow-lg active:scale-[0.99]"
        style={{
          background: tokens.accent,
          color: "#ffffff",
          fontSize: 14,
          letterSpacing: "0.04em",
        }}
      >
        <span>{ctaLabel}</span>
        <span aria-hidden style={{ opacity: 0.9 }}>
          →
        </span>
      </button>
    </SpreadRow>
  );
}

function FooterStrip({
  proposal,
  tokens,
}: {
  proposal: Proposal;
  tokens: ThemeTokens;
}) {
  const { operator } = proposal;
  return (
    <div
      className="px-8 md:px-12 py-5 flex items-center justify-between gap-4 flex-wrap"
      style={{
        background: tokens.sectionSurface,
        borderTop: `1px solid ${tokens.border}`,
      }}
    >
      <div
        className="text-[12.5px] font-medium"
        style={{ color: tokens.headingText }}
      >
        {operator.companyName || ""}
      </div>
      {operator.website && (
        <a
          href={
            /^https?:\/\//i.test(operator.website)
              ? operator.website
              : `https://${operator.website}`
          }
          target="_blank"
          rel="noopener noreferrer"
          className="text-[12px] hover:underline"
          style={{ color: tokens.accent }}
        >
          {operator.website}
        </a>
      )}
    </div>
  );
}

// ── Tiny meta cell — labelled value ──────────────────────────────────────

function MetaCell({
  label,
  tokens,
  children,
}: {
  label: string;
  tokens: ThemeTokens;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div
        className="text-[9.5px] uppercase tracking-[0.28em] font-semibold mb-1"
        style={{ color: tokens.mutedText }}
      >
        {label}
      </div>
      <div className="text-[13.5px]" style={{ color: tokens.headingText }}>
        {children}
      </div>
    </div>
  );
}
