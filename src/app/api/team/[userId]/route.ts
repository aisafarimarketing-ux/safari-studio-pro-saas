import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";

// /api/team/[userId] — per-member management.
//
// PATCH updates the target member's per-org profile fields:
//   - role (admin/owner only)
//   - roleTitle, profilePhotoUrl, signatureUrl, notificationPrefs
//     (self or admin/owner)
//
// DELETE removes the membership (admin/owner only). User record is kept —
// they might belong to other orgs. Cannot delete the last owner (must
// promote someone else first).

const VALID_ROLES = ["owner", "admin", "member"];

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ctx.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }

  const { userId } = await params;
  const isSelf = userId === ctx.user.id;
  const isAdmin = ctx.role === "admin" || ctx.role === "owner";

  // Members can only edit themselves; admins/owners can edit anyone.
  if (!isSelf && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const target = await prisma.orgMembership.findUnique({
    where: { userId_organizationId: { userId, organizationId: ctx.organization.id } },
  });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};

  // Role change — admin/owner only. Members can't promote themselves.
  if (typeof body.role === "string" && body.role !== target.role) {
    if (!isAdmin) return NextResponse.json({ error: "Only admins can change roles" }, { status: 403 });
    if (!VALID_ROLES.includes(body.role)) {
      return NextResponse.json({ error: `Invalid role: ${body.role}` }, { status: 400 });
    }
    // Can't demote the sole owner. The UI should prevent this, but
    // server-side is the source of truth.
    if (target.role === "owner" && body.role !== "owner") {
      const ownerCount = await prisma.orgMembership.count({
        where: { organizationId: ctx.organization.id, role: "owner" },
      });
      if (ownerCount <= 1) {
        return NextResponse.json(
          { error: "Can't demote the last owner — promote another member to owner first." },
          { status: 400 },
        );
      }
    }
    updates.role = body.role;
  }

  // Profile fields — self or admin.
  if (typeof body.roleTitle === "string") updates.roleTitle = body.roleTitle.trim() || null;
  if (typeof body.profilePhotoUrl === "string") updates.profilePhotoUrl = body.profilePhotoUrl.trim() || null;
  if (typeof body.signatureUrl === "string") updates.signatureUrl = body.signatureUrl.trim() || null;
  if (body.notificationPrefs !== undefined) {
    updates.notificationPrefs = body.notificationPrefs ?? Prisma.DbNull;
  }

  const membership = await prisma.orgMembership.update({
    where: { id: target.id },
    data: updates,
  });

  return NextResponse.json({ membership });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ctx.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }
  if (ctx.role !== "admin" && ctx.role !== "owner") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const { userId } = await params;
  const target = await prisma.orgMembership.findUnique({
    where: { userId_organizationId: { userId, organizationId: ctx.organization.id } },
  });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Can't remove the last owner.
  if (target.role === "owner") {
    const ownerCount = await prisma.orgMembership.count({
      where: { organizationId: ctx.organization.id, role: "owner" },
    });
    if (ownerCount <= 1) {
      return NextResponse.json(
        { error: "Can't remove the last owner — promote another member first." },
        { status: 400 },
      );
    }
  }

  await prisma.orgMembership.delete({ where: { id: target.id } });
  return NextResponse.json({ ok: true });
}

type PatchBody = {
  role?: string;
  roleTitle?: string;
  profilePhotoUrl?: string;
  signatureUrl?: string;
  notificationPrefs?: Record<string, unknown> | null;
};
