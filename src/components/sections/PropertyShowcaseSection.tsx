"use client";

import { useState } from "react";
import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import { resolveTokens } from "@/lib/theme";
import { uploadImage } from "@/lib/uploadImage";
import { AmenityIcon } from "@/components/sections/day-card/shared/AmenityIcon";
import type {
  Section,
  Property,
  PropertyRoom,
  TierKey,
  Proposal,
  ProposalTheme,
  ThemeTokens,
} from "@/lib/types";

// Property Showcase — one single editorial-carousel variant.
//
// For each property in the proposal, render a full-width spread:
//   ┌─────────────────┬───────────────────────────────────────┐
//   │ Title           │   STATS · ROOMS · INFORMATION   ← → •• │
//   │ Park · Days     │                                       │
//   │                 │                                       │
//   │ Your Stay       │        (tab content fills here)       │
//   │ Fun Facts       │                                       │
//   └─────────────────┴───────────────────────────────────────┘
//
// Tabs are real:
//   STATS         — image carousel (leadImage + galleryUrls)
//   ROOMS         — room type cards with bed config + photos
//   INFORMATION   — long-form description + whyWeChoseThis + amenities
//
// All fields are contentEditable in editor mode; in share view the
// carousel arrows/dots are the only interactive bits.

type Tab = "stats" | "rooms" | "information";

export function PropertyShowcaseSection({ section }: { section: Section }) {
  const { proposal } = useProposalStore();
  const { mode } = useEditorStore();
  const isEditor = mode === "editor";
  const { theme, properties: allProperties, days, activeTier } = proposal;
  const tokens = resolveTokens(theme.tokens, section.styleOverrides);

  // Operator brief F1: only render properties that are actually
  // referenced by at least one day's active-tier camp pick. Orphan
  // properties (added to proposal.properties via library / autopilot
  // but never linked to a day) stay in the data but don't appear in
  // the showcase. Case-insensitive name match.
  const referencedCampNames = new Set<string>();
  for (const d of days) {
    const camp = d.tiers?.[activeTier as TierKey]?.camp?.trim().toLowerCase();
    if (camp) referencedCampNames.add(camp);
  }
  const properties = allProperties.filter((p) =>
    referencedCampNames.has(p.name.trim().toLowerCase()),
  );

  if (properties.length === 0) {
    return (
      <div className="py-12" style={{ background: tokens.sectionSurface }}>
        <div className="ed-wide text-center text-small" style={{ color: tokens.mutedText }}>
          {isEditor
            ? "No properties added yet. Pick properties from the library in Day-by-Day cards."
            : "Property details coming soon."}
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: tokens.sectionSurface }}>
      {/* Outer bg = sectionSurface (cream) so it BLENDS with the
          PropertyBlock cards below. Previously this used pageBg
          (green) which created a visible green stripe between the
          "Your Accommodations" header and the first property card.
          Now header + cards share the same background — single
          continuous accommodation block. */}
      <header className="px-8 md:px-12 pt-2 pb-1">
        <div
          className="text-[10.5px] uppercase tracking-[0.28em] font-semibold mb-1.5"
          style={{ color: tokens.mutedText }}
        >
          The lodges
        </div>
        <h2
          className="font-bold leading-[1.05]"
          style={{
            color: tokens.headingText,
            fontFamily: `'${theme.displayFont}', serif`,
            fontSize: "clamp(1.6rem, 2.8vw, 2.2rem)",
            letterSpacing: "-0.015em",
          }}
        >
          Your accommodations
        </h2>
      </header>
      {properties.map((property, idx) => (
        <PropertyBlock
          key={property.id}
          property={property}
          isFirst={idx === 0}
          isLast={idx === properties.length - 1}
          isEditor={isEditor}
          proposal={proposal}
          theme={theme}
          tokens={tokens}
        />
      ))}
    </div>
  );
}

// ─── Single property block ────────────────────────────────────────────────

