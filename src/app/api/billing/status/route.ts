import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { PLANS, planLabel, planProposalLimit, planSeatLimit } from "@/lib/billing/plans";

// ─── GET /api/billing/status ───────────────────────────────────────────────
//
// Authed. Returns everything the /settings/billing page needs: current
// plan, plan limits, next renewal date, cancellation state, and the
// proposal count for the current billing window (so the UI can show
// "3 of 10 used this month").

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ctx.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }

  const org = ctx.organization;

  // Proposals created THIS billing window. We anchor the window to
  // currentPeriodEnd when present (aligns with charge cycles); fall back
  // to the calendar month when no subscription exists.
  const windowStart = windowStartFor(org.currentPeriodEnd);
  const proposalsInWindow = await prisma.proposal.count({
    where: {
      organizationId: org.id,
      createdAt: { gte: windowStart },
    },
  });

  const plan = (org.plan ?? "none") as keyof typeof PLANS | "none";
  const definition = plan === "none" ? null : PLANS[plan];

  return NextResponse.json({
    plan,
    planLabel: planLabel(plan),
    pricePerMonthUSD: definition?.pricePerMonthUSD ?? 0,
    limits: {
      proposalsPerMonth: planProposalLimit(plan),
      seats: planSeatLimit(plan),
    },
    usage: {
      proposalsThisWindow: proposalsInWindow,
      windowStart: windowStart.toISOString(),
    },
    lifecycle: {
      tier: org.tier,
      tierExpiresAt: org.tierExpiresAt?.toISOString() ?? null,
      status: org.status,
    },
    billing: {
      processor: org.paymentProcessor,
      currentPeriodEnd: org.currentPeriodEnd?.toISOString() ?? null,
      lastPaymentAt: org.lastPaymentAt?.toISOString() ?? null,
      cancelAtPeriodEnd: org.cancelAtPeriodEnd,
      hasSubscription: Boolean(org.paystackSubscriptionCode),
    },
  });
}

function windowStartFor(currentPeriodEnd: Date | null): Date {
  if (currentPeriodEnd) {
    const start = new Date(currentPeriodEnd);
    start.setDate(start.getDate() - 30);
    return start;
  }
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}
