/* eslint-disable @next/next/no-html-link-for-pages */
import Link from "next/link";
import { DashboardMockup } from "./DashboardMockup";
import { GOLD, GREEN, GREEN_BRIGHT, HERO_BOTTOM, HERO_TOP, SERIF } from "./tokens";

// Dark-gradient hero. Two columns on lg+ — copy left, dashboard mock
// right. The copy column carries: green eyebrow pill → 64px serif
// headline (gold highlight on the action verb) → 16px subtext →
// primary green CTA + outline secondary → 3-bullet microcopy strip.
//
// The headline gold span has a soft text-shadow so the highlight
// reads as a brushed accent, not flat fill — matches the calm,
// expensive feel of the rest of the page.

export function Hero() {
  return (
    <section
      className="relative overflow-hidden"
      style={{
        background: `linear-gradient(180deg, ${HERO_TOP} 0%, ${HERO_BOTTOM} 100%)`,
      }}
    >
      {/* Faint amber wash at the bottom — soft savanna mood. */}
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
              className="mt-5 text-[16px] max-w-[540px]"
              style={{ color: "rgba(255,255,255,0.78)", lineHeight: 1.55 }}
            >
              Safari Studio shows you what your clients are doing — viewing
              pricing, exploring itineraries, starting bookings — and tells you
              what to do next.
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
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              <span className="inline-flex items-center gap-1.5">
                <Bullet />
                Start in 60 seconds
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Bullet />
                No setup required
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Bullet />
                Cancel anytime
              </span>
            </div>
          </div>

          <DashboardMockup />
        </div>
      </div>
    </section>
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
