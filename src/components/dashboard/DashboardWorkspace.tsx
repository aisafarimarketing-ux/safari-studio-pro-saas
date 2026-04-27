"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOrganization } from "@clerk/nextjs";
import { motion } from "framer-motion";
import { DashboardShell } from "./DashboardShell";
import {
  DashboardThemeProvider,
  ThemeToggle,
  useDashboardTheme,
  type DashboardTokens,
} from "./DashboardTheme";
import type { BrandDNACompletion } from "@/lib/brandDNA";
import { buildDemoProposal } from "@/lib/defaults";
import { nanoid } from "@/lib/nanoid";
import { OnboardingChecklist } from "./OnboardingChecklist";
import { TierBanner } from "./TierBanner";
import { MessagesTile } from "./MessagesTile";
import { PrioritiesSection } from "./PrioritiesSection";
import { PerformanceSection } from "./PerformanceSection";
import { TripSetupDialog, type TripSetupResult } from "@/components/trip-setup/TripSetupDialog";
import { mergeAutopilotIntoProposal, type AutopilotResult } from "@/lib/autopilotMerge";
import { applyIdentityToOperator, identityFromMe, type ConsultantIdentity } from "@/lib/consultantIdentity";

// ─── Workspace dashboard ────────────────────────────────────────────────────
//
// One-viewport operator workspace. Welcome strip + KPI row + flagship pair
// (active proposal · inbox) + compact triplet (funnel · activity · quick
// actions). Library and recent proposals live in the sidebar — not here —
// so the page never scrolls. Theme-aware via DashboardTheme.

type ProposalRow = {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
  createdAt?: string;
  clientName: string | null;
};
type LocationLite = { id: string; name: string; country: string | null };
type PropertyRow = {
  id: string;
  name: string;
  location: LocationLite | null;
  images: { id: string; url: string }[];
};
type RequestRow = {
  id: string;
  referenceNumber: string | null;
  status: string;
  source: string | null;
  receivedAt: string;
  client: {
    name: string | null;
    email: string | null;
    country: string | null;
  } | null;
};

type Summary = {
  proposals: { thisMonth: number; lastMonth: number; sparkline30d: number[] };
  deposits: { thisMonthCents: number; lastMonthCents: number; currency: string };
  requests: {
    windowDays: number;
    total: number;
    funnel: { new: number; working: number; open: number; booked: number; completed: number; notBooked: number };
    conversionRate: number;
  };
  engagement: { medianSessionSeconds: number; sampledViews: number };
  pipeline: { valueCents: number; currency: string; activeProposalCount: number };
  activity: Array<{
    at: string;
    kind: "deposit" | "reservation-confirmed" | "reservation-sent" | "proposal-created";
    label: string;
    detail?: string;
    link: string;
  }>;
};

