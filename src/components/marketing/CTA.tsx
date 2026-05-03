/* eslint-disable @next/next/no-html-link-for-pages */
import Link from "next/link";
import { GREEN, GREEN_BRIGHT, HERO_TOP, SERIF } from "./tokens";

// Final CTA. "Stop guessing. Start closing." in 52px serif on the
// dark hero gradient, with a soft green halo behind the primary
// button so the close-of-page moment feels decisive.

export function CTA() {
  return (
    <section
      className="py-20 md:py-28"
      style={{ background: HERO_TOP, color: "#fff" }}
    >
      <div className="max-w-[1200px] mx-auto px-6 md:px-8 text-center relative">
        {/* Soft green halo behind the primary button */}
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
          Stop guessing. Start closing.
        </h2>
        <p
          className="mt-4 text-[16px] leading-[1.5] max-w-[480px] mx-auto relative"
          style={{ color: "rgba(255,255,255,0.72)" }}
        >
          Bring your brand, send your first proposal, and see who&rsquo;s ready
          to book.
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
            style={{
              background: "#22c55e",
              boxShadow: "0 0 0 3px rgba(34,197,94,0.32)",
            }}
          />
          <span style={{ fontWeight: 600 }}>Start in 60 seconds</span>
          <span style={{ color: "rgba(255,255,255,0.4)" }}>·</span>
          <span>No setup required</span>
        </div>
      </div>
    </section>
  );
}
