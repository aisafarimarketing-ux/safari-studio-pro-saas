import Link from "next/link";

// ─── /billing/success ──────────────────────────────────────────────────────
//
// Paystack redirects here after the customer completes the hosted checkout.
// We show a clean landing; the webhook (charge.success) is the source of
// truth for flipping the org's plan + currentPeriodEnd. By the time the
// user scans this page the webhook has typically already fired.
//
// We intentionally don't block on /verify here — if the network roundtrip
// is slower than the webhook, the dashboard will already show the new
// plan by the time they click through. If the webhook hasn't landed yet,
// /settings/billing will pick it up within 30-60s.

export const metadata = {
  title: "Welcome to Safari Studio — subscription active",
  robots: { index: false },
};

const FOREST = "#1b3a2d";
const FOREST_DEEP = "#142a20";
const GOLD = "#c9a84c";

export default function BillingSuccessPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: `linear-gradient(135deg, ${FOREST} 0%, ${FOREST_DEEP} 100%)` }}
    >
      <div className="max-w-md w-full text-center text-white">
        <div
          className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center text-[#c9a84c] text-3xl mb-6"
          style={{ background: "rgba(201,168,76,0.18)", border: "1px solid rgba(201,168,76,0.35)" }}
        >
          ✓
        </div>
        <div
          className="text-[11px] uppercase tracking-[0.24em] font-semibold"
          style={{ color: GOLD }}
        >
          Subscription active
        </div>
        <h1
          className="mt-4 text-3xl md:text-4xl font-bold tracking-tight"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          You&apos;re in.
        </h1>
        <p className="mt-5 text-white/65 leading-relaxed">
          Your subscription is live. Full access takes a few seconds to
          propagate — if anything looks locked when you arrive, refresh
          and it&apos;ll be there.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="px-7 py-3.5 rounded-xl text-[15px] font-semibold transition hover:brightness-110 active:scale-95"
            style={{ background: GOLD, color: FOREST }}
          >
            Open dashboard →
          </Link>
          <Link
            href="/settings/billing"
            className="px-5 py-3 rounded-xl text-[14px] text-white/75 hover:text-white transition border border-white/15"
          >
            Billing settings
          </Link>
        </div>
      </div>
    </div>
  );
}