export function DashboardWorkspace() {
  const router = useRouter();
  const { organization } = useOrganization();
  const [proposals, setProposals] = useState<ProposalRow[] | null>(null);
  const [, setProperties] = useState<PropertyRow[] | null>(null);
  const [, setLocationCount] = useState<number | null>(null);
  const [completion, setCompletion] = useState<BrandDNACompletion | null>(null);
  const [requests, setRequests] = useState<RequestRow[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [identity, setIdentity] = useState<ConsultantIdentity | null>(null);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [tripSetupOpen, setTripSetupOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // We track raw counts for the onboarding checklist but no longer surface
  // the "Workspace" library tiles on the dashboard — Properties and Brand
  // DNA each have their own pages reachable from the sidebar.
  const [hasProperties, setHasProperties] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [propRes, propertyRes, locRes, brandRes, reqRes, sumRes, meRes] = await Promise.all([
          fetch("/api/proposals", { cache: "no-store" }),
          fetch("/api/properties", { cache: "no-store" }),
          fetch("/api/locations", { cache: "no-store" }),
          fetch("/api/brand-dna", { cache: "no-store" }),
          fetch("/api/requests?limit=20", { cache: "no-store" }),
          fetch("/api/dashboard/summary", { cache: "no-store" }),
          fetch("/api/me", { cache: "no-store" }),
        ]);
        if (propRes.status === 401) { window.location.href = "/sign-in?redirect_url=/dashboard"; return; }
        if (propRes.status === 409) { window.location.href = "/select-organization"; return; }
        if (propRes.status === 402) { window.location.href = "/account-suspended"; return; }

        const propData = propRes.ok ? await propRes.json() : { proposals: [] };
        const propertyData = propertyRes.ok ? await propertyRes.json() : { properties: [] };
        const locData = locRes.ok ? await locRes.json() : { locations: [] };
        const brandData = brandRes.ok ? await brandRes.json() : null;
        const reqData = reqRes.ok ? await reqRes.json() : { requests: [] };
        const sumData = sumRes.ok ? await sumRes.json() : null;
        const meData = meRes.ok ? await meRes.json() : null;

        setProposals(propData.proposals ?? []);
        setProperties(propertyData.properties ?? []);
        setHasProperties(((propertyData.properties ?? []) as PropertyRow[]).length > 0);
        setLocationCount((locData.locations ?? []).length);
        setCompletion(brandData?.completion ?? null);
        setRequests(reqData.requests ?? []);
        if (sumData) setSummary(sumData as Summary);
        if (meData?.user) setIdentity(identityFromMe(meData));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load workspace");
      }
    })();
  }, []);

  const openNewProposal = () => setTripSetupOpen(true);
  const submitAbortRef = useRef<AbortController | null>(null);

  const handleTripSetupSubmit = async ({ proposal, autopilot }: TripSetupResult) => {
    if (creating) return;
    setCreating(true);
    const controller = new AbortController();
    submitAbortRef.current = controller;

    if (identity) {
      proposal.operator = applyIdentityToOperator(proposal.operator, identity);
    }

    try {
      const res = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposal }),
        signal: controller.signal,
      });
      if (res.status === 409) { window.location.href = "/select-organization"; return; }
      if (res.status === 402) { window.location.href = "/account-suspended"; return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      if (autopilot) {
        try {
          const ai = await fetch("/api/ai/autopilot", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ proposal }),
            signal: controller.signal,
          });
          if (ai.ok) {
            const draft = (await ai.json()) as AutopilotResult;
            if (!draft.days || draft.days.length === 0) {
              console.warn("[autopilot] returned 0 days · response:", draft);
              setError(
                "Autopilot returned 0 days for this trip. This usually means the AI request timed out or hit a rate limit. Click Generate again — or open the editor with the empty proposal and fill it in manually.",
              );
              return;
            } else {
              const merged = mergeAutopilotIntoProposal(proposal, draft);
              const saveBody = JSON.stringify({ proposal: merged });
              const save = await fetch("/api/proposals", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: saveBody,
                signal: controller.signal,
              });
              if (!save.ok) {
                const detail = await save.json().catch(() => ({}));
                console.error(
                  "[autopilot] merge save failed:",
                  save.status,
                  detail?.error,
                  "· payload bytes:",
                  saveBody.length,
                );
                setError(
                  `AI drafted the proposal but couldn't save it (${detail?.error || `HTTP ${save.status}`}). ${
                    saveBody.length > 3_000_000
                      ? "The payload is unusually large — likely inline base64 images on properties. Re-uploading them through Supabase Storage will fix this."
                      : "Open the editor and use Regenerate to retry."
                  }`,
                );
                return;
              }
            }
          } else {
            const detail = await ai.json().catch(() => ({}));
            console.warn("[autopilot] non-OK:", ai.status, detail?.error);
            setError(
              `AI couldn't draft this proposal: ${detail?.error || `HTTP ${ai.status}`}. The editor will open with your blank proposal — try Regenerate inside.`,
            );
          }
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") return;
          console.warn("[autopilot] failed; opening blank editor instead:", err);
        }
      }

      if (!controller.signal.aborted) {
        try { localStorage.setItem("activeProposalId", proposal.id); } catch {}
        setTripSetupOpen(false);
        router.push(`/studio/${proposal.id}`);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Could not create proposal");
    } finally {
      if (submitAbortRef.current === controller) submitAbortRef.current = null;
      setCreating(false);
    }
  };

  const handleCancelSubmit = () => {
    submitAbortRef.current?.abort();
  };

  const handleImportSample = async () => {
    if (importing) return;
    setImporting(true);
    try {
      const sample = buildDemoProposal();
      sample.id = nanoid();
      sample.metadata = {
        ...sample.metadata,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const res = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposal: sample }),
      });
      if (res.status === 409) { window.location.href = "/select-organization"; return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      try { localStorage.setItem("activeProposalId", sample.id); } catch {}
      router.push("/studio");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not import sample");
      setImporting(false);
    }
  };

  const orgName = organization?.name ?? "your workspace";
  const activeProposal = proposals?.[0] ?? null;

  return (
    <DashboardThemeProvider>
      <DashboardOrchestrator
        orgName={orgName}
        proposals={proposals}
        activeProposal={activeProposal}
        requests={requests}
        summary={summary}
        completion={completion}
        hasProperties={hasProperties}
        creating={creating}
        importing={importing}
        error={error}
        openNewProposal={openNewProposal}
        onImportSample={handleImportSample}
      />
      {tripSetupOpen && (
        <TripSetupDialog
          onClose={() => { if (!creating) setTripSetupOpen(false); }}
          onCancel={handleCancelSubmit}
          onSubmit={handleTripSetupSubmit}
          submitting={creating}
        />
      )}
    </DashboardThemeProvider>
  );
}

