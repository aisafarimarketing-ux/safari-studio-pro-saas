import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { getAuthContext } from "@/lib/currentUser";

// ─── /api/team/invitations ───────────────────────────────────────────────
//
// Owner / admin only. Wraps Clerk's organization invitation API so the
// in-app team settings page can list / resend / revoke pending invites
// without bouncing the operator to Clerk's hosted dashboard.
//
// GET   → list pending invitations for the active org
// POST  → resend an invitation by id (Clerk has no native resend, so we
//         revoke + recreate using the same email + role)
//
// Why not "copy invite link"?
//   Clerk's API doesn't expose the acceptance URL — it's generated when
//   the invitation email is sent and includes a signed token only
//   present in the email body. To support copy-link we'd have to rebuild
//   the entire invite flow with our own ticketing. The Custom SMTP fix
//   (Clerk → Resend) makes the email actually arrive, which is the
//   underlying problem.

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ctx.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return NextResponse.json(
      { error: "Owner or admin required" },
      { status: 403 },
    );
  }

  try {
    const client = await clerkClient();
    const list = await client.organizations.getOrganizationInvitationList({
      organizationId: ctx.organization.clerkOrgId,
      status: ["pending"],
    });

    // The SDK returns either a plain array or a paginated wrapper
    // depending on version — normalise so consumers see one shape.
    const data = Array.isArray(list) ? list : list.data ?? [];
    const invitations = data.map((inv) => ({
      id: inv.id,
      emailAddress: inv.emailAddress,
      role: inv.role,
      status: inv.status,
      createdAt: inv.createdAt,
    }));

    return NextResponse.json({ invitations });
  } catch (err) {
    console.warn("[team/invitations] list failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load invitations" },
      { status: 500 },
    );
  }
}

// POST /api/team/invitations — body: { invitationId }
//
// "Resend" via revoke + create with the same email + role. Same
// effect as clicking Resend in Clerk's hosted UI. The new invitation
// fires a fresh email through whatever email path Clerk is configured
// for (their default sender, or your Resend SMTP if you've set up
// Custom SMTP).
export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ctx.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return NextResponse.json(
      { error: "Owner or admin required" },
      { status: 403 },
    );
  }

  let body: { invitationId?: string };
  try {
    body = (await req.json()) as { invitationId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const invitationId = body.invitationId?.trim();
  if (!invitationId) {
    return NextResponse.json({ error: "invitationId required" }, { status: 400 });
  }

  try {
    const client = await clerkClient();
    // Read the existing invite first so we can recreate with the same
    // email + role.
    const list = await client.organizations.getOrganizationInvitationList({
      organizationId: ctx.organization.clerkOrgId,
      status: ["pending"],
    });
    const data = Array.isArray(list) ? list : list.data ?? [];
    const existing = data.find((inv) => inv.id === invitationId);
    if (!existing) {
      return NextResponse.json(
        { error: "Invitation not found or already processed" },
        { status: 404 },
      );
    }

    // Revoke the old one first so the recipient doesn't end up with
    // two pending invites in Clerk's records.
    await client.organizations.revokeOrganizationInvitation({
      organizationId: ctx.organization.clerkOrgId,
      invitationId,
      requestingUserId: ctx.user.clerkUserId,
    });

    const fresh = await client.organizations.createOrganizationInvitation({
      organizationId: ctx.organization.clerkOrgId,
      inviterUserId: ctx.user.clerkUserId,
      emailAddress: existing.emailAddress,
      role: existing.role,
    });

    return NextResponse.json({
      ok: true,
      invitation: {
        id: fresh.id,
        emailAddress: fresh.emailAddress,
        role: fresh.role,
        status: fresh.status,
        createdAt: fresh.createdAt,
      },
    });
  } catch (err) {
    console.warn("[team/invitations] resend failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to resend invitation" },
      { status: 500 },
    );
  }
}
