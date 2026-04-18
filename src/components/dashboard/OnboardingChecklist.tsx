"use client";

import Link from "next/link";
import { useState } from "react";

// ─── Onboarding checklist ──────────────────────────────────────────────────
//
// Three goals, derived from real workspace data — no separate completion
// state stored anywhere. Each goal is "done" when the underlying signal
// turns true:
//
//   1. Add first property      → properties count > 0
//   2. Create first proposal   → proposals count > 0
//   3. Complete Brand DNA      → brand DNA overall ≥ 60%
//
// When all three are done OR the user dismisses, the component renders
// nothing. Dismissal is per-browser (sessionStorage) so it doesn't lose
// data across sessions but doesn't nag either.

const DISMISS_KEY = "ss-onboarding-dismissed";

export interface OnboardingProgress {
  hasProperties: boolean;
  hasProposals: boolean;
  brandDNAComplete: boolean;
}

export function OnboardingChecklist({ progress }: { progress: OnboardingProgress }) {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    try { return sessionStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; }
  });

  if (dismissed) return null;

  const items = [
    {
      key: "property",
      done: progress.hasProperties,
      label: "Add your first property",
      hint: "Start your library — the camps and lodges every proposal will lean on.",
      cta: { href: "/properties/new", label: "Add property" },
    },
    {
      key: "proposal",
      done: progress.hasProposals,
      label: "Create your first proposal",
      hint: "Open the editor with a blank canvas, or import the sample to explore.",
      cta: { href: "/studio", label: "New proposal" },
    },
    {
      key: "brand",
      done: progress.brandDNAComplete,
      label: "Set up your Brand DNA",
      hint: "Sliders + writing samples teach the AI how you sound.",
      cta: { href: "/settings/brand", label: "Open Brand DNA" },
    },
  ];

  const completedCount = items.filter((i) => i.done).length;
  const allDone = completedCount === items.length;

  // Auto-disappear once everything's done. No need to show "great job!".
  if (allDone) return null;

  const dismiss = () => {
    setDismissed(true);
    try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch {}
  };

  return (
    <section
      className="rounded-2xl border bg-white p-5 mb-6 relative"
      style={{ borderColor: "rgba(201,168,76,0.35)" }}
    >
      <button
        type="button"
        onClick={dismiss}
        className="absolute top-3 right-3 text-black/30 hover:text-black/60 text-base leading-none px-1"
        title="Hide for this session"
        aria-label="Dismiss onboarding checklist"
      >
        ×
      </button>

      <div className="flex items-baseline justify-between gap-2 mb-1 pr-6">
        <div className="text-[11px] uppercase tracking-[0.22em] font-semibold text-[#8a7125]">
          Get set up
        </div>
        <div className="text-[11px] text-black/40 tabular-nums">
          {completedCount}/{items.length}
        </div>
      </div>
      <h3 className="text-[15px] font-semibold text-black/85">
        Three short steps to a workspace that earns its keep.
      </h3>

      <ul className="mt-4 space-y-2">
        {items.map((item) => (
          <li key={item.key}>
            <div className="flex items-center gap-3 rounded-xl border border-black/8 bg-white px-4 py-3">
              <Tick done={item.done} />
              <div className="flex-1 min-w-0">
                <div
                  className={`text-[14px] font-medium ${
                    item.done ? "text-black/45 line-through decoration-black/30" : "text-black/85"
                  }`}
                >
                  {item.label}
                </div>
                {!item.done && (
                  <div className="text-[12px] text-black/50 mt-0.5 line-clamp-1">
                    {item.hint}
                  </div>
                )}
              </div>
              {!item.done && (
                <Link
                  href={item.cta.href}
                  className="px-3 py-1.5 text-[12px] rounded-lg border border-black/12 text-black/70 hover:bg-black/5 transition shrink-0"
                >
                  {item.cta.label} →
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Tick({ done }: { done: boolean }) {
  return (
    <span
      className={`w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0 transition ${
        done ? "bg-[#1b3a2d] text-white" : "border-2 border-black/15 text-transparent"
      }`}
      aria-hidden
    >
      ✓
    </span>
  );
}
