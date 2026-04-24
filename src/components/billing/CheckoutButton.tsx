"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";

// ─── CheckoutButton ────────────────────────────────────────────────────────
//
// Drop-in button for the pricing page. Signed-in users trigger a
// Paystack checkout (POST /api/billing/paystack/init → redirect to
// hosted checkout). Signed-out users bounce to /sign-up with a
// redirect_url so they land back on /pricing after signup.

export function CheckoutButton({
  plan,
  className,
  style,
  children,
}: {
  plan: "consultant" | "explorer" | "operator";
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const { isLoaded, isSignedIn } = useUser();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setError(null);

    if (!isLoaded) return;

    if (!isSignedIn) {
      window.location.href = "/sign-up?redirect_url=/pricing";
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/billing/paystack/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      if (res.status === 409) { window.location.href = "/select-organization"; return; }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "Could not start checkout. Please retry.");
        setBusy(false);
        return;
      }
      const data = (await res.json()) as { authorizationUrl: string };
      window.location.href = data.authorizationUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error.");
      setBusy(false);
    }
  };

  return (
    <div className="inline-flex flex-col items-stretch gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className={className}
        style={style}
      >
        {busy ? "Redirecting…" : children}
      </button>
      {error && (
        <div className="text-[11px] text-[#b34334] bg-white/90 px-2 py-1 rounded">{error}</div>
      )}
    </div>
  );
}