// Splits the rendering inside the theme provider so descendants can read
// theme tokens via context.

function DashboardOrchestrator(props: {
  orgName: string;
  proposals: ProposalRow[] | null;
  activeProposal: ProposalRow | null;
  requests: RequestRow[] | null;
  summary: Summary | null;
  completion: BrandDNACompletion | null;
  hasProperties: boolean;
  creating: boolean;
  importing: boolean;
  error: string | null;
  openNewProposal: () => void;
  onImportSample: () => void;
}) {
  const { tokens } = useDashboardTheme();
  return (
    <DashboardShell
      mainBackground={tokens.pageBg}
      main={<DashboardBody {...props} />}
    />
  );
}

function DashboardBody({
  orgName,
  proposals,
  activeProposal,
  requests,
  summary,
  completion,
  hasProperties,
  creating,
  importing,
  error,
  openNewProposal,
  onImportSample,
}: {
  orgName: string;
  proposals: ProposalRow[] | null;
  activeProposal: ProposalRow | null;
  requests: RequestRow[] | null;
  summary: Summary | null;
  completion: BrandDNACompletion | null;
  hasProperties: boolean;
  creating: boolean;
  importing: boolean;
  error: string | null;
  openNewProposal: () => void;
  onImportSample: () => void;
}) {
  const { theme, tokens } = useDashboardTheme();

  const stagger = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
  } as const;
  const item = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
  } as const;

  const showOnboarding =
    proposals !== null &&
    !((proposals?.length ?? 0) > 0 && hasProperties && (completion?.overall ?? 0) >= 60);

  const isFirstRun = proposals !== null && proposals.length === 0;

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="show"
      className="space-y-5"
    >
      {/* ── Welcome strip — one line, theme toggle on the right ── */}
      <motion.header variants={item} className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1
            className="text-[20px] md:text-[22px] font-semibold tracking-tight leading-tight truncate"
            style={{
              color: tokens.heading,
              fontFamily: "'Playfair Display', Georgia, serif",
            }}
          >
            Welcome back, <span style={{ color: tokens.accent }}>{orgName}</span>.
          </h1>
          <div className="text-[12px] mt-0.5 truncate" style={{ color: tokens.muted }}>
            {activeProposal
              ? "Pick up where you left off, or start something new."
              : "Draft your first proposal — autopilot fills in the rest."}
          </div>
        </div>
        <div className="shrink-0">
          <ThemeToggle />
        </div>
      </motion.header>

      <motion.div variants={item}>
        <TierBanner />
      </motion.div>

      {error && (
        <motion.div
          variants={item}
          className="rounded-2xl p-3.5 text-[13px]"
          style={{
            background: "rgba(179,67,52,0.08)",
            color: "#b34334",
            boxShadow: "inset 0 0 0 1px rgba(179,67,52,0.25)",
          }}
        >
          {error}
        </motion.div>
      )}

      {/* Onboarding nudge — replaces the mosaic until the basics are set. */}
      {showOnboarding && proposals !== null && (
        <motion.div variants={item}>
          <OnboardingChecklist
            progress={{
              hasProperties,
              hasProposals: (proposals?.length ?? 0) > 0,
              brandDNAComplete: (completion?.overall ?? 0) >= 60,
            }}
          />
        </motion.div>
      )}

      {/* First-run CTA — when there are zero proposals at all. */}
      {isFirstRun && (
        <motion.div
          variants={item}
          className="rounded-2xl p-6 text-center"
          style={{
            background: tokens.tileBg,
            boxShadow: `inset 0 0 0 1px ${tokens.ring}, ${tokens.shadow}`,
          }}
        >
          <div
            className="text-[10.5px] uppercase tracking-[0.22em] font-semibold"
            style={{ color: tokens.accent }}
          >
            First time here
          </div>
          <h2
            className="mt-2 text-[18px] font-semibold"
            style={{ color: tokens.heading }}
          >
            Draft your first proposal — or import one you already sent.
          </h2>
          <p
            className="mt-1 text-[12.5px] max-w-md mx-auto"
            style={{ color: tokens.muted }}
          >
            The dashboard lights up the moment you do.
          </p>
          <div className="mt-5 flex items-center justify-center gap-2 flex-wrap">
            <PrimaryButton onClick={openNewProposal} disabled={creating}>
              {creating ? "Creating…" : "+ New proposal"}
            </PrimaryButton>
            <GoldButton href="/import">Import existing →</GoldButton>
            <GhostButton onClick={onImportSample} disabled={importing}>
              {importing ? "Loading…" : "Try demo"}
            </GhostButton>
          </div>
        </motion.div>
      )}

      {/* ── The mosaic ─────────────────────────────────────────────────── */}
      {proposals !== null && proposals.length > 0 && (
        <>
          {/* KPI row — 4 small tiles */}
          <motion.div
            variants={item}
            className="grid grid-cols-2 lg:grid-cols-4 gap-3.5"
          >
            <KpiTile
              label="Proposals"
              value={
                summary?.proposals.thisMonth ??
                proposals.filter((p) => new Date(p.updatedAt) >= monthStart()).length
              }
              suffix="this month"
              deltaNow={summary?.proposals.thisMonth}
              deltaThen={summary?.proposals.lastMonth}
              sparkline={summary?.proposals.sparkline30d}
            />
            <KpiTile
              label="Deposits"
              value={summary ? formatMoney(summary.deposits.thisMonthCents, summary.deposits.currency) : "—"}
              suffix="received"
              deltaNow={summary?.deposits.thisMonthCents}
              deltaThen={summary?.deposits.lastMonthCents}
              accent="gold"
            />
            <KpiTile
              label="Engagement"
              value={summary ? formatSeconds(summary.engagement.medianSessionSeconds) : "—"}
              suffix={
                summary && summary.engagement.sampledViews > 0
                  ? `median · ${summary.engagement.sampledViews} visit${summary.engagement.sampledViews === 1 ? "" : "s"}`
                  : "no visits yet"
              }
            />
            <KpiTile
              label="Pipeline"
              value={summary ? formatMoney(summary.pipeline.valueCents, summary.pipeline.currency) : "—"}
              suffix={summary ? `${summary.pipeline.activeProposalCount} live` : ""}
            />
          </motion.div>

          {/* Flagship row — Active proposal + Requests inbox + Messages */}
          <motion.div
            variants={item}
            className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr_1fr] gap-3.5"
          >
            <ActiveProposalTile proposal={activeProposal} onNew={openNewProposal} creating={creating} />
            <InboxTile requests={requests} />
            <MessagesTile />
          </motion.div>

          {/* Today's Priorities — intelligence layer, full-width below the
              flagship row so the operator's first scan answers
              "who do I follow up with right now?" without scrolling. */}
          <motion.div variants={item}>
            <PrioritiesSection />
          </motion.div>

          {/* Performance Insights — proves what works. Sits below
              priorities so the operator's first read is action-
              oriented; the analytical layer comes after. */}
          <motion.div variants={item}>
            <PerformanceSection />
          </motion.div>

          {/* Compact triplet — Funnel + Activity + Quick Actions */}
          <motion.div
            variants={item}
            className="grid grid-cols-1 lg:grid-cols-3 gap-3.5"
          >
            {summary ? (
              <FunnelTile summary={summary} />
            ) : (
              <SkeletonTile label="Request funnel" />
            )}
            {summary ? (
              <ActivityFeedTile activity={summary.activity} />
            ) : (
              <SkeletonTile label="Recent activity" />
            )}
            <QuickActionsTile
              onNew={openNewProposal}
              creating={creating}
              theme={theme}
            />
          </motion.div>
        </>
      )}
    </motion.div>
  );
}

