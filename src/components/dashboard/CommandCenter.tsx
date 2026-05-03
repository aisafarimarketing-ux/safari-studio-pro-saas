"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useUser, UserButton } from "@clerk/nextjs";
import { openCommandPalette } from "@/components/CommandPalette";
import {
  DashboardThemeProvider,
  ThemeToggle,
  useDashboardTheme,
  type DashboardTokens,
} from "./DashboardTheme";

// ─── Command Center — premium SaaS dashboard ──────────────────────────────
//
// Page chrome   : nav sidebar (left) + main column.
// Main column   : top bar · hero · 2-col content grid.
// Content grid  : left (~70%) = Hot deals + Needs follow-up + Bookings.
//                 right (~30%) = Activity feed + Tasks.
//
// Wired to /api/dashboard/activity (hot, needsFollowup, recentActivity,
// reservations, scope, canViewAll) plus /api/dashboard/tasks for the
// right-rail task card. Both endpoints are tenant-scoped server-side.
// Status / next-action come precomputed off ProposalActivitySummary;
// no client-side scoring happens here.

// ─── Types — mirror /api/dashboard/activity + /api/dashboard/tasks ──────

type ActivityCard = {
  proposalId: string;
  trackingId: string;
  title: string | null;
  status: string;
  engagementScore: number;
  nextAction: string;
  lastEventAt: string | null;
  lastEventType: string | null;
  client: { id: string; name: string | null } | null;
  consultant: { id: string; name: string | null; email: string | null } | null;
};

type RecentEvent = {
  id: string;
  eventType: string;
  at: string;
  proposal: { id: string; title: string | null; trackingId: string } | null;
  client: { id: string; name: string | null } | null;
};

type ReservationRow = {
  id: string;
  clientName: string;
  arrivalDate: string;
  departureDate: string;
  status: string;
  createdAt: string;
  proposal: { id: string; title: string | null; trackingId: string } | null;
  assignedTo: { id: string; name: string | null; email: string | null } | null;
};

type ActivityResponse = {
  hot: ActivityCard[];
  needsFollowup: ActivityCard[];
  recentActivity: RecentEvent[];
  reservations: ReservationRow[];
  scope: "mine" | "all";
  canViewAll: boolean;
};

type Task = {
  id: string;
  title: string;
  notes: string | null;
  dueAt: string | null;
  overdue: boolean;
  createdAt: string;
  request: {
    id: string;
    referenceNumber: string;
    status: string;
    clientName: string | null;
  } | null;
};

type TasksResponse = { tasks: Task[]; counts: { open: number; overdue: number } };

type SidebarCounts = {
  requests: number;
  proposals: number;
  reservations: number;
  inboxUnread: number;
  tasks: number;
};

type PrioritiesSummary = {
  hotDealsCount: number;
  followupsDueCount: number;
  hotDealsValueCents: number;
  currency: string;
  sidebarCounts: SidebarCounts;
};

type PrioritiesResponse = { summary: PrioritiesSummary };

// ─── Page entry ────────────────────────────────────────────────────────────

export function CommandCenter() {
  return (
    <DashboardThemeProvider>
      <CommandCenterShell />
    </DashboardThemeProvider>
  );
}

function CommandCenterShell() {
  const { tokens } = useDashboardTheme();
  const [activity, setActivity] = useState<ActivityResponse | null>(null);
  const [activityScope, setActivityScope] = useState<"mine" | "all">("mine");
  const [tasksData, setTasksData] = useState<TasksResponse | null>(null);
  const [sidebar, setSidebar] = useState<PrioritiesSummary | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  // Body scroll-lock while the mobile drawer is open.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = mobileNavOpen ? "hidden" : previous || "";
    return () => {
      document.body.style.overflow = previous || "";
    };
  }, [mobileNavOpen]);

  // Activity poll — refetches when the operator flips the Mine/All
  // toggle. 30s cadence so a fresh booking surfaces without a manual
  // refresh.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(
          `/api/dashboard/activity?scope=${activityScope}`,
          { cache: "no-store" },
        );
        if (!res.ok) {
          if (!cancelled) setLoadFailed(true);
          return;
        }
        if (!cancelled) {
          setActivity((await res.json()) as ActivityResponse);
          setLoadFailed(false);
        }
      } catch {
        if (!cancelled) setLoadFailed(true);
      }
    };
    void load();
    const interval = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [activityScope]);

  // Tasks — right-rail card.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/dashboard/tasks?limit=12", {
          cache: "no-store",
        });
        if (!res.ok) return;
        if (!cancelled) setTasksData((await res.json()) as TasksResponse);
      } catch {
        /* secondary surface — silent */
      }
    };
    void load();
    const interval = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Sidebar nav badges + currency reading. /api/dashboard/priorities
  // already aggregates these counts; we read the summary block only.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/dashboard/priorities?filter=all&limit=1", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as PrioritiesResponse;
        if (!cancelled) setSidebar(data.summary);
      } catch {
        /* nav badges stay null on failure — sidebar still renders */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      className="min-h-screen lg:grid"
      style={{
        background: tokens.pageBg,
        gridTemplateColumns: "260px minmax(0, 1fr)",
      }}
    >
      <CommandSidebar
        sidebarCounts={sidebar?.sidebarCounts}
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
      />

      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-30 lg:hidden"
          style={{
            background: "rgba(13,38,32,0.4)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
          }}
          onClick={() => setMobileNavOpen(false)}
          aria-hidden
        />
      )}

      <main className="px-5 py-5 md:px-7 md:py-6 min-w-0 space-y-5">
        <CommandTopBar onOpenSidebar={() => setMobileNavOpen(true)} />

        <Hero
          activity={activity}
          loadFailed={loadFailed}
          scope={activityScope}
          onScopeChange={setActivityScope}
        />

        {/* Dense 2-col content grid: left = hot + (followup | bookings),
            right = activity + tasks. Tighter gaps and per-section row
            caps inside each component keep the whole dashboard inside
            one viewport on a 1080p+ screen without scrolling. */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)] gap-5">
          <div className="min-w-0 space-y-5">
            <HotDealsSection cards={activity?.hot ?? null} loadFailed={loadFailed} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <NeedsFollowupSection
                cards={activity?.needsFollowup ?? null}
                loadFailed={loadFailed}
              />
              <BookingsSection
                rows={activity?.reservations ?? null}
                loadFailed={loadFailed}
              />
            </div>
          </div>
          <aside className="min-w-0 space-y-5">
            <ActivityFeed events={activity?.recentActivity ?? null} />
            <TasksCard tasks={tasksData?.tasks ?? null} counts={tasksData?.counts ?? null} />
          </aside>
        </div>
      </main>
    </div>
  );
}

