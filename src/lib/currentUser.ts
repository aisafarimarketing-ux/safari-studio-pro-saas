import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

/**
 * Returns the local User row for the current Clerk user, upserting on first
 * call so proposal foreign keys always resolve. Returns null when no session.
 */
export async function getOrCreateUser() {
  const { userId } = await auth();
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
  return user;
}
