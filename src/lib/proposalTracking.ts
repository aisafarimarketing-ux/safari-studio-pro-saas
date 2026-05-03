import "server-only";
import { prisma } from "@/lib/prisma";
import type { PrismaClient } from "@prisma/client";

// Per-org per-year counter for the human-readable Proposal tracking id.
// Mirrors RequestCounter / nextRequestReferenceNumber so two orgs can
// issue "PRO-2026-0001" without collision and a fresh year resets.
//
// Format: "PRO-{year}-{value:04d}", e.g. "PRO-2026-0042".
//
// Generation is atomic via an upsert + increment so concurrent creates
// can never hand out duplicate numbers.

type Tx = PrismaClient | Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

export async function nextProposalTrackingId(
  organizationId: string,
  client: Tx = prisma,
): Promise<string> {
  const year = new Date().getFullYear();

  const row = await client.proposalCounter.upsert({
    where: { organizationId_year: { organizationId, year } },
    create: { organizationId, year, value: 1 },
    update: { value: { increment: 1 } },
    select: { value: true },
  });

  return formatTrackingId(year, row.value);
}

export function formatTrackingId(year: number, value: number): string {
  return `PRO-${year}-${String(value).padStart(4, "0")}`;
}

// Stable display label for a proposal. Prefers the persisted trackingId
// when present; falls back to the last 8 chars of the id (the legacy
// "tracking id" format used in the reservation email subject before
// the proper field landed) so legacy proposals keep working without
// a backfill.
export function displayTrackingId(proposal: { id: string; trackingId?: string | null }): string {
  if (proposal.trackingId && proposal.trackingId.trim().length > 0) {
    return proposal.trackingId;
  }
  return proposal.id.slice(-8).toUpperCase();
}
