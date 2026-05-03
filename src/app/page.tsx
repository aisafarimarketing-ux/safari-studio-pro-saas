/* eslint-disable @next/next/no-html-link-for-pages */
// Native <a> tags for /sign-in and /sign-up are intentional — Clerk's
// widget mounts cleanly on a fresh document load, avoiding the
// empty-on-first-load behaviour that a client-side <Link> transition
// can trigger. Don't replace these with <Link> without verifying the
// auth flow in incognito.

import Link from "next/link";

// ─── Landing page ────────────────────────────────────────────────────────────
//
// Public marketing surface, rebuilt against the reference comp.
// Layout (top → bottom): Nav · Hero (dark, dashboard mockup right) ·
// Built-for strip (light, category labels — NOT real customer logos) ·
// Why-operators comparison · What-operators-want product proof ·
// Pricing · Final CTA + Footer (dark).
//
// Truth rules (load-bearing):
//   1. The strip under the hero says "BUILT FOR LEADING SAFARI TEAMS"
//      with category labels. We never imply endorsement we don't have.
//   2. The "What operators want" grid is product-proof copy, not fake
//      reviews. No name + headshot + star-rating fabrications.
//
// CTA flow:
//   primary   → /sign-up  (Clerk handles signup → org task → /dashboard)
//   secondary → /demo     (live demo proposal)

const BG = "#F7F5F0";
const HERO_TOP = "#04130E";
const HERO_BOTTOM = "#0E2A20";
const GREEN = "#2F8F46";
const GREEN_BRIGHT = "#34a04c";
const GOLD = "#E0B85C";
const INK = "#0a1411";
const INK_2 = "rgba(10,20,17,0.72)";
const CARD_BORDER = "rgba(0,0,0,0.08)";

const SERIF = "'Playfair Display', Georgia, serif";
const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

export const metadata = {
  title: "Safari Studio — Close more safaris, faster",
  description:
    "The command center for safari teams. Know when clients are ready to book, follow up at the right moment, and close trips with personalized proposals.",
};

export default function HomePage() {
  return (
    <div
      className="min-h-screen"
      style={{ background: BG, color: INK, fontFamily: SANS }}
    >
      <Nav />
      <Hero />
      <BuiltForStrip />
      <WhyOperators />
      <WhatOperatorsWant />
      <Pricing />
      <FinalCTA />
      <Footer />
    </div>
  );
}

// ─── Nav ─────────────────────────────────────────────────────────────────────

function Nav() {
  return (
    <nav
      className="sticky top-0 z-50 backdrop-blur-md"
      style={{
        background: "rgba(247,245,240,0.85)",
        borderBottom: `1px solid ${CARD_BORDER}`,
      }}
    >
      <div className="max-w-[1200px] mx-auto px-6 md:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center font-bold"
            style={{ background: GREEN, color: "#fff" }}
            aria-hidden
          >
            S
          </div>
          <span
            className="font-semibold text-[15px]"
            style={{ color: INK, letterSpacing: "-0.005em" }}
          >
            Safari Studio
          </span>
        </Link>

        <div
          className="hidden md:flex items-center gap-8 text-[14px]"
          style={{ color: INK_2 }}
        >
          <a href="#product" className="hover:text-[color:var(--ink)] transition">Product</a>
          <a href="#why" className="hover:text-[color:var(--ink)] transition">Why</a>
          <a href="#pricing" className="hover:text-[color:var(--ink)] transition">Pricing</a>
          <Link href="/demo" className="hover:text-[color:var(--ink)] transition">Resources</Link>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="/sign-in"
            className="hidden sm:inline-flex items-center justify-center px-3 h-9 text-[13.5px] font-medium transition"
            style={{ color: INK_2 }}
          >
            Log in
          </a>
          <a
            href="/sign-up"
            className="inline-flex items-center justify-center px-4 h-9 rounded-lg text-[13.5px] font-semibold transition active:scale-[0.97]"
            style={{ background: GREEN, color: "#fff" }}
          >
            Book a demo
          </a>
        </div>
      </div>
    </nav>
  );
}

