import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

// Shown when the caller's active organization has been suspended. Until the
// Stripe integration lands, the super admin manually suspends / reactivates
// orgs after payment. This page explains the state and gives the user
// contact avenues (and a sign-out escape hatch).

export default async function AccountSuspendedPage() {
  const { userId, orgId } = await auth();

  // Pull the suspension reason if the org has one — helpful context for
  // whoever's staring at this page.
  let reason: string | null = null;
  let since: Date | null = null;
  if (orgId) {
    const org = await prisma.organization.findUnique({
      where: { clerkOrgId: orgId },
      select: { suspendedReason: true, suspendedAt: true, status: true },
    });
    if (org?.status === "suspended") {
      reason = org.suspendedReason ?? null;
      since = org.suspendedAt ?? null;
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f5ef] px-6">
      <div className="max-w-md w-full text-center">
        <div
          className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center text-[#c9a84c] text-2xl font-bold mb-6"
          style={{ background: "rgba(201,168,76,0.15)" }}
        >
          ⏸
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-black/85" style={{ fontFamily: "'Playfair Display', serif" }}>
          Workspace on hold
        </h1>
        <p className="mt-4 text-[15px] text-black/60 leading-relaxed">
          Your Safari Studio workspace is temporarily paused. Your proposals
          and library are safe — once payment clears or the hold is lifted,
          everything picks up exactly where you left it.
        </p>
        {reason && (
          <div className="mt-6 p-4 rounded-xl bg-white border border-black/8 text-left">
            <div className="text-[11px] uppercase tracking-[0.2em] font-semibold text-black/40 mb-1">
              Reason
            </div>
            <div className="text-[13px] text-black/75">{reason}</div>
            {since && (
              <div className="text-[11px] text-black/40 mt-1">
                Paused on {new Date(since).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}
              </div>
            )}
          </div>
        )}
        <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
          <a
            href="mailto:hello@safaristudio.co?subject=Workspace%20reactivation"
            className="px-5 py-2.5 rounded-xl bg-[#1b3a2d] text-white text-sm font-semibold hover:bg-[#2d5a40] active:scale-95 transition"
          >
            Contact support
          </a>
          <Link
            href="/sign-in?redirect_url=/dashboard"
            className="px-5 py-2.5 rounded-xl border border-black/12 text-black/65 text-sm font-semibold hover:bg-black/5 active:scale-95 transition"
          >
            Sign out
          </Link>
        </div>
        {userId && (
          <div className="mt-10 text-[11px] text-black/30">
            user: {userId.slice(0, 12)}…
          </div>
        )}
      </div>
    </div>
  );
}
