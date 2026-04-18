"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  OrganizationSwitcher,
  SignOutButton,
  UserButton,
  useUser,
} from "@clerk/nextjs";
import { computeBrandDNACompletion, type BrandDNACompletion, type SectionKey } from "@/lib/brandDNA";
import { BrandCoreTab } from "./BrandCoreTab";
import { VoiceToneTab } from "./VoiceToneTab";
import { VisualStyleTab } from "./VisualStyleTab";
import { PropertyPreferencesTab } from "./PropertyPreferencesTab";
import { AIInstructionsTab } from "./AIInstructionsTab";
import { OverviewTab } from "./OverviewTab";
import { CompletionRing } from "./CompletionRing";
import type { BrandDNAForm, PropertyPrefRow } from "./types";
import { EMPTY_FORM } from "./types";

type Tab = "overview" | "brandCore" | "voiceTone" | "visualStyle" | "propertyPreferences" | "aiInstructions";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "brandCore", label: "Brand Core" },
  { id: "voiceTone", label: "Voice & Tone" },
  { id: "visualStyle", label: "Visual Style" },
  { id: "propertyPreferences", label: "Property Preferences" },
  { id: "aiInstructions", label: "AI Instructions" },
];

const SECTION_TO_TAB: Record<SectionKey, Tab> = {
  brandCore: "brandCore",
  voiceTone: "voiceTone",
  visualStyle: "visualStyle",
  propertyPreferences: "propertyPreferences",
  aiInstructions: "aiInstructions",
};

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

export function BrandDNAPage() {
  const [form, setForm] = useState<BrandDNAForm>(EMPTY_FORM);
  const [propertyPrefs, setPropertyPrefs] = useState<PropertyPrefRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  // ─── Load on mount ────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/brand-dna", { cache: "no-store" });
        if (res.status === 401) { window.location.href = "/sign-in?redirect_url=/settings/brand"; return; }
        if (res.status === 409) { window.location.href = "/select-organization"; return; }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setForm(hydrateForm(data.profile));
        setPropertyPrefs((data.profile?.propertyPreferences ?? []) as PropertyPrefRow[]);
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  // ─── Mutations ────────────────────────────────────────────────────────────
  const update = useCallback((patch: Partial<BrandDNAForm>) => {
    setForm((prev) => ({ ...prev, ...patch }));
    setSaveState("dirty");
  }, []);

  // ─── Debounced auto-save ──────────────────────────────────────────────────
  useEffect(() => {
    if (saveState !== "dirty") return;
    const t = setTimeout(async () => {
      setSaveState("saving");
      setSaveError(null);
      try {
        const res = await fetch("/api/brand-dna", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (res.status === 409) { window.location.href = "/select-organization"; return; }
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error || `HTTP ${res.status}`);
        }
        setSaveState("saved");
        setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 1800);
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : "Save failed");
        setSaveState("error");
      }
    }, 650);
    return () => clearTimeout(t);
  }, [form, saveState]);

  // ─── Completion (recomputed on every form change) ─────────────────────────
  const completion: BrandDNACompletion = useMemo(
    () => computeBrandDNACompletion(form as unknown as Parameters<typeof computeBrandDNACompletion>[0], propertyPrefs),
    [form, propertyPrefs],
  );

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f8f5ef] text-[#1a1a1a]">
      <Header saveState={saveState} saveError={saveError} completion={completion} />

      <main className="max-w-5xl mx-auto px-6 py-10">
        {/* Title + tabs */}
        <div className="flex items-start justify-between gap-6 flex-wrap mb-6">
          <div>
            <div className="text-[12px] uppercase tracking-[0.2em] font-semibold text-[#1b3a2d]">
              Brand DNA
            </div>
            <h1 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight text-black/85">
              Teach the AI your brand.
            </h1>
            <p className="mt-2 text-[15px] text-black/55 max-w-xl leading-relaxed">
              Everything here is optional. The more you fill in, the more your
              proposals read, look, and feel like your brand.
            </p>
          </div>
          <div className="hidden md:flex items-center gap-3 pt-2">
            <CompletionRing percent={completion.overall} size={52} stroke={5} label={false} />
            <div>
              <div className="text-[20px] font-semibold text-black/85 leading-none tabular-nums">
                {completion.overall}%
              </div>
              <div className="text-[11px] uppercase tracking-wider text-black/40 mt-1">
                Complete
              </div>
            </div>
          </div>
        </div>

        <Tabs tab={tab} setTab={setTab} />

        <div className="mt-6">
          {!loaded && <div className="text-sm text-black/40 py-20 text-center">Loading…</div>}
          {loaded && loadError && (
            <div className="rounded-xl border border-[#b34334]/30 bg-[#b34334]/5 p-5 text-[#b34334]">
              <div className="font-semibold">Couldn&apos;t load Brand DNA</div>
              <div className="text-sm mt-1 break-words">{loadError}</div>
            </div>
          )}
          {loaded && !loadError && (
            <>
              {tab === "overview" && (
                <OverviewTab
                  completion={completion}
                  onGoto={(s) => setTab(SECTION_TO_TAB[s])}
                />
              )}
              {tab === "brandCore" && <BrandCoreTab form={form} update={update} />}
              {tab === "voiceTone" && <VoiceToneTab form={form} update={update} />}
              {tab === "visualStyle" && <VisualStyleTab form={form} update={update} />}
              {tab === "propertyPreferences" && (
                <PropertyPreferencesTab
                  form={form}
                  update={update}
                  prefs={propertyPrefs}
                  setPrefs={setPropertyPrefs}
                />
              )}
              {tab === "aiInstructions" && <AIInstructionsTab form={form} update={update} />}
            </>
          )}
        </div>

        {/* Footer nav */}
        <div className="mt-12 pt-6 border-t border-black/8 flex items-center justify-between flex-wrap gap-3">
          <Link
            href="/proposals"
            className="text-sm text-black/40 hover:text-black/70 transition"
          >
            ← Back to proposals
          </Link>
          <div className="text-[12px] text-black/35">
            Changes save automatically.
          </div>
        </div>
      </main>
    </div>
  );
}

