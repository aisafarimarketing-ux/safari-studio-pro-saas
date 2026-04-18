"use client";

import type { BrandDNACompletion, SectionKey } from "@/lib/brandDNA";
import { CompletionRing } from "./CompletionRing";

// Overview = at-a-glance scoreboard. Shows every section with a % bar and a
// "Continue →" link that jumps the tab strip to that section.

export function OverviewTab({
  completion,
  onGoto,
}: {
  completion: BrandDNACompletion;
  onGoto: (section: SectionKey) => void;
}) {
  const { overall, sections, nextBestAction } = completion;

  return (
    <div className="space-y-8">
      {/* Hero: ring + copy */}
      <div className="rounded-2xl border border-black/8 bg-white p-6 md:p-8 flex items-center gap-8 flex-wrap">
        <CompletionRing percent={overall} size={96} stroke={8} />
        <div className="flex-1 min-w-[260px]">
          <h2 className="text-xl font-semibold text-black/85 tracking-tight">
            {overall === 0
              ? "Let's teach the AI how you sound."
              : overall < 40
                ? "You're getting started."
                : overall < 80
                  ? "Your Brand DNA is taking shape."
                  : "Your Brand DNA is dialed in."}
          </h2>
          <p className="mt-1.5 text-[14px] text-black/55 max-w-xl leading-relaxed">
            The more complete your Brand DNA, the more your proposals feel
            like your brand. Everything here is optional — partial answers
            still make the AI smarter.
          </p>
        </div>
      </div>

      {/* Next best action */}
      {nextBestAction && (
        <button
          type="button"
          onClick={() => onGoto(nextBestAction.sectionKey)}
          className="w-full text-left rounded-2xl p-5 border transition group hover:border-[#c9a84c]/60"
          style={{
            background: "linear-gradient(135deg, rgba(201,168,76,0.08), rgba(27,58,45,0.04))",
            borderColor: "rgba(201,168,76,0.35)",
          }}
        >
          <div className="flex items-start gap-4">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-[#1b3a2d] shrink-0"
              style={{ background: "rgba(201,168,76,0.22)" }}
            >
              ✦
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] uppercase tracking-wider font-semibold text-[#8a7125]">
                Next best action
              </div>
              <div className="text-[16px] font-semibold text-black/85 mt-1">
                {nextBestAction.headline}
              </div>
              <div className="text-[13px] text-black/55 mt-1 max-w-xl">
                {nextBestAction.rationale}
              </div>
            </div>
            <div className="text-black/40 group-hover:text-[#1b3a2d] text-xl leading-none shrink-0 mt-2">
              →
            </div>
          </div>
        </button>
      )}

      {/* Section list */}
      <div className="space-y-2">
        {sections.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => onGoto(s.key)}
            className="w-full flex items-center gap-4 rounded-xl border border-black/8 bg-white p-4 hover:border-black/20 transition text-left"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-3">
                <div className="font-medium text-[14px] text-black/80">{s.label}</div>
                <div className="text-[12px] text-black/40 tabular-nums">
                  {s.filled}/{s.filledOf} · {Math.round(s.percent)}%
                </div>
              </div>
              <div className="h-1.5 mt-2 rounded-full overflow-hidden bg-black/6">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.max(2, s.percent)}%`,
                    background: s.percent >= 66 ? "#1b3a2d" : "#c9a84c",
                  }}
                />
              </div>
            </div>
            <div className="text-[11px] uppercase tracking-wider font-semibold text-black/30 shrink-0 w-12 text-right">
              {s.weight}%
            </div>
          </button>
        ))}
      </div>

      <p className="text-[12px] text-black/40 text-center pt-2">
        Section weights reflect how much each field moves proposal quality.
        Voice &amp; Tone carries the most weight because it changes the AI&apos;s words directly.
      </p>
    </div>
  );
}
