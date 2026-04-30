"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { UserButton } from "@clerk/nextjs";
import { openCommandPalette } from "@/components/CommandPalette";

// ─── Follow-Up Command Center ─────────────────────────────────────────────
//
// Three-column deal-closing dashboard:
//
//   LEFT  (260px, fixed)  — sidebar / control center
//   CENTER (fluid)        — greeting · hero · priority cards
//   RIGHT (320px, fixed)  — today's tasks
//
// Replaces the old multi-tile dashboard. Reads from
// /api/dashboard/priorities (priorities + sidebarCounts) and
// /api/dashboard/tasks. Action Center counts come from the same
// priorities response so the sidebar stays in lockstep with the
// main column without a second round-trip.

const PALETTE = {
  pageBg: "#F7F5F2",
  cardBg: "#FFFFFF",
  forest: "#1b3a2d",
  forestDeep: "#142a20",
  forestLine: "#2a4736",
  gold: "#c9a84c",
  ink: "#0d2620",
  body: "#3f463f",
  muted: "#6b7268",
  line: "rgba(13,38,32,0.08)",
  lineSoft: "rgba(13,38,32,0.05)",
  hot: "#dc2626",
  warm: "#d97706",
  cold: "#6b7280",
  green: "#16a34a",
};

// ─── Types (mirror /api/dashboard/priorities response) ───────────────────

type FilterKey = "all" | "hot" | "needs-followup" | "unread" | "at-risk";

type ActiveTask = {
  id: string; title: string; actionType: string | null;
  priorityLevel: string | null; dueAt: string | null; auto: boolean;
  matchesNextAction: boolean;
};

type NextAction = {
  type: string; label: string; reason: string; urgent: boolean;
};

type Priority = {
  requestId: string;
  referenceNumber: string;
  status: string;
  clientId: string | null;
  clientName: string;
  clientEmail: string | null;
  proposalId: string | null;
  proposalTitle: string | null;
  valueCents: number;
  currency: string;
  thumbnailUrl: string | null;
  insightText: string | null;
  intentLabel: "high" | "medium" | "low";
  score: {
    total: number; engagement: number; recency: number; value: number;
    label: "hot" | "warm" | "cold";
    nextAction: NextAction;
  };
  engagement: {
    views: number; totalSeconds: number; pricingViewed: boolean;
    inboundMessages: number; outboundMessages: number;
  };
  unreadCount: number;
  lastActivityIso: string;
  needsFollowup: boolean;
  atRisk: boolean;
  activeTask: ActiveTask | null;
};

type SidebarCounts = {
  requests: number;
  proposals: number;
  reservations: number;
  inboxUnread: number;
  tasks: number;
};

type Summary = {
  hotDealsCount: number;
  hotDealsValueCents: number;
  pipelineAtRiskCount: number;
  pipelineAtRiskValueCents: number;
  unreadMessages: number;
  followupsDueCount: number;
  totalActiveValueCents: number;
  currency: string;
  todaysWins: { dealsProgressed: number; bookingsConfirmed: number; tasksCompleted: number; messagesSent: number };
  autoCreateHotEnabled: boolean;
  sidebarCounts: SidebarCounts;
};

type FilterCounts = Record<FilterKey, number>;

type PrioritiesResponse = {
  summary: Summary;
  filterCounts: { all: number; hot: number; "needs-followup": number; unread: number };
  priorities: Priority[];
};

type Task = {
  id: string;
  title: string;
  notes: string | null;
  dueAt: string | null;
  overdue: boolean;
  createdAt: string;
  request: { id: string; referenceNumber: string; status: string; clientName: string | null } | null;
};

type TasksResponse = { tasks: Task[]; counts: { open: number; overdue: number } };

// ─── Component ───────────────────────────────────────────────────────────

