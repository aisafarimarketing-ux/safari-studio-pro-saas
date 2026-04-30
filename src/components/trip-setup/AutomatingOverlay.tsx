"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { EtherealShadows } from "./EtherealShadows";
import type { StreamedDayProgress } from "@/lib/sseClient";

// ─── AutomatingOverlay ───────────────────────────────────────────────────
//
// Full-screen overlay shown while the Trip Setup autopilot is drafting.
//
// Two render modes:
//   1. STREAMED — when `streamedDays` is non-empty, the overlay shows
//      day cards materialising one by one as the AI writes them.
//      Background: animated Etheral Shadows for ambient atmosphere.
//      No progress bar — the day cards ARE the progress.
//   2. INDETERMINATE — when streaming isn't available (or before the
//      first day arrives), shows a simulated progress bar with phase
//      labels so the operator sees motion.
//
// Real drafting takes 15-45 seconds depending on AI latency. The
// overlay holds until the parent flips `active` to false (drafting
// done), then rushes to 100% and fades out.
//
// Cancellation: the optional `onCancel` button aborts the in-flight
// autopilot and returns control to the form. Server-side, that aborts
// the upstream Anthropic call so we stop paying for tokens we'll
// never use.

type Phase = "running" | "completing" | "fadeOut" | "hidden";

const PHASE_LABELS: { at: number; label: string }[] = [
  { at: 0, label: "Understanding your guests" },
  { at: 18, label: "Picking camps from your library" },
  { at: 40, label: "Drafting each day" },
  { at: 65, label: "Composing the close" },
  { at: 82, label: "Finalising the signature" },
];

