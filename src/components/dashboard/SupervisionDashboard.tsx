"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useOrganization } from "@clerk/nextjs";
import { AppHeader } from "@/components/properties/AppHeader";
import { NewRequestDialog } from "@/components/requests/NewRequestDialog";

// ─── Supervision Dashboard ─────────────────────────────────────────────────
//
// First screen the operator sees after sign-in. Answers one question:
// "What should I do right now?" — with a secondary rollup of how the
// business is doing.
//
// Three lanes of data, all pulled in parallel:
//   1. Personal (everyone): my assigned requests by stage, my recent
//      activity, my response-time median.
//   2. Team (everyone reads; admins see full names, members see roster):
//      presence + workload from /api/team. Drives the "team pulse" card.
//   3. Business rollup (admin/owner only): /api/analytics totals + bySource.
//      Members get personal totals derived from their own request list.
//
// Every card links to a deeper view so the dashboard is a control tower,
// not a dead-end summary page.

type Me = {
  userId: string;
  name: string | null;
  email: string | null;
  role: "owner" | "admin" | "member";
  organizationName: string | null;
};

type TeamRow = {
  userId: string;
  name: string | null;
  email: string | null;
  role: "owner" | "admin" | "member";
  profilePhotoUrl: string | null;
  presence: {
    status: "online" | "idle" | "offline";
    currentAction: string | null;
    lastActiveAt: string | null;
  };
  workload: { new: number; working: number; open: number; total: number };
  medianResponseMinutes: number | null;
  bookedThisMonth: number;
};

type MyRequestRow = {
  id: string;
  referenceNumber: string;
  status: string;
  receivedAt: string;
  lastActivityAt: string;
  client: {
    firstName: string | null;
    lastName: string | null;
    email: string;
    country: string | null;
  } | null;
  tripBrief: { title?: string; destinations?: string[]; nights?: number } | null;
};

type AnalyticsSummary = {
  totals: {
    received: number;
    booked: number;
    conversion: number;
    medianResponseMinutes: number | null;
  };
};

type ActivityEvent = {
  id: string;
  type: string;
  detail: Record<string, unknown> | null;
  createdAt: string;
  user: { name: string | null; email: string | null } | null;
};

