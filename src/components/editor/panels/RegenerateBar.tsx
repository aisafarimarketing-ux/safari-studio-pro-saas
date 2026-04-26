"use client";

import { useState } from "react";
import { useProposalStore } from "@/store/proposalStore";
import {
  mergeAutopilotIntoProposal,
  mergeAutopilotAdditive,
  type AutopilotResult,
} from "@/lib/autopilotMerge";

// RegenerateBar — top of the Trip tab. Two buttons drive autopilot:
//
//  • Regenerate all  — full re-run, replaces days / sections / lists /
//                      pricing. Closest to the original Trip Setup
//                      "Automate" affordance. Confirms before firing
//                      because it overwrites manual edits.
//  • Add new info    — strictly additive. Appends new tail days when
//                      the trip got longer, fills empty section slots,
//                      never touches existing edits.
//
// Both share the same fetch path; only the merge function changes.

type Mode = "all" | "additive";

export function RegenerateBar() {
  const { proposal, hydrateProposal } = useProposalStore();
  const [busy, setBusy] = useState<Mode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Mode | null>(null);

  const run = async (mode: Mode) => {
    if (busy) return;
    if (mode === "all") {
      const ok = window.confirm(
        "Regenerate all will replace days, AI copy, inclusions, and pricing using your latest trip details. Manual edits to those fields will be lost.\n\nContinue?",
      );
      if (!ok) return;
    }
    setBusy(mode);
    setError(null);
    setDone(null);
    try {
      const res = await fetch("/api/ai/autopilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposal }),
      });
      if (res.status === 401) {
        window.location.href = "/sign-in";
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Autopilot failed (${res.status})`);
      }
      const draft = (await res.json()) as AutopilotResult;
      const merged =
        mode === "all"
          ? mergeAutopilotIntoProposal(proposal, draft)
          : mergeAutopilotAdditive(proposal, draft, proposal.days.length);
      hydrateProposal(merged);
      setDone(mode);
      setTimeout(() => setDone(null), 2200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Autopilot failed");
    } finally {
      setBusy(null);
    }
  };

  const isAllBusy = busy === "all";
  const isAddBusy = busy === "additive";

  return (
    <div className="rounded-xl border border-black/8 bg-white p-3 mb-6">
      <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-black/45 mb-1.5">
        Autopilot
      </div>
      <div className="text-[11px] text-black/50 leading-relaxed mb-3">
        Edit the fields below, then re-run autopilot — additive only fills new
        days and empty slots; full replaces everything from the trip data.
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={!!busy}
          onClick={() => run("additive")}
          className={`h-9 rounded-lg text-[12px] font-semibold transition border ${
            isAddBusy
              ? "bg-[#1b3a2d] text-white border-[#1b3a2d] cursor-wait"
              : "bg-white text-[#1b3a2d] border-[#1b3a2d]/30 hover:border-[#1b3a2d] disabled:opacity-50 disabled:cursor-not-allowed"
          }`}
          title="Append new days, fill empty slots — preserves your edits"
        >
          {isAddBusy ? "Adding…" : "✦ Add new info"}
        </button>
        <button
          type="button"
          disabled={!!busy}
          onClick={() => run("all")}
          className={`h-9 rounded-lg text-[12px] font-semibold transition ${
            isAllBusy
              ? "bg-[#1b3a2d] text-white cursor-wait"
              : "bg-[#1b3a2d] text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          }`}
          title="Full re-run — overwrites days and AI copy"
        >
          {isAllBusy ? "Regenerating…" : "↻ Regenerate all"}
        </button>
      </div>

      {error && (
        <div className="mt-2.5 text-[11px] text-red-600 leading-snug">
          {error}
        </div>
      )}
      {done && !error && (
        <div className="mt-2.5 text-[11px] text-[#1b3a2d] leading-snug">
          {done === "additive"
            ? "Added new info — existing days untouched."
            : "Regenerated — fresh draft applied."}
        </div>
      )}
    </div>
  );
}
