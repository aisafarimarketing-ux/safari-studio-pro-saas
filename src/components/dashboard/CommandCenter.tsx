"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useUser, UserButton } from "@clerk/nextjs";
import { openCommandPalette } from "@/components/CommandPalette";
import {
  DashboardThemeProvider,
  ThemeToggle,
  useDashboardTheme,
  type DashboardTokens,
} from "./DashboardTheme";
import { PipelineStrip, type PipelineData } from "./PipelineStrip";
import { FollowUpPanel } from "./FollowUpPanel";
import { ReservationSummaryDialog } from "./ReservationSummaryDialog";
import { ToastHost, fireToast } from "./Toast";
import { CommandBar } from "./CommandBar";
import {
  ACTION_LABEL,
  MOMENTUM_COLORS,
  MOMENTUM_ICON,
  MOMENTUM_LABEL,
  type DealMomentum,
  type SuggestedAction,
} from "@/lib/dealMomentum";
import {
  ChannelSentLabel,
  EmailIcon,
  WhatsAppIcon,
  WHATSAPP_GREEN,
} from "@/lib/channelIcons";
import {
  FOLLOW_UP_MODES,
  FOLLOW_UP_MODE_BLURB,
  FOLLOW_UP_MODE_DEFAULT,
  FOLLOW_UP_MODE_LABEL,
  modeCapabilities,
  normaliseFollowUpMode,
  type FollowUpMode,
} from "@/lib/followUpMode";

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
  momentum: DealMomentum;
  momentumReason: string;
  suggestedAction: SuggestedAction;
  draft: {
    id: string;
    channel: "whatsapp" | "email";
    text: string;
    createdAt: string;
    sentAt: string | null;
    autoSendScheduledFor: string | null;
    autoSent: boolean;
  } | null;
  autoSendEligibility: { ok: true } | { ok: false; reason: string };
  /** Inspector AI's "what to do next" suggestion. Heuristic-only
   *  (no LLM); rendered as a small green chip below the suggested-
   *  action line. Null when the system should stay quiet. */
  nextSuggestion: {
    message: string;
    actionLabel?: string;
    actionCommand?: string;
  } | null;
  /** Live-activity strip — surfaces what the client is doing right
   *  now. "viewing" state = present-tense (last event within 60s);
   *  "just-acted" = past-tense with "X min ago". Null when the
   *  client hasn't been active in the last 5 minutes. */
  liveActivity: {
    state: "viewing" | "just-acted";
    label: string;
  } | null;
  /** "Right now" insight — single-line observational narrative from
   *  the share-view behaviour signals. Calm, button-less line that
   *  sits between the live-activity strip and the momentum reason.
   *  Server picks one signal in priority order; UI renders the
   *  message verbatim. */
  rightNowInsight: { message: string } | null;
  preferredChannel: "whatsapp" | "email" | null;
  client: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
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
  emailStatus: string | null;
  createdAt: string;
  proposal: { id: string; title: string | null; trackingId: string } | null;
  assignedTo: { id: string; name: string | null; email: string | null } | null;
  /** Booking attribution — when an AISuggestion that was sent for
   *  this proposal flipped its outcome to "booked" (Phase 2 wiring),
   *  the most recent qualifying suggestion lands here. Powers the
   *  "Booked after WhatsApp · Day 3 snippet sent 12 min before" line
   *  under the booking row. Null when no sent suggestion preceded
   *  the booking. */
  creditedSuggestion?: {
    id: string;
    kind: string;
    channel: "whatsapp" | "email";
    sentAt: string;
    bookedAt: string;
    label: string;
    /** True when the credited send matches what Inspector AI v1
     *  would have suggested at the time (server-side check via
     *  matchesNextStepHeuristic). Drives the reinforcement copy. */
    followedSuggestion: boolean;
    /** "high" when the org has booked this exact day pattern at
     *  least 3 times before — surfaces "this step consistently
     *  works". "neutral" when followed without that data backing —
     *  surfaces "that was the right move". Always "neutral" for
     *  non-followed credits (the UI never shows a high-confidence
     *  claim off-script). */
    confidenceTier: "high" | "neutral";
    /** Compact day phrase ("Day 3" / "Days 1 and 2") used inside
     *  the reinforcement parens. Null for non-execution credits. */
    dayLabel: string | null;
  } | null;
};

type LeadRow = {
  id: string;
  referenceNumber: string;
  status: string;
  receivedAt: string;
  lastActivityAt: string;
  client: {
    id: string;
    fullName: string;
    email: string;
    phone: string | null;
  } | null;
  momentum: "VERY_ACTIVE" | "NEW" | "QUIET";
  momentumReason: string;
  nextSuggestion: {
    message: string;
    actionLabel?: string;
    actionCommand?: string;
  } | null;
};