// ─── LEFT — global navigation sidebar ──────────────────────────────────────

function CommandSidebar({
  sidebarCounts,
  mobileOpen,
  onMobileClose,
}: {
  sidebarCounts: SidebarCounts | undefined;
  mobileOpen: boolean;
  onMobileClose: () => void;
}) {
  const { tokens } = useDashboardTheme();
  return (
    <aside
      className={`
        z-40 w-[260px] flex flex-col
        fixed inset-y-0 left-0 transition-transform duration-200 ease-out
        lg:static lg:transition-none lg:translate-x-0
        ${mobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full lg:translate-x-0"}
      `}
      style={{
        background: tokens.tileBg,
        borderRight: `1px solid ${tokens.ring}`,
      }}
    >
      <div className="px-5 py-5" style={{ borderBottom: `1px solid ${tokens.ring}` }}>
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-base"
            style={{ background: tokens.accentSoft, color: tokens.accent }}
          >
            S
          </div>
          <span
            className="text-[15px] font-semibold tracking-tight"
            style={{ color: tokens.heading }}
          >
            Safari Studio
          </span>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto py-4" onClick={onMobileClose}>
        <SidebarGroup label="Work">
          <SidebarItem href="/dashboard" label="Overview" active />
          <SidebarItem href="/requests" label="Requests" badge={sidebarCounts?.requests} />
          <SidebarItem href="/proposals" label="Proposals" badge={sidebarCounts?.proposals} />
          <SidebarItem href="/properties" label="Property Library" />
          <SidebarItem
            href="/settings/brand#visualStyle"
            label="Image Library"
          />
          <SidebarItem
            href="/reservations"
            label="Reservations"
            badge={sidebarCounts?.reservations}
          />
        </SidebarGroup>

        <SidebarGroup label="Workspace">
          <SidebarItem href="/settings/brand" label="Brand DNA" />
          <SidebarItem href="/settings/team" label="Team" />
        </SidebarGroup>

        <SidebarGroup label="Insights">
          <SidebarItem href="/analytics" label="Analytics" />
        </SidebarGroup>

        <SidebarGroup label="System">
          <SidebarItem href="/requests" label="Inbox" badge={sidebarCounts?.inboxUnread} />
          <SidebarItem href="/requests" label="Tasks" badge={sidebarCounts?.tasks} />
          <SidebarItem href="/settings" label="Settings" />
        </SidebarGroup>
      </nav>

      <div
        className="px-4 py-3 flex items-center gap-2.5"
        style={{ borderTop: `1px solid ${tokens.ring}` }}
      >
        <UserButton />
      </div>
    </aside>
  );
}

function SidebarGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const { tokens } = useDashboardTheme();
  return (
    <div className="px-3 mt-2 mb-3">
      <div
        className="px-2 mb-1 text-[10px] uppercase tracking-[0.22em] font-semibold"
        style={{ color: tokens.muted }}
      >
        {label}
      </div>
      <div>{children}</div>
    </div>
  );
}

function SidebarItem({
  href,
  label,
  badge,
  active = false,
}: {
  href: string;
  label: string;
  badge?: number;
  active?: boolean;
}) {
  const { tokens } = useDashboardTheme();
  return (
    <Link
      href={href}
      className="flex items-center justify-between px-2 py-1.5 rounded-md text-[13px] transition"
      style={{
        background: active ? tokens.primarySoft : "transparent",
        color: active ? tokens.primary : tokens.body,
        fontWeight: active ? 600 : 500,
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = tokens.ring;
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = "transparent";
      }}
    >
      <span className="truncate">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span
          className="ml-2 text-[10.5px] tabular-nums px-1.5 py-0.5 rounded-full font-semibold"
          style={{ background: tokens.primarySoft, color: tokens.primary }}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}

// ─── TOP BAR — greeting + search + notifications + theme toggle ────────────

function CommandTopBar({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  const { user } = useUser();
  const { tokens } = useDashboardTheme();
  const greetingName = (user?.firstName ?? user?.username ?? "").trim();
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 5) return "Working late";
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          type="button"
          onClick={onOpenSidebar}
          aria-label="Open menu"
          className="lg:hidden w-9 h-9 rounded-full flex items-center justify-center transition shrink-0"
          style={{
            background: tokens.tileBg,
            border: `1px solid ${tokens.ring}`,
            color: tokens.body,
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          >
            <path d="M2.5 4 H13.5 M2.5 8 H13.5 M2.5 12 H13.5" />
          </svg>
        </button>

        <div className="min-w-0">
          <h1
            className="text-[22px] md:text-[26px] font-bold leading-tight truncate"
            style={{
              color: tokens.heading,
              fontFamily: "'Playfair Display', Georgia, serif",
              letterSpacing: "-0.01em",
            }}
          >
            {greeting}
            {greetingName ? `, ${greetingName}` : ""}.
          </h1>
          <div
            className="text-[13px] mt-0.5 truncate"
            style={{ color: tokens.muted }}
          >
            Here&apos;s what&apos;s moving today.
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <IconBtn label="Search (⌘K)" onClick={openCommandPalette}>
          <SearchIcon />
        </IconBtn>
        <IconBtn label="Notifications">
          <BellIcon />
        </IconBtn>
        <ThemeToggle />
      </div>
    </div>
  );
}

function IconBtn({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick?: () => void;
}) {
  const { tokens } = useDashboardTheme();
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="w-9 h-9 rounded-full flex items-center justify-center transition-[border-color,transform,background] duration-[120ms] ease-out active:scale-[0.94] active:duration-[60ms]"
      style={{
        background: tokens.tileBg,
        border: `1px solid ${tokens.ring}`,
        color: tokens.body,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = tokens.ringHover;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = tokens.ring;
      }}
    >
      {children}
    </button>
  );
}

function SearchIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    >
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5 L13 13" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3.5 11.5h9l-1.2-2v-3a3.3 3.3 0 0 0-6.6 0v3l-1.2 2Z" />
      <path d="M6.5 13.2a1.6 1.6 0 0 0 3 0" />
    </svg>
  );
}

