"use client";

import { useState } from "react";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import { resolveTokens } from "@/lib/theme";
import { fileToOptimizedDataUrl } from "@/lib/fileToDataUrl";
import { LibraryPicker } from "@/components/properties/LibraryPicker";
import type { Property, Section, ThemeTokens, ProposalTheme } from "@/lib/types";

// ── Property card ──────────────────────────────────────────────────────────────

function PropertyCard({ property, variant, index = 0 }: { property: Property; variant: string; index?: number }) {
  const { proposal, updateProperty, removeProperty } = useProposalStore();
  const { mode, selectProperty, selectedPropertyId } = useEditorStore();
  const isEditor = mode === "editor";
  const { theme } = proposal;
  const tokens = theme.tokens;
  const isSelected = selectedPropertyId === property.id;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: property.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: [transition, "box-shadow 200ms ease"].filter(Boolean).join(", "),
    opacity: isDragging ? 0.4 : 1,
    boxShadow: isSelected
      ? "0 0 0 2px rgba(27,58,45,0.28), 0 4px 16px rgba(27,58,45,0.08)"
      : undefined,
  };

  const handleLeadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToOptimizedDataUrl(file);
      updateProperty(property.id, { leadImageUrl: dataUrl });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Image upload failed");
    }
  };

  const isEditorial = variant === "editorial";
  const isFullBleed = variant === "full-bleed";
  const isFieldNotes = variant === "field-notes";
  // Editorial / full-bleed / field-notes are flush with the page — no harsh
  // card border / rounded corners. Other variants keep the framed card.
  const flush = isEditorial || isFullBleed || isFieldNotes;
  const wrapperClass = flush
    ? "dm-card relative transition-colors duration-150"
    : "dm-card relative rounded-2xl overflow-hidden border transition-colors duration-150";

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, borderColor: flush ? "transparent" : tokens.border }}
      onClick={() => isEditor && selectProperty(property.id)}
      className={wrapperClass}
    >
      {/* Editor controls */}
      {isEditor && (
        <div className="absolute top-3 right-3 z-20 flex gap-1" onClick={(e) => e.stopPropagation()}>
          <button {...attributes} {...listeners}
            className="w-7 h-7 rounded-md bg-black/40 text-white/70 text-xs flex items-center justify-center cursor-grab hover:bg-black/60 transition" title="Drag">⠿</button>
          <button onClick={() => removeProperty(property.id)}
            className="w-7 h-7 rounded-md bg-black/40 text-white/70 text-xs flex items-center justify-center hover:bg-red-500/80 transition" title="Remove">×</button>
        </div>
      )}

      {variant === "editorial" ? (
        <EditorialLayout property={property} index={index} isEditor={isEditor} tokens={tokens} theme={theme} updateProperty={updateProperty} handleLeadImage={handleLeadImage} />
      ) : variant === "large-image-detail-block" ? (
        <LargeImageLayout property={property} isEditor={isEditor} tokens={tokens} theme={theme} updateProperty={updateProperty} handleLeadImage={handleLeadImage} />
      ) : variant === "hero-thumbnails" ? (
        <HeroThumbnailsLayout property={property} isEditor={isEditor} tokens={tokens} theme={theme} updateProperty={updateProperty} handleLeadImage={handleLeadImage} />
      ) : variant === "card-grid" ? (
        <CardGridLayout property={property} isEditor={isEditor} tokens={tokens} theme={theme} updateProperty={updateProperty} handleLeadImage={handleLeadImage} />
      ) : variant === "full-bleed" ? (
        <FullBleedLayout property={property} isEditor={isEditor} tokens={tokens} theme={theme} updateProperty={updateProperty} handleLeadImage={handleLeadImage} />
      ) : variant === "field-notes" ? (
        <FieldNotesLayout property={property} index={index} isEditor={isEditor} tokens={tokens} theme={theme} updateProperty={updateProperty} handleLeadImage={handleLeadImage} />
      ) : (
        <SplitImageLayout property={property} isEditor={isEditor} tokens={tokens} theme={theme} updateProperty={updateProperty} handleLeadImage={handleLeadImage} />
      )}
    </div>
  );
}

// ── Large image layout: cinematic full-width image with text overlay ──────────

