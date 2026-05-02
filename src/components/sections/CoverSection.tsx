"use client";

import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import { resolveTokens } from "@/lib/theme";
import { uploadImage } from "@/lib/uploadImage";
import { orderDestinations } from "@/lib/destinationOrdering";
import { DraggableImage } from "@/components/ui/DraggableImage";
import { EditableOperatorLogoTile } from "@/components/brand/EditableOperatorLogoTile";
import type { Section, ThemeTokens, ProposalTheme } from "@/lib/types";

// "8 days / 7 nights" — safari convention is nights+1 days. Operators
// asked for both numbers everywhere on the cover, in that order.
function formatDuration(nights: number | undefined): string {
  if (!nights || nights < 1) return "—";
  const days = nights + 1;
  return `${days} days and ${nights} nights`;
}

// Format party size — prefer the structured adults/children split
// when both are set, fall back to the operator's free-form pax string
// otherwise. Examples:
//   adults=2, children=1  → "2 adults and 1 child"
//   adults=2, children=0  → "2 adults"
//   adults=undefined      → client.pax (whatever the operator typed)
function formatParty(client: { pax: string; adults?: number; children?: number }): string {
  const a = client.adults;
  const c = client.children;
  if (typeof a === "number" && a > 0) {
    const adultPart = `${a} ${a === 1 ? "adult" : "adults"}`;
    if (typeof c === "number" && c > 0) {
      const childPart = `${c} ${c === 1 ? "child" : "children"}`;
      return `${adultPart} and ${childPart}`;
    }
    return adultPart;
  }
  return client.pax || "—";
}

// Destinations rendered as a period-separated list with the editorial
// label "Your destinations" above. Periods (not middots) by operator
// preference — gives the strip a more deliberate, sentence-cadence
// feel.
function formatDestinationsList(destinations: string[], limit = 6): string {
  if (destinations.length === 0) return "";
  return destinations.slice(0, limit).join(". ");
}

function CoverMeta({
  label,
  tokens,
  theme,
  children,
}: {
  label: string;
  tokens: ThemeTokens;
  theme: ProposalTheme;
  children: React.ReactNode;
}) {
  return (
    <div style={{ fontFamily: `'${theme.bodyFont}', sans-serif` }}>
      <div
        className="text-[10px] uppercase tracking-[0.28em] mb-1.5"
        style={{ color: tokens.mutedText }}
      >
        {label}
      </div>
      <div className="text-[14px] font-medium" style={{ color: tokens.headingText }}>
        {children}
      </div>
    </div>
  );
}

// DarkMeta — parallel to CoverMeta, sized for white-text-on-dark
// variants (centered-editorial, full-bleed-overlay, flip-split,
// cinematic-split). Renders the editorial FOR / DATES / DURATIONS /
// PARTY cells with white type and muted-white labels.
function DarkMeta({
  label,
  theme,
  children,
}: {
  label: string;
  theme: ProposalTheme;
  children: React.ReactNode;
}) {
  return (
    <div style={{ fontFamily: `'${theme.bodyFont}', sans-serif` }}>
      <div
        className="text-[10px] uppercase tracking-[0.28em] mb-1.5 font-semibold"
        style={{ color: "rgba(255,255,255,0.55)" }}
      >
        {label}
      </div>
      <div
        className="text-[13.5px] font-medium"
        style={{ color: "rgba(255,255,255,0.92)" }}
      >
        {children}
      </div>
    </div>
  );
}

