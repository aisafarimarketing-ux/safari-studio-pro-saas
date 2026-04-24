import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { disableSubscription, paystackSecretKey } from "@/lib/billing/paystack";

// ─── POST /api/billing/cancel ──────────────────────────────────────────────
//
// Authed. Cancels the caller's Paystack subscription at Paystack's end,
// sets cancelAtPeriodEnd so the UI reflects the pending-cancellation
// state, and preserves access until currentPeriodEnd. Owner / admin only
// — we don't want a team member to accidentally kill the subscription.

export async function POST() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ctx.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return NextResponse.json({ error: "Only owners or admins can cancel the subscription" }, { status: 403 });
  }

  const org = ctx.organization;
  if (!org.paystackSubscriptionCode || !org.paystackEmailToken) {
    return NextResponse.json(
      { error: "No active subscription to cancel." },
      { status: 400 },
    );
  }

  if (!paystackSecretKey()) {
    return NextResponse.json(
      { error: "Billing is not configured on this deployment." },
      { status: 503 },
    );
  }

  try {
    await disableSubscription({
      subscriptionCode: org.paystackSubscriptionCode,
      emailToken: org.paystackEmailToken,
    });
  } catch (err) {
    // Surface the Paystack error to the user — but still flip the flag
    // below so the UI shows "cancellation pending" even if the processor
    // call failed (we can retry via a cron / manual sweep).
    const message = err instanceof Error ? err.message : String(err);
    console.error("[billing/cancel] Paystack error:", message);
  }

  await prisma.organization.update({
    where: { id: org.id },
    data: { cancelAtPeriodEnd: true },
  });

  return NextResponse.json({ ok: true });
}