function LargeImageLayout({ property, isEditor, tokens, theme, updateProperty, handleLeadImage }: {
  property: Property; isEditor: boolean; tokens: ThemeTokens; theme: ProposalTheme;
  updateProperty: (id: string, patch: Partial<Property>) => void;
  handleLeadImage: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div style={{ background: tokens.sectionSurface }}>
      {/* Cinematic image with overlaid property name */}
      <div className="relative w-full h-[340px] overflow-hidden">
        {property.leadImageUrl ? (
          <>
            <img src={property.leadImageUrl} alt={property.name} className="w-full h-full object-cover" />
            {/* Gradient overlay for text legibility */}
            <div className="absolute inset-0" style={{
              background: "linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.1) 50%, transparent 100%)",
            }} />
            {/* Property name over image */}
            <div className="absolute bottom-0 left-0 right-0 p-6">
              <h3
                className="text-[1.8rem] font-bold text-white leading-tight outline-none"
                style={{ fontFamily: `'${theme.displayFont}', serif`, textShadow: "0 2px 8px rgba(0,0,0,0.4)" }}
                contentEditable={isEditor}
                suppressContentEditableWarning
                onBlur={(e) => updateProperty(property.id, { name: e.currentTarget.textContent ?? property.name })}
              >
                {property.name}
              </h3>
              <div
                className="text-white/70 text-sm mt-0.5 outline-none"
                contentEditable={isEditor}
                suppressContentEditableWarning
                onBlur={(e) => updateProperty(property.id, { location: e.currentTarget.textContent ?? property.location })}
              >
                {property.location}
              </div>
            </div>
            {isEditor && (
              <label className="absolute top-3 left-3 cursor-pointer bg-black/45 text-white text-[10px] px-2.5 py-1 rounded-md hover:bg-black/65 transition backdrop-blur-sm">
                <input type="file" accept="image/*" className="hidden" onChange={handleLeadImage} />
                Change
              </label>
            )}
          </>
        ) : isEditor ? (
          <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer hover:bg-black/5 transition dm-image"
            style={{ background: tokens.cardBg }}>
            <input type="file" accept="image/*" className="hidden" onChange={handleLeadImage} />
            <div className="text-3xl opacity-30 mb-1">+</div>
            <div className="text-sm opacity-40">Add photo</div>
          </label>
        ) : (
          <div className="w-full h-full" style={{ background: tokens.cardBg }} />
        )}
      </div>

      {/* Details below */}
      <div className="p-8 md:p-10">
        {/* Name (shown when no image — duplicate hidden when image overlays it) */}
        {!property.leadImageUrl && (
          <div className="mb-5">
            <h3
              className="text-2xl font-bold outline-none"
              style={{ color: tokens.headingText, fontFamily: `'${theme.displayFont}', serif` }}
              contentEditable={isEditor}
              suppressContentEditableWarning
              onBlur={(e) => updateProperty(property.id, { name: e.currentTarget.textContent ?? property.name })}
            >
              {property.name}
            </h3>
            <div
              className="text-sm mt-0.5 outline-none"
              style={{ color: tokens.mutedText }}
              contentEditable={isEditor}
              suppressContentEditableWarning
              onBlur={(e) => updateProperty(property.id, { location: e.currentTarget.textContent ?? property.location })}
            >
              {property.location}
            </div>
          </div>
        )}
        <PropertyDetails property={property} isEditor={isEditor} tokens={tokens} theme={theme} updateProperty={updateProperty} showHeader={!!property.leadImageUrl} />
      </div>
    </div>
  );
}

// ── Split layout: image left (40%), details right (60%) ───────────────────────

function SplitImageLayout({ property, isEditor, tokens, theme, updateProperty, handleLeadImage }: {
  property: Property; isEditor: boolean; tokens: ThemeTokens; theme: ProposalTheme;
  updateProperty: (id: string, patch: Partial<Property>) => void;
  handleLeadImage: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="grid md:grid-cols-[42%_58%]" style={{ background: tokens.sectionSurface }}>
      {/* Image */}
      <div className="relative min-h-[300px] overflow-hidden" style={{ background: tokens.cardBg }}>
        {property.leadImageUrl ? (
          <>
            <img src={property.leadImageUrl} alt={property.name} className="w-full h-full object-cover absolute inset-0" />
            {/* Bottom gradient */}
            <div className="absolute inset-x-0 bottom-0 h-24" style={{
              background: "linear-gradient(to top, rgba(0,0,0,0.35), transparent)"
            }} />
            {isEditor && (
              <label className="absolute bottom-3 left-3 cursor-pointer bg-black/45 text-white text-[10px] px-2.5 py-1 rounded-md hover:bg-black/65 transition backdrop-blur-sm">
                <input type="file" accept="image/*" className="hidden" onChange={handleLeadImage} />
                Change
              </label>
            )}
          </>
        ) : isEditor ? (
          <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer hover:bg-black/5 transition dm-image">
            <input type="file" accept="image/*" className="hidden" onChange={handleLeadImage} />
            <div className="text-3xl opacity-30 mb-1">+</div>
            <div className="text-sm opacity-40">Add photo</div>
          </label>
        ) : null}
      </div>

      {/* Details */}
      <div className="p-8 md:p-10" style={{ background: tokens.sectionSurface }}>
        <div className="mb-4">
          <h3
            className="text-[1.6rem] font-bold leading-tight outline-none"
            style={{ color: tokens.headingText, fontFamily: `'${theme.displayFont}', serif` }}
            contentEditable={isEditor}
            suppressContentEditableWarning
            onBlur={(e) => updateProperty(property.id, { name: e.currentTarget.textContent ?? property.name })}
          >
            {property.name}
          </h3>
          <div
            className="text-sm mt-0.5 outline-none"
            style={{ color: tokens.mutedText }}
            contentEditable={isEditor}
            suppressContentEditableWarning
            onBlur={(e) => updateProperty(property.id, { location: e.currentTarget.textContent ?? property.location })}
          >
            {property.location}
          </div>
        </div>
        <PropertyDetails property={property} isEditor={isEditor} tokens={tokens} theme={theme} updateProperty={updateProperty} showHeader={false} />
      </div>
    </div>
  );
}

