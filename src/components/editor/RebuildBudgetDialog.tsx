"use client";

import { useEffect, useRef, useState } from "react";
import { useProposalStore } from "@/store/proposalStore";
import type { Day, Proposal, TierKey } from "@/lib/types";

// ─── Rebuild-to-budget dialog ──────────────────────────────────────────────
//
// The live-demo feature. Operator enters a new per-person target; Claude
// swaps lodges (picking from the org library), rewrites narratives to
// match the new tier, and returns a before/after preview. Operator clicks
// Apply → proposal store hydrates with the merged state → autosave
// commits like any other edit.
//
// Flow:
//   idle     → operator types a target, clicks Rebuild
//   working  → hummingbird loader (Claude call, 15-30s)
//   preview  → before/after summary with Apply / Discard
//   error    → surface the message, keep the modal open

const FOREST = "#1b3a2d";
const GOLD = "#c9a84c";

const STAGES = [
  "Reading the current itinerary…",
  "Matching camps to the new budget…",
  "Rewriting day narratives…",
  "Balancing the tier pricing…",
  "Checking the voice…",
  "Almost there…",
];

type View =
  | { kind: "idle" }
  | { kind: "working" }
  | { kind: "preview"; result: RebuildResult }
  | { kind: "error"; message: string };

type Swap = {
  dayNumber: number;
  destination: string;
  tier: TierKey;
  before: string;
  after: string;
};

type RebuildResult = {
  pricing: {
    classic:   { label: string; pricePerPerson: string; currency: string; highlighted: boolean };
    premier:   { label: string; pricePerPerson: string; currency: string; highlighted: boolean };
    signature: { label: string; pricePerPerson: string; currency: string; highlighted: boolean };
    notes: string;
  };
  days: Day[];
  closing: { signOff: string };
  rebuild: {
    notes: string;
    beforePricing: { classic: string; premier: string; signature: string };
    afterPricing:  { classic: string; premier: string; signature: string };
    swaps: Swap[];
  };
};

export function RebuildBudgetDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { proposal, hydrateProposal } = useProposalStore();
  const [view, setView] = useState<View>({ kind: "idle" });
  const [target, setTarget] = useState<string>("");
  const [progress, setProgress] = useState(0);
  const [stageIndex, setStageIndex] = useState(0);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Prefill the target with the current highlighted tier's price (minus ~15%
  // so the common case — client asks for cheaper — is one click away).
  useEffect(() => {
    if (!open) return;
    const current = parseCurrentTarget(proposal);
    if (current > 0) {
      const suggest = Math.round((current * 0.85) / 100) * 100;
      setTarget(suggest.toString());
    } else {
      setTarget("");
    }
    setView({ kind: "idle" });
  }, [open, proposal]);

  // Progress rail while working
  useEffect(() => {
    if (view.kind !== "working") {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
      return;
    }
    setProgress(0);
    setStageIndex(0);
    const startedAt = Date.now();
    progressTimerRef.current = setInterval(() => {
      const elapsed = (Date.now() - startedAt) / 1000;
      const t = Math.min(1, elapsed / 22);
      const eased = 1 - Math.pow(2, -6 * t);
      const pct = Math.min(85, Math.round(eased * 85));
      setProgress(pct);
      setStageIndex(Math.min(STAGES.length - 1, Math.floor(pct / (85 / STAGES.length))));
    }, 120);
    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, [view.kind]);

  if (!open) return null;

  const handleRebuild = async () => {
    const n = parseInt(target.replace(/[^0-9]/g, ""), 10);
    if (!Number.isFinite(n) || n < 500) {
      setView({ kind: "error", message: "Enter a realistic per-person target — at least $500." });
      return;
    }
    setView({ kind: "working" });
    try {
      const res = await fetch("/api/ai/rebuild-budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposal,
          targetPricePerPerson: n,
          targetCurrency: proposal.pricing?.premier?.currency || "USD",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setView({ kind: "error", message: data?.error ?? "Rebuild failed. Please retry." });
        return;
      }
      const result = (await res.json()) as RebuildResult;
      setProgress(100);
      setStageIndex(STAGES.length - 1);
      await new Promise((r) => setTimeout(r, 350));
      setView({ kind: "preview", result });
    } catch (err) {
      setView({
        kind: "error",
        message: err instanceof Error ? err.message : "Network error. Please retry.",
      });
    }
  };

  const handleApply = () => {
    if (view.kind !== "preview") return;
    const merged = mergeRebuildIntoProposal(proposal, view.result);
    hydrateProposal(merged);
    onClose();
  };

  // ─── Render ───────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 ss-fade-in">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col ss-modal-in"
        role="dialog"
        aria-label="Rebuild to a budget"
      >
        <header className="px-6 py-4 border-b border-black/8 flex items-center justify-between shrink-0">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] font-semibold" style={{ color: FOREST }}>
              Rebuild to a budget
            </div>
            <h2 className="text-lg font-bold text-black/85 mt-0.5" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              Give me a target. I&apos;ll rework the proposal.
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-black/40 hover:text-black/70 text-xl leading-none px-2"
            aria-label="Close"
          >
            ×
          </button>
        </header>

        {view.kind === "idle" || view.kind === "error" ? (
          <IdleBody
            target={target}
            setTarget={setTarget}
            onRebuild={handleRebuild}
            onClose={onClose}
            errorMsg={view.kind === "error" ? view.message : null}
            currency={proposal.pricing?.premier?.currency || "USD"}
            currentTarget={parseCurrentTarget(proposal)}
          />
        ) : view.kind === "working" ? (
          <WorkingBody progress={progress} stage={STAGES[stageIndex] ?? STAGES[0]} />
        ) : (
          <PreviewBody
            result={view.result}
            target={target}
            currency={proposal.pricing?.premier?.currency || "USD"}
            onApply={handleApply}
            onDiscard={() => setView({ kind: "idle" })}
          />
        )}
      </div>
    </div>
  );
}

