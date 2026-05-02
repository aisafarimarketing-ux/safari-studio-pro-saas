"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import { resolveTokens } from "@/lib/theme";
import { orderDestinations } from "@/lib/destinationOrdering";
import { RouteRealMap } from "@/components/sections/RouteRealMap";
import { ChapterAIPill, type ChapterAIField } from "./ChapterAIPill";
import { ChapterColorPill } from "./ChapterColorPill";
import { SmartImage } from "@/components/ui/SmartImage";
import { pickSampleImageForDestination } from "@/lib/sampleDestinationImages";

// Tiny wrapper that anchors a chapter's hover-chrome (✦ AI · 🎨
// Colours) at the top-right of the right column. flex/gap-2 so two
// pills sit side-by-side without manual coordinates.
function ChapterChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute top-4 right-4 z-30 flex items-start gap-2 print:hidden">
      {children}
    </div>
  );
}
import { uploadImage } from "@/lib/uploadImage";
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
      {/* Full-bleed canvas — Safari-Portal-style: the spread hugs
          the viewport edges so the photo on the left and the
          content on the right feel like a magazine spread, not a
          centred card. Operator brief: "the screen is all cover
          from right to left split in the middle". */}
      <div className="w-full">
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
  /** When provided + isEditor, the photo becomes click-to-upload. Same
   *  upload pipeline as magazine view (compress → Supabase Storage with
   *  a data-URL fallback). */
  onImageUpload?: (url: string) => void;
  isEditor?: boolean;
  /** Right-column background. Each chapter passes its own
   *  tokens.sectionSurface (resolved with section overrides) so the
   *  Chapter Colours pill can repaint the right side. */
  rightBackground?: string;
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
  onImageUpload,
  isEditor,
  rightBackground,
}: SpreadRowProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 items-start">
      {/* Left — sticky photograph */}
      <StickyPhotoCell
        imageUrl={imageUrl}
        imagePosition={imagePosition}
        minHeight={minHeight}
        eyebrow={eyebrow}
        label={label}
        overlay={overlay}
        onImageUpload={onImageUpload}
        isEditor={isEditor}
        fallbackBg={rightBackground}
      />

      {/* Right — scrolling content. Background pulled from the
          chapter's resolved tokens.sectionSurface so the Colours
          pill recolours the right side of the spread visibly. */}
      <div
        className="px-8 md:px-12 py-12 md:py-16 min-h-screen relative"
        style={rightBackground ? { background: rightBackground } : undefined}
      >
        {children}
      </div>
    </div>
  );
}

// ─── Sticky photo cell with click-to-upload ─────────────────────────────
//
// One left-column sticky photo with the standard chrome:
//   • Soft top + bottom gradient so overlay text reads.
//   • Bottom-left overlay (eyebrow, label, custom overlay).
//   • Editor-only "Change image" pill top-right of the photo, with a
//     hidden file input. Click → file picker → uploadImage() → callback
//     → store action writes the new URL to wherever the parent says.
//   • If there's no image and we're in editor mode, the empty state
//     itself becomes a click-to-upload affordance so operators can
//     start from blank.

function StickyPhotoCell({
  imageUrl,
  imagePosition,
  minHeight = 320,
  eyebrow,
  label,
  overlay,
  onImageUpload,
  isEditor,
  fallbackBg,
}: {
  imageUrl: string | null;
  imagePosition?: string;
  minHeight?: number;
  eyebrow?: string;
  label?: string;
  overlay?: React.ReactNode;
  onImageUpload?: (url: string) => void;
  isEditor?: boolean;
  /** When set + imageUrl is missing, paint the cell with this colour
   *  instead of bg-black so the cell reads as intentional rather than
   *  as a broken cream rectangle in preview / share view. */
  fallbackBg?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const onFile = async (file: File | undefined) => {
    if (!file || !onImageUpload) return;
    setBusy(true);
    try {
      const url = await uploadImage(file);
      onImageUpload(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Image upload failed");
    } finally {
      setBusy(false);
    }
  };
  const editable = !!(isEditor && onImageUpload);
  return (
    <div
      className={`relative md:sticky md:top-0 md:h-screen overflow-hidden group ${imageUrl ? "bg-black" : ""}`}
      style={{
        minHeight,
        ...(imageUrl ? {} : fallbackBg ? { background: fallbackBg } : {}),
      }}
      onContextMenu={(e) => {
        if (!editable) return;
        e.preventDefault();
        inputRef.current?.click();
      }}
    >
      <SmartImage
        srcs={[imageUrl]}
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
        style={{ objectPosition: imagePosition || "50% 50%" }}
        fallback={
          editable ? (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="absolute inset-0 flex flex-col items-center justify-center text-white/65 hover:text-white transition cursor-pointer"
            >
              <div className="text-4xl mb-2 opacity-70">+</div>
              <div className="text-[11px] uppercase tracking-[0.22em] font-semibold">
                Click to upload photo
              </div>
              <div className="text-[10px] opacity-60 mt-1">or right-click to replace</div>
            </button>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-white/35 text-[12px] uppercase tracking-[0.22em]">
              No photo
            </div>
          )
        }
      />
      {/* Soft top-and-bottom gradient so overlay text reads. */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.32) 0%, rgba(0,0,0,0) 28%, rgba(0,0,0,0) 70%, rgba(0,0,0,0.50) 100%)",
        }}
      />
      {/* Editor: change-image pill, top-right, fade-in on hover. */}
      {editable && imageUrl && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="absolute top-4 right-4 z-20 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/60 backdrop-blur-sm text-white text-[10.5px] font-semibold opacity-0 group-hover:opacity-100 transition shadow-md hover:bg-black/80 disabled:opacity-60 print:hidden"
          title="Replace photo (or right-click anywhere on the image)"
        >
          {busy ? (
            <>
              <span className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              <span>Uploading…</span>
            </>
          ) : (
            <>
              <span aria-hidden>📷</span>
              <span>Change image</span>
            </>
          )}
        </button>
      )}
      {editable && (
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      )}
      {/* Bottom-left overlay text. */}
      <div className="absolute bottom-10 left-8 md:left-12 right-8 md:right-12 text-white pointer-events-none">
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
  // CRITICAL: filter empty strings as well as undefined/null. Autopilot
  // and the new-proposal defaults sometimes write "" for missing
  // images, and the original `?? null` only caught undefined/null —
  // empty string slipped through and broke every downstream fallback
  // chain that ended in `?? coverHero(proposal)`. Operator-flagged:
  // properties + days losing images in preview/webview.
  return nonEmptyUrl(cover?.content?.heroImageUrl as string | undefined);
}
function firstDayHero(proposal: Proposal): string | null {
  return (
    proposal.days
      .slice()
      .sort((a, b) => a.dayNumber - b.dayNumber)
      .map((d) => nonEmptyUrl(d.heroImageUrl))
      .find((u): u is string => u !== null) ?? null
  );
}
// Sample destination image — the *final* fallback. If the proposal
// has zero usable images anywhere (operator hasn't uploaded anything
// yet, or previous saves failed before image URLs reached the DB),
// we lookup a CC0 Unsplash image keyed by the destination string.
// Prefer a destination that's actually mentioned somewhere — the
// passed-in `destination` first, then the cover's destinations array,
// then any day's destination. Returns null only when every lookup
// also misses, which won't happen with the catalogue's __fallback__
// entry.
function destinationSampleUrl(
  proposal: Proposal,
  preferredDestination?: string,
): string | null {
  const tries: string[] = [];
  if (preferredDestination?.trim()) tries.push(preferredDestination);
  for (const d of proposal.trip?.destinations ?? []) {
    if (d?.trim()) tries.push(d);
  }
  for (const day of proposal.days) {
    if (day.destination?.trim()) tries.push(day.destination);
  }
  for (const t of tries) {
    const sample = pickSampleImageForDestination(t, { fallback: false });
    if (sample) return sample.url;
  }
  // Final fallback — generic Unsplash safari image (catalogue's
  // __fallback__ entry).
  return pickSampleImageForDestination("", { fallback: true })?.url ?? null;
}