// ─── HERO ──────────────────────────────────────────────────────────────────

function Hero({
  activity,
  loadFailed,
  scope,
  onScopeChange,
}: {
  activity: ActivityResponse | null;
  loadFailed: boolean;
  scope: "mine" | "all";
  onScopeChange: (s: "mine" | "all") => void;
}) {
  const { tokens } = useDashboardTheme();

  const hotCount = activity?.hot.length ?? 0;
  const followupCount = activity?.needsFollowup.length ?? 0;
  const reservationsCount = activity?.reservations.length ?? 0;
  const canViewAll = activity?.canViewAll ?? false;

  return (
    <section
      className="relative overflow-hidden rounded-xl px-6 py-4 md:px-7 md:py-5"
      style={{
        background: tokens.heroBg,
        boxShadow: "0 8px 24px -14px rgba(13,38,32,0.5)",
      }}
    >
      {/* Subtle corner glow only — dot grid removed for crispness. */}
      <div
        aria-hidden
        className="absolute right-0 bottom-0 w-1/2 h-full pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 100% 100%, rgba(212,183,101,0.18) 0%, transparent 55%)`,
        }}
      />

      <div className="relative flex items-center gap-5 flex-wrap lg:flex-nowrap">
        {/* Eyebrow + scope toggle — vertical stack on the left so the
            stats own the centre of the hero. */}
        <div className="shrink-0">
          <div
            className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.26em] font-semibold whitespace-nowrap"
            style={{ color: tokens.accent }}
          >
            <span aria-hidden>🔥</span> Today&apos;s focus
          </div>
          {canViewAll && (
            <div
              className="mt-2 inline-flex items-center gap-1 rounded-full p-0.5"
              style={{ background: "rgba(255,255,255,0.08)" }}
            >
              <ScopePill active={scope === "mine"} onClick={() => onScopeChange("mine")} label="Mine" />
              <ScopePill active={scope === "all"} onClick={() => onScopeChange("all")} label="Team" />
            </div>
          )}
        </div>

        {/* Stats — three numbers inline, the visual centre of the hero. */}
        <div className="flex items-center gap-6 md:gap-9 flex-1 min-w-0">
          <Stat label="Hot" value={hotCount} loading={!activity && !loadFailed} />
          <Divider />
          <Stat label="Follow-up" value={followupCount} loading={!activity && !loadFailed} />
          <Divider />
          <Stat label="Bookings" value={reservationsCount} loading={!activity && !loadFailed} />
        </div>

        {/* CTAs — pinned right, never wrap below stats on lg+. */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={() => scrollToId("dash-hot-deals")}
            disabled={hotCount === 0}
            className="px-3.5 h-9 rounded-md text-[12.5px] font-semibold transition-[filter,transform,background] duration-[120ms] ease-out disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 active:scale-[0.96] active:duration-[60ms]"
            style={{ background: tokens.accent, color: "#1a1a1a" }}
          >
            View hot deals →
          </button>
          <button
            type="button"
            onClick={() => scrollToId("dash-followup")}
            className="px-3.5 h-9 rounded-md text-[12.5px] font-semibold text-white transition-[filter,transform,background] duration-[120ms] ease-out hover:brightness-110 active:scale-[0.96] active:duration-[60ms]"
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.22)",
            }}
          >
            Send follow-ups
          </button>
        </div>
      </div>
    </section>
  );
}

// Hairline between hero stats so the three numbers read as a row of
// linked metrics rather than disconnected blocks.
function Divider() {
  return (
    <div
      aria-hidden
      className="w-px h-9 shrink-0"
      style={{ background: "rgba(255,255,255,0.12)" }}
    />
  );
}

function Stat({
  label,
  value,
  loading,
}: {
  label: string;
  value: number;
  loading: boolean;
}) {
  return (
    <div className="min-w-0">
      <div
        className="text-[9px] uppercase tracking-[0.20em] font-semibold text-white/45"
      >
        {label}
      </div>
      <div
        className="mt-0.5 leading-[0.95] tabular-nums text-white"
        style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: "clamp(34px, 4.4vw, 46px)",
          fontWeight: 800,
          letterSpacing: "-0.025em",
        }}
      >
        {loading ? (
          <span className="inline-block w-12 h-9 rounded animate-pulse bg-white/10" />
        ) : (
          value
        )}
      </div>
    </div>
  );
}

function ScopePill({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-1 rounded-full text-[11.5px] font-semibold transition"
      style={{
        background: active ? "rgba(255,255,255,0.95)" : "transparent",
        color: active ? "#1b3a2d" : "rgba(255,255,255,0.78)",
      }}
    >
      {label}
    </button>
  );
}

