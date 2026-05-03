"use client";

import { createContext, useContext, useSyncExternalStore } from "react";

// DashboardTheme — light/dark theme for the operator dashboard.
// Persists the choice in localStorage; defaults to "light" so first-
// run matches the rest of the app.
//
// The actual colour values now live in globals.css under :root
// (light defaults) and [data-dashboard-theme="dark"] (dark overrides)
// as canonical CSS custom properties. The 8 design-spec tokens are
// --bg-primary, --bg-card, --text-primary, --text-secondary,
// --accent-green, --accent-amber, --border-subtle, --shadow-soft
// plus a few supporting vars (--text-muted, --bg-card-hover,
// --bg-hero, --accent-*-soft, --border-strong, --shadow-elevated).
//
// The DashboardTokens object below is now a thin var(--…) façade so
// existing JS consumers (`tokens.tileBg`, `tokens.heading`, …) keep
// working unchanged — at paint time the browser resolves each var
// against whichever scope is active. This means a single token swap
// in CSS reskins every consumer.
//
// Branding boundary: these tokens are the Safari Studio dashboard
// theme. Org branding only appears as accent surfaces (logo mark,
// gold pills) — never overrides the underlying tokens. Client-facing
// share pages (/p/[id], ReservationDialog) read a separate
// ProposalTheme off proposal.contentJson and stay fully white-
// labeled; the dashboard tokens never reach that subtree because the
// data-dashboard-theme attribute is scoped to the dashboard provider.

export type DashboardTheme = "light" | "dark";

export interface DashboardTokens {
  /** Page surface — the wash behind every tile. */
  pageBg: string;
  /** Default tile background. */
  tileBg: string;
  /** Active-proposal hero tile (dark green gradient in both modes). */
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
  /** Brand green — used as a TEXT accent (links, active sidebar item,
   *  "Best move" chip foreground). Lifts to sage in dark to stay
   *  legible against deep backgrounds. NOT for filled-button surfaces
   *  (would fail contrast against white text in dark) — use
   *  `primaryStrong` instead. */
  primary: string;
  /** Brand green — solid CTA surface. Stays deep in both modes so
   *  white text always reads. Use this for filled-button backgrounds. */
  primaryStrong: string;
  /** Brand gold. */
  accent: string;
  /** Translucent green wash for empty states / hairlines. */
  primarySoft: string;
  /** Translucent gold wash for the gold KPI tile. */
  accentSoft: string;
}

// Single token façade — every value is a CSS var() reference. The
// actual colour swaps when [data-dashboard-theme="dark"] is set on
// the provider's root element. Both the light and dark constants are
// gone; globals.css is the single source of truth for resolved values.
const TOKENS: DashboardTokens = {
  pageBg:      "var(--bg-primary)",
  tileBg:      "var(--bg-card)",
  heroBg:      "var(--bg-hero)",
  ring:        "var(--border-subtle)",
  ringHover:   "var(--border-strong)",
  shadow:      "var(--shadow-soft)",
  shadowHover: "var(--shadow-elevated)",
  heading:     "var(--text-primary)",
  body:        "var(--text-secondary)",
  muted:       "var(--text-muted)",
  primary:       "var(--accent-green)",
  primaryStrong: "var(--accent-green-cta)",
  accent:        "var(--accent-amber)",
  primarySoft:   "var(--accent-green-soft)",
  accentSoft:    "var(--accent-amber-soft)",
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
    tokens: TOKENS,
    setTheme,
    toggleTheme,
  };

  // The data-dashboard-theme attribute scopes the CSS var overrides
  // from globals.css to this subtree. Light is the default (matches
  // :root) so we still set the attribute for "light" to keep the
  // selector specificity consistent and so devtools shows the active
  // theme on the wrapper. min-h-screen so the bg-primary wash covers
  // the viewport even when the inner main is short.
  return (
    <ThemeContext.Provider value={value}>
      <div
        data-dashboard-theme={theme}
        style={{ background: "var(--bg-primary)" }}
        className="min-h-screen"
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function useDashboardTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Fail soft — return the same token façade if a tile somehow
    // renders outside the provider (eg. rendered through a portal).
    // The CSS vars resolve to light defaults when the
    // data-dashboard-theme attribute isn't present, so consumers
    // still paint cleanly.
    if (typeof console !== "undefined") {
      console.warn("[DashboardTheme] useDashboardTheme called outside provider");
    }
    return {
      theme: "light",
      tokens: TOKENS,
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