// ─── Idle body — target input + CTA ───────────────────────────────────────

function IdleBody({
  target,
  setTarget,
  onRebuild,
  onClose,
  errorMsg,
  currency,
  currentTarget,
}: {
  target: string;
  setTarget: (v: string) => void;
  onRebuild: () => void;
  onClose: () => void;
  errorMsg: string | null;
  currency: string;
  currentTarget: number;
}) {
  return (
    <>
      <div className="flex-1 overflow-auto px-6 py-5">
        <p className="text-[14px] text-black/65 leading-relaxed">
          Enter the per-person target for your highlighted tier. We&apos;ll swap
          camps from your library, rewrite each day&apos;s prose to match the new
          tier, and rebalance all three tiers around the target. Your guests,
          dates, and destinations stay put.
        </p>

        <div className="mt-5">
          <label className="block">
            <span className="block text-[12px] font-semibold text-black/70 mb-1.5">
              Target price, per person
            </span>
            <div
              className="flex items-center rounded-xl border-2 overflow-hidden transition focus-within:border-[#1b3a2d]"
              style={{ borderColor: "rgba(0,0,0,0.12)" }}
            >
              <span className="px-3.5 py-3 text-[14px] font-semibold text-black/50 border-r" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
                {currency}
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={target}
                onChange={(e) => setTarget(e.target.value.replace(/[^0-9,]/g, ""))}
                placeholder="6,500"
                className="flex-1 px-3.5 py-3 text-[18px] font-semibold text-black/85 outline-none tabular-nums"
              />
              <span className="px-3.5 py-3 text-[13px] text-black/45 border-l" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
                per person
              </span>
            </div>
            {currentTarget > 0 && (
              <div className="mt-1.5 text-[12px] text-black/50">
                Currently: <strong className="tabular-nums">{currentTarget.toLocaleString()}</strong> {currency} / person
              </div>
            )}
          </label>
        </div>

        {errorMsg && (
          <div className="mt-4 rounded-lg px-3.5 py-2.5 text-[13px] text-[#7a2e23] bg-[#f4d7d0] border border-[#e3b5ac]">
            {errorMsg}
          </div>
        )}
      </div>

      <footer className="px-6 py-4 border-t border-black/8 flex items-center justify-end gap-2 shrink-0">
        <button
          onClick={onClose}
          className="px-4 py-2 text-[13.5px] rounded-lg text-black/60 hover:bg-black/5 transition"
        >
          Cancel
        </button>
        <button
          onClick={onRebuild}
          disabled={target.trim().length === 0}
          className="px-5 py-2 rounded-lg text-[13.5px] font-semibold transition active:scale-95 disabled:opacity-50"
          style={{ background: GOLD, color: FOREST }}
        >
          Rebuild →
        </button>
      </footer>
    </>
  );
}

// ─── Working body — hummingbird loader ────────────────────────────────────

