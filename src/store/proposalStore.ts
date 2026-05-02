import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type {
  Proposal,
  Section,
  SectionType,
  Day,
  Property,
  ThemeTokens,
  StyleOverrides,
  QuickStartForm,
  TierKey,
  PracticalCard,
  OptionalActivity,
  PropertyRoom,
} from "@/lib/types";
import { buildDefaultProposal, buildBlankProposal, migrateLoadedProposal } from "@/lib/defaults";
import { COLOR_PRESETS } from "@/lib/theme";
import { SECTION_REGISTRY } from "@/lib/sectionRegistry";
import { nanoid } from "@/lib/nanoid";
import { countryOf } from "@/lib/destinationOrdering";
import { MEAL_PLANS } from "@/lib/properties";

// ─── Day mutation helpers ────────────────────────────────────────────────
//
// Renumber every day from 1 and recompute its `date` from the trip's
// arrivalDate. Run this at the end of every action that adds, removes,
// duplicates, or reorders days so downstream sections (map, itinerary
// table, cover) read fresh values without a separate regeneration pass.

function renumberAndRedate(days: Day[], arrivalDateISO: string | undefined) {
  days.forEach((d, i) => {
    d.dayNumber = i + 1;
  });
  if (!arrivalDateISO) return;
  const start = parseISODate(arrivalDateISO);
  if (!start) return;
  for (const d of days) {
    const dt = new Date(start);
    dt.setUTCDate(start.getUTCDate() + (d.dayNumber - 1));
    d.date = formatISODate(dt);
  }
}

function parseISODate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return isNaN(d.getTime()) ? null : d;
}