export function CommandCenter() {
  const { user } = useUser();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [data, setData] = useState<PrioritiesResponse | null>(null);
  const [tasksData, setTasksData] = useState<TasksResponse | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busyByRequestId, setBusyByRequestId] = useState<Record<string, "creating" | "completing" | "sending" | undefined>>({});
  const [flash, setFlash] = useState<{ requestId: string; message: string; tone: "success" | "info" } | null>(null);
  // Mobile / tablet: sidebar + task rail collapse into slide-in drawers
  // controlled here. Both default to closed; the top bar's hamburger
  // and tasks buttons toggle them. lg+ ignores these flags.
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileTaskRailOpen, setMobileTaskRailOpen] = useState(false);

  // Body scroll-lock while a mobile drawer is open. Re-enables on
  // close so the desktop view never inherits a frozen body.
  useEffect(() => {
    const anyOpen = mobileSidebarOpen || mobileTaskRailOpen;
    if (typeof document === "undefined") return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = anyOpen ? "hidden" : previous || "";
    return () => { document.body.style.overflow = previous || ""; };
  }, [mobileSidebarOpen, mobileTaskRailOpen]);

  // Close mobile drawers on Esc.
  useEffect(() => {
    if (!(mobileSidebarOpen || mobileTaskRailOpen)) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileSidebarOpen(false);
        setMobileTaskRailOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileSidebarOpen, mobileTaskRailOpen]);

  const loadPriorities = useMemo(() => async (filterKey: FilterKey = filter) => {
    try {
      // The API only knows all/hot/needs-followup/unread; "at-risk" is
      // a client-side filter we apply post-fetch.
      const apiFilter = filterKey === "at-risk" ? "all" : filterKey;
      const res = await fetch(`/api/dashboard/priorities?filter=${apiFilter}&limit=20`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as PrioritiesResponse;
    } catch {
      return null;
    }
  }, [filter]);

  useEffect(() => {
    let cancelled = false;
    void loadPriorities(filter).then((json) => {
      if (cancelled) return;
      if (json) { setData(json); setLoadFailed(false); }
      else setLoadFailed(true);
    });
    return () => { cancelled = true; };
  }, [filter, loadPriorities]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/dashboard/tasks?limit=12", { cache: "no-store" });
        if (!res.ok) return;
        if (!cancelled) setTasksData((await res.json()) as TasksResponse);
      } catch { /* secondary */ }
    };
    void load();
    const interval = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const refreshPriorities = async () => {
    const json = await loadPriorities(filter);
    if (json) setData(json);
  };

  const refreshTasks = async () => {
    try {
      const res = await fetch("/api/dashboard/tasks?limit=12", { cache: "no-store" });
      if (res.ok) setTasksData((await res.json()) as TasksResponse);
    } catch { /* secondary */ }
  };

  // ── Apply at-risk filter client-side ────────────────────────────────
  const visiblePriorities = useMemo(() => {
    if (!data) return [];
    if (filter === "at-risk") return data.priorities.filter((p) => p.atRisk);
    return data.priorities;
  }, [data, filter]);

  // ── Action handlers ─────────────────────────────────────────────────

  const handleQuickReply = async (priority: Priority, body: string) => {
    if (!priority.clientId || busyByRequestId[priority.requestId]) return;
    setBusyByRequestId((s) => ({ ...s, [priority.requestId]: "sending" }));
    setFlash({ requestId: priority.requestId, message: "Sending…", tone: "info" });
    try {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: priority.requestId,
          clientId: priority.clientId,
          channel: "email",
          body,
          quickReply: true,
        }),
      });
      const json = (await res.json()) as { message?: { status?: string }; error?: string };
      if (json.message?.status === "failed") throw new Error(json.error || "Send failed.");
      if (!res.ok && !json.message) throw new Error(json.error || `HTTP ${res.status}`);
      setFlash({ requestId: priority.requestId, message: "Message sent ✓", tone: "success" });
      setTimeout(() => setFlash(null), 1800);
      await refreshPriorities();
    } catch (err) {
      setFlash({ requestId: priority.requestId, message: err instanceof Error ? err.message : "Send failed.", tone: "info" });
      setTimeout(() => setFlash(null), 3000);
    } finally {
      setBusyByRequestId((s) => { const next = { ...s }; delete next[priority.requestId]; return next; });
    }
  };

  const handleAddTask = async (priority: Priority) => {
    if (busyByRequestId[priority.requestId]) return;
    setBusyByRequestId((s) => ({ ...s, [priority.requestId]: "creating" }));
    try {
      const res = await fetch(`/api/requests/${priority.requestId}/tasks/auto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionType: priority.score.nextAction.type,
          actionLabel: priority.score.nextAction.label,
          reason: priority.score.nextAction.reason,
          priorityLevel: priority.score.label,
        }),
      });
      const json = (await res.json()) as { task?: { id: string }; alreadyExisted?: boolean; error?: string };
      if (!res.ok || !json.task) throw new Error(json.error || `HTTP ${res.status}`);
      await refreshPriorities();
      void refreshTasks();
      setFlash({
        requestId: priority.requestId,
        message: json.alreadyExisted ? "Task already active." : "Task added ✓",
        tone: json.alreadyExisted ? "info" : "success",
      });
      setTimeout(() => setFlash(null), 1800);
    } catch (err) {
      setFlash({ requestId: priority.requestId, message: err instanceof Error ? err.message : "Couldn't add task.", tone: "info" });
      setTimeout(() => setFlash(null), 2500);
    } finally {
      setBusyByRequestId((s) => { const next = { ...s }; delete next[priority.requestId]; return next; });
    }
  };

  const handleMarkDone = async (priority: Priority) => {
    const task = priority.activeTask;
    if (!task || busyByRequestId[priority.requestId]) return;
    if (task.id.startsWith("temp-")) return;
    setBusyByRequestId((s) => ({ ...s, [priority.requestId]: "completing" }));
    try {
      const res = await fetch(`/api/requests/${priority.requestId}/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: true }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await refreshPriorities();
      void refreshTasks();
      setFlash({ requestId: priority.requestId, message: "Deal progressed ✓", tone: "success" });
      setTimeout(() => setFlash(null), 2000);
    } catch (err) {
      setFlash({ requestId: priority.requestId, message: err instanceof Error ? err.message : "Couldn't complete.", tone: "info" });
      setTimeout(() => setFlash(null), 2500);
    } finally {
      setBusyByRequestId((s) => { const next = { ...s }; delete next[priority.requestId]; return next; });
    }
  };

  // ── Render ──────────────────────────────────────────────────────────

  const greetingName = (user?.firstName ?? user?.username ?? "").trim();
  const summary = data?.summary;
  const counts = summary?.sidebarCounts;

  return (
    <div
      className="min-h-screen lg:grid"
      style={{
        background: PALETTE.pageBg,
        gridTemplateColumns: "260px minmax(0, 1fr) 320px",
      }}
    >
      <CommandSidebar
        currentFilter={filter}
        onFilter={(f) => { setFilter(f); setMobileSidebarOpen(false); }}
        sidebarCounts={counts}
        actionCenter={{
          hot: summary?.hotDealsCount ?? 0,
          followups: summary?.followupsDueCount ?? 0,
          unread: summary?.unreadMessages ?? 0,
          atRisk: summary?.pipelineAtRiskCount ?? 0,
        }}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />

      {/* Mobile / tablet backdrop — closes either drawer on click. */}
      {(mobileSidebarOpen || mobileTaskRailOpen) && (
        <div
          className="fixed inset-0 z-30 lg:hidden"
          style={{
            background: "rgba(13,38,32,0.36)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
            animation: "ss-cmdk-fade 140ms ease-out",
          }}
          onClick={() => {
            setMobileSidebarOpen(false);
            setMobileTaskRailOpen(false);
          }}
          aria-hidden
        />
      )}

      <main className="px-4 py-4 md:px-7 md:py-5 min-w-0">
        <CommandTopBar
          greetingName={greetingName}
          openTasksCount={tasksData?.counts.open ?? 0}
          onOpenSidebar={() => setMobileSidebarOpen(true)}
          onOpenTaskRail={() => setMobileTaskRailOpen(true)}
        />

        <CommandHero
          summary={summary ?? null}
          onViewHotDeals={() => setFilter("hot")}
          onSendFollowups={() => setFilter("needs-followup")}
        />

        <section className="mt-6">
          <div className="flex items-baseline justify-between gap-4 mb-4 flex-wrap">
            <div>
              <h2
                className="text-[22px] font-bold leading-tight"
                style={{ color: PALETTE.ink, fontFamily: "'Playfair Display', serif" }}
              >
                Who to follow up with — <em className="font-normal italic" style={{ color: PALETTE.muted }}>right now.</em>
              </h2>
            </div>
            <FilterPills currentFilter={filter} onFilter={setFilter} summary={summary ?? null} priorities={data?.priorities ?? []} />
          </div>

          {data === null && !loadFailed ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <PriorityCardSkeleton key={i} />)}
            </div>
          ) : loadFailed ? (
            <EmptyCard message="Couldn't load priorities. Refresh to try again." />
          ) : visiblePriorities.length === 0 ? (
            <EmptyCard
              message={filter === "all"
                ? "Nothing in the priority queue. Quiet day — or a clean inbox."
                : "No deals match this filter."}
            />
          ) : (
            <ul className="space-y-3">
              {visiblePriorities.map((p) => (
                <PriorityCard
                  key={p.requestId}
                  priority={p}
                  busy={busyByRequestId[p.requestId]}
                  flash={flash?.requestId === p.requestId ? flash : null}
                  onQuickReply={(b) => handleQuickReply(p, b)}
                  onAddTask={() => handleAddTask(p)}
                  onMarkDone={() => handleMarkDone(p)}
                />
              ))}
            </ul>
          )}
        </section>
      </main>

      <CommandTaskRail
        tasksData={tasksData}
        mobileOpen={mobileTaskRailOpen}
        onMobileClose={() => setMobileTaskRailOpen(false)}
      />
    </div>
  );
}

