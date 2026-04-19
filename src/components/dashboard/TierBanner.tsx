"use client";

import { useEffect, useState } from "react";

// Pilot / trial banner. Mounts on the dashboard, fetches the workspace
// tier once, and renders a countdown for pilot orgs + a soft reminder
// for trial orgs. Paid orgs see nothing.

type TierInfo = {
  tier: "trial" | "pilot" | "paid" | null;
  tierExpiresAt: string | null;
  tierNote: string | null;
};

export function TierBanner() {
  const [info, setInfo] = useState<TierInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/workspace/tier", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as TierInfo;
        if (!cancelled) setInfo(data);
      } catch {
        // Silent — tier is cosmetic; never block the dashboard on a failure.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!info || !info.tier || info.tier === "paid") return null;

  if (info.tier === "pilot") {
    const daysLeft = info.tierExpiresAt
      ? Math.max(0, Math.round((new Date(info.tierExpiresAt).getTime() - Date.now()) / 86_400_000))
      : null;
    return (
      <div
        className="mb-6 rounded-xl p-4 flex items-start gap-3"
        style={{ background: "rgba(201,168,76,0.12)", border: "1px solid rgba(201,168,76,0.35)" }}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-[#8a7230] font-bold shrink-0"
          style={{ background: "rgba(201,168,76,0.25)" }}
        >
          ✦
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold text-[#8a7230]">
            Pilot programme
            {daysLeft !== null && (
              <>
                {" "}·{" "}
                <span className="font-normal">
                  {daysLeft === 0
                    ? "ends today"
                    : daysLeft === 1
                      ? "1 day left"
                      : `${daysLeft} days left`}
                </span>
              </>
            )}
          </div>
          <div className="mt-0.5 text-[13px] text-black/65">
            {info.tierNote?.trim() ||
              "You're on the Safari Studio founding-pilot programme — full access, zero charges. We'll touch base before the end date to agree on next steps."}
          </div>
        </div>
      </div>
    );
  }

  // tier === "trial"
  return (
    <div
      className="mb-6 rounded-xl p-4 flex items-start gap-3"
      style={{ background: "rgba(27,58,45,0.06)", border: "1px solid rgba(27,58,45,0.15)" }}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center text-[#1b3a2d] font-bold shrink-0"
        style={{ background: "rgba(27,58,45,0.1)" }}
      >
        ◇
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-[#1b3a2d]">Trial workspace</div>
        <div className="mt-0.5 text-[13px] text-black/65">
          Build freely. When you're ready to send live proposals, reach out and we&apos;ll set you up with an account.
        </div>
      </div>
    </div>
  );
}
