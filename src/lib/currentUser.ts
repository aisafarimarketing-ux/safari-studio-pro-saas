import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { ensureDefaultLeadSources } from "@/lib/leadSources";
import type { Organization, OrgMembership, User } from "@prisma/client";

export type AuthContext = {
  user: User;
  organization: Organization | null;
  /** Per-user per-org membership row — carries role, signature, prefs.
   *  Null when the user is signed in but has no active org. Upserted
   *  alongside the User + Organization rows so every route sees it. */
  membership: OrgMembership | null;
  /** Convenience — one of: "owner" | "admin" | "member". "member" when no
   *  membership is resolved yet. Prefer this to reading membership.role
   *  directly because it collapses the null case. */
  role: "owner" | "admin" | "member";
  /** Quick gate for kill-switch checks. True when organization is present
   *  AND its status is "active". Suspended orgs get false. */
  orgActive: boolean;
};

/**
 * Resolve the caller's local User row (upserted on first call) plus the active
 * Organization row for their current Clerk session (also upserted on first
 * sight). Returns null when the request has no Clerk session.
 *
 * `organization` is null when the user is signed in but has not yet selected
 * or created an organization. API routes that require tenant scope should
 * 400/403 on that state; interactive pages should route the user to
 * /select-organization via middleware.
 */
export async function getAuthContext(): Promise<AuthContext | null> {
  const { userId, orgId } = await auth();
  if (!userId) return null;

  const cu = await currentUser();
  const email = cu?.emailAddresses?.[0]?.emailAddress ?? null;
  const name =
    [cu?.firstName, cu?.lastName].filter(Boolean).join(" ") || email || null;

  const user = await prisma.user.upsert({
    where: { clerkUserId: userId },
    create: { clerkUserId: userId, email, name },
    update: { email, name },
  });

  if (!orgId) return { user, organization: null, membership: null, role: "member", orgActive: false };

  // First-sight: hydrate name + slug from Clerk. Cheap because it only runs
  // the network call when we haven't seen this org before.
  let organization = await prisma.organization.findUnique({
    where: { clerkOrgId: orgId },
  });

  if (!organization) {
    let orgName: string | null = null;
    let orgSlug: string | null = null;
    try {
      const client = await clerkClient();
      const clerkOrg = await client.organizations.getOrganization({ organizationId: orgId });
      orgName = clerkOrg.name ?? null;
      orgSlug = clerkOrg.slug ?? null;
    } catch {
      // Fall through — we'll store null and the display name comes from Clerk's
      // client-side state. Later syncs can backfill.
    }

    organization = await prisma.organization.create({
      data: { clerkOrgId: orgId, name: orgName, slug: orgSlug },
    });

    // Seed the default lead-source taxonomy once per org. Non-fatal —
    // missing sources just show an empty dropdown until the operator adds
    // their own, so we don't block auth on a seed failure.
    try {
      await ensureDefaultLeadSources(organization.id);
    } catch (err) {
      console.warn("[currentUser] lead-source seed failed:", err);
    }
  }

  // Upsert the (user × org) membership. First member of a fresh org is
  // the owner by default; everyone else comes in as "member" and can be
  // promoted via Settings → Team. We never overwrite role on subsequent
  // calls — that would clobber admin changes.
  let membership = await prisma.orgMembership.findUnique({
    where: { userId_organizationId: { userId: user.id, organizationId: organization.id } },
  });
  if (!membership) {
    const memberCount = await prisma.orgMembership.count({
      where: { organizationId: organization.id },
    });
    membership = await prisma.orgMembership.create({
      data: {
        userId: user.id,
        organizationId: organization.id,
        role: memberCount === 0 ? "owner" : "member",
      },
    });
  }

  const role = (membership.role === "owner" || membership.role === "admin")
    ? (membership.role as "owner" | "admin")
    : "member";

  return {
    user,
    organization,
    membership,
    role,
    orgActive: organization.status === "active",
  };
}

/**
 * @deprecated Prefer getAuthContext — this wrapper is only kept so existing
 * callers can be migrated incrementally.
 */
export async function getOrCreateUser() {
  const ctx = await getAuthContext();
  return ctx?.user ?? null;
}
