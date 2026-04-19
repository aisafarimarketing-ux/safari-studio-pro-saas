import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { isSuperAdmin } from "@/lib/superAdmin";

// POST /api/admin/organizations/:id/status
//   Body: { status: "active" | "suspended", reason?: string }
//
// Flips an org between active and suspended. Suspension is the manual
// kill switch that gates access until payment clears. Super admin only
// — gated by SUPER_ADMIN_USER_IDS env var.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!isSuperAdmin(userId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const status = body.status === "suspended" ? "suspended"
    : body.status === "active" ? "active"
    : null;
  if (!status) {
    return NextResponse.json({ error: "status must be 'active' or 'suspended'" }, { status: 400 });
  }
  const reason = typeof body.reason === "string" ? body.reason.trim() || null : null;

  const { id } = await ctx.params;
  const existing = await prisma.organization.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.organization.update({
    where: { id },
    data: {
      status,
      suspendedAt: status === "suspended" ? new Date() : null,
      suspendedReason: status === "suspended" ? reason : null,
    },
  });
  return NextResponse.json({ ok: true, organization: updated });
}