// ── Hero + thumbnails: large lead image with gallery strip ──────────────────────

function HeroThumbnailsLayout({ property, isEditor, tokens, theme, updateProperty, handleLeadImage }: {
  property: Property; isEditor: boolean; tokens: ThemeTokens; theme: ProposalTheme;
  updateProperty: (id: string, patch: Partial<Property>) => void;
  handleLeadImage: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const galleryUrls = property.galleryUrls ?? [];

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    try {
      const urls = await Promise.all(files.map((f) => fileToOptimizedDataUrl(f)));
      updateProperty(property.id, { galleryUrls: [...galleryUrls, ...urls] });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gallery upload failed");
    }
  };

  const removeGalleryImage = (idx: number) => {
    updateProperty(property.id, { galleryUrls: galleryUrls.filter((_, i) => i !== idx) });
  };

  const setAsLead = (url: string) => {
    updateProperty(property.id, { leadImageUrl: url });
  };

  return (
    <div style={{ background: tokens.sectionSurface }}>
      {/* Hero image */}
      <div className="relative w-full h-[380px] overflow-hidden">
        {property.leadImageUrl ? (
          <>
            <img src={property.leadImageUrl} alt={property.name} className="w-full h-full object-cover" />
            <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.05) 50%, transparent 100%)" }} />
            <div className="absolute bottom-0 left-0 right-0 p-8">
              <h3 className="text-[1.8rem] font-bold text-white leading-tight outline-none"
                style={{ fontFamily: `'${theme.displayFont}', serif`, textShadow: "0 2px 8px rgba(0,0,0,0.4)" }}
                contentEditable={isEditor} suppressContentEditableWarning
                onBlur={(e) => updateProperty(property.id, { name: e.currentTarget.textContent ?? property.name })}>
                {property.name}
              </h3>
              <div className="text-white/70 text-sm mt-0.5">{property.location}</div>
            </div>
            {isEditor && (
              <label className="absolute top-3 left-3 cursor-pointer bg-black/45 text-white text-[10px] px-2.5 py-1 rounded-md hover:bg-black/65 transition backdrop-blur-sm">
                <input type="file" accept="image/*" className="hidden" onChange={handleLeadImage} />
                Change
              </label>
            )}
          </>
        ) : isEditor ? (
          <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer dm-image" style={{ background: tokens.cardBg }}>
            <input type="file" accept="image/*" className="hidden" onChange={handleLeadImage} />
            <div className="text-3xl opacity-30 mb-1">+</div>
            <div className="text-sm opacity-40">Add lead photo</div>
          </label>
        ) : (
          <div className="w-full h-full" style={{ background: tokens.cardBg }} />
        )}
      </div>

      {/* Thumbnail strip */}
      {(galleryUrls.length > 0 || isEditor) && (
        <div className="flex gap-1.5 px-4 py-3 overflow-x-auto" style={{ background: tokens.cardBg }}>
          {galleryUrls.map((url, i) => (
            <div key={i} className="relative shrink-0 w-[80px] h-[60px] rounded-lg overflow-hidden group cursor-pointer"
              onClick={() => !isEditor && setAsLead(url)}>
              <img src={url} alt="" className="w-full h-full object-cover" />
              {isEditor && (
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1 transition">
                  <button onClick={(e) => { e.stopPropagation(); setAsLead(url); }}
                    className="text-white text-[8px] bg-white/20 px-1.5 py-0.5 rounded" title="Set as main">★</button>
                  <button onClick={(e) => { e.stopPropagation(); removeGalleryImage(i); }}
                    className="text-white text-[8px] bg-white/20 px-1.5 py-0.5 rounded" title="Remove">×</button>
                </div>
              )}
            </div>
          ))}
          {isEditor && (
            <label className="shrink-0 w-[80px] h-[60px] rounded-lg border-2 border-dashed flex items-center justify-center cursor-pointer hover:bg-black/3 transition"
              style={{ borderColor: tokens.border }}>
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleGalleryUpload} />
              <span className="text-lg opacity-30">+</span>
            </label>
          )}
        </div>
      )}

      {/* Details */}
      <div className="p-8 md:p-10">
        {!property.leadImageUrl && (
          <div className="mb-5">
            <h3 className="text-2xl font-bold outline-none" style={{ color: tokens.headingText, fontFamily: `'${theme.displayFont}', serif` }}
              contentEditable={isEditor} suppressContentEditableWarning
              onBlur={(e) => updateProperty(property.id, { name: e.currentTarget.textContent ?? property.name })}>
              {property.name}
            </h3>
          </div>
        )}
        <PropertyDetails property={property} isEditor={isEditor} tokens={tokens} theme={theme} updateProperty={updateProperty} showHeader={!!property.leadImageUrl} />
      </div>
    </div>
  );
}