// ─── Hero ────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section
      className="relative overflow-hidden"
      style={{
        background: `linear-gradient(180deg, ${HERO_TOP} 0%, ${HERO_BOTTOM} 100%)`,
      }}
    >
      {/* faint silhouette wash at the bottom — soft savanna mood */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-40 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 50% 100%, rgba(215,183,91,0.12) 0%, transparent 60%)",
        }}
      />

      <div className="max-w-[1200px] mx-auto px-6 md:px-8 pt-14 md:pt-16 pb-20 md:pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-10 lg:gap-12 items-center">
          {/* Left — copy */}
          <div className="min-w-0">
            <div
              className="inline-flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.22em] px-3 py-1.5 rounded-full"
              style={{
                background: "rgba(47,143,70,0.14)",
                color: "#9CD9A8",
                border: "1px solid rgba(47,143,70,0.32)",
              }}
            >
              <span style={{ color: GOLD }}>★</span>
              Built for safari operators
            </div>

            <h1
              className="mt-5 text-white"
              style={{
                fontFamily: SERIF,
                fontSize: "clamp(48px, 5.4vw, 64px)",
                lineHeight: 1.04,
                letterSpacing: "-0.025em",
                fontWeight: 700,
              }}
            >
              Know when clients are ready to book.{" "}
              <span
                style={{
                  color: GOLD,
                  textShadow: "0 1px 18px rgba(224,184,92,0.28)",
                }}
              >
                Close more safaris,
              </span>{" "}
              faster.
            </h1>

            <p
              className="mt-5 text-[16px] max-w-[520px]"
              style={{
                color: "rgba(255,255,255,0.78)",
                lineHeight: 1.55,
              }}
            >
              Safari Studio shows you who&rsquo;s most engaged with your proposal,
              what they care about, and what to do next, so you can close more
              safaris, faster.
            </p>

            <div className="mt-7 flex items-center gap-3 flex-wrap">
              <a
                href="/sign-up"
                className="inline-flex items-center justify-center px-5 h-12 rounded-lg text-[14.5px] font-bold transition active:scale-[0.97] hover:brightness-110"
                style={{
                  background: `linear-gradient(180deg, ${GREEN_BRIGHT} 0%, ${GREEN} 100%)`,
                  color: "#fff",
                  boxShadow:
                    "0 10px 24px -8px rgba(47,143,70,0.55), inset 0 1px 0 rgba(255,255,255,0.18)",
                }}
              >
                Book a demo →
              </a>
              <Link
                href="/demo"
                className="inline-flex items-center justify-center px-5 h-12 rounded-lg text-[14px] font-semibold transition hover:bg-white/5"
                style={{
                  color: "rgba(255,255,255,0.92)",
                  border: "1px solid rgba(255,255,255,0.16)",
                }}
              >
                See how it works
              </Link>
            </div>

            <div
              className="mt-4 flex items-center gap-4 text-[12px] flex-wrap"
              style={{ color: "rgba(255,255,255,0.5)" }}
            >
              <span className="inline-flex items-center gap-1.5">
                <Bullet />
                No credit card
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Bullet />
                Setup in 10 minutes
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Bullet />
                Cancel anytime
              </span>
            </div>
          </div>

          {/* Right — dashboard mockup card */}
          <DashboardMockup />
        </div>
      </div>
    </section>
  );
}

