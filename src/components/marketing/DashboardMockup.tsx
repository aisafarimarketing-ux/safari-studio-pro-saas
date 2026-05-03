import { GOLD, GREEN, SERIF } from "./tokens";

// Stylised hero-side preview of the dashboard. Mirrors the real
// product layout: greeting strip → 3 separate KPI cards (counts +
// pipeline value) → 2-col content (left: hot deals · followup ·
// bookings; right: activity feed · tasks). Reads as a miniature
// of the actual /dashboard rather than a single-column stack.
//
// All sub-pieces (KpiCard / ActivityLine / FollowupMini / TaskMini /
// BookingPreview) live in this file because they're only used here
// and tightly coupled to the dark-card visual language.

export function DashboardMockup() {
  const subBg = "rgba(255,255,255,0.03)";
  const subBorder = "rgba(255,255,255,0.09)";
  const containerBorder = "rgba(255,255,255,0.14)";

  return (
    <div className="relative">
      {/* Soft warm halo behind the card so the dark surface lifts off
          the dark hero gradient with a faint amber glow. */}
      <div
        aria-hidden
        className="absolute -inset-5 rounded-[28px] opacity-70 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 50% 35%, rgba(215,183,91,0.18) 0%, transparent 65%)",
        }}
      />

      <div
        className="relative rounded-2xl p-3"
        style={{
          background: "rgba(10,22,18,0.92)",
          border: `1px solid ${containerBorder}`,
          boxShadow:
            "0 24px 48px -16px rgba(0,0,0,0.7), 0 8px 16px -8px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)",
        }}
      >
        {/* Greeting strip ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 px-1 pt-1 pb-3">
          <div>
            <div
              className="text-[9px] uppercase tracking-[0.22em] font-semibold"
              style={{ color: GOLD }}
            >
              Today
            </div>
            <div
              className="mt-0.5 text-white text-[14px]"
              style={{ fontFamily: SERIF, fontWeight: 600, letterSpacing: "-0.005em" }}
            >
              Good morning, Alex.
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className="w-7 h-7 rounded-md flex items-center justify-center text-[12px]"
              style={{
                background: subBg,
                border: `1px solid ${subBorder}`,
                color: "rgba(255,255,255,0.55)",
              }}
              aria-hidden
            >
              ◔
            </div>
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-[10.5px] font-bold"
              style={{ background: GREEN, color: "#fff" }}
              aria-hidden
            >
              AO
            </div>
          </div>
        </div>

        {/* KPI row — three separate cards ───────────────────────── */}
        <div className="grid grid-cols-3 gap-2">
          <KpiCard label="Hot deals" value="12" tone="hot" />
          <KpiCard label="Follow-up" value="5" tone="warn" />
          <KpiCard label="Pipeline" value="$124K" tone="ok" gold />
        </div>

        {/* 2-col content grid ───────────────────────────────────── */}
        <div className="mt-2 grid grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-2">
          {/* LEFT — Hot deal · Followup · Bookings */}
          <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-1.5 px-1">
              <span
                aria-hidden
                className="inline-block w-1.5 h-1.5 rounded-full"
                style={{
                  background: "#ef4444",
                  boxShadow: "0 0 0 3px rgba(239,68,68,0.22)",
                }}
              />
              <span
                className="text-[9px] uppercase font-bold"
                style={{ color: "#fca5a5", letterSpacing: "0.24em" }}
              >
                Happening now
              </span>
            </div>

            {/* Hot deal — DOMINANT card */}
            <HotDealCard />

            {/* Needs follow-up — supporting tier (dimmed) */}
            <div
              className="rounded-xl p-2.5"
              style={{
                background: "rgba(255,255,255,0.025)",
                border: "1px solid rgba(217,119,6,0.20)",
                opacity: 0.82,
              }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-[10px] font-semibold" style={{ color: "rgba(255,255,255,0.78)", fontFamily: SERIF }}>
                  ⚠️ Needs follow-up
                </div>
                <span
                  className="text-[8.5px] tabular-nums font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: "rgba(217,119,6,0.18)", color: "#fbbf24" }}
                >
                  5
                </span>
              </div>
              <FollowupMini name="Joshua Chen" sub="Viewed 3d ago · no reply" />
              <FollowupMini name="Marcus & Tara Reid" sub="Viewed 2d ago · no reply" />
            </div>

            {/* New bookings — supporting tier (dimmed) */}
            <div
              className="rounded-xl p-2.5"
              style={{
                background: "rgba(255,255,255,0.025)",
                border: "1px solid rgba(255,255,255,0.07)",
                opacity: 0.82,
              }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-[10px] font-semibold" style={{ color: "rgba(255,255,255,0.78)", fontFamily: SERIF }}>
                  💰 New bookings
                </div>
                <span
                  className="text-[8.5px] tabular-nums font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: "rgba(47,143,70,0.18)", color: "#9CD9A8" }}
                >
                  3
                </span>
              </div>
              <BookingPreview isNew client="Sam & Lily Wong" dates="2 Jul → 11 Jul" />
            </div>
          </div>

          {/* RIGHT — Activity feed · Tasks (supporting tier, dimmed) */}
          <div className="min-w-0 space-y-2" style={{ opacity: 0.82 }}>
            <div
              className="rounded-xl p-2.5"
              style={{
                background: "rgba(255,255,255,0.025)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-[10px] font-semibold" style={{ color: "rgba(255,255,255,0.78)", fontFamily: SERIF }}>
                  Client activity
                </div>
                <div className="text-[9.5px] font-semibold" style={{ color: GOLD, opacity: 0.85 }}>
                  View all →
                </div>
              </div>
              <div className="space-y-[7px]">
                <ActivityLine glyph="$" tone="amber" label="Marcus viewed pricing" sub="Anderson Family" time="1h" fresh />
                <ActivityLine glyph="◉" tone="green" label="Priya tapped Day 4" sub="Honeymoon" time="2h" />
                <ActivityLine glyph="✓" tone="success" label="Booking confirmed" sub="Devereux" time="4h" />
                <ActivityLine glyph="◇" tone="green" label="Sarah opened proposal" sub="Beach & Bush" time="5h" />
              </div>
            </div>

            <div
              className="rounded-xl p-2.5"
              style={{
                background: "rgba(255,255,255,0.025)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-[10px] font-semibold" style={{ color: "rgba(255,255,255,0.78)", fontFamily: SERIF }}>
                  Today&rsquo;s tasks
                </div>
                <span
                  className="text-[8.5px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: "rgba(220,38,38,0.18)", color: "#fca5a5" }}
                >
                  2 due
                </span>
              </div>
              <div className="space-y-1.5">
                <TaskMini label="Follow up with Lilian" due="Today" overdue />
                <TaskMini label="Send revised quote" due="Today" />
                <TaskMini label="Confirm Mara dates" due="Tomorrow" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Dominant card. Brighter surface, layered red glow, brighter red
// border, scaled padding for presence.
function HotDealCard() {
  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute -inset-2 rounded-2xl pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 0% 50%, rgba(239,68,68,0.30) 0%, transparent 70%)",
        }}
      />
      <div
        className="relative rounded-xl overflow-hidden"
        style={{
          background: "rgba(255,255,255,0.085)",
          border: "1px solid rgba(239,68,68,0.55)",
          boxShadow:
            "0 12px 28px -8px rgba(220,38,38,0.40), inset 0 1px 0 rgba(255,255,255,0.08)",
        }}
      >
        <div
          aria-hidden
          className="absolute left-0 top-0 bottom-0 w-[4px]"
          style={{ background: "linear-gradient(180deg,#ef4444 0%,#dc2626 100%)" }}
        />
        <div className="p-3.5 pl-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10.5px] font-bold" style={{ color: "#fff", fontFamily: SERIF }}>
              🔥 Hot deals
            </div>
            <div className="text-[9.5px] font-bold" style={{ color: GOLD }}>
              View all →
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-[13px] shrink-0"
              style={{
                background: GREEN,
                color: "#fff",
                boxShadow: "0 4px 10px -4px rgba(47,143,70,0.5)",
              }}
              aria-hidden
            >
              L
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <div className="text-white text-[13px] font-bold truncate">
                  Lilian Nyongesa
                </div>
                <span
                  className="text-[8px] uppercase tracking-[0.18em] font-bold px-1.5 py-[3px] rounded-[3px] shrink-0"
                  style={{
                    background: "linear-gradient(135deg,#ef4444 0%,#b91c1c 100%)",
                    color: "#fff",
                    boxShadow:
                      "0 2px 8px -2px rgba(239,68,68,0.55), inset 0 1px 0 rgba(255,255,255,0.18)",
                  }}
                >
                  Very hot
                </span>
              </div>
              <div className="text-[10.5px] flex items-center gap-1 mt-1">
                <span
                  className="inline-block w-1 h-1 rounded-full"
                  style={{
                    background: "#22c55e",
                    boxShadow: "0 0 0 2px rgba(34,197,94,0.28)",
                  }}
                />
                <span style={{ color: "#fff", fontWeight: 600 }}>Viewed pricing</span>
                <span style={{ color: "rgba(255,255,255,0.45)" }}>· 32m</span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div
                className="text-[26px] leading-none tabular-nums text-white"
                style={{
                  fontFamily: SERIF,
                  fontWeight: 800,
                  letterSpacing: "-0.03em",
                  textShadow: "0 1px 12px rgba(239,68,68,0.32)",
                }}
              >
                142
              </div>
              <div
                className="text-[8px] uppercase tracking-[0.22em] font-bold mt-1"
                style={{ color: "rgba(255,255,255,0.55)" }}
              >
                score
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Three separate KPI cards (Hot / Follow-up / Pipeline). Gold variant
// uses a faint gold gradient + gold value treatment for the money KPI.
function KpiCard({
  label,
  value,
  tone,
  gold = false,
}: {
  label: string;
  value: string;
  tone: "hot" | "warn" | "ok";
  gold?: boolean;
}) {
  const accent =
    tone === "hot" ? "#ef4444" : tone === "warn" ? "#f59e0b" : "#22c55e";
  return (
    <div
      className="rounded-xl px-3 py-2.5 relative overflow-hidden"
      style={{
        background: gold
          ? "linear-gradient(135deg, rgba(215,183,91,0.12) 0%, rgba(255,255,255,0.03) 100%)"
          : "rgba(255,255,255,0.04)",
        border: gold
          ? "1px solid rgba(215,183,91,0.30)"
          : "1px solid rgba(255,255,255,0.09)",
      }}
    >
      <div
        className="text-[8.5px] uppercase tracking-[0.22em] font-semibold flex items-center gap-1.5"
        style={{ color: "rgba(255,255,255,0.55)" }}
      >
        <span
          aria-hidden
          className="inline-block w-1.5 h-1.5 rounded-full"
          style={{ background: accent }}
        />
        {label}
      </div>
      <div
        className="mt-1 tabular-nums leading-none"
        style={{
          fontFamily: SERIF,
          fontSize: 26,
          fontWeight: 800,
          letterSpacing: "-0.025em",
          color: gold ? GOLD : "#fff",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function FollowupMini({ name, sub }: { name: string; sub: string }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <span
        aria-hidden
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ background: "#f59e0b" }}
      />
      <div className="flex-1 min-w-0">
        <div className="text-[11px] truncate text-white" style={{ fontWeight: 600 }}>
          {name}
        </div>
        <div className="text-[9.5px] truncate mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>
          {sub}
        </div>
      </div>
    </div>
  );
}

function TaskMini({
  label,
  due,
  overdue = false,
}: {
  label: string;
  due: string;
  overdue?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        aria-hidden
        className="w-3.5 h-3.5 rounded-[3px] shrink-0"
        style={{
          border: "1px solid rgba(255,255,255,0.32)",
          background: "rgba(255,255,255,0.04)",
        }}
      />
      <div className="flex-1 min-w-0">
        <div className="text-[11px] truncate text-white" style={{ fontWeight: 500 }}>
          {label}
        </div>
      </div>
      <div
        className="text-[9px] uppercase tracking-[0.16em] font-semibold shrink-0"
        style={{ color: overdue ? "#fca5a5" : "rgba(255,255,255,0.5)" }}
      >
        {overdue ? "Overdue" : due}
      </div>
    </div>
  );
}

function ActivityLine({
  glyph,
  tone,
  label,
  sub,
  time,
  fresh = false,
}: {
  glyph: string;
  tone: "amber" | "green" | "success";
  label: string;
  sub: string;
  time: string;
  fresh?: boolean;
}) {
  const swatch =
    tone === "amber"
      ? { bg: "rgba(215,183,91,0.16)", fg: GOLD }
      : tone === "success"
        ? { bg: "rgba(34,197,94,0.18)", fg: "#86efac" }
        : { bg: "rgba(47,143,70,0.18)", fg: "#9CD9A8" };
  return (
    <div className="flex items-start gap-2.5">
      <div
        className="w-6 h-6 rounded-md flex items-center justify-center text-[11px] shrink-0 mt-0.5"
        style={{ background: swatch.bg, color: swatch.fg }}
        aria-hidden
      >
        {glyph}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11.5px] truncate text-white" style={{ fontWeight: 600 }}>
          {label}
        </div>
        <div className="text-[10px] truncate" style={{ color: "rgba(255,255,255,0.5)" }}>
          {sub}
        </div>
      </div>
      <div
        className="text-[10px] tabular-nums shrink-0 mt-1 inline-flex items-center gap-1"
        style={{
          color: fresh ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.45)",
          fontWeight: fresh ? 600 : 400,
        }}
      >
        {fresh && (
          <span
            aria-hidden
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{
              background: "#16a34a",
              boxShadow: "0 0 0 3px rgba(22,163,74,0.25)",
            }}
          />
        )}
        {time}
      </div>
    </div>
  );
}

function BookingPreview({
  isNew = false,
  client,
  dates,
}: {
  isNew?: boolean;
  client: string;
  dates: string;
}) {
  return (
    <div
      className="flex items-center gap-2.5 px-2 py-1.5 rounded-md"
      style={{ background: isNew ? "rgba(22,163,74,0.08)" : "transparent" }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {isNew && (
            <span
              className="text-[7.5px] uppercase tracking-[0.20em] font-bold px-1 py-0.5 rounded shrink-0"
              style={{ background: "#dcfce7", color: "#166534" }}
            >
              New
            </span>
          )}
          <div className="text-[11.5px] truncate text-white" style={{ fontWeight: 600 }}>
            {client}
          </div>
        </div>
        <div
          className="text-[10px] tabular-nums truncate mt-0.5"
          style={{ color: "rgba(255,255,255,0.5)" }}
        >
          {dates}
        </div>
      </div>
      <span
        className="text-[10px] font-semibold px-2 py-1 rounded shrink-0"
        style={{ color: GOLD, border: "1px solid rgba(215,183,91,0.32)" }}
      >
        Open
      </span>
    </div>
  );
}