function WorkingBody({ progress, stage }: { progress: number; stage: string }) {
  const pct = Math.max(0, Math.min(100, progress));
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 py-10">
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-black/85" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
          {stage}
        </h2>
      </div>
      <div className="w-full max-w-md">
        <div className="relative h-14">
          <div
            className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full"
            style={{ background: "rgba(27,58,45,0.12)" }}
          />
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full transition-[width] duration-500 ease-out"
            style={{
              width: `${pct}%`,
              background: `linear-gradient(90deg, ${FOREST}, ${GOLD})`,
              boxShadow: `0 0 10px ${GOLD}66`,
            }}
          />
          <div
            className="absolute top-1/2 hummingbird-fly"
            style={{
              left: `${pct}%`,
              transform: "translate(-50%, -50%)",
              transition: "left 500ms ease-out",
            }}
          >
            <HummingbirdSVG />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between text-[12.5px]">
          <div className="text-black/55">AI rebuild</div>
          <div className="tabular-nums font-semibold" style={{ color: FOREST }}>{pct}%</div>
        </div>
        <div className="mt-2 text-center text-[11.5px] text-black/40">Usually 15 – 25 seconds</div>
      </div>
      <style jsx>{`
        @keyframes wings { 0%, 100% { transform: scaleY(1); } 50% { transform: scaleY(0.15); } }
        @keyframes bob   { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }
        :global(.hummingbird-fly) { animation: bob 0.9s ease-in-out infinite; }
        :global(.hummingbird-wing) {
          transform-origin: 22px 20px;
          animation: wings 0.14s linear infinite;
        }
      `}</style>
    </div>
  );
}

function HummingbirdSVG() {
  return (
    <svg width="42" height="28" viewBox="0 0 42 28" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ filter: `drop-shadow(0 2px 3px rgba(27,58,45,0.25))` }}
    >
      <path d="M4 14 L0 10 L1 14 L0 18 Z" fill={FOREST} />
      <path d="M4 14 C 10 9, 18 10, 24 13 C 26 14, 26 15, 24 16 C 18 18, 10 18, 4 14 Z" fill={FOREST} />
      <circle cx="25" cy="13" r="3.5" fill={FOREST} />
      <circle cx="26" cy="12.5" r="0.7" fill="white" />
      <path d="M28 13 L41 13.3 L28 14 Z" fill={GOLD} />
      <path d="M22 14.5 C 24 15.5, 25 15.3, 25 14 C 24 13.6, 22 13.8, 22 14.5 Z" fill={GOLD} opacity="0.7" />
      <g className="hummingbird-wing">
        <ellipse cx="16" cy="10" rx="9" ry="6" fill={FOREST} opacity="0.55" />
      </g>
    </svg>
  );
}

// ─── Preview body — before/after + Apply/Discard ──────────────────────────

