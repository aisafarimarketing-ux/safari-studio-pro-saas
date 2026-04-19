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
      default:
        return section;
    }
  });

  return next;
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
