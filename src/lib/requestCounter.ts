import "server-only";
import { prisma } from "@/lib/prisma";

// Per-org per-year counter for the human-readable reference number a Request
// carries ("2026-0042"). Format mirrors the screenshots from the reference
// app — year + zero-padded sequence. Each org gets its own counter row per
// year so two orgs can issue "2026-0001" without collision and a fresh year
// starts the sequence over.
//
// Generation is atomic via an upsert + increment inside a single query so
// concurrent creates don't hand out duplicate numbers. We then read the
// post-increment value and format it.

export async function nextRequestReferenceNumber(organizationId: string): Promise<string> {
  const year = new Date().getFullYear();

  // Upsert atomically increments `value`. Prisma translates the `update`
  // branch's `{ value: { increment: 1 } }` into a single SQL UPDATE, so
  // concurrent callers end up with distinct values.
  const row = await prisma.requestCounter.upsert({
    where: { organizationId_year: { organizationId, year } },
    create: { organizationId, year, value: 1 },
    update: { value: { increment: 1 } },
    select: { value: true },
  });

  return `${year}-${String(row.value).padStart(4, "0")}`;
}
