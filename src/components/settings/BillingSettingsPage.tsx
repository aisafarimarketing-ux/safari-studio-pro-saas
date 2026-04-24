"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AppHeader } from "@/components/properties/AppHeader";
import { CheckoutButton } from "@/components/billing/CheckoutButton";

// ─── Settings → Billing ─────────────────────────────────────────────────────
//
// Operator-facing billing dashboard. Shows current plan + limits + usage
// for the billing window, next renewal date, cancellation state. Supports
// upgrade / change-plan / cancel. Owner / admin can see everything;
// members see a read-only view (enforced server-side).
//
// State is fetched from /api/billing/status on mount + after cancel.

const FOREST = "#1b3a2d";
const GOLD = "#c9a84c";

type Status = {
  plan: "none" | "consultant" | "explorer" | "operator";
  planLabel: string;
  pricePerMonthUSD: number;
  limits: { proposalsPerMonth: number; seats: number };
  usage: { proposalsThisWindow: number; windowStart: string };
  lifecycle: { tier: string; tierExpiresAt: string | null; status: string };
  billing: {
    processor: string | null;
    currentPeriodEnd: string | null;
    lastPaymentAt: string | null;
    cancelAtPeriodEnd: boolean;
    hasSubscription: boolean;
  };
};

export function BillingSettingsPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch("/api/billing/status", { cache: "no-store" });
      if (res.status === 401) { window.location.href = "/sign-in?redirect_url=/settings/billing"; return; }
      if (res.status === 409) { window.location.href = "/select-organization"; return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStatus((await res.json()) as Status);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCancel = async () => {
    setCancelling(true);
    setCancelError(null);
    try {
      const res = await fetch("/api/billing/cancel", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      setCancelConfirmOpen(false);
      await load();
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : "Cancel failed");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: "#f8f5ef" }}>
      <AppHeader />

      <main className="max-w-3xl mx-auto px-6 py-10 md:py-12">
        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-black/85">
            Billing
          </h1>
          <p className="mt-2 text-[15px] text-black/55">
            Subscription, usage, and payment details for your workspace.
          </p>
        </header>

        {loadError && (
          <div className="rounded-xl border border-[#b34334]/30 bg-[#b34334]/5 p-4 text-[#b34334] text-sm mb-6">
            {loadError}
          </div>
        )}

        {!status && !loadError && (
          <div className="rounded-2xl bg-white border border-black/8 h-40 animate-pulse" />
        )}

        {status && (
          <div className="space-y-5">
            <CurrentPlanCard status={status} onOpenCancel={() => setCancelConfirmOpen(true)} />
            <UsageCard status={status} />
            {status.plan !== "operator" && <UpgradeCard status={status} />}
          </div>
        )}
      </main>

      {cancelConfirmOpen && status && (
        <CancelConfirmDialog
          plan={status.planLabel}
          periodEnd={status.billing.currentPeriodEnd}
          cancelling={cancelling}
          error={cancelError}
          onConfirm={handleCancel}
          onClose={() => { if (!cancelling) { setCancelConfirmOpen(false); setCancelError(null); } }}
        />
      )}
    </div>
  );
}

// ─── Current plan ──────────────────────────────────────────────────────────

