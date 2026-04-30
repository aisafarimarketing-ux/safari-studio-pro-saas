"use client";

import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import { resolveTokens } from "@/lib/theme";
import { uploadImage } from "@/lib/uploadImage";
import { ExpandingCards, type CardItem } from "@/components/ui/ExpandingCards";
import { getGlyphForDestination } from "@/lib/wildlifeGlyphs";
import type {
  Section,
  Day,
  TierKey,
  ThemeTokens,
  ProposalTheme,
  OperatorProfile,
  ClientDetails,
  TripDetails,
  Property,
} from "@/lib/types";

// ─── ClosingSection ──────────────────────────────────────────────────────
//
// Closing block — three layout variants, all built on the same four
// pillars per operator brief:
//
//   1. Image rail of trip destinations with names overlaid / captioned
//   2. Editable closing letter (high-converting, editorial tone)
//   3. Primary WhatsApp CTA — "Secure This Safari" — opens
//      wa.me/<operator.whatsapp> with a prefilled "ready to book"
//      message. Falls back to bookingUrl, then to mailto when no
//      WhatsApp is configured.
//   4. Secondary action row — Share, Download (current share-view
//      URL for now), Request Changes (fires the existing
//      ss:prefillComment event so the comments side panel opens
//      with a note to the operator), Visit Our Website.
//
// Variants:
//   • split-card  — 2 large image tiles + 2-col card with avatar +
//     headline + letter + CTAs. The polished default.
//   • gallery-row — up to 4 image tiles in a row with names below;
//     centered headline + letter; primary CTA + secondary row.
//   • stack       — single hero image + tracked-out caption of all
//     stops; centered headline + letter + CTAs.
//
// Old variant names on legacy proposals (decision-card / conversion-
// card / closing-farewell / etc.) fall through to split-card via
// the dispatcher.

const PRIMARY_CTA_DEFAULT = "Secure This Safari";

// ─── Image curation ──────────────────────────────────────────────────────
//
// Walks the days in chronological order, keeps the first appearance
// of each unique destination, and resolves the best image for it:
//   1. Operator-set override (section.content.imageOverrides[name])
//   2. The day's heroImageUrl
//   3. The lead image of the matched property (active tier's camp)
//   4. null (placeholder rendered)

interface CuratedTile {
  destination: string;
  imageUrl: string | null;
  position?: string;
  /** Stable key used by per-tile image overrides on section.content. */
  key: string;
}

function curateTiles(
  days: Day[],
  properties: Property[],
  overrides: Record<string, string> | undefined,
  activeTier: TierKey,
  max: number,
): CuratedTile[] {
  const sorted = [...days].sort((a, b) => a.dayNumber - b.dayNumber);
  const seen = new Set<string>();
  const out: CuratedTile[] = [];
  for (const day of sorted) {
    if (out.length >= max) break;
    const dest = day.destination?.trim();
    if (!dest) continue;
    const key = dest.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    let imageUrl = overrides?.[key] ?? day.heroImageUrl ?? null;
    if (!imageUrl) {
      const camp = day.tiers?.[activeTier]?.camp?.trim().toLowerCase();
      if (camp) {
        const prop = properties.find(
          (p) => p.name.trim().toLowerCase() === camp,
        );
        if (prop?.leadImageUrl) imageUrl = prop.leadImageUrl;
      }
    }
    out.push({
      destination: dest,
      imageUrl,
      position: day.heroImagePosition,
      key,
    });
  }
  return out;
}

// ─── WhatsApp deep link ──────────────────────────────────────────────────
//
// Format: https://wa.me/<digits-only>?text=<encoded-message>
// Pre-filled message includes the client's first name and trip
// destinations so the operator instantly knows which booking is
// being confirmed when the WhatsApp message arrives.