function formatISODate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// "Prevailing country" — the country that appears most often across the
// existing days. Used as the fallback when countryOf() can't recognise a
// new destination, so we never silently drop the trip into a country
// it doesn't belong to. Replaces the old hardcoded "Kenya" default.
function prevailingCountry(days: Day[], fallback = ""): string {
  if (days.length === 0) return fallback;
  const counts = new Map<string, number>();
  for (const d of days) {
    const c = (d.country ?? "").trim();
    if (!c) continue;
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  let best: { c: string; n: number } | null = null;
  for (const [c, n] of counts) {
    if (!best || n > best.n) best = { c, n };
  }
  return best?.c ?? fallback;
}

// Build a fresh Day record. Country auto-derives from countryOf() and
// falls back to the prevailing country in the existing trip. Tiers are
// blank rather than "Camp Name" placeholders so the day card invites
// the operator to pick a property instead of pretending one's set.
function makeNewDay(opts: {
  destination: string;
  country?: string;
  prevailingCountry: string;
}): Day {
  const dest = opts.destination.trim();
  const country =
    opts.country?.trim() || countryOf(dest) || opts.prevailingCountry || "";
  return {
    id: nanoid(),
    dayNumber: 0, // overwritten by renumberAndRedate
    destination: dest,
    country,
    description: "",
    board: "Full board",
    tiers: {
      classic: { camp: "", location: "", note: "" },
      premier: { camp: "", location: "", note: "" },
      signature: { camp: "", location: "", note: "" },
    },
  };
}

interface ProposalState {
  proposal: Proposal;

  // ── Proposal-level ──────────────────────────────────────────────────────────
  loadTemplate: (id: string) => void;
  loadBlank: () => void;
  createFromQuickStart: (form: QuickStartForm) => void;
  hydrateProposal: (proposal: Proposal) => void;
  updateMetadata: (title: string) => void;
  /** Flip the proposal between the magazine (single-column) and
   *  spread (two-column sticky-photo) render modes. Same data; just
   *  changes which canvas chrome wraps the sections. */
  updateViewMode: (next: "magazine" | "spread") => void;
  updateClient: (patch: Partial<Proposal["client"]>) => void;
  updateOperator: (patch: Partial<Proposal["operator"]>) => void;
  updateTrip: (patch: Partial<Proposal["trip"]>) => void;
  updateDepositConfig: (patch: Partial<NonNullable<Proposal["depositConfig"]>>) => void;

  // ── Theme ───────────────────────────────────────────────────────────────────
  updateThemeTokens: (patch: Partial<ThemeTokens>) => void;
  applyPreset: (presetKey: string) => void;
  setDisplayFont: (font: string) => void;
  setBodyFont: (font: string) => void;

  // ── Tiers ───────────────────────────────────────────────────────────────────
  setActiveTier: (tier: TierKey) => void;
  toggleTierVisibility: (tier: TierKey) => void;
  updateTierLabel: (tier: TierKey, label: string) => void;
  updateTierPrice: (tier: TierKey, price: string) => void;
  updateTierCurrency: (tier: TierKey, currency: string) => void;
  updatePricingNotes: (notes: string) => void;

  // ── Sections ────────────────────────────────────────────────────────────────
  addSection: (type: SectionType, afterOrder?: number) => void;
  removeSection: (id: string) => void;
  duplicateSection: (id: string) => void;
  toggleSectionVisibility: (id: string) => void;
  moveSection: (fromIndex: number, toIndex: number) => void;
  updateSectionContent: (id: string, patch: Record<string, unknown>) => void;
  updateSectionVariant: (id: string, variant: string) => void;
  updateSectionStyleOverrides: (id: string, patch: StyleOverrides) => void;
  resetSectionOverrides: (id: string) => void;

  // ── Days ────────────────────────────────────────────────────────────────────
  /**
   * Insert one or more days for a single destination at a chosen position.
   * `nights` ≥ 1 inserts that many sequential days at the same place
   * (the codebase represents a multi-night stay as N consecutive days).
   * `afterDayId` undefined → append at the end. After the splice every
   * day's `dayNumber` and `date` are recomputed so downstream sections
   * (map, itinerary table, cover) read fresh values without a separate
   * regeneration pass.
   */
  addDays: (input: {
    destination: string;
    country?: string;
    nights: number;
    afterDayId?: string;
  }) => void;
  addDay: () => void;
  addDayAfter: (id: string) => void;
  removeDay: (id: string) => void;
  duplicateDay: (id: string) => void;
  moveDay: (fromIndex: number, toIndex: number) => void;
  updateDay: (id: string, patch: Partial<Day>) => void;

  // ── Optional activities (per-day priced add-ons) ─────────────────────────
  addOptionalActivity: (dayId: string) => void;
  updateOptionalActivity: (dayId: string, activityId: string, patch: Partial<OptionalActivity>) => void;
  removeOptionalActivity: (dayId: string, activityId: string) => void;

  // ── Add-on selection (guest-side, share view) ───────────────────────────
  toggleAddOnSelection: (dayId: string, activityId: string) => void;

  // ── Properties ──────────────────────────────────────────────────────────────
  addProperty: () => void;
  addPropertyFromLibrary: (snapshot: Partial<Property>) => void;
  removeProperty: (id: string) => void;
  moveProperty: (fromIndex: number, toIndex: number) => void;
  updateProperty: (id: string, patch: Partial<Property>) => void;
  /**
   * Re-snapshot a proposal property from its source library record.
   * Looks up the library record by the snapshot's `libraryPropertyId`,
   * applies the same field mapping `DayPropertyPicker.pick()` uses,
   * and patches the proposal property in place. The proposal's `id`
   * stays the same so day-card references keep pointing at it.
   * Returns true on success, false when the property has no library
   * link or the fetch failed.
   */
  refreshPropertyFromLibrary: (propertyId: string) => Promise<boolean>;

  // ── Property rooms (STATS/ROOMS/INFORMATION tab content) ────────────────
  addPropertyRoom: (propertyId: string) => void;
  updatePropertyRoom: (propertyId: string, roomId: string, patch: Partial<PropertyRoom>) => void;
  removePropertyRoom: (propertyId: string, roomId: string) => void;

  // ── Inclusions / Exclusions ─────────────────────────────────────────────────
  updateInclusions: (list: string[]) => void;
  updateExclusions: (list: string[]) => void;

  // ── Practical Info ──────────────────────────────────────────────────────────
  addPracticalCard: () => void;
  removePracticalCard: (id: string) => void;
  updatePracticalCard: (id: string, patch: Partial<PracticalCard>) => void;
}

export const useProposalStore = create<ProposalState>()(
  immer((set, get) => ({
    proposal: buildDefaultProposal(),

    // ── Proposal-level ────────────────────────────────────────────────────────

    hydrateProposal: (proposal) =>
      set((state) => {
        state.proposal = migrateLoadedProposal(proposal);
      }),

    loadTemplate: (id) =>
      set((state) => {
        // For now, family-safari loads default; others load blank with title
        if (id === "family-safari") {
          state.proposal = buildDefaultProposal();
        } else {
          const blank = buildBlankProposal();
          const names: Record<string, string> = {
            honeymoon: "Honeymoon Safari",
            migration: "Migration Safari",
            "beach-bush": "Beach & Bush Safari",
          };
          blank.metadata.title = names[id] ?? "New Proposal";
          blank.trip.title = blank.metadata.title;
          state.proposal = blank;
        }
      }),

    loadBlank: () =>
      set((state) => {
        state.proposal = buildBlankProposal();
      }),

    createFromQuickStart: (form) =>
      set((state) => {
        const p = buildBlankProposal();
        p.client.guestNames = form.guestNames;
        p.client.pax = form.pax;
        p.client.rooming = form.rooming;
        p.client.arrivalFlight = form.arrivalFlight;
        p.client.departureFlight = form.departureFlight;
        p.client.specialOccasion = form.specialOccasion;
        p.client.dietary = form.dietary;
        p.trip.dates = form.travelDates;
        p.trip.title = `${form.guestNames} Safari`;
        p.trip.subtitle = `${form.destinations} · ${form.travelDates}`;
        p.trip.destinations = form.destinations.split(",").map((d) => d.trim());
        p.trip.tripStyle = form.tripStyle;
        p.trip.highlights = form.highlights;
        p.trip.operatorNote = form.operatorNote;
        p.activeTier = form.budgetTier;
        p.metadata.title = p.trip.title;
        state.proposal = p;
      }),

    updateMetadata: (title) =>
      set((state) => {
        state.proposal.metadata.title = title;
        state.proposal.trip.title = title;
      }),

    updateViewMode: (next) =>
      set((state) => {
        state.proposal.viewMode = next;
      }),

    updateClient: (patch) =>
      set((state) => {
        Object.assign(state.proposal.client, patch);
      }),

    updateOperator: (patch) =>
      set((state) => {
        Object.assign(state.proposal.operator, patch);
      }),

    updateTrip: (patch) =>
      set((state) => {
        Object.assign(state.proposal.trip, patch);
      }),

    updateDepositConfig: (patch) =>
      set((state) => {
        const current = state.proposal.depositConfig ?? {
          enabled: false,
          amount: "",
          currency: "USD",
          description: "",
        };
        state.proposal.depositConfig = { ...current, ...patch };
      }),

    // ── Theme ─────────────────────────────────────────────────────────────────

    updateThemeTokens: (patch) =>
      set((state) => {
        Object.assign(state.proposal.theme.tokens, patch);
      }),

    applyPreset: (presetKey) =>
      set((state) => {
        const preset = COLOR_PRESETS[presetKey];
        if (preset) {
          state.proposal.theme.tokens = { ...preset };
          state.proposal.theme.preset = presetKey;
        }
      }),

    setDisplayFont: (font) =>
      set((state) => {
        state.proposal.theme.displayFont = font;
      }),

    setBodyFont: (font) =>
      set((state) => {
        state.proposal.theme.bodyFont = font;
      }),

    // ── Tiers ─────────────────────────────────────────────────────────────────

    setActiveTier: (tier) =>
      set((state) => {
        state.proposal.activeTier = tier;
      }),

    toggleTierVisibility: (tier) =>
      set((state) => {
        state.proposal.visibleTiers[tier] = !state.proposal.visibleTiers[tier];
      }),

    updateTierLabel: (tier, label) =>
      set((state) => {
        state.proposal.pricing[tier].label = label;
      }),

    updateTierPrice: (tier, price) =>
      set((state) => {
        state.proposal.pricing[tier].pricePerPerson = price;
      }),

    updateTierCurrency: (tier, currency) =>
      set((state) => {
        state.proposal.pricing[tier].currency = currency;
      }),

    updatePricingNotes: (notes) =>
      set((state) => {
        state.proposal.pricing.notes = notes;
      }),

    // ── Sections ──────────────────────────────────────────────────────────────

    addSection: (type, afterOrder) =>
      set((state) => {
        const def = SECTION_REGISTRY[type];
        const insertAfter = afterOrder ?? state.proposal.sections.length - 1;
        // Shift orders of sections after insertion point
        state.proposal.sections.forEach((s) => {
          if (s.order > insertAfter) s.order++;
        });
        state.proposal.sections.push({
          id: nanoid(),
          type,
          visible: true,
          order: insertAfter + 1,
          layoutVariant: def.defaultVariant,
          styleOverrides: {},
          content: { ...def.defaultContent },
        });
        // Re-sort
        state.proposal.sections.sort((a, b) => a.order - b.order);
      }),

    removeSection: (id) =>
      set((state) => {
        state.proposal.sections = state.proposal.sections.filter(
          (s) => s.id !== id
        );
      }),

    duplicateSection: (id) =>
      set((state) => {
        const orig = state.proposal.sections.find((s) => s.id === id);
        if (!orig) return;
        const newSection: Section = {
          ...orig,
          id: nanoid(),
          order: orig.order + 0.5,
          content: { ...orig.content },
          styleOverrides: { ...orig.styleOverrides },
        };
        state.proposal.sections.push(newSection);
        state.proposal.sections.sort((a, b) => a.order - b.order);
        state.proposal.sections.forEach((s, i) => {
          s.order = i;
        });
      }),

    toggleSectionVisibility: (id) =>
      set((state) => {
        const s = state.proposal.sections.find((s) => s.id === id);
        if (s) s.visible = !s.visible;
      }),

    moveSection: (fromIndex, toIndex) =>
      set((state) => {
        const sections = state.proposal.sections;
        const [moved] = sections.splice(fromIndex, 1);
        sections.splice(toIndex, 0, moved);
        sections.forEach((s, i) => {
          s.order = i;
        });
      }),

    updateSectionContent: (id, patch) =>
      set((state) => {
        const s = state.proposal.sections.find((s) => s.id === id);
        if (s) Object.assign(s.content, patch);
      }),

    updateSectionVariant: (id, variant) =>
      set((state) => {
        const s = state.proposal.sections.find((s) => s.id === id);
        if (s) s.layoutVariant = variant;
      }),

    updateSectionStyleOverrides: (id, patch) =>
      set((state) => {
        const s = state.proposal.sections.find((s) => s.id === id);
        if (s) Object.assign(s.styleOverrides, patch);
      }),

    resetSectionOverrides: (id) =>
      set((state) => {
        const s = state.proposal.sections.find((s) => s.id === id);
        if (s) s.styleOverrides = {};
      }),

    // ── Days ──────────────────────────────────────────────────────────────────

    // The canonical insert path. Every UI affordance (+ Add day, Add
    // after, Duplicate) routes through here via AddDayDialog so days
    // can never be created without a real destination.
    addDays: ({ destination, country, nights, afterDayId }) =>
      set((state) => {
        const n = Math.max(1, Math.min(31, Math.floor(nights)));
        const trimmed = destination.trim();
        if (!trimmed) return;
        const existing = state.proposal.days;
        const insertIdx =
          afterDayId === undefined
            ? existing.length
            : (() => {
                const idx = existing.findIndex((d) => d.id === afterDayId);
                return idx === -1 ? existing.length : idx + 1;
              })();
        const prevailing = prevailingCountry(existing);
        const fresh: Day[] = [];
        for (let i = 0; i < n; i++) {
          fresh.push(makeNewDay({ destination: trimmed, country, prevailingCountry: prevailing }));
        }
        existing.splice(insertIdx, 0, ...fresh);
        renumberAndRedate(existing, state.proposal.trip.arrivalDate);
      }),

    // Legacy + safety-net entry. Kept so non-UI callers (autopilot,
    // migrations, scripts) don't break, but the country fallback now
    // uses the trip's prevailing country instead of a hardcoded
    // "Kenya" — that hardcode was the cause of stray 🇰🇪 flags
    // showing up on Tanzania-only trips.
    addDay: () =>
      set((state) => {
        const newDay = makeNewDay({
          destination: "New Destination",
          prevailingCountry: prevailingCountry(state.proposal.days),
        });
        state.proposal.days.push(newDay);
        renumberAndRedate(state.proposal.days, state.proposal.trip.arrivalDate);
      }),

    addDayAfter: (id) =>
      set((state) => {
        const idx = state.proposal.days.findIndex((d) => d.id === id);
        const newDay = makeNewDay({
          destination: "New Destination",
          prevailingCountry: prevailingCountry(state.proposal.days),
        });
        state.proposal.days.splice(idx + 1, 0, newDay);
        renumberAndRedate(state.proposal.days, state.proposal.trip.arrivalDate);
      }),

    removeDay: (id) =>
      set((state) => {
        state.proposal.days = state.proposal.days.filter((d) => d.id !== id);
        renumberAndRedate(state.proposal.days, state.proposal.trip.arrivalDate);
      }),

    duplicateDay: (id) =>
      set((state) => {
        const idx = state.proposal.days.findIndex((d) => d.id === id);
        if (idx === -1) return;
        const orig = state.proposal.days[idx];
        state.proposal.days.splice(idx + 1, 0, { ...orig, id: nanoid() });
        renumberAndRedate(state.proposal.days, state.proposal.trip.arrivalDate);
      }),

    moveDay: (fromIndex, toIndex) =>
      set((state) => {
        const days = state.proposal.days;
        const [moved] = days.splice(fromIndex, 1);
        days.splice(toIndex, 0, moved);
        renumberAndRedate(days, state.proposal.trip.arrivalDate);
      }),

    updateDay: (id, patch) =>
      set((state) => {
        const d = state.proposal.days.find((d) => d.id === id);
        if (d) Object.assign(d, patch);
      }),

    // ── Optional activities (per-day priced add-ons) ────────────────────────

    addOptionalActivity: (dayId) =>
      set((state) => {
        const d = state.proposal.days.find((d) => d.id === dayId);
        if (!d) return;
        if (!d.optionalActivities) d.optionalActivities = [];
        d.optionalActivities.push({
          id: nanoid(),
          title: "Optional activity",
          timeOfDay: "Morning",
          location: "",
          description: "",
          priceAmount: "",
          priceCurrency: "USD",
        });
      }),

    updateOptionalActivity: (dayId, activityId, patch) =>
      set((state) => {
        const d = state.proposal.days.find((d) => d.id === dayId);
        if (!d?.optionalActivities) return;
        const activity = d.optionalActivities.find((a) => a.id === activityId);
        if (activity) Object.assign(activity, patch);
      }),

    removeOptionalActivity: (dayId, activityId) =>
      set((state) => {
        const d = state.proposal.days.find((d) => d.id === dayId);
        if (!d?.optionalActivities) return;
        d.optionalActivities = d.optionalActivities.filter((a) => a.id !== activityId);
      }),

    // ── Add-on selection (guest-side) ───────────────────────────────────────

    toggleAddOnSelection: (dayId, activityId) =>
      set((state) => {
        if (!state.proposal.selectedAddOns) state.proposal.selectedAddOns = [];
        const list = state.proposal.selectedAddOns;
        const existing = list.findIndex(
          (s) => s.dayId === dayId && s.activityId === activityId,
        );
        if (existing >= 0) {
          list.splice(existing, 1);
        } else {
          list.unshift({ dayId, activityId, selectedAt: new Date().toISOString() });
        }
      }),

    // ── Properties ────────────────────────────────────────────────────────────

    addProperty: () =>
      set((state) => {
        state.proposal.properties.push({
          id: nanoid(),
          name: "Property Name",
          location: "Location, Country",
          shortDesc: "Short description",
          description: "",
          whyWeChoseThis: "",
          amenities: [],
          mealPlan: "Full board",
          roomType: "Standard tent",
          nights: 2,
          galleryUrls: [],
        });
      }),

    // Insert a property snapshot from the library. We always assign a fresh
    // proposal-local id and fill any missing fields with sensible defaults
    // so downstream renderers never see undefined. The snapshot is a copy —
    // the proposal stays stable if the source library property is later
    // edited or deleted.
    addPropertyFromLibrary: (snapshot) =>
      set((state) => {
        state.proposal.properties.push({
          id: nanoid(),
          name: snapshot.name ?? "Property",
          location: snapshot.location ?? "",
          shortDesc: snapshot.shortDesc ?? "",
          description: snapshot.description ?? "",
          whyWeChoseThis: snapshot.whyWeChoseThis ?? "",
          amenities: snapshot.amenities ?? [],
          mealPlan: snapshot.mealPlan ?? "Full board",
          roomType: snapshot.roomType ?? "Standard tent",
          nights: snapshot.nights ?? 2,
          tier: snapshot.tier,
          leadImageUrl: snapshot.leadImageUrl,
          galleryUrls: snapshot.galleryUrls ?? [],
          // Showcase facts + rooms, carried over from the library snapshot.
          checkInTime: snapshot.checkInTime,
          checkOutTime: snapshot.checkOutTime,
          totalRooms: snapshot.totalRooms,
          spokenLanguages: snapshot.spokenLanguages ?? [],
          specialInterests: snapshot.specialInterests ?? [],
          rooms: (snapshot.rooms ?? []).map((r) => ({
            id: nanoid(),
            name: r.name,
            bedConfig: r.bedConfig ?? "",
            description: r.description ?? "",
            imageUrls: r.imageUrls ?? [],
          })),
        });
      }),

    removeProperty: (id) =>
      set((state) => {
        state.proposal.properties = state.proposal.properties.filter(
          (p) => p.id !== id
        );
      }),

    moveProperty: (fromIndex, toIndex) =>
      set((state) => {
        const props = state.proposal.properties;
        const [moved] = props.splice(fromIndex, 1);
        props.splice(toIndex, 0, moved);
      }),

    updateProperty: (id, patch) =>
      set((state) => {
        const p = state.proposal.properties.find((p) => p.id === id);
        if (!p) return;
        const oldName = p.name;
        Object.assign(p, patch);
        // If the name changed, walk every day's tier assignments and
        // rename any reference that still pointed at the old name.
        // Day-card lookups match by case-insensitive name, so without
        // this step a property rename leaves the day cards orphaned —
        // they fall through to the phantom-property branch and render
        // with no image. Operator-flagged: renames silently broke the
        // property image in preview / share view.
        if (typeof patch.name === "string" && patch.name !== oldName) {
          const lcOld = oldName.trim().toLowerCase();
          for (const day of state.proposal.days) {
            for (const tier of Object.values(day.tiers ?? {})) {
              if (
                typeof tier?.camp === "string" &&
                tier.camp.trim().toLowerCase() === lcOld
              ) {
                tier.camp = patch.name;
              }
            }
          }
        }
      }),

    refreshPropertyFromLibrary: async (propertyId: string) => {
      // Mirror of DayPropertyPicker.pick()'s mapping. Two callers share
      // this logic conceptually but copying the full body is preferable
      // to a runtime import of a hook-bound module — Zustand actions
      // run outside React's render tree.
      const current = get().proposal.properties.find((p) => p.id === propertyId);
      if (!current?.libraryPropertyId) return false;
      const libraryId = current.libraryPropertyId;
      try {
        const cacheBuster = `t=${Date.now()}`;
        const res = await fetch(`/api/properties/${libraryId}?${cacheBuster}`, {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" },
        });
        if (!res.ok) return false;
        const data = await res.json();
        const p = data?.property;
        if (!p) return false;

        const sortedImages = [...(p.images ?? [])].sort(
          (a: { isCover?: boolean; order?: number }, b: { isCover?: boolean; order?: number }) =>
            Number(!!b.isCover) - Number(!!a.isCover) || (a.order ?? 0) - (b.order ?? 0),
        );
        const lead = sortedImages[0]?.url;
        const gallery = sortedImages.map((i: { url: string }) => i.url);
        const location = p.location
          ? p.location.country
            ? `${p.location.name}, ${p.location.country}`
            : p.location.name
          : "";

        const patch: Partial<Property> = {
          libraryPropertyId: p.id,
          name: p.name,
          location,
          shortDesc: p.shortSummary ?? "",
          description: p.whatMakesSpecial ?? "",
          whyWeChoseThis: p.whyWeChoose ?? "",
          amenities: p.amenities ?? [],
          mealPlan: p.mealPlan
            ? MEAL_PLANS.find((m) => m.id === p.mealPlan)?.label ?? p.mealPlan
            : current.mealPlan,
          leadImageUrl: lead,
          galleryUrls: gallery,
          propertyClass: p.propertyClass ?? undefined,
          suitability: p.suitability ?? [],
          checkInTime: p.checkInTime ?? undefined,
          checkOutTime: p.checkOutTime ?? undefined,
          totalRooms: p.totalRooms ?? undefined,
          spokenLanguages: p.spokenLanguages ?? [],
          specialInterests: p.specialInterests ?? [],
          funFactsVisible: p.funFactsVisible ?? true,
          rooms: (p.rooms ?? []).map(
            (r: { id: string; name: string; bedConfig?: string | null; description?: string | null; imageUrls?: string[] }) => ({
              id: r.id,
              name: r.name,
              bedConfig: r.bedConfig ?? "",
              description: r.description ?? "",
              imageUrls: r.imageUrls ?? [],
            }),
          ),
          customSections: (p.customSections ?? [])
            .filter((s: { visible?: boolean }) => s.visible !== false)
            .sort((a: { order?: number }, b: { order?: number }) => (a.order ?? 0) - (b.order ?? 0))
            .map((s: { id?: string; title: string; body?: string | null; order?: number }) => ({
              id: s.id,
              title: s.title,
              body: s.body ?? "",
              order: s.order ?? 0,
            })),
        };

        set((state) => {
          const target = state.proposal.properties.find((p) => p.id === propertyId);
          if (target) Object.assign(target, patch);
        });
        return true;
      } catch {
        return false;
      }
    },

    // ── Property rooms (STATS / ROOMS / INFORMATION tab content) ──────────

    addPropertyRoom: (propertyId) =>
      set((state) => {
        const p = state.proposal.properties.find((p) => p.id === propertyId);
        if (!p) return;
        if (!p.rooms) p.rooms = [];
        p.rooms.push({
          id: nanoid(),
          name: "New room type",
          bedConfig: "",
          description: "",
          imageUrls: [],
        });
      }),

    updatePropertyRoom: (propertyId, roomId, patch) =>
      set((state) => {
        const p = state.proposal.properties.find((p) => p.id === propertyId);
        if (!p?.rooms) return;
        const room = p.rooms.find((r) => r.id === roomId);
        if (room) Object.assign(room, patch);
      }),

    removePropertyRoom: (propertyId, roomId) =>
      set((state) => {
        const p = state.proposal.properties.find((p) => p.id === propertyId);
        if (!p?.rooms) return;
        p.rooms = p.rooms.filter((r) => r.id !== roomId);
      }),

    // ── Inclusions / Exclusions ───────────────────────────────────────────────

    updateInclusions: (list) =>
      set((state) => {
        state.proposal.inclusions = list;
      }),

    updateExclusions: (list) =>
      set((state) => {
        state.proposal.exclusions = list;
      }),

    // ── Practical Info ────────────────────────────────────────────────────────

    addPracticalCard: () =>
      set((state) => {
        state.proposal.practicalInfo.push({
          id: nanoid(),
          title: "New Topic",
          body: "",
          icon: "ℹ",
        });
      }),

    removePracticalCard: (id) =>
      set((state) => {
        state.proposal.practicalInfo = state.proposal.practicalInfo.filter(
          (c) => c.id !== id
        );
      }),

    updatePracticalCard: (id, patch) =>
      set((state) => {
        const c = state.proposal.practicalInfo.find((c) => c.id === id);
        if (c) Object.assign(c, patch);
      }),
  }))
);
