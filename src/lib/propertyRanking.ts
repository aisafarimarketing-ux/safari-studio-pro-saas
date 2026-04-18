// Property ranking — operator-grounded, deterministic, never inventive.
//
// Inputs: the org's library (already-loaded properties) + Brand DNA signals.
// Output: a scored, sorted list. Library-only — we never recommend a camp
// that isn't in the org's data. If Brand DNA is empty, scoring is neutral
// and the order falls back to most-recently-edited (stable + sensible).
//
// Used by:
//   - POST /api/properties/rank — for the editor's "Smart sort" picker
//   - (future) AI generation — to pick which camps to seed into a day card

import type {
  BrandDNAProfile,
  BrandDNAPropertyPreference,
  Property,
} from "@prisma/client";

// ─── Types ──────────────────────────────────────────────────────────────────

// What the ranker actually needs from a property row. Includes the joined
// data we expect callers to pre-load. Anything `undefined` is treated as
// "absent" rather than failing.
export type RankableProperty = Property & {
  images?: { id: string; url: string; isCover: boolean }[];
  tags?: { tag: { id: string; name: string } }[];
  location?: { id: string; name: string; country: string | null } | null;
};

export type RankedProperty = {
  property: RankableProperty;
  score: number;
  matchedSignals: string[];
};

export interface RankingFilters {
  locationId?: string | null;
  propertyClass?: string | null;
  tagIds?: string[];          // OR-match: at least one tag must overlap
  excludeArchived?: boolean;  // default true
}

export interface RankingContext {
  brandDNA?: Pick<BrandDNAProfile, "tierBias" | "styleBias"> | null;
  propertyPreferences?: Pick<BrandDNAPropertyPreference, "kind" | "propertyName" | "location">[];
}

// ─── Scoring weights ────────────────────────────────────────────────────────

const SCORE = {
  PREFERRED: 50,        // Brand DNA preferred property name match
  AVOIDED: -1000,       // → eliminated post-sort
  TIER_BIAS_MAX: 20,    // multiplied by tier→class affinity (0–1)
  STYLE_BIAS_MATCH: 15, // per overlapping styleBias / suitability hit
  HAS_COVER: 5,
  HAS_DESCRIPTION: 3,
  HAS_AMENITIES: 2,
};

// Tier-bias × property-class affinity. Numbers are 0–1 multipliers applied
// to TIER_BIAS_MAX. A "luxury-first" operator scores lodges/villas highest;
// a "value-first" operator gets the opposite shape.
const TIER_CLASS_AFFINITY: Record<string, Record<string, number>> = {
  luxury: {
    villa: 1.0, boutique_hotel: 1.0, lodge: 0.9, tented_camp: 0.7,
    treehouse: 0.7, camp: 0.5, mobile_camp: 0.5, houseboat: 0.6, other: 0.3,
  },
  mid_range: {
    camp: 1.0, tented_camp: 1.0, lodge: 0.8, mobile_camp: 0.8,
    boutique_hotel: 0.6, villa: 0.5, treehouse: 0.6, houseboat: 0.6, other: 0.5,
  },
  value: {
    camp: 1.0, tented_camp: 0.9, mobile_camp: 0.8, lodge: 0.4,
    boutique_hotel: 0.3, villa: 0.2, houseboat: 0.4, treehouse: 0.5, other: 0.5,
  },
};

// ─── Public ─────────────────────────────────────────────────────────────────

export function rankProperties(
  properties: RankableProperty[],
  filters: RankingFilters,
  context: RankingContext = {},
): RankedProperty[] {
  const filtered = applyFilters(properties, filters);
  return filtered
    .map((p) => scoreProperty(p, context))
    // Drop avoided properties entirely.
    .filter((r) => r.score > -500)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      // Deterministic neutral tiebreak: most recently edited first.
      return b.property.updatedAt.getTime() - a.property.updatedAt.getTime();
    });
}

// ─── Filtering ──────────────────────────────────────────────────────────────

function applyFilters(
  properties: RankableProperty[],
  filters: RankingFilters,
): RankableProperty[] {
  const excludeArchived = filters.excludeArchived !== false;
  return properties.filter((p) => {
    if (excludeArchived && p.archived) return false;
    if (filters.locationId && p.locationId !== filters.locationId) return false;
    if (filters.propertyClass && p.propertyClass !== filters.propertyClass) return false;
    if (filters.tagIds && filters.tagIds.length > 0) {
      const propertyTagIds = (p.tags ?? []).map((t) => t.tag.id);
      const hasAny = filters.tagIds.some((id) => propertyTagIds.includes(id));
      if (!hasAny) return false;
    }
    return true;
  });
}

// ─── Per-property scoring ───────────────────────────────────────────────────

function scoreProperty(p: RankableProperty, ctx: RankingContext): RankedProperty {
  let score = 0;
  const signals: string[] = [];

  // Brand DNA explicit preferences — the strongest signal.
  // Match by case-insensitive name; if a location is set on the preference,
  // it must also match the property's location name (or country fallback).
  const prefs = ctx.propertyPreferences ?? [];
  const propName = p.name.toLowerCase().trim();
  const propLoc = p.location?.name.toLowerCase().trim() ?? "";

  for (const pref of prefs) {
    if (pref.propertyName.toLowerCase().trim() !== propName) continue;
    if (pref.location && pref.location.toLowerCase().trim() !== propLoc) continue;
    if (pref.kind === "preferred") {
      score += SCORE.PREFERRED;
      signals.push("preferred");
    } else if (pref.kind === "avoided") {
      score += SCORE.AVOIDED;
      signals.push("avoided");
      // Short-circuit — the avoided score will filter this row out anyway,
      // but we don't need to compute additional signals.
      return { property: p, score, matchedSignals: signals };
    }
  }

  // Tier bias × property class
  const tierBias = ctx.brandDNA?.tierBias;
  if (tierBias && p.propertyClass) {
    const affinity = TIER_CLASS_AFFINITY[tierBias]?.[p.propertyClass];
    if (typeof affinity === "number" && affinity > 0) {
      const tierScore = SCORE.TIER_BIAS_MAX * affinity;
      score += tierScore;
      if (affinity >= 0.7) signals.push(`${tierBias} tier`);
    }
  }

  // Style bias overlap with property suitability
  const styleBias = ctx.brandDNA?.styleBias ?? [];
  for (const style of styleBias) {
    if (p.suitability.includes(style)) {
      score += SCORE.STYLE_BIAS_MATCH;
      signals.push(style.replace(/_/g, " "));
    }
  }

  // Quality signals — small nudges so well-filled-in properties surface.
  if ((p.images ?? []).some((i) => i.isCover)) score += SCORE.HAS_COVER;
  if (p.shortSummary?.trim()) score += SCORE.HAS_DESCRIPTION;
  if (p.amenities.length > 0) score += SCORE.HAS_AMENITIES;

  return { property: p, score, matchedSignals: signals };
}
