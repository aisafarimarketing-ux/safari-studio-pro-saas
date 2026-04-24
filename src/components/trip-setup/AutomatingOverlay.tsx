"use client";

import { useEffect, useRef, useState } from "react";

// Full-screen overlay shown while the Trip Setup autopilot is drafting.
//
// Real drafting takes 8-25 seconds depending on AI latency and we don't
// get progress events back — so the progress bar is *simulated* but in a
// way that feels honest: it accelerates quickly early, decelerates as it
// approaches 95%, and holds at 95% until the parent signals completion
// (by flipping `active` to false). At that point we rush to 100% over
// ~300ms, hold briefly, then fade out.
//
// The visible labels advance in lockstep with the progress so the guest
// sees different phases: "Understanding guests", "Picking camps from
// your library", "Drafting each day", "Composing pricing", "Finalising".

type Phase = "running" | "completing" | "fadeOut" | "hidden";

const STEPS: { at: number; label: string }[] = [
  { at: 0, label: "Understanding your guests" },
  { at: 18, label: "Picking camps from your library" },
  { at: 40, label: "Drafting each day" },
  { at: 65, label: "Composing pricing" },
  { at: 82, label: "Finalising the signature" },
];

export function AutomatingOverlay({
  active,
  onCancel,
}: {
  active: boolean;
  // When provided, renders a Cancel button that aborts the in-flight
  // autopilot and returns control to the Trip Setup form. Without this
  // the overlay is uninterruptible — which locks the user in for 15-30s
  // with no recourse if they realise they got an input wrong.
  onCancel?: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("hidden");
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | null>(null);
  const wasActiveRef = useRef(false);

  // Kick the animation when `active` flips true; chase 100% when it flips
  // back to false (real API done).
  useEffect(() => {
    if (active) {
      wasActiveRef.current = true;
      setPhase("running");
      setProgress(0);
      return;
    }
    if (wasActiveRef.current) {
      // parent says drafting finished — rush to 100 and fade out.
      setPhase("completing");
    }
  }, [active]);

  // Animation loop — runs while mounted.
  useEffect(() => {
    if (phase === "hidden") return;

    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      setProgress((p) => {
        if (phase === "running") {
          // Approach 95% with decaying step so the bar feels deliberate.
          const target = 95;
          const step = Math.max(0.08, (target - p) * 0.012);
          return Math.min(target, +(p + step).toFixed(2));
        }
        if (phase === "completing") {
          // Rush to 100 over ~300ms.
          const step = Math.max(0.4, (100 - p) * 0.18);
          const next = Math.min(100, +(p + step).toFixed(2));
          return next;
        }
        return p;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [phase]);

  // Once we hit 100, hold briefly, then fade out, then unmount.
  useEffect(() => {
    if (phase === "completing" && progress >= 99.9) {
      const t1 = setTimeout(() => setPhase("fadeOut"), 350);
      return () => clearTimeout(t1);
    }
    if (phase === "fadeOut") {
      const t2 = setTimeout(() => setPhase("hidden"), 400);
      return () => clearTimeout(t2);
    }
  }, [phase, progress]);

  if (phase === "hidden") return null;

  const activeStep = STEPS.reduce((acc, s) => (progress >= s.at ? s.label : acc), STEPS[0].label);

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center transition-opacity duration-[400ms]"
      style={{
        background: "rgba(17, 18, 17, 0.94)",
        opacity: phase === "fadeOut" ? 0 : 1,
      }}
      aria-live="polite"
      aria-busy={phase !== "fadeOut"}
    >
      <div className="max-w-md w-full mx-auto px-8 text-center">
        {/* Pulsing glyph */}
        <div
          aria-hidden
          className="mx-auto mb-10 w-12 h-12 rounded-full flex items-center justify-center"
          style={{
            background: "rgba(201,168,76,0.12)",
            border: "1px solid rgba(201,168,76,0.35)",
            animation: "ss-automating-pulse 2.2s ease-in-out infinite",
          }}
        >
          <span className="text-[#c9a84c] text-lg">✦</span>
        </div>

        <div
          className="text-[10.5px] uppercase tracking-[0.32em] font-bold mb-4"
          style={{ color: "rgba(255,255,255,0.55)" }}
        >
          Automating your proposal
        </div>
        <div
          className="text-[22px] md:text-[26px] font-semibold leading-[1.15] mb-10"
          style={{
            color: "rgba(255,255,255,0.94)",
            fontFamily: "'Playfair Display', Georgia, serif",
          }}
        >
          {activeStep}
          <span
            className="inline-block ml-1 w-[0.4em] align-baseline"
            style={{ opacity: 0.75 }}
          >
            …
          </span>
        </div>

        {/* Progress bar */}
        <div
          className="relative w-full rounded-full overflow-hidden"
          style={{ height: 4, background: "rgba(255,255,255,0.1)" }}
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              width: `${progress}%`,
              background:
                "linear-gradient(90deg, rgba(201,168,76,0.9) 0%, rgba(201,168,76,1) 60%, rgba(255,255,255,0.9) 100%)",
              transition: "width 180ms linear",
              boxShadow: "0 0 12px rgba(201,168,76,0.5)",
            }}
          />
        </div>

        {/* Percentage */}
        <div
          className="mt-4 flex items-center justify-between text-[11.5px] tabular-nums uppercase tracking-[0.28em]"
          style={{ color: "rgba(255,255,255,0.55)" }}
        >
          <span>In progress</span>
          <span style={{ color: "rgba(255,255,255,0.85)" }}>{Math.floor(progress)}%</span>
        </div>

        <div
          className="mt-10 text-[12px]"
          style={{ color: "rgba(255,255,255,0.4)" }}
        >
          Usually takes 10–20 seconds. Brand DNA + library camps are
          informing every paragraph.
        </div>

        {/* Cancel — only rendered while the overlay is in "running" phase
            so the user can't accidentally cancel the 300ms rush-to-100%
            finalisation (which is cosmetic and shouldn't be interrupted). */}
        {onCancel && phase === "running" && (
          <div className="mt-8">
            <button
              type="button"
              onClick={onCancel}
              className="text-[12.5px] font-medium transition hover:text-white"
              style={{ color: "rgba(255,255,255,0.45)" }}
            >
              Cancel and go back to the form
            </button>
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes ss-automating-pulse {
          0%, 100% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(201, 168, 76, 0.35);
          }
          50% {
            transform: scale(1.08);
            box-shadow: 0 0 0 14px rgba(201, 168, 76, 0);
          }
        }
      `}</style>
    </div>
  );
}
