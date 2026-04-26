import type {
  Proposal,
  Day,
  PracticalCard,
  PricingData,
  TierPrice,
} from "@/lib/types";

// Shape returned by /api/ai/autopilot. Lives here so the client and server
// share one schema.
export type AutopilotResult = {
  cover?: { tagline?: string };
  greeting?: { body?: string };
  closing?: { quote?: string; signOff?: string };
  map?: { caption?: string };
  quote?: { quote?: string; attribution?: string };
  /** Destinations reordered into typical safari sequence — the cover and
   *  other sections render this list directly, so we persist the sorted
   *  order back into the proposal rather than just using it for drafting. */
  trip?: { destinations?: string[] };
  days?: Day[];
  inclusions?: string[];
  exclusions?: string[];
  practicalInfo?: PracticalCard[];
  pricing?: Partial<PricingData> & {
    classic?: Partial<TierPrice>;
    premier?: Partial<TierPrice>;
    signature?: Partial<TierPrice>;
    notes?: string;
  };
};

// Merge the autopilot result into a freshly-created proposal so every
// section carries personalised content. Non-destructive: if the AI didn't
// return something, we keep what's already there. Section content patches
// target the FIRST visible section of each type.

export function mergeAutopilotIntoProposal(
  proposal: Proposal,
  draft: AutopilotResult,
): Proposal {
  const next: Proposal = { ...proposal };

  // ── Proposal-level arrays ─────────────────────────────────────────────
  next.days = draft.days && draft.days.length > 0 ? draft.days : proposal.days;
  next.inclusions = draft.inclusions?.length ? draft.inclusions : proposal.inclusions;
  next.exclusions = draft.exclusions?.length ? draft.exclusions : proposal.exclusions;

  // ── Trip — replace destinations with the AI-routed order so the cover
  //    and other sections show stops in geographic safari sequence even
  //    if the operator typed them in any order at Trip Setup.
  if (draft.trip?.destinations && draft.trip.destinations.length > 0) {
    next.trip = { ...proposal.trip, destinations: draft.trip.destinations };
  }
  next.practicalInfo =
    draft.practicalInfo && draft.practicalInfo.length > 0
      ? draft.practicalInfo
      : proposal.practicalInfo;

  // ── Pricing ───────────────────────────────────────────────────────────
  if (draft.pricing) {
    next.pricing = {
      ...proposal.pricing,
      classic: mergeTier(proposal.pricing.classic, draft.pricing.classic),
      premier: mergeTier(proposal.pricing.premier, draft.pricing.premier),
      signature: mergeTier(proposal.pricing.signature, draft.pricing.signature),
      notes: draft.pricing.notes ?? proposal.pricing.notes,
    };
  }

  // ── Section content patches (cover / greeting / closing / map) ────────
  next.sections = proposal.sections.map((section) => {
    switch (section.type) {
      case "cover":
        if (!draft.cover?.tagline) return section;
        return {
          ...section,
          content: { ...section.content, tagline: draft.cover.tagline },
        };
      case "greeting":
        if (!draft.greeting?.body) return section;
        return {
          ...section,
          content: { ...section.content, body: draft.greeting.body },
        };
      case "closing": {
        if (!draft.closing?.quote && !draft.closing?.signOff) return section;
        const content = { ...section.content };
        if (draft.closing?.quote) content.quote = draft.closing.quote;
        if (draft.closing?.signOff) content.signOff = draft.closing.signOff;
        return { ...section, content };
      }
      case "map":
        if (!draft.map?.caption) return section;
        return {
          ...section,
          content: { ...section.content, caption: draft.map.caption },
        };
      case "quote": {
        if (!draft.quote?.quote && !draft.quote?.attribution) return section;
        const content = { ...section.content };
        if (draft.quote?.quote) content.quote = draft.quote.quote;
        if (draft.quote?.attribution) content.attribution = draft.quote.attribution;
        return { ...section, content };
      }
      default:
        return section;
    }
  });

  return next;
}

// Additive merge — used by the "Added info / days" button in the Trip
// panel. Strictly non-destructive against the existing proposal: any
// day, section copy, inclusion list, pricing tier, or practical-info
// card the operator has already touched is preserved. New autopilot
// content is *only* allowed to fill in slots that are genuinely empty
// or to extend the trip beyond its current length.
//
//   • Days — keeps existing days untouched; appends generated days
//            past `existingDayCount` (when the operator extended the
//            trip's nights).
//   • Inclusions / Exclusions / PracticalInfo — only filled when the
//            existing list is empty.
//   • Pricing — each tier's price is only filled when currently blank.
//   • Sections — text copy (cover tagline, greeting body, closing
//            quote/sign-off, map caption, pull quote) is only filled
//            when the existing content slot is empty.
//
// For destructive overwrites the operator should hit "Regenerate all".

