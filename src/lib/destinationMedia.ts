// Destination Visual Intelligence — image selection with strict provenance.
//
// Selection priority (high → low):
//   1. Property images   — when a property is in scope
//   2. Org-owned assets  — the operator's curated destination library
//   3. Global assets     — the seeded "best of East Africa" baseline
//
// The score function applies AFTER source priority — i.e. an org asset
// with a low score still ranks above a global asset with a high score.
// This is the explicit "your library first" promise.
//
// Pure: no DB. Used by /api/media to score loaded rows, and (later) by
// the AI generation pipeline to pick a single image for a day card.

import type { DestinationMediaAsset } from "@prisma/client";

// ─── Types ──────────────────────────────────────────────────────────────────

export type MediaSource = "property" | "org" | "global";

export type MediaCandidate = {
  url: string;
  thumbnailUrl?: string | null;
  caption?: string | null;
  source: MediaSource;
  attribution?: string | null;
  width?: number | null;
  height?: number | null;
  // For debugging / UI — explains why this image surfaced.
  matchedSignals: string[];
  score: number;
  // The underlying record, when source !== "property".
  assetId?: string;
  // The underlying property image id, when source === "property".
  propertyImageId?: string;
};

export interface SelectionContext {
  locationName?: string | null;
  animalType?: string | null;
  experienceType?: string | null;
  tags?: string[];
  category?: string | null;
}

// ─── Source-priority weights ────────────────────────────────────────────────
//
// Big numbers so a property image always beats an org asset, and an org
// asset always beats a global one — even if the global has every tag set
// and the org image has no metadata at all.

const SOURCE_BASE: Record<MediaSource, number> = {
  property: 10000,
  org: 1000,
  global: 0,
};

// ─── Match scoring (within a source tier) ──────────────────────────────────

const SCORE = {
  LOCATION_EXACT: 50,
  LOCATION_PARTIAL: 25,
  ANIMAL_TYPE: 30,
  EXPERIENCE_TYPE: 20,
  CATEGORY: 15,
  TAG_OVERLAP_PER_HIT: 10,
};

function eq(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function partial(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const aL = a.trim().toLowerCase();
  const bL = b.trim().toLowerCase();
  return aL.includes(bL) || bL.includes(aL);
}

function scoreAgainstContext(
  asset: Pick<DestinationMediaAsset, "locationName" | "animalType" | "experienceType" | "category" | "tags" | "priorityScore">,
  ctx: SelectionContext,
): { score: number; signals: string[] } {
  let score = asset.priorityScore;
  const signals: string[] = [];

  if (ctx.locationName && asset.locationName) {
    if (eq(asset.locationName, ctx.locationName)) {
      score += SCORE.LOCATION_EXACT;
      signals.push(asset.locationName);
    } else if (partial(asset.locationName, ctx.locationName)) {
      score += SCORE.LOCATION_PARTIAL;
      signals.push(asset.locationName);
    }
  }

  if (ctx.animalType && asset.animalType && eq(asset.animalType, ctx.animalType)) {
    score += SCORE.ANIMAL_TYPE;
    signals.push(asset.animalType);
  }

  if (ctx.experienceType && asset.experienceType && eq(asset.experienceType, ctx.experienceType)) {
    score += SCORE.EXPERIENCE_TYPE;
    signals.push(asset.experienceType.replace(/_/g, " "));
  }

  if (ctx.category && asset.category && eq(asset.category, ctx.category)) {
    score += SCORE.CATEGORY;
  }

  if (ctx.tags && ctx.tags.length > 0) {
    const overlap = ctx.tags.filter((t) => asset.tags.includes(t));
    score += overlap.length * SCORE.TAG_OVERLAP_PER_HIT;
    signals.push(...overlap);
  }

  return { score, signals: dedupe(signals) };
}

function dedupe<T>(arr: T[]): T[] { return Array.from(new Set(arr)); }

// ─── Public ─────────────────────────────────────────────────────────────────

export interface RankAssetsInput {
  orgId: string;
  assets: DestinationMediaAsset[];
  context: SelectionContext;
  // Optional property images that should sit at the very top regardless.
  propertyImages?: { id: string; url: string; caption: string | null; isCover: boolean }[];
}

export function rankMediaCandidates(input: RankAssetsInput): MediaCandidate[] {
  const out: MediaCandidate[] = [];

  // 1. Property images — top priority. Cover image first.
  if (input.propertyImages && input.propertyImages.length > 0) {
    const sorted = [...input.propertyImages].sort(
      (a, b) => Number(b.isCover) - Number(a.isCover),
    );
    for (const img of sorted) {
      out.push({
        url: img.url,
        caption: img.caption,
        source: "property",
        score: SOURCE_BASE.property + (img.isCover ? 5 : 0),
        matchedSignals: img.isCover ? ["cover"] : [],
        propertyImageId: img.id,
      });
    }
  }

  // 2/3. Destination assets — score within their source tier.
  for (const asset of input.assets) {
    const source: MediaSource = asset.organizationId === input.orgId ? "org" : "global";
    const { score, signals } = scoreAgainstContext(asset, input.context);
    out.push({
      url: asset.imageUrl,
      thumbnailUrl: asset.thumbnailUrl,
      caption: asset.locationName,
      source,
      attribution: asset.attributionText,
      width: asset.width,
      height: asset.height,
      assetId: asset.id,
      score: SOURCE_BASE[source] + score,
      matchedSignals: signals,
    });
  }

  return out.sort((a, b) => b.score - a.score);
}