function buildWhatsAppLink(
  operator: OperatorProfile,
  client: ClientDetails,
  trip: TripDetails,
): string | null {
  const phone = (operator.whatsapp || operator.phone || "")
    .replace(/[^\d+]/g, "")
    .replace(/^\+/, "");
  if (!phone) return null;
  const guestName = client.guestNames?.split(/[,&]/)?.[0]?.trim() || "there";
  const dests =
    trip.destinations && trip.destinations.length > 0
      ? trip.destinations.join(", ")
      : "the safari";
  const msg =
    `Hi ${operator.consultantName || ""}, this is ${guestName}. ` +
    `I've reviewed the proposal for ${dests} and I'm ready to book. ` +
    `Please confirm next steps.`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
}

// Fallback Book link — bookingUrl, then mailto.
function buildFallbackBookLink(operator: OperatorProfile): string | null {
  if (operator.bookingUrl?.trim()) return operator.bookingUrl.trim();
  if (operator.email) {
    return `mailto:${operator.email}?subject=${encodeURIComponent("Ready to book my safari")}`;
  }
  return null;
}

// ─── HTML → plain text ──────────────────────────────────────────────────
//
// Day narratives can carry inline HTML (color / font-size spans from
// the rich-text toolbar). For small UI surfaces like the
// ExpandingCards description we want plain text — strip every tag
// and decode the few HTML entities that show up commonly.

function stripHtmlToText(input: string): string {
  if (!input) return "";
  if (typeof window !== "undefined" && typeof DOMParser !== "undefined") {
    try {
      const doc = new DOMParser().parseFromString(input, "text/html");
      return (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
    } catch {
      /* fall through to regex stripper */
    }
  }
  // Server-side / fallback regex stripper.
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Action handlers ─────────────────────────────────────────────────────
//
// Both Share and Download must point at the public SHARE-VIEW URL
// (/p/[proposalId]), not the editor URL (/studio/...). Otherwise an
// operator who hits Share from the editor would send the recipient
// a sign-in-gated edit page. Both handlers take the resolved share
// URL as an argument so the caller (which knows proposal.id) is the
// single source of truth.

async function handleShare(shareUrl: string) {
  if (!shareUrl) return;
  const shareData = { title: "Safari Proposal", url: shareUrl };
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share(shareData);
      return;
    } catch {
      /* user cancelled or share failed; fall through to clipboard */
    }
  }
  try {
    await navigator.clipboard.writeText(shareUrl);
    alert("Proposal link copied to clipboard");
  } catch {
    /* swallow — environment without clipboard API */
  }
}

function handleDownload(shareUrl: string) {
  // Webview placeholder per operator brief — opens the share-view
  // URL (/p/[id]) in a new tab so the operator / client can save /
  // print from the browser. Real PDF export will replace this later.
  if (!shareUrl) return;
  if (typeof window !== "undefined") {
    window.open(shareUrl, "_blank");
  }
}

function handleRequestChanges(
  operator: OperatorProfile,
  client: ClientDetails,
) {
  const guestName = client.guestNames?.split(/[,&]/)?.[0]?.trim() || "Hi";
  const message =
    `${guestName} — I'd like to request a few changes to the proposal before I book. ` +
    `Could you adjust the following:\n\n• \n\n` +
    `Thanks, ${operator.consultantName ?? ""}`.trim();
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("ss:prefillComment", { detail: { message } }),
    );
  }
}

function handleVisitWebsite(operator: OperatorProfile) {
  const url = operator.website?.trim();
  if (!url) return;
  const href = url.startsWith("http") ? url : `https://${url}`;
  if (typeof window !== "undefined") window.open(href, "_blank");
}

// ─── Main component ──────────────────────────────────────────────────────