// ─── Buttons ──────────────────────────────────────────────────────────────

function PrimaryButton({
  onClick,
  disabled,
  href,
  children,
}: {
  onClick?: () => void;
  disabled?: boolean;
  href?: string;
  children: React.ReactNode;
}) {
  const { tokens } = useDashboardTheme();
  const cls =
    "inline-flex items-center justify-center px-4 h-10 rounded-xl text-[13px] font-semibold transition active:scale-[0.97] disabled:opacity-60";
  const style: React.CSSProperties = {
    background: tokens.primary,
    color: "#ffffff",
    boxShadow: `0 6px 18px -8px ${tokens.primary}`,
  };
  if (href) {
    return (
      <Link href={href} className={cls} style={style}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cls} style={style}>
      {children}
    </button>
  );
}

function GoldButton({
  href,
  onClick,
  children,
}: {
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  const { tokens } = useDashboardTheme();
  const cls =
    "inline-flex items-center justify-center px-4 h-10 rounded-xl text-[13px] font-semibold transition active:scale-[0.97]";
  const style: React.CSSProperties = {
    background: tokens.accent,
    color: "#1d1d1f",
    boxShadow: `0 6px 18px -10px ${tokens.accent}`,
  };
  if (href) {
    return (
      <Link href={href} className={cls} style={style}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls} style={style}>
      {children}
    </button>
  );
}

function GhostButton({
  onClick,
  disabled,
  children,
}: {
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const { tokens } = useDashboardTheme();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center justify-center px-4 h-10 rounded-xl text-[13px] font-medium transition active:scale-[0.97] disabled:opacity-60"
      style={{
        background: tokens.tileBg,
        color: tokens.body,
        boxShadow: `inset 0 0 0 1px ${tokens.ring}`,
      }}
    >
      {children}
    </button>
  );
}

// ─── Tile shell — base styles for every box ───────────────────────────────

function Tile({
  children,
  className = "",
  style,
  href,
  onClick,
  hero = false,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  href?: string;
  onClick?: () => void;
  hero?: boolean;
}) {
  const { tokens } = useDashboardTheme();
  const baseStyle: React.CSSProperties = {
    background: hero ? tokens.heroBg : tokens.tileBg,
    boxShadow: `inset 0 0 0 1px ${tokens.ring}, ${tokens.shadow}`,
    ...style,
  };
  const motionProps = {
    whileHover: { y: -2 },
    transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] as const },
  };
  const cls = `relative rounded-2xl p-5 ${className}`;
  if (href) {
    return (
      <motion.div {...motionProps}>
        <Link href={href} className={`block ${cls}`} style={baseStyle}>
          {children}
        </Link>
      </motion.div>
    );
  }
  if (onClick) {
    return (
      <motion.button
        type="button"
        onClick={onClick}
        {...motionProps}
        className={`text-left w-full ${cls}`}
        style={baseStyle}
      >
        {children}
      </motion.button>
    );
  }
  return (
    <motion.div {...motionProps} className={cls} style={baseStyle}>
      {children}
    </motion.div>
  );
}