// Last-ditch fallback for chapters that should never read as a
// completely empty slot in preview / share view. Walks every property
// snapshot, then every day's hero — the first non-empty URL we find
// is better than nothing.
function anyImageInProposal(proposal: Proposal): string | null {
  for (const p of proposal.properties) {
    const lead = nonEmptyUrl(p.leadImageUrl);
    if (lead) return lead;
    for (const g of p.galleryUrls ?? []) {
      const u = nonEmptyUrl(g);
      if (u) return u;
    }
  }
  return firstDayHero(proposal) ?? coverHero(proposal);
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
  tokens: _globalTokens,
}: {
  proposal: Proposal;
  isEditor: boolean;
  tokens: ThemeTokens;
}) {
  const { trip, client, theme } = proposal;
  const updateTrip = useProposalStore((s) => s.updateTrip);
  const updateClient = useProposalStore((s) => s.updateClient);
  const cover = findCoverSection(proposal);
  const updateSectionContent = useProposalStore((s) => s.updateSectionContent);
  const heroUrl = (cover?.content?.heroImageUrl as string | undefined) ?? null;
  const heroPos = cover?.content?.heroImagePosition as string | undefined;
  const dests = uniqueOrderedDestinations(proposal);
  void _globalTokens;
  // Local tokens — section's styleOverrides applied so the colour pill
  // writes are visible in spread immediately (and carry to magazine
  // when the operator flips back).
  const tokens = resolveTokens(theme.tokens, cover?.styleOverrides);

  return (
    <SpreadRow
      imageUrl={heroUrl}
      imagePosition={heroPos}
      isEditor={isEditor}
      rightBackground={tokens.sectionSurface}
      onImageUpload={
        cover
          ? (url) => updateSectionContent(cover.id, { heroImageUrl: url })
          : undefined
      }
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
      {isEditor && cover && (
        <ChapterChrome>
          <ChapterColorPill
            sectionId={cover.id}
            overrides={cover.styleOverrides ?? {}}
            fields={[
              { key: "sectionSurface", label: "Section background" },
              { key: "accent", label: "Accent" },
            ]}
          />
        </ChapterChrome>
      )}

      {/* Literary opener — operator-set quote + attribution. Renders
          as a magazine-style pull quote at the top of the cover.
          Hidden in non-editor mode when blank; in editor mode an
          empty placeholder hints at where to type. Same pattern
          Safari Portal uses ("India is a place where colour is
          doubly bright… — Kiran Millwood Hargrave"). */}
      {cover && (
        <CoverQuote
          quote={(cover.content?.literaryQuote as string | undefined) ?? ""}
          attribution={(cover.content?.literaryQuoteAttribution as string | undefined) ?? ""}
          isEditor={isEditor}
          tokens={tokens}
          theme={theme}
          onChangeQuote={(v) => updateSectionContent(cover.id, { literaryQuote: v })}
          onChangeAttribution={(v) =>
            updateSectionContent(cover.id, { literaryQuoteAttribution: v })
          }
        />
      )}

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
  tokens: _globalTokens,
}: {
  proposal: Proposal;
  isEditor: boolean;
  tokens: ThemeTokens;
}) {
  const { operator, theme } = proposal;
  const updateSectionContent = useProposalStore((s) => s.updateSectionContent);
  const note = findPersonalNoteSection(proposal);
  const consultantPhoto = operator.consultantPhoto || coverHero(proposal);
  void _globalTokens;
  const tokens = resolveTokens(theme.tokens, note?.styleOverrides);
  if (!note) return null;
  const body =
    (note.content?.body as string) ||
    "Thank you for the opportunity to put this together for you. Please review the journey below and let me know what you'd like adjusted.";
  const opener = (note.content?.opener as string) || "";
  const signOff = (note.content?.signOff as string) || "Best regards,";

  const buildAIFields = (): ChapterAIField[] => {
    const out: ChapterAIField[] = [];
    if (note.content?.body && (note.content.body as string).trim()) {
      out.push({
        key: `section:${note.id}:body`,
        text: note.content.body as string,
        target: { kind: "sectionContent", sectionId: note.id, field: "body" },
      });
    }
    if (note.content?.signOffLead && (note.content.signOffLead as string).trim()) {
      out.push({
        key: `section:${note.id}:signOffLead`,
        text: note.content.signOffLead as string,
        target: { kind: "sectionContent", sectionId: note.id, field: "signOffLead" },
      });
    }
    return out;
  };

  return (
    <SpreadRow
      imageUrl={consultantPhoto}
      eyebrow="— A note from us"
      label="WELCOME"
      isEditor={isEditor}
      rightBackground={tokens.sectionSurface}
      onImageUpload={(url) => useProposalStore.getState().updateOperator({ consultantPhoto: url })}
    >
      {isEditor && (
        <ChapterChrome>
          <ChapterAIPill
            chapterLabel="Welcome — Personal note"
            getFields={buildAIFields}
            context={{
              tripTitle: proposal.trip.title,
              destinations: proposal.trip.destinations,
              nights: proposal.trip.nights,
              tripStyle: proposal.trip.tripStyle,
              clientName: proposal.client.guestNames,
            }}
          />
          <ChapterColorPill
            sectionId={note.id}
            overrides={note.styleOverrides ?? {}}
            fields={[
              { key: "sectionSurface", label: "Section background" },
              { key: "accent", label: "Accent" },
            ]}
          />
        </ChapterChrome>
      )}
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
  tokens: _globalTokens,
}: {
  proposal: Proposal;
  isEditor: boolean;
  tokens: ThemeTokens;
}) {
  const { trip, theme, days, activeTier } = proposal;
  const dests = uniqueOrderedDestinations(proposal);
  const route =
    dests.length > 1 ? `${dests[0]} to ${dests[dests.length - 1]}` : dests[0] ?? "";
  // Map chapter borrows the map section's overrides for theming.
  const mapSection = proposal.sections.find((s) => s.type === "map");
  void _globalTokens;
  const tokens = resolveTokens(theme.tokens, mapSection?.styleOverrides);
  // Operator brief (this iteration): "move the map to the right and
  // have image on the left of destination". So left = sticky
  // destination hero, right = visualise copy + interactive map +
  // destinations list. Falls back to cover hero, then first day's
  // hero, when no map-specific image is set.
  const leftPhoto = coverHero(proposal) || firstDayHero(proposal);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 items-start">
      {/* Left — destination image, sticky for the chapter's scroll. */}
      <StickyPhotoCell
        imageUrl={leftPhoto}
        eyebrow="— Itinerary details"
        label="MAP"
        minHeight={360}
      />

      {/* Right — visualise-your-journey copy + interactive map +
          destinations list. The map sits inline in the right column
          so it scrolls naturally with the rest of the chapter. */}
      <div
        className="relative px-8 md:px-12 py-12 md:py-16 min-h-screen"
        style={{ background: tokens.sectionSurface }}
      >
        {isEditor && mapSection && (
          <ChapterChrome>
            <ChapterColorPill
              sectionId={mapSection.id}
              overrides={mapSection.styleOverrides ?? {}}
              fields={[
                { key: "sectionSurface", label: "Section background" },
                { key: "accent", label: "Accent" },
              ]}
            />
          </ChapterChrome>
        )}
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
          className="text-[14px] leading-[1.75] mb-7"
          style={{ color: tokens.bodyText }}
        >
          {trip.subtitle ||
            `${proposal.days.length} days across ${dests.length} ${dests.length === 1 ? "stop" : "stops"}.`}
        </div>

        {/* Interactive map — moved inline to the RIGHT column so the
            destination image holds the LEFT sticky pane. The map
            still gets full real-estate (16:10) and is interactive.
            Renders inside a relative wrapper so MapLibre's controls
            don't escape. */}
        <div
          className="relative w-full overflow-hidden rounded-md mb-6"
          style={{
            aspectRatio: "16 / 10",
            background: tokens.cardBg,
            border: `1px solid ${tokens.border}`,
          }}
        >
          {days.length > 0 ? (
            <RouteRealMap
              days={days}
              activeTier={activeTier as TierKey}
              tokens={tokens}
              theme={theme}
              isEditor={false}
            />
          ) : (
            <div
              className="absolute inset-0 flex items-center justify-center text-[12px] uppercase tracking-[0.22em]"
              style={{ color: tokens.mutedText }}
            >
              Add days to see the route
            </div>
          )}
        </div>

        {dests.length > 0 && (
          <div className="pt-6" style={{ borderTop: `1px solid ${tokens.border}` }}>
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

        {/* Key Dates — accommodations with their check-in dates,
            mirroring the Safari Portal example's "1) January 16:
            The Oberoi, Gurgaon" structure. Auto-derives from the
            day-by-day data: groups consecutive same-camp days, uses
            the FIRST day's date as the check-in. Hidden when no
            camps are assigned. */}
        <KeyDatesList proposal={proposal} tokens={tokens} />
      </div>
    </div>
  );
}

function DayByDayChapter({
  proposal,
  isEditor,
  tokens: _globalTokens,
}: {
  proposal: Proposal;
  isEditor: boolean;
  tokens: ThemeTokens;
}) {
  const { theme, days } = proposal;
  const updateDay = useProposalStore((s) => s.updateDay);
  const sorted = useMemo(
    () => [...days].sort((a, b) => a.dayNumber - b.dayNumber),
    [days],
  );
  const dayJourneySection = proposal.sections.find((s) => s.type === "dayJourney");
  void _globalTokens;
  const tokens = resolveTokens(theme.tokens, dayJourneySection?.styleOverrides);
  const [activeId, setActiveId] = useState<string | null>(sorted[0]?.id ?? null);
  if (days.length === 0) return null;

  const buildAIFields = (): ChapterAIField[] => {
    const out: ChapterAIField[] = [];
    for (const d of sorted) {
      if (d.description?.trim()) {
        out.push({
          key: `day:${d.id}:description`,
          text: d.description,
          target: { kind: "day", dayId: d.id, field: "description" },
        });
      }
      if (d.subtitle?.trim()) {
        out.push({
          key: `day:${d.id}:subtitle`,
          text: d.subtitle,
          target: { kind: "day", dayId: d.id, field: "subtitle" },
        });
      }
    }
    return out;
  };

  return (
    <CrossfadeChapter
      eyebrow="— Day by day"
      label="DAY-BY-DAY"
      tokens={tokens}
      theme={theme}
      items={sorted.map((d) => {
        // Build the FULL fallback chain so SmartImage can walk it on
        // load errors. Final tier: a sample destination image keyed
        // by the day's destination, so a day with no uploads still
        // renders a relevant Unsplash photo instead of an empty cell.
        const camp = d.tiers?.[proposal.activeTier as TierKey]?.camp?.trim().toLowerCase();
        const property = camp
          ? proposal.properties.find((p) => p.name.trim().toLowerCase() === camp)
          : null;
        const srcs = [
          nonEmptyUrl(d.heroImageUrl),
          nonEmptyUrl(property?.leadImageUrl),
          ...((property?.galleryUrls ?? []).map(nonEmptyUrl)),
          coverHero(proposal),
          anyImageInProposal(proposal),
          destinationSampleUrl(proposal, d.destination),
        ].filter((s): s is string => typeof s === "string");
        return {
          id: d.id,
          srcs,
          imagePosition: d.heroImagePosition,
        };
      })}
      activeId={activeId}
      isEditor={isEditor}
      rightBackground={tokens.sectionSurface}
      onActiveImageUpload={(dayId, url) => updateDay(dayId, { heroImageUrl: url })}
      topRightChrome={
        isEditor ? (
          <ChapterChrome>
            <ChapterAIPill
              chapterLabel="Day by Day"
              getFields={buildAIFields}
              context={{
                tripTitle: proposal.trip.title,
                destinations: proposal.trip.destinations,
                nights: proposal.trip.nights,
                tripStyle: proposal.trip.tripStyle,
                clientName: proposal.client.guestNames,
              }}
            />
            {dayJourneySection && (
              <ChapterColorPill
                sectionId={dayJourneySection.id}
                overrides={dayJourneySection.styleOverrides ?? {}}
                fields={[
                  { key: "sectionSurface", label: "Section background" },
                  { key: "cardBg", label: "Card background" },
                  { key: "accent", label: "Accent" },
                ]}
              />
            )}
          </ChapterChrome>
        ) : null
      }
      activeOverlay={(() => {
        const day = sorted.find((d) => d.id === activeId) ?? sorted[0];
        return (
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
        );
      })()}
    >
      {/* Itinerary at a glance — condensed date-by-date list at the
          top of the chapter so the operator and guest can scan the
          whole trip arc in a screen before scrolling through the
          per-day deep-dives below. Mirrors what Safari Portal puts
          at the top of their itinerary chapter; ours auto-pulls from
          proposal.days + trip.arrivalDate. */}
      <ItineraryAtAGlance
        days={sorted}
        proposal={proposal}
        tokens={tokens}
        theme={theme}
      />

      {sorted.map((day, idx) => (
        <DayInlineBlock
          key={day.id}
          day={day}
          proposal={proposal}
          isFirst={idx === 0}
          isEditor={isEditor}
          tokens={tokens}
          theme={theme}
          onActive={() => setActiveId(day.id)}
          onUpdateDay={(patch) => updateDay(day.id, patch)}
        />
      ))}
    </CrossfadeChapter>
  );
}

// ─── ItineraryAtAGlance ─────────────────────────────────────────────────
//
// Tight day-by-date list rendered above the Day-by-Day deep-dive in
// spread mode. Pulls everything from existing data:
//   • Day number + computed date (trip.arrivalDate + offset)
//   • Headline activity (day.subtitle, falls back to destination)
//   • Overnight lodge (day.tiers[activeTier].camp)
//
// Same convention Safari Portal's "Itinerary at a glance" follows;
// ours is structured + automatic so operators don't maintain it by
// hand. Hidden when there are 0 days.

function ItineraryAtAGlance({
  days,
  proposal,
  tokens,
  theme,
}: {
  days: Day[];
  proposal: Proposal;
  tokens: ThemeTokens;
  theme: ProposalTheme;
}) {
  if (days.length === 0) return null;
  const arrivalISO = proposal.trip?.arrivalDate;
  return (
    <div
      className="mb-12 pb-10"
      style={{ borderBottom: `1px solid ${tokens.border}` }}
    >
      <div
        className="text-[10.5px] uppercase tracking-[0.32em] font-semibold mb-4"
        style={{ color: tokens.mutedText }}
      >
        — Itinerary at a glance
      </div>
      <div className="space-y-3">
        {days.map((d) => {
          const dateLabel = computeDayDateLabel(d, arrivalISO);
          const headline =
            d.subtitle?.trim() || d.destination?.trim() || `Day ${d.dayNumber}`;
          const camp = d.tiers?.[proposal.activeTier as TierKey]?.camp?.trim();
          return (
            <div
              key={d.id}
              className="grid grid-cols-[64px_minmax(0,1fr)] gap-4 items-baseline"
            >
              <div
                className="text-[11px] uppercase tracking-[0.18em] font-bold tabular-nums"
                style={{ color: tokens.accent }}
              >
                {dateLabel || `Day ${d.dayNumber}`}
              </div>
              <div className="min-w-0">
                <div
                  className="text-[14px] font-semibold leading-snug"
                  style={{
                    color: tokens.headingText,
                    fontFamily: `'${theme.displayFont}', serif`,
                  }}
                >
                  {headline}
                </div>
                {camp && (
                  <div
                    className="text-[11.5px] mt-0.5"
                    style={{ color: tokens.mutedText }}
                  >
                    Overnight · {camp}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Compute the calendar label for a day. Prefers an operator-typed
// `day.date` when set; falls back to trip.arrivalDate + (dayNumber - 1).
// Returns a short "Jan 16" form so the at-a-glance list reads at a
// glance.
function computeDayDateLabel(day: Day, arrivalISO: string | undefined): string {
  if (day.date?.trim()) {
    const parsed = parseISODate(day.date);
    if (parsed) return shortDate(parsed);
    return day.date.trim();
  }
  if (!arrivalISO) return "";
  const start = parseISODate(arrivalISO);
  if (!start) return "";
  start.setUTCDate(start.getUTCDate() + Math.max(0, day.dayNumber - 1));
  return shortDate(start);
}

function nonEmptyUrl(s: string | null | undefined): string | null {
  if (typeof s !== "string") return null;
  const t = s.trim();
  return t.length > 0 ? t : null;
}

function parseISODate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return isNaN(d.getTime()) ? null : d;
}

function shortDate(d: Date): string {
  const month = d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  const day = d.toLocaleDateString("en-US", { day: "numeric", timeZone: "UTC" });
  return `${month} ${day}`;
}

// Long form: "January 16" — used in Key Dates where the date column
// is the focal element of each row.
function longDate(d: Date): string {
  const month = d.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });
  const day = d.toLocaleDateString("en-US", { day: "numeric", timeZone: "UTC" });
  return `${month} ${day}`;
}

// ─── CoverQuote ─────────────────────────────────────────────────────────
//
// Magazine-style literary pull quote at the top of the Cover chapter.
// Operator-curated; falls through to nothing when blank in client
// view, or shows a hint placeholder in editor mode so operators see
// the slot. Two contentEditable spans — quote body + attribution.

function CoverQuote({
  quote,
  attribution,
  isEditor,
  tokens,
  theme,
  onChangeQuote,
  onChangeAttribution,
}: {
  quote: string;
  attribution: string;
  isEditor: boolean;
  tokens: ThemeTokens;
  theme: ProposalTheme;
  onChangeQuote: (v: string) => void;
  onChangeAttribution: (v: string) => void;
}) {
  if (!quote.trim() && !isEditor) return null;
  return (
    <div className="mb-10 max-w-[34ch]">
      <blockquote
        className="text-[18px] md:text-[20px] italic leading-[1.45] outline-none"
        style={{
          color: tokens.headingText,
          fontFamily: `'${theme.displayFont}', serif`,
          opacity: quote.trim() ? 0.92 : 0.45,
        }}
        contentEditable={isEditor}
        suppressContentEditableWarning
        onBlur={(e) => onChangeQuote(e.currentTarget.textContent?.trim() ?? "")}
      >
        {quote ||
          (isEditor
            ? "“A literary line that captures the trip's spirit.”"
            : "")}
      </blockquote>
      {(attribution.trim() || isEditor) && (
        <div
          className="mt-2 text-[12.5px] outline-none"
          style={{ color: tokens.mutedText, opacity: attribution.trim() ? 1 : 0.6 }}
          contentEditable={isEditor}
          suppressContentEditableWarning
          onBlur={(e) => onChangeAttribution(e.currentTarget.textContent?.trim() ?? "")}
        >
          {attribution || (isEditor ? "— Author / source" : "")}
        </div>
      )}
    </div>
  );
}

// ─── KeyDatesList ───────────────────────────────────────────────────────
//
// Accommodations enumerated with check-in dates — mirrors Safari
// Portal's "1) January 16: The Oberoi, Gurgaon" pattern at the foot
// of the Map chapter. Auto-derived from days[] + trip.arrivalDate:
// consecutive days at the same camp collapse into one row using the
// FIRST day's date.

function KeyDatesList({
  proposal,
  tokens,
}: {
  proposal: Proposal;
  tokens: ThemeTokens;
}) {
  const sorted = [...proposal.days].sort((a, b) => a.dayNumber - b.dayNumber);
  const arrivalISO = proposal.trip?.arrivalDate;

  // Walk days, group consecutive same-camp runs.
  const stays: Array<{ day: Day; camp: string }> = [];
  for (const d of sorted) {
    const camp = d.tiers?.[proposal.activeTier as TierKey]?.camp?.trim();
    if (!camp) continue;
    const prev = stays[stays.length - 1];
    if (prev && prev.camp.toLowerCase() === camp.toLowerCase()) continue;
    stays.push({ day: d, camp });
  }
  if (stays.length === 0) return null;

  return (
    <div className="mt-8 pt-6" style={{ borderTop: `1px solid ${tokens.border}` }}>
      <div
        className="text-[10.5px] uppercase tracking-[0.32em] font-semibold mb-3"
        style={{ color: tokens.mutedText }}
      >
        Key Dates
      </div>
      <ol className="space-y-2.5">
        {stays.map((s, i) => {
          const explicit = s.day.date?.trim();
          let dateLabel = "";
          if (explicit) {
            const parsed = parseISODate(explicit);
            dateLabel = parsed ? longDate(parsed) : explicit;
          } else if (arrivalISO) {
            const start = parseISODate(arrivalISO);
            if (start) {
              start.setUTCDate(start.getUTCDate() + Math.max(0, s.day.dayNumber - 1));
              dateLabel = longDate(start);
            }
          }
          return (
            <li
              key={s.day.id}
              className="grid grid-cols-[28px_minmax(0,1fr)] gap-2 items-baseline text-[13.5px]"
              style={{ color: tokens.bodyText }}
            >
              <span
                className="text-[11px] font-bold tabular-nums"
                style={{ color: tokens.accent }}
              >
                {i + 1})
              </span>
              <span>
                <span className="font-semibold">{dateLabel || `Day ${s.day.dayNumber}`}</span>
                {dateLabel && <span>: </span>}
                {!dateLabel && <span> · </span>}
                {s.camp}
                {s.day.destination && (
                  <span style={{ color: tokens.mutedText }}>, {s.day.destination}</span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// One day block on the right column. Reports its in-view state up to
// the chapter so the chapter's left photo can crossfade. Uses
// IntersectionObserver against a sticky-aware threshold so we pick
// the day whose top is roughly aligned with the middle of the
// viewport.
function DayInlineBlock({
  day,
  proposal,
  isFirst,
  isEditor,
  tokens,
  theme,
  onActive,
  onUpdateDay,
}: {
  day: Day;
  proposal: Proposal;
  isFirst: boolean;
  isEditor: boolean;
  tokens: ThemeTokens;
  theme: ProposalTheme;
  onActive: () => void;
  onUpdateDay: (patch: Partial<Day>) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) onActive();
        }
      },
      // Trigger when the block is in the middle 40% of the viewport
      // — gives a clean swap as each day passes the eye-line, with
      // no flicker when partial views overlap.
      { rootMargin: "-30% 0px -55% 0px", threshold: [0, 0.5, 1] },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [onActive]);

  return (
    <div
      ref={ref}
      className={`pb-24 ${isFirst ? "pt-2" : "pt-16 mt-12"}`}
      style={{
        // ~2 viewports per day so the sticky photo on the left has
        // real scroll distance to live through. Operator counted "32
        // scrolls for 16 images" on Safari Portal — that's the
        // density we're matching.
        minHeight: "150vh",
        ...(isFirst ? {} : { borderTop: `1px solid ${tokens.border}` }),
      }}
    >
      {day.driveTimeBefore && !isFirst && (
        <div
          className="text-[11px] italic mb-4"
          style={{ color: tokens.mutedText }}
        >
          → {day.driveTimeBefore}
        </div>
      )}
      <div
        className="text-[10.5px] uppercase tracking-[0.32em] font-semibold mb-2"
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
        <div className="mt-6 pt-5" style={{ borderTop: `1px solid ${tokens.border}` }}>
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

      {/* Stay card — the property assigned to this day at the active
          tier. Surfaces the lead image + name + meta inline so the
          spread shows what the day's daycard equivalent shows: "you'll
          sleep here". The full property details still live in the
          dedicated Accommodations chapter; this is the small reference
          beside the day's narrative. Hidden when no property is
          assigned. */}
      <DayStayCard day={day} proposal={proposal} tokens={tokens} theme={theme} />
    </div>
  );
}

// Small property reference card under each day's narrative. Reads the
// property assigned to the day at the active tier; case-insensitive
// match against proposal.properties. Renders nothing when no property
// is matched (free-text camp names without a library record).
function DayStayCard({
  day,
  proposal,
  tokens,
  theme,
}: {
  day: Day;
  proposal: Proposal;
  tokens: ThemeTokens;
  theme: ProposalTheme;
}) {
  const tierAssignment = day.tiers?.[proposal.activeTier as TierKey];
  const campName = tierAssignment?.camp?.trim();
  if (!campName) return null;
  const property = proposal.properties.find(
    (p) => p.name.trim().toLowerCase() === campName.toLowerCase(),
  );
  // Even without a library match, still show the camp name so guests
  // know where they're staying. SmartImage walks the candidate chain
  // (property lead → gallery → day hero) and falls through on load
  // errors so a stale Supabase URL doesn't render as a blank cell.
  const location = property?.location || tierAssignment?.location || "";
  const summary = property?.shortDesc || property?.whyWeChoseThis || "";

  return (
    <div
      className="mt-8 pt-6"
      style={{ borderTop: `1px solid ${tokens.border}` }}
    >
      <div
        className="text-[10.5px] uppercase tracking-[0.32em] font-semibold mb-3"
        style={{ color: tokens.mutedText }}
      >
        — Where you&rsquo;ll stay
      </div>
      <div
        className="grid grid-cols-[112px_minmax(0,1fr)] gap-4 items-center rounded-lg overflow-hidden"
        style={{ background: tokens.cardBg, border: `1px solid ${tokens.border}` }}
      >
        <div
          className="relative overflow-hidden"
          style={{ aspectRatio: "4 / 5", background: tokens.sectionSurface }}
        >
          <SmartImage
            srcs={[
              property?.leadImageUrl,
              ...(property?.galleryUrls ?? []),
              day.heroImageUrl,
              destinationSampleUrl(proposal, day.destination),
            ]}
            alt={property?.name ?? campName}
            className="absolute inset-0 w-full h-full object-cover"
            fallback={
              <div
                className="absolute inset-0 flex items-center justify-center text-[10px] uppercase tracking-[0.22em]"
                style={{ color: tokens.mutedText }}
              >
                No photo
              </div>
            }
          />
        </div>
        <div className="pr-4 py-3 min-w-0">
          <div
            className="text-[14px] font-bold leading-tight truncate"
            style={{
              color: tokens.headingText,
              fontFamily: `'${theme.displayFont}', serif`,
            }}
            title={property?.name ?? campName}
          >
            {property?.name ?? campName}
          </div>
          {location && (
            <div
              className="text-[11px] italic mt-0.5 truncate"
              style={{ color: tokens.mutedText }}
            >
              {location}
            </div>
          )}
          {summary && (
            <div
              className="text-[12.5px] leading-snug mt-2 line-clamp-2"
              style={{ color: tokens.bodyText }}
            >
              {summary}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── CrossfadeChapter ───────────────────────────────────────────────────
//
// One sticky-photo column on the left that crossfades between the
// images of multiple sub-blocks (days, properties) as those blocks
// scroll past on the right. This is the Safari Portal trick — the
// left-side scrolls SLOWER than the right because the photo pins for
// the whole chapter while the right column carries N sub-blocks.
//
// Items provide just an id + image URL. The chapter renders all
// images stacked in the sticky pane and toggles their opacity by
// activeId. Children (the right column) are responsible for setting
// activeId via IntersectionObserver as they scroll past.

function CrossfadeChapter({
  eyebrow,
  label,
  tokens,
  theme,
  items,
  activeId,
  activeOverlay,
  topRightChrome,
  isEditor,
  onActiveImageUpload,
  rightBackground,
  children,
}: {
  eyebrow?: string;
  label?: string;
  tokens: ThemeTokens;
  theme: ProposalTheme;
  items: Array<{
    id: string;
    /** Ordered list of fallback URLs. SmartImage walks them on
     *  load error (404, expired Supabase URL, CORS, etc.) so a
     *  broken-but-non-empty src doesn't render as a blank cell. */
    srcs: string[];
    imagePosition?: string;
  }>;
  activeId: string | null;
  /** Bottom-left text overlay for whichever item is active. */
  activeOverlay?: React.ReactNode;
  /** Editor-only floating chrome top-right of the right column. The
   *  ChapterAIPill renders here in editor mode; null in share / print. */
  topRightChrome?: React.ReactNode;
  /** Editor-only. Click on the active sticky photo → file picker →
   *  uploadImage → callback fires with the active item's id + new URL.
   *  Parent wires it to updateDay / updateProperty. */
  isEditor?: boolean;
  onActiveImageUpload?: (itemId: string, url: string) => void;
  /** Right-column background — pulled from the chapter's resolved
   *  tokens.sectionSurface so the Colours pill recolours visibly. */
  rightBackground?: string;
  children: React.ReactNode;
}) {
  void theme;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  // SAFE-ACTIVE-ID: when the activeId from props doesn't match any
  // current item — either because IntersectionObserver hasn't fired
  // yet on first paint (preview/share mode), the items list changed
  // shape (operator added/removed a property), or the parent's
  // useState initial value got computed before hydration — fall back
  // to the FIRST item. Without this, every item's opacity is 0 and
  // the chapter renders as a blank/colored cell with no photo. THIS
  // is the actual root cause of "images don't show in preview" that
  // we've been chasing — the data was always there, but the opacity
  // gate hid every item.
  const safeActiveId =
    items.find((it) => it.id === activeId)?.id ?? items[0]?.id ?? null;
  const editable = !!(isEditor && onActiveImageUpload && safeActiveId);
  const onFile = async (file: File | undefined) => {
    if (!file || !safeActiveId || !onActiveImageUpload) return;
    setBusy(true);
    try {
      const url = await uploadImage(file);
      onActiveImageUpload(safeActiveId, url);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Image upload failed");
    } finally {
      setBusy(false);
    }
  };

  // Whether the active item resolves to a real image URL. When ALL
  // fallback tiers fail (proposal has zero usable images anywhere) we
  // paint the photo cell with the chapter's section surface so it
  // reads as intentional rather than as a broken empty rectangle.
  const activeHasImage =
    (items.find((it) => it.id === safeActiveId)?.srcs ?? []).filter(
      (s) => s && s.trim().length > 0,
    ).length > 0;
  const fallbackBg = rightBackground || tokens.sectionSurface;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 items-start">
      {/* Sticky photo pane — all images stacked, only the active one
          visible. Opacity transition gives a clean crossfade as
          IntersectionObserver toggles activeId. */}
      <div
        className={`relative md:sticky md:top-0 md:h-screen overflow-hidden group ${activeHasImage ? "bg-black" : ""}`}
        style={{
          minHeight: 360,
          ...(activeHasImage ? {} : { background: fallbackBg }),
        }}
        onContextMenu={(e) => {
          if (!editable) return;
          e.preventDefault();
          inputRef.current?.click();
        }}
      >
        {items.map((it) => (
          <div
            key={it.id}
            className="absolute inset-0 transition-opacity duration-500"
            style={{ opacity: it.id === safeActiveId ? 1 : 0 }}
            aria-hidden={it.id !== safeActiveId}
          >
            <SmartImage
              srcs={it.srcs}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              style={{ objectPosition: it.imagePosition || "50% 50%" }}
              fallback={
                it.id === safeActiveId && editable ? (
                  <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    className="absolute inset-0 flex flex-col items-center justify-center text-white/65 hover:text-white transition cursor-pointer"
                  >
                    <div className="text-4xl mb-2 opacity-70">+</div>
                    <div className="text-[11px] uppercase tracking-[0.22em] font-semibold">
                      Click to upload photo
                    </div>
                  </button>
                ) : null
              }
            />
          </div>
        ))}
        {/* Soft top-and-bottom gradient so overlay text reads. */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(to bottom, rgba(0,0,0,0.32) 0%, rgba(0,0,0,0) 28%, rgba(0,0,0,0) 70%, rgba(0,0,0,0.50) 100%)",
          }}
        />
        {/* Change-image pill — fades in on hover when editable AND the
            active item already has at least one fallback URL. */}
        {editable && (items.find((i) => i.id === safeActiveId)?.srcs ?? []).some((s) => s?.trim()) && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="absolute top-4 right-4 z-20 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/60 backdrop-blur-sm text-white text-[10.5px] font-semibold opacity-0 group-hover:opacity-100 transition shadow-md hover:bg-black/80 disabled:opacity-60 print:hidden"
            title="Replace photo for this item (or right-click)"
          >
            {busy ? (
              <>
                <span className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                <span>Uploading…</span>
              </>
            ) : (
              <>
                <span aria-hidden>📷</span>
                <span>Change image</span>
              </>
            )}
          </button>
        )}
        {editable && (
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        )}
        <div className="absolute bottom-10 left-8 md:left-12 right-8 md:right-12 text-white pointer-events-none">
          {activeOverlay ? (
            activeOverlay
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

      {/* Right column — stacked sub-blocks. Each block's
          IntersectionObserver swaps the sticky image to its own. */}
      <div
        className="relative px-8 md:px-12 py-12 md:py-16"
        style={rightBackground ? { background: rightBackground } : undefined}
      >
        {topRightChrome}
        <div
          className="text-[10.5px] uppercase tracking-[0.32em] font-semibold mb-2"
          style={{ color: tokens.mutedText }}
        >
          {eyebrow || ""}
        </div>
        {label && (
          <h2
            className="font-bold leading-[1.05] mb-10"
            style={{
              color: tokens.headingText,
              fontFamily: "inherit",
              fontSize: "clamp(1.6rem, 2.8vw, 2.2rem)",
              letterSpacing: "-0.005em",
            }}
          >
            {label === "DAY-BY-DAY" ? "Day by Day" : label === "ACCOMMODATIONS" ? "Where You'll Stay" : label}
          </h2>
        )}
        {children}
      </div>
    </div>
  );
}

function AccommodationsChapter({
  proposal,
  isEditor,
  tokens: _globalTokens,
}: {
  proposal: Proposal;
  isEditor: boolean;
  tokens: ThemeTokens;
}) {
  const { theme, days, properties, activeTier } = proposal;
  const updateProperty = useProposalStore((s) => s.updateProperty);
  const showcaseSection = proposal.sections.find((s) => s.type === "propertyShowcase");
  void _globalTokens;
  const tokens = resolveTokens(theme.tokens, showcaseSection?.styleOverrides);
  // Only properties referenced by the active tier's day picks — same
  // rule the magazine PropertyShowcaseSection follows.
  const referencedCampNames = new Set<string>();
  for (const d of days) {
    const camp = d.tiers?.[activeTier as TierKey]?.camp?.trim().toLowerCase();
    if (camp) referencedCampNames.add(camp);
  }
  const visible = useMemo(
    () => properties.filter((p) => referencedCampNames.has(p.name.trim().toLowerCase())),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [properties, activeTier, days],
  );
  const [activeId, setActiveId] = useState<string | null>(visible[0]?.id ?? null);
  if (visible.length === 0) return null;
  const active = visible.find((p) => p.id === activeId) ?? visible[0];

  const buildAIFields = (): ChapterAIField[] => {
    const out: ChapterAIField[] = [];
    for (const p of visible) {
      if (p.description?.trim()) {
        out.push({
          key: `property:${p.id}:description`,
          text: p.description,
          target: { kind: "property", propertyId: p.id, field: "description" },
        });
      }
      if (p.whyWeChoseThis?.trim()) {
        out.push({
          key: `property:${p.id}:whyWeChoseThis`,
          text: p.whyWeChoseThis,
          target: { kind: "property", propertyId: p.id, field: "whyWeChoseThis" },
        });
      }
      if (p.shortDesc?.trim()) {
        out.push({
          key: `property:${p.id}:shortDesc`,
          text: p.shortDesc,
          target: { kind: "property", propertyId: p.id, field: "shortDesc" },
        });
      }
    }
    return out;
  };

  return (
    <CrossfadeChapter
      eyebrow="— Where you'll stay"
      label="ACCOMMODATIONS"
      tokens={tokens}
      theme={theme}
      items={visible.map((p) => {
        // Image fallback chain — leadImageUrl → first gallery URL
        // → first day's hero where this property is assigned →
        // cover hero. Empty strings (autopilot's legacy fallback)
        // coerce to null. Operator-flagged: "some properties in
        // the property section lose their images completely in
        // preview / webview".
        const lcName = p.name.trim().toLowerCase();
        const dayHero = nonEmptyUrl(
          proposal.days.find(
            (d) =>
              d.tiers?.[proposal.activeTier as TierKey]?.camp?.trim().toLowerCase() ===
              lcName,
          )?.heroImageUrl,
        );
        // Build the FULL fallback chain (not just the first
        // non-empty). SmartImage walks this on each load error so a
        // stale-but-non-empty Supabase URL falls through to the next
        // candidate, instead of rendering as a blank cell. Final
        // tier: a sample destination image keyed by the property's
        // location, so even an empty proposal (operator hasn't
        // uploaded anything yet) shows real imagery.
        const propertyDestination =
          p.location?.split(",")[0]?.trim() ||
          proposal.days.find(
            (d) =>
              d.tiers?.[proposal.activeTier as TierKey]?.camp?.trim().toLowerCase() ===
              lcName,
          )?.destination ||
          undefined;
        const srcs = [
          nonEmptyUrl(p.leadImageUrl),
          ...(p.galleryUrls ?? []).map(nonEmptyUrl),
          dayHero,
          coverHero(proposal),
          anyImageInProposal(proposal),
          destinationSampleUrl(proposal, propertyDestination),
        ].filter((s): s is string => typeof s === "string");
        return { id: p.id, srcs };
      })}
      activeId={activeId}
      isEditor={isEditor}
      rightBackground={tokens.sectionSurface}
      onActiveImageUpload={(propertyId, url) =>
        updateProperty(propertyId, { leadImageUrl: url })
      }
      topRightChrome={
        isEditor ? (
          <ChapterChrome>
            <ChapterAIPill
              chapterLabel="Where You'll Stay"
              getFields={buildAIFields}
              context={{
                tripTitle: proposal.trip.title,
                destinations: proposal.trip.destinations,
                nights: proposal.trip.nights,
                tripStyle: proposal.trip.tripStyle,
                clientName: proposal.client.guestNames,
              }}
            />
            {showcaseSection && (
              <ChapterColorPill
                sectionId={showcaseSection.id}
                overrides={showcaseSection.styleOverrides ?? {}}
                fields={[
                  { key: "sectionSurface", label: "Section background" },
                  { key: "cardBg", label: "Card background" },
                  { key: "headerBg", label: "Header strip" },
                  { key: "accent", label: "Accent" },
                ]}
              />
            )}
          </ChapterChrome>
        ) : null
      }
      activeOverlay={
        <>
          {active.propertyClass && (
            <div className="text-[10.5px] uppercase tracking-[0.32em] mb-2 opacity-85 font-semibold">
              {active.propertyClass}
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
            {active.name || "Lodge"}
          </div>
          {active.location && (
            <div className="text-[11px] uppercase tracking-[0.22em] mt-2 opacity-80">
              {active.location}
            </div>
          )}
        </>
      }
    >
      {visible.map((p, idx) => (
        <PropertyInlineBlock
          key={p.id}
          property={p}
          proposal={proposal}
          isFirst={idx === 0}
          isEditor={isEditor}
          tokens={tokens}
          theme={theme}
          onActive={() => setActiveId(p.id)}
          onUpdate={(patch) => updateProperty(p.id, patch)}
        />
      ))}
    </CrossfadeChapter>
  );
}

function PropertyInlineBlock({
  property,
  proposal,
  isFirst,
  isEditor,
  tokens,
  theme,
  onActive,
  onUpdate,
}: {
  property: Property;
  proposal: Proposal;
  isFirst: boolean;
  isEditor: boolean;
  tokens: ThemeTokens;
  theme: ProposalTheme;
  onActive: () => void;
  onUpdate: (patch: Partial<Property>) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) onActive();
        }
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: [0, 0.5, 1] },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [onActive]);

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
    <div
      ref={ref}
      className={`pb-24 ${isFirst ? "pt-2" : "pt-16 mt-12"}`}
      style={{
        // ~2 viewports per property so the sticky photo holds long
        // enough to read every Fast Fact + custom section without
        // crossfading early.
        minHeight: "180vh",
        ...(isFirst ? {} : { borderTop: `1px solid ${tokens.border}` }),
      }}
    >
      <div
        className="text-[10.5px] uppercase tracking-[0.32em] font-semibold mb-2"
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
            onUpdate({
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
        onBlur={(e) => onUpdate({ description: e.currentTarget.textContent ?? "" })}
      >
        {property.description || (isEditor ? "Describe the property — setting, character, service, style…" : "")}
      </p>
      <div
        className="mt-6 pt-5 grid grid-cols-2 gap-x-6 gap-y-3"
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
      {/* Fast Facts — operator-curated standout points (Highlights)
          + factual specs (Quick facts) in a magazine-feature
          two-column block. Same pattern Safari Portal uses on every
          property; ours pulls from existing structured fields so
          there's no extra operator effort. */}
      <PropertyFastFacts property={property} nightsCount={nightsCount} tokens={tokens} />

      {/* Library-defined custom sections (Sustainability, Family
          policies, Butler service, Experience & Activities, etc.).
          Each renders as its own sub-headed block — exactly like
          Safari Portal's "Butler Service" / "Experience & Activities"
          inline sub-sections. Operator-controlled. */}
      {(property.customSections ?? []).map((sec) => (
        <section key={sec.id ?? sec.title} className="mt-7">
          <div
            className="text-[10.5px] uppercase tracking-[0.32em] font-semibold mb-2"
            style={{ color: tokens.mutedText }}
          >
            {sec.title}
          </div>
          <div
            className="text-[13.5px] leading-[1.75] whitespace-pre-line"
            style={{ color: tokens.bodyText }}
          >
            {sec.body}
          </div>
        </section>
      ))}
    </div>
  );
}

// ─── PropertyFastFacts ──────────────────────────────────────────────────
//
// Two-column Fast Facts block. Highlights = operator-curated
// standout points (suitability tags, special interests, propertyClass,
// trip-style fit). Quick facts = factual specs (room count, meal plan,
// check-in/out, languages, amenities). Both populated from existing
// Property fields — operators don't fill in a new structure.

function PropertyFastFacts({
  property,
  nightsCount,
  tokens,
}: {
  property: Property;
  nightsCount: number;
  tokens: ThemeTokens;
}) {
  // Highlights — composed from operator-curated descriptors. We start
  // with propertyClass (capital-case eyebrow), then the suitability
  // tags ("Couples", "Family-friendly"), then any specialInterests
  // tags ("Photography", "Conservation"). Each becomes a bullet.
  const highlights: string[] = [];
  if (property.propertyClass?.trim()) highlights.push(property.propertyClass.trim());
  for (const s of property.suitability ?? []) {
    if (s?.trim()) highlights.push(s.trim());
  }
  for (const s of property.specialInterests ?? []) {
    if (s?.trim() && !highlights.includes(s.trim())) highlights.push(s.trim());
  }

  // Quick facts — factual / operational. Each row is one bullet so
  // the list reads scannably even when a few are missing.
  const quickFacts: string[] = [];
  if (property.totalRooms) {
    quickFacts.push(
      `${property.totalRooms} ${property.totalRooms === 1 ? "room" : "rooms"} & suites`,
    );
  }
  if (property.mealPlan?.trim()) quickFacts.push(property.mealPlan.trim());
  if (nightsCount > 0) {
    quickFacts.push(`${nightsCount} ${nightsCount === 1 ? "night" : "nights"}`);
  }
  if (property.checkInTime?.trim() || property.checkOutTime?.trim()) {
    const ci = property.checkInTime?.trim() || "—";
    const co = property.checkOutTime?.trim() || "—";
    quickFacts.push(`Check-in ${ci} · Check-out ${co}`);
  }
  if ((property.spokenLanguages ?? []).length > 0) {
    quickFacts.push(`Languages: ${(property.spokenLanguages ?? []).join(", ")}`);
  }
  // Amenities go below; the top bullets are the structured facts so
  // operators get a clear, magazine-style fact sheet.
  for (const a of (property.amenities ?? []).slice(0, 8)) {
    if (a?.trim()) quickFacts.push(a.trim());
  }

  if (highlights.length === 0 && quickFacts.length === 0) return null;

  return (
    <div
      className="mt-7 pt-6"
      style={{ borderTop: `1px solid ${tokens.border}` }}
    >
      <div
        className="text-[10.5px] uppercase tracking-[0.32em] font-semibold mb-4"
        style={{ color: tokens.mutedText }}
      >
        Fast Facts
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
        {highlights.length > 0 && (
          <FactList label="Highlights" items={highlights} tokens={tokens} />
        )}
        {quickFacts.length > 0 && (
          <FactList label="Quick facts" items={quickFacts} tokens={tokens} />
        )}
      </div>
    </div>
  );
}

function FactList({
  label,
  items,
  tokens,
}: {
  label: string;
  items: string[];
  tokens: ThemeTokens;
}) {
  return (
    <div>
      <div
        className="text-[9.5px] uppercase tracking-[0.28em] font-bold mb-2.5"
        style={{ color: tokens.accent }}
      >
        {label}
      </div>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li
            key={i}
            className="flex items-start gap-2.5 text-[13px] leading-snug"
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
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PricingChapter({
  proposal,
  isEditor,
  tokens: _globalTokens,
}: {
  proposal: Proposal;
  isEditor: boolean;
  tokens: ThemeTokens;
}) {
  const { theme, pricing, activeTier } = proposal;
  const pricingSection = proposal.sections.find((s) => s.type === "pricing");
  void _globalTokens;
  const tokens = resolveTokens(theme.tokens, pricingSection?.styleOverrides);
  const tier = pricing?.[activeTier as TierKey];
  if (!tier) return null;

  return (
    <SpreadRow
      imageUrl={coverHero(proposal) || firstDayHero(proposal)}
      eyebrow="— Investment"
      label="PRICING"
      rightBackground={tokens.sectionSurface}
    >
      {isEditor && pricingSection && (
        <ChapterChrome>
          <ChapterColorPill
            sectionId={pricingSection.id}
            overrides={pricingSection.styleOverrides ?? {}}
            fields={[
              { key: "sectionSurface", label: "Section background" },
              { key: "accent", label: "Accent" },
            ]}
          />
        </ChapterChrome>
      )}
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
  tokens: _globalTokens,
}: {
  proposal: Proposal;
  isEditor: boolean;
  tokens: ThemeTokens;
}) {
  const { theme, practicalInfo } = proposal;
  const practicalSection = proposal.sections.find((s) => s.type === "practicalInfo");
  void _globalTokens;
  const tokens = resolveTokens(theme.tokens, practicalSection?.styleOverrides);
  if (!practicalInfo || practicalInfo.length === 0) return null;

  return (
    <SpreadRow
      imageUrl={coverHero(proposal) || firstDayHero(proposal)}
      eyebrow="— Good to know"
      label="PRE-TRAVEL INFORMATION"
      rightBackground={tokens.sectionSurface}
    >
      {isEditor && practicalSection && (
        <ChapterChrome>
          <ChapterColorPill
            sectionId={practicalSection.id}
            overrides={practicalSection.styleOverrides ?? {}}
            fields={[
              { key: "sectionSurface", label: "Section background" },
              { key: "accent", label: "Accent" },
            ]}
          />
        </ChapterChrome>
      )}
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
  tokens: _globalTokens,
}: {
  proposal: Proposal;
  isEditor: boolean;
  tokens: ThemeTokens;
}) {
  const updateSectionContent = useProposalStore((s) => s.updateSectionContent);
  const closing = findClosingSection(proposal);
  void _globalTokens;
  const { theme } = proposal;
  const tokens = resolveTokens(theme.tokens, closing?.styleOverrides);
  if (!closing) return null;
  const themeImage =
    (closing.content?.themeImageUrl as string | undefined) || coverHero(proposal);
  const headline =
    (closing.content?.headline as string) ||
    `Your ${proposal.trip.destinations?.[0] || ""} journey is ready`.replace(/\s+/g, " ").trim();
  const letter =
    (closing.content?.letter as string) ||
    "Now please review every section and let me know what needs adjusting. I'll hold these camp dates while you confirm.";
  const ctaLabel = (closing.content?.ctaLabel as string) || "Secure This Safari";

  const buildAIFields = (): ChapterAIField[] => {
    const out: ChapterAIField[] = [];
    for (const f of ["letter", "headline", "availability"] as const) {
      const v = (closing.content?.[f] as string | undefined) ?? "";
      if (v.trim()) {
        out.push({
          key: `section:${closing.id}:${f}`,
          text: v,
          target: { kind: "sectionContent", sectionId: closing.id, field: f },
        });
      }
    }
    return out;
  };

  return (
    <SpreadRow
      imageUrl={themeImage}
      eyebrow="— Secure your trip"
      label={proposal.trip.tripStyle?.toUpperCase() || "READY?"}
      isEditor={isEditor}
      rightBackground={tokens.sectionSurface}
      onImageUpload={(url) =>
        updateSectionContent(closing.id, { themeImageUrl: url })
      }
    >
      {isEditor && (
        <ChapterChrome>
          <ChapterAIPill
            chapterLabel="Closing"
            getFields={buildAIFields}
            context={{
              tripTitle: proposal.trip.title,
              destinations: proposal.trip.destinations,
              nights: proposal.trip.nights,
              tripStyle: proposal.trip.tripStyle,
              clientName: proposal.client.guestNames,
            }}
          />
          <ChapterColorPill
            sectionId={closing.id}
            overrides={closing.styleOverrides ?? {}}
            fields={[
              { key: "sectionSurface", label: "Section background" },
              { key: "accent", label: "Accent" },
            ]}
          />
        </ChapterChrome>
      )}
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
