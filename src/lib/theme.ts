import type { ThemeTokens } from "./types";

// ─── Color presets ────────────────────────────────────────────────────────────

export const COLOR_PRESETS: Record<string, ThemeTokens> = {
  forest: {
    pageBg: "#f3f0ea",
    sectionSurface: "#ffffff",
    cardBg: "#f9f6f0",
    accent: "#1b3a2d",
    secondaryAccent: "#c9a84c",
    headingText: "#1a1a1a",
    bodyText: "#3d3d3d",
    mutedText: "rgba(0,0,0,0.45)",
    border: "rgba(0,0,0,0.09)",
    buttonBg: "#1b3a2d",
    badgeBg: "#c9a84c",
  },
  ivory: {
    pageBg: "#faf8f3",
    sectionSurface: "#ffffff",
    cardBg: "#f5f2ea",
    accent: "#3d2b1f",
    secondaryAccent: "#a0845c",
    headingText: "#1e1a16",
    bodyText: "#3a3530",
    mutedText: "rgba(0,0,0,0.4)",
    border: "rgba(0,0,0,0.08)",
    buttonBg: "#3d2b1f",
    badgeBg: "#a0845c",
  },
  dusk: {
    pageBg: "#f0eeeb",
    sectionSurface: "#ffffff",
    cardBg: "#f7f5f0",
    accent: "#4a3728",
    secondaryAccent: "#b8936a",
    headingText: "#1c1917",
    bodyText: "#3c3530",
    mutedText: "rgba(0,0,0,0.42)",
    border: "rgba(0,0,0,0.08)",
    buttonBg: "#4a3728",
    badgeBg: "#b8936a",
  },
  slate: {
    pageBg: "#f0f2f4",
    sectionSurface: "#ffffff",
    cardBg: "#f4f6f8",
    accent: "#1e2d3d",
    secondaryAccent: "#4a7fa5",
    headingText: "#111827",
    bodyText: "#374151",
    mutedText: "rgba(0,0,0,0.45)",
    border: "rgba(0,0,0,0.09)",
    buttonBg: "#1e2d3d",
    badgeBg: "#4a7fa5",
  },
};

export type PresetKey = keyof typeof COLOR_PRESETS;

// ─── Font options ─────────────────────────────────────────────────────────────

export const DISPLAY_FONTS = [
  { name: "Cormorant", label: "Cormorant" },
  { name: "Playfair Display", label: "Playfair Display" },
  { name: "EB Garamond", label: "EB Garamond" },
  { name: "DM Serif Display", label: "DM Serif Display" },
  { name: "Libre Baskerville", label: "Libre Baskerville" },
];

export const BODY_FONTS = [
  { name: "Jost", label: "Jost" },
  { name: "Outfit", label: "Outfit" },
  { name: "Inter", label: "Inter" },
  { name: "Lato", label: "Lato" },
  { name: "Nunito Sans", label: "Nunito Sans" },
  { name: "Source Sans 3", label: "Source Sans" },
];

// ─── Google Fonts URL ─────────────────────────────────────────────────────────

export function buildGoogleFontsUrl(): string {
  const families = [
    "Cormorant:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,600",
    "Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400",
    "EB+Garamond:ital,wght@0,400;0,500;0,600;1,400",
    "DM+Serif+Display:ital@0;1",
    "Libre+Baskerville:ital,wght@0,400;0,700;1,400",
    "Jost:wght@300;400;500;600",
    "Outfit:wght@300;400;500;600",
    "Inter:wght@300;400;500;600",
    "Lato:ital,wght@0,300;0,400;0,700;1,400",
    "Nunito+Sans:wght@300;400;600",
    "Source+Sans+3:ital,wght@0,300;0,400;0,600;1,400",
  ];
  return `https://fonts.googleapis.com/css2?${families.map((f) => `family=${f}`).join("&")}&display=swap`;
}

// ─── Token resolution ─────────────────────────────────────────────────────────

export function resolveToken(
  key: keyof ThemeTokens,
  tokens: ThemeTokens,
  overrides?: Partial<ThemeTokens>
): string {
  return overrides?.[key] ?? tokens[key];
}