export function AutomatingOverlay({
  active,
  onCancel,
  streamedDays = [],
}: {
  active: boolean;
  onCancel?: () => void;
  // Live per-day progress emitted by the streaming autopilot route.
  // Empty array = streaming isn't running yet (or not in use); the
  // overlay falls back to the indeterminate progress-bar rendering.
  streamedDays?: StreamedDayProgress[];
}) {
  const [phase, setPhase] = useState<Phase>("hidden");
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | null>(null);
  const wasActiveRef = useRef(false);

  // Kick the animation when `active` flips true; chase 100% when it
  // flips back to false (real API done). Both transitions are
  // scheduled on rAF so the lint rule against setState-in-effect is
  // satisfied — useEffect synchronises with React, the actual state
  // change runs in the next animation frame.
  useEffect(() => {
    if (active) {
      wasActiveRef.current = true;
      const id = requestAnimationFrame(() => {
        setPhase("running");
        setProgress(0);
      });
      return () => cancelAnimationFrame(id);
    }
    if (wasActiveRef.current) {
      const id = requestAnimationFrame(() => setPhase("completing"));
      return () => cancelAnimationFrame(id);
    }
  }, [active]);

  // Animation tick — runs while mounted.
  useEffect(() => {
    if (phase === "hidden") return;

    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      setProgress((p) => {
        if (phase === "running") {
          const target = 95;
          const step = Math.max(0.08, (target - p) * 0.012);
          return Math.min(target, +(p + step).toFixed(2));
        }
        if (phase === "completing") {
          const step = Math.max(0.4, (100 - p) * 0.18);
          return Math.min(100, +(p + step).toFixed(2));
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

  const activeStep = PHASE_LABELS.reduce(
    (acc, s) => (progress >= s.at ? s.label : acc),
    PHASE_LABELS[0].label,
  );

  const hasStream = streamedDays.length > 0;

  return (
    <div
      className="fixed inset-0 z-[120] transition-opacity duration-[400ms]"
      style={{
        background: "#0c1814",
        opacity: phase === "fadeOut" ? 0 : 1,
      }}
      aria-live="polite"
      aria-busy={phase !== "fadeOut"}
    >
      {/* Etheral Shadows — animated atmospheric backdrop. Sits behind
          everything. Tinted to brand teal + gold at low opacity so the
          foreground text reads. */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <EtherealShadows
          color="rgba(31, 58, 58, 0.55)"
          animation={{ scale: 65, speed: 35 }}
        />
      </div>
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <EtherealShadows
          color="rgba(201, 168, 76, 0.18)"
          animation={{ scale: 45, speed: 60 }}
        />
      </div>

      {/* Foreground content */}
      <div className="relative h-full w-full flex flex-col items-center justify-center px-6 py-10 overflow-hidden">
        <div
          aria-hidden
          className="mb-6 w-12 h-12 rounded-full flex items-center justify-center"
          style={{
            background: "rgba(201,168,76,0.14)",
            border: "1px solid rgba(201,168,76,0.4)",
            animation: "ss-automating-pulse 2.2s ease-in-out infinite",
          }}
        >
          <span className="text-[#c9a84c] text-lg">✦</span>
        </div>

        <div
          className="text-[10.5px] uppercase tracking-[0.32em] font-bold mb-3"
          style={{ color: "rgba(255,255,255,0.55)" }}
        >
          Drafting your proposal
        </div>
        <div
          className="text-[22px] md:text-[28px] font-semibold leading-[1.15] mb-8 text-center max-w-xl"
          style={{
            color: "rgba(255,255,255,0.94)",
            fontFamily: "'Playfair Display', Georgia, serif",
          }}
        >
          {hasStream
            ? `${streamedDays.length} day${streamedDays.length === 1 ? "" : "s"} written`
            : activeStep}
          {!hasStream && (
            <span className="inline-block ml-1 w-[0.4em] align-baseline" style={{ opacity: 0.75 }}>
              …
            </span>
          )}
        </div>

        {/* Streamed day cards — only render when streaming is in
            flight. Each card slides up and fades in as it arrives. */}
        {hasStream ? (
          <div className="w-full max-w-md max-h-[55vh] overflow-y-auto space-y-2 pr-1">
            <AnimatePresence initial={false}>
              {streamedDays.map((d) => (
                <motion.div
                  key={d.dayNumber}
                  initial={{ opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.32, ease: "easeOut" }}
                  className="rounded-xl border px-3.5 py-2.5"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    borderColor: "rgba(201,168,76,0.25)",
                    backdropFilter: "blur(6px)",
                  }}
                >
                  <div className="flex items-baseline gap-2">
                    <span
                      className="text-[10px] uppercase tracking-[0.24em] font-bold tabular-nums shrink-0"
                      style={{ color: "rgba(201,168,76,0.85)" }}
                    >
                      Day {d.dayNumber}
                    </span>
                    <span
                      className="text-[15px] font-semibold truncate"
                      style={{ color: "rgba(255,255,255,0.95)" }}
                    >
                      {d.destination || "—"}
                    </span>
                    {d.country && (
                      <span
                        className="text-[10.5px] ml-auto shrink-0"
                        style={{ color: "rgba(255,255,255,0.45)" }}
                      >
                        {d.country}
                      </span>
                    )}
                  </div>
                  {d.description && (
                    <div
                      className="text-[12px] leading-snug mt-1 line-clamp-2"
                      style={{ color: "rgba(255,255,255,0.65)" }}
                    >
                      {d.description.replace(/\*\*/g, "")}
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <>
            {/* Indeterminate progress bar — fallback for non-streaming
                callers (in-editor regenerate, sample import, etc.). */}
            <div
              className="relative w-full max-w-md rounded-full overflow-hidden"
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
            <div
              className="mt-3 flex items-center justify-between w-full max-w-md text-[11.5px] tabular-nums uppercase tracking-[0.28em]"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              <span>In progress</span>
              <span style={{ color: "rgba(255,255,255,0.85)" }}>{Math.floor(progress)}%</span>
            </div>
          </>
        )}

        <div
          className="mt-8 text-[12px] text-center max-w-md"
          style={{ color: "rgba(255,255,255,0.42)" }}
        >
          {hasStream
            ? "Watching your AI write each day in real time. Hit Cancel to stop and edit your inputs."
            : "Usually 15–45 seconds. Brand DNA + library camps inform every paragraph."}
        </div>

        {onCancel && phase === "running" && (
          <div className="mt-6">
            <button
              type="button"
              onClick={onCancel}
              className="text-[12.5px] font-medium transition hover:text-white"
              style={{ color: "rgba(255,255,255,0.5)" }}
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