type ActivityResponse = {
  hot: ActivityCard[];
  needsFollowup: ActivityCard[];
  needsAttention: ActivityCard[];
  opportunities: ActivityCard[];
  opportunitiesTotal: number;
  recentActivity: RecentEvent[];
  reservations: ReservationRow[];
  leads: LeadRow[];
  pipeline: PipelineData | null;
  scope: "mine" | "all";
  canViewAll: boolean;
  followUpMode: FollowUpMode;
  isPremium: boolean;
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
  // AI dialog state — managed at this level so deep leaves (DealCard,
  // BookingRow) can request the dialog via window CustomEvent rather
  // than threading callbacks through every section component.
  const [followUpTarget, setFollowUpTarget] = useState<FollowUpTarget | null>(null);
  const [reservationSummaryTarget, setReservationSummaryTarget] =
    useState<ReservationSummaryTarget | null>(null);
  // Command bar (⌘K). Opens on global shortcut + the "Press ⌘K" pill
  // in the top bar. Closes on Escape, outside click, or successful
  // command (the FollowUpPanel takes over).
  const [commandBarOpen, setCommandBarOpen] = useState(false);
  // Optional prefill string passed in when the bar is summoned from
  // an Inspector AI suggestion chip ("Send Day 3" → seed the input
  // with `send jennifer day 3`). Cleared on close.
  const [commandBarPrefill, setCommandBarPrefill] = useState<string | null>(null);

  // Bumping this re-runs the activity-fetch effect below. Auto-send
  // fires + scheduling actions dispatch "ss:refreshActivity" so the
  // dashboard repaints with the updated draft state without waiting
  // for the next 30s poll.
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    const onFollowUp = (e: Event) => {
      const detail = (e as CustomEvent<FollowUpTarget>).detail;
      if (detail?.proposalId) setFollowUpTarget(detail);
    };
    const onSummary = (e: Event) => {
      const detail = (e as CustomEvent<ReservationSummaryTarget>).detail;
      if (detail?.reservationId) setReservationSummaryTarget(detail);
    };
    const onRefresh = () => setRefreshTick((n) => n + 1);
    // Inspector AI suggestion chips dispatch this event with a
    // prefilled command string. The bar opens and seeds the input —
    // the operator hits Enter to dispatch.
    const onOpenCommandBar = (e: Event) => {
      const detail = (e as CustomEvent<{ prefill?: string }>).detail;
      setCommandBarPrefill(detail?.prefill?.trim() || null);
      setCommandBarOpen(true);
    };
    // ⌘K (mac) / Ctrl-K (other) toggles the command bar globally.
    // Ignore when an input/textarea/contentEditable already has focus
    // unless the user is *inside* the command bar already (so they
    // can dismiss it via the same shortcut).
    const onShortcut = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        const target = e.target as HTMLElement | null;
        const inEditable =
          target &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.getAttribute("contenteditable") === "true");
        // Always allow when the command bar itself is mounted (so ⌘K
        // closes it cleanly).
        const inCommandBar = !!target?.closest('[role="dialog"]');
        if (inEditable && !inCommandBar) return;
        e.preventDefault();
        setCommandBarOpen((v) => !v);
      }
    };
    window.addEventListener("ss:openFollowUp", onFollowUp);
    window.addEventListener("ss:openReservationSummary", onSummary);
    window.addEventListener("ss:refreshActivity", onRefresh);
    window.addEventListener("ss:openCommandBar", onOpenCommandBar);
    window.addEventListener("keydown", onShortcut);
    return () => {
      window.removeEventListener("ss:openFollowUp", onFollowUp);
      window.removeEventListener("ss:openReservationSummary", onSummary);
      window.removeEventListener("ss:refreshActivity", onRefresh);
      window.removeEventListener("ss:openCommandBar", onOpenCommandBar);
      window.removeEventListener("keydown", onShortcut);
    };
  }, []);

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
  }, [activityScope, refreshTick]);

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
        <CommandTopBar
          onOpenSidebar={() => setMobileNavOpen(true)}
          onOpenCommandBar={() => setCommandBarOpen(true)}
          scope={activityScope}
          onScopeChange={setActivityScope}
          canViewAll={activity?.canViewAll ?? false}
        />

        {/* Follow-up Mode selector — operator's "power level" for AI
            follow-ups. Drives DealCard / FollowUpPanel adaptation;
            persisted on the org so it survives sessions. */}
        <FollowUpModeSelector
          mode={activity?.followUpMode ?? FOLLOW_UP_MODE_DEFAULT}
        />

        {/* Today's Opportunities — the daily closing feed. Replaces
            the previous HotDealsBar chip strip with a richer feed
            that answers "who needs you, why now, what do you send?"
            in a single glance. Pulls from
            /api/dashboard/activity#opportunities — pre-sorted server-
            side. */}
        <TodaysOpportunities
          opportunities={activity?.opportunities ?? null}
          total={activity?.opportunitiesTotal ?? 0}
          mode={activity?.followUpMode ?? FOLLOW_UP_MODE_DEFAULT}
        />

        {/* Live Pipeline Strip — replaces the old Hot/Follow-up/
            Pipeline-$ stat tiles with a connected five-stage view of
            the deal journey. Same dark gradient as the previous hero
            so the page rhythm is unchanged. */}
        <PipelineStrip
          data={activity?.pipeline ?? null}
          loading={!activity && !loadFailed}
        />

        {/* Dense 2-col content grid: left = hot + (followup | bookings),
            right = activity + tasks. Tighter gaps and per-section row
            caps inside each component keep the whole dashboard inside
            one viewport on a 1080p+ screen without scrolling. */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)] gap-5">
          <div className="min-w-0 space-y-5">
            <HotDealsSection
              cards={activity?.hot ?? null}
              loadFailed={loadFailed}
              mode={activity?.followUpMode ?? FOLLOW_UP_MODE_DEFAULT}
            />
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
            <LeadsSection
              leads={activity?.leads ?? null}
              loadFailed={loadFailed}
            />
          </div>
          <aside className="min-w-0 space-y-5">
            <ActivityFeed events={activity?.recentActivity ?? null} />
            <TasksCard tasks={tasksData?.tasks ?? null} counts={tasksData?.counts ?? null} />
          </aside>
        </div>
      </main>

      {followUpTarget && (
        <FollowUpPanel
          proposalId={followUpTarget.proposalId}
          clientName={followUpTarget.clientName}
          clientPhone={followUpTarget.clientPhone}
          clientEmail={followUpTarget.clientEmail}
          autoSendEligibility={followUpTarget.autoSendEligibility}
          autoSendScheduledFor={followUpTarget.autoSendScheduledFor ?? null}
          mode={followUpTarget.mode ?? activity?.followUpMode ?? FOLLOW_UP_MODE_DEFAULT}
          prefilledDraft={followUpTarget.prefilledDraft}
          onClose={() => setFollowUpTarget(null)}
        />
      )}
      <CommandBar
        open={commandBarOpen}
        prefill={commandBarPrefill}
        onClose={() => {
          setCommandBarOpen(false);
          setCommandBarPrefill(null);
        }}
      />
      <ToastHost />
      {reservationSummaryTarget && (
        <ReservationSummaryDialog
          reservationId={reservationSummaryTarget.reservationId}
          clientName={reservationSummaryTarget.clientName}
          onClose={() => setReservationSummaryTarget(null)}
        />
      )}
    </div>
  );
}

type FollowUpTarget = {
  proposalId: string;
  clientName: string | null;
  clientPhone: string | null;
  clientEmail: string | null;
  autoSendEligibility?: { ok: true } | { ok: false; reason: string };
  autoSendScheduledFor?: string | null;
  /** Operator's selected follow-up mode. Drives whether the panel
   *  exposes the Schedule auto-send strip. */
  mode?: FollowUpMode;
  /** Pre-assembled draft from the Command Bar's Execution AI flow.
   *  When present, the panel skips the /auto-draft fetch entirely
   *  and uses this content directly. Without this field plumbed
   *  through, the panel falls back to generating a generic
   *  follow-up — which is exactly the bug that surfaced when an
   *  operator's "send Jennifer day 1 and 2" command opened the
   *  panel showing a booking-confirmation message instead of the
   *  itinerary snippet. */
  prefilledDraft?: {
    text: string;
    suggestionId: string;
    channel: "whatsapp" | "email";
    contextLabel?: string;
    warnings?: string[];
    /** Eyebrow suffix in the panel: "Safari Studio AI · {suffix}".
     *  Defaults to "Follow-up". Preview sends pass "Preview" so the
     *  operator sees what kind of message they're dispatching. */
    headerSuffix?: string;
  };
};

type ReservationSummaryTarget = {
  reservationId: string;
  clientName: string | null;
};

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