export function SupervisionDashboard() {
  const { organization } = useOrganization();
  const [me, setMe] = useState<Me | null>(null);
  const [team, setTeam] = useState<TeamRow[] | null>(null);
  const [myRequests, setMyRequests] = useState<MyRequestRow[] | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [events, setEvents] = useState<ActivityEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // ── Load everything in parallel ─────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [meRes, teamRes, myReqRes, analyticsRes, activityRes] = await Promise.all([
          fetch("/api/me", { cache: "no-store" }),
          fetch("/api/team", { cache: "no-store" }),
          fetch("/api/requests?status=new&status=working&status=open&assignedToUserId=me", { cache: "no-store" }),
          fetch("/api/analytics", { cache: "no-store" }), // admin-only — 403 for members
          fetch("/api/activity?limit=12", { cache: "no-store" }),
        ]);
        if (meRes.status === 401) { window.location.href = "/sign-in?redirect_url=/dashboard"; return; }
        if (meRes.status === 409) { window.location.href = "/select-organization"; return; }
        if (!meRes.ok) throw new Error(`HTTP ${meRes.status}`);

        const meBody = await meRes.json();
        setMe({
          userId: meBody.user.id,
          name: meBody.user.name,
          email: meBody.user.email,
          role: meBody.role,
          organizationName: meBody.organization?.name ?? null,
        });

        if (teamRes.ok) {
          const t = await teamRes.json();
          setTeam((t.team as TeamRow[]) ?? []);
        }
        if (myReqRes.ok) {
          const r = await myReqRes.json();
          setMyRequests((r.requests as MyRequestRow[]) ?? []);
        }
        if (analyticsRes.ok) {
          const a = await analyticsRes.json();
          setAnalytics(a as AnalyticsSummary);
        }
        if (activityRes.ok) {
          const ev = await activityRes.json();
          setEvents((ev.events as ActivityEvent[]) ?? []);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load workspace");
      }
    })();
  }, []);

  // ── Derived stats ───────────────────────────────────────────────────────
  const personalOpen = myRequests?.length ?? null;
  const personalBookedThisMonth = useMemo(() => {
    if (!team || !me) return null;
    return team.find((t) => t.userId === me.userId)?.bookedThisMonth ?? 0;
  }, [team, me]);
  const personalMedian = useMemo(() => {
    if (!team || !me) return null;
    return team.find((t) => t.userId === me.userId)?.medianResponseMinutes ?? null;
  }, [team, me]);

  const onlineCount = team?.filter((t) => t.presence.status === "online").length ?? null;
  const orgName = organization?.name ?? me?.organizationName ?? "your workspace";
  const firstName = me?.name?.split(" ")[0] ?? "there";
  const isAdmin = me?.role === "owner" || me?.role === "admin";

  // ── Overdue calculation — requests assigned to me with no activity 48h+ ──
  const overdue = useMemo(() => {
    if (!myRequests) return [];
    const cutoff = Date.now() - 48 * 60 * 60 * 1000;
    return myRequests.filter((r) => new Date(r.lastActivityAt).getTime() < cutoff);
  }, [myRequests]);

  return (
    <div className="min-h-screen text-[#1a1a1a]" style={{ background: "#f8f5ef" }}>
      <AppHeader />

      <main className="max-w-[1280px] mx-auto px-6 py-10 md:py-12">
        {/* Welcome */}
        <header className="mb-8">
          <h1 className="text-[30px] md:text-[36px] font-bold tracking-tight text-black/85" style={{ fontFamily: "'Playfair Display', serif" }}>
            Good {greeting()}, {firstName}.
          </h1>
          <p className="mt-2 text-[14px] text-black/55">
            {personalOpen !== null && personalOpen > 0
              ? `You have ${personalOpen} open request${personalOpen === 1 ? "" : "s"} on your plate${overdue.length > 0 ? ` — ${overdue.length} overdue` : ""}.`
              : `Welcome back to ${orgName}.`}
          </p>
        </header>

        {error && (
          <div className="mb-6 rounded-xl border border-[#b34334]/30 bg-[#b34334]/5 p-4 text-[13px] text-[#b34334]">
            {error}
          </div>
        )}

        {/* KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <KPI
            label={isAdmin ? "Received · 90d" : "My open"}
            value={isAdmin ? (analytics ? String(analytics.totals.received) : "—") : String(personalOpen ?? 0)}
          />
          <KPI
            label={isAdmin ? "Booked · 90d" : "Booked · month"}
            value={isAdmin ? (analytics ? String(analytics.totals.booked) : "—") : String(personalBookedThisMonth ?? 0)}
          />
          <KPI
            label={isAdmin ? "Conversion" : "My median reply"}
            value={
              isAdmin
                ? analytics ? `${Math.round(analytics.totals.conversion * 100)}%` : "—"
                : personalMedian != null ? formatMinutes(personalMedian) : "—"
            }
          />
          <KPI
            label="Online now"
            value={onlineCount != null ? `${onlineCount} / ${team?.length ?? 0}` : "—"}
          />
        </div>

        {/* Primary action strip */}
        <div className="mb-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="text-[13px] font-semibold text-white px-5 py-2.5 rounded-full"
            style={{ background: "#1b3a2d" }}
          >
            + New Request
          </button>
          <Link
            href="/requests"
            className="text-[13px] font-medium px-5 py-2.5 rounded-full border"
            style={{ borderColor: "rgba(0,0,0,0.12)", color: "rgba(0,0,0,0.75)" }}
          >
            Pipeline inbox →
          </Link>
          <Link
            href="/team"
            className="text-[13px] font-medium px-5 py-2.5 rounded-full border"
            style={{ borderColor: "rgba(0,0,0,0.12)", color: "rgba(0,0,0,0.75)" }}
          >
            Team view →
          </Link>
          {isAdmin && (
            <Link
              href="/analytics"
              className="text-[13px] font-medium px-5 py-2.5 rounded-full border"
              style={{ borderColor: "rgba(0,0,0,0.12)", color: "rgba(0,0,0,0.75)" }}
            >
              Analytics →
            </Link>
          )}
          <Link
            href="/properties"
            className="text-[13px] font-medium px-5 py-2.5 rounded-full border"
            style={{ borderColor: "rgba(0,0,0,0.12)", color: "rgba(0,0,0,0.75)" }}
          >
            Library →
          </Link>
        </div>

        {/* Two-column main area */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
          {/* Left — For you today + Team pulse + Overdue */}
          <div className="space-y-6">
            {/* For you today */}
            <section className="bg-white rounded-2xl border border-black/8 overflow-hidden">
              <header className="px-5 py-4 border-b border-black/8 flex items-center justify-between">
                <div className="text-[11px] uppercase tracking-[0.28em] font-semibold text-black/55">
                  For you today · {personalOpen ?? 0}
                </div>
                <Link href="/requests?assignedToUserId=me" className="text-[11.5px] text-black/45 hover:text-[#1b3a2d]">
                  View all →
                </Link>
              </header>
              {myRequests === null ? (
                <div className="p-5 space-y-2">
                  {[0, 1, 2].map((i) => <div key={i} className="h-14 rounded-lg bg-black/5 animate-pulse" />)}
                </div>
              ) : myRequests.length === 0 ? (
                <div className="p-10 text-center text-[13.5px] text-black/50">
                  No open requests assigned to you. <br />
                  <button
                    type="button"
                    onClick={() => setDialogOpen(true)}
                    className="text-[12.5px] font-medium text-[#1b3a2d] hover:underline mt-2"
                  >
                    + Capture a new inquiry
                  </button>
                </div>
              ) : (
                <ul className="divide-y divide-black/5">
                  {myRequests.slice(0, 6).map((r) => <MyRequestRowUI key={r.id} row={r} />)}
                </ul>
              )}
            </section>

            {/* Team pulse */}
            {team && team.length > 0 && (
              <section className="bg-white rounded-2xl border border-black/8 overflow-hidden">
                <header className="px-5 py-4 border-b border-black/8 flex items-center justify-between">
                  <div className="text-[11px] uppercase tracking-[0.28em] font-semibold text-black/55">
                    Team pulse
                  </div>
                  <Link href="/team" className="text-[11.5px] text-black/45 hover:text-[#1b3a2d]">
                    Full team →
                  </Link>
                </header>
                <ul className="divide-y divide-black/5">
                  {team.slice(0, 4).map((t) => <TeamMiniRow key={t.userId} member={t} isMe={t.userId === me?.userId} />)}
                </ul>
              </section>
            )}

            {/* Overdue callout — only when non-empty */}
            {overdue.length > 0 && (
              <section className="rounded-2xl border border-[#b34334]/25 bg-[#b34334]/[0.04] p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.24em] font-semibold text-[#b34334]">
                      Overdue · {overdue.length}
                    </div>
                    <div className="text-[13.5px] text-black/75 mt-1">
                      These haven&apos;t moved in 48h. Poke them, reassign, or close out.
                    </div>
                  </div>
                  <Link
                    href="/requests?assignedToUserId=me"
                    className="text-[12px] font-medium text-white px-3 py-1.5 rounded-full shrink-0"
                    style={{ background: "#b34334" }}
                  >
                    Review →
                  </Link>
                </div>
              </section>
            )}
          </div>

          {/* Right — Recent activity */}
          <aside className="bg-white rounded-2xl border border-black/8 overflow-hidden self-start lg:sticky lg:top-6 flex flex-col max-h-[75vh]">
            <header className="px-5 py-4 border-b border-black/8 flex items-center justify-between shrink-0">
              <div className="text-[11px] uppercase tracking-[0.28em] font-semibold text-black/55">
                {isAdmin ? "Team activity" : "Your activity"}
              </div>
              <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.22em] text-black/45">
                <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: "#2ea04a" }} />
                live
              </span>
            </header>
            <div className="overflow-y-auto flex-1">
              {events === null ? (
                <div className="p-5 space-y-2">
                  {[0, 1, 2].map((i) => <div key={i} className="h-10 rounded-lg bg-black/5 animate-pulse" />)}
                </div>
              ) : events.length === 0 ? (
                <div className="p-6 text-center text-[12.5px] text-black/45">Nothing yet today.</div>
              ) : (
                <ul className="divide-y divide-black/5">
                  {events.map((e) => <ActivityRow key={e.id} event={e} />)}
                </ul>
              )}
            </div>
          </aside>
        </div>
      </main>

      {dialogOpen && (
        <NewRequestDialog
          onClose={() => setDialogOpen(false)}
          onCreated={() => {
            setDialogOpen(false);
            // Hard reload pulls fresh counts + activity feed in one shot.
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}

// ─── Row + helper components ──────────────────────────────────────────────

function MyRequestRowUI({ row }: { row: MyRequestRow }) {
  const name = [row.client?.firstName, row.client?.lastName].filter(Boolean).join(" ").trim() || row.client?.email || "—";
  const trip = row.tripBrief?.title || row.tripBrief?.destinations?.slice(0, 3).join(" · ") || "—";
  const stageLabel = row.status === "new" ? "New" : row.status === "working" ? "Working" : "Open";
  const stageColor = row.status === "new" ? "#c9a84c" : row.status === "working" ? "#1b3a2d" : "#3a5a7a";
  return (
    <li>
      <Link href={`/requests/${row.id}`} className="block px-5 py-3 hover:bg-black/[0.02] transition">
        <div className="flex items-start gap-3">
          <span
            className="mt-[5px] shrink-0 inline-block w-2 h-2 rounded-full"
            style={{ background: stageColor }}
            title={stageLabel}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-[13.5px] font-medium text-black/85 truncate">{name}</span>
              <span className="text-[10.5px] tabular-nums text-black/40">#{row.referenceNumber}</span>
            </div>
            <div className="text-[12px] text-black/55 truncate">{trip}</div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[10.5px] uppercase tracking-[0.22em] font-semibold" style={{ color: stageColor }}>{stageLabel}</div>
            <div className="text-[10.5px] text-black/40 tabular-nums mt-0.5">{formatRelative(row.lastActivityAt)}</div>
          </div>
        </div>
      </Link>
    </li>
  );
}

function TeamMiniRow({ member, isMe }: { member: TeamRow; isMe: boolean }) {
  const name = member.name || member.email || "Unnamed";
  const initial = (name ?? "·").trim().charAt(0).toUpperCase();
  const dotColor =
    member.presence.status === "online" ? "#2ea04a" :
    member.presence.status === "idle" ? "#d6a13a" : "#b0b0b0";
  const activity =
    member.presence.status === "offline"
      ? member.presence.lastActiveAt ? `last seen ${formatRelative(member.presence.lastActiveAt)}` : "offline"
      : member.presence.currentAction || "active";
  return (
    <li className="px-5 py-3 flex items-center gap-3">
      <div className="relative shrink-0">
        {member.profilePhotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={member.profilePhotoUrl} alt={name} className="w-9 h-9 rounded-full object-cover" />
        ) : (
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-semibold" style={{ background: "rgba(201,168,76,0.15)", color: "#8a7228" }}>
            {initial}
          </div>
        )}
        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white" style={{ background: dotColor }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium text-black/85 truncate">{name}</span>
          {isMe && <span className="text-[9.5px] uppercase tracking-[0.2em] text-black/40">You</span>}
        </div>
        <div className="text-[11.5px] text-black/50 truncate">{activity}</div>
      </div>
      <div className="text-[11px] tabular-nums text-black/55 shrink-0">
        {member.workload.total > 0 ? `${member.workload.total} open` : "—"}
      </div>
    </li>
  );
}

function ActivityRow({ event }: { event: ActivityEvent }) {
  const actor = event.user?.name || event.user?.email || "Someone";
  const phrase = describeEvent(event);
  return (
    <li className="px-5 py-3 text-[12.5px] leading-snug">
      <div className="text-black/70">
        <span className="font-medium text-black/85">{actor}</span> <span>{phrase}</span>
      </div>
      <div className="text-[10.5px] text-black/40 mt-0.5">{formatRelative(event.createdAt)}</div>
    </li>
  );
}

function describeEvent(e: ActivityEvent): string {
  switch (e.type) {
    case "signin":        return "signed in";
    case "signout":       return "signed out";
    case "viewRequest":   return "opened a request";
    case "createRequest": return `created request ${(e.detail?.referenceNumber as string) ?? ""}`.trim();
    case "assignRequest": return "assigned a request";
    case "changeStatus":  return `moved a request to ${(e.detail?.to as string) ?? "a new status"}`;
    case "postNote":      return "posted a note";
    case "createQuote":   return "created a quote";
    case "sendQuote":     return "sent a quote";
    case "editProposal":  return "edited a proposal";
    case "archiveProperty": return "archived a property";
    case "editBrandDNA":  return "updated Brand DNA";
    case "viewLibrary":   return "browsed the library";
    case "viewTeam":      return "opened the team view";
    default:              return e.type;
  }
}

function KPI({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-black/8 px-4 py-3">
      <div className="text-[9.5px] uppercase tracking-[0.28em] font-semibold text-black/50 mb-1">{label}</div>
      <div className="text-[22px] font-bold tracking-tight text-black/85 tabular-nums">{value}</div>
    </div>
  );
}

// ─── Formatters ───────────────────────────────────────────────────────────

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}

function formatMinutes(m: number): string {
  if (m < 1) return "<1m";
  if (m < 60) return `${Math.round(m)}m`;
  if (m < 60 * 24) return `${(m / 60).toFixed(1)}h`;
  return `${(m / (60 * 24)).toFixed(1)}d`;
}

function formatRelative(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
}
