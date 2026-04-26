"use client";

import { createContext, useContext, useSyncExternalStore } from "react";

// DashboardTheme — local, dashboard-only light/dark theme. Persists the
// operator's choice in localStorage; defaults to "light" so first-run
// matches the rest of the app. Tiles read tokens from this context to
// keep colour decisions in one place.

export type DashboardTheme = "light" | "dark";

export interface DashboardTokens {
  /** Page surface — the wash behind every tile. */
  pageBg: string;
  /** Default tile background. */
  tileBg: string;
  /** Active-proposal hero tile (always dark, regardless of theme). */
  heroBg: string;
  /** Subtle ring around tiles, drawn as a 1px inner box-shadow. */
  ring: string;
  /** Hover ring — slightly stronger than `ring`. */
  ringHover: string;
  /** Soft outer shadow at rest. */
  shadow: string;
  /** Soft outer shadow on hover. */
  shadowHover: string;
  /** Strongest text colour. */
  heading: string;
  /** Body copy. */
  body: string;
  /** Eyebrow / meta / dim copy. */
  muted: string;
  /** Brand green. */
  primary: string;
  /** Brand gold. */
  accent: string;
  /** Translucent green wash for empty states / hairlines. */
  primarySoft: string;
  /** Translucent gold wash for the gold KPI tile. */
  accentSoft: string;
}

const LIGHT: DashboardTokens = {
  pageBg: "#f4f1e8",
  tileBg: "#ffffff",
  heroBg: "linear-gradient(135deg, #1b3a2d 0%, #142a20 100%)",
  ring: "rgba(13,38,32,0.06)",
  ringHover: "rgba(13,38,32,0.12)",
  shadow: "0 1px 2px rgba(27,58,45,0.04), 0 8px 24px -10px rgba(27,58,45,0.08)",
  shadowHover:
    "0 4px 10px rgba(27,58,45,0.06), 0 18px 44px -14px rgba(27,58,45,0.16)",
  heading: "#0d2620",
  body: "rgba(13,38,32,0.7)",
  muted: "rgba(13,38,32,0.48)",
  primary: "#1b3a2d",
  accent: "#c9a84c",
  primarySoft: "rgba(27,58,45,0.08)",
  accentSoft: "rgba(201,168,76,0.10)",
};

const DARK: DashboardTokens = {
  pageBg: "#0a100d",
  tileBg: "linear-gradient(140deg, #141b17 0%, #0e1410 100%)",
  heroBg: "linear-gradient(135deg, #1f4334 0%, #142a20 100%)",
  ring: "rgba(255,255,255,0.06)",
  ringHover: "rgba(212,183,101,0.32)",
  shadow: "0 1px 2px rgba(0,0,0,0.4), 0 14px 38px -16px rgba(0,0,0,0.6)",
  shadowHover:
    "0 6px 14px rgba(0,0,0,0.55), 0 26px 56px -18px rgba(212,183,101,0.18)",
  heading: "rgba(255,255,255,0.96)",
  body: "rgba(255,255,255,0.72)",
  muted: "rgba(255,255,255,0.45)",
  primary: "#d4e7da",
  accent: "#d4b765",
  primarySoft: "rgba(212,231,218,0.06)",
  accentSoft: "rgba(212,183,101,0.10)",
};

interface ThemeContextValue {
  theme: DashboardTheme;
  tokens: DashboardTokens;
  setTheme: (next: DashboardTheme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "ssp:dashboard-theme";

// External store backing the theme — localStorage as source of truth so
// the choice survives reloads. useSyncExternalStore is React 19's
// canonical way to bind to non-React state without setState-in-effect.

const themeListeners = new Set<() => void>();

function readTheme(): DashboardTheme {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "dark" || saved === "light") return saved;
  } catch {
    // localStorage blocked — fall through
  }
  return "light";
}

function subscribeTheme(cb: () => void): () => void {
  themeListeners.add(cb);
  return () => {
    themeListeners.delete(cb);
  };
}

function getServerTheme(): DashboardTheme {
  // Render server-side as light; the client snapshot upgrades on mount.
  return "light";
}

function writeTheme(next: DashboardTheme) {
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // ignore
  }
  for (const cb of themeListeners) cb();
}

export function DashboardThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribeTheme, readTheme, getServerTheme);

  const setTheme = (next: DashboardTheme) => writeTheme(next);
  const toggleTheme = () => writeTheme(theme === "dark" ? "light" : "dark");

  const value: ThemeContextValue = {
    theme,
    tokens: theme === "dark" ? DARK : LIGHT,
    setTheme,
    toggleTheme,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useDashboardTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Fail soft — return light tokens if a tile somehow renders outside the
    // provider (eg. rendered through a portal). Logged once.
    if (typeof console !== "undefined") {
      console.warn("[DashboardTheme] useDashboardTheme called outside provider");
    }
    return {
      theme: "light",
      tokens: LIGHT,
      setTheme: () => {},
      toggleTheme: () => {},
    };
  }
  return ctx;
}

// Theme-toggle pill — pinned in the welcome strip's right edge.
export function ThemeToggle() {
  const { theme, toggleTheme, tokens } = useDashboardTheme();
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      className="relative inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-[12px] font-semibold transition active:scale-[0.97]"
      style={{
        background: tokens.tileBg,
        color: tokens.body,
        boxShadow: `inset 0 0 0 1px ${tokens.ring}, ${tokens.shadow}`,
      }}
    >
      <span
        aria-hidden
        className="w-4 h-4 rounded-full transition-all"
        style={{
          background: isDark ? tokens.accent : tokens.primary,
          boxShadow: isDark
            ? `0 0 12px ${tokens.accent}, inset 0 0 0 2px rgba(0,0,0,0.18)`
            : `inset 0 0 0 4px ${tokens.tileBg}`,
        }}
      />
      <span>{isDark ? "Dark" : "Light"}</span>
    </button>
  );
}
