import type { Template } from "./types";

// Flagship
import { KENYA_7_DAY_CLASSIC } from "./kenya-7-day-classic";

// Kenya
import { KENYA_5_DAY_EXPRESS } from "./kenya-5-day-express";
import { KENYA_7_DAY_BIG_FIVE } from "./kenya-7-day-big-five";
import { KENYA_10_DAY_EXPLORER } from "./kenya-10-day-explorer";
import { KENYA_10_DAY_AND_COAST } from "./kenya-10-day-and-coast";
import { KENYA_10_DAY_HONEYMOON } from "./kenya-10-day-honeymoon";
import { KENYA_10_DAY_FAMILY_SAFARI } from "./kenya-10-day-family-safari";
import { KENYA_12_DAY_SIGNATURE } from "./kenya-12-day-signature";
import { KENYA_14_DAY_GRAND } from "./kenya-14-day-grand";
import { KENYA_8_DAY_LUXURY_FLYING } from "./kenya-8-day-luxury-flying";

// Tanzania
import { TANZANIA_5_DAY_HIGHLIGHTS } from "./tanzania-5-day-highlights";
import { TANZANIA_7_DAY_NORTHERN_CIRCUIT } from "./tanzania-7-day-northern-circuit";
import { TANZANIA_7_DAY_SERENGETI_NGORONGORO } from "./tanzania-7-day-serengeti-ngorongoro";
import { TANZANIA_10_DAY_GREAT_MIGRATION } from "./tanzania-10-day-great-migration";
import { TANZANIA_10_DAY_AND_ZANZIBAR } from "./tanzania-10-day-and-zanzibar";
import { TANZANIA_10_DAY_HONEYMOON } from "./tanzania-10-day-honeymoon";
import { TANZANIA_10_DAY_FAMILY_SAFARI } from "./tanzania-10-day-family-safari";
import { TANZANIA_8_DAY_SOUTHERN } from "./tanzania-8-day-southern";
import { TANZANIA_12_DAY_SIGNATURE } from "./tanzania-12-day-signature";
import { TANZANIA_14_DAY_GRAND } from "./tanzania-14-day-grand";

// ─── Template registry ─────────────────────────────────────────────────────
//
// Templates are loaded from this array by the public gallery (/templates)
// and the individual template pages (/templates/[slug]).
//
// Order here determines gallery card order. Flagships first (highest
// search volume), then by duration within each country, then specialty.

export const TEMPLATES: Template[] = [
  // ── Kenya ──
  KENYA_7_DAY_CLASSIC,
  KENYA_5_DAY_EXPRESS,
  KENYA_7_DAY_BIG_FIVE,
  KENYA_10_DAY_EXPLORER,
  KENYA_10_DAY_AND_COAST,
  KENYA_10_DAY_HONEYMOON,
  KENYA_10_DAY_FAMILY_SAFARI,
  KENYA_12_DAY_SIGNATURE,
  KENYA_14_DAY_GRAND,
  KENYA_8_DAY_LUXURY_FLYING,

  // ── Tanzania ──
  TANZANIA_7_DAY_NORTHERN_CIRCUIT,
  TANZANIA_5_DAY_HIGHLIGHTS,
  TANZANIA_7_DAY_SERENGETI_NGORONGORO,
  TANZANIA_10_DAY_GREAT_MIGRATION,
  TANZANIA_10_DAY_AND_ZANZIBAR,
  TANZANIA_10_DAY_HONEYMOON,
  TANZANIA_10_DAY_FAMILY_SAFARI,
  TANZANIA_8_DAY_SOUTHERN,
  TANZANIA_12_DAY_SIGNATURE,
  TANZANIA_14_DAY_GRAND,
];

export function getTemplateBySlug(slug: string): Template | null {
  return TEMPLATES.find((t) => t.slug === slug) ?? null;
}

export function listTemplates(): Template[] {
  return TEMPLATES;
}

export type { Template };
export { buildProposalFromTemplate } from "./buildProposal";