export function ClosingSection({ section }: { section: Section }) {
  const { proposal, updateSectionContent } = useProposalStore();
  const { mode } = useEditorStore();
  const isEditor = mode === "editor";
  const { theme, days, operator, client, trip, properties, activeTier } = proposal;
  const tokens = resolveTokens(theme.tokens, section.styleOverrides);

  // Section content with sensible defaults + legacy fallbacks for
  // proposals that still carry the old `signOff` / `quote` fields.
  const headline =
    (section.content.headline as string) ||
    `Your ${trip.destinations?.[0] || ""} journey is ready`.replace(/\s+/g, " ").trim();
  const letter =
    (section.content.letter as string) ||
    (section.content.signOff as string) ||
    "Now please review every section and let me know what needs adjusting — lodge choices, pace, optional activities, anything. I'll hold these camp dates while you confirm. Once you're ready, we'll move to booking and I'll send the detailed pre-trip briefing and packing list.";
  const availability =
    (section.content.availability as string) ||
    "Availability at selected camps is limited and subject to confirmation.";
  const ctaLabel =
    (section.content.ctaLabel as string) || PRIMARY_CTA_DEFAULT;
  const imageOverrides =
    (section.content.imageOverrides as Record<string, string> | undefined) ?? undefined;

  const variant = section.layoutVariant;

  // Tile count = number of unique destinations (no per-variant cap).
  // Operator brief: "image variant to be the number of destinations."
  const tiles = curateTiles(
    days,
    properties,
    imageOverrides,
    activeTier as TierKey,
    99,
  );
  const allStops = tiles.map((t) => t.destination);

  // Build CardItem[] for ExpandingCards. Each tile becomes a card —
  // description pulled from the matching day's narrative (truncated
  // ~120 chars), icon from the wildlife glyph registry. Day
  // narratives now carry inline HTML (color / font-size spans from
  // the rich-text toolbar), so we strip tags first to get plain
  // text suitable for the small ExpandingCards description slot.
  const cardItems: CardItem[] = tiles.map((t) => {
    const day = days.find(
      (d) => d.destination?.trim().toLowerCase() === t.key,
    );
    const plain = stripHtmlToText(day?.description ?? "").trim();
    const description =
      plain.length > 0
        ? plain.length > 120
          ? `${plain.slice(0, 117)}…`
          : plain
        : `Day ${day?.dayNumber ?? "?"} — explore ${t.destination}.`;
    const glyph = getGlyphForDestination(t.destination);
    return {
      id: t.key,
      title: t.destination,
      description,
      imgSrc: t.imageUrl,
      icon: <CardGlyph glyph={glyph} />,
    };
  });

  // Resolve the public share-view URL for Share / Download. Falls
  // back to current window URL on first paint (SSR) before hydration.
  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}/p/${proposal.id}`
    : "";

  // Per-tile image override → uploads to /api/upload-image and
  // persists onto section.content.imageOverrides keyed by lowercase
  // destination name.
  const setImageForKey = async (key: string, file: File) => {
    try {
      const dataUrl = await uploadImage(file);
      updateSectionContent(section.id, {
        imageOverrides: { ...(imageOverrides ?? {}), [key]: dataUrl },
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Image upload failed");
    }
  };
  // (Drag-to-reposition was wired to the day's heroImagePosition
  // when each tile used the ImageSlot component. ExpandingCards uses
  // a plain <img> with object-cover, so per-tile reposition isn't
  // surfaced here — operators tweak via the day card if needed.)

  // Action wiring bound with the proposal's operator/client/trip
  const onSecure = () => {
    const wa = buildWhatsAppLink(operator, client, trip);
    const fallback = buildFallbackBookLink(operator);
    const target = wa || fallback;
    if (!target) {
      if (isEditor) {
        alert(
          "No WhatsApp / booking URL configured. Set operator.whatsapp on the operator profile so the Secure-This-Safari button can fire a booking message.",
        );
      }
      return;
    }
    if (typeof window !== "undefined") window.open(target, "_blank");
  };

  // Editable callbacks for inline content
  const onHeadlineChange = (v: string) =>
    updateSectionContent(section.id, { headline: v });
  const onLetterChange = (v: string) =>
    updateSectionContent(section.id, { letter: v });
  const onAvailabilityChange = (v: string) =>
    updateSectionContent(section.id, { availability: v });
  const onCtaLabelChange = (v: string) =>
    updateSectionContent(section.id, { ctaLabel: v });

  // Image-swap handler used by ExpandingCards (id maps directly to
  // the destination key we use for overrides).
  const onChangeCardImage = (id: string | number, file: File) => {
    setImageForKey(String(id), file);
  };

  const sharedProps: VariantProps = {
    cardItems,
    allStops,
    headline,
    letter,
    availability,
    ctaLabel,
    operator,
    accentColor: tokens.accent,
    cardColor: tokens.cardBg,
    isEditor,
    tokens,
    theme,
    onSecure,
    onShare: () => handleShare(shareUrl),
    onDownload: () => handleDownload(shareUrl),
    onRequestChanges: () => handleRequestChanges(operator, client),
    onVisitWebsite: () => handleVisitWebsite(operator),
    onHeadlineChange,
    onLetterChange,
    onAvailabilityChange,
    onCtaLabelChange,
    onChangeCardImage,
  };

  if (variant === "gallery-row") return <GalleryRowLayout {...sharedProps} />;
  if (variant === "stack") return <StackLayout {...sharedProps} />;
  return <SplitCardLayout {...sharedProps} />;
}

// ─── Shared variant props ────────────────────────────────────────────────

interface VariantProps {
  cardItems: CardItem[];
  allStops: string[];
  headline: string;
  letter: string;
  availability: string;
  ctaLabel: string;
  operator: OperatorProfile;
  accentColor: string;
  cardColor: string;
  isEditor: boolean;
  tokens: ThemeTokens;
  theme: ProposalTheme;
  onSecure: () => void;
  onShare: () => void;
  onDownload: () => void;
  onRequestChanges: () => void;
  onVisitWebsite: () => void;
  onHeadlineChange: (v: string) => void;
  onLetterChange: (v: string) => void;
  onAvailabilityChange: (v: string) => void;
  onCtaLabelChange: (v: string) => void;
  onChangeCardImage: (id: string | number, file: File) => void;
}

// ─── Variant 1 · split-card (default) ────────────────────────────────────
//
// ExpandingCards row up top showing every destination. Below:
// centred letter + primary CTA + secondary buttons spread across
// the width. Consultant contact info has been moved to the Footer
// per operator brief — this section is purely the closing letter
// + booking actions.

function SplitCardLayout(p: VariantProps) {
  const {
    cardItems,
    headline,
    letter,
    availability,
    ctaLabel,
    operator,
    accentColor,
    cardColor,
    isEditor,
    tokens,
    theme,
    onSecure,
    onShare,
    onDownload,
    onRequestChanges,
    onVisitWebsite,
    onHeadlineChange,
    onLetterChange,
    onAvailabilityChange,
    onCtaLabelChange,
    onChangeCardImage,
  } = p;
  return (
    <div
      className="py-6 md:py-10 px-6 md:px-12"
      style={{ background: tokens.sectionSurface }}
    >
      <div className="max-w-5xl mx-auto flex flex-col items-center">
        <ExpandingCards
          items={cardItems}
          isEditor={isEditor}
          onChangeImage={onChangeCardImage}
          accentColor={accentColor}
          placeholderColor={cardColor}
          className="mb-8 mx-auto"
        />

        {/* Centered letter card */}
        <div
          className="w-full max-w-2xl rounded-xl p-6 md:p-8 text-center"
          style={{
            background: tokens.cardBg,
            border: `1px solid ${tokens.border}`,
          }}
        >
          <h2
            className="font-bold leading-[1.15] outline-none"
            style={{
              color: tokens.headingText,
              fontFamily: `'${theme.displayFont}', serif`,
              fontSize: "clamp(22px, 2.6vw, 28px)",
            }}
            contentEditable={isEditor}
            suppressContentEditableWarning
            onBlur={(e) => onHeadlineChange(e.currentTarget.textContent ?? "")}
          >
            {headline}
          </h2>
          <p
            className="mt-3 text-[14.5px] leading-[1.7] outline-none whitespace-pre-line"
            style={{ color: tokens.bodyText }}
            contentEditable={isEditor}
            suppressContentEditableWarning
            onBlur={(e) => onLetterChange(e.currentTarget.textContent ?? "")}
          >
            {letter}
          </p>
          <p
            className="mt-3 text-[12px] italic outline-none"
            style={{ color: tokens.mutedText }}
            contentEditable={isEditor}
            suppressContentEditableWarning
            onBlur={(e) =>
              onAvailabilityChange(e.currentTarget.textContent ?? "")
            }
          >
            {availability}
          </p>
        </div>

        {/* Centered primary CTA + spread secondary actions */}
        <div className="w-full max-w-3xl mt-6 flex flex-col items-center">
          <div className="w-full max-w-md">
            <PrimaryCta
              label={ctaLabel}
              isEditor={isEditor}
              tokens={tokens}
              onClick={onSecure}
              onLabelChange={onCtaLabelChange}
            />
          </div>
          <SecondaryActions
            tokens={tokens}
            operator={operator}
            onShare={onShare}
            onDownload={onDownload}
            onRequestChanges={onRequestChanges}
            onVisitWebsite={onVisitWebsite}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Variant 2 · gallery-row ─────────────────────────────────────────────
//
// Up to 4 image tiles across the top with names captioned below.
// Centered headline + letter underneath. Primary CTA centered, then
// the secondary row. Matches the hand-drawn sketch.

function GalleryRowLayout(p: VariantProps) {
  const {
    cardItems,
    headline,
    letter,
    availability,
    ctaLabel,
    operator,
    accentColor,
    cardColor,
    isEditor,
    tokens,
    theme,
    onSecure,
    onShare,
    onDownload,
    onRequestChanges,
    onVisitWebsite,
    onHeadlineChange,
    onLetterChange,
    onAvailabilityChange,
    onCtaLabelChange,
    onChangeCardImage,
  } = p;
  return (
    <div
      className="py-6 md:py-10 px-6 md:px-12"
      style={{ background: tokens.sectionSurface }}
    >
      <div className="max-w-5xl mx-auto flex flex-col items-center">
        <ExpandingCards
          items={cardItems}
          isEditor={isEditor}
          onChangeImage={onChangeCardImage}
          accentColor={accentColor}
          placeholderColor={cardColor}
          className="mb-8 mx-auto"
        />

        <div
          className="w-full max-w-2xl text-center rounded-xl p-6 md:p-8"
          style={{
            background: tokens.cardBg,
            border: `1px solid ${tokens.border}`,
          }}
        >
          <h2
            className="font-bold leading-[1.15] outline-none"
            style={{
              color: tokens.headingText,
              fontFamily: `'${theme.displayFont}', serif`,
              fontSize: "clamp(22px, 2.6vw, 28px)",
            }}
            contentEditable={isEditor}
            suppressContentEditableWarning
            onBlur={(e) => onHeadlineChange(e.currentTarget.textContent ?? "")}
          >
            {headline}
          </h2>
          <p
            className="mt-3 text-[15px] leading-[1.75] outline-none whitespace-pre-line"
            style={{ color: tokens.bodyText }}
            contentEditable={isEditor}
            suppressContentEditableWarning
            onBlur={(e) => onLetterChange(e.currentTarget.textContent ?? "")}
          >
            {letter}
          </p>
          <p
            className="mt-3 text-[12px] italic outline-none"
            style={{ color: tokens.mutedText }}
            contentEditable={isEditor}
            suppressContentEditableWarning
            onBlur={(e) =>
              onAvailabilityChange(e.currentTarget.textContent ?? "")
            }
          >
            {availability}
          </p>
        </div>

        <div className="w-full max-w-3xl mt-6 flex flex-col items-center">
          <div className="w-full max-w-md">
            <PrimaryCta
              label={ctaLabel}
              isEditor={isEditor}
              tokens={tokens}
              onClick={onSecure}
              onLabelChange={onCtaLabelChange}
            />
          </div>
          <SecondaryActions
            tokens={tokens}
            operator={operator}
            onShare={onShare}
            onDownload={onDownload}
            onRequestChanges={onRequestChanges}
            onVisitWebsite={onVisitWebsite}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Variant 3 · stack ───────────────────────────────────────────────────
//
// Single hero image up top; tracked-out caption listing every stop.
// Centered headline + letter + CTAs stacked.

function StackLayout(p: VariantProps) {
  const {
    cardItems,
    allStops,
    headline,
    letter,
    availability,
    ctaLabel,
    operator,
    accentColor,
    cardColor,
    isEditor,
    tokens,
    theme,
    onSecure,
    onShare,
    onDownload,
    onRequestChanges,
    onVisitWebsite,
    onHeadlineChange,
    onLetterChange,
    onAvailabilityChange,
    onCtaLabelChange,
    onChangeCardImage,
  } = p;
  return (
    <div
      className="py-6 md:py-10 px-6 md:px-12"
      style={{ background: tokens.sectionSurface }}
    >
      <div className="max-w-3xl mx-auto flex flex-col items-center">
        <ExpandingCards
          items={cardItems}
          isEditor={isEditor}
          onChangeImage={onChangeCardImage}
          accentColor={accentColor}
          placeholderColor={cardColor}
          className="mx-auto"
        />
        {allStops.length > 0 && (
          <div
            className="mt-4 text-center text-[10.5px] uppercase font-semibold"
            style={{
              color: tokens.mutedText,
              letterSpacing: "0.32em",
              fontFamily: `'${theme.bodyFont}', sans-serif`,
            }}
          >
            {allStops.join(" · ")}
          </div>
        )}

        <div className="mt-8 text-center w-full">
          <h2
            className="font-bold leading-[1.1] outline-none"
            style={{
              color: tokens.headingText,
              fontFamily: `'${theme.displayFont}', serif`,
              fontSize: "clamp(24px, 3vw, 32px)",
            }}
            contentEditable={isEditor}
            suppressContentEditableWarning
            onBlur={(e) => onHeadlineChange(e.currentTarget.textContent ?? "")}
          >
            {headline}
          </h2>
          <p
            className="mt-4 text-[15px] leading-[1.75] outline-none whitespace-pre-line max-w-xl mx-auto"
            style={{ color: tokens.bodyText }}
            contentEditable={isEditor}
            suppressContentEditableWarning
            onBlur={(e) => onLetterChange(e.currentTarget.textContent ?? "")}
          >
            {letter}
          </p>
          <p
            className="mt-3 text-[12px] italic outline-none"
            style={{ color: tokens.mutedText }}
            contentEditable={isEditor}
            suppressContentEditableWarning
            onBlur={(e) =>
              onAvailabilityChange(e.currentTarget.textContent ?? "")
            }
          >
            {availability}
          </p>

          <div className="mt-8 flex flex-col items-center">
            <div className="w-full max-w-md">
              <PrimaryCta
                label={ctaLabel}
                isEditor={isEditor}
                tokens={tokens}
                onClick={onSecure}
                onLabelChange={onCtaLabelChange}
              />
            </div>
            <SecondaryActions
              tokens={tokens}
              operator={operator}
              onShare={onShare}
              onDownload={onDownload}
              onRequestChanges={onRequestChanges}
              onVisitWebsite={onVisitWebsite}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Subcomponents ───────────────────────────────────────────────────────
//
// HeroTile + ConsultantMeta removed — image rail is now ExpandingCards
// for every variant, and the consultant contact block lives in the
// Footer's contact-cards variant per operator brief.

function PrimaryCta({
  label,
  isEditor,
  tokens,
  onClick,
  onLabelChange,
}: {
  label: string;
  isEditor: boolean;
  tokens: ThemeTokens;
  onClick: () => void;
  onLabelChange: (v: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={isEditor ? undefined : onClick}
      className="w-full flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-[15px] font-semibold transition shadow-md hover:shadow-lg active:scale-[0.99]"
      style={{
        background: tokens.accent,
        color: "#ffffff",
        border: "1px solid rgba(0,0,0,0.05)",
      }}
    >
      <span
        contentEditable={isEditor}
        suppressContentEditableWarning
        onBlur={(e) => onLabelChange(e.currentTarget.textContent ?? "")}
        onClick={(e) => isEditor && e.stopPropagation()}
        style={{ outline: "none" }}
      >
        {label}
      </span>
      <span aria-hidden style={{ opacity: 0.85, fontSize: 18 }}>
        →
      </span>
    </button>
  );
}

function SecondaryActions({
  tokens,
  operator,
  onShare,
  onDownload,
  onRequestChanges,
  onVisitWebsite,
}: {
  tokens: ThemeTokens;
  operator: OperatorProfile;
  onShare: () => void;
  onDownload: () => void;
  onRequestChanges: () => void;
  onVisitWebsite: () => void;
}) {
  const hasWebsite = !!operator.website?.trim();
  // Spread the buttons across the row with flex-1 so each gets equal
  // horizontal real estate. Wraps to multiple rows on narrow widths.
  return (
    <div className="mt-3 w-full flex flex-wrap gap-2">
      <SecondaryBtn label="Share" tokens={tokens} onClick={onShare} icon={<ShareIcon />} />
      <SecondaryBtn
        label="Download"
        tokens={tokens}
        onClick={onDownload}
        icon={<DownloadIcon />}
      />
      <SecondaryBtn
        label="Request Changes"
        tokens={tokens}
        onClick={onRequestChanges}
        icon={<EditIcon />}
      />
      {hasWebsite && (
        <SecondaryBtn
          label="Visit Our Website"
          tokens={tokens}
          onClick={onVisitWebsite}
          icon={<ExternalIcon />}
        />
      )}
    </div>
  );
}

function SecondaryBtn({
  label,
  tokens,
  onClick,
  icon,
}: {
  label: string;
  tokens: ThemeTokens;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 min-w-[120px] inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-lg text-[12.5px] font-medium transition hover:opacity-85 active:scale-[0.98]"
      style={{
        background: "transparent",
        color: tokens.headingText,
        border: `1px solid ${tokens.border}`,
      }}
    >
      <span aria-hidden style={{ opacity: 0.7 }}>
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );
}

// CardGlyph renders a wildlife glyph from wildlifeGlyphs at a small
// size suitable for ExpandingCards' icon slot.
function CardGlyph({
  glyph,
}: {
  glyph: { paths: string[]; strokeWidth?: number; filled?: boolean };
}) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      aria-hidden
      style={{ display: "inline-block" }}
    >
      {glyph.paths.map((d, i) => (
        <path
          key={i}
          d={d}
          fill={glyph.filled ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth={glyph.strokeWidth ?? 1.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}

// ─── Icons ───────────────────────────────────────────────────────────────

function ShareIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="3.5" cy="7" r="1.6" />
      <circle cx="10.5" cy="3.5" r="1.6" />
      <circle cx="10.5" cy="10.5" r="1.6" />
      <path d="M5 6.2 L9 4.3" />
      <path d="M5 7.8 L9 9.7" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M7 2v7.5" />
      <path d="M3.5 6.5 L7 9.5 L10.5 6.5" />
      <path d="M2 12h10" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 2.5l3 3-7 7H2v-3l7-7z" />
      <path d="M8 4l3 3" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5.5 3h-3v8.5h8.5v-3" />
      <path d="M8 2.5h3.5V6" />
      <path d="M11.5 2.5l-5 5" />
    </svg>
  );
}