function Eyebrow({ children, color }: { children: React.ReactNode; color?: string }) {
  const { tokens } = useDashboardTheme();
  return (
    <div
      className="text-[10px] uppercase tracking-[0.24em] font-semibold"
      style={{ color: color ?? tokens.muted }}
    >
      {children}
    </div>
  );
}

// ─── KPI tile ─────────────────────────────────────────────────────────────

function KpiTile({
  label,
  value,
  suffix,
  deltaNow,
  deltaThen,
  sparkline,
  accent,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  deltaNow?: number;
  deltaThen?: number;
  sparkline?: number[];
  accent?: "gold";
}) {
  const { tokens } = useDashboardTheme();
  const delta = computeDelta(deltaNow, deltaThen);
  const goldStyle: React.CSSProperties = accent === "gold"
    ? { background: `linear-gradient(135deg, ${tokens.accentSoft} 0%, ${tokens.tileBg} 65%)` }
    : {};

  return (
    <Tile className="p-4 md:p-5" style={goldStyle}>
      <Eyebrow>{label}</Eyebrow>
      <div className="mt-2.5 flex items-baseline gap-2 flex-wrap">
        <div
          className="text-[26px] md:text-[30px] font-bold leading-none tracking-tight tabular-nums"
          style={{
            color: tokens.heading,
            fontFamily: "'Playfair Display', Georgia, serif",
          }}
        >
          {value}
        </div>
        {delta && (
          <div
            className="text-[11px] font-semibold tabular-nums"
            style={{
              color:
                delta.direction === "up"
                  ? tokens.accent
                  : delta.direction === "down"
                    ? "#d97a6e"
                    : tokens.muted,
            }}
          >
            {delta.direction === "up" ? "↑" : delta.direction === "down" ? "↓" : "·"} {delta.label}
          </div>
        )}
      </div>
      {suffix && (
        <div className="mt-1 text-[11.5px]" style={{ color: tokens.muted }}>
          {suffix}
        </div>
      )}
      {sparkline && sparkline.length > 1 && (
        <div className="mt-2.5 -mb-1">
          <Sparkline values={sparkline} stroke={accent === "gold" ? tokens.accent : tokens.primary} />
        </div>
      )}
    </Tile>
  );
}

