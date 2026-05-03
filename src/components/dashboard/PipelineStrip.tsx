"use client";

import Link from "next/link";
import { useDashboardTheme } from "./DashboardTheme";

// ─── Live Pipeline Strip ─────────────────────────────────────────────────
//
// One horizontal row that traces the full safari deal journey:
//
//   [Draft] → [Sent] → [Viewed] → [Booking requested] → [Confirmed]
//
// Each stage is a card with a large number, a stage label, and an
// optional conversion-from-previous-stage subtitle. The stage where
// the most deals currently sit gets a soft glow + gold ring so the
// eye lands on "where am I stuck" first. Drop-off between stages
// surfaces as a small red ⚠ on the connecting line.
//
// Replaces the old hero stat tiles (Hot / Follow-up / Pipeline $) —
// the strip carries the same urgency signal but with the linked-
// journey context the operator actually needs to act.

export type PipelineData = {
  draft: number;
  sent: number;
  viewed: number;
  bookingRequested: number;
  confirmed: number;
  hotDeals: number;
  conversion: {
    draftToSent: number;
    sentToViewed: number;
    viewedToBooking: number;
    bookingToConfirmed: number;
  };
};

type Stage = {
  key: keyof Pick<PipelineData, "draft" | "sent" | "viewed" | "bookingRequested" | "confirmed">;
  label: string;
  href: string;
};

const STAGES: Stage[] = [
  { key: "draft",            label: "Draft",         href: "/proposals?status=draft" },
  { key: "sent",             label: "Sent",          href: "/proposals?status=sent" },
  { key: "viewed",           label: "Viewed",        href: "/dashboard#dash-hot-deals" },
  { key: "bookingRequested", label: "Booking req.",  href: "/dashboard#dash-bookings" },
  { key: "confirmed",        label: "Confirmed",     href: "/dashboard#dash-bookings" },
];

// Threshold below which a stage transition is flagged as a drop-off
// — i.e. fewer than 25% of the previous stage made it through. Tuned
// for safari sales where viewed→booking is naturally around 20-40%.
const DROPOFF_THRESHOLD = 0.25;

