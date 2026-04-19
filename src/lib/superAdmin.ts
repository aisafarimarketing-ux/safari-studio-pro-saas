// Super admin identity check — gates /admin and the org-suspension API.
//
// Source of truth: SUPER_ADMIN_USER_IDS env var, comma-separated list of
// Clerk user ids (e.g. "user_2abc..., user_2def..."). No UI for granting
// super admin — it's an ops-level permission, not a product feature.

export function isSuperAdmin(clerkUserId: string | null | undefined): boolean {
  if (!clerkUserId) return false;
  const raw = process.env.SUPER_ADMIN_USER_IDS ?? "";
  const ids = raw.split(",").map((s) => s.trim()).filter(Boolean);
  return ids.includes(clerkUserId);
}