function Sparkline({ values, stroke }: { values: number[]; stroke: string }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const w = 140;
  const h = 30;
  const step = w / (values.length - 1);
  const points = values
    .map((v, i) => `${i * step},${h - (v / max) * h}`)
    .join(" ");
  const fillPoints = `0,${h} ${points} ${w},${h}`;
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-7 block">
      <polygon points={fillPoints} fill={stroke} opacity="0.12" />
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function computeDelta(now?: number, then?: number): { direction: "up" | "down" | "flat"; label: string } | null {
  if (typeof now !== "number" || typeof then !== "number") return null;
  if (now === 0 && then === 0) return null;
  if (then === 0) return { direction: "up", label: "new" };
  const diff = now - then;
  const pct = Math.round((diff / then) * 100);
  const absPct = Math.abs(pct);
  if (absPct < 1) return { direction: "flat", label: "flat" };
  return { direction: pct > 0 ? "up" : "down", label: `${absPct}% vs last mo` };
}

function formatMoney(cents: number, currency: string): string {
  const amount = Math.round(cents / 100);
  if (amount === 0) return `${currency} 0`;
  return `${currency} ${amount.toLocaleString()}`;
}

function formatSeconds(total: number): string {
  if (total < 60) return `${total}s`;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function monthStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

// ─── Active proposal hero tile ────────────────────────────────────────────

function ActiveProposalTile({
  proposal,
  onNew,
  creating,
}: {
  proposal: ProposalRow | null;
  onNew: () => void;
  creating: boolean;
}) {
  const router = useRouter();
  const { tokens } = useDashboardTheme();

  if (!proposal) {
    return (
      <Tile hero>
        <Eyebrow color={tokens.accent}>Active proposal</Eyebrow>
        <h3
          className="mt-2 text-[20px] font-semibold leading-tight text-white/95"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          No proposal open yet.
        </h3>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-white/65">
          Trip Setup + autopilot drafts a personalised proposal in seconds.
        </p>
        <div className="mt-5">
          <button
            type="button"
            onClick={onNew}
            disabled={creating}
            className="inline-flex items-center justify-center px-4 h-10 rounded-xl text-[13px] font-semibold transition active:scale-[0.97] disabled:opacity-60"
            style={{ background: tokens.accent, color: "#1d1d1f" }}
          >
            {creating ? "Creating…" : "+ New proposal"}
          </button>
        </div>
      </Tile>
    );
  }

  const open = () => {
    try { localStorage.setItem("activeProposalId", proposal.id); } catch {}
    router.push("/studio");
  };
  const copyShare = async () => {
    const url = `${window.location.origin}/p/${proposal.id}`;
    try { await navigator.clipboard.writeText(url); } catch {}
  };

  return (
    <Tile hero>
      {/* faint dot pattern for texture */}
      <div
        aria-hidden
        className="absolute inset-0 rounded-2xl opacity-[0.06] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, ${tokens.accent} 1px, transparent 0)`,
          backgroundSize: "26px 26px",
        }}
      />
      <div className="relative">
        <Eyebrow color={tokens.accent}>Active proposal</Eyebrow>
        <h3
          className="mt-2 text-[19px] md:text-[21px] font-semibold leading-tight line-clamp-2 text-white/95"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          {proposal.title || "Untitled Proposal"}
        </h3>
        <div className="mt-1.5 text-[12.5px] truncate text-white/55">
          {proposal.clientName ? `${proposal.clientName} · ` : ""}
          Edited {formatRelative(proposal.updatedAt)}
        </div>
        <div className="mt-5 flex items-center gap-2">
          <button
            type="button"
            onClick={open}
            className="flex-1 px-3 h-10 rounded-xl text-[13px] font-semibold transition active:scale-[0.97] hover:brightness-105"
            style={{
              background: tokens.accent,
              color: "#1b3a2d",
              boxShadow: `0 6px 18px -8px ${tokens.accent}`,
            }}
          >
            Open in editor
          </button>
          <button
            type="button"
            onClick={copyShare}
            className="px-3 h-10 rounded-xl text-[13px] font-semibold text-white transition hover:brightness-110"
            style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.2)" }}
            title="Copy the public share link"
          >
            Share link
          </button>
        </div>
      </div>
    </Tile>
  );
}

// ─── Inbox tile ───────────────────────────────────────────────────────────