// ─── HOT DEALS — 2-card responsive grid ────────────────────────────────────

function HotDealsSection({
  cards,
  loadFailed,
}: {
  cards: ActivityCard[] | null;
  loadFailed: boolean;
}) {
  // Cap visible cards at 4 (a 2x2 grid) so the section stays inside
  // one viewport. Anything beyond bubbles up via the count chip on
  // the section header.
  const visible = cards?.slice(0, 4);
  return (
    <section id="dash-hot-deals">
      <SectionHeader
        title="Hot deals"
        emoji="🔥"
        subtitle="Highest-engagement proposals right now."
        count={cards?.length}
      />
      {loadFailed ? (
        <EmptyCard message="Couldn't load. Refresh to try again." />
      ) : visible === undefined ? (
        <CardGrid>
          <DealCardSkeleton />
          <DealCardSkeleton />
        </CardGrid>
      ) : visible.length === 0 ? (
        <EmptyCard
          message="Quiet right now. Send a proposal — hot deals show up here as guests engage."
          cta={{ label: "Open proposals", href: "/proposals" }}
        />
      ) : (
        <CardGrid>
          {visible.map((c) => (
            <DealCard key={c.proposalId} card={c} />
          ))}
        </CardGrid>
      )}
    </section>
  );
}

function CardGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>;
}

function DealCard({ card }: { card: ActivityCard }) {
  const { tokens } = useDashboardTheme();
  const initial = (card.client?.name ?? "·").trim().charAt(0).toUpperCase();
  const tripSummary = card.title?.trim() || "Untitled proposal";
  const reason = formatActivityReason(card.lastEventType, card.lastEventAt);
  const isHot = card.status === "hot";
  const isVeryHot = card.engagementScore >= 120;
  const isFresh = isRecent(card.lastEventAt, 10 * 60_000);
  const statusLabel = isVeryHot ? "VERY HOT" : isHot ? "HOT" : card.status.toUpperCase();

  // Hot cards signal status via a thick left accent strip + a
  // tinted border + the StatusPill. Strip is 4px on hot (vs 0 on
  // neutral) so the urgency reads at a glance even before the eye
  // resolves the score.
  const accentStrip = isVeryHot
    ? "#dc2626"
    : isHot
      ? "rgba(220,38,38,0.65)"
      : "transparent";
  const stripWidth = isHot || isVeryHot ? 4 : 0;
  const border = isVeryHot
    ? "rgba(220,38,38,0.35)"
    : isHot
      ? "rgba(220,38,38,0.22)"
      : tokens.ringHover;

  // VERY HOT cards animate the ss-hot-pulse keyframe (existing).
  // "Just touched" deals (event in the last ~10min) get ss-fresh.
  const animClass = isVeryHot ? "ss-hot-pulse" : isFresh ? "ss-fresh" : "";

  return (
    <article
      className={`relative rounded-xl p-4 overflow-hidden transition-all duration-150 ease-out ${animClass}`}
      style={{
        background: tokens.tileBg,
        border: `1px solid ${border}`,
        boxShadow: tokens.shadow,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-1px)";
        e.currentTarget.style.boxShadow = tokens.shadowHover;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = tokens.shadow;
      }}
    >
      {/* Left accent strip — flags HOT/VERY HOT without tinting the
          card body, so the surface stays calm and contrast stays high. */}
      <div
        aria-hidden
        className="absolute left-0 top-0 bottom-0"
        style={{ background: accentStrip, width: stripWidth }}
      />

      <div className="flex items-start gap-3">
        <Avatar initial={initial} tokens={tokens} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3
              className="text-[14.5px] truncate"
              style={{
                color: tokens.heading,
                fontWeight: 700,
                letterSpacing: "-0.005em",
              }}
              title={card.client?.name ?? ""}
            >
              {card.client?.name ?? "Unknown client"}
            </h3>
            <StatusPill label={statusLabel} variant={isVeryHot ? "very-hot" : isHot ? "hot" : "neutral"} />
          </div>
          <div
            className="text-[11.5px] truncate mt-0.5"
            style={{ color: tokens.body }}
            title={tripSummary}
          >
            {tripSummary}
          </div>
          <div
            className="text-[11.5px] mt-1.5 flex items-center gap-1.5 flex-wrap"
          >
            {isRecent(card.lastEventAt, 5 * 60_000) && (
              <span className="ss-recency-dot" aria-label="Activity in the last 5 minutes" />
            )}
            <span style={{ color: tokens.heading, fontWeight: 600 }}>{reason.action}</span>
            <span aria-hidden style={{ color: tokens.muted }}>•</span>
            <span style={{ color: tokens.muted }}>{reason.when}</span>
          </div>
        </div>

        <div className="text-right shrink-0">
          <div
            className="text-[26px] leading-none tabular-nums"
            style={{
              color: tokens.heading,
              fontFamily: "'Playfair Display', Georgia, serif",
              fontWeight: 800,
              letterSpacing: "-0.02em",
            }}
          >
            {card.engagementScore}
          </div>
          <div
            className="text-[9px] uppercase tracking-[0.22em] font-semibold mt-0.5"
            style={{ color: tokens.muted }}
          >
            score
          </div>
        </div>
      </div>

      {/* Next action chip — explicitly labelled so the operator
          always knows what to do next on this deal at a glance,
          without having to read the activity line and guess. */}
      <div
        className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] max-w-full"
        style={{
          background: tokens.primarySoft,
          color: tokens.primary,
          border: `1px solid ${tokens.ring}`,
        }}
      >
        <span
          className="text-[9px] uppercase tracking-[0.18em] font-bold shrink-0"
          style={{ opacity: 0.7 }}
        >
          Next
        </span>
        <span
          className="font-semibold truncate"
          title={card.nextAction}
        >
          {card.nextAction}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <PrimaryBtn href={`/studio/${card.proposalId}`} emphasis>
          Open proposal
        </PrimaryBtn>
        <GhostBtn href={`/studio/${card.proposalId}`}>Follow up</GhostBtn>
      </div>
    </article>
  );
}

