"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { BrandDNACompletion } from "@/lib/brandDNA";

// Non-blocking editor hint. Fetches Brand DNA completion once on mount.
// If the completion is low, shows a dismissible chip linking to
// /settings/brand. Renders nothing when completion is high, when the fetch
// fails, or when the user has dismissed the hint in this session.

const DISMISS_KEY = "brandDNAHintDismissed";

export function BrandDNAHint() {
  const [completion, setCompletion] = useState<BrandDNACompletion | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    try { return sessionStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; }
  });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/brand-dna", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        setCompletion(data.completion as BrandDNACompletion);
      } catch {}
    })();
  }, []);

  if (dismissed || !completion) return null;
  if (completion.overall >= 70) return null;

  const next = completion.nextBestAction;
  // Map section → user-facing short phrase for the editor context.
  const line = next
    ? editorCopyForAction(next.sectionKey)
    : "Teach the AI your brand voice to sharpen every proposal.";

  const handleDismiss = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDismissed(true);
    try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch {}
  };

  return (
    <Link
      href="/settings/brand"
      className="group flex items-center gap-2 px-3 py-1.5 rounded-full border text-[12px] transition max-w-[400px]"
      style={{
        borderColor: "rgba(201,168,76,0.45)",
        background: "rgba(201,168,76,0.10)",
        color: "#8a7125",
      }}
      title="Open Brand DNA settings"
    >
      <span aria-hidden>✦</span>
      <span className="truncate">{line}</span>
      <span className="text-[#8a7125]/60 group-hover:text-[#8a7125] transition shrink-0">
        →
      </span>
      <button
        type="button"
        onClick={handleDismiss}
        className="ml-1 w-4 h-4 -mr-1 rounded-full text-[#8a7125]/50 hover:text-[#8a7125] hover:bg-[#8a7125]/10 flex items-center justify-center text-sm leading-none shrink-0"
        aria-label="Dismiss hint"
        title="Dismiss for this session"
      >
        ×
      </button>
    </Link>
  );
}

function editorCopyForAction(
  section: BrandDNACompletion["sections"][number]["key"] | string,
): string {
  switch (section) {
    case "voiceTone":
      return "Using default tone. Add your brand voice.";
    case "propertyPreferences":
      return "Set property preferences to improve results.";
    case "visualStyle":
      return "Add visual style for better imagery.";
    case "brandCore":
      return "Add your brand basics — logo, tagline, description.";
    case "aiInstructions":
      return "Add AI guardrails to keep drafts on-policy.";
    default:
      return "Teach the AI your brand to sharpen every proposal.";
  }
}