// ─── Header ─────────────────────────────────────────────────────────────────

function Header({
  saveState,
  saveError,
  completion,
}: {
  saveState: SaveState;
  saveError: string | null;
  completion: BrandDNACompletion;
}) {
  return (
    <header className="h-14 border-b border-black/10 bg-white flex items-center justify-between px-6 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
      <div className="flex items-center gap-4 min-w-0">
        <Link href="/proposals" className="flex items-center gap-2 group">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#c9a84c] font-bold text-base"
            style={{ background: "rgba(201,168,76,0.15)" }}
          >
            S
          </div>
          <span className="font-semibold text-[15px] tracking-tight text-black/80 group-hover:text-black transition">
            Safari Studio
          </span>
        </Link>
        <span className="text-black/15">|</span>
        <span className="text-sm text-black/50 truncate">Brand DNA</span>

        <SaveIndicator state={saveState} error={saveError} completion={completion} />
      </div>
      <div className="flex items-center gap-3">
        <OrganizationSwitcher
          hidePersonal
          afterSelectOrganizationUrl="/proposals"
          afterCreateOrganizationUrl="/proposals"
          afterLeaveOrganizationUrl="/select-organization"
          appearance={{
            elements: {
              organizationSwitcherTrigger: {
                padding: "4px 10px",
                borderRadius: "0.5rem",
                fontSize: "13px",
                maxWidth: "220px",
              },
              organizationSwitcherPopoverCard: { zIndex: 9999, boxShadow: "0 12px 40px rgba(0,0,0,0.18)" },
              organizationSwitcherPopoverRootBox: { zIndex: 9999 },
            },
          }}
        />
        <UserMenu />
      </div>
    </header>
  );
}

function SaveIndicator({
  state,
  error,
  completion,
}: {
  state: SaveState;
  error: string | null;
  completion: BrandDNACompletion;
}) {
  const label =
    state === "saving"
      ? "Saving…"
      : state === "saved"
        ? "Saved ✓"
        : state === "error"
          ? `Save failed — ${error ?? "retry"}`
          : state === "dirty"
            ? "Unsaved changes"
            : `${completion.overall}% complete`;
  const color =
    state === "error"
      ? "text-[#b34334]"
      : state === "saving" || state === "dirty"
        ? "text-black/55"
        : "text-black/45";
  return (
    <span className={`ml-2 text-[12px] tabular-nums transition ${color}`}>
      · {label}
    </span>
  );
}