function CommandTopBar({
  onOpenSidebar,
  onOpenCommandBar,
  scope,
  onScopeChange,
  canViewAll,
}: {
  onOpenSidebar: () => void;
  onOpenCommandBar: () => void;
  scope: "mine" | "all";
  onScopeChange: (s: "mine" | "all") => void;
  canViewAll: boolean;
}) {
  const { user } = useUser();
  const { tokens } = useDashboardTheme();
  const greetingName = (user?.firstName ?? user?.username ?? "").trim();
  // Hour-based greeting derives from `new Date()`, which produces
  // different values on the SSR pass (server timezone) vs the client
  // mount (browser timezone). React 19 turns that diff into the
  // hydration error #418 we saw in production. Compute the greeting
  // only after mount so the SSR + first-paint use a stable neutral
  // string.
  const [greeting, setGreeting] = useState<string>("Hello");
  useEffect(() => {
    const h = new Date().getHours();
    const next =
      h < 5 ? "Working late" :
      h < 12 ? "Good morning" :
      h < 18 ? "Good afternoon" :
      "Good evening";
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGreeting(next);
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
        {/* Scope toggle — owner/admin only. Lives in the top bar
            now that the Hero is gone (the PipelineStrip used to host
            it via the old Hero component). Plain members never see
            it; the API silently downgrades any "all" they pass. */}
        {canViewAll && (
          <div
            className="inline-flex items-center gap-1 rounded-full p-0.5"
            style={{
              background: tokens.tileBg,
              border: `1px solid ${tokens.ring}`,
            }}
          >
            <ScopeToggleButton
              active={scope === "mine"}
              onClick={() => onScopeChange("mine")}
              label="Mine"
            />
            <ScopeToggleButton
              active={scope === "all"}
              onClick={() => onScopeChange("all")}
              label="Team"
            />
          </div>
        )}
        {/* Execution AI hint pill — discovery surface for the new
            command bar. Always visible, click to open. The keyboard
            shortcut ⌘K is wired globally one level up. */}
        <button
          type="button"
          onClick={onOpenCommandBar}
          className="hidden md:inline-flex items-center gap-2 h-9 px-3 rounded-full transition active:scale-[0.98]"
          style={{
            background: tokens.tileBg,
            border: `1px solid ${tokens.ring}`,
            color: tokens.body,
          }}
          title="Open Safari Studio AI command bar"
        >
          <span aria-hidden style={{ color: "#1b3a2d", fontSize: 13 }}>✦</span>
          <span className="text-[12px] font-semibold" style={{ color: tokens.heading }}>
            Send anything
          </span>
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
            style={{
              background: "rgba(0,0,0,0.06)",
              color: "rgba(0,0,0,0.55)",
            }}
            aria-hidden
          >
            ⌘K
          </span>
        </button>
        <IconBtn label="Search (⌘⇧K)" onClick={openCommandPalette}>
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

function ScopeToggleButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  const { tokens } = useDashboardTheme();
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-2.5 h-7 rounded-full text-[11.5px] font-semibold transition-colors duration-150"
      style={{
        background: active ? tokens.primary : "transparent",
        color: active ? "#fff" : tokens.muted,
      }}
    >
      {label}
    </button>
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

// ─── HOT DEALS — 2-card responsive grid ────────────────────────────────────

function HotDealsSection({
  cards,
  loadFailed,
  mode,
}: {
  cards: ActivityCard[] | null;
  loadFailed: boolean;
  mode: FollowUpMode;
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
            <DealCard key={c.proposalId} card={c} mode={mode} />
          ))}
        </CardGrid>
      )}
    </section>
  );
}

function CardGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>;
}