// ── Card grid: compact vertical card ────────────────────────────────────────────

function CardGridLayout({ property, isEditor, tokens, theme, updateProperty, handleLeadImage }: {
  property: Property; isEditor: boolean; tokens: ThemeTokens; theme: ProposalTheme;
  updateProperty: (id: string, patch: Partial<Property>) => void;
  handleLeadImage: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div style={{ background: tokens.sectionSurface }}>
      <div className="relative h-[220px] overflow-hidden" style={{ background: tokens.cardBg }}>
        {property.leadImageUrl ? (
          <>
            <img src={property.leadImageUrl} alt={property.name} className="w-full h-full object-cover" />
            {isEditor && (
              <label className="absolute bottom-3 left-3 cursor-pointer bg-black/45 text-white text-[10px] px-2.5 py-1 rounded-md hover:bg-black/65 transition backdrop-blur-sm">
                <input type="file" accept="image/*" className="hidden" onChange={handleLeadImage} />
                Change
              </label>
            )}
          </>
        ) : isEditor ? (
          <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer dm-image">
            <input type="file" accept="image/*" className="hidden" onChange={handleLeadImage} />
            <div className="text-2xl opacity-30">+</div>
          </label>
        ) : null}
      </div>
      <div className="p-6">
        <h3
          className="text-lg font-bold leading-tight outline-none mb-1"
          style={{ color: tokens.headingText, fontFamily: `'${theme.displayFont}', serif` }}
          contentEditable={isEditor}
          suppressContentEditableWarning
          onBlur={(e) => updateProperty(property.id, { name: e.currentTarget.textContent ?? property.name })}
        >
          {property.name}
        </h3>
        <div className="text-[11px] mb-3" style={{ color: tokens.mutedText }}>{property.location}</div>
        <p
          className="text-[12.5px] leading-[1.8] outline-none"
          style={{ color: tokens.bodyText, fontFamily: `'${theme.bodyFont}', sans-serif` }}
          contentEditable={isEditor}
          suppressContentEditableWarning
          onBlur={(e) => updateProperty(property.id, { shortDesc: e.currentTarget.textContent ?? property.shortDesc })}
        >
          {property.shortDesc || property.description}
        </p>
        <div className="flex gap-4 mt-4 text-[10px]" style={{ color: tokens.mutedText }}>
          {property.nights && <span>{property.nights} nights</span>}
          {property.mealPlan && <span>{property.mealPlan}</span>}
        </div>
      </div>
    </div>
  );
}

// ── Full-bleed: edge-to-edge image with floating text card ──────────────────

function FullBleedLayout({ property, isEditor, tokens, theme, updateProperty, handleLeadImage }: {
  property: Property; isEditor: boolean; tokens: ThemeTokens; theme: ProposalTheme;
  updateProperty: (id: string, patch: Partial<Property>) => void;
  handleLeadImage: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="relative" style={{ background: tokens.cardBg }}>
      <div className="relative h-[400px] overflow-hidden">
        {property.leadImageUrl ? (
          <img src={property.leadImageUrl} alt={property.name} className="w-full h-full object-cover" />
        ) : isEditor ? (
          <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer dm-image">
            <input type="file" accept="image/*" className="hidden" onChange={handleLeadImage} />
            <div className="text-3xl opacity-30 mb-1">+</div>
            <div className="text-sm opacity-40">Add photo</div>
          </label>
        ) : null}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 60%)" }} />
        {property.leadImageUrl && isEditor && (
          <label className="absolute top-3 left-3 cursor-pointer bg-black/45 text-white text-[10px] px-2.5 py-1 rounded-md hover:bg-black/65 transition backdrop-blur-sm">
            <input type="file" accept="image/*" className="hidden" onChange={handleLeadImage} />
            Change
          </label>
        )}
      </div>
      {/* Floating card overlapping image */}
      <div
        className="relative -mt-20 mx-6 md:mx-10 p-8 rounded-xl"
        style={{ background: tokens.sectionSurface, boxShadow: "0 8px 32px rgba(0,0,0,0.12)" }}
      >
        <h3
          className="text-[1.5rem] font-bold leading-tight outline-none mb-1"
          style={{ color: tokens.headingText, fontFamily: `'${theme.displayFont}', serif` }}
          contentEditable={isEditor}
          suppressContentEditableWarning
          onBlur={(e) => updateProperty(property.id, { name: e.currentTarget.textContent ?? property.name })}
        >
          {property.name}
        </h3>
        <div className="text-sm mb-4" style={{ color: tokens.mutedText }}>{property.location}</div>
        <PropertyDetails property={property} isEditor={isEditor} tokens={tokens} theme={theme} updateProperty={updateProperty} showHeader={false} />
      </div>
      <div className="h-6" />
    </div>
  );
}

