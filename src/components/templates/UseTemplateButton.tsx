"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";

// ─── Use-this-template button ──────────────────────────────────────────────
//
// Handles the two paths off /templates/[slug]:
//   Signed in   → POST /api/proposals/from-template → navigate /studio/[id]
//   Signed out  → /sign-up?redirect_url=/templates/<slug>
//
// When the visitor comes back from sign-up the page re-renders and
// they click again; the auto-clone-after-signup polish is deferred.

export function UseTemplateButton({
  slug,
  children,
  className,
  style,
}: {
  slug: string;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setError(null);

    if (!isLoaded) return;

    if (!isSignedIn) {
      const back = encodeURIComponent(`/templates/${slug}`);
      window.location.href = `/sign-up?redirect_url=${back}`;
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/proposals/from-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      if (res.status === 409) { window.location.href = "/select-organization"; return; }
      if (res.status === 402) { window.location.href = "/account-suspended"; return; }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "Could not clone this template. Please retry.");
        setBusy(false);
        return;
      }
      const data = (await res.json()) as { proposal: { id: string } };
      try { localStorage.setItem("activeProposalId", data.proposal.id); } catch {}
      router.push(`/studio/${data.proposal.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error.");
      setBusy(false);
    }
  };

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className={className}
        style={style}
      >
        {busy ? "Cloning…" : (children ?? "Use this template →")}
      </button>
      {error && (
        <div className="text-[11px] text-[#b34334] bg-white/90 px-2 py-1 rounded">{error}</div>
      )}
    </div>
  );
}
