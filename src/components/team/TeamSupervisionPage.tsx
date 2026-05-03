"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/properties/AppHeader";

// ─── Live team performance command center ─────────────────────────────────
//
// Three layers, top → bottom:
//   1. Top-performers strip — three ranking cards (bookings, pipeline,
//      fastest response). Surfaces who to celebrate / who's leading at
//      a glance.
//   2. Player cards grid — one card per member with: name + role +
//      online dot, action score, 2x2 metric grid (Proposals / Hot /
//      Follow-up / Bookings), median response, signal chips (🔥 ⏳ ⚠️),
//      badges, suggested actions, last activity.
//   3. Activity feed — org-wide event stream, scrollable.
//
// Polls /api/team every 15s and /api/activity every 20s.

const FOREST = "#1b3a2d";
const GREEN_BRIGHT = "#34a04c";
const GOLD = "#c9a84c";
const HOT = "#dc2626";
const WARN = "#f59e0b";

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
  metrics: {
    proposalsActive: number;
    hotDeals: number;
    needsFollowup: number;
    atRisk: number;
    bookingsThisMonth: number;
    bookingsAllTime: number;
    medianResponseMinutes: number | null;
    actionScore: number;
  };
  badges: string[];
  suggestedActions: { label: string; tone: "hot" | "warn" | "info" }[];
  lastActivity: { description: string; at: string } | null;
};

type Ranking = { userId: string; name: string | null; value: number };

