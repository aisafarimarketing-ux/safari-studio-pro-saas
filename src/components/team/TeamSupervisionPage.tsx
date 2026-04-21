"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/properties/AppHeader";

// ─── Live team supervision dashboard ──────────────────────────────────────
//
// Two panels:
//   1. Left — roster. One row per member: avatar, name, role, online
//      status dot, current activity, workload mini-bar (new/working/open),
//      median response minutes, bookings this month.
//   2. Right — activity feed. Scrolls in newest-first; admins see the
//      whole org, members see only their own events.
//
// Polls /api/team every 15s and /api/activity every 20s. Lightweight
// enough for now — we'll swap to Supabase Realtime if team size makes
// polling wasteful.

type TeamMember = {
  userId: string;
  name: string | null;
  email: string | null;
  role: "owner" | "admin" | "member";
  roleTitle: string | null;
  profilePhotoUrl: string | null;
  memberSince: string;
  presence: {
    status: "online" | "idle" | "offline";
    currentView: string | null;
    currentAction: string | null;
    lastActiveAt: string | null;
  };
  workload: { new: number; working: number; open: number; total: number };
  medianResponseMinutes: number | null;
  bookedThisMonth: number;
};

type ActivityEvent = {
  id: string;
  type: string;
  targetType: string | null;
  targetId: string | null;
  detail: Record<string, unknown> | null;
  createdAt: string;
  user: { id: string; name: string | null; email: string | null } | null;
};

