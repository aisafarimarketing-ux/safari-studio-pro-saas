// Brand DNA — completion scoring + shared shapes.
//
// Completion is purely derived — never stored. Sections are weighted so that
// the %age reflects what actually moves the needle on proposal quality:
// Voice & Tone carries the most weight because it changes AI output directly,
// and Property Preferences is a close second because it drives selection
// ranking. Missing sections are never punished — they just don't contribute.

import type { BrandDNAProfile, BrandDNAPropertyPreference } from "@prisma/client";

// ─── Enumerations (kept as `as const` tuples so UI + backend agree) ─────────

export const IMAGE_STYLES = [
  { id: "wildlife_closeup", label: "Wildlife close-ups" },
  { id: "landscape", label: "Landscapes" },
  { id: "lodge_interior", label: "Lodge interiors" },
  { id: "guest_experience", label: "Guest experiences" },
  { id: "beach", label: "Beach" },
  { id: "cultural", label: "Cultural" },
  { id: "aerial", label: "Aerial / drone" },
  { id: "black_and_white", label: "Black & white" },
] as const;

export const TIER_BIAS = [
  { id: "luxury", label: "Luxury-first" },
  { id: "mid_range", label: "Mid-range" },
  { id: "value", label: "Value-first" },
] as const;

export const STYLE_BIAS = [
  { id: "honeymoon", label: "Honeymoon" },
  { id: "family", label: "Family" },
  { id: "adventure", label: "Adventure" },
  { id: "eco_luxury", label: "Eco-luxury" },
  { id: "photography", label: "Photography" },
  { id: "cultural", label: "Cultural" },
] as const;

export const VOICE_AXES = [
  {
    key: "voiceFormality",
    left: "Formal",
    right: "Conversational",
  },
  {
    key: "voiceLuxury",
    left: "Luxury",
    right: "Adventurous",
  },
  {
    key: "voiceDensity",
    left: "Concise",
    right: "Detailed",
  },
  {
    key: "voiceStorytelling",
    left: "Storytelling",
    right: "Informational",
  },
] as const;

export type VoiceAxisKey = (typeof VOICE_AXES)[number]["key"];

// ─── Shared Value Types ─────────────────────────────────────────────────────

import type { ProposalTheme, ThemeTokens } from "@/lib/types";

export type BrandColor = { hex: string; role?: string };
export type BrandImage = { url: string; caption?: string; tags?: string[] };

// ─── Brand defaults → proposal theme ────────────────────────────────────
//
// Apply the org's Brand DNA visual settings (brandColors, headingFont,
// bodyFont) onto a proposal's theme tokens at clone time. Operator
// brief: "the app will use these every time when generating proposal
// to color sections, and fonts for that section." Fill-gap semantics
// — only seeds when the theme field hasn't already been set by the
// template; never overwrites operator customisation.

export interface BrandVisualDefaults {
  brandColors: BrandColor[] | null;
  headingFont: string | null;
  bodyFont: string | null;
}

/** Pick a colour from the brandColors array by role, falling back to
 *  positional order when role isn't tagged. */
function pickBrandColor(
  colors: BrandColor[] | null,
  role: string,
  fallbackIndex: number,
): string | null {
  if (!colors || colors.length === 0) return null;
  const byRole = colors.find((c) => c.role?.toLowerCase() === role);
  if (byRole?.hex) return byRole.hex;
  return colors[fallbackIndex]?.hex ?? null;
}

/** Returns a NEW ProposalTheme with brand defaults applied. Fill-gap
 *  semantics — only seeds when the input field is empty / null. */
export function applyBrandDefaultsToTheme(
  theme: ProposalTheme,
  defaults: BrandVisualDefaults,
): ProposalTheme {
  const accent = pickBrandColor(defaults.brandColors, "primary", 0);
  const secondary = pickBrandColor(defaults.brandColors, "secondary", 1);
  const tokens: ThemeTokens = { ...theme.tokens };
  if (accent) tokens.accent = accent;
  if (secondary) tokens.secondaryAccent = secondary;
  return {
    ...theme,
    displayFont: defaults.headingFont || theme.displayFont,
    bodyFont: defaults.bodyFont || theme.bodyFont,
    tokens,
  };
}

// ─── Completion ─────────────────────────────────────────────────────────────

export type SectionKey =
  | "brandCore"
  | "voiceTone"
  | "visualStyle"
  | "propertyPreferences"
  | "aiInstructions";

