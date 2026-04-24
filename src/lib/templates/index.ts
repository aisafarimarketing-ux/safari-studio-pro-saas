import type { Template } from "./types";
import { KENYA_7_DAY_CLASSIC } from "./kenya-7-day-classic";

// ─── Template registry ─────────────────────────────────────────────────────
//
// Templates are loaded from this array by the public gallery (/templates)
// and the individual template pages (/templates/[slug]). Adding a new
// template is a one-line import + one array entry.
//
// Order here determines the gallery card order. Flagship / canonical
// shapes should come first.

export const TEMPLATES: Template[] = [
  KENYA_7_DAY_CLASSIC,
];

export function getTemplateBySlug(slug: string): Template | null {
  return TEMPLATES.find((t) => t.slug === slug) ?? null;
}

export function listTemplates(): Template[] {
  return TEMPLATES;
}

export type { Template };
export { buildProposalFromTemplate } from "./buildProposal";