export function CoverSection({ section }: { section: Section }) {
  const { proposal, updateSectionContent, updateTrip, updateClient, updateOperator } = useProposalStore();
  const { mode } = useEditorStore();
  const isEditor = mode === "editor";

  const { client, trip, operator, theme } = proposal;
  const tokens = resolveTokens(theme.tokens, section.styleOverrides);
  const heroUrl = section.content.heroImageUrl as string | undefined;
  const heroPosition = section.content.heroImagePosition as string | undefined;
  const variant = section.layoutVariant;
  const onHeroPositionChange = (next: string) =>
    updateSectionContent(section.id, { heroImagePosition: next });

  // ─── Logo: one source of truth ──────────────────────────────────────────
  // Logo URL lives at the proposal-operator level. Uploading on any
  // logo tile (cover, header, personal note, footer) writes to
  // proposal.operator.logoUrl, and every section re-renders together —
  // operator brief: "if you upload on one logo, it populates all the
  // other sections where a logo goes."
  // Tile colour stays per-section because different sections can want
  // different tiles (cover: cream, footer: charcoal, etc.).
  const logoTileColor = section.content.logoTileColor as string | undefined;
  const handleLogoChange = (url: string | undefined) =>
    updateOperator({ logoUrl: url });
  const handleTileColorChange = (color: string | undefined) =>
    updateSectionContent(section.id, { logoTileColor: color });
  // Cover wants the logo bigger and rectangular. logoHeight + minTileWidth
  // give every tile a horizontal-pill silhouette regardless of the
  // operator's logo aspect ratio (square monograms read as rectangular).
  const logoTileProps = {
    logoUrl: operator.logoUrl,
    companyName: operator.companyName,
    tileBgOverride: logoTileColor,
    isEditor,
    minTileWidth: 160,
    onLogoChange: handleLogoChange,
    onTileColorChange: handleTileColorChange,
  };
  // Local alias kept so the existing template strings still read well.
  const effectiveLogoUrl = operator.logoUrl;

  // Always render destinations in geographic safari order, regardless of
  // the order the operator typed them in at Trip Setup. Old proposals
  // that pre-date the autopilot reorder still get a sensible cover.
  const orderedDestinations = orderDestinations(trip.destinations);

  const handleHeroUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await uploadImage(file);
      updateSectionContent(section.id, { heroImageUrl: dataUrl });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Image upload failed");
    }
  };

  // Open a hidden file picker and write the result onto heroImageUrl.
  // Used for both single-click-to-replace (operator brief: "click should
  // change the photo") and the legacy right-click flow.
  const triggerHeroPicker = () => {
    if (!isEditor) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const dataUrl = await uploadImage(file);
        updateSectionContent(section.id, { heroImageUrl: dataUrl });
      } catch (err) {
        alert(err instanceof Error ? err.message : "Image upload failed");
      }
    };
    input.click();
  };

  const handleImageContextMenu = (e: React.MouseEvent) => {
    if (!isEditor) return;
    e.preventDefault();
    triggerHeroPicker();
  };

  // ── Hero-letter — minimal editorial cover ─────────────────────────────
  // Top taupe border + full-width hero photo with a dark title overlay + a
  // warm meta band. The proposal's personal note (signature, consultant
  // photo, logo, contact) lives in its own PersonalNote section right after
  // this one — keeps the cover uncluttered and makes the same sign-off
  // style available under every cover variant.
  if (variant === "hero-letter") {
    const taupe = "#7a6e60";
    const metaBand = "#efece6";

    return (
      <div style={{ background: tokens.pageBg, fontFamily: `'${theme.bodyFont}', sans-serif` }}>
        {/* Hero zone — edge-to-edge photo from the very top. The logo
            now overlays the hero in the top-left as a "paper tile",
            removing the previous green page-bg strip above the image
            and giving the cover a luxury-travel cinematic feel. */}
        <div className="relative">
          <div
            className="relative w-full"
            style={{ aspectRatio: "16 / 9", background: tokens.cardBg }}
            onContextMenu={handleImageContextMenu}
          >
            {/* Operator logo tile — top-left of hero. Auto-detects
                whether to use a cream or charcoal tile based on the
                logo's brightness so any operator's logo reads cleanly
                regardless of background. */}
            {(effectiveLogoUrl || operator.companyName) && (
              <div className="absolute top-5 left-5 md:top-7 md:left-9 z-10">
                <EditableOperatorLogoTile {...logoTileProps} logoHeight={56} />
              </div>
            )}
            {/* 1mm-ish taupe top border — kept as brand chrome but now
                sits ON the hero with a subtle drop-shadow so it reads
                without claiming page-bg space. */}
            <div
              aria-hidden
              className="absolute top-0 left-0 right-0 z-10"
              style={{ height: 4, background: taupe, opacity: 0.85 }}
            />
            {heroUrl ? (
              <DraggableImage
                src={heroUrl}
                alt="Cover"
                className="absolute inset-0 w-full h-full object-cover"
                position={heroPosition}
                onPositionChange={onHeroPositionChange}
                isEditor={isEditor}
                onSingleClick={triggerHeroPicker}
              />
            ) : isEditor ? (
              <label className="absolute inset-0 cursor-pointer flex flex-col items-center justify-center">
                <input type="file" accept="image/*" className="hidden" onChange={handleHeroUpload} />
                <div className="text-center" style={{ color: tokens.mutedText }}>
                  <div className="text-5xl mb-2 opacity-60">+</div>
                  <div className="text-[12px] font-semibold uppercase tracking-[0.2em]">Click to upload hero photo</div>
                  <div className="text-[10.5px] mt-1.5 opacity-70">or right-click to replace</div>
                </div>
              </label>
            ) : null}

            {/* Dark overlay at bottom with title + destinations */}
            <div
              className="absolute inset-x-0 bottom-0 px-10 md:px-14 pt-16 pb-8"
              style={{
                background:
                  "linear-gradient(to top, rgba(30,28,25,0.92) 0%, rgba(30,28,25,0.82) 45%, rgba(30,28,25,0) 100%)",
              }}
            >
              {/* Cover label removed per operator spec — title now
                  leads the overlay. */}
              <h1
                className="font-bold leading-[1.05] text-white outline-none"
                style={{ fontSize: "clamp(2.2rem, 4.6vw, 3.6rem)", letterSpacing: "-0.01em" }}
                contentEditable={isEditor}
                suppressContentEditableWarning
                data-ai-editable="cover-title"
                onBlur={(e) =>
                  updateTrip({ title: e.currentTarget.textContent?.trim() ?? trip.title })
                }
              >
                {trip.title}
              </h1>
              {orderedDestinations.length > 0 && (
                <div className="mt-5">
                  <div
                    className="text-[10px] uppercase tracking-[0.32em] text-white/55 font-semibold mb-1.5"
                  >
                    Your destinations
                  </div>
                  <div
                    className="text-[12px] uppercase tracking-[0.28em] text-white/85 font-semibold"
                  >
                    {formatDestinationsList(orderedDestinations, 6)}
                  </div>
                </div>
              )}
            </div>

            {heroUrl && isEditor && (
              <label className="absolute top-4 right-4 z-[750] cursor-pointer bg-black/55 text-white text-[11px] px-3 py-1.5 rounded-md hover:bg-black/75 transition backdrop-blur-sm font-semibold">
                <input type="file" accept="image/*" className="hidden" onChange={handleHeroUpload} />
                Change image
              </label>
            )}
          </div>
        </div>

        {/* Meta band — For / Dates / Days·Nights / Travelers in the order
            operators asked for at onboarding. */}
        <div
          className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-5 px-10 md:px-14 py-6"
          style={{ background: metaBand }}
        >
          <div>
            <div
              className="text-[10px] uppercase tracking-[0.28em] mb-1.5 font-semibold"
              style={{ color: tokens.mutedText }}
            >
              For
            </div>
            <div
              className="text-[14px] font-medium outline-none"
              style={{ color: tokens.headingText }}
              contentEditable={isEditor}
              suppressContentEditableWarning
              onBlur={(e) => updateClient({ guestNames: e.currentTarget.textContent?.trim() ?? client.guestNames })}
            >
              {client.guestNames || "Your Guests"}
            </div>
          </div>
          <div>
            <div
              className="text-[10px] uppercase tracking-[0.28em] mb-1.5 font-semibold"
              style={{ color: tokens.mutedText }}
            >
              Dates
            </div>
            <div
              className="text-[14px] font-medium outline-none"
              style={{ color: tokens.headingText }}
              contentEditable={isEditor}
              suppressContentEditableWarning
              onBlur={(e) => updateTrip({ dates: e.currentTarget.textContent?.trim() ?? trip.dates })}
            >
              {trip.dates || "—"}
            </div>
          </div>
          <div>
            <div
              className="text-[10px] uppercase tracking-[0.28em] mb-1.5 font-semibold"
              style={{ color: tokens.mutedText }}
            >
              Durations
            </div>
            <div
              className="text-[14px] font-medium"
              style={{ color: tokens.headingText }}
            >
              {formatDuration(trip.nights)}
            </div>
          </div>
          <div>
            <div
              className="text-[10px] uppercase tracking-[0.28em] mb-1.5 font-semibold"
              style={{ color: tokens.mutedText }}
            >
              Party
            </div>
            <div
              className="text-[14px] font-medium outline-none"
              style={{ color: tokens.headingText }}
              contentEditable={isEditor}
              suppressContentEditableWarning
              onBlur={(e) => updateClient({ pax: e.currentTarget.textContent?.trim() ?? client.pax })}
            >
              {formatParty(client)}
            </div>
          </div>
        </div>

      </div>
    );
  }

  // ── Split-panel variants — clean image + text side-by-side (no overlay) ───
  // Six variants share one renderer. The `side` argument says which side the
  // image sits on; `ratio` sets the image/text proportion. Every field is
  // always visible (no hidden content inside overlays).
  const splitPanelVariants = [
    "split-50-50-right",
    "split-50-50-left",
    "split-60-40-right",
    "split-60-40-left",
    "split-40-60-right",
    "split-40-60-left",
  ] as const;
  if ((splitPanelVariants as readonly string[]).includes(variant)) {
    const side: "left" | "right" = variant.endsWith("-right") ? "right" : "left";
    const ratio: "50-50" | "60-40" | "40-60" = variant.includes("60-40")
      ? "60-40"
      : variant.includes("40-60")
        ? "40-60"
        : "50-50";
    const cols =
      ratio === "60-40"
        ? side === "right" ? "40fr 60fr" : "60fr 40fr"
        : ratio === "40-60"
          ? side === "right" ? "60fr 40fr" : "40fr 60fr"
          : "1fr 1fr";
    const imageFirst = side === "left";
    return (
      <div
        className={`relative w-full grid ${isEditor ? "min-h-[620px]" : "min-h-[640px]"}`}
        style={{ gridTemplateColumns: cols, background: tokens.sectionSurface }}
      >
        {/* Image column */}
        <div
          className="relative overflow-hidden"
          style={{ background: tokens.cardBg, order: imageFirst ? 1 : 2 }}
          onContextMenu={handleImageContextMenu}
        >
          {heroUrl ? (
            <DraggableImage
              src={heroUrl}
              alt="Cover"
              className="absolute inset-0 w-full h-full object-cover"
              position={heroPosition}
              onPositionChange={onHeroPositionChange}
              isEditor={isEditor}
              onSingleClick={triggerHeroPicker}
            />
          ) : isEditor ? (
            <label className="absolute inset-0 cursor-pointer flex flex-col items-center justify-center group">
              <input type="file" accept="image/*" className="hidden" onChange={handleHeroUpload} />
              <div
                className="text-center transition group-hover:scale-105"
                style={{ color: tokens.mutedText }}
              >
                <div className="text-4xl mb-2 opacity-60">+</div>
                <div className="text-[12px] font-semibold uppercase tracking-[0.2em]">Click to upload</div>
                <div className="text-[10.5px] mt-1.5 opacity-70">or right-click to replace</div>
              </div>
            </label>
          ) : null}
          {heroUrl && isEditor && (
            <label
              className="absolute top-4 left-4 z-[750] cursor-pointer bg-black/50 text-white text-[11px] px-2.5 py-1 rounded-md hover:bg-black/70 transition backdrop-blur-sm"
              title="Click to upload · right-click the image anywhere to replace"
            >
              <input type="file" accept="image/*" className="hidden" onChange={handleHeroUpload} />
              Change
            </label>
          )}
        </div>

        {/* Text column */}
        <div
          className="relative flex flex-col justify-between p-10 md:p-14"
          style={{ order: imageFirst ? 2 : 1 }}
        >
          {/* Top — operator. EditableOperatorLogoTile handles every kind
              of logo (light/dark/colored bg/text-only) with auto-tile
              detection, and exposes per-proposal logo controls
              (background removal + tile colour) on hover in editor. */}
          <div className="flex items-center gap-3">
            <EditableOperatorLogoTile
              {...logoTileProps}
              companyName={operator.companyName || "Safari Studio"}
              logoHeight={56}
            />
          </div>

          {/* Middle — title + destinations (label + list).
              Tagline removed per operator spec. */}
          <div className="py-10">
            <h1
              className="font-bold leading-[0.98] tracking-tight outline-none"
              style={{
                color: tokens.headingText,
                fontFamily: `'${theme.displayFont}', serif`,
                fontSize: "clamp(2.2rem, 4.6vw, 3.6rem)",
              }}
              contentEditable={isEditor}
              suppressContentEditableWarning
              data-ai-editable="cover-title"
              onBlur={(e) => updateTrip({ title: e.currentTarget.textContent?.trim() ?? trip.title })}
            >
              {trip.title}
            </h1>
            {orderedDestinations.length > 0 && (
              <div className="mt-6">
                <div
                  className="text-[10px] uppercase tracking-[0.32em] mb-1.5 font-semibold"
                  style={{ color: tokens.mutedText, fontFamily: `'${theme.bodyFont}', sans-serif` }}
                >
                  Your destinations
                </div>
                <div
                  className="text-[12px] uppercase tracking-[0.28em] font-semibold"
                  style={{ color: tokens.accent, fontFamily: `'${theme.bodyFont}', sans-serif` }}
                >
                  {formatDestinationsList(orderedDestinations, 6)}
                </div>
              </div>
            )}
          </div>

          {/* Bottom — meta strip */}
          <div
            className="pt-6 grid grid-cols-2 gap-x-6 gap-y-4"
            style={{ borderTop: `1px solid ${tokens.border}` }}
          >
            <CoverMeta label="For" tokens={tokens} theme={theme}>
              <span
                className="outline-none"
                contentEditable={isEditor}
                suppressContentEditableWarning
                onBlur={(e) => updateClient({ guestNames: e.currentTarget.textContent?.trim() ?? client.guestNames })}
              >
                {client.guestNames || "Your Guests"}
              </span>
            </CoverMeta>
            <CoverMeta label="Dates" tokens={tokens} theme={theme}>
              <span
                className="outline-none"
                contentEditable={isEditor}
                suppressContentEditableWarning
                onBlur={(e) => updateTrip({ dates: e.currentTarget.textContent?.trim() ?? trip.dates })}
              >
                {trip.dates || "—"}
              </span>
            </CoverMeta>
            <CoverMeta label="Durations" tokens={tokens} theme={theme}>
              {formatDuration(trip.nights)}
            </CoverMeta>
            <CoverMeta label="Party" tokens={tokens} theme={theme}>
              {formatParty(client)}
            </CoverMeta>
          </div>
        </div>
      </div>
    );
  }

  // ── Editorial Magazine ─────────────────────────────────────────────────────
  // Kinfolk / Cereal / Wallpaper aesthetic. Full-bleed image with a paper-
  // band masthead in the lower third — issue line, big serif title, sub deck.
  if (variant === "editorial-magazine") {
    return (
      <div
        className={`relative w-full overflow-hidden ${isEditor ? "min-h-[640px]" : "min-h-[640px]"}`}
        style={{ background: tokens.headingText }}
      >
        {/* Hero */}
        {heroUrl ? (
          <DraggableImage src={heroUrl} alt="Cover" className="absolute inset-0 w-full h-full object-cover" position={heroPosition} onPositionChange={onHeroPositionChange} isEditor={isEditor} onSingleClick={triggerHeroPicker} />
        ) : isEditor ? (
          <label className="absolute inset-0 cursor-pointer flex flex-col items-center justify-center group bg-black/30">
            <input type="file" accept="image/*" className="hidden" onChange={handleHeroUpload} />
            <div className="text-white/85 text-center transition group-hover:scale-105">
              <div className="text-5xl mb-3 opacity-60">+</div>
              <div className="text-[13px] font-semibold uppercase tracking-[0.2em]">Click to upload cover image</div>
              <div className="text-[11px] mt-2 opacity-60">JPG, PNG, or SVG · 16:9 or wider works best</div>
            </div>
          </label>
        ) : null}

        {/* Top vignette */}
        <div
          className="absolute inset-x-0 top-0 h-44"
          style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.55), transparent)" }}
        />

        {/* Masthead row — operator left, edition right.
            EditableOperatorLogoTile auto-picks light or dark tile based
            on the logo's brightness; in editor mode operators can
            override the tile colour or strip the bg per-proposal. */}
        <div className="relative z-10 flex items-center justify-between px-10 md:px-14 pt-10">
          <div className="flex items-center gap-3">
            <EditableOperatorLogoTile
              {...logoTileProps}
              companyName={operator.companyName || "Safari Studio"}
              logoHeight={56}
            />
          </div>
          {/* Edition / Issue line removed per operator spec.
              Right side intentionally empty — the masthead is just
              the logo. */}
        </div>

        {/* Lower paper band — masthead-style title block */}
        <div className="absolute inset-x-0 bottom-0 z-10">
          <div
            className="px-10 md:px-16 pt-10 pb-12"
            style={{
              background: tokens.pageBg,
              borderTop: `1px solid ${tokens.border}`,
            }}
          >
            <div className="max-w-[820px]">
              <h1
                className="font-bold leading-[0.95] tracking-tight outline-none"
                style={{
                  color: tokens.headingText,
                  fontFamily: `'${theme.displayFont}', serif`,
                  fontSize: "clamp(2.6rem, 6.4vw, 5.2rem)",
                }}
                contentEditable={isEditor}
                suppressContentEditableWarning
                onBlur={(e) => updateTrip({ title: e.currentTarget.textContent?.trim() ?? trip.title })}
              >
                {trip.title}
              </h1>

              {orderedDestinations.length > 0 && (
                <div className="mt-6">
                  <div
                    className="text-[10px] uppercase tracking-[0.32em] mb-1.5 font-semibold"
                    style={{ color: tokens.mutedText, fontFamily: `'${theme.bodyFont}', sans-serif` }}
                  >
                    Your destinations
                  </div>
                  <div
                    className="text-[12px] uppercase tracking-[0.28em] font-semibold"
                    style={{ color: tokens.accent, fontFamily: `'${theme.bodyFont}', sans-serif` }}
                  >
                    {formatDestinationsList(orderedDestinations, 6)}
                  </div>
                </div>
              )}

              {/* Hairline + meta strip */}
              <div className="mt-8 pt-6 grid grid-cols-2 md:grid-cols-4 gap-6"
                style={{ borderTop: `1px solid ${tokens.border}` }}>
                <CoverMeta label="For" tokens={tokens} theme={theme}>
                  <span
                    className="outline-none"
                    contentEditable={isEditor}
                    suppressContentEditableWarning
                    onBlur={(e) => updateClient({ guestNames: e.currentTarget.textContent?.trim() ?? client.guestNames })}
                  >
                    {client.guestNames || "Your Guests"}
                  </span>
                </CoverMeta>
                <CoverMeta label="Dates" tokens={tokens} theme={theme}>
                  <span
                    className="outline-none"
                    contentEditable={isEditor}
                    suppressContentEditableWarning
                    onBlur={(e) => updateTrip({ dates: e.currentTarget.textContent?.trim() ?? trip.dates })}
                  >
                    {trip.dates || "—"}
                  </span>
                </CoverMeta>
                <CoverMeta label="Durations" tokens={tokens} theme={theme}>
                  {formatDuration(trip.nights)}
                </CoverMeta>
                <CoverMeta label="Party" tokens={tokens} theme={theme}>
                  {formatParty(client)}
                </CoverMeta>
              </div>
              {/* Consultant attribution removed per operator spec. */}
            </div>
          </div>
        </div>

        {heroUrl && isEditor && (
          <label className="absolute top-4 right-4 z-[750] cursor-pointer bg-black/55 text-white text-[11px] px-3 py-1.5 rounded-md hover:bg-black/75 transition backdrop-blur-sm font-semibold">
            <input type="file" accept="image/*" className="hidden" onChange={handleHeroUpload} />
            Change image
          </label>
        )}
      </div>
    );
  }

  // ── Centered-editorial ─────────────────────────────────────────────────────
  if (variant === "centered-editorial") {
    return (
      <div
        className={`relative w-full flex flex-col overflow-hidden ${isEditor ? "min-h-[600px]" : "min-h-[640px]"}`}
        style={{ background: tokens.accent }}
      >
        {/* Full-bleed hero */}
        {heroUrl ? (
          <DraggableImage src={heroUrl} alt="Cover" className="absolute inset-0 w-full h-full object-cover" position={heroPosition} onPositionChange={onHeroPositionChange} isEditor={isEditor} onSingleClick={triggerHeroPicker} />
        ) : isEditor ? (
          <label className="absolute inset-0 cursor-pointer flex flex-col items-center justify-center group">
            <input type="file" accept="image/*" className="hidden" onChange={handleHeroUpload} />
            <div className="text-white/85 text-center transition group-hover:scale-105">
              <div className="text-5xl mb-3 opacity-60">+</div>
              <div className="text-[13px] font-semibold uppercase tracking-[0.2em]">Click to upload cover image</div>
              <div className="text-[11px] mt-2 opacity-60">JPG, PNG, or SVG</div>
            </div>
          </label>
        ) : null}
        {/* Change-image button — visible only when hero is set, editor only */}
        {heroUrl && isEditor && (
          <label className="absolute top-4 right-4 z-[750] cursor-pointer bg-black/55 text-white text-[11px] px-3 py-1.5 rounded-md hover:bg-black/75 transition backdrop-blur-sm font-semibold">
            <input type="file" accept="image/*" className="hidden" onChange={handleHeroUpload} />
            Change image
          </label>
        )}

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

        {/* Top bar — logo only. Consultant attribution removed
            per operator spec. */}
        <div className="relative z-10 flex items-center justify-between px-10 pt-10">
          <EditableOperatorLogoTile {...logoTileProps} logoHeight={56} />
        </div>

        {/* Centre — title + destinations (label + list).
            Tagline removed per operator spec. */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-8 py-16">
          <h1
            className="text-[clamp(2.8rem,8vw,6rem)] font-bold leading-[1.05] text-white max-w-3xl outline-none"
            style={{ fontFamily: `'${theme.displayFont}', serif`, textShadow: "0 2px 24px rgba(0,0,0,0.3)" }}
            contentEditable={isEditor}
            suppressContentEditableWarning
            onBlur={(e) => updateTrip({ title: e.currentTarget.textContent?.trim() ?? trip.title })}
          >
            {trip.title}
          </h1>

          {orderedDestinations.length > 0 && (
            <div className="mt-7">
              <div
                className="text-[10px] uppercase tracking-[0.32em] mb-1.5 font-semibold"
                style={{ color: "rgba(255,255,255,0.55)", fontFamily: `'${theme.bodyFont}', sans-serif` }}
              >
                Your destinations
              </div>
              <div
                className="text-[12px] uppercase tracking-[0.28em] font-semibold"
                style={{ color: "rgba(255,255,255,0.85)", fontFamily: `'${theme.bodyFont}', sans-serif` }}
              >
                {formatDestinationsList(orderedDestinations, 6)}
              </div>
            </div>
          )}

          {isEditor && !heroUrl && (
            <label className="mt-10 px-5 py-2.5 rounded-xl text-white/60 border border-white/25 text-sm cursor-pointer hover:border-white/50 hover:text-white/80 transition">
              <input type="file" accept="image/*" className="hidden" onChange={handleHeroUpload} />
              + Add hero image
            </label>
          )}
        </div>

        {/* Bottom meta strip — FOR / DATES / DURATIONS / PARTY. */}
        <div className="relative z-10 px-10 pb-10">
          <div
            className="max-w-3xl mx-auto pt-5 grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4"
            style={{ borderTop: "1px solid rgba(255,255,255,0.18)" }}
          >
            <DarkMeta label="For" theme={theme}>
              <span
                className="outline-none"
                contentEditable={isEditor}
                suppressContentEditableWarning
                onBlur={(e) => updateClient({ guestNames: e.currentTarget.textContent?.trim() ?? client.guestNames })}
              >
                {client.guestNames || "Your Guests"}
              </span>
            </DarkMeta>
            <DarkMeta label="Dates" theme={theme}>
              <span
                className="outline-none"
                contentEditable={isEditor}
                suppressContentEditableWarning
                onBlur={(e) => updateTrip({ dates: e.currentTarget.textContent?.trim() ?? trip.dates })}
              >
                {trip.dates || "—"}
              </span>
            </DarkMeta>
            <DarkMeta label="Durations" theme={theme}>
              {formatDuration(trip.nights)}
            </DarkMeta>
            <DarkMeta label="Party" theme={theme}>
              {formatParty(client)}
            </DarkMeta>
          </div>
        </div>
      </div>
    );
  }

  // ── Minimal-type — typography-focused, no hero image ─────────────────────────
  if (variant === "minimal-type") {
    return (
      <div
        className={`relative w-full flex flex-col justify-center overflow-hidden px-10 md:px-20 py-20 ${isEditor ? "min-h-[500px]" : "min-h-[80vh]"}`}
        style={{ background: tokens.sectionSurface }}
      >
        {/* Operator top-left */}
        <div className="absolute top-8 left-10">
          <EditableOperatorLogoTile {...logoTileProps} logoHeight={48} />
        </div>

        <div className="max-w-3xl">
          <h1
            className="text-[clamp(3rem,8vw,5.5rem)] font-bold leading-[0.95] tracking-tight outline-none"
            style={{ color: tokens.headingText, fontFamily: `'${theme.displayFont}', serif` }}
            contentEditable={isEditor}
            suppressContentEditableWarning
            onBlur={(e) => updateTrip({ title: e.currentTarget.textContent?.trim() ?? trip.title })}
          >
            {trip.title}
          </h1>

          {orderedDestinations.length > 0 && (
            <div className="mt-7">
              <div
                className="text-[10px] uppercase tracking-[0.32em] mb-1.5 font-semibold"
                style={{ color: tokens.mutedText, fontFamily: `'${theme.bodyFont}', sans-serif` }}
              >
                Your destinations
              </div>
              <div
                className="text-[12px] uppercase tracking-[0.28em] font-semibold"
                style={{ color: tokens.accent, fontFamily: `'${theme.bodyFont}', sans-serif` }}
              >
                {formatDestinationsList(orderedDestinations, 6)}
              </div>
            </div>
          )}

          {/* Hairline rule — 1px brand accent. */}
          <div className="w-20 mt-9 mb-8" style={{ height: "1px", background: tokens.accent }} />

          {/* Meta strip — FOR / DATES / DURATIONS / PARTY. */}
          <div
            className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4"
            style={{ fontFamily: `'${theme.bodyFont}', sans-serif` }}
          >
            <CoverMeta label="For" tokens={tokens} theme={theme}>
              <span
                className="outline-none"
                contentEditable={isEditor}
                suppressContentEditableWarning
                onBlur={(e) => updateClient({ guestNames: e.currentTarget.textContent?.trim() ?? client.guestNames })}
              >
                {client.guestNames || "Your Guests"}
              </span>
            </CoverMeta>
            <CoverMeta label="Dates" tokens={tokens} theme={theme}>
              <span
                className="outline-none"
                contentEditable={isEditor}
                suppressContentEditableWarning
                onBlur={(e) => updateTrip({ dates: e.currentTarget.textContent?.trim() ?? trip.dates })}
              >
                {trip.dates || "—"}
              </span>
            </CoverMeta>
            <CoverMeta label="Durations" tokens={tokens} theme={theme}>
              {formatDuration(trip.nights)}
            </CoverMeta>
            <CoverMeta label="Party" tokens={tokens} theme={theme}>
              {formatParty(client)}
            </CoverMeta>
          </div>
        </div>
      </div>
    );
  }

  // ── Full-bleed-overlay — type set directly on the photo ───────────────────
  // Used to be a frosted-glass card centred on the image. The card looked
  // skeuomorphic and dated; replaced with type-on-vignette so the photo
  // reads at full luxury weight, matching the editorial register of
  // hero-letter and the split-panel variants.
  if (variant === "full-bleed-overlay") {
    return (
      <div
        className={`relative w-full overflow-hidden ${isEditor ? "min-h-[600px]" : "min-h-[640px]"}`}
        style={{ background: tokens.accent }}
      >
        {heroUrl ? (
          <DraggableImage src={heroUrl} alt="Cover" className="absolute inset-0 w-full h-full object-cover" position={heroPosition} onPositionChange={onHeroPositionChange} isEditor={isEditor} onSingleClick={triggerHeroPicker} />
        ) : isEditor ? (
          <label className="absolute inset-0 cursor-pointer flex items-center justify-center">
            <input type="file" accept="image/*" className="hidden" onChange={handleHeroUpload} />
            <div className="text-white/30 text-center">
              <div className="text-5xl mb-3">+</div>
              <div className="text-sm">Add hero image</div>
            </div>
          </label>
        ) : null}

        {/* Editorial vignette — heavy at top + bottom, lighter in the
            middle so the photo carries the centre of the page. */}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to bottom,
              rgba(0,0,0,0.55) 0%,
              rgba(0,0,0,0.18) 28%,
              rgba(0,0,0,0.18) 58%,
              rgba(0,0,0,0.78) 100%
            )`,
          }}
        />

        {/* Top — logo only. Consultant attribution removed per
            operator spec. */}
        <div className="relative z-10 flex items-start justify-between px-10 md:px-14 pt-10">
          <EditableOperatorLogoTile {...logoTileProps} logoHeight={56} />
        </div>

        {/* Bottom: title + destinations + meta strip on vignette. */}
        <div className="absolute inset-x-0 bottom-0 z-10 px-10 md:px-16 pb-12">
          <div className="max-w-3xl mx-auto text-center">
            <h1
              className="font-bold text-white leading-[1.0] outline-none"
              style={{
                fontFamily: `'${theme.displayFont}', serif`,
                fontSize: "clamp(2.4rem, 6vw, 4.6rem)",
                textShadow: "0 2px 24px rgba(0,0,0,0.35)",
              }}
              contentEditable={isEditor}
              suppressContentEditableWarning
              onBlur={(e) => updateTrip({ title: e.currentTarget.textContent?.trim() ?? trip.title })}
            >
              {trip.title}
            </h1>

            {orderedDestinations.length > 0 && (
              <div className="mt-7">
                <div
                  className="text-[10px] uppercase tracking-[0.32em] mb-1.5 font-semibold"
                  style={{ color: "rgba(255,255,255,0.55)", fontFamily: `'${theme.bodyFont}', sans-serif` }}
                >
                  Your destinations
                </div>
                <div
                  className="text-[12px] uppercase tracking-[0.28em] font-semibold"
                  style={{ color: "rgba(255,255,255,0.85)", fontFamily: `'${theme.bodyFont}', sans-serif` }}
                >
                  {formatDestinationsList(orderedDestinations, 6)}
                </div>
              </div>
            )}

            {/* Hairline + 4-cell meta strip. */}
            <div
              className="mt-8 pt-5 grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4 text-left md:text-center"
              style={{ borderTop: "1px solid rgba(255,255,255,0.22)" }}
            >
              <DarkMeta label="For" theme={theme}>
                <span
                  className="outline-none"
                  contentEditable={isEditor}
                  suppressContentEditableWarning
                  onBlur={(e) => updateClient({ guestNames: e.currentTarget.textContent?.trim() ?? client.guestNames })}
                >
                  {client.guestNames || "Your Guests"}
                </span>
              </DarkMeta>
              <DarkMeta label="Dates" theme={theme}>
                <span
                  className="outline-none"
                  contentEditable={isEditor}
                  suppressContentEditableWarning
                  onBlur={(e) => updateTrip({ dates: e.currentTarget.textContent?.trim() ?? trip.dates })}
                >
                  {trip.dates || "—"}
                </span>
              </DarkMeta>
              <DarkMeta label="Durations" theme={theme}>
                {formatDuration(trip.nights)}
              </DarkMeta>
              <DarkMeta label="Party" theme={theme}>
                {formatParty(client)}
              </DarkMeta>
            </div>
          </div>
        </div>

        {heroUrl && isEditor && (
          <label className="absolute bottom-5 right-5 z-[750] cursor-pointer bg-black/50 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-black/70 transition backdrop-blur-sm">
            <input type="file" accept="image/*" className="hidden" onChange={handleHeroUpload} />
            Change image
          </label>
        )}
      </div>
    );
  }

  // ── Flip-split — image left, text right ──────────────────────────────────────
  if (variant === "flip-split") {
    return (
      <div className={`relative w-full flex overflow-hidden ${isEditor ? "min-h-[600px]" : "min-h-[640px]"}`}>
        {/* Full-bleed image */}
        <div className="absolute inset-0">
          {heroUrl ? (
            <DraggableImage src={heroUrl} alt="Cover" className="w-full h-full object-cover" position={heroPosition} onPositionChange={onHeroPositionChange} isEditor={isEditor} onSingleClick={triggerHeroPicker} />
          ) : isEditor ? (
            <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer" style={{ background: tokens.accent }}>
              <input type="file" accept="image/*" className="hidden" onChange={handleHeroUpload} />
              <div className="text-white/30 text-center"><div className="text-5xl mb-3">+</div><div className="text-sm">Add hero image</div></div>
            </label>
          ) : (
            <div style={{ background: tokens.accent, width: "100%", height: "100%" }} />
          )}
          {/* Gradient: right coverage */}
          <div className="absolute inset-0" style={{
            background: `linear-gradient(255deg, ${tokens.accent} 0%, ${tokens.accent} 38%, rgba(0,0,0,0.55) 60%, rgba(0,0,0,0.2) 100%)`,
          }} />
        </div>

        {/* Right: text column */}
        <div className="relative z-10 ml-auto flex flex-col justify-between w-full md:w-[52%] px-10 md:px-14 py-10" style={{ minHeight: isEditor ? "600px" : "100vh" }}>
          <div className="flex items-center justify-end gap-3">
            <EditableOperatorLogoTile {...logoTileProps} logoHeight={56} />
          </div>

          <div className="space-y-6 text-right">
            <h1 className="text-[clamp(2.5rem,5.5vw,4.5rem)] font-bold text-white leading-[1.0] outline-none"
              style={{ fontFamily: `'${theme.displayFont}', serif`, textShadow: "0 2px 20px rgba(0,0,0,0.2)" }}
              contentEditable={isEditor} suppressContentEditableWarning
              onBlur={(e) => updateTrip({ title: e.currentTarget.textContent?.trim() ?? trip.title })}>
              {trip.title}
            </h1>
            {orderedDestinations.length > 0 && (
              <div>
                <div
                  className="text-[10px] uppercase tracking-[0.32em] mb-1.5 font-semibold"
                  style={{ color: "rgba(255,255,255,0.55)", fontFamily: `'${theme.bodyFont}', sans-serif` }}
                >
                  Your destinations
                </div>
                <div
                  className="text-[12px] uppercase tracking-[0.28em] font-semibold"
                  style={{ color: "rgba(255,255,255,0.85)", fontFamily: `'${theme.bodyFont}', sans-serif` }}
                >
                  {formatDestinationsList(orderedDestinations, 6)}
                </div>
              </div>
            )}
          </div>

          {/* Meta strip — FOR / DATES / DURATIONS / PARTY. */}
          <div
            className="grid grid-cols-2 gap-x-6 gap-y-4 text-right pt-5"
            style={{
              borderTop: "1px solid rgba(255,255,255,0.22)",
              fontFamily: `'${theme.bodyFont}', sans-serif`,
            }}
          >
            <DarkMeta label="For" theme={theme}>
              <span
                className="outline-none"
                contentEditable={isEditor}
                suppressContentEditableWarning
                onBlur={(e) => updateClient({ guestNames: e.currentTarget.textContent?.trim() ?? client.guestNames })}
              >
                {client.guestNames || "Your Guests"}
              </span>
            </DarkMeta>
            <DarkMeta label="Dates" theme={theme}>
              <span
                className="outline-none"
                contentEditable={isEditor}
                suppressContentEditableWarning
                onBlur={(e) => updateTrip({ dates: e.currentTarget.textContent?.trim() ?? trip.dates })}
              >
                {trip.dates || "—"}
              </span>
            </DarkMeta>
            <DarkMeta label="Durations" theme={theme}>
              {formatDuration(trip.nights)}
            </DarkMeta>
            <DarkMeta label="Party" theme={theme}>
              {formatParty(client)}
            </DarkMeta>
          </div>
        </div>

        {heroUrl && isEditor && (
          <label className="absolute bottom-5 left-5 z-[750] cursor-pointer bg-black/50 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-black/70 transition backdrop-blur-sm">
            <input type="file" accept="image/*" className="hidden" onChange={handleHeroUpload} />
            Change image
          </label>
        )}
      </div>
    );
  }

  // ── Cinematic-split (default) ───────────────────────────────────────────────
  return (
    <div className={`relative w-full flex overflow-hidden ${isEditor ? "min-h-[600px]" : "min-h-[640px]"}`}>
      {/* Right: full-bleed image */}
      <div className="absolute inset-0">
        {heroUrl ? (
          <DraggableImage src={heroUrl} alt="Cover" className="w-full h-full object-cover" position={heroPosition} onPositionChange={onHeroPositionChange} isEditor={isEditor} onSingleClick={triggerHeroPicker} />
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
      <div className={`relative z-10 flex flex-col justify-between w-full md:w-[52%] px-10 md:px-14 py-10 ${isEditor ? "min-h-[600px]" : "min-h-[640px]"}`}>
        {/* Top: operator */}
        <div className="flex items-center gap-3">
          <EditableOperatorLogoTile {...logoTileProps} logoHeight={56} />
        </div>

        {/* Middle — title + destinations (label + list).
            Tagline removed per operator spec. */}
        <div className="space-y-6">
          <h1
            className="text-[clamp(2.5rem,5.5vw,4.5rem)] font-bold text-white leading-[1.0] outline-none"
            style={{ fontFamily: `'${theme.displayFont}', serif`, textShadow: "0 2px 20px rgba(0,0,0,0.2)" }}
            contentEditable={isEditor}
            suppressContentEditableWarning
            onBlur={(e) => updateTrip({ title: e.currentTarget.textContent?.trim() ?? trip.title })}
          >
            {trip.title}
          </h1>

          {orderedDestinations.length > 0 && (
            <div>
              <div
                className="text-[10px] uppercase tracking-[0.32em] mb-1.5 font-semibold"
                style={{ color: "rgba(255,255,255,0.55)", fontFamily: `'${theme.bodyFont}', sans-serif` }}
              >
                Your destinations
              </div>
              <div
                className="text-[12px] uppercase tracking-[0.28em] font-semibold"
                style={{ color: "rgba(255,255,255,0.85)", fontFamily: `'${theme.bodyFont}', sans-serif` }}
              >
                {formatDestinationsList(orderedDestinations, 6)}
              </div>
            </div>
          )}
        </div>

        {/* Meta strip — FOR / DATES / DURATIONS / PARTY. */}
        <div
          className="grid grid-cols-2 gap-x-6 gap-y-4 pt-5"
          style={{
            borderTop: "1px solid rgba(255,255,255,0.22)",
            fontFamily: `'${theme.bodyFont}', sans-serif`,
          }}
        >
          <DarkMeta label="For" theme={theme}>
            <span
              className="outline-none"
              contentEditable={isEditor}
              suppressContentEditableWarning
              onBlur={(e) => updateClient({ guestNames: e.currentTarget.textContent?.trim() ?? client.guestNames })}
            >
              {client.guestNames || "Your Guests"}
            </span>
          </DarkMeta>
          <DarkMeta label="Dates" theme={theme}>
            <span
              className="outline-none"
              contentEditable={isEditor}
              suppressContentEditableWarning
              onBlur={(e) => updateTrip({ dates: e.currentTarget.textContent?.trim() ?? trip.dates })}
            >
              {trip.dates || "—"}
            </span>
          </DarkMeta>
          <DarkMeta label="Durations" theme={theme}>
            {formatDuration(trip.nights)}
          </DarkMeta>
          <DarkMeta label="Party" theme={theme}>
            {formatParty(client)}
          </DarkMeta>
        </div>
      </div>

      {/* Change image button (editor) */}
      {heroUrl && isEditor && (
        <label className="absolute bottom-5 right-5 z-[750] cursor-pointer bg-black/50 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-black/70 transition backdrop-blur-sm">
          <input type="file" accept="image/*" className="hidden" onChange={handleHeroUpload} />
          Change image
        </label>
      )}
    </div>
  );
}
