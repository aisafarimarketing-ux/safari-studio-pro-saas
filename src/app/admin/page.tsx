import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { isSuperAdmin } from "@/lib/superAdmin";
import { AdminOrgRow } from "./AdminOrgRow";

// Super admin console — the manual kill-switch that stands in for billing
// until Stripe lands. Access gated by SUPER_ADMIN_USER_IDS (env), enforced
// at both page-render time and inside the underlying API route.

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const { userId } = await auth();
  if (!isSuperAdmin(userId)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f5ef] px-6">
        <div className="max-w-md text-center">
          <div className="text-h2 font-bold text-black/85" style={{ fontFamily: "'Playfair Display', serif" }}>
            Nothing here
          </div>
          <p className="mt-3 text-body text-black/55">
            This page is reserved for Safari Studio administrators.
          </p>
          <Link
            href="/dashboard"
            className="inline-block mt-6 px-4 py-2 rounded-lg bg-[#1b3a2d] text-white text-sm font-semibold hover:bg-[#2d5a40] transition"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  const orgs = await prisma.organization.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      _count: { select: { proposals: true, properties: true } },
    },
  });

  const active = orgs.filter((o) => o.status === "active").length;
  const suspended = orgs.filter((o) => o.status === "suspended").length;

  return (
    <div className="min-h-screen bg-[#f8f5ef]">
      <header className="h-14 border-b border-black/10 bg-white flex items-center justify-between px-6 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-sm text-black/40 hover:text-black/70 transition">
            ← Dashboard
          </Link>
          <span className="text-black/15">/</span>
          <span className="text-sm font-semibold text-black/80">Admin</span>
        </div>
        <span className="text-label ed-label" style={{ color: "#c9a84c" }}>
          Super admin
        </span>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="text-h1 font-bold tracking-tight text-black/85" style={{ fontFamily: "'Playfair Display', serif" }}>
          Organizations
        </h1>
        <p className="mt-2 text-small text-black/55">
          Manual account control. {active} active · {suspended} suspended.
        </p>

        <div className="mt-8 bg-white rounded-2xl border border-black/8 overflow-hidden">
          <div className="grid grid-cols-[1.2fr_1fr_0.6fr_0.6fr_auto] gap-3 px-5 py-3 border-b border-black/8 text-label ed-label" style={{ color: "rgba(0,0,0,0.4)" }}>
            <div>Organization</div>
            <div>Clerk id</div>
            <div className="text-right tabular-nums">Proposals</div>
            <div className="text-right tabular-nums">Properties</div>
            <div className="text-right pl-3">Status</div>
          </div>
          {orgs.length === 0 && (
            <div className="px-5 py-10 text-center text-small text-black/40">
              No organizations yet.
            </div>
          )}
          <ul className="divide-y divide-black/6">
            {orgs.map((org) => (
              <li key={org.id}>
                <AdminOrgRow
                  id={org.id}
                  name={org.name ?? "(unnamed)"}
                  clerkOrgId={org.clerkOrgId}
                  status={org.status}
                  suspendedReason={org.suspendedReason}
                  proposalCount={org._count.proposals}
                  propertyCount={org._count.properties}
                />
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-6 text-label text-black/35" style={{ textTransform: "none", letterSpacing: "0", fontWeight: 400 }}>
          Suspending an organization freezes its API access immediately. Users will see the &ldquo;Workspace on hold&rdquo; page next time they load the app.
        </p>
      </main>
    </div>
  );
}