// Stylised hero-side preview of the dashboard. Mirrors the real
// product layout: greeting strip → 3 separate KPI cards (counts +
// pipeline value) → 2-col content (left: hot deals · followup ·
// bookings; right: activity feed · tasks). Reads as a miniature
// of the actual /dashboard rather than a single-column stack.
function DashboardMockup() {
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
        {/* ── Greeting strip ─────────────────────────────────────── */}
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

        {/* ── KPI row — three separate cards ─────────────────────── */}
        <div className="grid grid-cols-3 gap-2">
          <KpiCard label="Hot deals" value="12" tone="hot" />
          <KpiCard label="Follow-up" value="5" tone="warn" />
          <KpiCard label="Pipeline" value="$124K" tone="ok" gold />
        </div>

        {/* ── 2-col content grid ─────────────────────────────────── */}
        <div className="mt-2 grid grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-2">
          {/* LEFT — Hot deal · Followup · Bookings */}
          <div className="min-w-0 space-y-2">
            {/* "Happening now" micro-label sits above the dominant
                card so the eye lands here first. */}
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
                style={{
                  color: "#fca5a5",
                  letterSpacing: "0.24em",
                }}
              >
                Happening now
              </span>
            </div>

            {/* Hot deal — DOMINANT card. Brighter surface, layered red
                glow halo, stronger border, scaled padding for presence. */}
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
                  style={{
                    background: "linear-gradient(180deg,#ef4444 0%,#dc2626 100%)",
                  }}
                />
                <div className="p-3.5 pl-4">
                  <div className="flex items-center justify-between mb-2">
                    <div
                      className="text-[10.5px] font-bold"
                      style={{ color: "#fff", fontFamily: SERIF }}
                    >
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
              <FollowupMini name="Marcus &amp; Tara Reid" sub="Viewed 2d ago · no reply" />
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
              <BookingPreview
                isNew
                client="Sam &amp; Lily Wong"
                dates="2 Jul → 11 Jul"
              />
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
              {/* Slightly varied gaps so the feed feels live, not gridded. */}
              <div className="space-y-[7px]">
                <ActivityLine
                  glyph="$"
                  tone="amber"
                  label="Marcus viewed pricing"
                  sub="Anderson Family"
                  time="1h"
                  fresh
                />
                <ActivityLine
                  glyph="◉"
                  tone="green"
                  label="Priya tapped Day 4"
                  sub="Honeymoon"
                  time="2h"
                />
                <ActivityLine
                  glyph="✓"
                  tone="success"
                  label="Booking confirmed"
                  sub="Devereux"
                  time="4h"
                />
                <ActivityLine
                  glyph="◇"
                  tone="green"
                  label="Sarah opened proposal"
                  sub="Beach &amp; Bush"
                  time="5h"
                />
              </div>
            </div>

            {/* Today's tasks */}
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

// Tiny green dot used as a microcopy bullet under the hero CTAs.
function Bullet() {
  return (
    <span
      aria-hidden
      className="inline-block w-1.5 h-1.5 rounded-full"
      style={{ background: "#16a34a", boxShadow: "0 0 0 2px rgba(22,163,74,0.18)" }}
    />
  );
}

function KpiCard({
  label,
  value,
  tone,
  gold = false,
}: {
  label: string;
  value: string;
  tone: "hot" | "warn" | "ok";
  /** When true, the value renders gold and a faint gold wash behind
   *  the card lifts it as the "money" KPI (e.g. pipeline value). */
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

// Compact follow-up row for the hero mockup. Two-line — name + meta.
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
          {name.includes("&amp;") ? (
            <span dangerouslySetInnerHTML={{ __html: name }} />
          ) : (
            name
          )}
        </div>
        <div
          className="text-[9.5px] truncate mt-0.5"
          style={{ color: "rgba(255,255,255,0.5)" }}
        >
          {sub}
        </div>
      </div>
    </div>
  );
}

// Compact task row for the hero mockup. Checkbox + label + due chip.
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
        <div
          className="text-[11.5px] truncate text-white"
          style={{ fontWeight: 600 }}
        >
          {label}
        </div>
        <div
          className="text-[10px] truncate"
          style={{ color: "rgba(255,255,255,0.5)" }}
        >
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
      style={{
        background: isNew ? "rgba(22,163,74,0.08)" : "transparent",
      }}
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
          <div
            className="text-[11.5px] truncate text-white"
            style={{ fontWeight: 600 }}
          >
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

// ─── Built-for strip ─────────────────────────────────────────────────────────
//
// Replaces a "trusted by" row. Category-based labels only — never
// implies endorsement from real operators. Visual style stays close
// to the reference (centred caps, tracked spacing) so the section
// reads as social context, not a customer testimonial.

function BuiltForStrip() {
  const categories = [
    "WILDERNESS DMC",
    "RIVER LODGES",
    "OFF-GRID CAMPS",
    "PRIVATE GUIDES",
    "SAFARI BROKERS",
    "BOUTIQUE OPERATORS",
  ];
  return (
    <section
      className="py-16 md:py-20"
      style={{ borderBottom: `1px solid rgba(0,0,0,0.10)` }}
    >
      <div className="max-w-[1200px] mx-auto px-6 md:px-8 text-center">
        <div
          className="text-[12px] font-bold uppercase"
          style={{
            color: INK,
            opacity: 0.86,
            letterSpacing: "0.40em",
          }}
        >
          Built for leading safari teams
        </div>
        <p
          className="mt-3 text-[15px]"
          style={{ color: INK_2 }}
        >
          Inspired by how high-performing safari operators sell, plan, follow up, and close trips.
        </p>

        <div className="mt-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-10 gap-y-6 items-center">
          {categories.map((label) => (
            <div
              key={label}
              className="text-[12.5px] font-bold text-center whitespace-nowrap transition-colors duration-150"
              style={{
                color: INK,
                fontFamily: SANS,
                letterSpacing: "0.34em",
                opacity: 0.82,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = GREEN;
                e.currentTarget.style.opacity = "1";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = INK;
                e.currentTarget.style.opacity = "0.82";
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Why operators choose Safari Studio (comparison) ─────────────────────────

function WhyOperators() {
  const pains = [
    "Spreadsheets and email threads scattered across the team",
    "No idea who's hot vs. who's gone quiet",
    "Hours rebuilding the same proposal layout",
    "Reservations slipping through without follow-up",
    "Generic templates that don't reflect your brand",
  ];
  const gains = [
    "One command center — every deal in one place",
    "Engagement scoring tells you who's ready to book",
    "Brand-locked templates render in seconds",
    "Reservations route to the right consultant automatically",
    "AI helps you write proposals that sound like you",
  ];

  return (
    <section
      id="why"
      className="py-16 md:py-20"
      style={{ background: BG }}
    >
      <div className="max-w-[1200px] mx-auto px-6 md:px-8">
        <div className="max-w-[640px]">
          <h2
            style={{
              fontFamily: SERIF,
              fontSize: "clamp(28px, 3.6vw, 36px)",
              lineHeight: 1.1,
              letterSpacing: "-0.018em",
              fontWeight: 600,
              color: INK,
            }}
          >
            Why operators switch{" "}
            <span style={{ color: GREEN }}>to Safari Studio</span>.
          </h2>
          <p
            className="mt-3 text-[16px] leading-[1.6] max-w-[520px]"
            style={{ color: INK_2 }}
          >
            We replaced the spreadsheet patchwork with a single command center
            built around how safari teams actually sell.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Pains card — darker beige/gray, more "before-state" feel.
              Subtle X marks (single stroke, no playful badge). */}
          <div
            className="rounded-2xl p-6"
            style={{
              background: "#E5E1D6",
              border: `1px solid rgba(0,0,0,0.12)`,
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5)",
            }}
          >
            <div
              className="text-[10.5px] uppercase tracking-[0.26em] font-bold mb-5"
              style={{ color: "rgba(10,20,17,0.50)" }}
            >
              Without Safari Studio
            </div>
            <ul className="space-y-3">
              {pains.map((p) => (
                <li key={p} className="flex items-start gap-3">
                  <svg
                    aria-hidden
                    className="mt-1 shrink-0"
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="none"
                    stroke="rgba(10,20,17,0.45)"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  >
                    <path d="M3.5 3.5 L10.5 10.5 M10.5 3.5 L3.5 10.5" />
                  </svg>
                  <span
                    className="text-[14.5px] leading-[1.5]"
                    style={{ color: "rgba(10,20,17,0.72)" }}
                  >
                    {p}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Gains card — green */}
          {/* Solution card — more vibrant green, layered glow, gold
              checks. Visibly outranks the "before" card so the "after"
              reads as the obvious winner. */}
          <div
            className="rounded-2xl p-6 relative overflow-hidden"
            style={{
              background: `linear-gradient(135deg, #1d6a35 0%, #34a04c 60%, #3eb957 100%)`,
              boxShadow:
                "0 1px 2px rgba(0,0,0,0.10), 0 14px 32px -10px rgba(47,143,70,0.70), inset 0 1px 0 rgba(255,255,255,0.18)",
              color: "#fff",
            }}
          >
            <div
              aria-hidden
              className="absolute -right-10 -top-10 w-[60%] h-[80%] pointer-events-none"
              style={{
                background:
                  "radial-gradient(ellipse at 50% 50%, rgba(224,184,92,0.26) 0%, transparent 65%)",
              }}
            />
            <div
              className="text-[10.5px] uppercase tracking-[0.26em] font-bold mb-5 relative"
              style={{ color: GOLD, textShadow: "0 1px 8px rgba(224,184,92,0.32)" }}
            >
              With Safari Studio
            </div>
            <ul className="space-y-3 relative">
              {gains.map((g) => (
                <li key={g} className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className="mt-0.5 w-[20px] h-[20px] rounded-full flex items-center justify-center shrink-0"
                    style={{
                      background: `linear-gradient(135deg, #f3cf75 0%, ${GOLD} 100%)`,
                      color: "#0a1411",
                      boxShadow:
                        "0 2px 6px -2px rgba(224,184,92,0.6), inset 0 1px 0 rgba(255,255,255,0.4)",
                    }}
                  >
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 5.5 L4.5 8 L9 3" />
                    </svg>
                  </span>
                  <span className="text-[14.5px] leading-[1.5]" style={{ color: "rgba(255,255,255,0.98)" }}>
                    {g}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── What operators want (product-proof, not testimonials) ───────────────────
//
// Replaces the testimonial grid in the reference. Same visual layout
// (4 cards across) — but the copy is product-proof framed as operator
// needs, with no fabricated names / star ratings / quotes.

function WhatOperatorsWant() {
  const items = [
    {
      eyebrow: "Visibility",
      title: "Know who’s ready to book.",
      body:
        "Engagement scoring shows the deals that need attention right now — viewed pricing, lingered on the itinerary, started the booking form.",
    },
    {
      eyebrow: "Speed",
      title: "Send proposals that close.",
      body:
        "Brand-locked templates render in seconds. AI helps you write personal notes that sound like you, not a marketing team.",
    },
    {
      eyebrow: "Pipeline",
      title: "Track every booking end-to-end.",
      body:
        "Reservations route to the assigned consultant, copy the owner, and land in the dashboard the moment a guest submits.",
    },
    {
      eyebrow: "Follow-up",
      title: "Never let a hot deal go cold.",
      body:
        "Quiet for 48h+? It surfaces in the follow-up rail with a one-tap nudge. The team always knows what to do next.",
    },
  ];

  return (
    <section id="product" className="py-16 md:py-20" style={{ background: "#fff", borderTop: `1px solid ${CARD_BORDER}`, borderBottom: `1px solid ${CARD_BORDER}` }}>
      <div className="max-w-[1200px] mx-auto px-6 md:px-8">
        <div className="text-center max-w-[680px] mx-auto">
          <div
            className="text-[10.5px] font-semibold uppercase tracking-[0.28em]"
            style={{ color: GREEN }}
          >
            What operators want
          </div>
          <h2
            className="mt-3"
            style={{
              fontFamily: SERIF,
              fontSize: "clamp(28px, 3.6vw, 36px)",
              lineHeight: 1.1,
              letterSpacing: "-0.018em",
              fontWeight: 600,
              color: INK,
            }}
          >
            The four answers a safari team needs every morning.
          </h2>
          <p
            className="mt-3 text-[16px] leading-[1.6]"
            style={{ color: INK_2 }}
          >
            Safari Studio is built around the questions that actually move
            trips toward booked.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
          {items.map((it, i) => {
            // Break uniformity: first card highlighted with a green
            // ring + inset, third card pushed down by 12px so the row
            // reads as curated, not perfectly gridded.
            const isLead = i === 0;
            const offset = i === 2 ? "lg:translate-y-3" : "";
            return (
              <article
                key={it.title}
                className={`rounded-2xl p-5 transition-all duration-150 ease-out hover:-translate-y-0.5 ${offset}`}
                style={{
                  background: isLead
                    ? `linear-gradient(180deg, #ffffff 0%, ${BG} 100%)`
                    : `linear-gradient(180deg, ${BG} 0%, #f0ece1 100%)`,
                  border: isLead
                    ? `1px solid rgba(47,143,70,0.32)`
                    : `1px solid rgba(0,0,0,0.10)`,
                  boxShadow: isLead
                    ? "0 1px 2px rgba(0,0,0,0.04), 0 12px 24px -10px rgba(47,143,70,0.20), inset 0 0 0 1px rgba(47,143,70,0.10)"
                    : "0 1px 2px rgba(0,0,0,0.04), 0 6px 14px -6px rgba(0,0,0,0.08)",
                }}
              >
                <div
                  className="text-[9.5px] uppercase font-bold"
                  style={{
                    color: GREEN,
                    letterSpacing: "0.28em",
                  }}
                >
                  {it.eyebrow}
                </div>
                <h3
                  className="mt-3 text-[20px] leading-[1.18]"
                  style={{
                    fontFamily: SERIF,
                    color: INK,
                    fontWeight: 700,
                    letterSpacing: "-0.014em",
                  }}
                >
                  {it.title}
                </h3>
                <p
                  className="mt-2 text-[13.5px] leading-[1.55]"
                  style={{ color: "rgba(10,20,17,0.62)" }}
                >
                  {it.body}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── Pricing ─────────────────────────────────────────────────────────────────

function Pricing() {
  return (
    <section
      id="pricing"
      className="py-16 md:py-20 relative overflow-hidden"
      style={{
        background: `linear-gradient(180deg, ${HERO_BOTTOM} 0%, ${HERO_TOP} 100%)`,
        color: "#fff",
      }}
    >
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-[0.05]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, ${GOLD} 1px, transparent 0)`,
          backgroundSize: "32px 32px",
        }}
      />

      <div className="max-w-[1200px] mx-auto px-6 md:px-8 relative">
        <div className="text-center max-w-[640px] mx-auto">
          <h2
            style={{
              fontFamily: SERIF,
              fontSize: "clamp(28px, 3.6vw, 36px)",
              lineHeight: 1.08,
              letterSpacing: "-0.022em",
              fontWeight: 700,
            }}
          >
            <span style={{ color: "rgba(255,255,255,0.78)" }}>Simple pricing.</span>{" "}
            <span
              style={{
                color: GOLD,
                textShadow: "0 1px 14px rgba(224,184,92,0.32)",
              }}
            >
              Powerful results.
            </span>
          </h2>
          <p
            className="mt-3 text-[16px] leading-[1.55]"
            style={{ color: "rgba(255,255,255,0.7)" }}
          >
            Close one safari and Safari Studio pays for itself for the year.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-5 items-center">
          <PriceCard
            name="Starter"
            price="$59"
            cadence="/ month"
            tagline="For solo consultants and small teams."
            features={[
              "Up to 30 proposals / month",
              "Engagement scoring + dashboard",
              "Branded share view",
              "Email notifications on bookings",
            ]}
            ctaLabel="Start free trial"
            ctaHref="/sign-up"
          />
          <PriceCard
            name="Pro"
            price="$149"
            cadence="/ month"
            tagline="For growing operators ready to scale."
            features={[
              "Unlimited proposals + reservations",
              "Team supervision + role permissions",
              "AI Write + Brand DNA",
              "Activity feed + follow-up automation",
              "Priority email support",
            ]}
            ctaLabel="Start free trial"
            ctaHref="/sign-up"
            featured
          />
          <PriceCard
            name="Enterprise"
            price="Custom"
            cadence=""
            tagline="For multi-brand DMCs and enterprises."
            features={[
              "Everything in Pro",
              "Dedicated success manager",
              "SSO + custom roles",
              "Bespoke integrations (GHL, Salesforce, etc.)",
              "SLA-backed uptime",
            ]}
            ctaLabel="Talk to us"
            ctaHref="/sign-up"
          />
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/pricing"
            className="text-[13px] font-semibold underline-offset-4 hover:underline"
            style={{ color: GOLD }}
          >
            See full pricing details →
          </Link>
        </div>
      </div>
    </section>
  );
}

function PriceCard({
  name,
  price,
  cadence,
  tagline,
  features,
  ctaLabel,
  ctaHref,
  featured = false,
}: {
  name: string;
  price: string;
  cadence: string;
  tagline: string;
  features: string[];
  ctaLabel: string;
  ctaHref: string;
  featured?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl relative transition-transform duration-200 ${
        featured ? "p-7 md:scale-[1.04] md:z-[1]" : "p-6"
      }`}
      style={{
        background: featured
          ? "linear-gradient(180deg, rgba(224,184,92,0.18) 0%, rgba(255,255,255,0.04) 100%)"
          : "rgba(255,255,255,0.03)",
        border: featured
          ? `1px solid rgba(224,184,92,0.65)`
          : `1px solid rgba(255,255,255,0.12)`,
        boxShadow: featured
          ? "0 1px 2px rgba(0,0,0,0.10), 0 18px 40px -12px rgba(224,184,92,0.45), inset 0 1px 0 rgba(255,255,255,0.10)"
          : "none",
      }}
    >
      {featured && (
        <div
          className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-[0.26em] font-bold px-3 py-1 rounded-full"
          style={{
            background: `linear-gradient(180deg, #f0cb74 0%, ${GOLD} 100%)`,
            color: HERO_TOP,
            boxShadow:
              "0 6px 14px -4px rgba(224,184,92,0.55), inset 0 1px 0 rgba(255,255,255,0.45)",
          }}
        >
          Most popular
        </div>
      )}

      <div
        className="text-[11.5px] uppercase tracking-[0.26em] font-bold"
        style={{ color: featured ? GOLD : "rgba(255,255,255,0.55)" }}
      >
        {name}
      </div>
      <div className="mt-2.5 flex items-baseline gap-1">
        <span
          className="text-white"
          style={{
            fontFamily: SERIF,
            fontSize: featured ? 48 : 42,
            fontWeight: 700,
            letterSpacing: "-0.028em",
            lineHeight: 1,
          }}
        >
          {price}
        </span>
        {cadence && (
          <span
            className="text-[12.5px]"
            style={{ color: "rgba(255,255,255,0.5)" }}
          >
            {cadence}
          </span>
        )}
      </div>
      <p
        className="mt-2 text-[13px] leading-[1.5]"
        style={{ color: "rgba(255,255,255,0.68)" }}
      >
        {tagline}
      </p>

      <a
        href={ctaHref}
        className="mt-6 inline-flex w-full items-center justify-center px-4 rounded-lg text-[14.5px] font-bold transition-all duration-150 active:scale-[0.97] hover:brightness-110 hover:scale-[1.02]"
        style={
          featured
            ? {
                background: `linear-gradient(180deg, #f0cb74 0%, ${GOLD} 100%)`,
                color: HERO_TOP,
                height: 52,
                boxShadow:
                  "0 10px 22px -6px rgba(224,184,92,0.65), inset 0 1px 0 rgba(255,255,255,0.45)",
              }
            : {
                background: `linear-gradient(180deg, ${GREEN_BRIGHT} 0%, ${GREEN} 100%)`,
                color: "#fff",
                height: 48,
                boxShadow:
                  "0 8px 18px -6px rgba(47,143,70,0.55), inset 0 1px 0 rgba(255,255,255,0.16)",
              }
        }
      >
        {ctaLabel}
      </a>

      <ul className="mt-6 space-y-3">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-3 text-[13.5px]">
            <span
              aria-hidden
              className="mt-0.5 w-[18px] h-[18px] rounded-full flex items-center justify-center shrink-0"
              style={{
                background: featured ? GOLD : GREEN,
                color: featured ? HERO_TOP : "#fff",
                boxShadow: featured
                  ? "0 2px 6px -2px rgba(224,184,92,0.5)"
                  : "0 2px 6px -2px rgba(47,143,70,0.4)",
              }}
            >
              <svg
                width="11"
                height="11"
                viewBox="0 0 11 11"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M2 5.5 L4.5 8 L9 3" />
              </svg>
            </span>
            <span style={{ color: "rgba(255,255,255,0.88)" }}>{f}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Final CTA ───────────────────────────────────────────────────────────────

function FinalCTA() {
  return (
    <section
      className="py-20 md:py-28"
      style={{ background: HERO_TOP, color: "#fff" }}
    >
      <div className="max-w-[1200px] mx-auto px-6 md:px-8 text-center relative">
        {/* Subtle green halo behind the primary button */}
        <div
          aria-hidden
          className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
          style={{
            bottom: 32,
            width: 320,
            height: 80,
            background:
              "radial-gradient(ellipse at 50% 50%, rgba(47,143,70,0.32) 0%, transparent 70%)",
            filter: "blur(8px)",
          }}
        />
        <h2
          className="relative"
          style={{
            fontFamily: SERIF,
            fontSize: "clamp(38px, 4.8vw, 52px)",
            lineHeight: 1.04,
            letterSpacing: "-0.025em",
            fontWeight: 700,
          }}
        >
          Ready to close more safaris?
        </h2>
        <p
          className="mt-4 text-[16px] leading-[1.5] max-w-[440px] mx-auto relative"
          style={{ color: "rgba(255,255,255,0.72)" }}
        >
          Bring your brand, send your first proposal, see who&rsquo;s ready to book.
        </p>
        <div className="mt-10 flex items-center gap-3 justify-center flex-wrap relative">
          <a
            href="/sign-up"
            className="inline-flex items-center justify-center px-7 h-[52px] rounded-lg text-[15px] font-bold transition active:scale-[0.97] hover:brightness-110 hover:scale-[1.02]"
            style={{
              background: `linear-gradient(180deg, ${GREEN_BRIGHT} 0%, ${GREEN} 100%)`,
              color: "#fff",
              boxShadow:
                "0 14px 32px -10px rgba(47,143,70,0.75), inset 0 1px 0 rgba(255,255,255,0.18)",
            }}
          >
            Book a demo →
          </a>
          <Link
            href="/demo"
            className="inline-flex items-center justify-center px-5 h-[52px] rounded-lg text-[14px] font-semibold transition hover:bg-white/5"
            style={{
              color: "rgba(255,255,255,0.85)",
              border: "1px solid rgba(255,255,255,0.16)",
            }}
          >
            See how it works
          </Link>
        </div>
        <div
          className="mt-6 inline-flex items-center gap-2 text-[12.5px] relative"
          style={{ color: "rgba(255,255,255,0.78)" }}
        >
          <span
            aria-hidden
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{ background: "#22c55e", boxShadow: "0 0 0 3px rgba(34,197,94,0.32)" }}
          />
          <span style={{ fontWeight: 600 }}>Start in 60 seconds</span>
          <span style={{ color: "rgba(255,255,255,0.4)" }}>·</span>
          <span>No setup required</span>
        </div>
      </div>
    </section>
  );
}

// ─── Footer ──────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer
      className="py-12"
      style={{
        background: HERO_TOP,
        color: "rgba(255,255,255,0.55)",
        borderTop: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="max-w-[1200px] mx-auto px-6 md:px-8 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center font-bold text-[13px]"
            style={{ background: GREEN, color: "#fff" }}
            aria-hidden
          >
            S
          </div>
          <span className="text-white font-medium text-[14px]">Safari Studio</span>
          <span className="text-[13px] ml-2">· Nairobi</span>
        </div>

        <div className="flex items-center gap-6 text-[13px]">
          <Link href="/demo" className="hover:text-white transition">Live demo</Link>
          <Link href="/pricing" className="hover:text-white transition">Pricing</Link>
          <a href="/sign-up" className="hover:text-white transition">Open Studio</a>
        </div>

        <div className="text-[12px]">
          &copy; {new Date().getFullYear()} Safari Studio
        </div>
      </div>
    </footer>
  );
}