function PropertyBlock({
  property,
  isFirst,
  isLast,
  isEditor,
  proposal,
  theme,
  tokens,
}: {
  property: Property;
  isFirst: boolean;
  isLast: boolean;
  isEditor: boolean;
  proposal: Proposal;
  theme: ProposalTheme;
  tokens: ThemeTokens;
}) {
  const {
    updateProperty,
    addPropertyRoom,
  } = useProposalStore();
  const [activeTab, setActiveTab] = useState<Tab>("stats");
  const [carouselIndex, setCarouselIndex] = useState(0);

  // Compute "Days 1-2" label from which days use this property at the
  // active tier. Keeps this in sync with the itinerary automatically.
  const daysLabel = computeDaysLabel(property, proposal, proposal.activeTier as TierKey);
  // Nights is derived the same way.
  const nightsCount = countNightsFor(property, proposal, proposal.activeTier as TierKey);

  const carouselImages = [property.leadImageUrl, ...(property.galleryUrls ?? [])].filter(
    (u): u is string => Boolean(u),
  );
  const activeCarouselImage = carouselImages[carouselIndex] ?? null;
  const goPrev = () =>
    setCarouselIndex((i) => (i <= 0 ? Math.max(0, carouselImages.length - 1) : i - 1));
  const goNext = () =>
    setCarouselIndex((i) => (i >= carouselImages.length - 1 ? 0 : i + 1));

  return (
    <div
      className="py-4 md:py-6"
      data-property-block
      style={{
        background: tokens.sectionSurface,
        borderTop: isFirst ? "none" : `1px solid ${tokens.border}`,
      }}
    >
      <div className="max-w-6xl mx-auto px-8 md:px-12">
        {/* Editorial standfirst — promotes whyWeChoseThis from the
            INFORMATION tab to a magazine-quality pull-quote above the
            property block. Italic display serif, centred, hairline
            ornaments either side. Hidden in preview when blank;
            visible in editor with a subtle hint so operators see the
            slot. The aim is a moment of editorial voice ABOVE every
            property — the thing Safari Portal / Safari Office don't
            do. */}
        {(property.whyWeChoseThis || isEditor) && (
          <div className="mb-8 md:mb-10 flex items-center gap-4 max-w-3xl mx-auto">
            <span
              aria-hidden
              className="flex-1 h-px"
              style={{ background: tokens.border }}
            />
            <div
              className="text-center italic outline-none leading-snug"
              style={{
                color: tokens.headingText,
                fontFamily: `'${theme.displayFont}', serif`,
                fontSize: "clamp(16px, 1.85vw, 21px)",
                opacity: property.whyWeChoseThis ? 0.92 : 0.5,
                maxWidth: "60ch",
              }}
              contentEditable={isEditor}
              suppressContentEditableWarning
              onBlur={(e) =>
                useProposalStore.getState().updateProperty(property.id, {
                  whyWeChoseThis: e.currentTarget.textContent?.trim() ?? "",
                })
              }
            >
              {property.whyWeChoseThis ||
                (isEditor
                  ? "Why this lodge for these guests? One editorial line."
                  : "")}
            </div>
            <span
              aria-hidden
              className="flex-1 h-px"
              style={{ background: tokens.border }}
            />
          </div>
        )}

        <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,2.2fr)] gap-10 items-start">
          {/* ── Left sidebar ──────────────────────────────────────── */}
          <div>
            <h3
              className="font-bold leading-[1.05] outline-none"
              style={{
                color: tokens.headingText,
                fontFamily: `'${theme.displayFont}', serif`,
                fontSize: "clamp(1.8rem, 2.8vw, 2.4rem)",
                letterSpacing: "-0.01em",
              }}
              contentEditable={isEditor}
              suppressContentEditableWarning
              onBlur={(e) =>
                updateProperty(property.id, {
                  name: e.currentTarget.textContent?.trim() ?? property.name,
                })
              }
            >
              {property.name}
            </h3>

            <div
              className="mt-3 text-[10.5px] uppercase tracking-[0.24em] font-semibold"
              style={{ color: tokens.mutedText }}
            >
              <span
                className="outline-none"
                contentEditable={isEditor}
                suppressContentEditableWarning
                onBlur={(e) =>
                  updateProperty(property.id, {
                    location: e.currentTarget.textContent?.trim() ?? property.location,
                  })
                }
              >
                {property.location || "Location"}
              </span>
              {daysLabel && (
                <>
                  <span className="mx-2 opacity-60">|</span>
                  <span>{daysLabel}</span>
                </>
              )}
            </div>

            {/* Your Stay */}
            <FactBlock label="Your Stay" tokens={tokens}>
              <FactRow label="Nights" value={nightsCount ? String(nightsCount) : "—"} tokens={tokens} />
              <FactRow
                label="Meal"
                value={property.mealPlan || "—"}
                tokens={tokens}
                isEditor={isEditor}
                onChange={(v) => updateProperty(property.id, { mealPlan: v })}
              />
              <FactRow
                label="Check-in"
                value={property.checkInTime || "—"}
                tokens={tokens}
                isEditor={isEditor}
                onChange={(v) => updateProperty(property.id, { checkInTime: v })}
              />
              <FactRow
                label="Check-out"
                value={property.checkOutTime || "—"}
                tokens={tokens}
                isEditor={isEditor}
                onChange={(v) => updateProperty(property.id, { checkOutTime: v })}
              />
            </FactBlock>

            {/* At-a-glance amenities — small SVG icons rendered from
                property.amenities. Operator brief: labels were
                getting cut off by `truncate` in the 3-col grid, so
                we now switch to a 2-col layout with wrapping text
                so long labels (e.g. "Private plunge pool") show in
                full across two lines. Defaults to [] when amenities
                is missing (legacy property records imported without
                the field). */}
            {((property.amenities ?? []).length > 0 || isEditor) && (
              <div
                className="mt-7 mb-1"
                style={{ borderTop: `1px solid ${tokens.border}` }}
              >
                <div
                  className="text-[9.5px] uppercase tracking-[0.28em] font-semibold mt-5 mb-3"
                  style={{ color: tokens.mutedText }}
                >
                  At a glance
                </div>
                {(property.amenities ?? []).length > 0 ? (
                  <div
                    className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2.5"
                    style={{ color: tokens.headingText }}
                  >
                    {(property.amenities ?? []).slice(0, 6).map((label) => (
                      <div
                        key={label}
                        className="flex items-start gap-2 text-[12px] leading-snug"
                        title={label}
                      >
                        <span className="shrink-0 mt-0.5">
                          <AmenityIcon
                            label={label}
                            size={16}
                            color={tokens.accent}
                          />
                        </span>
                        <span className="break-words">{label}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    className="text-[11.5px] italic"
                    style={{ color: tokens.mutedText }}
                  >
                    Add amenities in the Information tab.
                  </div>
                )}
              </div>
            )}

            {/* Fun Facts */}
            <FactBlock label="Fun Facts" tokens={tokens}>
              <FactRow
                label="No. of rooms"
                value={property.totalRooms ? String(property.totalRooms) : "—"}
                tokens={tokens}
                isEditor={isEditor}
                onChange={(v) => {
                  const n = parseInt(v, 10);
                  updateProperty(property.id, {
                    totalRooms: Number.isFinite(n) ? n : undefined,
                  });
                }}
              />
              <FactRow
                label="Spoken languages"
                value={(property.spokenLanguages ?? []).join(", ") || "—"}
                tokens={tokens}
                isEditor={isEditor}
                onChange={(v) =>
                  updateProperty(property.id, {
                    spokenLanguages: v
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
              />
              <FactRow
                label="Special interests"
                value={(property.specialInterests ?? []).join(", ") || "—"}
                tokens={tokens}
                isEditor={isEditor}
                onChange={(v) =>
                  updateProperty(property.id, {
                    specialInterests: v
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
              />
            </FactBlock>
          </div>

          {/* ── Right column ──────────────────────────────────────── */}
          <div>
            {/* Tabs + carousel controls */}
            <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
              <TabBar activeTab={activeTab} onTab={setActiveTab} tokens={tokens} />

              {activeTab === "stats" && carouselImages.length > 1 && (
                <div className="flex items-center gap-3 text-[12px]">
                  <button
                    type="button"
                    onClick={goPrev}
                    className="w-7 h-7 rounded-full flex items-center justify-center transition hover:opacity-70"
                    style={{ border: `1px solid ${tokens.border}`, color: tokens.mutedText }}
                    aria-label="Previous"
                  >
                    ‹
                  </button>
                  <div className="flex items-center gap-1">
                    {carouselImages.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setCarouselIndex(i)}
                        className="w-1.5 h-1.5 rounded-full transition"
                        style={{
                          background: i === carouselIndex ? tokens.accent : tokens.border,
                        }}
                        aria-label={`Image ${i + 1}`}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={goNext}
                    className="w-7 h-7 rounded-full flex items-center justify-center transition hover:opacity-70"
                    style={{ border: `1px solid ${tokens.border}`, color: tokens.mutedText }}
                    aria-label="Next"
                  >
                    ›
                  </button>
                </div>
              )}
            </div>

            {/* Tab content */}
            {activeTab === "stats" && (
              <StatsTab
                imageUrl={activeCarouselImage}
                carouselImages={carouselImages}
                carouselIndex={carouselIndex}
                onSelectImage={setCarouselIndex}
                property={property}
                isEditor={isEditor}
                tokens={tokens}
              />
            )}
            {activeTab === "rooms" && (
              <RoomsTab
                property={property}
                isEditor={isEditor}
                tokens={tokens}
                theme={theme}
                onAddRoom={() => addPropertyRoom(property.id)}
              />
            )}
            {activeTab === "information" && (
              <InformationTab property={property} isEditor={isEditor} tokens={tokens} />
            )}
          </div>
        </div>
      </div>
      {!isLast && (
        <div
          className="max-w-6xl mx-auto px-8 md:px-12 mt-14"
          aria-hidden
          style={{ height: 1, background: "transparent" }}
        />
      )}
    </div>
  );
}

// ─── Tab bar ──────────────────────────────────────────────────────────────

function TabBar({
  activeTab,
  onTab,
  tokens,
}: {
  activeTab: Tab;
  onTab: (t: Tab) => void;
  tokens: ThemeTokens;
}) {
  const tabs: { id: Tab; label: string }[] = [
    { id: "stats", label: "Stats" },
    { id: "rooms", label: "Rooms" },
    { id: "information", label: "Information" },
  ];
  return (
    <div className="flex items-center gap-6">
      {tabs.map((t) => {
        const active = t.id === activeTab;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onTab(t.id)}
            className="text-[11px] uppercase tracking-[0.28em] font-semibold transition relative pb-1.5"
            style={{
              color: active ? tokens.headingText : tokens.mutedText,
            }}
          >
            {t.label}
            {active && (
              <span
                aria-hidden
                className="absolute left-0 right-0 bottom-0 h-px"
                style={{ background: tokens.accent }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── STATS tab — image carousel ──────────────────────────────────────────

function StatsTab({
  imageUrl,
  carouselImages,
  carouselIndex,
  onSelectImage,
  property,
  isEditor,
  tokens,
}: {
  imageUrl: string | null;
  carouselImages: string[];
  carouselIndex: number;
  onSelectImage: (i: number) => void;
  property: Property;
  isEditor: boolean;
  tokens: ThemeTokens;
}) {
  const { updateProperty } = useProposalStore();

  const uploadLead = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await uploadImage(file);
      updateProperty(property.id, { leadImageUrl: dataUrl });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Upload failed");
    }
  };

  const appendGallery = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    try {
      const urls = await Promise.all(files.map((f) => uploadImage(f)));
      updateProperty(property.id, {
        galleryUrls: [...(property.galleryUrls ?? []), ...urls],
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Upload failed");
    }
  };

  // Magazine collage: 1 large lead + up to 3 thumbnails of OTHER images
  // visible at once. Replaces the single-image-at-a-time carousel that
  // left a sea of white space below the lead photo. Clicking a thumbnail
  // promotes it to the lead position; if the property has > 4 images
  // total, the third thumbnail shows a "+N more" overlay that cycles
  // through the rest on click.
  const MAX_THUMBS = 3;
  const otherImages = carouselImages
    .map((url, i) => ({ url, i }))
    .filter(({ i }) => i !== carouselIndex);
  const thumbs = otherImages.slice(0, MAX_THUMBS);
  const hasMore = otherImages.length > MAX_THUMBS;
  // The "+N more" thumb advances through the leftover images.
  const nextLeftoverIndex = hasMore ? otherImages[MAX_THUMBS].i : null;

  return (
    <div className="flex flex-col gap-2">
      {/* Lead photo — 5:4, slightly taller than 4:3 so it feels
          editorial-cinematic, fills more of the right column, and
          earns the visual weight the section deserves. */}
      <div
        className="relative overflow-hidden w-full"
        style={{
          background: tokens.cardBg,
          aspectRatio: "5 / 4",
          borderRadius: 4,
        }}
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={property.name}
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300"
          />
        ) : isEditor ? (
          <label className="absolute inset-0 cursor-pointer flex flex-col items-center justify-center">
            <input type="file" accept="image/*" className="hidden" onChange={uploadLead} />
            <div className="text-center" style={{ color: tokens.mutedText }}>
              <div className="text-4xl mb-2 opacity-60">+</div>
              <div className="text-[11.5px] uppercase tracking-[0.22em] font-semibold">
                Add property photo
              </div>
            </div>
          </label>
        ) : null}

        {isEditor && (
          <label
            className="absolute top-3 right-3 cursor-pointer bg-black/50 text-white text-[11px] px-2.5 py-1 rounded-md hover:bg-black/70 transition backdrop-blur-sm"
            title="Add more gallery images"
          >
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={appendGallery}
            />
            + Gallery images
          </label>
        )}
      </div>

      {/* Thumbnail row — 3-up grid of other images. Click to promote
          to the lead position. Hidden when the property has 1 image
          or none (the lead alone tells the story). Shown as add-photo
          placeholders in editor mode when slots are empty so the
          operator sees there's a gallery slot to fill. */}
      {(carouselImages.length > 1 || isEditor) && (
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: MAX_THUMBS }).map((_, slotIdx) => {
            const thumb = thumbs[slotIdx];
            const isLastSlotWithMore = slotIdx === MAX_THUMBS - 1 && hasMore;
            const moreCount = otherImages.length - MAX_THUMBS;
            return (
              <button
                key={slotIdx}
                type="button"
                onClick={() => {
                  if (thumb) {
                    if (isLastSlotWithMore && nextLeftoverIndex !== null) {
                      onSelectImage(nextLeftoverIndex);
                    } else {
                      onSelectImage(thumb.i);
                    }
                  }
                }}
                disabled={!thumb}
                className="relative overflow-hidden disabled:cursor-default group"
                style={{
                  background: tokens.cardBg,
                  // 4:5 thumbs (slight portrait) match the editorial
                  // weight of the taller lead photo and give the row
                  // more presence than 1:1 squares.
                  aspectRatio: "4 / 5",
                  borderRadius: 4,
                  border: thumb ? "none" : `1px dashed ${tokens.border}`,
                  cursor: thumb ? "pointer" : "default",
                }}
                title={
                  isLastSlotWithMore
                    ? `+${moreCount} more — click to advance`
                    : thumb
                      ? "View as lead image"
                      : ""
                }
              >
                {thumb ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={thumb.url}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                    />
                    {isLastSlotWithMore && (
                      <div
                        className="absolute inset-0 flex items-center justify-center text-white text-[14px] font-semibold tracking-wide backdrop-blur-[1px]"
                        style={{ background: "rgba(0,0,0,0.45)" }}
                      >
                        +{moreCount} more
                      </div>
                    )}
                  </>
                ) : isEditor ? (
                  <span
                    className="absolute inset-0 flex items-center justify-center text-[10.5px] uppercase tracking-[0.22em]"
                    style={{ color: tokens.mutedText }}
                  >
                    + Add
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── ROOMS tab ────────────────────────────────────────────────────────────

function RoomsTab({
  property,
  isEditor,
  tokens,
  theme,
  onAddRoom,
}: {
  property: Property;
  isEditor: boolean;
  tokens: ThemeTokens;
  theme: ProposalTheme;
  onAddRoom: () => void;
}) {
  const rooms = property.rooms ?? [];
  if (rooms.length === 0 && !isEditor) {
    return (
      <div className="text-[13px] italic py-10" style={{ color: tokens.mutedText }}>
        Room details coming soon.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {rooms.map((room) => (
        <RoomCard
          key={room.id}
          room={room}
          propertyId={property.id}
          isEditor={isEditor}
          tokens={tokens}
          theme={theme}
        />
      ))}
      {isEditor && (
        <button
          type="button"
          onClick={onAddRoom}
          className="w-full py-4 text-[12px] font-semibold uppercase tracking-[0.22em] rounded-md transition hover:opacity-80"
          style={{
            color: tokens.accent,
            background: `${tokens.accent}10`,
            border: `1px dashed ${tokens.accent}55`,
          }}
        >
          + Add room type
        </button>
      )}
    </div>
  );
}

function RoomCard({
  room,
  propertyId,
  isEditor,
  tokens,
  theme,
}: {
  room: PropertyRoom;
  propertyId: string;
  isEditor: boolean;
  tokens: ThemeTokens;
  theme: ProposalTheme;
}) {
  const { updatePropertyRoom, removePropertyRoom } = useProposalStore();
  const imageUrls = room.imageUrls ?? [];

  const appendImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    try {
      const urls = await Promise.all(files.map((f) => uploadImage(f)));
      updatePropertyRoom(propertyId, room.id, { imageUrls: [...imageUrls, ...urls] });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Upload failed");
    }
  };

  const removeImage = (idx: number) =>
    updatePropertyRoom(propertyId, room.id, {
      imageUrls: imageUrls.filter((_, i) => i !== idx),
    });

  return (
    <div
      className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4 p-4 rounded-md"
      style={{ background: tokens.cardBg, border: `1px solid ${tokens.border}` }}
    >
      {/* Details */}
      <div className="min-w-0">
        <div
          className="text-[16px] font-semibold outline-none"
          style={{
            color: tokens.headingText,
            fontFamily: `'${theme.displayFont}', serif`,
          }}
          contentEditable={isEditor}
          suppressContentEditableWarning
          onBlur={(e) =>
            updatePropertyRoom(propertyId, room.id, {
              name: e.currentTarget.textContent?.trim() ?? room.name,
            })
          }
        >
          {room.name}
        </div>
        {(room.bedConfig || isEditor) && (
          <div
            className="text-[12.5px] italic mt-1 outline-none"
            style={{ color: tokens.mutedText }}
            contentEditable={isEditor}
            suppressContentEditableWarning
            onBlur={(e) =>
              updatePropertyRoom(propertyId, room.id, {
                bedConfig: e.currentTarget.textContent?.trim() ?? room.bedConfig ?? "",
              })
            }
          >
            {room.bedConfig || (isEditor ? "Bed configuration" : "")}
          </div>
        )}
        {(room.description || isEditor) && (
          <div
            className="text-[13px] leading-[1.7] mt-3 outline-none"
            style={{ color: tokens.bodyText }}
            contentEditable={isEditor}
            suppressContentEditableWarning
            onBlur={(e) =>
              updatePropertyRoom(propertyId, room.id, {
                description: e.currentTarget.textContent ?? "",
              })
            }
          >
            {room.description || (isEditor ? "Describe the room…" : "")}
          </div>
        )}
        {isEditor && (
          <button
            type="button"
            onClick={() => removePropertyRoom(propertyId, room.id)}
            className="mt-3 text-[11px] text-black/40 hover:text-red-500 transition"
          >
            Remove room
          </button>
        )}
      </div>

      {/* Room images */}
      <div>
        {imageUrls.length > 0 ? (
          <div className="grid grid-cols-2 gap-1.5">
            {imageUrls.map((url, i) => (
              <div
                key={i}
                className="relative group"
                style={{ aspectRatio: "4 / 3", background: tokens.cardBg }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="w-full h-full object-cover rounded-sm" />
                {isEditor && (
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-[10px] opacity-0 group-hover:opacity-100 transition"
                    title="Remove"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : null}
        {isEditor && (
          <label
            className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] px-3 py-1.5 rounded-md transition hover:opacity-80 cursor-pointer"
            style={{
              color: tokens.accent,
              background: `${tokens.accent}10`,
              border: `1px dashed ${tokens.accent}55`,
            }}
          >
            <input type="file" accept="image/*" multiple className="hidden" onChange={appendImage} />
            + Add room photos
          </label>
        )}
      </div>
    </div>
  );
}

// ─── INFORMATION tab ──────────────────────────────────────────────────────

function InformationTab({
  property,
  isEditor,
  tokens,
}: {
  property: Property;
  isEditor: boolean;
  tokens: ThemeTokens;
}) {
  const { updateProperty } = useProposalStore();
  return (
    <div className="space-y-8">
      <section>
        <div
          className="text-[10.5px] uppercase tracking-[0.28em] font-semibold mb-3"
          style={{ color: tokens.mutedText }}
        >
          About the property
        </div>
        <div
          className="text-[14px] leading-[1.8] whitespace-pre-line outline-none"
          style={{ color: tokens.bodyText }}
          contentEditable={isEditor}
          suppressContentEditableWarning
          onBlur={(e) =>
            updateProperty(property.id, { description: e.currentTarget.textContent ?? "" })
          }
        >
          {property.description ||
            (isEditor ? "Describe the property — setting, character, service, style…" : "")}
        </div>
      </section>

      {/* Why-we-chose-this used to live here as its own section. It's
          now promoted to a magazine-style standfirst above the property
          block (see PropertyBlock — the italic display-serif quote
          flanked by hairline ornaments). One source of truth, edited
          either there or here — but only rendered once. The amenity
          block stays inside the INFORMATION tab. */}

      {((property.amenities ?? []).length > 0 || isEditor) && (
        <section>
          <div
            className="text-[10.5px] uppercase tracking-[0.28em] font-semibold mb-3"
            style={{ color: tokens.mutedText }}
          >
            Amenities
          </div>
          <div
            className="text-[13.5px] leading-[1.7] outline-none"
            style={{ color: tokens.bodyText }}
            contentEditable={isEditor}
            suppressContentEditableWarning
            onBlur={(e) =>
              updateProperty(property.id, {
                amenities: (e.currentTarget.textContent ?? "")
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
          >
            {(property.amenities ?? []).length > 0
              ? (property.amenities ?? []).join(", ")
              : isEditor
                ? "Comma-separated list — e.g. Pool, Spa, Private verandah, Kids club"
                : ""}
          </div>
        </section>
      )}
    </div>
  );
}

// ─── Shared sidebar bits ──────────────────────────────────────────────────

function FactBlock({
  label,
  tokens,
  children,
}: {
  label: string;
  tokens: ThemeTokens;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-8">
      <div
        className="text-[14px] font-semibold mb-3"
        style={{ color: tokens.headingText }}
      >
        {label}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function FactRow({
  label,
  value,
  tokens,
  isEditor,
  onChange,
}: {
  label: string;
  value: string;
  tokens: ThemeTokens;
  isEditor?: boolean;
  onChange?: (next: string) => void;
}) {
  const editable = Boolean(isEditor && onChange);
  // Slightly bigger row + extra leading so the data column carries
  // visual weight that matches the taller right-column gallery. Was
  // 12.5px tight rows; now 13px with 1.6 leading.
  return (
    <div className="grid grid-cols-[auto_1fr] gap-3 text-[13px] leading-[1.6]">
      <div className="tabular-nums" style={{ color: tokens.mutedText }}>
        {label}
      </div>
      <div
        className="min-w-0 outline-none"
        style={{ color: editable ? tokens.headingText : tokens.bodyText }}
        contentEditable={editable}
        suppressContentEditableWarning
        onBlur={editable ? (e) => onChange!(e.currentTarget.textContent?.trim() ?? "") : undefined}
      >
        {value || "—"}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Build a "Days 1-2" label from the days that use this property at the
 *  active tier. Collapses consecutive day numbers into ranges. */
function computeDaysLabel(
  property: Property,
  proposal: Proposal,
  activeTier: TierKey,
): string {
  const lcName = property.name.trim().toLowerCase();
  const nums = proposal.days
    .filter((d) => d.tiers?.[activeTier]?.camp?.trim().toLowerCase() === lcName)
    .map((d) => d.dayNumber)
    .sort((a, b) => a - b);
  if (nums.length === 0) return "";
  const ranges: string[] = [];
  let start = nums[0];
  let prev = nums[0];
  for (let i = 1; i < nums.length; i++) {
    if (nums[i] === prev + 1) {
      prev = nums[i];
      continue;
    }
    ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
    start = nums[i];
    prev = nums[i];
  }
  ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
  return `Days ${ranges.join(", ")}`;
}

function countNightsFor(
  property: Property,
  proposal: Proposal,
  activeTier: TierKey,
): number {
  const lcName = property.name.trim().toLowerCase();
  return proposal.days.filter(
    (d) => d.tiers?.[activeTier]?.camp?.trim().toLowerCase() === lcName,
  ).length;
}
