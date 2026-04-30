// Client-side types mirror the server-side BrandDNAProfile. We use our own
// type so we don't leak DB-only fields (ids, timestamps) into the form state.

import type { BrandColor, BrandImage, BrandSectionStyles } from "@/lib/brandDNA";

export interface BrandDNAForm {
  // Brand Core
  brandName: string;
  logoUrl: string;
  websiteUrl: string;
  tagline: string;
  shortDescription: string;

  // Voice & Tone
  voiceFormality: number | null;
  voiceLuxury: number | null;
  voiceDensity: number | null;
  voiceStorytelling: number | null;
  writingSample1: string;
  writingSample2: string;

  // Visual Style
  brandColors: BrandColor[];
  headingFont: string;
  bodyFont: string;
  customFontUrl: string;
  preferredImageStyles: string[];
  imageLibrary: BrandImage[];
  // Per-section style overrides — keyed by SectionType.
  sectionStyles: BrandSectionStyles;

  // Property Preferences
  tierBias: string;
  styleBias: string[];

  // AI Instructions
  aiInstructions: string;
}

export interface PropertyPrefRow {
  id: string;
  kind: "preferred" | "avoided";
  location: string | null;
  propertyName: string;
  notes: string | null;
}

export const EMPTY_FORM: BrandDNAForm = {
  brandName: "",
  logoUrl: "",
  websiteUrl: "",
  tagline: "",
  shortDescription: "",
  voiceFormality: null,
  voiceLuxury: null,
  voiceDensity: null,
  voiceStorytelling: null,
  writingSample1: "",
  writingSample2: "",
  brandColors: [],
  headingFont: "",
  bodyFont: "",
  customFontUrl: "",
  preferredImageStyles: [],
  imageLibrary: [],
  sectionStyles: {},
  tierBias: "",
  styleBias: [],
  aiInstructions: "",
};
