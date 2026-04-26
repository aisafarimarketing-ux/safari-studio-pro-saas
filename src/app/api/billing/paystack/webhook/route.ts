import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyWebhookSignature } from "@/lib/billing/paystack";
import { triggerDepositPaid } from "@/lib/ghl/workflowEvents";

// ─── POST /api/billing/paystack/webhook ────────────────────────────────────
//
// Public endpoint called by Paystack when events occur. Signature is
// HMAC-SHA512 of the raw body using the merchant secret key. We verify
// before acting on anything.
//
// Events we care about:
//   charge.success            — successful payment (initial + every
//                               recurring renewal). Extends
//                               currentPeriodEnd by 30 days.
//   subscription.create       — the subscription object is born after
//                               the first successful charge. Carries
//                               subscription_code + email_token which
//                               we need to cancel it later.
//   subscription.disable      — subscription terminated (cancelled or
//                               terminal payment failure). Flip plan
//                               back to "none" after currentPeriodEnd.
//   invoice.payment_failed    — a renewal attempt failed. We leave the
//                               plan in place until Paystack gives up
//                               and fires subscription.disable.

type PaystackEvent = {
  event: string;
  data: Record<string, unknown>;
};

export async function POST(req: Request) {
  // Grab the raw body BEFORE JSON.parse — signature is computed on bytes.
  const rawBody = await req.text();
  const signature = req.headers.get("x-paystack-signature");

  if (!verifyWebhookSignature(rawBody, signature)) {
    console.warn("[paystack-webhook] bad signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let evt: PaystackEvent;
  try {
    evt = JSON.parse(rawBody) as PaystackEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    switch (evt.event) {
      case "charge.success":
        await handleChargeSuccess(evt.data);
        break;
      case "subscription.create":
        await handleSubscriptionCreate(evt.data);
        break;
      case "subscription.disable":
      case "subscription.not_renew":
        await handleSubscriptionDisable(evt.data);
        break;
      case "invoice.payment_failed":
        await handlePaymentFailed(evt.data);
        break;
      case "charge.failed":
        await handleDepositFailed(evt.data);
        break;
      default:
        // Unhandled event — Paystack retries on 5xx so we still 200.
        break;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[paystack-webhook] handler error:", evt.event, message);
    // Let Paystack retry on errors.
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// ─── Handlers ──────────────────────────────────────────────────────────────

type ChargeSuccessData = {
  reference?: string;
  status?: string;
  amount?: number;
  plan?: { plan_code?: string } | string | null;
  customer?: { customer_code?: string; email?: string };
  metadata?: { organizationId?: string; plan?: string };
  paid_at?: string;
};

async function handleChargeSuccess(data: Record<string, unknown>) {
  const d = data as ChargeSuccessData;
  if (d.status !== "success") return;

  // Deposit charges route differently — metadata.kind === "deposit"
  // targets the ProposalDeposit row; no subscription involved.
  const meta = (d.metadata ?? {}) as { kind?: string; depositId?: string; proposalId?: string };
  if (meta.kind === "deposit") {
    await handleDepositSuccess(d);
    return;
  }

  // Locate the org: prefer metadata.organizationId (reliable — we stamp
  // this on init); fall back to customer_code match if the webhook fires
  // for a renewal where metadata is absent.
  const org = await resolveOrg(d);
  if (!org) {
    console.warn("[charge.success] unmatched org; data:", JSON.stringify(d).slice(0, 300));
    return;
  }

  const plan = normalisePlan(d.metadata?.plan ?? null);
  const periodExtendsFrom = org.currentPeriodEnd && org.currentPeriodEnd > new Date()
    ? org.currentPeriodEnd
    : new Date();
  const newPeriodEnd = new Date(periodExtendsFrom);
  newPeriodEnd.setDate(newPeriodEnd.getDate() + 30);

  await prisma.organization.update({
    where: { id: org.id },
    data: {
      tier: "paid",
      plan: plan ?? org.plan,
      paymentProcessor: "paystack",
      paystackCustomerCode: d.customer?.customer_code ?? org.paystackCustomerCode,
      lastPaymentAt: d.paid_at ? new Date(d.paid_at) : new Date(),
      currentPeriodEnd: newPeriodEnd,
      // If they'd flagged cancelAtPeriodEnd before this charge, preserve
      // that — Paystack is mid-cancel.
      cancelAtPeriodEnd: org.cancelAtPeriodEnd,
      status: "active", // reactivate if they were suspended for non-payment
    },
  });
}

type SubscriptionCreateData = {
  subscription_code?: string;
  email_token?: string;
  customer?: { customer_code?: string; email?: string };
  plan?: { plan_code?: string };
};

async function handleSubscriptionCreate(data: Record<string, unknown>) {
  const d = data as SubscriptionCreateData;
  if (!d.subscription_code || !d.email_token) return;

  const org = await resolveOrg({ customer: d.customer });
  if (!org) {
    console.warn("[subscription.create] unmatched org");
    return;
  }

  await prisma.organization.update({
    where: { id: org.id },
    data: {
      paystackSubscriptionCode: d.subscription_code,
      paystackEmailToken: d.email_token,
      paystackCustomerCode: d.customer?.customer_code ?? org.paystackCustomerCode,
    },
  });
}

async function handleSubscriptionDisable(data: Record<string, unknown>) {
  const d = data as { subscription_code?: string };
  if (!d.subscription_code) return;

  const org = await prisma.organization.findFirst({
    where: { paystackSubscriptionCode: d.subscription_code },
  });
  if (!org) return;

  // Don't rip access away immediately — Paystack fires disable on the
  // final billing cycle. Access runs until currentPeriodEnd; after that
  // a scheduled job (not in this commit) demotes plan back to "none".
  await prisma.organization.update({
    where: { id: org.id },
    data: {
      cancelAtPeriodEnd: true,
    },
  });
}

// ─── Deposit handlers ──────────────────────────────────────────────────────
// Proposal-deposit charges are one-off (not subscriptions) and target
// the ProposalDeposit table instead of Organization.plan.

async function handleDepositSuccess(d: ChargeSuccessData) {
  const reference = d.reference;
  if (!reference) return;
  const deposit = await prisma.proposalDeposit.findUnique({
    where: { paystackReference: reference },
  });
  if (!deposit) {
    console.warn("[deposit.success] unknown reference:", reference);
    return;
  }
  if (deposit.status === "paid") return; // idempotent

  await prisma.proposalDeposit.update({
    where: { id: deposit.id },
    data: {
      status: "paid",
      paidAt: d.paid_at ? new Date(d.paid_at) : new Date(),
    },
  });

  // Fire-and-forget GHL `deposit_paid` workflow. No-op when GHL isn't
  // configured for the proposal's org. Failures land in IntegrationLog.
  void triggerDepositPaid(deposit.id);
}

async function handleDepositFailed(data: Record<string, unknown>) {
  const d = data as ChargeSuccessData;
  const reference = d.reference;
  if (!reference) return;
  await prisma.proposalDeposit.updateMany({
    where: { paystackReference: reference, status: "pending" },
    data: { status: "failed" },
  });
}

async function handlePaymentFailed(data: Record<string, unknown>) {
  const d = data as { subscription?: { subscription_code?: string } };
  const code = d.subscription?.subscription_code;
  if (!code) return;

  // We don't suspend on a single failed payment — Paystack retries. Log
  // it so the admin can see the org is in dunning.
  console.warn("[invoice.payment_failed] subscription in dunning:", code);
}

// ─── Helpers ───────────────────────────────────────────────────────────────

async function resolveOrg(d: { metadata?: { organizationId?: string }; customer?: { customer_code?: string } }) {
  if (d.metadata?.organizationId) {
    const org = await prisma.organization.findUnique({ where: { id: d.metadata.organizationId } });
    if (org) return org;
  }
  if (d.customer?.customer_code) {
    return prisma.organization.findFirst({ where: { paystackCustomerCode: d.customer.customer_code } });
  }
  return null;
}

function normalisePlan(v: string | null): "consultant" | "explorer" | "operator" | null {
  if (v === "consultant" || v === "explorer" || v === "operator") return v;
  return null;
}