function DealCard({ card, mode }: { card: ActivityCard; mode: FollowUpMode }) {
  const { tokens } = useDashboardTheme();
  const caps = modeCapabilities(mode);
  const initial = (card.client?.name ?? "·").trim().charAt(0).toUpperCase();
  const tripSummary = card.title?.trim() || "Untitled proposal";
  const colors = MOMENTUM_COLORS[card.momentum];
  const isVeryHot = card.momentum === "VERY_HOT";
  const accentStrip = isVeryHot ? colors.accent : "transparent";
  const stripWidth = isVeryHot ? 4 : 0;
  const animClass = isVeryHot ? "ss-hot-pulse" : "";
  const hasDraft = Boolean(card.draft);
  const action = card.suggestedAction;
  // Auto-send chip / countdown only render in Auto mode. Smart Assist
  // and Assisted hide them so the card stays focused on the operator's
  // own send action.
  const autoScheduledIso = caps.allowAutoSend
    ? card.draft?.autoSendScheduledFor ?? null
    : null;
  const autoSent = caps.allowAutoSend ? card.draft?.autoSent ?? false : false;
  // Channel hierarchy: WhatsApp primary when client.phone exists,
  // Email fallback when client.email exists. The Send-now button
  // adopts WhatsApp brand green when WhatsApp is the target so the
  // operator sees where the message is going without reading.
  const preferredChannel: "whatsapp" | "email" | null =
    card.draft?.channel
      ?? (card.client?.phone ? "whatsapp" : card.client?.email ? "email" : null);

  const openPanel = () => {
    window.dispatchEvent(
      new CustomEvent<FollowUpTarget>("ss:openFollowUp", {
        detail: {
          proposalId: card.proposalId,
          clientName: card.client?.name ?? null,
          clientPhone: card.client?.phone ?? null,
          clientEmail: card.client?.email ?? null,
          autoSendEligibility: card.autoSendEligibility,
          autoSendScheduledFor: autoScheduledIso,
          mode,
        },
      }),
    );
  };

  // "Send now" path — same dispatch as Edit, but the panel auto-fires
  // the deep-link the moment the cached draft lands. v1 limitation:
  // we open WhatsApp / mailto, the operator confirms the send. True
  // one-click send needs WhatsApp Business API + outbound email infra.
  const sendNow = () => openPanel();

  return (
    <article
      id={`deal-${card.proposalId}`}
      className={`relative rounded-xl p-4 overflow-hidden transition-all duration-150 ease-out ${animClass}`}
      style={{
        background: tokens.tileBg,
        border: `1px solid ${isVeryHot ? colors.accent : tokens.ringHover}`,
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
            <MomentumBadge momentum={card.momentum} />
          </div>
          <div
            className="text-[11.5px] truncate mt-0.5"
            style={{ color: tokens.body }}
            title={tripSummary}
          >
            {tripSummary}
          </div>
          {/* Live activity strip — only renders when the client has
              been active in the last 5 minutes. "Viewing pricing"
              (present tense, last 60s) reads as live; "Just viewed
              pricing · 2 min ago" (past tense) reads as a fresh
              breadcrumb. Distinct from momentumReason which describes
              the longer-term bucket. */}
          {card.liveActivity && (
            <div
              className="text-[11px] mt-1.5 inline-flex items-center gap-1.5"
              style={{
                color:
                  card.liveActivity.state === "viewing"
                    ? "#15803d"
                    : tokens.body,
                fontWeight: card.liveActivity.state === "viewing" ? 600 : 500,
              }}
            >
              {card.liveActivity.state === "viewing" && (
                <span className="ss-recency-dot" aria-label="Active right now" />
              )}
              <span>{card.liveActivity.label}</span>
            </div>
          )}
          {/* "Right now" insight — observational one-liner from the
              share-view behaviour signals. No metrics, no button, no
              timestamp. Sits between live activity (what) and
              momentum reason (longer-term bucket). Server-side guards
              ensure only one signal fires; the UI renders the
              already-interpreted message verbatim. */}
          {card.rightNowInsight && (
            <div
              className="text-[11.5px] mt-1.5 italic"
              style={{ color: tokens.body }}
            >
              {card.rightNowInsight.message}
            </div>
          )}
          <div className="text-[11.5px] mt-1.5" style={{ color: tokens.muted }}>
            {card.momentumReason}
          </div>
        </div>

        <div className="text-right shrink-0">
          <div
            className="text-[22px] leading-none tabular-nums"
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

      {/* Auto-send strip — only renders while a schedule is live or the
          message just went out. Countdown updates client-side every
          second; cancel button DELETEs the schedule and refreshes the
          dashboard. */}
      {/* Inline contact capture — shown only on VERY_HOT cards that
          have a linked Client but no WhatsApp number on file. Adding
          one here flips the card's preferred channel and makes
          auto-send instantly viable, without round-tripping through
          a separate client-edit page. */}
      {isVeryHot &&
        !card.client?.phone &&
        card.client?.id &&
        !autoSent &&
        !autoScheduledIso && (
          <InlinePhoneCapture
            clientId={card.client.id}
            clientName={card.client.name ?? null}
            hasEmail={Boolean(card.client.email)}
          />
        )}

      {autoSent ? (
        <div
          className="mt-3 inline-flex items-center gap-2 px-2.5 py-1 rounded-md max-w-full"
          style={{
            background: card.draft?.channel === "whatsapp"
              ? "rgba(37,211,102,0.10)"
              : "rgba(22,163,74,0.10)",
            border: `1px solid ${
              card.draft?.channel === "whatsapp"
                ? "rgba(37,211,102,0.30)"
                : "rgba(22,163,74,0.30)"
            }`,
          }}
          title="Auto-follow-up dispatched."
        >
          <span aria-hidden>✓</span>
          <ChannelSentLabel
            channel={card.draft?.channel === "whatsapp" ? "whatsapp" : "email"}
            size={12}
          />
        </div>
      ) : autoScheduledIso ? (
        <AutoSendCountdown
          scheduledIso={autoScheduledIso}
          suggestionId={card.draft!.id}
          accent={colors.accent}
          onFireDone={() => {
            window.dispatchEvent(new CustomEvent("ss:refreshActivity"));
          }}
        />
      ) : null}

      {/* Suggested action — visible in Smart Assist + Auto. Hidden in
          Assisted mode (the operator drives the send themselves) and
          while an auto-send countdown is live (one urgent CTA per
          card, not two). */}
      {caps.showSuggestedAction && !autoScheduledIso && !autoSent && (
        <div
          className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11.5px] max-w-full"
          style={{
            background: colors.bg,
            color: colors.fg,
            border: `1px solid ${colors.accent}33`,
          }}
        >
          <span aria-hidden>👉</span>
          <span className="font-semibold truncate">{ACTION_LABEL[action]}</span>
          {hasDraft && action !== "WAIT" && (
            <span
              className="text-[9.5px] uppercase tracking-[0.18em] font-bold ml-1.5 px-1.5 py-0.5 rounded"
              style={{ background: "rgba(255,255,255,0.55)", color: colors.fg }}
              title="A Safari Studio AI draft is ready to send."
            >
              Draft ready
            </span>
          )}
        </div>
      )}

      {/* "Recommended — client is active" hint for Smart Assist + Auto
          on VERY_HOT deals. Distinct from the suggested-action chip:
          the chip says what to do, this says why. */}
      {caps.showRecommendedHint &&
        isVeryHot &&
        !autoScheduledIso &&
        !autoSent && (
          <div
            className="mt-2 text-[11.5px]"
            style={{ color: colors.fg, fontWeight: 600 }}
          >
            Recommended — client is active
          </div>
        )}

      {/* Inspector AI — "what to do next" suggestion. Pure heuristic
          over momentum + sent-history. Renders only when the lib
          decided the operator would benefit from a nudge (cold deals
          and recently-touched ones return null). The action button
          opens the ⌘K command bar with a prefilled string — one
          click into the existing Execution AI pipeline. */}
      {card.nextSuggestion && !autoScheduledIso && !autoSent && (
        <div
          className="mt-2 px-2.5 py-2 rounded-md text-[11.5px] flex items-start gap-2"
          style={{
            background: "rgba(27,58,45,0.06)",
            border: "1px solid rgba(27,58,45,0.16)",
          }}
        >
          <span aria-hidden style={{ color: "#1b3a2d", lineHeight: 1, marginTop: 1 }}>
            ✦
          </span>
          <div className="flex-1 min-w-0">
            <div
              className="text-[10px] uppercase tracking-[0.18em] font-bold"
              style={{ color: "#1b3a2d", opacity: 0.8 }}
            >
              Suggested next step
            </div>
            <div className="mt-0.5" style={{ color: tokens.body }}>
              {card.nextSuggestion.message}
            </div>
          </div>
          {card.nextSuggestion.actionLabel && (
            <button
              type="button"
              onClick={() => {
                window.dispatchEvent(
                  new CustomEvent<{ prefill?: string }>("ss:openCommandBar", {
                    detail: { prefill: card.nextSuggestion?.actionCommand },
                  }),
                );
              }}
              className="inline-flex items-center gap-1 px-2.5 h-7 rounded-md text-[11.5px] font-semibold transition active:scale-[0.97] shrink-0"
              style={{ background: "#1b3a2d", color: "#ffffff" }}
              title={
                card.nextSuggestion.actionCommand
                  ? `Opens command bar with: "${card.nextSuggestion.actionCommand}"`
                  : "Open command bar"
              }
            >
              {card.nextSuggestion.actionLabel}
            </button>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2 flex-wrap">
        {action === "WAIT" ? (
          <>
            <PrimaryBtn href={`/studio/${card.proposalId}`} emphasis>
              Open proposal
            </PrimaryBtn>
            <button
              type="button"
              onClick={openPanel}
              className="inline-flex items-center gap-1.5 px-3 h-8 rounded-md text-[12px] font-semibold transition active:scale-[0.97]"
              style={{
                background: "transparent",
                color: tokens.muted,
                border: `1px solid ${tokens.ring}`,
              }}
              title="Open the draft anyway"
            >
              Edit draft
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={sendNow}
              className="inline-flex items-center gap-1.5 px-3.5 h-9 rounded-md text-[12.5px] font-semibold transition active:scale-[0.97] shadow-sm"
              style={{
                background:
                  preferredChannel === "whatsapp" ? WHATSAPP_GREEN : colors.accent,
                color: "#ffffff",
              }}
              title={
                preferredChannel === "whatsapp"
                  ? "Open the draft and send via WhatsApp"
                  : "Open the draft and send via email"
              }
            >
              {preferredChannel === "whatsapp" ? (
                <WhatsAppIcon size={14} mono />
              ) : preferredChannel === "email" ? (
                <EmailIcon size={14} />
              ) : (
                <span aria-hidden style={{ opacity: 0.95 }}>✦</span>
              )}
              Send now
            </button>
            <button
              type="button"
              onClick={openPanel}
              className="inline-flex items-center gap-1 px-3 h-9 rounded-md text-[12px] font-semibold transition active:scale-[0.97]"
              style={{
                background: "transparent",
                color: tokens.heading,
                border: `1px solid ${tokens.ring}`,
              }}
            >
              Edit
            </button>
            {caps.showWaitButton && (
              <button
                type="button"
                onClick={() => {
                  /* Wait is a no-op for v1 — operator skips the suggestion.
                     Future: persist a "snooze until" so the card de-prioritises. */
                }}
                className="inline-flex items-center gap-1 px-3 h-9 rounded-md text-[12px] font-medium transition"
                style={{
                  background: "transparent",
                  color: tokens.muted,
                }}
                title="Skip this suggestion for now"
              >
                Wait
              </button>
            )}
          </>
        )}
      </div>
    </article>
  );
}

function AutoSendCountdown({
  scheduledIso,
  suggestionId,
  accent,
  onFireDone,
}: {
  scheduledIso: string;
  suggestionId: string;
  accent: string;
  onFireDone: () => void;
}) {
  const fireAtMs = new Date(scheduledIso).getTime();
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const fired = useRef(false);

  useEffect(() => {
    const handle = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(handle);
  }, []);

  const remainingMs = fireAtMs - Date.now();
  const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));
  const mm = Math.floor(remainingSec / 60);
  const ss = remainingSec % 60;
  const label = remainingSec > 0
    ? `Auto-follow-up in ${mm}:${ss.toString().padStart(2, "0")}`
    : "Sending auto-follow-up…";

  // Fire the auto-send when the timer hits zero. Single-shot per
  // mount; if the dashboard refreshes mid-send the new card carries
  // the autoSent flag from the server and skips this branch.
  useEffect(() => {
    if (fired.current) return;
    if (remainingMs > 0) return;
    if (busy) return;
    fired.current = true;
    setBusy(true);
    void (async () => {
      try {
        const res = await fetch(`/api/suggestions/${suggestionId}/auto-send`, {
          method: "POST",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          fireToast({
            message: data?.aborted
              ? "Auto-follow-up cancelled."
              : "Auto-send failed.",
            hint: typeof data?.error === "string" ? data.error : undefined,
          });
        } else if (data?.channel === "whatsapp" && typeof data.waUrl === "string") {
          // WhatsApp Mode A — try to open the deep-link in a new tab.
          // If the popup blocker stops us (e.g. the dashboard tab
          // wasn't focused at fire time), the toast becomes the
          // gateway: tapping it opens wa.me on the user gesture and
          // bypasses the blocker.
          const win =
            typeof window !== "undefined" ? window.open(data.waUrl, "_blank") : null;
          if (win) {
            fireToast({
              message: "⚡ Auto-follow-up opened in WhatsApp.",
              hint: "Confirm the send there.",
              onUndo: () => {
                void fetch(`/api/suggestions/${suggestionId}/sent`, {
                  method: "DELETE",
                }).then(onFireDone);
              },
            });
          } else {
            fireToast({
              message: "Auto-follow-up ready — tap to open WhatsApp.",
              hint: "Popup blocked. Click here.",
              durationMs: 12_000,
              onUndo: () => {
                window.open(data.waUrl, "_blank");
              },
            });
          }
        } else {
          fireToast({
            message: "⚡ Auto-follow-up sent (Email).",
            hint: "Likely response window: 1–3h.",
            onUndo: () => {
              void fetch(`/api/suggestions/${suggestionId}/sent`, {
                method: "DELETE",
              }).then(onFireDone);
            },
          });
        }
      } catch (err) {
        fireToast({
          message: "Auto-send failed.",
          hint: err instanceof Error ? err.message : undefined,
        });
      } finally {
        setBusy(false);
        onFireDone();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingMs <= 0, busy]);

  void tick;

  const handleCancel = async () => {
    setBusy(true);
    try {
      await fetch(`/api/suggestions/${suggestionId}/schedule`, {
        method: "DELETE",
      });
      fireToast({ message: "Auto-follow-up cancelled." });
    } catch {
      /* ignore — best-effort */
    } finally {
      setBusy(false);
      onFireDone();
    }
  };

  return (
    <div
      className="mt-3 inline-flex items-center gap-2 px-2.5 py-1 rounded-md text-[11.5px] max-w-full"
      style={{
        background: `${accent}15`,
        color: accent,
        border: `1px solid ${accent}55`,
      }}
    >
      <span aria-hidden style={{ filter: "saturate(1.2)" }}>⚡</span>
      <span className="font-semibold tabular-nums">{label}</span>
      {remainingSec > 0 && (
        <button
          type="button"
          onClick={handleCancel}
          disabled={busy}
          className="text-[10.5px] font-semibold underline-offset-2 hover:underline disabled:opacity-50"
          style={{ color: accent, opacity: 0.85 }}
        >
          Cancel
        </button>
      )}
    </div>
  );
}

function InlinePhoneCapture({
  clientId,
  clientName,
  hasEmail,
}: {
  clientId: string;
  clientName: string | null;
  hasEmail: boolean;
}) {
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const submit = async () => {
    const trimmed = phone.trim();
    if (!trimmed) return;
    // Bare client-side guard — the server's PATCH handler stores
    // arbitrary strings, but a phone with no digits is almost
    // certainly a typo so reject it before round-tripping.
    if (!/\d/.test(trimmed)) {
      setError("Add at least one digit.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: trimmed }),
      });
      if (!res.ok) {
        const detail = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(detail.error ?? `HTTP ${res.status}`);
      }
      fireToast({
        message: `WhatsApp number saved${clientName ? ` for ${clientName}` : ""}.`,
        hint: "Auto-follow-up unlocked.",
      });
      window.dispatchEvent(new CustomEvent("ss:refreshActivity"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the number.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="mt-3 rounded-md p-2.5"
      style={{
        background: "rgba(202,138,4,0.08)",
        border: "1px solid rgba(202,138,4,0.25)",
      }}
    >
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold"
          style={{ color: "#a16207" }}
          title="Adds the number to the client profile."
        >
          <span aria-hidden>📱</span>
          {hasEmail
            ? "Add WhatsApp number to follow up faster"
            : "Add a contact method to enable follow-ups"}
        </button>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px]" style={{ color: "rgba(10,20,17,0.65)" }}>
            +
          </span>
          <input
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="255 712 345 678"
            autoFocus
            className="flex-1 min-w-[140px] h-8 rounded text-[13px] px-2 outline-none"
            style={{
              background: "#ffffff",
              border: "1px solid rgba(0,0,0,0.16)",
              color: "#0a1411",
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submit();
              if (e.key === "Escape") setOpen(false);
            }}
          />
          <button
            type="button"
            onClick={submit}
            disabled={busy || !phone.trim()}
            className="inline-flex items-center gap-1 h-8 px-3 rounded text-[12px] font-semibold disabled:opacity-50 active:scale-[0.97]"
            style={{ background: WHATSAPP_GREEN, color: "#ffffff" }}
          >
            <WhatsAppIcon size={12} mono />
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setPhone("");
              setError(null);
            }}
            disabled={busy}
            className="text-[11px] font-semibold"
            style={{ color: "rgba(10,20,17,0.55)" }}
          >
            Cancel
          </button>
          {error && (
            <span className="w-full text-[11px]" style={{ color: "#b34334" }}>
              {error}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function MomentumBadge({ momentum }: { momentum: DealMomentum }) {
  const colors = MOMENTUM_COLORS[momentum];
  return (
    <span
      className="text-[10px] uppercase tracking-[0.20em] font-bold px-2 py-1 rounded-md shrink-0 inline-flex items-center gap-1"
      style={{ background: colors.accent, color: "#ffffff" }}
    >
      <span aria-hidden>{MOMENTUM_ICON[momentum]}</span>
      {MOMENTUM_LABEL[momentum]}
    </span>
  );
}

function FollowUpModeSelector({ mode }: { mode: FollowUpMode }) {
  const { tokens } = useDashboardTheme();
  // Optimistic local state so the segmented control flips instantly
  // even while the PATCH is in flight. ss:refreshActivity at the end
  // pulls the canonical mode back from the server.
  const [pending, setPending] = useState<FollowUpMode | null>(null);
  const current = pending ?? normaliseFollowUpMode(mode);

  const setMode = async (next: FollowUpMode) => {
    if (next === current) return;
    setPending(next);
    try {
      const res = await fetch("/api/org/follow-up-mode", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: next }),
      });
      if (!res.ok) {
        const detail = (await res.json().catch(() => ({}))) as { error?: string };
        fireToast({
          message: "Couldn't change Follow-up Mode.",
          hint: detail.error,
        });
        setPending(null);
        return;
      }
      fireToast({
        message: `Follow-up Mode: ${FOLLOW_UP_MODE_LABEL[next]}.`,
        hint: FOLLOW_UP_MODE_BLURB[next],
      });
      window.dispatchEvent(new CustomEvent("ss:refreshActivity"));
    } catch (err) {
      fireToast({
        message: "Couldn't change Follow-up Mode.",
        hint: err instanceof Error ? err.message : undefined,
      });
      setPending(null);
    }
  };

  return (
    <div
      className="rounded-xl px-4 py-3 flex items-center justify-between gap-4 flex-wrap"
      style={{
        background: tokens.tileBg,
        border: `1px solid ${tokens.ring}`,
      }}
    >
      <div className="min-w-0">
        <div
          className="text-[10.5px] uppercase tracking-[0.22em] font-bold"
          style={{ color: tokens.muted }}
        >
          Follow-up Mode
        </div>
        <div
          className="text-[12.5px] mt-0.5"
          style={{ color: tokens.body }}
        >
          {FOLLOW_UP_MODE_BLURB[current]}
        </div>
      </div>
      <div
        className="inline-flex items-center gap-1 p-1 rounded-md"
        style={{ background: "rgba(0,0,0,0.05)" }}
      >
        {FOLLOW_UP_MODES.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => void setMode(m)}
            disabled={pending !== null && pending !== m}
            className="px-3 h-7 rounded text-[12px] font-semibold transition disabled:opacity-50"
            style={{
              background: m === current ? tokens.primary : "transparent",
              color: m === current ? "#ffffff" : tokens.heading,
              boxShadow: m === current ? "0 1px 3px rgba(0,0,0,0.10)" : "none",
            }}
          >
            {FOLLOW_UP_MODE_LABEL[m]}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Today's Opportunities — daily closing feed ─────────────────────────
//
// The dashboard's main daily workflow. Pre-sorted server-side via
// /api/dashboard/activity#opportunities so the client just renders.
// Each row reuses the same ss:openFollowUp event the rest of the
// dashboard fires — no parallel state, no duplicated send logic.

function TodaysOpportunities({
  opportunities,
  total,
  mode,
}: {
  opportunities: ActivityCard[] | null;
  total: number;
  mode: FollowUpMode;
}) {
  const { tokens } = useDashboardTheme();
  if (!opportunities) {
    return (
      <div
        className="rounded-xl p-4"
        style={{
          background: tokens.tileBg,
          border: `1px solid ${tokens.ring}`,
        }}
      >
        <div className="h-3 w-32 rounded animate-pulse" style={{ background: "rgba(0,0,0,0.08)" }} />
        <div className="mt-3 space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-10 rounded animate-pulse" style={{ background: "rgba(0,0,0,0.05)" }} />
          ))}
        </div>
      </div>
    );
  }
  if (opportunities.length === 0) {
    return (
      <div
        className="rounded-xl px-4 py-4 flex items-center gap-3"
        style={{
          background: tokens.tileBg,
          border: `1px solid ${tokens.ring}`,
          color: tokens.muted,
        }}
      >
        <span aria-hidden style={{ fontSize: 18 }}>✓</span>
        <div>
          <div className="text-[13px] font-semibold" style={{ color: tokens.heading }}>
            All caught up
          </div>
          <div className="text-[11.5px]">No urgent opportunities right now.</div>
        </div>
      </div>
    );
  }
  return (
    <section
      className="rounded-xl"
      style={{
        background: tokens.tileBg,
        border: `1px solid ${tokens.ring}`,
      }}
    >
      <div className="flex items-baseline justify-between gap-3 flex-wrap px-4 pt-4 pb-2">
        <div>
          <h2
            className="text-[14px] font-bold"
            style={{
              color: tokens.heading,
              fontFamily: "'Playfair Display', Georgia, serif",
              letterSpacing: "-0.005em",
            }}
          >
            Today&rsquo;s Opportunities
          </h2>
          <p className="text-[11.5px] mt-0.5" style={{ color: tokens.muted }}>
            Who needs you, why now, what to send.
          </p>
        </div>
        {total > opportunities.length && (
          <Link
            href="/proposals"
            className="text-[11.5px] font-semibold transition"
            style={{ color: tokens.primary }}
          >
            View all opportunities ({total}) →
          </Link>
        )}
      </div>
      <ul>
        {opportunities.map((card, i) => (
          <OpportunityRow
            key={card.proposalId}
            card={card}
            divider={i > 0}
            mode={mode}
          />
        ))}
      </ul>
    </section>
  );
}

function OpportunityRow({
  card,
  divider,
  mode,
}: {
  card: ActivityCard;
  divider: boolean;
  mode: FollowUpMode;
}) {
  const { tokens } = useDashboardTheme();
  const colors = MOMENTUM_COLORS[card.momentum];
  const tripTitle = card.title?.trim() || "Untitled proposal";
  const preferredChannel: "whatsapp" | "email" | null =
    card.draft?.channel
      ?? (card.client?.phone
        ? "whatsapp"
        : card.client?.email
          ? "email"
          : null);
  const hasContact = preferredChannel !== null;

  const openPanel = () => {
    window.dispatchEvent(
      new CustomEvent<FollowUpTarget>("ss:openFollowUp", {
        detail: {
          proposalId: card.proposalId,
          clientName: card.client?.name ?? null,
          clientPhone: card.client?.phone ?? null,
          clientEmail: card.client?.email ?? null,
          autoSendEligibility: card.autoSendEligibility,
          autoSendScheduledFor: card.draft?.autoSendScheduledFor ?? null,
          mode,
        },
      }),
    );
  };

  const ctaLabel =
    preferredChannel === "whatsapp"
      ? "Send WhatsApp"
      : preferredChannel === "email"
        ? "Send Email"
        : "Add contact";
  const ctaBg =
    preferredChannel === "whatsapp"
      ? WHATSAPP_GREEN
      : preferredChannel === "email"
        ? "#1b3a2d"
        : "rgba(0,0,0,0.10)";
  const ctaColor =
    preferredChannel ? "#ffffff" : "rgba(10,20,17,0.55)";
  const suggestedActionLabel =
    preferredChannel === "whatsapp"
      ? "Send WhatsApp now"
      : preferredChannel === "email"
        ? "Send email now"
        : "Add a contact method to follow up";

  return (
    <li
      className="px-4 py-3 transition"
      style={{
        borderTop: divider ? `1px solid ${tokens.ring}` : "none",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = tokens.primarySoft;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      <div className="flex items-center gap-3 flex-wrap">
        <MomentumBadge momentum={card.momentum} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className="text-[13.5px] truncate"
              style={{ color: tokens.heading, fontWeight: 700 }}
              title={card.client?.name ?? ""}
            >
              {card.client?.name ?? "Unknown client"}
            </span>
            <span aria-hidden style={{ color: tokens.muted, opacity: 0.5 }}>·</span>
            <span
              className="text-[12px] truncate"
              style={{ color: tokens.body }}
              title={tripTitle}
            >
              {tripTitle}
            </span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
            <span className="text-[11.5px]" style={{ color: tokens.muted }}>
              {card.momentumReason}
            </span>
            <span aria-hidden style={{ color: tokens.muted, opacity: 0.5 }}>·</span>
            <span
              className="text-[11.5px] font-semibold"
              style={{ color: colors.fg }}
            >
              👉 {suggestedActionLabel}
            </span>
          </div>
        </div>
        {hasContact ? (
          <button
            type="button"
            onClick={openPanel}
            className="inline-flex items-center gap-1.5 px-3 h-8 rounded-md text-[12.5px] font-semibold transition active:scale-[0.97] shadow-sm shrink-0"
            style={{ background: ctaBg, color: ctaColor }}
            title={
              preferredChannel === "whatsapp"
                ? "Open the WhatsApp draft"
                : "Open the email draft"
            }
          >
            {preferredChannel === "whatsapp" ? (
              <WhatsAppIcon size={13} mono />
            ) : (
              <EmailIcon size={13} />
            )}
            {ctaLabel}
          </button>
        ) : card.client?.id ? (
          <button
            type="button"
            onClick={openPanel}
            className="inline-flex items-center gap-1.5 px-3 h-8 rounded-md text-[12px] font-semibold transition active:scale-[0.97] shrink-0"
            style={{
              background: "transparent",
              color: tokens.heading,
              border: `1px solid ${tokens.ring}`,
            }}
          >
            <span aria-hidden>📱</span>
            Add contact
          </button>
        ) : null}
      </div>
      {!hasContact && card.client?.id && (
        <div className="mt-2">
          <InlinePhoneCapture
            clientId={card.client.id}
            clientName={card.client.name ?? null}
            hasEmail={Boolean(card.client.email)}
          />
        </div>
      )}
    </li>
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

// ─── Leads — pre-proposal funnel ───────────────────────────────────────
//
// Lists Request rows that haven't been quoted yet. Each row renders
// the same Inspector AI suggestion shape as a deal card, but with
// preview-prefilled CTAs (no proposal exists, so day-snippets don't
// apply). The CTA dispatches ss:openCommandBar with the prefilled
// command — one click into the existing send_preview_itinerary
// pipeline.

function LeadsSection({
  leads,
  loadFailed,
}: {
  leads: LeadRow[] | null;
  loadFailed: boolean;
}) {
  const { tokens } = useDashboardTheme();
  // Same 3-rows-then-scroll rhythm as Bookings, since both sections
  // share the dashboard's vertical-budget posture.
  const visible = leads?.slice(0, 8);
  const overflowsScroll = (leads?.length ?? 0) > 3;
  return (
    <section id="dash-leads">
      <SectionHeader
        title="Leads"
        emoji="📥"
        subtitle="Pre-proposal — share a sample to start the conversation."
        count={leads?.length}
      />
      {loadFailed ? (
        <EmptyCard message="Couldn't load." />
      ) : visible === undefined ? (
        <ListSkeleton rows={2} />
      ) : visible.length === 0 ? (
        <EmptyCard message="No active leads. New enquiries land here automatically." />
      ) : (
        <ul
          className={`rounded-xl ${overflowsScroll ? "overflow-y-auto" : "overflow-hidden"}`}
          style={{
            background: tokens.tileBg,
            border: `1px solid ${tokens.ring}`,
            boxShadow: tokens.shadow,
            maxHeight: overflowsScroll ? "calc(3 * 76px)" : undefined,
          }}
        >
          {visible.map((lead, i) => (
            <LeadRow key={lead.id} lead={lead} divider={i > 0} />
          ))}
        </ul>
      )}
    </section>
  );
}

function LeadRow({ lead, divider }: { lead: LeadRow; divider: boolean }) {
  const { tokens } = useDashboardTheme();
  // Lead-momentum colour map mirrors LEAD_MOMENTUM_COLORS in
  // lib/leadMomentum.ts. Inlined here so the dashboard doesn't need
  // to import server-only modules.
  const colors =
    lead.momentum === "VERY_ACTIVE"
      ? { bg: "rgba(22,163,74,0.10)", fg: "#15803d", accent: "#16a34a" }
      : lead.momentum === "QUIET"
        ? { bg: "rgba(0,0,0,0.06)", fg: "rgba(0,0,0,0.55)", accent: "rgba(0,0,0,0.4)" }
        : { bg: "rgba(202,138,4,0.10)", fg: "#a16207", accent: "#ca8a04" };
  const label =
    lead.momentum === "VERY_ACTIVE" ? "Active" : lead.momentum === "QUIET" ? "Quiet" : "New";
  const triggerSuggestion = () => {
    if (!lead.nextSuggestion?.actionCommand) return;
    window.dispatchEvent(
      new CustomEvent<{ prefill?: string }>("ss:openCommandBar", {
        detail: { prefill: lead.nextSuggestion.actionCommand },
      }),
    );
  };
  return (
    <li
      className="px-3.5 py-3 transition"
      style={{
        borderTop: divider ? `1px solid ${tokens.ring}` : "none",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = tokens.primarySoft;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className="text-[9.5px] uppercase tracking-[0.18em] font-bold px-1.5 py-0.5 rounded shrink-0"
              style={{ background: colors.accent, color: "#ffffff" }}
            >
              {label}
            </span>
            <span
              className="text-[13px] truncate"
              style={{ color: tokens.heading, fontWeight: 600 }}
            >
              {lead.client?.fullName ?? "Unnamed lead"}
            </span>
            <span aria-hidden style={{ color: tokens.muted, opacity: 0.5 }}>·</span>
            <span className="text-[11px]" style={{ color: tokens.muted }}>
              {lead.referenceNumber}
            </span>
          </div>
          <div className="text-[11.5px] mt-0.5 truncate" style={{ color: tokens.muted }}>
            {lead.client?.email ?? "(no email)"}
            {lead.momentumReason ? ` · ${lead.momentumReason}` : ""}
          </div>
          {lead.nextSuggestion && (
            <div
              className="text-[11.5px] mt-1.5"
              style={{ color: colors.fg }}
              title={lead.nextSuggestion.actionCommand ?? ""}
            >
              <span aria-hidden>✦ </span>
              {lead.nextSuggestion.message}
            </div>
          )}
        </div>
        {lead.nextSuggestion?.actionLabel && lead.nextSuggestion.actionCommand && (
          <button
            type="button"
            onClick={triggerSuggestion}
            className="inline-flex items-center gap-1 px-3 h-8 rounded-md text-[12px] font-semibold transition active:scale-[0.97] shrink-0"
            style={{ background: "#1b3a2d", color: "#ffffff" }}
            title={`Opens command bar with: "${lead.nextSuggestion.actionCommand}"`}
          >
            {lead.nextSuggestion.actionLabel}
          </button>
        )}
      </div>
    </li>
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
  const submittedLabel = formatRelative(row.createdAt);
  // "Awaiting confirmation" is shown only while the reservation is
  // still in its initial "new" state — once the operator marks it
  // contacted / confirmed / lost the chip steps aside to avoid noise.
  const awaitingConfirmation = row.status === "new";
  // Treat any explicit non-"sent" delivery state as a deliverability
  // concern. "sent" and unknown/null stay quiet.
  const emailWarning = row.emailStatus
    ? row.emailStatus !== "sent"
    : false;
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
        <div className="flex items-center gap-1.5 flex-wrap">
          {isNew && awaitingConfirmation && (
            <span
              className="text-[8.5px] uppercase tracking-[0.18em] font-bold px-1.5 py-0.5 rounded shrink-0"
              style={{ background: "#dcfce7", color: "#166534" }}
            >
              NEW — awaiting confirmation
            </span>
          )}
          {isNew && !awaitingConfirmation && (
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
          className="flex items-center flex-wrap gap-x-2 gap-y-0.5 mt-0.5"
          style={{ color: tokens.muted }}
        >
          <span className="text-[11px] truncate tabular-nums">{dates}</span>
          <span aria-hidden className="text-[11px] opacity-50">·</span>
          <span className="text-[11px]">submitted {submittedLabel}</span>
          <EmailStatusChip status={row.emailStatus} />
        </div>
        {emailWarning && (
          <div
            className="text-[11px] mt-1 leading-snug"
            style={{ color: "#a16207" }}
          >
            Client has not received confirmation email yet.
          </div>
        )}
        {/* Attribution line — the cause-and-effect signal. Renders
            only when a sent AISuggestion for this proposal had its
            outcome flipped to "booked" by Phase 2 wiring.
            Two variants:
              - Followed: "✓ Booked — you followed the suggested
                step (Day 3)". Stronger reinforcement; fires only
                when the executed snippet matches what Inspector AI
                v1 would have suggested at the time.
              - Generic: "✓ Booked after [WhatsApp] Day 3 snippet
                sent 12 min before". Time-delta from sentAt →
                bookedAt, so it answers "how long after I sent the
                message did the booking come in?". */}
        {row.creditedSuggestion?.followedSuggestion ? (
          <div
            className="text-[11px] mt-1 leading-snug flex items-center gap-1.5 flex-wrap"
            style={{ color: "#15803d" }}
          >
            <span aria-hidden style={{ fontWeight: 700 }}>✓</span>
            <span style={{ fontWeight: 600 }}>
              {row.creditedSuggestion.confidenceTier === "high"
                ? "Booked — this step consistently works"
                : "Booked — that was the right move"}
            </span>
            {row.creditedSuggestion.channel === "whatsapp" ? (
              <WhatsAppIcon size={11} />
            ) : (
              <EmailIcon size={11} muted />
            )}
            <span style={{ color: "rgba(10,20,17,0.75)" }}>
              {row.creditedSuggestion.confidenceTier === "high"
                ? `(${row.creditedSuggestion.dayLabel ?? row.creditedSuggestion.label})`
                : `(${row.creditedSuggestion.dayLabel ?? row.creditedSuggestion.label} worked here)`}
            </span>
          </div>
        ) : row.creditedSuggestion ? (
          <div
            className="text-[11px] mt-1 leading-snug flex items-center gap-1.5 flex-wrap"
            style={{ color: "#15803d" }}
          >
            <span aria-hidden style={{ fontWeight: 700 }}>✓</span>
            <span>Booked after</span>
            {row.creditedSuggestion.channel === "whatsapp" ? (
              <WhatsAppIcon size={11} />
            ) : (
              <EmailIcon size={11} muted />
            )}
            <span style={{ color: "rgba(10,20,17,0.75)" }}>
              <strong>{row.creditedSuggestion.label}</strong>
              {" sent "}
              {formatDeltaShort(
                row.creditedSuggestion.sentAt,
                row.creditedSuggestion.bookedAt,
              )}
              {" before"}
            </span>
          </div>
        ) : null}
      </div>
      <div className="shrink-0 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() =>
            window.dispatchEvent(
              new CustomEvent<ReservationSummaryTarget>("ss:openReservationSummary", {
                detail: {
                  reservationId: row.id,
                  clientName: row.clientName,
                },
              }),
            )
          }
          className="inline-flex items-center gap-1 px-2.5 h-7 rounded-md text-[11.5px] font-semibold transition active:scale-[0.97]"
          style={{
            background: "transparent",
            color: tokens.muted,
            border: `1px solid ${tokens.ring}`,
          }}
          title="Summarise this reservation with Safari Studio AI"
        >
          <span aria-hidden style={{ opacity: 0.85 }}>✦</span>
          Summarise
        </button>
        <SecondaryBtn href={href}>Open booking</SecondaryBtn>
      </div>
    </li>
  );
}

// Small chip that shows the operator the outbound notification state
// captured at reservation creation. Mirrors the ReservationDeliveryResult
// union from src/lib/notifications.ts plus "delayed" (race timed out)
// and a fallback for legacy rows with no recorded status.
function EmailStatusChip({ status }: { status: string | null }) {
  const config = emailStatusConfig(status);
  if (!config) return null;
  return (
    <span
      className="text-[9.5px] uppercase tracking-[0.16em] font-semibold px-1.5 py-0.5 rounded shrink-0"
      style={{ background: config.bg, color: config.fg }}
      title={config.title}
    >
      {config.label}
    </span>
  );
}

function emailStatusConfig(status: string | null): {
  label: string;
  bg: string;
  fg: string;
  title: string;
} | null {
  switch (status) {
    case "sent":
      return {
        label: "Email sent",
        bg: "rgba(22,163,74,0.10)",
        fg: "#15803d",
        title: "Notification email delivered to the operator inbox.",
      };
    case "delayed":
      return {
        label: "Email pending",
        bg: "rgba(202,138,4,0.10)",
        fg: "#a16207",
        title: "Email send took longer than 5s — still completing in background.",
      };
    case "skipped":
      return {
        label: "Email off",
        bg: "rgba(0,0,0,0.06)",
        fg: "rgba(0,0,0,0.55)",
        title: "Mailer not configured — booking captured but no email sent.",
      };
    case "no-recipient":
      return {
        label: "No recipient",
        bg: "rgba(202,138,4,0.10)",
        fg: "#a16207",
        title: "No operator email on file to notify.",
      };
    case "failed":
      return {
        label: "Email failed",
        bg: "rgba(179,67,52,0.10)",
        fg: "#b34334",
        title: "Resend rejected the message — check the activity log.",
      };
    default:
      return null;
  }
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

// Compact "X min" / "X h" / "X d" delta between two ISO timestamps.
// Used by the booking-credit line to answer "how long after sending
// did the booking land?". Always returns a positive duration; the
// caller controls how it's framed in copy ("12 min before").
function formatDeltaShort(fromIso: string, toIso: string): string {
  const ms = Math.max(0, new Date(toIso).getTime() - new Date(fromIso).getTime());
  if (ms < 60_000) return "<1 min";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)} min`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)} h`;
  if (ms < 7 * 86_400_000) return `${Math.floor(ms / 86_400_000)} d`;
  return `${Math.floor(ms / (7 * 86_400_000))} w`;
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
