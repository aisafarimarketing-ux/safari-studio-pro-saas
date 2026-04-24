import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { initTransaction, paystackSecretKey } from "@/lib/billing/paystack";
import { nanoid } from "@/lib/nanoid";
import type { DepositConfig, Proposal } from "@/lib/types";

// ─── POST /api/public/proposals/:id/deposit/init ───────────────────────────
//
// Unauthenticated — the caller is the end-client, not the operator.
// Safe because anyone with a proposal id already has full read access
// via /api/public/proposals/:id; letting them pay a deposit changes
// nothing about the information-theoretic surface.
//
// Body: { payerName, payerEmail, termsAccepted?: boolean }.
// Returns: { authorizationUrl } pointing at the Paystack hosted checkout.

type Body = {
  payerName?: string;
  payerEmail?: string;
  termsAccepted?: boolean;
};

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  if (!paystackSecretKey()) {
    return NextResponse.json(
      { error: "Deposit payments aren't configured on this deployment." },
      { status: 503 },
    );
  }

  const row = await prisma.proposal.findUnique({
    where: { id },
    select: { id: true, contentJson: true },
  });
  if (!row) return NextResponse.json({ error: "Proposal not found" }, { status: 404 });

  const proposal = row.contentJson as Proposal | null;
  const config = proposal?.depositConfig;
  if (!config?.enabled) {
    return NextResponse.json({ error: "Deposits are not enabled for this proposal." }, { status: 400 });
  }
  const amountInCents = parseAmountToCents(config.amount);
  if (!amountInCents || amountInCents < 100) {
    return NextResponse.json(
      { error: "The operator hasn't set a valid deposit amount. Ask them to adjust." },
      { status: 400 },
    );
  }
  const currency = (config.currency || "USD").toUpperCase();

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const payerEmail = (body.payerEmail ?? "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(payerEmail)) {
    return NextResponse.json({ error: "A valid email is required to pay." }, { status: 400 });
  }
  const payerName = (body.payerName ?? "").toString().trim().slice(0, 120) || null;

  // If terms were shown (termsUrl present) the client must explicitly
  // accept. If not, we still record no-terms pathway for the audit.
  const termsShown = Boolean(config.termsUrl);
  if (termsShown && body.termsAccepted !== true) {
    return NextResponse.json(
      { error: "Please agree to the terms before paying." },
      { status: 400 },
    );
  }

  // Paystack-friendly reference — prefix for grep-ability in their dashboard.
  const reference = `dep_${id.slice(0, 8)}_${nanoid().slice(0, 10)}`;

  const deposit = await prisma.proposalDeposit.create({
    data: {
      proposalId: id,
      payerName,
      payerEmail,
      amountInCents,
      currency,
      processor: "paystack",
      paystackReference: reference,
      status: "pending",
      termsAcceptedAt: termsShown ? new Date() : null,
      termsAcceptedText: termsShown && config.termsUrl
        ? `Agreed to terms at ${config.termsUrl}`
        : null,
    },
  });

  const origin = req.headers.get("origin") || `https://${req.headers.get("host") ?? "safaristudio.app"}`;

  try {
    const tx = await initTransaction({
      email: payerEmail,
      amountInCents,
      currency: currency as "USD" | "KES" | "NGN" | "GHS" | "ZAR",
      callbackUrl: `${origin}/p/${id}/deposit-success?ref=${encodeURIComponent(reference)}`,
      reference,
      metadata: {
        kind: "deposit",
        proposalId: id,
        depositId: deposit.id,
        payerName,
      },
    });
    return NextResponse.json({ authorizationUrl: tx.authorization_url, reference });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[deposit/init] Paystack error:", message);
    // Mark the deposit as abandoned so it doesn't stick around as "pending" forever
    await prisma.proposalDeposit.update({
      where: { id: deposit.id },
      data: { status: "abandoned" },
    });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

function parseAmountToCents(amount: string): number {
  const cleaned = amount.replace(/[^0-9.]/g, "");
  const parsed = parseFloat(cleaned);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.round(parsed * 100);
}