function PreviewBody({
  result,
  currency,
  onApply,
  onDiscard,
}: {
  result: RebuildResult;
  target: string;
  currency: string;
  onApply: () => void;
  onDiscard: () => void;
}) {
  const { beforePricing, afterPricing, swaps, notes } = result.rebuild;
  const uniqueDaysChanged = new Set(swaps.map((s) => s.dayNumber)).size;

  return (
    <>
      <div className="flex-1 overflow-auto px-6 py-5">
        {notes && (
          <div
            className="rounded-lg px-3.5 py-2.5 text-[13px] leading-relaxed mb-4"
            style={{ background: "rgba(201,168,76,0.1)", color: "#6b5417" }}
          >
            {notes}
          </div>
        )}

        <div className="text-[10.5px] uppercase tracking-[0.22em] font-semibold text-black/45 mb-3">
          New pricing
        </div>
        <div className="grid grid-cols-3 gap-2 mb-5">
          {(["classic", "premier", "signature"] as const).map((t) => {
            const before = beforePricing[t];
            const after = afterPricing[t];
            const changed = before !== after;
            return (
              <div
                key={t}
                className="rounded-lg border px-3 py-2.5"
                style={{
                  borderColor: result.pricing[t].highlighted ? GOLD : "rgba(0,0,0,0.08)",
                  background: result.pricing[t].highlighted ? "rgba(201,168,76,0.06)" : "white",
                }}
              >
                <div className="text-[10.5px] uppercase tracking-wider font-semibold" style={{ color: result.pricing[t].highlighted ? "#8a7125" : "rgba(0,0,0,0.45)" }}>
                  {result.pricing[t].label}
                </div>
                {changed && before && (
                  <div className="text-[11px] text-black/35 line-through tabular-nums mt-1">
                    {before} {currency}
                  </div>
                )}
                <div className="text-[18px] font-bold text-black/85 tabular-nums leading-tight mt-0.5">
                  {after || "—"}
                </div>
                <div className="text-[10.5px] text-black/40">per person</div>
              </div>
            );
          })}
        </div>

        <div className="text-[10.5px] uppercase tracking-[0.22em] font-semibold text-black/45 mb-2">
          Camp changes {swaps.length > 0 && `· ${uniqueDaysChanged} day${uniqueDaysChanged === 1 ? "" : "s"}`}
        </div>

        {swaps.length === 0 ? (
          <div className="rounded-lg border border-black/8 bg-black/[0.02] px-3.5 py-3 text-[13px] text-black/55">
            No camp changes were needed — the AI only adjusted pricing and prose.
          </div>
        ) : (
          <ul className="space-y-1.5">
            {swaps.map((s, i) => (
              <li
                key={i}
                className="rounded-lg border border-black/8 bg-white px-3 py-2 flex items-baseline gap-3 text-[13px]"
              >
                <div className="w-20 shrink-0 text-[11px] uppercase tracking-wider text-black/40">
                  Day {s.dayNumber}
                </div>
                <div className="w-20 shrink-0 text-[11px] uppercase tracking-wider text-black/40 capitalize">
                  {s.tier}
                </div>
                <div className="flex-1 min-w-0">
                  {s.before ? (
                    <>
                      <span className="text-black/45 line-through mr-2 truncate">{s.before}</span>
                      <span className="text-black/40">→</span>
                      <span className="text-black/85 font-medium ml-2 truncate">{s.after || "—"}</span>
                    </>
                  ) : (
                    <span className="text-black/85 font-medium truncate">+ {s.after}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <footer className="px-6 py-4 border-t border-black/8 flex items-center justify-end gap-2 shrink-0">
        <button
          onClick={onDiscard}
          className="px-4 py-2 text-[13.5px] rounded-lg text-black/60 hover:bg-black/5 transition"
        >
          Discard — try a different target
        </button>
        <button
          onClick={onApply}
          className="px-5 py-2 rounded-lg text-[13.5px] font-semibold transition active:scale-95"
          style={{ background: FOREST, color: "white" }}
        >
          Apply rebuild →
        </button>
      </footer>
    </>
  );
}

// ─── Merge helper ─────────────────────────────────────────────────────────
// Preserves per-day metadata the operator might have tweaked (country,
// subtitle, board, highlights, heroImageUrl) while taking the new
// descriptions + tier picks from the rebuild. Pricing replaced wholesale;
// closing.signOff only if present in the rebuild.

function mergeRebuildIntoProposal(current: Proposal, result: RebuildResult): Proposal {
  const next: Proposal = { ...current };

  // Days — align by dayNumber, preserve per-day meta
  const rebuiltByNum = new Map(result.days.map((d) => [d.dayNumber, d]));
  next.days = current.days.map((orig) => {
    const rebuilt = rebuiltByNum.get(orig.dayNumber);
    if (!rebuilt) return orig;
    return {
      ...orig,
      description: rebuilt.description || orig.description,
      tiers: rebuilt.tiers,
    };
  });

  next.pricing = {
    classic: { ...current.pricing.classic, ...result.pricing.classic },
    premier: { ...current.pricing.premier, ...result.pricing.premier },
    signature: { ...current.pricing.signature, ...result.pricing.signature },
    notes: result.pricing.notes || current.pricing.notes,
  };

  if (result.closing.signOff) {
    next.sections = current.sections.map((s) =>
      s.type === "closing"
        ? { ...s, content: { ...s.content, signOff: result.closing.signOff } }
        : s,
    );
  }

  return next;
}

// Pull the current highlighted-tier target from the proposal. Falls back
// to premier when no tier is marked highlighted.
function parseCurrentTarget(proposal: Proposal): number {
  const hl =
    Object.entries(proposal.pricing)
      .filter(([key]) => key === "classic" || key === "premier" || key === "signature")
      .find(([, t]) => (t as { highlighted?: boolean } | undefined)?.highlighted)?.[1] ??
    proposal.pricing.premier;
  const tier = hl as { pricePerPerson?: string } | undefined;
  const priceStr = tier?.pricePerPerson?.replace(/[^0-9]/g, "") ?? "";
  const n = parseInt(priceStr, 10);
  return Number.isFinite(n) ? n : 0;
}