function Avatar({ initial, tokens }: { initial: string; tokens: DashboardTokens }) {
  return (
    <div
      className="shrink-0 flex items-center justify-center font-bold"
      style={{
        width: 36,
        height: 36,
        borderRadius: "50%",
        // Avatar surface uses primaryStrong (deep forest in both
        // modes) so the white initial stays readable in dark.
        background: tokens.primaryStrong,
        color: "#fff",
        fontSize: 14,
        letterSpacing: "0.02em",
      }}
      aria-hidden
    >
      {initial}
    </div>
  );
}

function StatusPill({
  label,
  variant,
}: {
  label: string;
  variant: "very-hot" | "hot" | "neutral";
}) {
  if (variant === "very-hot") {
    return (
      <span
        className="text-[10px] uppercase tracking-[0.22em] font-bold px-2 py-1 rounded-md shrink-0 inline-flex items-center gap-1"
        style={{
          background: "linear-gradient(135deg, #dc2626 0%, #991b1b 100%)",
          color: "#fff",
          boxShadow: "0 4px 14px -4px rgba(220,38,38,0.45)",
        }}
      >
        <span aria-hidden style={{ filter: "saturate(1.5)" }}>🔥</span>
        {label}
      </span>
    );
  }
  if (variant === "hot") {
    return (
      <span
        className="text-[10px] uppercase tracking-[0.22em] font-bold px-2 py-1 rounded-md shrink-0"
        style={{
          background: "#fee2e2",
          color: "#b91c1c",
          boxShadow: "inset 0 0 0 1px rgba(220,38,38,0.18)",
        }}
      >
        {label}
      </span>
    );
  }
  return (
    <span
      className="text-[10px] uppercase tracking-[0.22em] font-bold px-2 py-1 rounded-md shrink-0"
      style={{
        background: "rgba(0,0,0,0.06)",
        color: "rgba(0,0,0,0.6)",
      }}
    >
      {label}
    </span>
  );
}

function DealCardSkeleton() {
  const { tokens } = useDashboardTheme();
  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: tokens.tileBg,
        boxShadow: `inset 0 0 0 1px ${tokens.ring}, ${tokens.shadow}`,
      }}
    >
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-full animate-pulse" style={{ background: tokens.ring }} />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 rounded w-1/2 animate-pulse" style={{ background: tokens.ring }} />
          <div className="h-3 rounded w-3/4 animate-pulse" style={{ background: tokens.ring }} />
          <div className="h-3 rounded w-1/3 animate-pulse" style={{ background: tokens.ring }} />
        </div>
      </div>
    </div>
  );
}

// ─── NEEDS FOLLOW-UP — list ────────────────────────────────────────────────

function NeedsFollowupSection({
  cards,
  loadFailed,
}: {
  cards: ActivityCard[] | null;
  loadFailed: boolean;
}) {
  const { tokens } = useDashboardTheme();
  // Cap to 4 visible rows; the count chip on the header surfaces the
  // total when there are more.
  const visible = cards?.slice(0, 4);
  return (
    <section id="dash-followup">
      <SectionHeader
        title="Follow-up"
        emoji="⚠️"
        subtitle="Quiet 48h+."
        count={cards?.length}
      />
      {loadFailed ? (
        <EmptyCard message="Couldn't load." />
      ) : visible === undefined ? (
        <ListSkeleton rows={3} />
      ) : visible.length === 0 ? (
        <EmptyCard message="Every active deal has had recent attention." />
      ) : (
        <ul
          className="rounded-xl overflow-hidden"
          style={{
            background: tokens.tileBg,
            // Subtle amber-tinted border to read as a soft warning
            // without screaming. Distinct from hot deals' red
            // urgency and bookings' neutral surface.
            border: `1px solid rgba(217,119,6,0.20)`,
            boxShadow: tokens.shadow,
          }}
        >
          {visible.map((c, i) => (
            <FollowupRow key={c.proposalId} card={c} divider={i > 0} />
          ))}
        </ul>
      )}
    </section>
  );
}