// ── Shared details block ───────────────────────────────────────────────────────

// ── Editorial alternating layout — image side flips per property index ──────
//
// The default since this commit: a luxury-brochure feel. No card border,
// no rounded frame on the wrapper — just a tall image (4:5 aspect) on
// one side and a generous typography column on the other, alternating
// position by index so the spread breathes.

function EditorialLayout({
  property,
  index,
  isEditor,
  tokens,
  theme,
  updateProperty,
  handleLeadImage,
}: {
  property: Property;
  index: number;
  isEditor: boolean;
  tokens: ThemeTokens;
  theme: ProposalTheme;
  updateProperty: (id: string, patch: Partial<Property>) => void;
  handleLeadImage: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const imageRight = index % 2 === 1;
  return (
    <div
      className={`grid md:grid-cols-2 gap-10 md:gap-14 items-center ${
        imageRight ? "md:[&>*:first-child]:order-2" : ""
      }`}
    >
      {/* Image */}
      <div
        className="relative aspect-[4/5] md:aspect-[5/6] overflow-hidden rounded-sm"
        style={{ background: tokens.cardBg }}
      >
        {property.leadImageUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={property.leadImageUrl}
              alt={property.name}
              className="absolute inset-0 w-full h-full object-cover"
            />
            {isEditor && (
              <label className="absolute bottom-3 left-3 cursor-pointer bg-black/45 text-white text-[10px] px-2.5 py-1 rounded-md hover:bg-black/65 transition backdrop-blur-sm">
                <input type="file" accept="image/*" className="hidden" onChange={handleLeadImage} />
                Change
              </label>
            )}
          </>
        ) : isEditor ? (
          <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer hover:bg-black/5 transition dm-image">
            <input type="file" accept="image/*" className="hidden" onChange={handleLeadImage} />
            <div className="text-3xl opacity-30 mb-1">+</div>
            <div className="text-sm opacity-40">Add photo</div>
          </label>
        ) : null}
      </div>

      {/* Detail column — strict editorial type scale, generous rhythm */}
      <div className="px-2 md:px-0">
        <div
          className="text-label ed-label mb-4"
          style={{ color: tokens.mutedText }}
        >
          {property.location || "The stay"}
        </div>
        <h3
          className="text-display font-bold tracking-tight outline-none"
          style={{
            color: tokens.headingText,
            fontFamily: `'${theme.displayFont}', serif`,
            // Drop a notch on small screens so the display size doesn't
            // overflow narrow viewports.
            fontSize: "clamp(2.5rem, 6vw, 4rem)",
            lineHeight: 1.05,
          }}
          contentEditable={isEditor}
          suppressContentEditableWarning
          onBlur={(e) => updateProperty(property.id, { name: e.currentTarget.textContent ?? property.name })}
        >
          {property.name}
        </h3>
        {property.shortDesc && (
          <p
            className="text-body-lg italic mt-4 outline-none"
            style={{ color: tokens.mutedText, fontFamily: `'${theme.displayFont}', serif` }}
            contentEditable={isEditor}
            suppressContentEditableWarning
            onBlur={(e) => updateProperty(property.id, { shortDesc: e.currentTarget.textContent ?? property.shortDesc })}
          >
            {property.shortDesc}
          </p>
        )}

        {property.description && (
          <p
            className="text-body mt-8 outline-none"
            style={{ color: tokens.bodyText, fontFamily: `'${theme.bodyFont}', sans-serif` }}
            contentEditable={isEditor}
            suppressContentEditableWarning
            onBlur={(e) => updateProperty(property.id, { description: e.currentTarget.textContent ?? property.description })}
          >
            {property.description}
          </p>
        )}

        {property.whyWeChoseThis && (
          <div className="mt-8 pl-6 border-l-2" style={{ borderColor: tokens.accent }}>
            <div
              className="text-label ed-label mb-2"
              style={{ color: tokens.accent }}
            >
              Why we chose this
            </div>
            <p
              className="text-body-lg italic outline-none"
              style={{ color: tokens.bodyText, fontFamily: `'${theme.displayFont}', serif` }}
              contentEditable={isEditor}
              suppressContentEditableWarning
              onBlur={(e) => updateProperty(property.id, { whyWeChoseThis: e.currentTarget.textContent ?? property.whyWeChoseThis })}
            >
              {property.whyWeChoseThis}
            </p>
          </div>
        )}

        {(property.mealPlan || property.roomType || property.nights) && (
          <div
            className="mt-8 pt-6 flex flex-wrap gap-x-12 gap-y-4 border-t"
            style={{ borderColor: tokens.border }}
          >
            {[
              { label: "Meal plan", value: property.mealPlan },
              { label: "Room", value: property.roomType },
              { label: "Nights", value: property.nights ? `${property.nights} nights` : undefined },
            ].map((item) =>
              item.value ? (
                <div key={item.label}>
                  <div className="text-label ed-label mb-1" style={{ color: tokens.mutedText }}>
                    {item.label}
                  </div>
                  <div className="text-small font-semibold" style={{ color: tokens.headingText }}>
                    {item.value}
                  </div>
                </div>
              ) : null,
            )}
          </div>
        )}

        {property.amenities.length > 0 && (
          <div className="mt-8">
            <div className="text-label ed-label mb-3" style={{ color: tokens.mutedText }}>
              Amenities
            </div>
            <div className="flex flex-wrap gap-2">
              {property.amenities.map((a) => (
                <span
                  key={a}
                  className="px-3 py-1 rounded-full text-label"
                  style={{
                    background: tokens.cardBg,
                    color: tokens.bodyText,
                    border: `1px solid ${tokens.border}`,
                    textTransform: "none",
                    letterSpacing: "0",
                    fontWeight: 400,
                  }}
                >
                  {a}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Field Notes: Magnum / Wallpaper-style. Hero image, then a two-column body
//    (description + the "why we chose this" + amenities). Gallery strip below.
//    Everything visible at once — no progressive disclosure.

function FieldNotesLayout({ property, index = 0, isEditor, tokens, theme, updateProperty, handleLeadImage }: {
  property: Property;
  index?: number;
  isEditor: boolean;
  tokens: ThemeTokens;
  theme: ProposalTheme;
  updateProperty: (id: string, patch: Partial<Property>) => void;
  handleLeadImage: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const gallery = (property.galleryUrls ?? []).filter(Boolean);
  return (
    <div style={{ background: tokens.sectionSurface }}>
      {/* Header strip — folio number + name + location */}
      <div className="px-8 md:px-12 pt-12 pb-6 flex items-end justify-between gap-6 flex-wrap">
        <div className="flex items-end gap-5 min-w-0">
          <div
            className="text-[10px] uppercase tracking-[0.32em] pb-2"
            style={{ color: tokens.accent, fontFamily: `'${theme.bodyFont}', sans-serif` }}
          >
            Property No. {String(index + 1).padStart(2, "0")}
          </div>
        </div>
        {property.tier && (
          <div
            className="text-[10px] uppercase tracking-[0.28em] pb-2"
            style={{ color: tokens.mutedText, fontFamily: `'${theme.bodyFont}', sans-serif` }}
          >
            {property.tier}
          </div>
        )}
      </div>

      <div className="px-8 md:px-12 pb-2">
        <h3
          className="font-bold leading-[1.0] tracking-tight outline-none"
          style={{
            color: tokens.headingText,
            fontFamily: `'${theme.displayFont}', serif`,
            fontSize: "clamp(2rem, 4.4vw, 3rem)",
          }}
          contentEditable={isEditor}
          suppressContentEditableWarning
          onBlur={(e) => updateProperty(property.id, { name: e.currentTarget.textContent ?? property.name })}
        >
          {property.name}
        </h3>
        <div
          className="mt-2 text-[14px] outline-none"
          style={{ color: tokens.mutedText, fontFamily: `'${theme.bodyFont}', sans-serif` }}
          contentEditable={isEditor}
          suppressContentEditableWarning
          onBlur={(e) => updateProperty(property.id, { location: e.currentTarget.textContent ?? property.location })}
        >
          {property.location}
        </div>
        {property.shortDesc && (
          <div
            className="mt-3 text-[15px] italic outline-none max-w-[640px]"
            style={{ color: tokens.bodyText, fontFamily: `'${theme.displayFont}', serif` }}
            contentEditable={isEditor}
            suppressContentEditableWarning
            onBlur={(e) => updateProperty(property.id, { shortDesc: e.currentTarget.textContent ?? property.shortDesc })}
          >
            {property.shortDesc}
          </div>
        )}
      </div>

      {/* Hero image */}
      <div className="relative w-full overflow-hidden mt-8" style={{ background: tokens.cardBg, aspectRatio: "16 / 9" }}>
        {property.leadImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={property.leadImageUrl} alt={property.name} className="w-full h-full object-cover" />
        ) : isEditor ? (
          <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer hover:bg-black/5 transition dm-image">
            <input type="file" accept="image/*" className="hidden" onChange={handleLeadImage} />
            <div className="text-3xl opacity-30 mb-1">+</div>
            <div className="text-sm opacity-40">Add photo</div>
          </label>
        ) : null}
        {property.leadImageUrl && isEditor && (
          <label className="absolute bottom-3 right-3 cursor-pointer bg-black/55 text-white text-[10px] px-2.5 py-1 rounded-md hover:bg-black/75 transition backdrop-blur-sm">
            <input type="file" accept="image/*" className="hidden" onChange={handleLeadImage} />
            Change
          </label>
        )}
      </div>

      {/* Two-column body */}
      <div className="px-8 md:px-12 py-12 grid grid-cols-1 md:grid-cols-[1.6fr_1fr] gap-10 md:gap-14">
        {/* Left — narrative */}
        <div>
          <div
            className="text-[10px] uppercase tracking-[0.28em] mb-4"
            style={{ color: tokens.mutedText, fontFamily: `'${theme.bodyFont}', sans-serif` }}
          >
            About
          </div>
          <p
            className="text-[15px] leading-[1.85] outline-none"
            style={{ color: tokens.bodyText, fontFamily: `'${theme.bodyFont}', sans-serif` }}
            contentEditable={isEditor}
            suppressContentEditableWarning
            onBlur={(e) => updateProperty(property.id, { description: e.currentTarget.textContent ?? property.description })}
          >
            {property.description || "Describe this property…"}
          </p>

          {property.whyWeChoseThis && (
            <div className="mt-8 pl-5" style={{ borderLeft: `2px solid ${tokens.accent}` }}>
              <div
                className="text-[10px] uppercase tracking-[0.28em] mb-2"
                style={{ color: tokens.accent, fontFamily: `'${theme.bodyFont}', sans-serif` }}
              >
                Why we chose this
              </div>
              <p
                className="text-[14.5px] italic leading-[1.7] outline-none"
                style={{ color: tokens.bodyText, fontFamily: `'${theme.displayFont}', serif` }}
                contentEditable={isEditor}
                suppressContentEditableWarning
                onBlur={(e) => updateProperty(property.id, { whyWeChoseThis: e.currentTarget.textContent ?? property.whyWeChoseThis })}
              >
                {property.whyWeChoseThis}
              </p>
            </div>
          )}
        </div>

        {/* Right — fact sheet */}
        <aside style={{ fontFamily: `'${theme.bodyFont}', sans-serif` }}>
          <div
            className="text-[10px] uppercase tracking-[0.28em] mb-4"
            style={{ color: tokens.mutedText }}
          >
            At a glance
          </div>
          <dl className="space-y-3.5">
            {[
              { label: "Meal plan", value: property.mealPlan },
              { label: "Room type", value: property.roomType },
              { label: "Stay", value: property.nights ? `${property.nights} night${property.nights === 1 ? "" : "s"}` : undefined },
            ]
              .filter((row) => row.value)
              .map((row) => (
                <div key={row.label} className="flex justify-between gap-3 pb-3" style={{ borderBottom: `1px solid ${tokens.border}` }}>
                  <dt className="text-[12px]" style={{ color: tokens.mutedText }}>{row.label}</dt>
                  <dd className="text-[13px] font-semibold text-right" style={{ color: tokens.headingText }}>{row.value}</dd>
                </div>
              ))}
          </dl>

          {property.amenities.length > 0 && (
            <div className="mt-6">
              <div
                className="text-[10px] uppercase tracking-[0.28em] mb-3"
                style={{ color: tokens.mutedText }}
              >
                Amenities
              </div>
              <div className="flex flex-wrap gap-1.5">
                {property.amenities.map((a, i) => (
                  <span
                    key={i}
                    className="text-[11.5px] px-2.5 py-1 rounded-full"
                    style={{
                      color: tokens.bodyText,
                      background: tokens.cardBg,
                      border: `1px solid ${tokens.border}`,
                    }}
                  >
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* Gallery strip */}
      {gallery.length > 0 && (
        <div className="px-8 md:px-12 pb-12">
          <div
            className="text-[10px] uppercase tracking-[0.28em] mb-4"
            style={{ color: tokens.mutedText, fontFamily: `'${theme.bodyFont}', sans-serif` }}
          >
            Plates
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {gallery.slice(0, 8).map((url, i) => (
              <div
                key={i}
                className="relative overflow-hidden rounded-md"
                style={{ background: tokens.cardBg, aspectRatio: "1 / 1" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`${property.name} ${i + 1}`} className="absolute inset-0 w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PropertyDetails({ property, isEditor, tokens, theme, updateProperty, showHeader }: {
  property: Property;
  isEditor: boolean;
  tokens: ThemeTokens;
  theme: ProposalTheme;
  showHeader: boolean;
  updateProperty: (id: string, patch: Partial<Property>) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Description */}
      <p
        className="text-[13.5px] leading-[2.0] outline-none"
        style={{ color: tokens.bodyText, fontFamily: `'${theme.bodyFont}', sans-serif` }}
        contentEditable={isEditor}
        suppressContentEditableWarning
        onBlur={(e) => updateProperty(property.id, { description: e.currentTarget.textContent ?? property.description })}
      >
        {property.description}
      </p>

      {/* Why we chose this — left border quote treatment */}
      {property.whyWeChoseThis && (
        <div className="pl-4 border-l-2" style={{ borderColor: `${tokens.accent}45` }}>
          <p
            className="text-[13px] leading-[1.85] outline-none italic"
            style={{ color: tokens.bodyText, fontFamily: `'${theme.displayFont}', serif` }}
            contentEditable={isEditor}
            suppressContentEditableWarning
            onBlur={(e) => updateProperty(property.id, { whyWeChoseThis: e.currentTarget.textContent ?? property.whyWeChoseThis })}
          >
            {property.whyWeChoseThis}
          </p>
        </div>
      )}

      {/* Quick stats row */}
      <div className="flex flex-wrap gap-5 pt-1">
        {[
          { label: "Meal plan", value: property.mealPlan },
          { label: "Room type", value: property.roomType },
          { label: "Nights", value: property.nights ? `${property.nights} nights` : undefined },
        ].map((item) => item.value ? (
          <div key={item.label}>
            <div className="text-[9px] uppercase tracking-[0.2em]" style={{ color: tokens.mutedText }}>{item.label}</div>
            <div className="text-[13px] font-semibold mt-0.5" style={{ color: tokens.headingText }}>{item.value}</div>
          </div>
        ) : null)}
      </div>

      {/* Amenities — dot-separated text, no pills */}
      {property.amenities.length > 0 && (
        <div className="pt-3.5 border-t" style={{ borderColor: tokens.border }}>
          <p className="text-[11.5px] leading-relaxed" style={{ color: tokens.mutedText }}>
            {property.amenities.join("  ·  ")}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Section wrapper ───────────────────────────────────────────────────────────

export function PropertyShowcaseSection({ section }: { section: Section }) {
  const { proposal, moveProperty, addProperty, addPropertyFromLibrary } = useProposalStore();
  const { mode } = useEditorStore();
  const isEditor = mode === "editor";
  const { properties, theme } = proposal;
  const tokens = resolveTokens(theme.tokens, section.styleOverrides);
  const [pickerOpen, setPickerOpen] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIdx = properties.findIndex((p) => p.id === active.id);
    const toIdx = properties.findIndex((p) => p.id === over.id);
    if (fromIdx !== -1 && toIdx !== -1) moveProperty(fromIdx, toIdx);
  };

  return (
    <div className="py-24" style={{ background: tokens.pageBg }}>
      <div className="ed-wide">
        {/* Section header */}
        <div className="flex items-end justify-between mb-16">
          <div>
            <div className="text-label ed-label mb-3" style={{ color: tokens.mutedText }}>
              Where you&apos;ll stay
            </div>
            <div
              className="text-h1 font-bold tracking-tight"
              style={{ color: tokens.headingText, fontFamily: `'${theme.displayFont}', serif` }}
            >
              Your properties
            </div>
          </div>
          <div className="text-small pb-1" style={{ color: tokens.mutedText }}>
            {properties.length} {properties.length === 1 ? "property" : "properties"}
          </div>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={properties.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            <div className={section.layoutVariant === "card-grid" ? "grid grid-cols-1 md:grid-cols-2 gap-5" : section.layoutVariant === "editorial" ? "space-y-20 md:space-y-28" : "space-y-6"}>
              {properties.map((property, i) => (
                <div className="relative" key={property.id}>
                  <PropertyCard property={property} variant={section.layoutVariant} index={i} />
                </div>
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {properties.length === 0 && (
          <div className="text-center py-16 rounded-2xl border-2 border-dashed" style={{ borderColor: tokens.border, color: tokens.mutedText }}>
            No properties yet.
          </div>
        )}

        {isEditor && (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => setPickerOpen(true)}
              className="py-4 rounded-2xl text-sm font-semibold transition hover:opacity-90 active:scale-[0.99]"
              style={{ background: tokens.accent, color: tokens.pageBg }}
            >
              ◇ Browse my properties
            </button>
            <button
              onClick={addProperty}
              className="py-4 rounded-2xl border-2 border-dashed text-sm font-medium transition hover:opacity-80"
              style={{ borderColor: tokens.accent, color: tokens.accent }}
            >
              + Add blank property
            </button>
          </div>
        )}
      </div>

      <LibraryPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(snapshots) => {
          for (const snap of snapshots) addPropertyFromLibrary(snap);
        }}
      />
    </div>
  );
}
