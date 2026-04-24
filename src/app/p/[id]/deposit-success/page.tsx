import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

// ─── /p/[id]/deposit-success ───────────────────────────────────────────────
//
// Paystack redirects here after a successful hosted-checkout payment for
// a proposal deposit. Public — no auth. We look up the deposit row by
// reference to show a clean confirmation with the amount paid. The
// webhook flips status to "paid" in parallel; if this page arrives
// first we just show the pending state and reload.

export const metadata = {
  title: "Deposit received — Safari Studio",
  robots: { index: false },
};

const FOREST = "#1b3a2d";
const FOREST_DEEP = "#142a20";
const GOLD = "#c9a84c";

export default async function DepositSuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ref?: string }>;
}) {
  const { id } = await params;
  const { ref } = await searchParams;
  if (!ref) notFound();

  const deposit = await prisma.proposalDeposit.findUnique({
    where: { paystackReference: ref },
    select: {
      id: true,
      proposalId: true,
      amountInCents: true,
      currency: true,
      status: true,
      payerName: true,
    },
  });
  if (!deposit || deposit.proposalId !== id) notFound();

  const amountPretty = (deposit.amountInCents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  const isPaid = deposit.status === "paid";

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
          {isPaid ? "✓" : "…"}
        </div>
        <div className="text-[11px] uppercase tracking-[0.24em] font-semibold" style={{ color: GOLD }}>
          {isPaid ? "Deposit received" : "Processing payment"}
        </div>
        <h1
          className="mt-4 text-3xl md:text-4xl font-bold tracking-tight"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          {isPaid ? "Thank you." : "Just a moment…"}
        </h1>
        <p className="mt-5 text-white/65 leading-relaxed">
          {isPaid ? (
            <>
              Your {deposit.currency} {amountPretty} deposit has been
              received{deposit.payerName ? `, ${deposit.payerName}` : ""}.
              Your safari operator will be in touch shortly to confirm
              next steps.
            </>
          ) : (
            <>
              Your payment is being confirmed. This usually takes a few
              seconds. Refresh this page in a moment to see the
              confirmation.
            </>
          )}
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href={`/p/${id}`}
            className="px-7 py-3.5 rounded-xl text-[15px] font-semibold transition hover:brightness-110 active:scale-95"
            style={{ background: GOLD, color: FOREST }}
          >
            ← Back to proposal
          </Link>
        </div>
      </div>
    </div>
  );
}