export function PipelineStrip({
  data,
  loading = false,
}: {
  data: PipelineData | null;
  loading?: boolean;
}) {
  const { tokens } = useDashboardTheme();

  // Identify the active stage — where the most deals currently sit.
  // Used to highlight that card with a gold ring + brighter glow so
  // the operator sees "this is where my pipeline is stuck".
  const activeKey = data ? findActiveStage(data) : null;

  if (loading || !data) {
    return (
      <section
        className="rounded-2xl px-5 py-5 md:px-6 md:py-6 relative overflow-hidden"
        style={{
          background: tokens.heroBg,
          boxShadow: "0 8px 24px -14px rgba(13,38,32,0.5)",
        }}
      >
        <PipelineHeader />
        <div className="mt-5 grid grid-cols-5 gap-2">
          {STAGES.map((s) => (
            <div
              key={s.key}
              className="h-[100px] rounded-2xl animate-pulse"
              style={{ background: "rgba(255,255,255,0.04)" }}
            />
          ))}
        </div>
      </section>
    );
  }

  const counts: Record<Stage["key"], number> = {
    draft: data.draft,
    sent: data.sent,
    viewed: data.viewed,
    bookingRequested: data.bookingRequested,
    confirmed: data.confirmed,
  };
  const conversions: Record<Stage["key"], number | null> = {
    draft: null,
    sent: data.conversion.draftToSent,
    viewed: data.conversion.sentToViewed,
    bookingRequested: data.conversion.viewedToBooking,
    confirmed: data.conversion.bookingToConfirmed,
  };
  const previousCounts: Record<Stage["key"], number> = {
    draft: 0,
    sent: data.draft + data.sent, // draft+sent is the bucket "ever drafted"
    viewed: data.sent,
    bookingRequested: data.viewed,
    confirmed: data.bookingRequested,
  };

  return (
    <section
      className="rounded-2xl px-5 py-5 md:px-6 md:py-6 relative overflow-hidden"
      style={{
        background: tokens.heroBg,
        boxShadow: "0 8px 24px -14px rgba(13,38,32,0.5)",
      }}
    >
      {/* Faint amber wash on the right so the strip lifts off the
          dashboard's plain bg with a subtle gradient cue. */}
      <div
        aria-hidden
        className="absolute right-0 top-0 bottom-0 w-1/2 pointer-events-none opacity-50"
        style={{
          background:
            "radial-gradient(ellipse at 100% 50%, rgba(215,183,91,0.14) 0%, transparent 65%)",
        }}
      />

      <div className="relative">
        <PipelineHeader hotDeals={data.hotDeals} />

        {/* The strip — five stage cards with connectors between them */}
        <div className="mt-5 flex items-stretch gap-1.5 md:gap-2">
          {STAGES.map((stage, i) => {
            const count = counts[stage.key];
            const conv = conversions[stage.key];
            const prev = previousCounts[stage.key];
            const isActive = activeKey === stage.key;
            const isLast = i === STAGES.length - 1;
            const showHotBadge = stage.key === "viewed" && data.hotDeals > 0;
            return (
              <div
                key={stage.key}
                className="flex-1 flex items-stretch min-w-0"
              >
                <StageCard
                  href={stage.href}
                  label={stage.label}
                  count={count}
                  conversion={conv}
                  previousCount={prev}
                  isActive={isActive}
                  isTerminal={isLast}
                  hotBadge={showHotBadge ? data.hotDeals : null}
                />
                {!isLast && (
                  <Connector
                    conversion={conversions[STAGES[i + 1].key] ?? 0}
                    fromCount={count}
                    toCount={counts[STAGES[i + 1].key]}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── Header (eyebrow + count summary) ───────────────────────────────────

function PipelineHeader({ hotDeals }: { hotDeals?: number } = {}) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div>
        <div
          className="text-[10px] uppercase tracking-[0.26em] font-bold"
          style={{ color: "#E0B85C" }}
        >
          Live pipeline
        </div>
        <div
          className="mt-1 text-white text-[15px] md:text-[16px]"
          style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 600, letterSpacing: "-0.01em" }}
        >
          Where every deal sits right now
        </div>
      </div>
      {typeof hotDeals === "number" && hotDeals > 0 && (
        <div
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold"
          style={{
            background: "linear-gradient(135deg, rgba(220,38,38,0.20) 0%, rgba(220,38,38,0.10) 100%)",
            color: "#fca5a5",
            border: "1px solid rgba(239,68,68,0.32)",
          }}
        >
          <span aria-hidden>🔥</span>
          {hotDeals} hot {hotDeals === 1 ? "deal" : "deals"}
        </div>
      )}
    </div>
  );
}

// ─── Single stage card ──────────────────────────────────────────────────

function StageCard({
  href,
  label,
  count,
  conversion,
  previousCount,
  isActive,
  isTerminal,
  hotBadge,
}: {
  href: string;
  label: string;
  count: number;
  conversion: number | null;
  previousCount: number;
  isActive: boolean;
  isTerminal: boolean;
  hotBadge: number | null;
}) {
  // Active stage: gold ring + amber inner glow (this is where deals
  // are stacking up — most actionable).
  // Terminal stage: forest border + green glow (the win — emphasised
  // even when not active).
  // Default: subtle dark surface.
  const surface = isActive
    ? "rgba(255,255,255,0.10)"
    : isTerminal
      ? "rgba(47,143,70,0.10)"
      : "rgba(255,255,255,0.04)";
  const borderColor = isActive
    ? "rgba(224,184,92,0.65)"
    : isTerminal
      ? "rgba(47,143,70,0.45)"
      : "rgba(255,255,255,0.10)";
  const glow = isActive
    ? "0 8px 22px -8px rgba(224,184,92,0.45), inset 0 1px 0 rgba(255,255,255,0.08)"
    : isTerminal
      ? "0 6px 18px -8px rgba(47,143,70,0.45), inset 0 1px 0 rgba(255,255,255,0.05)"
      : "inset 0 1px 0 rgba(255,255,255,0.04)";

  // Tooltip — built from previous + current + conversion %.
  const ratePct = conversion != null ? Math.round(conversion * 100) : null;
  const tooltip =
    ratePct != null
      ? `${previousCount} previous → ${count} ${label.toLowerCase()} (${ratePct}%)`
      : `${count} ${label.toLowerCase()}`;

  return (
    <Link
      href={href}
      className="flex-1 min-w-0 rounded-2xl px-2.5 py-3 md:px-3 md:py-4 relative overflow-hidden transition-all duration-150 hover:-translate-y-0.5 hover:brightness-110 group"
      style={{
        background: surface,
        border: `1px solid ${borderColor}`,
        boxShadow: glow,
      }}
      title={tooltip}
    >
      {/* Hot-deals badge — sits inside the Viewed stage */}
      {hotBadge != null && (
        <div className="absolute -top-2 right-2">
          <span
            className="inline-flex items-center gap-1 text-[9px] uppercase tracking-[0.18em] font-bold px-1.5 py-0.5 rounded shadow-sm"
            style={{
              background: "linear-gradient(135deg,#ef4444 0%,#b91c1c 100%)",
              color: "#fff",
              boxShadow: "0 2px 8px -2px rgba(239,68,68,0.55)",
            }}
          >
            🔥 {hotBadge}
          </span>
        </div>
      )}

      <div
        className="text-[8.5px] uppercase tracking-[0.20em] font-bold"
        style={{ color: "rgba(255,255,255,0.55)" }}
      >
        {label}
      </div>
      <div
        className="mt-1 leading-none tabular-nums"
        style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: "clamp(28px, 3.6vw, 38px)",
          fontWeight: 800,
          letterSpacing: "-0.025em",
          color: isActive ? "#E0B85C" : isTerminal ? "#9CD9A8" : "#fff",
        }}
      >
        {count}
      </div>
      {ratePct != null && previousCount > 0 && (
        <div
          className="mt-1 text-[10.5px] tabular-nums"
          style={{ color: "rgba(255,255,255,0.50)" }}
        >
          {ratePct}% from prev
        </div>
      )}
      {ratePct == null && (
        <div
          className="mt-1 text-[10.5px]"
          style={{ color: "rgba(255,255,255,0.4)" }}
        >
          starting line
        </div>
      )}
    </Link>
  );
}

// ─── Connector line between stages ──────────────────────────────────────

function Connector({
  conversion,
  fromCount,
  toCount,
}: {
  conversion: number;
  fromCount: number;
  toCount: number;
}) {
  // Drop-off heuristic: previous stage had real volume but very
  // little carried through. Don't flag when the previous stage is
  // empty (no volume = no drop-off, just no data).
  const isDropoff =
    fromCount >= 3 && conversion < DROPOFF_THRESHOLD && toCount < fromCount;
  const accent = isDropoff
    ? "rgba(239,68,68,0.55)"
    : conversion >= 0.5
      ? "rgba(224,184,92,0.55)"
      : "rgba(255,255,255,0.18)";

  return (
    <div className="hidden md:flex items-center px-1 shrink-0" aria-hidden>
      <div className="relative flex items-center">
        <div
          className="w-6 h-px"
          style={{
            background: `linear-gradient(90deg, transparent 0%, ${accent} 50%, transparent 100%)`,
          }}
        />
        {isDropoff && (
          <div
            className="absolute left-1/2 -translate-x-1/2 -top-2 w-3 h-3 rounded-full flex items-center justify-center text-[8px]"
            style={{
              background: "rgba(239,68,68,0.85)",
              color: "#fff",
              boxShadow: "0 0 0 2px rgba(239,68,68,0.20)",
            }}
            title={`Drop-off: only ${Math.round(conversion * 100)}% carried through`}
          >
            !
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Active-stage detection ─────────────────────────────────────────────

// "Active" = where the most deals currently sit (ignoring confirmed,
// since that's the win not a stuck state). Tiebreak rightward so a
// late-stage tie reads as further along the journey.
function findActiveStage(data: PipelineData): Stage["key"] | null {
  const candidates: { key: Stage["key"]; count: number }[] = [
    { key: "draft", count: data.draft },
    { key: "sent", count: data.sent },
    { key: "viewed", count: data.viewed },
    { key: "bookingRequested", count: data.bookingRequested },
  ];
  let best: { key: Stage["key"]; count: number } | null = null;
  for (const c of candidates) {
    if (c.count === 0) continue;
    if (!best || c.count >= best.count) best = c;
  }
  return best?.key ?? null;
}
