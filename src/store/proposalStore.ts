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
} from "@/lib/types";
import { buildDefaultProposal, buildBlankProposal, migrateLoadedProposal } from "@/lib/defaults";
import { COLOR_PRESETS } from "@/lib/theme";
import { SECTION_REGISTRY } from "@/lib/sectionRegistry";
import { nanoid } from "@/lib/nanoid";

interface ProposalState {
  proposal: Proposal;

  // ── Proposal-level ──────────────────────────────────────────────────────────
  loadTemplate: (id: string) => void;
  loadBlank: () => void;
  createFromQuickStart: (form: QuickStartForm) => void;
  hydrateProposal: (proposal: Proposal) => void;
  updateMetadata: (title: string) => void;
  updateClient: (patch: Partial<Proposal["client"]>) => void;
  updateOperator: (patch: Partial<Proposal["operator"]>) => void;
  updateTrip: (patch: Partial<Proposal["trip"]>) => void;

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

  // ── Inclusions / Exclusions ─────────────────────────────────────────────────
  updateInclusions: (list: string[]) => void;
  updateExclusions: (list: string[]) => void;

  // ── Practical Info ──────────────────────────────────────────────────────────
  addPracticalCard: () => void;
  removePracticalCard: (id: string) => void;
  updatePracticalCard: (id: string, patch: Partial<PracticalCard>) => void;
}

export const useProposalStore = create<ProposalState>()(
  immer((set) => ({
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

    addDay: () =>
      set((state) => {
        const n = state.proposal.days.length + 1;
        state.proposal.days.push({
          id: nanoid(),
          dayNumber: n,
          destination: "New Destination",
          country: "Kenya",
          description: "Describe this day...",
          board: "Full board",
          tiers: {
            classic: { camp: "Camp Name", location: "Location", note: "" },
            premier: { camp: "Camp Name", location: "Location", note: "" },
            signature: { camp: "Camp Name", location: "Location", note: "" },
          },
        });
      }),

    addDayAfter: (id) =>
      set((state) => {
        const idx = state.proposal.days.findIndex((d) => d.id === id);
        const newDay: Day = {
          id: nanoid(),
          dayNumber: idx + 2,
          destination: "New Destination",
          country: "Kenya",
          description: "Describe this day...",
          board: "Full board",
          tiers: {
            classic: { camp: "Camp Name", location: "Location", note: "" },
            premier: { camp: "Camp Name", location: "Location", note: "" },
            signature: { camp: "Camp Name", location: "Location", note: "" },
          },
        };
        state.proposal.days.splice(idx + 1, 0, newDay);
        state.proposal.days.forEach((d, i) => {
          d.dayNumber = i + 1;
        });
      }),

    removeDay: (id) =>
      set((state) => {
        state.proposal.days = state.proposal.days.filter((d) => d.id !== id);
        state.proposal.days.forEach((d, i) => {
          d.dayNumber = i + 1;
        });
      }),

    duplicateDay: (id) =>
      set((state) => {
        const idx = state.proposal.days.findIndex((d) => d.id === id);
        if (idx === -1) return;
        const orig = state.proposal.days[idx];
        state.proposal.days.splice(idx + 1, 0, { ...orig, id: nanoid() });
        state.proposal.days.forEach((d, i) => {
          d.dayNumber = i + 1;
        });
      }),

    moveDay: (fromIndex, toIndex) =>
      set((state) => {
        const days = state.proposal.days;
        const [moved] = days.splice(fromIndex, 1);
        days.splice(toIndex, 0, moved);
        days.forEach((d, i) => {
          d.dayNumber = i + 1;
        });
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
        if (p) Object.assign(p, patch);
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
