import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";

// GET /api/me — the caller's own user + membership details.
// Returns everything a profile page needs (including the private fields
// notificationPrefs and signatureUrl that we intentionally don't leak
// on /api/team).

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ctx.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }

  return NextResponse.json({
    user: {
      id: ctx.user.id,
      name: ctx.user.name,
      email: ctx.user.email,
    },
    organization: {
      id: ctx.organization.id,
      name: ctx.organization.name,
      slug: ctx.organization.slug,
    },
    membership: ctx.membership
      ? {
          id: ctx.membership.id,
          role: ctx.membership.role,
          roleTitle: ctx.membership.roleTitle,
          profilePhotoUrl: ctx.membership.profilePhotoUrl,
          signatureUrl: ctx.membership.signatureUrl,
          notificationPrefs: ctx.membership.notificationPrefs,
        }
      : null,
    role: ctx.role,
  });
}
