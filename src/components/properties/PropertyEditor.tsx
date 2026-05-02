"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppHeader } from "./AppHeader";
import { LocationPicker } from "./LocationPicker";
import { TagInput } from "./TagInput";
import { PhotosSection } from "./PhotosSection";
import { CustomSectionsEditor } from "./CustomSectionsEditor";
import {
  MEAL_PLANS,
  PROPERTY_CLASSES,
  SUITABILITY,
  classLabel,
} from "@/lib/properties";
import {
  EMPTY_FORM,
  type CustomSectionItem,
  type ImageItem,
  type LocationLite,
  type PropertyForm,
  type RoomItem,
  type TagLite,
} from "./types";

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

const SECTIONS = [
  { id: "basics", label: "Basics" },
  { id: "photos", label: "Photos" },
  { id: "story", label: "Story" },
  { id: "amenities", label: "Amenities" },
  { id: "stay", label: "Stay snapshot" },
  { id: "showcase", label: "Showcase facts" },
  { id: "rooms", label: "Rooms" },
  { id: "internal", label: "Internal notes" },
  { id: "custom", label: "Custom sections" },
];

export function PropertyEditor({ propertyId }: { propertyId: string }) {
  const router = useRouter();
  const [form, setForm] = useState<PropertyForm>(EMPTY_FORM);
  const [locations, setLocations] = useState<LocationLite[]>([]);
  const [allTags, setAllTags] = useState<TagLite[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [aiFilling, setAiFilling] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Active anchor for the section nav highlight.
  const [activeSection, setActiveSection] = useState<string>("basics");
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const registerSection = useCallback((id: string, el: HTMLElement | null) => {
    sectionRefs.current[id] = el;
  }, []);

  // ── Load on mount ──────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [propRes, locRes, tagRes] = await Promise.all([
          fetch(`/api/properties/${propertyId}`, { cache: "no-store" }),
          fetch("/api/locations", { cache: "no-store" }),
          fetch("/api/property-tags", { cache: "no-store" }),
        ]);
        if (propRes.status === 401) { window.location.href = "/sign-in?redirect_url=/properties"; return; }
        if (propRes.status === 409) { window.location.href = "/select-organization"; return; }
        if (propRes.status === 404) { setLoadError("Property not found."); return; }
        if (!propRes.ok) throw new Error(`HTTP ${propRes.status}`);

        const [propData, locData, tagData] = await Promise.all([propRes.json(), locRes.json(), tagRes.json()]);
        setLocations(locData.locations ?? []);
        setAllTags(tagData.tags ?? []);
        setForm(hydrateForm(propData.property));
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoaded(true);
      }
    })();
  }, [propertyId]);

  // ── Mutations ──────────────────────────────────────────────────────────
  const update = useCallback((patch: Partial<PropertyForm>) => {
    setForm((prev) => ({ ...prev, ...patch }));
    setSaveState("dirty");
  }, []);

  const updateImages = useCallback((images: ImageItem[]) => {
    setForm((prev) => ({ ...prev, images }));
    setSaveState("dirty");
  }, []);

  const updateCustomSections = useCallback((customSections: CustomSectionItem[]) => {
    setForm((prev) => ({ ...prev, customSections }));
    setSaveState("dirty");
  }, []);

  // ── Debounced auto-save ────────────────────────────────────────────────
  useEffect(() => {
    if (saveState !== "dirty") return;
    const t = setTimeout(async () => {
      setSaveState("saving");
      setSaveError(null);
      try {
        const res = await fetch(`/api/properties/${propertyId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(serialize(form)),
        });
        if (res.status === 409) { window.location.href = "/select-organization"; return; }
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error || `HTTP ${res.status}`);
        }
        setSaveState("saved");
        setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 1800);
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : "Save failed");
        setSaveState("error");
      }
    }, 650);
    return () => clearTimeout(t);
  }, [form, saveState, propertyId]);

  // ── Section nav scroll-spy ─────────────────────────────────────────────
  useEffect(() => {
    if (!loaded) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) setActiveSection(visible.target.id);
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    Object.values(sectionRefs.current).forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [loaded]);

  const scrollToSection = (id: string) => {
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // ── Actions ────────────────────────────────────────────────────────────
  const handleDuplicate = async () => {
    setActionsOpen(false);
    const res = await fetch(`/api/properties/${propertyId}/duplicate`, { method: "POST" });
    if (!res.ok) return;
    const data = await res.json();
    router.push(`/properties/${data.property.id}`);
  };

  const handleDelete = async () => {
    const res = await fetch(`/api/properties/${propertyId}`, { method: "DELETE" });
    if (!res.ok && res.status !== 404) return;
    router.push("/properties");
  };

  const toggleArchived = () => {
    update({ archived: !form.archived });
    setActionsOpen(false);
  };

  // ── AI fill — Generate story + amenities from the property name + location
  //    + class. Only enabled once the user has given us a name to go on; falls
  //    back gracefully if any field comes back empty. Never overwrites text
  //    the user has already written unless they confirm.
  const handleAIFill = async () => {
    if (aiFilling) return;
    const name = form.name?.trim();
    if (!name) {
      setAiError("Add a property name first.");
      return;
    }
    // Warn before overwriting existing text.
    const hasText = [form.shortSummary, form.whatMakesSpecial, form.whyWeChoose].some(
      (s) => s && s.trim().length > 0,
    );
    if (hasText) {
      const ok = window.confirm(
        "This property already has story text. Replace it with AI-generated content? (Amenities will be merged.)",
      );
      if (!ok) return;
    }
    const loc = locations.find((l) => l.id === form.locationId);
    setAiFilling(true);
    setAiError(null);
    try {
      const res = await fetch("/api/ai/property-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyName: name,
          propertyClass: form.propertyClass,
          locationName: loc?.name,
          country: loc?.country,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `HTTP ${res.status}`);
      }
      const { content } = await res.json() as {
        content: {
          shortSummary: string;
          whatMakesSpecial: string;
          whyWeChoose: string;
          amenities: string[];
          suggestedSuitability: string[];
          suggestedNights: number;
        };
      };
      // Merge amenities (case-insensitive dedupe) so the user keeps theirs.
      const existingAm = form.amenities.map((a) => a.toLowerCase());
      const mergedAmenities = [
        ...form.amenities,
        ...content.amenities.filter((a) => !existingAm.includes(a.toLowerCase())),
      ];
      update({
        shortSummary: content.shortSummary || form.shortSummary,
        whatMakesSpecial: content.whatMakesSpecial || form.whatMakesSpecial,
        whyWeChoose: content.whyWeChoose || form.whyWeChoose,
        amenities: mergedAmenities,
        suggestedNights: form.suggestedNights || content.suggestedNights,
        suitability: form.suitability.length
          ? form.suitability
          : content.suggestedSuitability,
      });
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "AI fill failed");
    } finally {
      setAiFilling(false);
      setTimeout(() => setAiError(null), 4000);
    }
  };

  // ─────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f8f5ef] text-[#1a1a1a]">
      <AppHeader
        middleSlot={
          <div className="hidden md:flex items-center gap-2 ml-2">
            <span className="text-black/15">|</span>
            <Link href="/properties" className="text-sm text-black/45 hover:text-black/70 transition">
              Properties
            </Link>
            <span className="text-black/15">/</span>
            <span className="text-sm text-black/70 truncate max-w-[260px]">
              {form.name || "Untitled property"}
            </span>
            <SaveBadge state={saveState} error={saveError} />
          </div>
        }
      />

      {!loaded && (
        <div className="max-w-5xl mx-auto px-6 py-20 text-center text-black/40">Loading…</div>
      )}
      {loaded && loadError && (
        <div className="max-w-3xl mx-auto px-6 py-12">
          <div className="rounded-2xl border border-[#b34334]/30 bg-[#b34334]/5 p-6 text-[#b34334]">
            <div className="font-semibold mb-1">Couldn&apos;t load this property</div>
            <div className="text-sm">{loadError}</div>
            <Link
              href="/properties"
              className="inline-block mt-3 text-sm underline hover:text-[#b34334]/80"
            >
              ← Back to properties
            </Link>
          </div>
        </div>
      )}

      {loaded && !loadError && (
        <main className="max-w-5xl mx-auto px-6 py-8">
          {/* Hero */}
          <Hero
            form={form}
            update={update}
            cover={form.images.find((i) => i.isCover) ?? form.images[0] ?? null}
            actionsOpen={actionsOpen}
            setActionsOpen={setActionsOpen}
            onDuplicate={handleDuplicate}
            onArchive={toggleArchived}
            onDeleteRequest={() => { setActionsOpen(false); setConfirmingDelete(true); }}
          />

          {/* Body — sticky nav + scrolling form */}
          <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-8 mt-8">
            <SectionNav active={activeSection} onClick={scrollToSection} />

            <div className="space-y-10 min-w-0">
              <SectionCard id="basics" title="Basics" registerRef={registerSection}>
                <BasicsSection
                  form={form}
                  update={update}
                  locations={locations}
                  setLocations={setLocations}
                  allTags={allTags}
                  setAllTags={setAllTags}
                />
              </SectionCard>

              <SectionCard id="photos" title="Photos" registerRef={registerSection}>
                <PhotosSection images={form.images} onChange={updateImages} />
              </SectionCard>

              <SectionCard
                id="story"
                title="Client-facing story"
                registerRef={registerSection}
                action={
                  <button
                    type="button"
                    onClick={handleAIFill}
                    disabled={aiFilling || !form.name?.trim()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold rounded-lg border border-[#1b3a2d]/20 text-[#1b3a2d] hover:bg-[#1b3a2d]/5 transition disabled:opacity-40 disabled:cursor-not-allowed"
                    title={!form.name?.trim() ? "Add a property name first" : "Generate story + amenities from the property name"}
                  >
                    <span className="text-[#c9a84c]">✦</span>
                    <span>{aiFilling ? "Generating…" : "Generate with AI"}</span>
                  </button>
                }
              >
                <StorySection form={form} update={update} />
                {aiError && (
                  <div className="mt-3 text-[12px] text-[#b34334]">{aiError}</div>
                )}
              </SectionCard>

              <SectionCard id="amenities" title="Amenities" registerRef={registerSection}>
                <AmenitiesSection form={form} update={update} />
              </SectionCard>

              <SectionCard id="stay" title="Stay snapshot" registerRef={registerSection}>
                <StaySection form={form} update={update} />
              </SectionCard>

              <SectionCard
                id="showcase"
                title="Showcase facts"
                hint="Rendered in the Property Showcase section's sidebar under Your Stay and Fun Facts."
                registerRef={registerSection}
              >
                <ShowcaseFactsSection form={form} update={update} />
              </SectionCard>

              <SectionCard
                id="rooms"
                title="Rooms"
                hint="Room types, bed configuration and photos. Shown in the Rooms tab of the property showcase."
                registerRef={registerSection}
              >
                <RoomsSection rooms={form.rooms} onChange={(rooms) => update({ rooms })} />
              </SectionCard>

              <SectionCard
                id="internal"
                title="Internal notes"
                hint="Visible to your team only — never shown to clients."
                registerRef={registerSection}
              >
                <InternalSection form={form} update={update} />
              </SectionCard>

              <SectionCard
                id="custom"
                title="Custom sections"
                hint="Add any extra sections this property warrants — children's program, wine list, conservation work."
                registerRef={registerSection}
              >
                <CustomSectionsEditor sections={form.customSections} onChange={updateCustomSections} />
              </SectionCard>
            </div>
          </div>

          <div className="mt-12 pt-6 border-t border-black/8 flex items-center justify-between flex-wrap gap-3">
            <Link href="/properties" className="text-sm text-black/40 hover:text-black/70 transition">
              ← All properties
            </Link>
            <div className="text-[12px] text-black/35">Changes save automatically.</div>
          </div>
        </main>
      )}

      {/* Delete confirm */}
      {confirmingDelete && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 ss-fade-in"
          onClick={() => setConfirmingDelete(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 ss-modal-in"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-black/85">Delete this property?</h2>
            <p className="mt-2 text-sm text-black/55">
              &ldquo;{form.name || "Untitled property"}&rdquo; and all of its photos and
              custom sections will be removed permanently. Existing proposals
              that already used this property are not affected.
            </p>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={() => setConfirmingDelete(false)}
                className="px-4 py-2 text-sm rounded-lg text-black/60 hover:bg-black/5 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-sm rounded-lg bg-[#b34334] text-white font-medium hover:bg-[#c4543f] transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Hero ──────────────────────────────────────────────────────────────────

function Hero({
  form,
  update,
  cover,
  actionsOpen,
  setActionsOpen,
  onDuplicate,
  onArchive,
  onDeleteRequest,
}: {
  form: PropertyForm;
  update: (patch: Partial<PropertyForm>) => void;
  cover: ImageItem | null;
  actionsOpen: boolean;
  setActionsOpen: (v: boolean) => void;
  onDuplicate: () => void;
  onArchive: () => void;
  onDeleteRequest: () => void;
}) {
  return (
    <div className="rounded-2xl overflow-hidden border border-black/8 bg-white relative">
      <div className="aspect-[16/6] bg-black/5 relative">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover.url} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-black/30 text-sm">
            Add a cover photo in the Photos section below
          </div>
        )}
        {form.archived && (
          <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/65 text-white text-[11px] uppercase tracking-wider font-bold">
            Archived
          </div>
        )}
        <div className="absolute top-3 right-3">
          <ActionsMenu
            open={actionsOpen}
            setOpen={setActionsOpen}
            archived={form.archived}
            onDuplicate={onDuplicate}
            onArchive={onArchive}
            onDelete={onDeleteRequest}
          />
        </div>
      </div>
      <div className="p-5 flex items-end justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-[260px]">
          <input
            type="text"
            value={form.name}
            onChange={(e) => update({ name: e.target.value })}
            placeholder="Property name"
            className="w-full text-2xl md:text-3xl font-bold tracking-tight text-black/85 bg-transparent outline-none placeholder:text-black/25"
          />
          <div className="mt-1 text-[13px] text-black/45 truncate">
            {form.propertyClass ? classLabel(form.propertyClass) : "Set a class below"}
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionsMenu({
  open,
  setOpen,
  archived,
  onDuplicate,
  onArchive,
  onDelete,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  archived: boolean;
  onDuplicate: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="px-3 py-1.5 text-sm rounded-lg bg-white/85 backdrop-blur border border-black/10 text-black/65 hover:bg-white transition"
      >
        Actions ▾
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-40 w-48 bg-white border border-black/10 rounded-xl shadow-xl py-1">
            <button
              onClick={onDuplicate}
              className="block w-full text-left px-3 py-2 text-sm text-black/75 hover:bg-black/[0.04] transition"
            >
              Duplicate
            </button>
            <button
              onClick={onArchive}
              className="block w-full text-left px-3 py-2 text-sm text-black/75 hover:bg-black/[0.04] transition"
            >
              {archived ? "Restore" : "Archive"}
            </button>
            <div className="border-t border-black/8 my-1" />
            <button
              onClick={onDelete}
              className="block w-full text-left px-3 py-2 text-sm text-[#b34334] hover:bg-[#b34334]/5 transition"
            >
              Delete…
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Section primitives ────────────────────────────────────────────────────

function SectionNav({ active, onClick }: { active: string; onClick: (id: string) => void }) {
  return (
    <nav className="md:sticky md:top-20 self-start">
      <ul className="space-y-0.5 -ml-2">
        {SECTIONS.map((s) => {
          const isActive = active === s.id;
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onClick(s.id)}
                className={`w-full text-left px-2 py-1.5 rounded-md text-[13px] transition ${
                  isActive
                    ? "bg-[#1b3a2d]/[0.08] text-[#1b3a2d] font-medium"
                    : "text-black/55 hover:text-black/85"
                }`}
              >
                {s.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function SectionCard({
  id,
  title,
  hint,
  action,
  children,
  registerRef,
}: {
  id: string;
  title: string;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  registerRef: (id: string, el: HTMLElement | null) => void;
}) {
  return (
    <section
      id={id}
      ref={(el) => registerRef(id, el)}
      className="bg-white rounded-2xl border border-black/8 p-6 md:p-7 scroll-mt-24"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-semibold text-black/85">{title}</h2>
          {hint && <p className="mt-0.5 text-[12px] text-black/45">{hint}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  );
}

function SaveBadge({ state, error }: { state: SaveState; error: string | null }) {
  if (state === "idle") return null;
  const label =
    state === "saving" ? "Saving…" :
    state === "saved" ? "Saved ✓" :
    state === "error" ? `Save failed — ${error ?? "retry"}` :
    "Unsaved";
  const color = state === "error" ? "text-[#b34334]" : "text-black/50";
  return <span className={`ml-2 text-[12px] tabular-nums transition ${color}`}>· {label}</span>;
}

// ─── Section bodies ────────────────────────────────────────────────────────

function BasicsSection({
  form,
  update,
  locations,
  setLocations,
  allTags,
  setAllTags,
}: {
  form: PropertyForm;
  update: (patch: Partial<PropertyForm>) => void;
  locations: LocationLite[];
  setLocations: (locs: LocationLite[]) => void;
  allTags: TagLite[];
  setAllTags: (tags: TagLite[]) => void;
}) {
  return (
    <div className="space-y-5">
      <Field label="Name">
        <TextInput
          value={form.name}
          onChange={(v) => update({ name: v })}
          placeholder="Mara Plains Camp"
        />
      </Field>

      <div className="grid md:grid-cols-2 gap-5">
        <Field label="Class">
          <select
            value={form.propertyClass}
            onChange={(e) => update({ propertyClass: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-black/12 bg-white text-sm text-black/85 focus:outline-none focus:border-[#1b3a2d] focus:ring-2 focus:ring-[#1b3a2d]/12 transition"
          >
            <option value="">— Select a class —</option>
            {PROPERTY_CLASSES.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Location">
          <LocationPicker
            value={form.locationId}
            onChange={(id) => update({ locationId: id })}
            locations={locations}
            setLocations={setLocations}
          />
        </Field>
      </div>

      <Field label="Tags" hint="Free-form. Press enter to add.">
        <TagInput
          tagIds={form.tagIds}
          onChange={(tagIds) => update({ tagIds })}
          allTags={allTags}
          setAllTags={setAllTags}
        />
      </Field>
    </div>
  );
}

function StorySection({
  form,
  update,
}: {
  form: PropertyForm;
  update: (patch: Partial<PropertyForm>) => void;
}) {
  return (
    <div className="space-y-5">
      <Field
        label="Short summary"
        hint={`${form.shortSummary.length}/280 — used as the property card blurb`}
      >
        <TextArea
          value={form.shortSummary}
          onChange={(v) => update({ shortSummary: v })}
          placeholder="Eight tents on the Olare Motorogi Conservancy, run by a lifelong Mara guide."
          rows={3}
          maxLength={280}
        />
      </Field>
      <Field
        label="About this property"
        hint="Shown as the lead paragraph in the proposal's Information tab — the property's setting, character, service, and style."
      >
        <TextArea
          value={form.whatMakesSpecial}
          onChange={(v) => update({ whatMakesSpecial: v })}
          placeholder="Eight tents on a private conservancy ridge, run by a lifelong Mara guide. Direct conservancy access — fewer vehicles, off-road permitted, night drives included."
          rows={5}
        />
      </Field>
      <Field label="Why we choose this">
        <TextArea
          value={form.whyWeChoose}
          onChange={(v) => update({ whyWeChoose: v })}
          placeholder="Best fit for guests who've done a Mara safari before and want quieter ground without losing the wildlife density."
          rows={4}
        />
      </Field>
    </div>
  );
}

function AmenitiesSection({
  form,
  update,
}: {
  form: PropertyForm;
  update: (patch: Partial<PropertyForm>) => void;
}) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const v = draft.trim();
    if (!v || form.amenities.includes(v)) return;
    update({ amenities: [...form.amenities, v] });
    setDraft("");
  };

  const remove = (i: number) =>
    update({ amenities: form.amenities.filter((_, idx) => idx !== i) });

  return (
    <div>
      <div className="flex items-center gap-1.5 flex-wrap mb-3">
        {form.amenities.map((a, i) => (
          <span
            key={`${a}-${i}`}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] bg-black/[0.06] text-black/70"
          >
            {a}
            <button
              type="button"
              onClick={() => remove(i)}
              className="text-black/35 hover:text-[#b34334] text-base leading-none"
              aria-label={`Remove ${a}`}
            >
              ×
            </button>
          </span>
        ))}
        {form.amenities.length === 0 && (
          <span className="text-[12px] text-black/35">No amenities yet.</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Pool, spa, kids' program, wifi…"
          className="flex-1 px-3 py-2 rounded-lg border border-black/12 text-sm focus:outline-none focus:border-[#1b3a2d] focus:ring-2 focus:ring-[#1b3a2d]/12 transition"
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim()}
          className="px-4 py-2 rounded-lg bg-[#1b3a2d] text-white text-sm font-medium hover:bg-[#2d5a40] active:scale-95 transition disabled:opacity-40"
        >
          Add
        </button>
      </div>
    </div>
  );
}

function StaySection({
  form,
  update,
}: {
  form: PropertyForm;
  update: (patch: Partial<PropertyForm>) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="grid md:grid-cols-2 gap-5">
        <Field label="Meal plan">
          <select
            value={form.mealPlan}
            onChange={(e) => update({ mealPlan: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-black/12 bg-white text-sm text-black/85 focus:outline-none focus:border-[#1b3a2d] focus:ring-2 focus:ring-[#1b3a2d]/12 transition"
          >
            <option value="">— Not set —</option>
            {MEAL_PLANS.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Suggested nights">
          <input
            type="number"
            min={1}
            max={30}
            value={form.suggestedNights ?? ""}
            onChange={(e) =>
              update({
                suggestedNights: e.target.value === "" ? null : Math.max(0, Math.round(Number(e.target.value))),
              })
            }
            placeholder="3"
            className="w-full px-3 py-2 rounded-lg border border-black/12 bg-white text-sm text-black/85 focus:outline-none focus:border-[#1b3a2d] focus:ring-2 focus:ring-[#1b3a2d]/12 transition"
          />
        </Field>
      </div>
      <Field label="Suitability" hint="Which trips this property is right for.">
        <div className="flex flex-wrap gap-1.5">
          {SUITABILITY.map((s) => {
            const active = form.suitability.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() =>
                  update({
                    suitability: active
                      ? form.suitability.filter((x) => x !== s.id)
                      : [...form.suitability, s.id],
                  })
                }
                className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition active:scale-95 border ${
                  active
                    ? "bg-[#1b3a2d] text-white border-[#1b3a2d]"
                    : "bg-white text-black/65 border-black/12 hover:bg-black/5"
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </Field>
    </div>
  );
}

function ShowcaseFactsSection({
  form,
  update,
}: {
  form: PropertyForm;
  update: (patch: Partial<PropertyForm>) => void;
}) {
  const csvToArray = (v: string) =>
    v
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  return (
    <div className="space-y-5">
      <div className="grid md:grid-cols-3 gap-5">
        <Field label="Check-in">
          <input
            type="text"
            value={form.checkInTime}
            onChange={(e) => update({ checkInTime: e.target.value })}
            placeholder="14:00"
            className="w-full px-3 py-2 rounded-lg border border-black/12 bg-white text-sm text-black/85 focus:outline-none focus:border-[#1b3a2d] focus:ring-2 focus:ring-[#1b3a2d]/12 transition"
          />
        </Field>
        <Field label="Check-out">
          <input
            type="text"
            value={form.checkOutTime}
            onChange={(e) => update({ checkOutTime: e.target.value })}
            placeholder="10:00"
            className="w-full px-3 py-2 rounded-lg border border-black/12 bg-white text-sm text-black/85 focus:outline-none focus:border-[#1b3a2d] focus:ring-2 focus:ring-[#1b3a2d]/12 transition"
          />
        </Field>
        <Field label="Total rooms">
          <input
            type="number"
            min={0}
            max={500}
            value={form.totalRooms ?? ""}
            onChange={(e) =>
              update({
                totalRooms: e.target.value === "" ? null : Math.max(0, Math.round(Number(e.target.value))),
              })
            }
            placeholder="12"
            className="w-full px-3 py-2 rounded-lg border border-black/12 bg-white text-sm text-black/85 focus:outline-none focus:border-[#1b3a2d] focus:ring-2 focus:ring-[#1b3a2d]/12 transition"
          />
        </Field>
      </div>

      <Field label="Spoken languages" hint="Comma-separated — English, Swahili, French.">
        <input
          type="text"
          value={form.spokenLanguages.join(", ")}
          onChange={(e) => update({ spokenLanguages: csvToArray(e.target.value) })}
          placeholder="English, Swahili"
          className="w-full px-3 py-2 rounded-lg border border-black/12 bg-white text-sm text-black/85 focus:outline-none focus:border-[#1b3a2d] focus:ring-2 focus:ring-[#1b3a2d]/12 transition"
        />
      </Field>

      <Field
        label="Special interests"
        hint="Comma-separated — Big 5, Nature activities, Cultural, Photography."
      >
        <input
          type="text"
          value={form.specialInterests.join(", ")}
          onChange={(e) => update({ specialInterests: csvToArray(e.target.value) })}
          placeholder="Big 5, Nature activities"
          className="w-full px-3 py-2 rounded-lg border border-black/12 bg-white text-sm text-black/85 focus:outline-none focus:border-[#1b3a2d] focus:ring-2 focus:ring-[#1b3a2d]/12 transition"
        />
      </Field>

      {/* Per-property toggle for the Fun Facts block. When off, the
          rooms / languages / interests sub-block disappears from the
          proposal showcase for this property — useful for lodges
          where those facts aren't a fit (private mobile camps,
          uncommon language coverage, etc.). */}
      <label className="flex items-start gap-3 cursor-pointer pt-1">
        <input
          type="checkbox"
          checked={form.funFactsVisible}
          onChange={(e) => update({ funFactsVisible: e.target.checked })}
          className="mt-0.5 h-4 w-4 accent-[#1b3a2d]"
        />
        <span>
          <span className="block text-sm font-medium text-black/80">
            Show &ldquo;Fun Facts&rdquo; in the proposal
          </span>
          <span className="block text-[12px] text-black/50 mt-0.5">
            Includes total rooms, spoken languages, and special interests in the
            property showcase. Turn off for properties where these facts
            aren&rsquo;t relevant.
          </span>
        </span>
      </label>
    </div>
  );
}

function RoomsSection({
  rooms,
  onChange,
}: {
  rooms: RoomItem[];
  onChange: (next: RoomItem[]) => void;
}) {
  const addRoom = () =>
    onChange([
      ...rooms,
      { name: "New room type", bedConfig: "", description: "", imageUrls: [], order: rooms.length },
    ]);

  const updateRoom = (i: number, patch: Partial<RoomItem>) =>
    onChange(rooms.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const removeRoom = (i: number) =>
    onChange(rooms.filter((_, idx) => idx !== i));

  const uploadImages = async (i: number, files: FileList | null) => {
    if (!files || files.length === 0) return;
    try {
      const { uploadImage } = await import("@/lib/uploadImage");
      const urls = await Promise.all(Array.from(files).map((f) => uploadImage(f)));
      updateRoom(i, { imageUrls: [...rooms[i].imageUrls, ...urls] });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Upload failed");
    }
  };

  const removeImage = (i: number, imgIdx: number) =>
    updateRoom(i, { imageUrls: rooms[i].imageUrls.filter((_, x) => x !== imgIdx) });

  if (rooms.length === 0) {
    return (
      <div className="space-y-3">
        <div className="text-[13px] italic text-black/45">
          No room types yet. Add one to describe bed configurations and show room photos on the
          property showcase.
        </div>
        <button
          type="button"
          onClick={addRoom}
          className="text-[12px] font-semibold uppercase tracking-[0.22em] px-4 py-2 rounded-md bg-[#1b3a2d]/10 text-[#1b3a2d] border border-dashed border-[#1b3a2d]/40 hover:bg-[#1b3a2d]/15 transition"
        >
          + Add room type
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {rooms.map((r, i) => (
        <div
          key={r.id ?? `new-${i}`}
          className="p-4 rounded-xl border border-black/10 bg-white space-y-4"
        >
          <div className="grid md:grid-cols-[1fr_1fr] gap-4">
            <Field label="Room name">
              <input
                type="text"
                value={r.name}
                onChange={(e) => updateRoom(i, { name: e.target.value })}
                placeholder="Luxury suite"
                className="w-full px-3 py-2 rounded-lg border border-black/12 bg-white text-sm text-black/85 focus:outline-none focus:border-[#1b3a2d] focus:ring-2 focus:ring-[#1b3a2d]/12 transition"
              />
            </Field>
            <Field label="Bed configuration">
              <input
                type="text"
                value={r.bedConfig}
                onChange={(e) => updateRoom(i, { bedConfig: e.target.value })}
                placeholder="King bed · extra bed on request"
                className="w-full px-3 py-2 rounded-lg border border-black/12 bg-white text-sm text-black/85 focus:outline-none focus:border-[#1b3a2d] focus:ring-2 focus:ring-[#1b3a2d]/12 transition"
              />
            </Field>
          </div>

          <Field label="Description">
            <textarea
              value={r.description}
              onChange={(e) => updateRoom(i, { description: e.target.value })}
              rows={3}
              maxLength={600}
              placeholder="What's in the room, views, private deck, etc."
              className="w-full px-3 py-2 rounded-lg border border-black/12 bg-white text-sm text-black/85 focus:outline-none focus:border-[#1b3a2d] focus:ring-2 focus:ring-[#1b3a2d]/12 transition resize-y"
            />
          </Field>

          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] font-semibold text-black/55 mb-2">
              Room photos
            </div>
            {r.imageUrls.length > 0 && (
              <div className="grid grid-cols-4 gap-2 mb-2">
                {r.imageUrls.map((u, imgIdx) => (
                  <div
                    key={imgIdx}
                    className="relative group"
                    style={{ aspectRatio: "4 / 3", background: "#f1ede4" }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={u} alt="" className="w-full h-full object-cover rounded-sm" />
                    <button
                      type="button"
                      onClick={() => removeImage(i, imgIdx)}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-[10px] opacity-0 group-hover:opacity-100 transition"
                      title="Remove"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] px-3 py-1.5 rounded-md bg-[#1b3a2d]/10 text-[#1b3a2d] border border-dashed border-[#1b3a2d]/40 hover:bg-[#1b3a2d]/15 transition cursor-pointer">
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => uploadImages(i, e.target.files)}
              />
              + Add photos
            </label>
          </div>

          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => removeRoom(i)}
              className="text-[11.5px] text-black/40 hover:text-red-500 transition"
            >
              Remove room
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={addRoom}
        className="w-full py-3 text-[12px] font-semibold uppercase tracking-[0.22em] rounded-md bg-[#1b3a2d]/10 text-[#1b3a2d] border border-dashed border-[#1b3a2d]/40 hover:bg-[#1b3a2d]/15 transition"
      >
        + Add another room type
      </button>
    </div>
  );
}

function InternalSection({
  form,
  update,
}: {
  form: PropertyForm;
  update: (patch: Partial<PropertyForm>) => void;
}) {
  return (
    <Field label="Internal notes">
      <TextArea
        value={form.internalNotes}
        onChange={(v) => update({ internalNotes: v })}
        placeholder="Booking quirks, preferred contact, kid-bed rules, payment terms — anything your team needs but the client shouldn't see."
        rows={6}
      />
    </Field>
  );
}

// ─── Form primitives ───────────────────────────────────────────────────────

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[13px] font-medium text-black/70">{label}</span>
        {hint && <span className="text-[11px] text-black/35">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 rounded-lg border border-black/12 bg-white text-sm text-black/85 placeholder:text-black/30 focus:outline-none focus:border-[#1b3a2d] focus:ring-2 focus:ring-[#1b3a2d]/12 transition"
    />
  );
}

function TextArea({
  value,
  onChange,
  placeholder,
  rows = 4,
  maxLength,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
}) {
  return (
    <textarea
      value={value}
      rows={rows}
      maxLength={maxLength}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 rounded-lg border border-black/12 bg-white text-sm text-black/85 placeholder:text-black/30 focus:outline-none focus:border-[#1b3a2d] focus:ring-2 focus:ring-[#1b3a2d]/12 transition resize-y"
    />
  );
}

// ─── (De)serialisation ─────────────────────────────────────────────────────

type LoadedProperty = {
  name?: string | null;
  propertyClass?: string | null;
  locationId?: string | null;
  shortSummary?: string | null;
  whatMakesSpecial?: string | null;
  whyWeChoose?: string | null;
  amenities?: unknown;
  mealPlan?: string | null;
  suggestedNights?: number | null;
  suitability?: unknown;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  totalRooms?: number | null;
  spokenLanguages?: unknown;
  specialInterests?: unknown;
  funFactsVisible?: boolean | null;
  internalNotes?: string | null;
  archived?: boolean;
  images?: { id: string; url: string; caption: string | null; order: number; isCover: boolean }[];
  tags?: { tag: { id: string; name: string } }[];
  customSections?: { id: string; title: string; body: string | null; visible: boolean; order: number }[];
  rooms?: {
    id: string;
    name: string;
    bedConfig: string | null;
    description: string | null;
    imageUrls: string[];
    order: number;
  }[];
};

function hydrateForm(p: LoadedProperty | null): PropertyForm {
  if (!p) return EMPTY_FORM;
  return {
    name: p.name ?? "",
    propertyClass: p.propertyClass ?? "",
    locationId: p.locationId ?? null,
    shortSummary: p.shortSummary ?? "",
    whatMakesSpecial: p.whatMakesSpecial ?? "",
    whyWeChoose: p.whyWeChoose ?? "",
    amenities: Array.isArray(p.amenities) ? (p.amenities as string[]) : [],
    mealPlan: p.mealPlan ?? "",
    suggestedNights: typeof p.suggestedNights === "number" ? p.suggestedNights : null,
    suitability: Array.isArray(p.suitability) ? (p.suitability as string[]) : [],
    checkInTime: p.checkInTime ?? "",
    checkOutTime: p.checkOutTime ?? "",
    totalRooms: typeof p.totalRooms === "number" ? p.totalRooms : null,
    spokenLanguages: Array.isArray(p.spokenLanguages) ? (p.spokenLanguages as string[]) : [],
    specialInterests: Array.isArray(p.specialInterests) ? (p.specialInterests as string[]) : [],
    funFactsVisible: p.funFactsVisible ?? true,
    internalNotes: p.internalNotes ?? "",
    archived: Boolean(p.archived),
    images: (p.images ?? []).map((img) => ({
      id: img.id,
      url: img.url,
      caption: img.caption,
      order: img.order,
      isCover: img.isCover,
    })),
    tagIds: (p.tags ?? []).map((t) => t.tag.id),
    customSections: (p.customSections ?? []).map((s) => ({
      id: s.id,
      title: s.title,
      body: s.body,
      visible: s.visible,
      order: s.order,
    })),
    rooms: (p.rooms ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      bedConfig: r.bedConfig ?? "",
      description: r.description ?? "",
      imageUrls: Array.isArray(r.imageUrls) ? r.imageUrls : [],
      order: r.order,
    })),
  };
}

function serialize(form: PropertyForm) {
  return {
    name: form.name.trim() || "Untitled Property",
    propertyClass: form.propertyClass || null,
    locationId: form.locationId,
    shortSummary: form.shortSummary,
    whatMakesSpecial: form.whatMakesSpecial,
    whyWeChoose: form.whyWeChoose,
    amenities: form.amenities,
    mealPlan: form.mealPlan || null,
    suggestedNights: form.suggestedNights,
    suitability: form.suitability,
    checkInTime: form.checkInTime.trim() || null,
    checkOutTime: form.checkOutTime.trim() || null,
    totalRooms: form.totalRooms,
    spokenLanguages: form.spokenLanguages,
    specialInterests: form.specialInterests,
    funFactsVisible: form.funFactsVisible,
    internalNotes: form.internalNotes,
    archived: form.archived,
    images: form.images.map((img, i) => ({
      id: img.id,
      url: img.url,
      caption: img.caption,
      order: i,
      isCover: img.isCover,
    })),
    tagIds: form.tagIds,
    customSections: form.customSections.map((s, i) => ({
      id: s.id,
      title: s.title,
      body: s.body,
      visible: s.visible,
      order: i,
    })),
    rooms: form.rooms.map((r, i) => ({
      id: r.id,
      name: r.name,
      bedConfig: r.bedConfig || null,
      description: r.description || null,
      imageUrls: r.imageUrls,
      order: i,
    })),
  };
}