export interface SectionScore {
  key: SectionKey;
  label: string;
  weight: number;       // integer, sums to 100 across sections
  filled: number;       // 0..filledOf
  filledOf: number;
  percent: number;      // filled / filledOf * 100
  weightedPercent: number; // percent * weight / 100 → contribution to overall
}

export interface BrandDNACompletion {
  overall: number;                // 0..100 integer
  sections: SectionScore[];
  nextBestAction: NextBestAction | null;
}

export interface NextBestAction {
  sectionKey: SectionKey;
  sectionLabel: string;
  headline: string;      // short CTA headline, e.g. "Add your voice"
  rationale: string;     // one-sentence why-it-matters
}

type ProfileLike =
  | (Pick<
      BrandDNAProfile,
      | "brandName"
      | "logoUrl"
      | "websiteUrl"
      | "tagline"
      | "shortDescription"
      | "voiceFormality"
      | "voiceLuxury"
      | "voiceDensity"
      | "voiceStorytelling"
      | "writingSample1"
      | "writingSample2"
      | "brandColors"
      | "headingFont"
      | "bodyFont"
      | "preferredImageStyles"
      | "imageLibrary"
      | "tierBias"
      | "styleBias"
      | "aiInstructions"
    > & Record<string, unknown>)
  | null
  | undefined;

function nonEmptyString(v: unknown): boolean {
  return typeof v === "string" && v.trim().length > 0;
}
function nonEmptyArray(v: unknown): boolean {
  return Array.isArray(v) && v.length > 0;
}
function isSet(v: unknown): boolean {
  return v !== null && v !== undefined;
}

export function computeBrandDNACompletion(
  profile: ProfileLike,
  propertyPrefs: Pick<BrandDNAPropertyPreference, "id">[] = [],
): BrandDNACompletion {
  const p = profile ?? null;

  const brandCore = [
    nonEmptyString(p?.brandName),
    nonEmptyString(p?.logoUrl),
    nonEmptyString(p?.websiteUrl),
    nonEmptyString(p?.tagline),
    nonEmptyString(p?.shortDescription),
  ];

  const voiceTone = [
    isSet(p?.voiceFormality),
    isSet(p?.voiceLuxury),
    isSet(p?.voiceDensity),
    isSet(p?.voiceStorytelling),
    nonEmptyString(p?.writingSample1),
    nonEmptyString(p?.writingSample2),
  ];

  const visualStyle = [
    nonEmptyArray(p?.brandColors),
    nonEmptyString(p?.headingFont),
    nonEmptyString(p?.bodyFont),
    nonEmptyArray(p?.preferredImageStyles),
    nonEmptyArray(p?.imageLibrary),
  ];

  const propertyPreferences = [
    nonEmptyString(p?.tierBias),
    nonEmptyArray(p?.styleBias),
    propertyPrefs.length > 0,
  ];

  const aiInstructions = [nonEmptyString(p?.aiInstructions)];

  const sections: SectionScore[] = [
    makeSection("brandCore", "Brand Core", 15, brandCore),
    makeSection("voiceTone", "Voice & Tone", 30, voiceTone),
    makeSection("visualStyle", "Visual Style", 15, visualStyle),
    makeSection("propertyPreferences", "Property Preferences", 25, propertyPreferences),
    makeSection("aiInstructions", "AI Instructions", 15, aiInstructions),
  ];

  const overall = Math.round(
    sections.reduce((sum, s) => sum + s.weightedPercent, 0),
  );

  return { overall, sections, nextBestAction: nextAction(sections) };
}

function makeSection(
  key: SectionKey,
  label: string,
  weight: number,
  checks: boolean[],
): SectionScore {
  const filled = checks.filter(Boolean).length;
  const filledOf = checks.length;
  const percent = filledOf === 0 ? 0 : (filled / filledOf) * 100;
  const weightedPercent = (percent * weight) / 100;
  return { key, label, weight, filled, filledOf, percent, weightedPercent };
}

// ─── Next best action ───────────────────────────────────────────────────────
//
// Rank incomplete sections by "leverage" (remaining weight × importance).
// Voice & Tone is the biggest proposal-quality lever so it's prioritised
// when partially set; Property Preferences comes next.

const SECTION_HEADLINES: Record<
  SectionKey,
  { headline: string; rationale: string }