function InboxTile({ requests }: { requests: RequestRow[] | null }) {
  const { tokens } = useDashboardTheme();
  const loaded = requests !== null;
  const top = (requests ?? []).slice(0, 3);
  const openCount = (requests ?? []).length;

  return (
    <Tile href="/requests">
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <Eyebrow>Inbox</Eyebrow>
        {loaded && openCount > 0 && (
          <span
            className="text-[10.5px] font-semibold tabular-nums px-2 py-0.5 rounded-full"
            style={{ background: tokens.primarySoft, color: tokens.primary }}
          >
            {openCount} open
          </span>
        )}
      </div>

      {!loaded ? (
        <div className="space-y-2">
          <div className="h-3.5 rounded animate-pulse" style={{ background: tokens.ring }} />
          <div className="h-3.5 rounded animate-pulse w-4/5" style={{ background: tokens.ring }} />
          <div className="h-3.5 rounded animate-pulse w-3/5" style={{ background: tokens.ring }} />
        </div>
      ) : top.length === 0 ? (
        <div>
          <div className="text-[14px] font-medium" style={{ color: tokens.heading }}>
            No open requests.
          </div>
          <div className="text-[11.5px] mt-0.5" style={{ color: tokens.muted }}>
            New client enquiries show up here.
          </div>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {top.map((r) => (
            <li key={r.id} className="flex items-baseline gap-2">
              <div
                className="text-[10px] font-mono shrink-0 tabular-nums"
                style={{ color: tokens.muted }}
              >
                {r.referenceNumber ?? "—"}
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className="text-[12.5px] font-medium truncate"
                  style={{ color: tokens.heading }}
                >
                  {r.client?.name || r.client?.email || "Unknown"}
                </div>
                <div className="text-[10.5px] truncate" style={{ color: tokens.muted }}>
                  {r.source ? `${r.source} · ` : ""}
                  {formatRelative(r.receivedAt)}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div
        className="mt-4 text-[12px] font-semibold inline-flex items-center gap-1"
        style={{ color: tokens.primary }}
      >
        Open inbox
        <span aria-hidden>→</span>
      </div>
    </Tile>
  );
}

// ─── Funnel tile ──────────────────────────────────────────────────────────

function FunnelTile({ summary }: { summary: Summary }) {
  const { tokens } = useDashboardTheme();
  const f = summary.requests.funnel;
  const total = summary.requests.total;
  const stages: { label: string; count: number; color: string }[] = [
    { label: "Received", count: total, color: tokens.primary },
    { label: "Working", count: f.working + f.open, color: `${tokens.primary}cc` },
    { label: "Booked", count: f.booked + f.completed, color: tokens.accent },
    { label: "Not booked", count: f.notBooked, color: "#d97a6e" },
  ];
  const denom = Math.max(1, total);
  const conversionPct = Math.round(summary.requests.conversionRate * 100);

  return (
    <Tile>
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <Eyebrow>Request funnel · {summary.requests.windowDays}d</Eyebrow>
        <span
          className="text-[10.5px] font-semibold tabular-nums"
          style={{ color: conversionPct >= 20 ? tokens.accent : tokens.muted }}
        >
          {conversionPct}% conv
        </span>
      </div>
      {total === 0 ? (
        <div className="py-4 text-[12px]" style={{ color: tokens.muted }}>
          No requests received yet. Inbound enquiries land here.
        </div>
      ) : (
        <div className="space-y-2">
          {stages.map((s) => {
            const pct = Math.round((s.count / denom) * 100);
            return (
              <div key={s.label} className="flex items-center gap-2.5">
                <div className="w-[68px] text-[11.5px] shrink-0" style={{ color: tokens.body }}>
                  {s.label}
                </div>
                <div
                  className="flex-1 h-5 rounded-md overflow-hidden"
                  style={{ background: tokens.ring }}
                >
                  <div
                    className="h-full"
                    style={{
                      width: `${Math.max(4, pct)}%`,
                      background: s.color,
                    }}
                  />
                </div>
                <div className="w-12 text-right tabular-nums">
                  <span className="text-[12px] font-semibold" style={{ color: tokens.heading }}>
                    {s.count}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Tile>
  );
}

// ─── Activity feed tile ───────────────────────────────────────────────────

function ActivityFeedTile({ activity }: { activity: Summary["activity"] }) {
  const { tokens } = useDashboardTheme();
  return (
    <Tile className="overflow-hidden">
      <Eyebrow>Recent activity</Eyebrow>
      {activity.length === 0 ? (
        <div className="mt-3 text-[12px]" style={{ color: tokens.muted }}>
          No activity yet. Drafts, payments, and confirmations appear here.
        </div>
      ) : (
        <ul className="mt-2.5 space-y-2">
          {activity.slice(0, 4).map((e, i) => (
            <li key={i}>
              <Link
                href={e.link}
                className="flex items-start gap-2.5 rounded-lg p-1.5 -mx-1.5 transition group"
                style={{ background: "transparent" }}
              >
                <ActivityIcon kind={e.kind} />
                <div className="flex-1 min-w-0">
                  <div
                    className="text-[12.5px] font-medium leading-snug truncate"
                    style={{ color: tokens.heading }}
                  >
                    {e.label}
                  </div>
                  {e.detail && (
                    <div className="text-[11px] truncate" style={{ color: tokens.muted }}>
                      {e.detail}
                    </div>
                  )}
                </div>
                <div
                  className="text-[10px] shrink-0 tabular-nums"
                  style={{ color: tokens.muted }}
                >
                  {formatRelative(e.at)}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Tile>
  );
}

function ActivityIcon({ kind }: { kind: Summary["activity"][number]["kind"] }) {
  const { tokens } = useDashboardTheme();
  const map: Record<string, { bg: string; fg: string; glyph: string }> = {
    "deposit": { bg: tokens.accentSoft, fg: tokens.accent, glyph: "$" },
    "reservation-confirmed": { bg: tokens.primarySoft, fg: tokens.primary, glyph: "✓" },
    "reservation-sent": { bg: tokens.ring, fg: tokens.body, glyph: "✉" },
    "proposal-created": { bg: tokens.primarySoft, fg: tokens.primary, glyph: "✦" },
  };
  const s = map[kind] ?? map["proposal-created"];
  return (
    <div
      className="w-6 h-6 rounded-md flex items-center justify-center text-[10.5px] font-bold shrink-0 mt-0.5"
      style={{ background: s.bg, color: s.fg }}
    >
      {s.glyph}
    </div>
  );
}

// ─── Quick actions tile ───────────────────────────────────────────────────

function QuickActionsTile({
  onNew,
  creating,
}: {
  onNew: () => void;
  creating: boolean;
  theme: "light" | "dark";
}) {
  const { tokens } = useDashboardTheme();
  const actions: { label: string; href: string; glyph: string }[] = [
    { label: "Import existing", href: "/import", glyph: "↓" },
    { label: "Browse templates", href: "/templates", glyph: "✦" },
    { label: "Properties", href: "/properties", glyph: "▦" },
    { label: "Brand DNA", href: "/settings/brand", glyph: "◆" },
  ];
  return (
    <Tile>
      <Eyebrow>Quick actions</Eyebrow>
      <button
        type="button"
        onClick={onNew}
        disabled={creating}
        className="mt-3 w-full inline-flex items-center justify-center px-3 h-10 rounded-xl text-[13px] font-semibold transition active:scale-[0.97] disabled:opacity-60"
        style={{
          background: tokens.primary,
          color: "#ffffff",
          boxShadow: `0 6px 18px -10px ${tokens.primary}`,
        }}
      >
        {creating ? "Creating…" : "+ New proposal"}
      </button>
      <ul className="mt-3 grid grid-cols-2 gap-1.5">
        {actions.map((a) => (
          <li key={a.href}>
            <Link
              href={a.href}
              className="flex items-center gap-2 px-2.5 h-9 rounded-lg text-[12px] font-medium transition hover:brightness-105"
              style={{
                background: tokens.primarySoft,
                color: tokens.body,
              }}
            >
              <span
                className="w-5 h-5 rounded flex items-center justify-center text-[11px] font-bold shrink-0"
                style={{ background: tokens.tileBg, color: tokens.primary }}
              >
                {a.glyph}
              </span>
              <span className="truncate">{a.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Tile>
  );
}

// ─── Skeleton tile (shown while summary loads) ────────────────────────────

function SkeletonTile({ label }: { label: string }) {
  const { tokens } = useDashboardTheme();
  return (
    <Tile>
      <Eyebrow>{label}</Eyebrow>
      <div className="mt-4 space-y-2">
        <div className="h-3 rounded animate-pulse" style={{ background: tokens.ring }} />
        <div className="h-3 rounded animate-pulse w-3/4" style={{ background: tokens.ring }} />
        <div className="h-3 rounded animate-pulse w-2/3" style={{ background: tokens.ring }} />
      </div>
    </Tile>
  );
}

// ─── Utils ─────────────────────────────────────────────────────────────────

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.round(diffH / 24);
  if (diffD < 30) return `${diffD}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Type-only re-exports for downstream consumers (legacy imports).
export type { DashboardTokens };