export function mergeAutopilotAdditive(
  proposal: Proposal,
  draft: AutopilotResult,
  existingDayCount: number,
): Proposal {
  const next: Proposal = { ...proposal };

  // Days — append only the tail (anything past the existing count).
  if (draft.days && draft.days.length > existingDayCount) {
    next.days = [...proposal.days, ...draft.days.slice(existingDayCount)];
  } else {
    next.days = proposal.days;
  }

  // Lists — fill only when empty.
  next.inclusions = proposal.inclusions.length
    ? proposal.inclusions
    : draft.inclusions ?? [];
  next.exclusions = proposal.exclusions.length
    ? proposal.exclusions
    : draft.exclusions ?? [];
  next.practicalInfo = proposal.practicalInfo.length
    ? proposal.practicalInfo
    : draft.practicalInfo ?? [];

  // Pricing — per-tier, fill only the empty fields. Leaves operator
  // overrides intact.
  if (draft.pricing) {
    next.pricing = {
      ...proposal.pricing,
      classic: fillEmptyTier(proposal.pricing.classic, draft.pricing.classic),
      premier: fillEmptyTier(proposal.pricing.premier, draft.pricing.premier),
      signature: fillEmptyTier(proposal.pricing.signature, draft.pricing.signature),
      notes: proposal.pricing.notes || draft.pricing.notes || "",
    };
  }

  // Trip — keep operator's destination order. Only adopt AI's reorder
  // if the operator's list is empty.
  if (
    proposal.trip.destinations.length === 0 &&
    draft.trip?.destinations &&
    draft.trip.destinations.length > 0
  ) {
    next.trip = { ...proposal.trip, destinations: draft.trip.destinations };
  }

  // Sections — fill blank text slots only; preserve all other content.
  next.sections = proposal.sections.map((section) => {
    switch (section.type) {
      case "cover": {
        const tagline = (section.content.tagline as string | undefined) ?? "";
        if (tagline.trim() || !draft.cover?.tagline) return section;
        return {
          ...section,
          content: { ...section.content, tagline: draft.cover.tagline },
        };
      }
      case "greeting": {
        const body = (section.content.body as string | undefined) ?? "";
        if (body.trim() || !draft.greeting?.body) return section;
        return {
          ...section,
          content: { ...section.content, body: draft.greeting.body },
        };
      }
      case "closing": {
        const content = { ...section.content };
        const quote = (content.quote as string | undefined) ?? "";
        const signOff = (content.signOff as string | undefined) ?? "";
        let touched = false;
        if (!quote.trim() && draft.closing?.quote) {
          content.quote = draft.closing.quote;
          touched = true;
        }
        if (!signOff.trim() && draft.closing?.signOff) {
          content.signOff = draft.closing.signOff;
          touched = true;
        }
        return touched ? { ...section, content } : section;
      }
      case "map": {
        const caption = (section.content.caption as string | undefined) ?? "";
        if (caption.trim() || !draft.map?.caption) return section;
        return {
          ...section,
          content: { ...section.content, caption: draft.map.caption },
        };
      }
      case "quote": {
        const content = { ...section.content };
        const q = (content.quote as string | undefined) ?? "";
        const attr = (content.attribution as string | undefined) ?? "";
        let touched = false;
        if (!q.trim() && draft.quote?.quote) {
          content.quote = draft.quote.quote;
          touched = true;
        }
        if (!attr.trim() && draft.quote?.attribution) {
          content.attribution = draft.quote.attribution;
          touched = true;
        }
        return touched ? { ...section, content } : section;
      }
      default:
        return section;
    }
  });

  return next;
}

function fillEmptyTier(existing: TierPrice, patch?: Partial<TierPrice>): TierPrice {
  if (!patch) return existing;
  return {
    label: existing.label?.trim() ? existing.label : patch.label ?? existing.label,
    pricePerPerson: existing.pricePerPerson?.trim()
      ? existing.pricePerPerson
      : patch.pricePerPerson ?? existing.pricePerPerson,
    currency: existing.currency?.trim()
      ? existing.currency
      : patch.currency ?? existing.currency,
    highlighted: existing.highlighted, // never auto-flip operator's choice
  };
}

function mergeTier(existing: TierPrice, patch?: Partial<TierPrice>): TierPrice {
  if (!patch) return existing;
  return {
    label: patch.label ?? existing.label,
    pricePerPerson: patch.pricePerPerson ?? existing.pricePerPerson,
    currency: patch.currency ?? existing.currency,
    highlighted:
      typeof patch.highlighted === "boolean" ? patch.highlighted : existing.highlighted,
  };
}