> = {
  voiceTone: {
    headline: "Add your brand voice",
    rationale:
      "Four sliders and two writing samples teach the AI how you sound — the single biggest lever on proposal quality.",
  },
  propertyPreferences: {
    headline: "Set your property preferences",
    rationale:
      "Tell us which camps and lodges you love (or avoid). We'll rank selections around your taste instead of guessing.",
  },
  brandCore: {
    headline: "Complete your brand basics",
    rationale:
      "Logo, tagline, and description anchor every proposal. It takes a minute.",
  },
  visualStyle: {
    headline: "Define your visual style",
    rationale:
      "Colours, fonts, and preferred photography styles keep proposals on-brand at a glance.",
  },
  aiInstructions: {
    headline: "Add AI guardrails",
    rationale:
      "Things like \"never suggest budget camps\" or \"always offer an upgrade\" — short rules that keep every draft on-policy.",
  },
};

function nextAction(sections: SectionScore[]): NextBestAction | null {
  // Highest remaining leverage = (100 - percent) × weight / 100
  const ranked = sections
    .map((s) => ({
      ...s,
      leverage: ((100 - s.percent) * s.weight) / 100,
    }))
    .filter((s) => s.leverage > 0.01)
    .sort((a, b) => b.leverage - a.leverage);

  const top = ranked[0];
  if (!top) return null;
  const copy = SECTION_HEADLINES[top.key];
  return {
    sectionKey: top.key,
    sectionLabel: top.label,
    headline: copy.headline,
    rationale: copy.rationale,
  };
}

// ─── Curated font list ──────────────────────────────────────────────────────
//
// Hand-picked Google Fonts that pair well for travel/luxury proposals.
// Users can also supply a custom .woff/.woff2 URL.

export const CURATED_FONTS: { name: string; family: "serif" | "sans" | "display"; css: string }[] = [
  // Serifs (editorial, luxury)
  { name: "Playfair Display", family: "serif", css: "'Playfair Display', Georgia, serif" },
  { name: "Cormorant", family: "serif", css: "'Cormorant', Georgia, serif" },
  { name: "Cormorant Garamond", family: "serif", css: "'Cormorant Garamond', Georgia, serif" },
  { name: "Libre Caslon Text", family: "serif", css: "'Libre Caslon Text', Georgia, serif" },
  { name: "EB Garamond", family: "serif", css: "'EB Garamond', Georgia, serif" },
  { name: "Lora", family: "serif", css: "'Lora', Georgia, serif" },
  { name: "Libre Baskerville", family: "serif", css: "'Libre Baskerville', Georgia, serif" },
  { name: "DM Serif Display", family: "display", css: "'DM Serif Display', Georgia, serif" },
  { name: "Marcellus", family: "serif", css: "'Marcellus', Georgia, serif" },
  { name: "Cardo", family: "serif", css: "'Cardo', Georgia, serif" },
  { name: "Spectral", family: "serif", css: "'Spectral', Georgia, serif" },
  // Sans (modern, clean)
  { name: "Inter", family: "sans", css: "'Inter', system-ui, sans-serif" },
  { name: "Manrope", family: "sans", css: "'Manrope', system-ui, sans-serif" },
  { name: "DM Sans", family: "sans", css: "'DM Sans', system-ui, sans-serif" },
  { name: "Work Sans", family: "sans", css: "'Work Sans', system-ui, sans-serif" },
  { name: "Jost", family: "sans", css: "'Jost', system-ui, sans-serif" },
  { name: "Outfit", family: "sans", css: "'Outfit', system-ui, sans-serif" },
  { name: "Nunito Sans", family: "sans", css: "'Nunito Sans', system-ui, sans-serif" },
  { name: "Source Sans 3", family: "sans", css: "'Source Sans 3', system-ui, sans-serif" },
  { name: "Lato", family: "sans", css: "'Lato', system-ui, sans-serif" },
  { name: "Karla", family: "sans", css: "'Karla', system-ui, sans-serif" },
  { name: "Public Sans", family: "sans", css: "'Public Sans', system-ui, sans-serif" },
  // Display / signature-feel
  { name: "Fraunces", family: "display", css: "'Fraunces', Georgia, serif" },
  { name: "Italiana", family: "display", css: "'Italiana', Georgia, serif" },
  { name: "Cinzel", family: "display", css: "'Cinzel', Georgia, serif" },
];

export function googleFontsHref(names: string[]): string | null {
  const clean = Array.from(new Set(names.filter(Boolean)));
  if (clean.length === 0) return null;
  const families = clean
    .map((n) => `family=${encodeURIComponent(n)}:wght@300;400;500;600;700`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}
