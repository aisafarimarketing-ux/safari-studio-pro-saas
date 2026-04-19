import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import type { Organization, User } from "@prisma/client";

export type AuthContext = {
  user: User;
  organization: Organization | null;
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

  if (!orgId) return { user, organization: null, orgActive: false };

  // First-sight: hydrate name + slug from Clerk. Cheap because it only runs
  // the network call when we haven't seen this org before.
  const existing = await prisma.organization.findUnique({
    where: { clerkOrgId: orgId },
  });
  if (existing) return { user, organization: existing, orgActive: existing.status === "active" };

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

  const organization = await prisma.organization.create({
    data: { clerkOrgId: orgId, name: orgName, slug: orgSlug },
  });
  return { user, organization, orgActive: organization.status === "active" };
}

/**
 * @deprecated Prefer getAuthContext — this wrapper is only kept so existing
 * callers can be migrated incrementally.
 */
export async function getOrCreateUser() {
  const ctx = await getAuthContext();
  return ctx?.user ?? null;
}
