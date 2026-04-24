import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ─── GET /api/cron/billing-grace ───────────────────────────────────────────
//
// Daily job that demotes organisations whose subscription has expired.
// Two classes of org handled:
//
//   (1) cancelAtPeriodEnd = true AND currentPeriodEnd < now
//       The operator explicitly cancelled; their paid window has closed.
//       Flip plan back to "none", clear processor linkage, record the
//       downgrade on tierNote so super-admins can trace it.
//
//   (2) currentPeriodEnd < (now - 7d) AND plan != "none"
//       Safety net: Paystack's subscription.disable webhook should have
//       fired on terminal payment failure, but if our endpoint was down
//       when it did, a stale paid plan can linger. After a 7-day buffer
//       past the last successful charge window, we demote.
//
// Auth shares the CRON_SECRET pattern with /api/cron/overdue.

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const auth = req.headers.get("authorization") ?? "";
  const provided = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const bufferCutoff = new Date(now);
  bufferCutoff.setDate(bufferCutoff.getDate() - 7);

  // (1) Explicit cancels whose window closed
  const cancelled = await prisma.organization.findMany({
    where: {
      cancelAtPeriodEnd: true,
      currentPeriodEnd: { lt: now },
      plan: { not: "none" },
    },
    select: { id: true, name: true, plan: true },
  });

  // (2) Stale paid plans — subscription.disable webhook likely missed
  const stale = await prisma.organization.findMany({
    where: {
      cancelAtPeriodEnd: false,
      currentPeriodEnd: { lt: bufferCutoff },
      plan: { not: "none" },
    },
    select: { id: true, name: true, plan: true },
  });

  const toDemote = [...cancelled, ...stale];
  if (toDemote.length === 0) {
    return NextResponse.json({ demoted: 0 });
  }

  for (const org of toDemote) {
    await prisma.organization.update({
      where: { id: org.id },
      data: {
        plan: "none",
        tier: "trial", // drop back to default lifecycle
        cancelAtPeriodEnd: false,
        paystackSubscriptionCode: null,
        paystackEmailToken: null,
        tierNote: `Auto-demoted ${now.toISOString().slice(0, 10)} from ${org.plan}`,
      },
    });
  }

  return NextResponse.json({
    demoted: toDemote.length,
    ids: toDemote.map((o) => o.id),
  });
}