function FollowupRow({ card, divider }: { card: ActivityCard; divider: boolean }) {
  const { tokens } = useDashboardTheme();
  const sinceLabel = card.lastEventAt
    ? formatRelative(card.lastEventAt)
    : "recently";
  return (
    <li
      className="flex items-center gap-3 px-3.5 py-2.5 transition"
      style={{ borderTop: divider ? `1px solid ${tokens.ring}` : "none" }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = tokens.primarySoft;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      <div className="flex-1 min-w-0">
        <div
          className="text-[13px] truncate"
          style={{ color: tokens.heading, fontWeight: 600 }}
        >
          {card.client?.name ?? "Unknown client"}
        </div>
        <div
          className="text-[11px] truncate mt-0.5"
          style={{ color: tokens.muted }}
        >
          Viewed {sinceLabel} · no reply
        </div>
      </div>
      <div className="shrink-0">
        <PrimaryBtn href={`/studio/${card.proposalId}`}>Follow up</PrimaryBtn>
      </div>
    </li>
  );
}

// ─── BOOKINGS — list ───────────────────────────────────────────────────────

function BookingsSection({
  rows,
  loadFailed,
}: {
  rows: ReservationRow[] | null;
  loadFailed: boolean;
}) {
  const { tokens } = useDashboardTheme();
  // Show 3 rows fully; if there's a 4th+, scroll inside the card so
  // the dashboard's vertical rhythm stays predictable.
  const visible = rows?.slice(0, 6);
  const overflowsScroll = (rows?.length ?? 0) > 3;
  return (
    <section id="dash-bookings">
      <SectionHeader
        title="Bookings"
        emoji="💰"
        subtitle="Submitted from proposal."
        count={rows?.length}
      />
      {loadFailed ? (
        <EmptyCard message="Couldn't load." />
      ) : visible === undefined ? (
        <ListSkeleton rows={2} />
      ) : visible.length === 0 ? (
        <EmptyCard
          message="No bookings yet. Share a proposal so a guest can request to book."
          cta={{ label: "Open proposals", href: "/proposals" }}
        />
      ) : (
        <ul
          className={`rounded-xl ${overflowsScroll ? "overflow-y-auto" : "overflow-hidden"}`}
          style={{
            background: tokens.tileBg,
            border: `1px solid ${tokens.ring}`,
            boxShadow: tokens.shadow,
            // Cap height at exactly 3 rows when more exist, so the
            // section reads as bounded and the rest scrolls.
            maxHeight: overflowsScroll ? "calc(3 * 60px)" : undefined,
          }}
        >
          {visible.map((r, i) => (
            <BookingRow key={r.id} row={r} divider={i > 0} />
          ))}
        </ul>
      )}
    </section>
  );
}

function BookingRow({ row, divider }: { row: ReservationRow; divider: boolean }) {
  const { tokens } = useDashboardTheme();
  const dates = `${formatShortDate(row.arrivalDate)} → ${formatShortDate(row.departureDate)}`;
  const href = row.proposal ? `/studio/${row.proposal.id}` : "#";
  // Bookings created in the last 24h get a NEW chip + a slightly
  // tinted background. The accent surfaces "newest first" without
  // changing the list order or adding a separate section.
  const isNew = isRecent(row.createdAt, 24 * 3_600_000);
  return (
    <li
      className="flex items-center gap-3 px-3.5 py-2.5 transition"
      style={{
        borderTop: divider ? `1px solid ${tokens.ring}` : "none",
        background: isNew ? "rgba(22,163,74,0.06)" : "transparent",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = isNew
          ? "rgba(22,163,74,0.10)"
          : tokens.primarySoft;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = isNew
          ? "rgba(22,163,74,0.06)"
          : "transparent";
      }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {isNew && (
            <span
              className="text-[8.5px] uppercase tracking-[0.18em] font-bold px-1.5 py-0.5 rounded shrink-0"
              style={{ background: "#dcfce7", color: "#166534" }}
            >
              New
            </span>
          )}
          <div
            className="text-[13px] truncate"
            style={{ color: tokens.heading, fontWeight: 600 }}
          >
            {row.clientName}
          </div>
        </div>
        <div
          className="text-[11px] truncate mt-0.5 tabular-nums"
          style={{ color: tokens.muted }}
        >
          {dates}
        </div>
      </div>
      <div className="shrink-0">
        <SecondaryBtn href={href}>Open booking</SecondaryBtn>
      </div>
    </li>
  );
}

// ─── RIGHT — Activity feed ─────────────────────────────────────────────────

function ActivityFeed({ events }: { events: RecentEvent[] | null }) {
  const { tokens } = useDashboardTheme();
  return (
    <section
      className="rounded-xl p-4"
      style={{
        background: tokens.tileBg,
        border: `1px solid ${tokens.ring}`,
        boxShadow: tokens.shadow,
      }}
    >
      <div className="flex items-baseline justify-between gap-2 mb-2.5">
        <h3
          className="text-[14px] font-semibold"
          style={{
            color: tokens.heading,
            fontFamily: "'Playfair Display', Georgia, serif",
            letterSpacing: "-0.005em",
          }}
        >
          Client activity
        </h3>
        <Link
          href="/analytics"
          className="text-[11px] font-semibold"
          style={{ color: tokens.primary }}
        >
          View all →
        </Link>
      </div>

      {events === null ? (
        <ListSkeleton rows={4} compact />
      ) : events.length === 0 ? (
        <div
          className="py-3 text-[12px] leading-relaxed text-center"
          style={{ color: tokens.body }}
        >
          Quiet so far.
          <div className="mt-2">
            <Link
              href="/proposals"
              className="text-[11.5px] font-semibold"
              style={{ color: tokens.primary }}
            >
              Send a proposal →
            </Link>
          </div>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {events.slice(0, 6).map((e) => (
            <ActivityRow key={e.id} event={e} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ActivityRow({ event }: { event: RecentEvent }) {
  const { tokens } = useDashboardTheme();
  const tone = activityTone(event.eventType);
  const label = activityLabel(event);
  const fresh = isRecent(event.at, 5 * 60_000);
  return (
    <li className="flex items-start gap-3">
      <div
        className="w-7 h-7 rounded-md flex items-center justify-center text-[12px] shrink-0 mt-0.5"
        style={{ background: tone.bg, color: tone.fg }}
        aria-hidden
      >
        {tone.glyph}
      </div>
      <div className="flex-1 min-w-0">
        {/* Three-tier hierarchy: event (heading weight) > client/
            proposal context (body) > nothing else fights for
            attention. */}
        <div
          className="text-[12.5px] leading-snug truncate"
          style={{ color: tokens.heading, fontWeight: 600 }}
        >
          {label}
        </div>
        {event.proposal && (
          <div
            className="text-[11px] truncate mt-0.5"
            style={{ color: tokens.body }}
          >
            {event.proposal.title || "Untitled proposal"}
            <span className="opacity-60"> · {event.proposal.trackingId}</span>
          </div>
        )}
      </div>
      <div
        className="text-[11px] tabular-nums whitespace-nowrap shrink-0 mt-0.5 inline-flex items-center gap-1.5"
        style={{
          color: fresh ? tokens.heading : tokens.body,
          fontWeight: fresh ? 600 : 500,
        }}
      >
        {fresh && (
          <span className="ss-recency-dot" aria-label="Just happened" />
        )}
        <span>{formatRelative(event.at)}</span>
      </div>
    </li>
  );
}

// ─── RIGHT — Tasks card ────────────────────────────────────────────────────

function TasksCard({
  tasks,
  counts,
}: {
  tasks: Task[] | null;
  counts: { open: number; overdue: number } | null;
}) {
  const { tokens } = useDashboardTheme();
  return (
    <section
      className="rounded-xl p-4"
      style={{
        background: tokens.tileBg,
        border: `1px solid ${tokens.ring}`,
        boxShadow: tokens.shadow,
      }}
    >
      <div className="flex items-baseline justify-between gap-2 mb-2.5">
        <h3
          className="text-[14px] font-semibold"
          style={{
            color: tokens.heading,
            fontFamily: "'Playfair Display', Georgia, serif",
            letterSpacing: "-0.005em",
          }}
        >
          Today&apos;s tasks
        </h3>
        {counts && counts.overdue > 0 && (
          <span
            className="text-[10px] tabular-nums px-1.5 py-0.5 rounded font-semibold"
            style={{ background: "#fee2e2", color: "#b91c1c" }}
          >
            {counts.overdue} overdue
          </span>
        )}
      </div>

      {tasks === null ? (
        <ListSkeleton rows={3} compact />
      ) : tasks.length === 0 ? (
        <div
          className="py-3 text-[12px] text-center"
          style={{ color: tokens.muted }}
        >
          No open tasks. Add one from a deal.
        </div>
      ) : (
        <ul className="space-y-1">
          {tasks.slice(0, 4).map((t) => (
            <TaskRow key={t.id} task={t} />
          ))}
        </ul>
      )}

      <div className="mt-3">
        <PrimaryBtn href="/requests" full>
          + Add task
        </PrimaryBtn>
      </div>
    </section>
  );
}

function TaskRow({ task }: { task: Task }) {
  const { tokens } = useDashboardTheme();
  const dueLabel = formatDueLabel(task.dueAt);
  const tone = task.overdue ? "#b91c1c" : tokens.primary;
  return (
    <li>
      <Link
        href={task.request ? `/requests/${task.request.id}` : "#"}
        className="block rounded-lg px-3 py-2 transition"
        style={{ background: "transparent" }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = tokens.primarySoft;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
        }}
      >
        <div className="flex items-start gap-2.5">
          <div className="flex-1 min-w-0">
            <div
              className="text-[12.5px] font-medium truncate"
              style={{ color: tokens.heading }}
            >
              {task.title}
            </div>
            <div
              className="text-[10.5px] truncate mt-0.5"
              style={{ color: tokens.muted }}
            >
              {task.request?.clientName ?? "—"}
            </div>
          </div>
          <div
            className="text-[10px] uppercase tracking-[0.18em] font-semibold shrink-0 mt-0.5"
            style={{ color: tone }}
          >
            {task.overdue ? "Overdue" : dueLabel}
          </div>
        </div>
      </Link>
    </li>
  );
}

// ─── Reusable bits ─────────────────────────────────────────────────────────

function SectionHeader({
  title,
  emoji,
  subtitle,
  count,
}: {
  title: string;
  emoji: string;
  subtitle: string;
  count?: number;
}) {
  const { tokens } = useDashboardTheme();
  return (
    <div className="flex items-baseline justify-between gap-3 mb-3">
      <div className="min-w-0">
        <h2
          className="text-[16px] md:text-[18px] leading-[1.1]"
          style={{
            color: tokens.heading,
            fontFamily: "'Playfair Display', Georgia, serif",
            fontWeight: 700,
            letterSpacing: "-0.012em",
          }}
        >
          <span aria-hidden className="mr-1.5">
            {emoji}
          </span>
          {title}
          {typeof count === "number" && count > 0 && (
            <span
              className="ml-2 text-[11px] font-bold tabular-nums px-2 py-0.5 rounded-full align-middle"
              style={{ background: tokens.primarySoft, color: tokens.primary }}
            >
              {count}
            </span>
          )}
        </h2>
        <div
          className="text-[11.5px] mt-1"
          style={{ color: tokens.muted }}
        >
          {subtitle}
        </div>
      </div>
    </div>
  );
}

function PrimaryBtn({
  href,
  children,
  full = false,
  emphasis = false,
}: {
  href: string;
  children: React.ReactNode;
  full?: boolean;
  /** Boosts size, weight, and shadow so the button reads as the
   *  dominant action on the card — used inside hot deal cards where
   *  the primary CTA needs to feel decisive. */
  emphasis?: boolean;
}) {
  const { tokens } = useDashboardTheme();
  const sizeClass = emphasis
    ? "px-5 h-11 rounded-xl text-[13.5px]"
    : "px-3.5 h-9 rounded-lg text-[12.5px]";
  const shadow = emphasis
    ? `0 8px 22px -10px ${tokens.primaryStrong}, 0 2px 6px -2px rgba(13,38,32,0.18)`
    : "none";
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center font-semibold transition-[filter,transform,box-shadow] duration-[120ms] ease-out active:scale-[0.96] active:duration-[60ms] ${sizeClass} ${
        full ? "w-full" : ""
      }`}
      style={{
        background: tokens.primaryStrong,
        color: "#fff",
        fontWeight: emphasis ? 700 : 600,
        letterSpacing: emphasis ? "0.005em" : undefined,
        boxShadow: shadow,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.filter = "brightness(1.08)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.filter = "none";
      }}
    >
      {children}
    </Link>
  );
}

function SecondaryBtn({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const { tokens } = useDashboardTheme();
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center px-3.5 h-9 rounded-lg text-[12.5px] font-semibold transition-[border-color,transform,background] duration-[120ms] ease-out active:scale-[0.96] active:duration-[60ms]"
      style={{
        background: "transparent",
        color: tokens.body,
        border: `1px solid ${tokens.ring}`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = tokens.ringHover;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = tokens.ring;
      }}
    >
      {children}
    </Link>
  );
}

// Quieter than SecondaryBtn — text-only, no border. Used inside hot
// deal cards so the eye lands first on the emphasised primary CTA;
// "Follow up" is still discoverable but reads as a tertiary action.
function GhostBtn({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const { tokens } = useDashboardTheme();
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center px-3 h-11 rounded-lg text-[12.5px] font-medium transition-[color,background,transform] duration-[120ms] ease-out active:scale-[0.96] active:duration-[60ms]"
      style={{ background: "transparent", color: tokens.muted }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = tokens.body;
        e.currentTarget.style.background = tokens.primarySoft;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = tokens.muted;
        e.currentTarget.style.background = "transparent";
      }}
    >
      {children}
    </Link>
  );
}

function EmptyCard({
  message,
  cta,
}: {
  message: string;
  cta?: { label: string; href: string };
}) {
  const { tokens } = useDashboardTheme();
  return (
    <div
      className="rounded-xl py-6 px-4 text-center"
      style={{
        background: tokens.tileBg,
        border: `1px solid ${tokens.ring}`,
      }}
    >
      <div
        className="text-[12.5px] leading-relaxed"
        style={{ color: tokens.body }}
      >
        {message}
      </div>
      {cta && (
        <div className="mt-3">
          <PrimaryBtn href={cta.href}>{cta.label}</PrimaryBtn>
        </div>
      )}
    </div>
  );
}

function ListSkeleton({ rows, compact = false }: { rows: number; compact?: boolean }) {
  const { tokens } = useDashboardTheme();
  return (
    <div
      className={`rounded-2xl ${compact ? "p-0" : "p-5"} space-y-2.5`}
      style={
        compact
          ? {}
          : {
              background: tokens.tileBg,
              boxShadow: `inset 0 0 0 1px ${tokens.ring}`,
            }
      }
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <div
            className="h-3 rounded animate-pulse"
            style={{ background: tokens.ring, width: `${50 + (i % 3) * 15}%` }}
          />
          <div
            className="h-2.5 rounded animate-pulse"
            style={{ background: tokens.ring, width: `${30 + (i % 2) * 20}%` }}
          />
        </div>
      ))}
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function scrollToId(id: string) {
  if (typeof document === "undefined") return;
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// True when the timestamp is within `windowMs` of now. Used to gate
// the live-pulse decorations: recency dot (5min) on activity rows
// and "just touched" ring (10min) on deal cards. Returns false on
// missing / invalid timestamps so the caller never has to null-check.
function isRecent(iso: string | null | undefined, windowMs: number): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  return Date.now() - t <= windowMs;
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatDueLabel(iso: string | null): string {
  if (!iso) return "Anytime";
  const d = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
  if (d < startOfToday) return "Overdue";
  if (d < startOfTomorrow) return "Today";
  const startOfDayAfter = new Date(startOfTomorrow);
  startOfDayAfter.setDate(startOfDayAfter.getDate() + 1);
  if (d < startOfDayAfter) return "Tomorrow";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Splits the "why this is hot" line into two pieces so the action
// can render bold and the timestamp can render light — gives a clear
// "Started reservation • 30m ago" read instead of one undifferentiated
// muted string.
function formatActivityReason(
  eventType: string | null,
  lastEventAt: string | null,
): { action: string; when: string } {
  const when = lastEventAt ? formatRelative(lastEventAt) : "recently";
  switch (eventType) {
    case "price_viewed":
      return { action: "Viewed pricing", when };
    case "itinerary_clicked":
      return { action: "Tapped itinerary", when };
    case "proposal_scrolled":
      return { action: "Read past 40%", when };
    case "proposal_viewed":
      return { action: "Opened proposal", when };
    case "reservation_started":
      return { action: "Started reservation", when };
    case "reservation_completed":
      return { action: "Confirmed booking", when };
    default:
      return { action: "Last touch", when };
  }
}

function activityLabel(event: RecentEvent): string {
  const who = event.client?.name?.split(" ")[0] ?? "A guest";
  switch (event.eventType) {
    case "proposal_viewed":
      return `${who} opened the proposal`;
    case "proposal_scrolled":
      return `${who} read past the hero`;
    case "itinerary_clicked":
      return `${who} tapped an itinerary day`;
    case "price_viewed":
      return `${who} viewed pricing`;
    case "reservation_started":
      return `${who} started a booking`;
    case "reservation_completed":
      return `${who} confirmed a booking`;
    default:
      return `${who} engaged`;
  }
}

function activityTone(eventType: string): { bg: string; fg: string; glyph: string } {
  switch (eventType) {
    case "price_viewed":
      return { bg: "rgba(201,168,76,0.18)", fg: "#a1822f", glyph: "$" };
    case "itinerary_clicked":
      return { bg: "rgba(27,58,45,0.10)", fg: "#1b3a2d", glyph: "📍" };
    case "reservation_started":
      return { bg: "rgba(27,58,45,0.10)", fg: "#1b3a2d", glyph: "📅" };
    case "reservation_completed":
      return { bg: "#dcfce7", fg: "#166534", glyph: "✓" };
    case "proposal_scrolled":
      return { bg: "rgba(0,0,0,0.04)", fg: "rgba(0,0,0,0.6)", glyph: "↕" };
    case "proposal_viewed":
    default:
      return { bg: "rgba(27,58,45,0.10)", fg: "#1b3a2d", glyph: "👁" };
  }
}
