import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";

// GET /api/dashboard/reservations
//
// Returns ProposalReservation rows for the dashboard's "New Reservations"
// list. By default scoped to rows assigned to the calling user; owners
// and admins can pass `?scope=all` to see every reservation in the org.
//
//   ?scope = mine | all   (default: mine. "all" requires owner/admin.)
//   ?limit = N            (default 20, max 50)

export async function GET(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ctx.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }

  const url = new URL(req.url);
  const requestedScope = url.searchParams.get("scope") === "all" ? "all" : "mine";
  const canViewAll = ctx.role === "owner" || ctx.role === "admin";
  // Plain members can ask for ?scope=all but get silently downgraded to
  // "mine" — no need to 403 a UI toggle, and the API contract stays
  // honest about which rows the caller is actually seeing.
  const scope: "mine" | "all" = requestedScope === "all" && canViewAll ? "all" : "mine";

  const limitRaw = parseInt(url.searchParams.get("limit") ?? "", 10);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(50, limitRaw)) : 20;

  const reservations = await prisma.proposalReservation.findMany({
    where: {
      organizationId: ctx.organization.id,
      ...(scope === "mine" ? { assignedUserId: ctx.user.id } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      arrivalDate: true,
      departureDate: true,
      status: true,
      emailStatus: true,
      createdAt: true,
      proposal: { select: { id: true, title: true } },
      assignedUser: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({
    reservations: reservations.map((r) => ({
      id: r.id,
      clientName: `${r.firstName} ${r.lastName}`.trim() || "—",
      arrivalDate: r.arrivalDate.toISOString(),
      departureDate: r.departureDate.toISOString(),
      status: r.status,
      emailStatus: r.emailStatus,
      createdAt: r.createdAt.toISOString(),
      proposal: r.proposal ? { id: r.proposal.id, title: r.proposal.title ?? null } : null,
      assignedTo: r.assignedUser
        ? { id: r.assignedUser.id, name: r.assignedUser.name, email: r.assignedUser.email }
        : null,
    })),
    scope,
    canViewAll,
  });
}
