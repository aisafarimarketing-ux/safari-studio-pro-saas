import { BG, GOLD, GREEN, INK, INK_2, SERIF } from "./tokens";

// Two-column comparison: pain vs. solution. Pain card sits in a
// muted beige with line-stroke X marks (no playful badges); solution
// card runs a vibrant green gradient with gold-gradient check pills
// so the "after" reads as the obvious winner at a glance.

const PAINS = [
  "You don't know when clients are ready to book",
  "Proposals go quiet — you can't tell why",
  "Manual follow-ups eat the morning",
  "Rebuilding itineraries from scratch every time",
  "Scattered tools, no single source of truth",
];

const GAINS = [
  "See booking intent in real time",
  "Clear next actions on every active deal",
  "Instant branded proposals — your look, every time",
  "Smart routing puts each booking in the right inbox",
  "Close more deals with less back-and-forth",
];

export function Comparison() {
  return (
    <section id="why" className="py-16 md:py-20" style={{ background: BG }}>
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
          {/* Pains card */}
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
              {PAINS.map((p) => (
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

          {/* Solution card — vibrant green, gold halo, premium check pills */}
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
              {GAINS.map((g) => (
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
                  <span
                    className="text-[14.5px] leading-[1.5]"
                    style={{ color: "rgba(255,255,255,0.98)" }}
                  >
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
