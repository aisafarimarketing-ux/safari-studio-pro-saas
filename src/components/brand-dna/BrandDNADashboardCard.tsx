"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { BrandDNACompletion } from "@/lib/brandDNA";
import { CompletionRing } from "./CompletionRing";

// Compact card for /proposals — shows completion + the single highest-leverage
// next action. Silent when we can't load it (never blocks the dashboard).

export function BrandDNADashboardCard() {
  const [completion, setCompletion] = useState<BrandDNACompletion | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/brand-dna", { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        setCompletion(data.completion as BrandDNACompletion);
      } catch {
        setFailed(true);
      }
    })();
  }, []);

  if (failed || !completion) return null;

  const { overall, nextBestAction } = completion;

  return (
    <Link
      href="/settings/brand"
      className="block rounded-2xl border border-black/8 bg-white hover:border-black/20 hover:shadow-[0_4px_20px_rgba(0,0,0,0.04)] transition group p-5"
    >
      <div className="flex items-center gap-5">
        <CompletionRing percent={overall} size={64} stroke={6} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-[12px] uppercase tracking-[0.18em] font-semibold text-[#1b3a2d]">
              Brand DNA
            </div>
            <div className="text-[11px] text-black/35 uppercase tracking-wider font-medium">
              {overall === 100 ? "Complete" : "In progress"}
            </div>
          </div>
          {nextBestAction ? (
            <>
              <div className="mt-1 text-[15px] font-semibold text-black/85 truncate">
                {nextBestAction.headline}
              </div>
              <div className="text-[12px] text-black/50 mt-0.5 truncate">
                {nextBestAction.rationale}
              </div>
            </>
          ) : (
            <>
              <div className="mt-1 text-[15px] font-semibold text-black/85">
                Your Brand DNA is dialed in.
              </div>
              <div className="text-[12px] text-black/50 mt-0.5">
                The AI writes every proposal in your voice.
              </div>
            </>
          )}
        </div>
        <div className="text-black/30 group-hover:text-[#1b3a2d] text-xl leading-none shrink-0">
          →
        </div>
      </div>
    </Link>
  );
}
