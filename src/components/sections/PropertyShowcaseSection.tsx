"use client";

import { useState } from "react";
import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import { resolveTokens } from "@/lib/theme";
import { uploadImage } from "@/lib/uploadImage";
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
  const { theme, properties } = proposal;
  const tokens = resolveTokens(theme.tokens, section.styleOverrides);

  if (properties.length === 0) {
    return (
      <div className="py-24" style={{ background: tokens.sectionSurface }}>
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
      className="py-20"
      style={{
        background: tokens.sectionSurface,
        borderTop: isFirst ? "none" : `1px solid ${tokens.border}`,
      }}
    >
      <div className="max-w-6xl mx-auto px-8 md:px-12">
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
  property,
  isEditor,
  tokens,
}: {
  imageUrl: string | null;
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

  return (
    <div>
      <div
        className="relative overflow-hidden w-full"
        style={{
          background: tokens.cardBg,
          aspectRatio: "16 / 10",
          borderRadius: 4,
        }}
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={property.name} className="absolute inset-0 w-full h-full object-cover" />
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

      {(property.whyWeChoseThis || isEditor) && (
        <section>
          <div
            className="text-[10.5px] uppercase tracking-[0.28em] font-semibold mb-3"
            style={{ color: tokens.mutedText }}
          >
            Why we chose it
          </div>
          <div
            className="text-[14px] leading-[1.8] whitespace-pre-line outline-none"
            style={{ color: tokens.bodyText }}
            contentEditable={isEditor}
            suppressContentEditableWarning
            onBlur={(e) =>
              updateProperty(property.id, { whyWeChoseThis: e.currentTarget.textContent ?? "" })
            }
          >
            {property.whyWeChoseThis || (isEditor ? "Why this specific lodge for these guests?" : "")}
          </div>
        </section>
      )}

      {(property.amenities.length > 0 || isEditor) && (
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
            {property.amenities.length > 0
              ? property.amenities.join(", ")
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
  return (
    <div className="grid grid-cols-[auto_1fr] gap-3 text-[12.5px]">
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
