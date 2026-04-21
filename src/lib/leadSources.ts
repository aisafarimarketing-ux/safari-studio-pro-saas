import "server-only";
import { prisma } from "@/lib/prisma";

// Default lead-source taxonomy every new organisation starts with. Operators
// can add / archive / reorder in Settings → Lead Sources. Mirrors what the
// reference app uses (SafariBookings, TripAdvisor, Website, Referral, …)
// plus a catch-all "Unknown" so legacy imports have somewhere to land.

const DEFAULT_LEAD_SOURCES: string[] = [
  "SafariBookings",
  "TripAdvisor",
  "Website",
  "Referral",
  "Direct email",
  "Trade show",
  "Social media",
  "Other",
  "Unknown",
];

/**
 * Idempotent seed — inserts only the names that don't already exist for the
 * org. Safe to call on every org-first-sight.
 */
export async function ensureDefaultLeadSources(organizationId: string): Promise<void> {
  const existing = await prisma.leadSource.findMany({
    where: { organizationId },
    select: { name: true },
  });
  const have = new Set(existing.map((s) => s.name));
  const missing = DEFAULT_LEAD_SOURCES.filter((n) => !have.has(n));
  if (missing.length === 0) return;

  await prisma.leadSource.createMany({
    data: missing.map((name, idx) => ({
      organizationId,
      name,
      sortOrder: idx,
    })),
    skipDuplicates: true,
  });
}