// ─── User menu (shared pattern) ─────────────────────────────────────────────

function UserMenu() {
  const { isLoaded, isSignedIn, user } = useUser();
  if (!isLoaded) return <div className="w-8 h-8 rounded-full bg-black/10 animate-pulse" />;
  if (!isSignedIn)
    return (
      <Link
        href="/sign-in"
        className="px-3 py-1.5 text-sm rounded-lg border border-black/12 text-black/70 hover:bg-black/5 transition"
      >
        Sign in
      </Link>
    );
  const initials = (
    (user?.firstName?.[0] ?? "") +
    (user?.lastName?.[0] ?? user?.emailAddresses?.[0]?.emailAddress?.[0] ?? "")
  ).toUpperCase();
  return (
    <div className="relative w-8 h-8">
      <SignOutButton redirectUrl="/">
        <button
          type="button"
          className="absolute inset-0 rounded-full flex items-center justify-center text-xs font-semibold text-white bg-[#1b3a2d] hover:bg-[#2d5a40] transition"
          title="Sign out"
          aria-label="Sign out"
        >
          {initials || "•"}
        </button>
      </SignOutButton>
      <div className="absolute inset-0">
        <UserButton
          appearance={{
            elements: {
              rootBox: { width: "2rem", height: "2rem" },
              avatarBox: { width: "2rem", height: "2rem" },
              userButtonPopoverCard: { zIndex: 9999, boxShadow: "0 12px 40px rgba(0,0,0,0.18)" },
              userButtonPopoverRootBox: { zIndex: 9999 },
            },
          }}
        />
      </div>
    </div>
  );
}

// ─── Tabs ───────────────────────────────────────────────────────────────────

function Tabs({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  return (
    <div className="border-b border-black/10 overflow-x-auto">
      <div className="flex gap-1 min-w-max">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`relative px-4 py-2.5 text-[13px] font-medium transition ${
                active ? "text-[#1b3a2d]" : "text-black/50 hover:text-black/70"
              }`}
            >
              {t.label}
              {active && (
                <span
                  className="absolute left-3 right-3 -bottom-px h-0.5 rounded-full"
                  style={{ background: "#1b3a2d" }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Hydration ─────────────────────────────────────────────────────────────

type LoadedProfile = Partial<BrandDNAForm> & {
  brandColors?: unknown;
  imageLibrary?: unknown;
} & Record<string, unknown>;

function hydrateForm(profile: LoadedProfile | null): BrandDNAForm {
  if (!profile) return EMPTY_FORM;
  return {
    brandName: (profile.brandName as string | null) ?? "",
    logoUrl: (profile.logoUrl as string | null) ?? "",
    websiteUrl: (profile.websiteUrl as string | null) ?? "",
    tagline: (profile.tagline as string | null) ?? "",
    shortDescription: (profile.shortDescription as string | null) ?? "",

    voiceFormality: toNum(profile.voiceFormality),
    voiceLuxury: toNum(profile.voiceLuxury),
    voiceDensity: toNum(profile.voiceDensity),
    voiceStorytelling: toNum(profile.voiceStorytelling),
    writingSample1: (profile.writingSample1 as string | null) ?? "",
    writingSample2: (profile.writingSample2 as string | null) ?? "",

    brandColors: Array.isArray(profile.brandColors) ? (profile.brandColors as BrandDNAForm["brandColors"]) : [],
    headingFont: (profile.headingFont as string | null) ?? "",
    bodyFont: (profile.bodyFont as string | null) ?? "",
    customFontUrl: (profile.customFontUrl as string | null) ?? "",
    preferredImageStyles: Array.isArray(profile.preferredImageStyles)
      ? (profile.preferredImageStyles as string[])
      : [],
    imageLibrary: Array.isArray(profile.imageLibrary)
      ? (profile.imageLibrary as BrandDNAForm["imageLibrary"])
      : [],

    tierBias: (profile.tierBias as string | null) ?? "",
    styleBias: Array.isArray(profile.styleBias) ? (profile.styleBias as string[]) : [],

    aiInstructions: (profile.aiInstructions as string | null) ?? "",
  };
}

function toNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}