function CurrentPlanCard({
  status,
  onOpenCancel,
}: {
  status: Status;
  onOpenCancel: () => void;
}) {
  const { plan, planLabel, pricePerMonthUSD, billing } = status;
  const hasSubscription = billing.hasSubscription;
  const cancellationPending = billing.cancelAtPeriodEnd;

  return (
    <div className="rounded-2xl bg-white border p-5 md:p-6" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
      <div className="text-[11px] uppercase tracking-[0.22em] font-semibold text-black/40">
        Current plan
      </div>
      <div className="mt-2 flex items-baseline gap-3 flex-wrap">
        <div
          className="text-3xl font-bold"
          style={{ fontFamily: "'Playfair Display', Georgia, serif", color: FOREST }}
        >
          {planLabel}
        </div>
        {plan !== "none" && (
          <div className="text-[14px] text-black/55 tabular-nums">
            ${pricePerMonthUSD} / month
          </div>
        )}
      </div>

      <div className="mt-4 space-y-1.5 text-[13.5px] text-black/60">
        {billing.currentPeriodEnd && (
          <Row
            label={cancellationPending ? "Access ends" : "Next renewal"}
            value={formatDate(billing.currentPeriodEnd)}
          />
        )}
        {billing.lastPaymentAt && (
          <Row label="Last payment" value={formatDate(billing.lastPaymentAt)} />
        )}
        {billing.processor && (
          <Row label="Paid via" value={billing.processor === "paystack" ? "Paystack" : billing.processor} />
        )}
      </div>

      {cancellationPending && (
        <div
          className="mt-4 rounded-lg px-3.5 py-2.5 text-[13px] leading-relaxed"
          style={{ background: "rgba(179,67,52,0.08)", color: "#7a2e23" }}
        >
          Cancellation scheduled — your plan runs until{" "}
          <strong>{billing.currentPeriodEnd ? formatDate(billing.currentPeriodEnd) : "the period end"}</strong>{" "}
          and will not renew.
        </div>
      )}

      {plan === "none" && (
        <div className="mt-4 text-[13px] text-black/55 leading-relaxed">
          You&apos;re on the trial / pilot tier. Pick a plan below to keep sending.
        </div>
      )}

      {hasSubscription && !cancellationPending && (
        <div className="mt-5 flex items-center gap-2">
          <button
            onClick={onOpenCancel}
            className="text-[13px] text-black/55 hover:text-[#b34334] transition px-3 py-1.5"
          >
            Cancel subscription
          </button>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="text-black/45">{label}</div>
      <div className="font-medium text-black/75">{value}</div>
    </div>
  );
}

// ─── Usage ─────────────────────────────────────────────────────────────────

function UsageCard({ status }: { status: Status }) {
  const { limits, usage, plan } = status;
  if (plan === "none") return null;

  const isUnlimited = !Number.isFinite(limits.proposalsPerMonth);
  const limit = Number.isFinite(limits.proposalsPerMonth) ? limits.proposalsPerMonth : 0;
  const pct = isUnlimited ? 0 : Math.min(100, Math.round((usage.proposalsThisWindow / Math.max(1, limit)) * 100));

  return (
    <div className="rounded-2xl bg-white border p-5 md:p-6" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
      <div className="text-[11px] uppercase tracking-[0.22em] font-semibold text-black/40">
        Usage this billing window
      </div>
      <div className="mt-3">
        <div className="flex items-baseline gap-2">
          <div className="text-2xl font-bold text-black/85 tabular-nums">
            {usage.proposalsThisWindow}
          </div>
          <div className="text-[14px] text-black/45">
            {isUnlimited ? "proposals · unlimited" : `of ${limit} proposals`}
          </div>
        </div>
        {!isUnlimited && (
          <div className="mt-2 h-1.5 rounded-full" style={{ background: "rgba(0,0,0,0.06)" }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${pct}%`,
                background: pct >= 90 ? "#b34334" : FOREST,
              }}
            />
          </div>
        )}
        <div className="mt-2 text-[11.5px] text-black/45">
          Window started {formatDate(usage.windowStart)}
        </div>
      </div>
    </div>
  );
}

// ─── Upgrade ───────────────────────────────────────────────────────────────

function UpgradeCard({ status }: { status: Status }) {
  const { plan } = status;

  // Offer only plans at or above the current one. Pricing page has the
  // full comparison; here we present the upgrade options inline.
  type PlanOption = {
    key: "consultant" | "explorer" | "operator";
    label: string;
    price: number;
    hint: string;
  };
  const allOptions: PlanOption[] = [
    { key: "consultant", label: "Consultant", price: 29, hint: "3 proposals / month · 1 seat" },
    { key: "explorer", label: "Explorer", price: 50, hint: "10 proposals / month · 1 seat" },
    { key: "operator", label: "Operator", price: 100, hint: "Unlimited · 5 seats · priority AI" },
  ];
  const order: Record<Status["plan"], number> = { none: 0, consultant: 1, explorer: 2, operator: 3 };
  const upgradeOptions = allOptions.filter((o) => order[o.key] > order[plan]);

  if (upgradeOptions.length === 0) return null;

  return (
    <div className="rounded-2xl border p-5 md:p-6" style={{
      background: "rgba(201,168,76,0.06)",
      borderColor: "rgba(201,168,76,0.4)",
    }}>
      <div className="text-[11px] uppercase tracking-[0.22em] font-semibold" style={{ color: "#8a7125" }}>
        {plan === "none" ? "Choose a plan" : "Upgrade"}
      </div>
      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {upgradeOptions.map((opt) => (
          <div key={opt.key} className="rounded-xl bg-white border p-4" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
            <div className="text-[10.5px] uppercase tracking-wider font-semibold" style={{ color: FOREST }}>
              {opt.label}
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-xl font-bold text-black/85 tabular-nums">${opt.price}</span>
              <span className="text-[12px] text-black/45">/ month</span>
            </div>
            <div className="mt-1 text-[12px] text-black/55">{opt.hint}</div>
            <CheckoutButton
              plan={opt.key}
              className="mt-3 w-full px-3 py-2 rounded-lg text-[13px] font-semibold transition active:scale-95"
              style={{ background: GOLD, color: FOREST }}
            >
              Start {opt.label}
            </CheckoutButton>
          </div>
        ))}
      </div>
      <div className="mt-4 text-[12px] text-black/50">
        <Link href="/pricing" className="hover:text-[#1b3a2d] transition">Full pricing comparison →</Link>
      </div>
    </div>
  );
}

// ─── Cancel confirmation ───────────────────────────────────────────────────

function CancelConfirmDialog({
  plan,
  periodEnd,
  cancelling,
  error,
  onConfirm,
  onClose,
}: {
  plan: string;
  periodEnd: string | null;
  cancelling: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden ss-modal-in"
        role="dialog"
      >
        <div className="px-6 py-5 border-b" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
          <div className="text-[10.5px] uppercase tracking-[0.22em] font-semibold" style={{ color: FOREST }}>
            Cancel subscription
          </div>
          <h3 className="text-lg font-bold text-black/85 mt-1" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            Cancel {plan}?
          </h3>
        </div>
        <div className="px-6 py-5 text-[14px] text-black/65 leading-relaxed space-y-3">
          <p>
            Your {plan} subscription will not auto-renew. You&apos;ll keep
            full access until{" "}
            <strong className="text-black/85">
              {periodEnd ? formatDate(periodEnd) : "the end of your current billing window"}
            </strong>
            .
          </p>
          <p className="text-[13px] text-black/50">
            You can resubscribe any time from this page.
          </p>
          {error && (
            <div className="rounded-lg px-3 py-2 text-[13px] text-[#7a2e23] bg-[#f4d7d0] border border-[#e3b5ac]">
              {error}
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t flex items-center justify-end gap-2" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
          <button
            onClick={onClose}
            disabled={cancelling}
            className="px-4 py-2 text-[13.5px] rounded-lg text-black/60 hover:bg-black/5 transition"
          >
            Keep subscription
          </button>
          <button
            onClick={onConfirm}
            disabled={cancelling}
            className="px-5 py-2 text-[13.5px] rounded-lg bg-[#b34334] text-white font-semibold hover:brightness-110 transition disabled:opacity-60"
          >
            {cancelling ? "Cancelling…" : "Cancel anyway"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