type TeamResponse = {
  team: TeamMember[];
  rankings: {
    topByBookings: Ranking[];
    topByPipeline: Ranking[];
    fastestResponse: Ranking[];
  };
  orgId: string;
  you: { userId: string; role: "owner" | "admin" | "member" };
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
  const [data, setData] = useState<TeamResponse | null>(null);
  const [events, setEvents] = useState<ActivityEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Team poll — 15s.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/team", { cache: "no-store" });
        if (res.status === 401) { window.location.href = "/sign-in"; return; }
        if (res.status === 409) { window.location.href = "/select-organization"; return; }
        if (!res.ok) throw new Error(`Team load failed (HTTP ${res.status})`);
        const json = (await res.json()) as TeamResponse;
        if (!cancelled) {
          setData(json);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Team load failed");
      }
    };
    void load();
    const t = setInterval(load, 15_000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  // Activity poll — 20s.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/activity?limit=30", { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setEvents(json.events ?? []);
      } catch { /* secondary surface — silent */ }
    };
    void load();
    const t = setInterval(load, 20_000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  const team = data?.team ?? null;
  const rankings = data?.rankings ?? null;
  const youRole = data?.you?.role ?? "member";

  // Sort the player-card grid by action score so top performers
  // surface first. Tiebreak on bookings → hot deals → name.
  const sortedTeam = useMemo(() => {
    if (!team) return [];
    return [...team].sort((a, b) => {
      if (b.metrics.actionScore !== a.metrics.actionScore) {
        return b.metrics.actionScore - a.metrics.actionScore;
      }
      if (b.metrics.bookingsThisMonth !== a.metrics.bookingsThisMonth) {
        return b.metrics.bookingsThisMonth - a.metrics.bookingsThisMonth;
      }
      if (b.metrics.hotDeals !== a.metrics.hotDeals) {
        return b.metrics.hotDeals - a.metrics.hotDeals;
      }
      return (a.name ?? "").localeCompare(b.name ?? "");
    });
  }, [team]);

  return (
    <div className="min-h-screen" style={{ background: "#f8f5ef" }}>
      <AppHeader />
      <main className="max-w-[1280px] mx-auto px-6 py-10">
        <header className="mb-8 flex items-baseline justify-between flex-wrap gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-black/50">
              Team
            </div>
            <h1
              className="mt-2 text-[32px] md:text-[40px] font-bold tracking-tight text-black/85"
              style={{ fontFamily: "'Playfair Display', serif", letterSpacing: "-0.02em" }}
            >
              Performance command center
            </h1>
            <p className="mt-2 text-[14px] text-black/55 max-w-[640px]">
              Who&rsquo;s leading the week, where the money is, who needs a
              nudge. Polls live every 15 seconds.
            </p>
          </div>
          {(youRole === "owner" || youRole === "admin") && (
            <Link
              href="/settings/team"
              className="text-[12.5px] font-semibold transition hover:text-[#1b3a2d]"
              style={{ color: GOLD }}
            >
              Manage seats →
            </Link>
          )}
        </header>

        {error && (
          <div
            className="mb-6 rounded-xl p-4 text-[13px]"
            style={{
              background: "rgba(179,67,52,0.08)",
              color: "#b34334",
              border: "1px solid rgba(179,67,52,0.22)",
            }}
          >
            {error}
          </div>
        )}

        {!data && !error && <LoadingSkeleton />}

        {data && (
          <>
            {/* ── Top performers strip ──────────────────────────── */}
            {rankings && <RankingsStrip rankings={rankings} />}

            {/* ── Player cards grid ─────────────────────────────── */}
            <section className="mt-8">
              <div className="flex items-baseline justify-between mb-4 gap-3">
                <h2
                  className="text-[20px] font-bold text-black/85"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  The roster
                </h2>
                <span className="text-[11.5px] text-black/45 tabular-nums">
                  {sortedTeam.length} member{sortedTeam.length === 1 ? "" : "s"} · sorted by action score
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {sortedTeam.map((m) => (
                  <PlayerCard key={m.userId} member={m} />
                ))}
              </div>
            </section>

            {/* ── Activity feed ────────────────────────────────── */}
            <section className="mt-10">
              <h2
                className="text-[20px] font-bold text-black/85 mb-4"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                Live activity
              </h2>
              <div
                className="rounded-2xl bg-white"
                style={{
                  border: "1px solid rgba(0,0,0,0.08)",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                }}
              >
                {events === null ? (
                  <div className="p-6 text-[13px] text-black/45">Loading…</div>
                ) : events.length === 0 ? (
                  <div className="p-6 text-[13px] text-black/45 text-center">
                    No team activity in the last hour. The feed updates every 20 seconds.
                  </div>
                ) : (
                  <ul className="divide-y divide-black/5">
                    {events.slice(0, 20).map((e) => (
                      <ActivityItem key={e.id} event={e} />
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

// ─── Top performers strip ────────────────────────────────────────────────

function RankingsStrip({ rankings }: { rankings: TeamResponse["rankings"] }) {
  return (
    <section>
      <div className="flex items-baseline justify-between mb-4 gap-3">
        <h2
          className="text-[20px] font-bold text-black/85"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          Top performers · this week
        </h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <RankingCard
          icon="💰"
          title="Most bookings"
          accent={FOREST}
          rows={rankings.topByBookings}
          formatValue={(v) => `${v} ${v === 1 ? "booking" : "bookings"}`}
        />
        <RankingCard
          icon="🔥"
          title="Biggest pipeline"
          accent={GOLD}
          rows={rankings.topByPipeline}
          formatValue={(v) => `${v} active`}
        />
        <RankingCard
          icon="⚡"
          title="Fastest response"
          accent="#3a6ea5"
          rows={rankings.fastestResponse}
          formatValue={(v) => formatMinutes(v)}
        />
      </div>
    </section>
  );
}

function RankingCard({
  icon,
  title,
  accent,
  rows,
  formatValue,
}: {
  icon: string;
  title: string;
  accent: string;
  rows: Ranking[];
  formatValue: (value: number) => string;
}) {
  return (
    <div
      className="rounded-2xl bg-white p-5 relative overflow-hidden"
      style={{
        border: "1px solid rgba(0,0,0,0.08)",
        boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 4px 12px -4px rgba(0,0,0,0.05)",
      }}
    >
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[3px]"
        style={{ background: accent }}
      />
      <div className="flex items-center gap-2 mb-3.5">
        <span className="text-[18px]" aria-hidden>{icon}</span>
        <div
          className="text-[10.5px] uppercase font-bold"
          style={{ color: "rgba(0,0,0,0.55)", letterSpacing: "0.22em" }}
        >
          {title}
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="text-[12px] text-black/40 py-2">
          Not enough data yet.
        </div>
      ) : (
        <ol className="space-y-2.5">
          {rows.map((r, i) => (
            <li key={r.userId} className="flex items-center gap-3">
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold tabular-nums shrink-0"
                style={{
                  background: i === 0 ? accent : "rgba(0,0,0,0.06)",
                  color: i === 0 ? "#fff" : "rgba(0,0,0,0.55)",
                }}
              >
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[13.5px] font-semibold text-black/85 truncate">
                  {r.name ?? "Unnamed"}
                </div>
              </div>
              <div
                className="text-[12.5px] tabular-nums shrink-0"
                style={{ color: accent, fontWeight: 600 }}
              >
                {formatValue(r.value)}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// ─── Player card ─────────────────────────────────────────────────────────

function PlayerCard({ member }: { member: TeamMember }) {
  const m = member;
  const score = m.metrics.actionScore;
  // Score colour mirrors the dashboard's status palette: hot above
  // 70, warm above 40, watching otherwise.
  const scoreTone = score >= 70 ? "hot" : score >= 40 ? "warm" : "watching";
  const scoreColor = scoreTone === "hot" ? HOT : scoreTone === "warm" ? WARN : "rgba(0,0,0,0.55)";
  const scoreBg =
    scoreTone === "hot"
      ? "rgba(220,38,38,0.10)"
      : scoreTone === "warm"
        ? "rgba(245,158,11,0.10)"
        : "rgba(0,0,0,0.04)";

  return (
    <article
      className="rounded-2xl bg-white p-5 transition-all duration-150 hover:-translate-y-0.5"
      style={{
        border: "1px solid rgba(0,0,0,0.08)",
        boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 4px 12px -4px rgba(0,0,0,0.06)",
      }}
    >
      {/* ── Header row: avatar / name / role / score ───────────── */}
      <div className="flex items-start gap-3">
        <Avatar photo={m.profilePhotoUrl} name={m.name} status={m.presence.status} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[15px] font-bold text-black/90 truncate">
              {m.name ?? "Unnamed"}
            </span>
            <RolePill role={m.role} />
          </div>
          <div className="text-[11.5px] text-black/50 truncate mt-0.5">
            {m.roleTitle || m.email || ""}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div
            className="text-[24px] leading-none tabular-nums"
            style={{
              fontFamily: "'Playfair Display', serif",
              fontWeight: 800,
              color: scoreColor,
              letterSpacing: "-0.02em",
            }}
          >
            {score}
          </div>
          <div
            className="text-[8.5px] uppercase tracking-[0.20em] font-bold mt-0.5 px-1.5 py-0.5 rounded inline-block"
            style={{ background: scoreBg, color: scoreColor }}
          >
            Score
          </div>
        </div>
      </div>

      {/* ── Badges row ─────────────────────────────────────────── */}
      {m.badges.length > 0 && (
        <div className="mt-3 flex items-center gap-1.5 flex-wrap">
          {m.badges.map((b) => (
            <BadgePill key={b} label={b} />
          ))}
        </div>
      )}

      {/* ── 2x2 metric grid ────────────────────────────────────── */}
      <div
        className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3"
      >
        <Metric label="Proposals" value={m.metrics.proposalsActive} />
        <Metric label="Bookings · MTD" value={m.metrics.bookingsThisMonth} />
        <Metric label="Hot deals" value={m.metrics.hotDeals} accent={m.metrics.hotDeals > 0 ? HOT : undefined} />
        <Metric
          label="Median reply"
          stringValue={
            m.metrics.medianResponseMinutes != null
              ? formatMinutes(m.metrics.medianResponseMinutes)
              : "—"
          }
        />
      </div>

      {/* ── Signal chips (🔥 / ⏳ / ⚠️) ──────────────────────── */}
      <div className="mt-4 flex items-center gap-2 flex-wrap">
        <SignalChip
          glyph="🔥"
          label="Hot"
          count={m.metrics.hotDeals}
          tone="hot"
        />
        <SignalChip
          glyph="⏳"
          label="Follow-up"
          count={m.metrics.needsFollowup}
          tone="warn"
        />
        <SignalChip
          glyph="⚠️"
          label="At risk"
          count={m.metrics.atRisk}
          tone="risk"
        />
      </div>

      {/* ── Suggested actions ──────────────────────────────────── */}
      {m.suggestedActions.length > 0 && (
        <div
          className="mt-4 rounded-lg px-3 py-2.5"
          style={{
            background: "rgba(27,58,45,0.04)",
            border: "1px solid rgba(27,58,45,0.10)",
          }}
        >
          <div
            className="text-[9.5px] uppercase font-bold mb-1.5"
            style={{ color: FOREST, letterSpacing: "0.22em" }}
          >
            Next moves
          </div>
          <ul className="space-y-1">
            {m.suggestedActions.map((a, i) => (
              <li key={i} className="flex items-center gap-1.5 text-[12px]">
                <span
                  aria-hidden
                  className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                  style={{
                    background:
                      a.tone === "hot" ? HOT : a.tone === "warn" ? WARN : FOREST,
                  }}
                />
                <span style={{ color: "rgba(0,0,0,0.78)" }}>{a.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Last activity strip ────────────────────────────────── */}
      {m.lastActivity && (
        <div
          className="mt-4 pt-3 flex items-center justify-between gap-2 text-[11.5px]"
          style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}
        >
          <span className="text-black/55 truncate">{m.lastActivity.description}</span>
          <span className="text-black/40 tabular-nums shrink-0">
            {formatRelative(m.lastActivity.at)}
          </span>
        </div>
      )}
    </article>
  );
}

// ─── Small helpers ───────────────────────────────────────────────────────

function Avatar({
  photo,
  name,
  status,
}: {
  photo: string | null;
  name: string | null;
  status: "online" | "idle" | "offline";
}) {
  const initial = (name?.trim().charAt(0) ?? "·").toUpperCase();
  const dotColor =
    status === "online" ? GREEN_BRIGHT : status === "idle" ? WARN : "rgba(0,0,0,0.30)";
  return (
    <div className="relative shrink-0">
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo}
          alt={name ?? "Avatar"}
          className="w-12 h-12 rounded-full object-cover"
          style={{ border: "1px solid rgba(0,0,0,0.08)" }}
        />
      ) : (
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-[16px]"
          style={{
            background: `linear-gradient(135deg, ${FOREST} 0%, #142a20 100%)`,
            color: "#fff",
          }}
          aria-hidden
        >
          {initial}
        </div>
      )}
      <span
        aria-hidden
        className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full"
        style={{
          background: dotColor,
          boxShadow: "0 0 0 2px #fff",
        }}
      />
    </div>
  );
}

function RolePill({ role }: { role: "owner" | "admin" | "member" }) {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    owner: { bg: "rgba(201,168,76,0.16)", fg: "#7a5d2e", label: "Owner" },
    admin: { bg: "rgba(58,110,165,0.14)", fg: "#2c5384", label: "Admin" },
    member: { bg: "rgba(0,0,0,0.06)", fg: "rgba(0,0,0,0.55)", label: "Member" },
  };
  const s = map[role] ?? map.member;
  return (
    <span
      className="text-[8.5px] uppercase tracking-[0.20em] font-bold px-1.5 py-0.5 rounded shrink-0"
      style={{ background: s.bg, color: s.fg }}
    >
      {s.label}
    </span>
  );
}

function Metric({
  label,
  value,
  stringValue,
  accent,
}: {
  label: string;
  value?: number;
  stringValue?: string;
  accent?: string;
}) {
  const display = stringValue ?? String(value ?? 0);
  return (
    <div className="min-w-0">
      <div
        className="text-[9px] uppercase font-bold mb-1"
        style={{ color: "rgba(0,0,0,0.45)", letterSpacing: "0.20em" }}
      >
        {label}
      </div>
      <div
        className="text-[20px] tabular-nums leading-none"
        style={{
          fontFamily: "'Playfair Display', serif",
          fontWeight: 800,
          letterSpacing: "-0.022em",
          color: accent ?? "rgba(0,0,0,0.88)",
        }}
      >
        {display}
      </div>
    </div>
  );
}

function SignalChip({
  glyph,
  label,
  count,
  tone,
}: {
  glyph: string;
  label: string;
  count: number;
  tone: "hot" | "warn" | "risk";
}) {
  const palette: Record<string, { bg: string; fg: string }> = {
    hot: { bg: "rgba(220,38,38,0.10)", fg: "#b91c1c" },
    warn: { bg: "rgba(245,158,11,0.12)", fg: "#92400e" },
    risk: { bg: "rgba(220,38,38,0.06)", fg: "#7f1d1d" },
  };
  const s = palette[tone];
  const dim = count === 0;
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full"
      style={{
        background: dim ? "rgba(0,0,0,0.04)" : s.bg,
        color: dim ? "rgba(0,0,0,0.4)" : s.fg,
      }}
    >
      <span aria-hidden style={{ filter: dim ? "grayscale(100%)" : undefined, opacity: dim ? 0.5 : 1 }}>
        {glyph}
      </span>
      <span>{label}</span>
      <span className="tabular-nums">{count}</span>
    </span>
  );
}

function BadgePill({ label }: { label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] uppercase font-bold px-2 py-0.5 rounded"
      style={{
        background: "rgba(201,168,76,0.16)",
        color: "#7a5d2e",
        letterSpacing: "0.16em",
      }}
    >
      <span aria-hidden>★</span>
      {label}
    </span>
  );
}

// ─── Activity feed item ──────────────────────────────────────────────────

function ActivityItem({ event }: { event: ActivityEvent }) {
  const who = event.user?.name ?? event.user?.email ?? "Someone";
  return (
    <li className="px-5 py-3 flex items-baseline gap-3 hover:bg-black/[0.02] transition">
      <div className="flex-1 min-w-0">
        <div className="text-[13px] text-black/85 truncate">
          <span className="font-semibold">{who}</span>{" "}
          <span className="text-black/55">— {describeEventType(event.type, event.targetType)}</span>
        </div>
      </div>
      <span className="text-[11px] text-black/40 tabular-nums shrink-0">
        {formatRelative(event.createdAt)}
      </span>
    </li>
  );
}

function describeEventType(type: string, targetType: string | null): string {
  switch (type) {
    case "signin": return "signed in";
    case "signout": return "signed out";
    case "viewRequest": return "opened a request";
    case "createRequest": return "created a request";
    case "createQuote": return "drafted a quote";
    case "sendQuote": return "sent a quote";
    case "assignRequest": return "assigned a request";
    case "changeStatus": return "moved a deal";
    case "postNote": return "left a note";
    case "editProposal": return "edited a proposal";
    case "archiveProperty": return "archived a property";
    case "editBrandDNA": return "updated Brand DNA";
    default: return targetType ? `touched a ${targetType}` : "worked on a deal";
  }
}

function LoadingSkeleton() {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-32 rounded-2xl bg-white animate-pulse"
            style={{ border: "1px solid rgba(0,0,0,0.08)" }}
          />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-72 rounded-2xl bg-white animate-pulse"
            style={{ border: "1px solid rgba(0,0,0,0.08)" }}
          />
        ))}
      </div>
    </>
  );
}

// ─── Format helpers ──────────────────────────────────────────────────────

function formatMinutes(min: number): string {
  if (!Number.isFinite(min)) return "—";
  if (min < 60) return `${Math.round(min)}m`;
  const hrs = min / 60;
  if (hrs < 24) return `${Math.round(hrs * 10) / 10}h`;
  return `${Math.round(hrs / 24)}d`;
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
