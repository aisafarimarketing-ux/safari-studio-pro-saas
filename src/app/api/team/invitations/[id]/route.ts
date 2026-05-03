import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { getAuthContext } from "@/lib/currentUser";

// DELETE /api/team/invitations/[id]
//
// Revokes a pending Clerk org invitation. Owner / admin only.
// Wraps clerkClient.organizations.revokeOrganizationInvitation so the
// in-app team settings page can manage invites without bouncing out
// to Clerk's hosted dashboard.

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!auth.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }
  if (auth.role !== "owner" && auth.role !== "admin") {
    return NextResponse.json(
      { error: "Owner or admin required" },
      { status: 403 },
    );
  }

  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "Invitation id required" }, { status: 400 });
  }

  try {
    const client = await clerkClient();
    await client.organizations.revokeOrganizationInvitation({
      organizationId: auth.organization.clerkOrgId,
      invitationId: id,
      requestingUserId: auth.user.clerkUserId,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.warn("[team/invitations] revoke failed:", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to revoke invitation",
      },
      { status: 500 },
    );
  }
}