export function TeamSupervisionPage() {
  const [team, setTeam] = useState<TeamMember[] | null>(null);
  const [events, setEvents] = useState<ActivityEvent[] | null>(null);
  const [you, setYou] = useState<{ userId: string; role: "owner" | "admin" | "member" } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load team list + poll.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/team", { cache: "no-store" });
        if (res.status === 401) { window.location.href = "/sign-in"; return; }
        if (res.status === 409) { window.location.href = "/select-organization"; return; }
        if (!res.ok) throw new Error(`Team load failed (HTTP ${res.status})`);
        const data = await res.json();
        if (!cancelled) {
          setTeam(data.team);
          setYou(data.you);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Team load failed");
      }
    };
    load();
    const interval = setInterval(load, 15_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  // Load activity feed + poll.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/activity?limit=50", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setEvents(data.events);
      } catch {
        // swallow — activity feed is best-effort
      }
    };
    load();
    const interval = setInterval(load, 20_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  // Summary stats for the top strip.
  const summary = useMemo(() => {
    if (!team) return null;
    const online = team.filter((m) => m.presence.status === "online").length;
    const totalOpen = team.reduce((sum, m) => sum + m.workload.total, 0);
    const totalBooked = team.reduce((sum, m) => sum + m.bookedThisMonth, 0);
    const responses = team
      .map((m) => m.medianResponseMinutes)
      .filter((v): v is number => typeof v === "number");
    const teamMedian = responses.length ? median(responses) : null;
    return { online, total: team.length, totalOpen, totalBooked, teamMedian };
  }, [team]);

  const isAdmin = you?.role === "admin" || you?.role === "owner";

  return (
    <div className="min-h-screen bg-[#f8f5ef]">
      <AppHeader />
      <main className="max-w-[1280px] mx-auto px-6 py-10">
        <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
          <div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-black/50">Supervision</div>
            <h1 className="mt-2 text-[32px] md:text-[40px] font-bold tracking-tight text-black/85" style={{ fontFamily: "'Playfair Display', serif" }}>
              Team
            </h1>
            <p className="mt-2 text-[14px] text-black/55 max-w-xl">
              Who has what, who&apos;s online, response time, pending work. Updated live.
            </p>
          </div>
          <Link
            href="/settings/team"
            className="text-[12px] text-black/45 hover:text-[#1b3a2d] transition"
          >
            Manage seats &amp; invites →
          </Link>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-[#b34334]/30 bg-[#b34334]/5 p-4 text-[13px] text-[#b34334]">
            {error}
          </div>
        )}

        {/* Top summary strip */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <Stat label="Online" value={`${summary.online} / ${summary.total}`} />
            <Stat label="Open work" value={String(summary.totalOpen)} />
            <Stat label="Booked this month" value={String(summary.totalBooked)} />
            <Stat
              label="Team median response"
              value={summary.teamMedian != null ? formatMinutes(summary.teamMedian) : "—"}
            />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
          {/* Roster */}
          <section className="bg-white rounded-2xl border border-black/8 overflow-hidden">
            <header className="px-5 py-4 border-b border-black/8 flex items-center justify-between">
              <div className="text-[11px] uppercase tracking-[0.28em] font-semibold text-black/55">
                Members · {team?.length ?? 0}
              </div>
            </header>
            {team === null ? (
              <div className="p-5 space-y-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-16 rounded-xl bg-black/5 animate-pulse" />
                ))}
              </div>
            ) : team.length === 0 ? (
              <div className="p-10 text-center text-[14px] text-black/45">
                No team members yet. Invite someone via{" "}
                <Link href="/settings/team" className="underline text-[#1b3a2d]">
                  Settings → Team
                </Link>
                .
              </div>
            ) : (
              <ul className="divide-y divide-black/5">
                {team.map((m) => (
                  <MemberRow key={m.userId} member={m} isSelf={m.userId === you?.userId} />
                ))}
              </ul>
            )}
          </section>

          {/* Activity feed */}
          <aside className="bg-white rounded-2xl border border-black/8 overflow-hidden lg:sticky lg:top-6 self-start max-h-[70vh] flex flex-col">
            <header className="px-5 py-4 border-b border-black/8 flex items-center justify-between shrink-0">
              <div className="text-[11px] uppercase tracking-[0.28em] font-semibold text-black/55">
                {isAdmin ? "Activity · Live" : "Your activity"}
              </div>
              <LiveDot />
            </header>
            <div className="overflow-y-auto flex-1">
              {events === null ? (
                <div className="p-5 space-y-2">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="h-10 rounded-lg bg-black/5 animate-pulse" />
                  ))}
                </div>
              ) : events.length === 0 ? (
                <div className="p-8 text-center text-[13px] text-black/45">
                  No recent activity yet.
                </div>
              ) : (
                <ul className="divide-y divide-black/5">
                  {events.map((e) => (
                    <ActivityRow key={e.id} event={e} />
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

// ─── Member row ──────────────────────────────────────────────────────────

function MemberRow({ member, isSelf }: { member: TeamMember; isSelf: boolean }) {
  const name = member.name || member.email || "Unnamed";
  const initial = (name ?? "·").trim().charAt(0).toUpperCase();
  const activity =
    member.presence.status === "offline"
      ? member.presence.lastActiveAt
        ? `last seen ${timeAgo(member.presence.lastActiveAt)}`
        : "offline"
      : member.presence.currentAction || member.presence.currentView || "active";

  return (
    <li className="px-5 py-4 flex items-center gap-4">
      {/* Avatar + status dot */}
      <div className="relative shrink-0">
        {member.profilePhotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={member.profilePhotoUrl}
            alt={name}
            className="w-11 h-11 rounded-full object-cover"
          />
        ) : (
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center text-[15px] font-semibold"
            style={{ background: "rgba(201,168,76,0.15)", color: "#8a7228" }}
          >
            {initial}
          </div>
        )}
        <span
          className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white"
          style={{
            background:
              member.presence.status === "online"
                ? "#2ea04a"
                : member.presence.status === "idle"
                  ? "#d6a13a"
                  : "#b0b0b0",
          }}
          title={member.presence.status}
        />
      </div>

      {/* Name + activity */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-[14px] text-black/85 truncate">{name}</span>
          <RolePill role={member.role} />
          {isSelf && (
            <span className="text-[10px] uppercase tracking-[0.2em] text-black/40">You</span>
          )}
        </div>
        <div className="text-[12px] text-black/50 truncate">{activity}</div>
      </div>

      {/* Workload */}
      <div className="hidden sm:flex items-center gap-2 shrink-0 text-[11px] tabular-nums">
        <Chip label="New" value={member.workload.new} accent="#c9a84c" />
        <Chip label="Working" value={member.workload.working} accent="#1b3a2d" />
        <Chip label="Open" value={member.workload.open} accent="#3a5a7a" />
      </div>

      {/* Response time + bookings */}
      <div className="hidden md:block text-right shrink-0 min-w-[110px]">
        <div className="text-[11.5px] text-black/55 tabular-nums">
          {member.medianResponseMinutes != null
            ? `${formatMinutes(member.medianResponseMinutes)} median reply`
            : "— no data"}
        </div>
        <div className="text-[11.5px] text-black/40 tabular-nums mt-0.5">
          {member.bookedThisMonth} booked · month
        </div>
      </div>
    </li>
  );
}

function RolePill({ role }: { role: "owner" | "admin" | "member" }) {
  const label = role === "owner" ? "Owner" : role === "admin" ? "Admin" : "Member";
  const tone =
    role === "owner"
      ? { bg: "rgba(201,168,76,0.18)", fg: "#8a7228" }
      : role === "admin"
        ? { bg: "rgba(27,58,45,0.1)", fg: "#1b3a2d" }
        : { bg: "rgba(0,0,0,0.05)", fg: "rgba(0,0,0,0.5)" };
  return (
    <span
      className="inline-block text-[9.5px] uppercase tracking-[0.18em] font-semibold px-1.5 py-0.5 rounded"
      style={{ background: tone.bg, color: tone.fg }}
    >
      {label}
    </span>
  );
}

function Chip({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="flex flex-col items-center px-2 py-0.5 rounded min-w-[52px]" style={{ background: "rgba(0,0,0,0.03)" }}>
      <span className="font-semibold" style={{ color: accent }}>{value}</span>
      <span className="text-[9.5px] uppercase tracking-[0.18em] text-black/45 leading-none">{label}</span>
    </div>
  );
}

// ─── Activity row ────────────────────────────────────────────────────────

function ActivityRow({ event }: { event: ActivityEvent }) {
  const actor = event.user?.name || event.user?.email || "Someone";
  const phrase = describeEvent(event);
  return (
    <li className="px-5 py-3 text-[12.5px] leading-snug">
      <div className="text-black/70">
        <span className="font-medium text-black/85">{actor}</span>{" "}
        <span>{phrase}</span>
      </div>
      <div className="text-[10.5px] text-black/40 mt-0.5 tabular-nums">
        {timeAgo(event.createdAt)}
      </div>
    </li>
  );
}

function describeEvent(e: ActivityEvent): string {
  switch (e.type) {
    case "signin":        return "signed in";
    case "signout":       return "signed out";
    case "viewRequest":   return "opened a request";
    case "createRequest": return `created request ${((e.detail?.referenceNumber as string) ?? "")}`.trim();
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

// ─── Tiny UI helpers ──────────────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-black/8 px-4 py-3">
      <div className="text-[9.5px] uppercase tracking-[0.28em] font-semibold text-black/50 mb-1">{label}</div>
      <div className="text-[22px] font-bold tracking-tight text-black/85 tabular-nums">{value}</div>
    </div>
  );
}

function LiveDot() {
  return (
    <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.22em] text-black/45">
      <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: "#2ea04a", boxShadow: "0 0 0 3px rgba(46,160,74,0.2)" }} />
      live
    </span>
  );
}

// ─── Formatters ──────────────────────────────────────────────────────────

function formatMinutes(m: number): string {
  if (m < 1) return "<1m";
  if (m < 60) return `${Math.round(m)}m`;
  if (m < 60 * 24) return `${(m / 60).toFixed(1)}h`;
  return `${(m / (60 * 24)).toFixed(1)}d`;
}

function timeAgo(iso: string): string {
  const now = Date.now();
  const t = new Date(iso).getTime();
  const diff = Math.max(0, now - t) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
}

function median(nums: number[]): number {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}