// ─── LEFT — Sidebar ──────────────────────────────────────────────────────

function CommandSidebar({
  currentFilter, onFilter, sidebarCounts, actionCenter, mobileOpen, onMobileClose,
}: {
  currentFilter: FilterKey;
  onFilter: (f: FilterKey) => void;
  sidebarCounts: SidebarCounts | undefined;
  actionCenter: { hot: number; followups: number; unread: number; atRisk: number };
  mobileOpen: boolean;
  onMobileClose: () => void;
}) {
  // On lg+ the sidebar is `static` and lives in the grid's first
  // column. Below lg it's a fixed drawer translated off-screen
  // unless `mobileOpen` is true. `lg:translate-x-0` overrides the
  // mobile transform at lg+ so resize never traps the drawer offscreen.
  return (
    <aside
      className={`
        z-40 w-[260px] border-r flex flex-col
        fixed inset-y-0 left-0 transition-transform duration-200 ease-out
        lg:static lg:transition-none lg:translate-x-0
        ${mobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"}
      `}
      style={{
        background: PALETTE.cardBg,
        borderColor: PALETTE.line,
      }}
    >
      {/* Logo */}
      <div className="px-5 py-5 border-b" style={{ borderColor: PALETTE.line }}>
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-base"
            style={{ background: "rgba(201,168,76,0.18)", color: PALETTE.gold }}
          >
            S
          </div>
          <span className="text-[15px] font-semibold tracking-tight" style={{ color: PALETTE.ink }}>
            Safari Studio
          </span>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto py-4" onClick={onMobileClose}>
        {/* WORK */}
        <SidebarGroup label="Work">
          <SidebarItem href="/dashboard" label="Overview" active />
          <SidebarItem href="/requests" label="Requests" badge={sidebarCounts?.requests} />
          <SidebarItem href="/proposals" label="Proposals" badge={sidebarCounts?.proposals} />
          <SidebarItem href="/properties" label="Property Library" />
          <SidebarItem href="/settings/brand#visualStyle" label="Image Library" />
          <SidebarItem href="/reservations" label="Reservations" badge={sidebarCounts?.reservations} />
        </SidebarGroup>

        {/* ACTION CENTER */}
        <SidebarGroup label="Action Center">
          <ActionCenterRow
            icon="🔥"
            label="Hot Deals"
            count={actionCenter.hot}
            tone="hot"
            active={currentFilter === "hot"}
            onClick={() => onFilter(currentFilter === "hot" ? "all" : "hot")}
          />
          <ActionCenterRow
            icon="⏳"
            label="Needs Follow-up"
            count={actionCenter.followups}
            tone="warm"
            active={currentFilter === "needs-followup"}
            onClick={() => onFilter(currentFilter === "needs-followup" ? "all" : "needs-followup")}
          />
          <ActionCenterRow
            icon="💬"
            label="Unread Messages"
            count={actionCenter.unread}
            tone="info"
            active={currentFilter === "unread"}
            onClick={() => onFilter(currentFilter === "unread" ? "all" : "unread")}
          />
          <ActionCenterRow
            icon="⚠️"
            label="At Risk"
            count={actionCenter.atRisk}
            tone="risk"
            active={currentFilter === "at-risk"}
            onClick={() => onFilter(currentFilter === "at-risk" ? "all" : "at-risk")}
          />
        </SidebarGroup>

        {/* INSIGHTS */}
        <SidebarGroup label="Insights">
          <SidebarItem href="/analytics" label="Analytics" />
          <SidebarItem href="/dashboard#performance" label="Performance" />
          <SidebarItem href="/dashboard#performance" label="Conversion" />
        </SidebarGroup>

        {/* SYSTEM */}
        <SidebarGroup label="System">
          <SidebarItem href="/requests" label="Inbox" badge={sidebarCounts?.inboxUnread} />
          <SidebarItem href="/requests" label="Messages" />
          <SidebarItem href="/requests" label="Tasks" badge={sidebarCounts?.tasks} />
          <SidebarItem href="/dashboard" label="Activity" />
          <SidebarItem href="/settings" label="Settings" />
        </SidebarGroup>
      </nav>

      {/* User chip */}
      <div
        className="border-t px-4 py-3 flex items-center gap-2.5"
        style={{ borderColor: PALETTE.line }}
      >
        <div className="shrink-0">
          <UserButton />
        </div>
      </div>
    </aside>
  );
}

function SidebarGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-3 mt-2 mb-3">
      <div
        className="px-2 mb-1 text-[10px] uppercase tracking-[0.22em] font-semibold"
        style={{ color: PALETTE.muted }}
      >
        {label}
      </div>
      <div>{children}</div>
    </div>
  );
}

function SidebarItem({
  href, label, badge, active = false,
}: {
  href: string; label: string; badge?: number; active?: boolean;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between px-2 py-1.5 rounded-md text-[13px] transition"
      style={{
        background: active ? "rgba(27,58,45,0.08)" : "transparent",
        color: active ? PALETTE.forest : PALETTE.body,
        fontWeight: active ? 600 : 500,
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = PALETTE.lineSoft; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
    >
      <span className="truncate">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span
          className="ml-2 text-[10.5px] tabular-nums px-1.5 py-0.5 rounded-full font-semibold"
          style={{ background: "rgba(27,58,45,0.10)", color: PALETTE.forest }}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}

function ActionCenterRow({
  icon, label, count, tone, active, onClick,
}: {
  icon: string;
  label: string;
  count: number;
  tone: "hot" | "warm" | "info" | "risk";
  active: boolean;
  onClick: () => void;
}) {
  const accent =
    tone === "hot" ? PALETTE.hot :
    tone === "warm" ? PALETTE.warm :
    tone === "risk" ? PALETTE.warm :
    PALETTE.forest;
  const bgSoft =
    tone === "hot" ? "rgba(220,38,38,0.08)" :
    tone === "warm" ? "rgba(217,119,6,0.10)" :
    tone === "risk" ? "rgba(217,119,6,0.10)" :
    "rgba(27,58,45,0.08)";
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center justify-between px-2 py-1.5 rounded-md text-[13px] transition"
      style={{
        background: active ? bgSoft : "transparent",
        color: active ? accent : PALETTE.body,
        fontWeight: active ? 600 : 500,
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = PALETTE.lineSoft; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
    >
      <span className="flex items-center gap-2 truncate">
        <span className="text-[14px] leading-none" aria-hidden>{icon}</span>
        <span className="truncate">{label}</span>
      </span>
      {count > 0 && (
        <span
          className="ml-2 text-[10.5px] tabular-nums px-1.5 py-0.5 rounded-full font-bold"
          style={{ background: bgSoft, color: accent }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

// ─── TOP BAR ─────────────────────────────────────────────────────────────

function CommandTopBar({
  greetingName, openTasksCount, onOpenSidebar, onOpenTaskRail,
}: {
  greetingName: string;
  openTasksCount: number;
  onOpenSidebar: () => void;
  onOpenTaskRail: () => void;
}) {
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 5) return "Working late";
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  }, []);
  return (
    <div className="flex items-center justify-between gap-3 mb-4 md:mb-5">
      <div className="flex items-center gap-2.5 min-w-0">
        {/* Hamburger — mobile / tablet only. */}
        <button
          type="button"
          onClick={onOpenSidebar}
          aria-label="Open menu"
          className="lg:hidden w-9 h-9 rounded-full flex items-center justify-center transition shrink-0"
          style={{ background: PALETTE.cardBg, border: `1px solid ${PALETTE.line}`, color: PALETTE.body }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M2.5 4 H13.5 M2.5 8 H13.5 M2.5 12 H13.5" />
          </svg>
        </button>

        <div className="min-w-0">
          <h1
            className="text-[20px] md:text-[24px] font-bold leading-tight truncate"
            style={{ color: PALETTE.ink, fontFamily: "'Playfair Display', serif" }}
          >
            {greeting}{greetingName ? `, ${greetingName}.` : "."}
          </h1>
          <div className="text-[12.5px] md:text-[13px] mt-0.5 truncate" style={{ color: PALETTE.muted }}>
            Here&apos;s who needs your attention today.
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
        {/* Tasks toggle — mobile / tablet only. Surface the open-count
            so the operator knows the rail has something in it. */}
        <button
          type="button"
          onClick={onOpenTaskRail}
          aria-label={`Tasks (${openTasksCount} open)`}
          title={`Tasks (${openTasksCount} open)`}
          className="lg:hidden relative w-9 h-9 rounded-full flex items-center justify-center transition"
          style={{ background: PALETTE.cardBg, border: `1px solid ${PALETTE.line}`, color: PALETTE.body }}
        >
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2.5" y="3" width="10" height="9" rx="1.5" />
            <path d="M5 6.5 L7 8.5 L10 5.5" />
          </svg>
          {openTasksCount > 0 && (
            <span
              className="absolute -top-1 -right-1 text-[9.5px] font-bold tabular-nums px-1.5 rounded-full leading-[1.4]"
              style={{ background: PALETTE.forest, color: "white", minWidth: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              {openTasksCount > 9 ? "9+" : openTasksCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}

function IconBtn({
  children, label, onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="w-9 h-9 rounded-full flex items-center justify-center transition"
      style={{ background: PALETTE.cardBg, border: `1px solid ${PALETTE.line}`, color: PALETTE.body }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(13,38,32,0.18)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = PALETTE.line; }}
    >
      {children}
    </button>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5 L13 13" />
    </svg>
  );
}
function BellIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 11.5h9l-1.2-2v-3a3.3 3.3 0 0 0-6.6 0v3l-1.2 2Z" />
      <path d="M6.5 13.2a1.6 1.6 0 0 0 3 0" />
    </svg>
  );
}

// ─── HERO STRIP ──────────────────────────────────────────────────────────

function CommandHero({
  summary, onViewHotDeals, onSendFollowups,
}: {
  summary: Summary | null;
  onViewHotDeals: () => void;
  onSendFollowups: () => void;
}) {
  const hotCount = summary?.hotDealsCount ?? 0;
  const valueCents = summary?.hotDealsValueCents ?? 0;
  const currency = summary?.currency ?? "USD";
  return (
    <div
      className="relative overflow-hidden rounded-2xl px-7 py-6 md:px-9 md:py-7"
      style={{
        background: `linear-gradient(135deg, ${PALETTE.forest} 0%, ${PALETTE.forestDeep} 100%)`,
        boxShadow: "0 8px 24px -12px rgba(13,38,32,0.35)",
      }}
    >
      {/* Decorative texture — subtle dot grid + faded ridge silhouette */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, ${PALETTE.gold} 1px, transparent 0)`,
          backgroundSize: "28px 28px",
        }}
      />
      <div
        aria-hidden
        className="absolute right-0 bottom-0 w-1/2 h-full pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 100% 100%, rgba(201,168,76,0.18) 0%, transparent 60%)`,
        }}
      />

      <div className="relative flex flex-wrap items-center justify-between gap-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] font-semibold" style={{ color: PALETTE.gold }}>
            <span>🔥</span> Today&apos;s focus
          </div>
          <div
            className="mt-2 text-white text-[22px] md:text-[26px] font-bold leading-tight"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            {hotCount > 0
              ? `You have ${hotCount} ${hotCount === 1 ? "deal" : "deals"} ready to close today.`
              : "All caught up — no hot deals right now."}
          </div>
          {valueCents > 0 && (
            <div className="mt-1 text-[13.5px] text-white/70">
              Potential revenue:{" "}
              <span className="font-semibold" style={{ color: PALETTE.gold }}>
                {formatMoney(valueCents, currency)}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onViewHotDeals}
            disabled={hotCount === 0}
            className="px-4 py-2 rounded-lg text-[13.5px] font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 active:scale-[0.98]"
            style={{ background: PALETTE.gold, color: PALETTE.forestDeep }}
          >
            View hot deals →
          </button>
          <button
            type="button"
            onClick={onSendFollowups}
            className="px-4 py-2 rounded-lg text-[13.5px] font-semibold transition hover:brightness-110 active:scale-[0.98]"
            style={{ background: "rgba(255,255,255,0.10)", color: "white", border: "1px solid rgba(255,255,255,0.22)" }}
          >
            Send follow-ups
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── FILTER PILLS (top of priorities list) ───────────────────────────────

function FilterPills({
  currentFilter, onFilter, summary, priorities,
}: {
  currentFilter: FilterKey;
  onFilter: (f: FilterKey) => void;
  summary: Summary | null;
  priorities: Priority[];
}) {
  const counts = {
    all: priorities.length,
    hot: priorities.filter((p) => p.score.label === "hot").length,
    "needs-followup": summary?.followupsDueCount ?? 0,
    unread: priorities.filter((p) => p.unreadCount > 0).length,
    "at-risk": priorities.filter((p) => p.atRisk).length,
  };
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <Pill label="All" count={counts.all} active={currentFilter === "all"} onClick={() => onFilter("all")} />
      <Pill label="Hot" count={counts.hot} active={currentFilter === "hot"} onClick={() => onFilter("hot")} accent={PALETTE.hot} />
      <Pill label="Follow-up" count={counts["needs-followup"]} active={currentFilter === "needs-followup"} onClick={() => onFilter("needs-followup")} accent={PALETTE.warm} />
      <Pill label="Unread" count={counts.unread} active={currentFilter === "unread"} onClick={() => onFilter("unread")} accent={PALETTE.forest} />
      <Pill label="At risk" count={counts["at-risk"]} active={currentFilter === "at-risk"} onClick={() => onFilter("at-risk")} accent={PALETTE.warm} />
    </div>
  );
}

function Pill({
  label, count, active, onClick, accent,
}: {
  label: string; count: number; active: boolean; onClick: () => void; accent?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[12px] font-semibold px-3 py-1.5 rounded-full transition flex items-center gap-1.5"
      style={{
        background: active ? PALETTE.forest : PALETTE.cardBg,
        color: active ? "white" : PALETTE.body,
        border: `1px solid ${active ? PALETTE.forest : PALETTE.line}`,
      }}
    >
      {label}
      {count > 0 && (
        <span
          className="text-[10.5px] tabular-nums px-1.5 py-0.5 rounded-full font-bold"
          style={{
            background: active ? "rgba(255,255,255,0.16)" : (accent ? `${accent}1c` : "rgba(13,38,32,0.06)"),
            color: active ? "white" : (accent ?? PALETTE.muted),
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

// ─── PRIORITY CARD ───────────────────────────────────────────────────────

const QUICK_REPLY_OPTIONS: Record<string, string[]> = {
  reply: [
    "Thanks for getting back — let me digest and reply with options shortly.",
    "Got it. I'll come back with adjustments by end of day.",
  ],
  follow_up: [
    "Just checking in — how's the proposal sitting with you?",
    "Happy to adjust anything; let me know what's on your mind.",
    "Want to jump on a quick call this week?",
  ],
  ask_for_booking: [
    "Shall I go ahead and confirm this for you?",
    "Ready to secure the camps before they release?",
  ],
  nudge: [
    "Just checking if you saw the proposal — let me know your thoughts.",
    "Anything I can clarify? Happy to walk you through it.",
  ],
  send_proposal: [
    "Just shared your itinerary — would love your feedback.",
  ],
  confirm_reservation: [
    "Reservations are in motion — I'll keep you posted.",
  ],
  stay_in_touch: [
    "Just keeping in touch — anything I can help with?",
  ],
  draft_quote: [],
  wait: [],
};

function PriorityCard({
  priority, busy, flash, onQuickReply, onAddTask, onMarkDone,
}: {
  priority: Priority;
  busy: "creating" | "completing" | "sending" | undefined;
  flash: { message: string; tone: "success" | "info" } | null;
  onQuickReply: (body: string) => void;
  onAddTask: () => void;
  onMarkDone: () => void;
}) {
  const isHot = priority.score.label === "hot";
  const labelColor = priority.score.label === "hot" ? PALETTE.hot : priority.score.label === "warm" ? PALETTE.warm : PALETTE.cold;
  const labelBg = priority.score.label === "hot" ? "#fee2e2" : priority.score.label === "warm" ? "#fef3c7" : "rgba(0,0,0,0.06)";
  const intentColor =
    priority.intentLabel === "high" ? PALETTE.green :
    priority.intentLabel === "medium" ? PALETTE.warm :
    PALETTE.muted;
  const hasActiveCommitment = !!priority.activeTask?.matchesNextAction;
  const isAutoTask = !!priority.activeTask?.auto;
  const quickReplyOptions = QUICK_REPLY_OPTIONS[priority.score.nextAction.type] ?? [];
  const showQuickReply = quickReplyOptions.length > 0 && !!priority.clientId;

  return (
    <li
      className={`relative rounded-2xl transition-all duration-200 ${isHot && !hasActiveCommitment ? "ss-hot-pulse" : ""}`}
      style={{
        background: PALETTE.cardBg,
        boxShadow: isHot && !hasActiveCommitment
          ? "0 4px 14px -4px rgba(220,38,38,0.18), 0 0 0 1px rgba(220,38,38,0.18)"
          : `0 1px 0 ${PALETTE.line}, 0 4px 14px -8px rgba(13,38,32,0.10)`,
        borderLeft: isHot && !hasActiveCommitment
          ? `3px solid ${PALETTE.hot}`
          : "3px solid transparent",
      }}
    >
      {flash && (
        <div
          className="absolute top-3 right-3 z-10 text-[10.5px] font-semibold px-2 py-1 rounded-md shadow-sm"
          style={{
            background: flash.tone === "success" ? "#dcfce7" : "#e0f2fe",
            color: flash.tone === "success" ? "#166534" : "#075985",
            border: `1px solid ${flash.tone === "success" ? "#86efac" : "#7dd3fc"}`,
            animation: "ss-flash-in 180ms ease-out",
          }}
        >
          {flash.message}
        </div>
      )}

      <div className="p-5 flex items-stretch gap-4">
        {/* Thumbnail */}
        <Thumbnail url={priority.thumbnailUrl} fallback={priority.clientName} />

        {/* Main column */}
        <div className="flex-1 min-w-0">
          {/* Header row: HOT badge + name + (right) value/score/intent.
              Stacks vertically below md so the value doesn't get
              squished against the name on narrow viewports. */}
          <div className="flex flex-col md:flex-row md:items-start md:justify-between md:gap-3 gap-1.5">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="text-[10px] uppercase tracking-[0.18em] font-bold px-2 py-0.5 rounded"
                  style={{ background: labelBg, color: labelColor }}
                >
                  {priority.score.label}
                </span>
                <Link
                  href={`/requests/${priority.requestId}`}
                  className="text-[16px] font-bold truncate hover:underline"
                  style={{ color: PALETTE.ink }}
                  title={priority.clientName}
                >
                  {priority.clientName}
                </Link>
                {hasActiveCommitment && (
                  <span
                    className="text-[9.5px] uppercase tracking-[0.18em] font-bold px-1.5 py-0.5 rounded shrink-0"
                    style={{
                      background: isAutoTask ? "#fef3c7" : "#dcfce7",
                      color: isAutoTask ? "#92400e" : "#166534",
                    }}
                  >
                    {isAutoTask ? "⚡ Auto task" : "✓ Task active"}
                  </span>
                )}
              </div>
              <div className="text-[12px] mt-0.5 truncate" style={{ color: PALETTE.muted }}>
                <span className="tabular-nums">#{priority.referenceNumber}</span>
                {priority.proposalTitle && <> · {priority.proposalTitle}</>}
              </div>
            </div>

            <div className="md:text-right shrink-0 flex md:block items-center gap-3 md:gap-0">
              {priority.valueCents > 0 ? (
                <div
                  className="text-[18px] md:text-[20px] font-bold tabular-nums leading-none"
                  style={{ color: PALETTE.ink }}
                >
                  {formatMoney(priority.valueCents, priority.currency)}
                </div>
              ) : (
                <div className="text-[12px]" style={{ color: PALETTE.muted }}>No quote yet</div>
              )}
              <div className="flex items-center md:justify-end gap-1.5 md:mt-1">
                <span className="text-[15px] font-bold tabular-nums" style={{ color: intentColor }}>
                  {priority.score.total}
                </span>
                <span className="text-[10.5px] uppercase tracking-[0.18em] font-semibold" style={{ color: intentColor }}>
                  {priority.intentLabel} intent
                </span>
              </div>
            </div>
          </div>

          {/* Signals row */}
          <div className="flex items-center gap-1.5 flex-wrap mt-3">
            <Signal icon="👀" label={`${priority.engagement.views} ${priority.engagement.views === 1 ? "view" : "views"}`} dim={priority.engagement.views === 0} />
            {priority.engagement.totalSeconds >= 30 && (
              <Signal icon="⏱️" label={formatDwell(priority.engagement.totalSeconds)} />
            )}
            {priority.engagement.pricingViewed && (
              <Signal icon="💰" label="Pricing viewed" highlight />
            )}
            {priority.engagement.inboundMessages > 0 && (
              <Signal icon="💬" label={`${priority.engagement.inboundMessages} ${priority.engagement.inboundMessages === 1 ? "reply" : "replies"}`} highlight />
            )}
            <Signal icon="🕒" label={formatRelative(priority.lastActivityIso)} dim />
          </div>

          {/* Insight box */}
          {priority.insightText && (
            <div
              className="mt-3 px-3 py-2 rounded-lg text-[12.5px] leading-snug"
              style={{
                background: "rgba(27,58,45,0.06)",
                color: PALETTE.ink,
              }}
            >
              <span className="font-semibold" style={{ color: PALETTE.forest }}>Insight:</span>{" "}
              {priority.insightText}
            </div>
          )}

          {/* Best move */}
          <div className="mt-3 text-[13px] leading-snug">
            <span className="font-semibold" style={{ color: PALETTE.ink }}>Best move:</span>{" "}
            <span style={{ color: PALETTE.body }}>{priority.score.nextAction.label}</span>
          </div>

          {/* Action bar */}
          <div className="mt-3.5 flex items-center gap-2 flex-wrap justify-end">
            {showQuickReply && (
              <QuickReplyDropdown
                options={quickReplyOptions}
                onPick={onQuickReply}
                busy={busy === "sending"}
              />
            )}
            {hasActiveCommitment ? (
              <button
                type="button"
                onClick={onMarkDone}
                disabled={busy === "completing"}
                className="text-[12px] font-semibold px-3 py-1.5 rounded-lg transition disabled:opacity-50"
                style={{ background: "#dcfce7", color: "#166534", border: "1px solid #86efac" }}
              >
                {busy === "completing" ? "…" : "✓ Mark done"}
              </button>
            ) : (
              <button
                type="button"
                onClick={onAddTask}
                disabled={busy === "creating"}
                className="text-[12px] font-semibold px-3 py-1.5 rounded-lg transition disabled:opacity-50"
                style={{ background: PALETTE.cardBg, color: PALETTE.body, border: `1px solid ${PALETTE.line}` }}
                onMouseEnter={(e) => { e.currentTarget.style.background = PALETTE.lineSoft; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = PALETTE.cardBg; }}
              >
                {busy === "creating" ? "Adding…" : "+ Add task"}
              </button>
            )}
            <Link
              href={`/requests/${priority.requestId}`}
              className="text-[12px] font-semibold px-4 py-1.5 rounded-lg transition text-white shadow-sm hover:brightness-110 active:scale-[0.98]"
              style={{
                background: priority.score.nextAction.urgent && !hasActiveCommitment
                  ? `linear-gradient(180deg, ${PALETTE.hot}, #b91c1c)`
                  : `linear-gradient(180deg, ${PALETTE.forest}, ${PALETTE.forestDeep})`,
              }}
            >
              Message →
            </Link>
          </div>
        </div>
      </div>
    </li>
  );
}

function Thumbnail({ url, fallback }: { url: string | null; fallback: string }) {
  const initial = (fallback?.trim()?.charAt(0) ?? "·").toUpperCase();
  if (url) {
    return (
      <div
        className="shrink-0 overflow-hidden"
        style={{ width: 64, height: 64, borderRadius: "50%", border: `1px solid ${PALETTE.line}` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={fallback} className="w-full h-full object-cover" />
      </div>
    );
  }
  return (
    <div
      className="shrink-0 flex items-center justify-center font-bold"
      style={{
        width: 64, height: 64, borderRadius: "50%",
        background: `linear-gradient(135deg, ${PALETTE.forest}, ${PALETTE.forestDeep})`,
        color: PALETTE.gold,
        fontSize: 24,
        letterSpacing: "0.05em",
      }}
      aria-hidden
    >
      {initial}
    </div>
  );
}

function Signal({
  icon, label, highlight = false, dim = false,
}: {
  icon: string; label: string; highlight?: boolean; dim?: boolean;
}) {
  let bg = "rgba(13,38,32,0.05)";
  let color = PALETTE.body;
  if (highlight) { bg = "rgba(27,58,45,0.10)"; color = PALETTE.forest; }
  if (dim) { bg = "transparent"; color = PALETTE.muted; }
  return (
    <span
      className="text-[11px] font-medium px-2 py-0.5 rounded-md inline-flex items-center gap-1"
      style={{ background: bg, color }}
    >
      <span aria-hidden style={{ opacity: 0.85 }}>{icon}</span>
      {label}
    </span>
  );
}

// ─── Quick reply dropdown ────────────────────────────────────────────────

function QuickReplyDropdown({
  options, onPick, busy,
}: {
  options: string[]; onPick: (body: string) => void; busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
        className="text-[12px] font-semibold px-3 py-1.5 rounded-lg transition disabled:opacity-50"
        style={{
          background: "rgba(27,58,45,0.08)",
          color: PALETTE.forest,
          border: "1px solid rgba(27,58,45,0.10)",
        }}
      >
        {busy ? "Sending…" : "Quick reply ▾"}
      </button>
      {open && !busy && (
        <div
          className="absolute z-30 right-0 mt-1.5 w-[300px] rounded-xl overflow-hidden"
          style={{
            background: "white",
            border: `1px solid ${PALETTE.line}`,
            boxShadow: "0 12px 28px -10px rgba(0,0,0,0.18)",
            animation: "ss-flash-in 140ms ease-out",
          }}
        >
          <div
            className="px-3 py-2 text-[10px] uppercase tracking-[0.22em] font-semibold"
            style={{ color: PALETTE.muted, borderBottom: `1px solid ${PALETTE.line}` }}
          >
            Quick reply
          </div>
          <ul>
            {options.map((opt) => (
              <li key={opt}>
                <button
                  type="button"
                  onClick={() => { onPick(opt); setOpen(false); }}
                  className="block w-full text-left text-[12.5px] px-3 py-2.5 transition"
                  style={{ color: PALETTE.ink }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = PALETTE.lineSoft; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  {opt}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Skeleton + empty ───────────────────────────────────────────────────

function PriorityCardSkeleton() {
  return (
    <div
      className="rounded-2xl p-5 flex gap-4"
      style={{ background: PALETTE.cardBg, boxShadow: `0 1px 0 ${PALETTE.line}` }}
    >
      <div className="w-16 h-16 rounded-full animate-pulse" style={{ background: PALETTE.lineSoft }} />
      <div className="flex-1 space-y-2.5">
        <div className="h-4 rounded animate-pulse w-1/3" style={{ background: PALETTE.lineSoft }} />
        <div className="h-3 rounded animate-pulse w-2/3" style={{ background: PALETTE.lineSoft }} />
        <div className="flex gap-1.5">
          <div className="h-5 rounded animate-pulse w-16" style={{ background: PALETTE.lineSoft }} />
          <div className="h-5 rounded animate-pulse w-20" style={{ background: PALETTE.lineSoft }} />
        </div>
      </div>
    </div>
  );
}

function EmptyCard({ message }: { message: string }) {
  return (
    <div
      className="rounded-2xl py-16 px-6 text-center text-[13px]"
      style={{ background: PALETTE.cardBg, color: PALETTE.muted, boxShadow: `0 1px 0 ${PALETTE.line}` }}
    >
      {message}
    </div>
  );
}

// ─── RIGHT — Task rail ──────────────────────────────────────────────────

function CommandTaskRail({
  tasksData, mobileOpen, onMobileClose,
}: {
  tasksData: TasksResponse | null;
  mobileOpen: boolean;
  onMobileClose: () => void;
}) {
  const tasks = tasksData?.tasks ?? [];
  return (
    <aside
      className={`
        z-40 w-[320px] border-l flex flex-col
        fixed inset-y-0 right-0 transition-transform duration-200 ease-out
        lg:static lg:transition-none lg:translate-x-0
        ${mobileOpen ? "translate-x-0 shadow-2xl" : "translate-x-full"}
      `}
      style={{ background: PALETTE.cardBg, borderColor: PALETTE.line }}
    >
      <div className="px-5 py-5 border-b flex items-center justify-between gap-2" style={{ borderColor: PALETTE.line }}>
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] font-semibold" style={{ color: PALETTE.muted }}>
            Today
          </div>
          <div className="text-[15px] font-semibold mt-0.5" style={{ color: PALETTE.ink }}>
            {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {tasksData && tasksData.counts.overdue > 0 && (
            <span
              className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full tabular-nums"
              style={{ background: "#fee2e2", color: PALETTE.hot }}
            >
              {tasksData.counts.overdue} overdue
            </span>
          )}
          {/* Close button on mobile only — hidden on lg+ since the drawer is static there. */}
          <button
            type="button"
            onClick={onMobileClose}
            className="lg:hidden w-7 h-7 rounded-md flex items-center justify-center transition"
            style={{ background: "transparent", color: PALETTE.muted }}
            onMouseEnter={(e) => { e.currentTarget.style.background = PALETTE.lineSoft; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            aria-label="Close tasks"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
              <path d="M3 3 L11 11 M11 3 L3 11" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {tasksData === null ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 rounded-lg animate-pulse" style={{ background: PALETTE.lineSoft }} />
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <div className="py-12 text-center text-[12.5px]" style={{ color: PALETTE.muted }}>
            No open tasks. Add one from a deal.
          </div>
        ) : (
          <ul className="space-y-1.5">
            {tasks.map((t) => <TaskRow key={t.id} task={t} />)}
          </ul>
        )}
      </div>

      <div className="border-t px-5 py-3" style={{ borderColor: PALETTE.line }}>
        <Link
          href="/requests"
          className="text-[12.5px] font-semibold transition hover:underline"
          style={{ color: PALETTE.forest }}
        >
          View all tasks →
        </Link>
      </div>
    </aside>
  );
}

function TaskRow({ task }: { task: Task }) {
  const dueLabel = formatDueLabel(task.dueAt);
  const priorityColor = task.overdue ? PALETTE.hot : PALETTE.forest;
  return (
    <li>
      <Link
        href={task.request ? `/requests/${task.request.id}` : "#"}
        className="block group rounded-lg px-3 py-2.5 transition"
        style={{ background: "transparent" }}
        onMouseEnter={(e) => { e.currentTarget.style.background = PALETTE.lineSoft; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
      >
        <div className="flex items-start gap-3">
          {/* Icon square */}
          <div
            className="shrink-0 mt-0.5 flex items-center justify-center"
            style={{
              width: 28, height: 28, borderRadius: 8,
              background: task.overdue ? "rgba(220,38,38,0.10)" : "rgba(27,58,45,0.08)",
              color: priorityColor,
            }}
            aria-hidden
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2.5" width="10" height="9" rx="1.5" />
              <path d="M4.5 6.5 L6.5 8.5 L9.5 5" />
            </svg>
          </div>

          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium truncate" style={{ color: PALETTE.ink }}>
              {task.title}
            </div>
            <div className="text-[11px] truncate mt-0.5" style={{ color: PALETTE.muted }}>
              {task.request?.clientName ?? "—"}
            </div>
          </div>

          <div className="shrink-0 text-right">
            <div
              className="text-[10px] font-semibold uppercase tracking-[0.16em] mb-0.5"
              style={{ color: priorityColor }}
            >
              {task.overdue ? "Overdue" : (dueLabel === "Today" ? "Today" : dueLabel === "Tomorrow" ? "Tomorrow" : "Soon")}
            </div>
            <div className="text-[10px]" style={{ color: PALETTE.muted }}>
              {dueLabel}
            </div>
          </div>
        </div>
      </Link>
    </li>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────

function formatMoney(cents: number, currency: string): string {
  if (!Number.isFinite(cents) || cents <= 0) return `${currency} 0`;
  const dollars = cents / 100;
  return `${currency} ${dollars.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
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

function formatDueLabel(iso: string | null): string {
  if (!iso) return "Anytime";
  const d = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
  const startOfDayAfter = new Date(startOfTomorrow);
  startOfDayAfter.setDate(startOfDayAfter.getDate() + 1);
  if (d < startOfToday) return "Overdue";
  if (d < startOfTomorrow) return "Today";
  if (d < startOfDayAfter) return "Tomorrow";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatDwell(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min`;
  return `${(seconds / 3600).toFixed(1)}h`;
}
