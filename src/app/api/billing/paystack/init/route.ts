import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { initTransaction, paystackSecretKey } from "@/lib/billing/paystack";
import { isValidPlanKey, PLANS, resolvePaystackPlanCode } from "@/lib/billing/plans";

// ─── POST /api/billing/paystack/init ───────────────────────────────────────
//
// Authed. Body: { plan: "consultant" | "explorer" | "operator" }.
// Starts a Paystack subscription by initialising a transaction against
// the Paystack plan_code mapped in env. Returns the hosted-checkout URL
// the client should redirect to.
//
// On successful checkout Paystack redirects back to /billing/success with
// ?reference=<code>. The webhook (charge.success / subscription.create)
// fires asynchronously and is the source of truth for flipping plan +
// currentPeriodEnd on the Organization row.

export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ctx.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }

  if (!paystackSecretKey()) {
    return NextResponse.json(
      { error: "Billing is not configured on this deployment. Ask the administrator to set PAYSTACK_SECRET_KEY." },
      { status: 503 },
    );
  }

  let body: { plan?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const plan = (body?.plan ?? "").toString().trim();
  if (!isValidPlanKey(plan)) {
    return NextResponse.json({ error: "plan must be consultant | explorer | operator" }, { status: 400 });
  }

  const planCode = resolvePaystackPlanCode(plan);
  if (!planCode) {
    return NextResponse.json(
      {
        error: `The ${plan} plan isn't configured yet — an administrator needs to set ${PLANS[plan].paystackPlanCodeEnv}.`,
      },
      { status: 503 },
    );
  }

  const email = ctx.user.email;
  if (!email) {
    return NextResponse.json(
      { error: "Your account is missing an email address. Add one in Clerk before subscribing." },
      { status: 400 },
    );
  }

  // callback_url — where Paystack redirects after the card form. The
  // success page verifies the reference and shows the operator a clean
  // landing, while the webhook (fired in parallel) updates persisted state.
  const origin = req.headers.get("origin") || `https://${req.headers.get("host") ?? "safaristudio.app"}`;
  const callbackUrl = `${origin}/billing/success`;

  try {
    const tx = await initTransaction({
      email,
      amountInCents: PLANS[plan].pricePerMonthCents,
      currency: "USD",
      planCode,
      callbackUrl,
      metadata: {
        organizationId: ctx.organization.id,
        userId: ctx.user.id,
        plan,
      },
    });

    // Track the pending transaction on the org so the success page can
    // confirm it belongs to this caller. Writing here is fine — webhook
    // is still the source of truth for plan + currentPeriodEnd.
    await prisma.organization.update({
      where: { id: ctx.organization.id },
      data: { paymentProcessor: "paystack" },
    });

    return NextResponse.json({
      authorizationUrl: tx.authorization_url,
      reference: tx.reference,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[billing/init] Paystack error:", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
