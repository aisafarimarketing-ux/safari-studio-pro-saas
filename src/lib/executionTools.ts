import "server-only";
import { prisma } from "@/lib/prisma";
import type { Day, Proposal } from "@/lib/types";

// ─── Execution AI — deterministic tool layer ────────────────────────────────
//
// The Execution AI's contract: AI parses operator commands into a typed
// intent; this module retrieves data from the operator's organization
// and never invents content. Every function here is org-scoped at the
// query level — a bug in this layer is a security incident, so each
// function takes organizationId explicitly and uses it in the WHERE
// clause. No call site is allowed to pass it through unchecked auth
// context: it must be the verified ctx.organization.id from
// getAuthContext().
//
// Discriminated unions for ambiguity:
//   findClient → "found" | "ambiguous" | "not-found"
//   loadLatestProposal → "found" | "not-found"
//   extractDays → "ok" | "missing-days"
//
// Callers handle each branch explicitly — there's no silent fallback
// to "first match" or "closest day". Ambiguity surfaces to the
// operator for confirmation.

export type ClientLite = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
  fullName: string;
  /** Most recent proposal title for display in the disambiguation
   *  picker — helps the operator tell two "Jennifers" apart. Null when
   *  no proposal has been linked yet. */
  latestProposalTitle: string | null;
  latestProposalUpdatedAt: string | null;
};

export type FindClientResult =
  | { status: "found"; client: ClientLite }
  | { status: "ambiguous"; matches: ClientLite[] }
  | { status: "not-found"; hint: string };

// Case-insensitive lookup against firstName, lastName, email, and the
// concatenated full name. We deliberately avoid fuzzy matching
// (Levenshtein etc.) — the spec calls for fail-loud over guess-silent.
// Multiple matches get bubbled up as "ambiguous" so the operator picks.
export async function findClient(
  organizationId: string,
  hint: string,
): Promise<FindClientResult> {
  const trimmed = hint.trim();
  if (!trimmed) return { status: "not-found", hint: "(empty hint)" };

  const candidates = await prisma.client.findMany({
    where: {
      organizationId,
      OR: [
        { firstName: { contains: trimmed, mode: "insensitive" } },
        { lastName: { contains: trimmed, mode: "insensitive" } },
        { email: { contains: trimmed, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      proposals: {
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: { title: true, updatedAt: true },
      },
    },
    take: 6, // cap so a generic hint can't fan out
  });

  // Score: exact firstName match wins over substring; substring of
  // firstName beats substring of email. Used only to break ties when
  // there's a clear "best" match; otherwise we still return ambiguous.
  const scored = candidates
    .map((c) => {
      const fullName = [c.firstName, c.lastName].filter(Boolean).join(" ").trim();
      const lc = trimmed.toLowerCase();
      const firstLower = (c.firstName ?? "").toLowerCase();
      const lastLower = (c.lastName ?? "").toLowerCase();
      let score = 0;
      if (firstLower === lc) score += 100;
      if (lastLower === lc) score += 90;
      if (fullName.toLowerCase() === lc) score += 95;
      if (firstLower.startsWith(lc)) score += 60;
      if (lastLower.startsWith(lc)) score += 55;
      if (firstLower.includes(lc)) score += 30;
      if (lastLower.includes(lc)) score += 25;
      if (c.email.toLowerCase().includes(lc)) score += 10;
      const lite: ClientLite = {
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        email: c.email,
        phone: c.phone,
        fullName: fullName || c.email,
        latestProposalTitle: c.proposals[0]?.title ?? null,
        latestProposalUpdatedAt:
          c.proposals[0]?.updatedAt?.toISOString() ?? null,
      };
      return { lite, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return { status: "not-found", hint: trimmed };
  }
  if (scored.length === 1) {
    return { status: "found", client: scored[0].lite };
  }
  // If the top score is meaningfully ahead AND that top is an exact
  // first-name or full-name match, pick it. Otherwise surface the picker.
  // This handles the case "send Jennifer" with one Jennifer and one
  // Jenn-marie without forcing a picker every time. The threshold is
  // intentionally conservative — we'd rather ask than auto-pick.
  const top = scored[0];
  const second = scored[1];
  const exactMatch = top.score >= 95;
  const decisivelyAhead = top.score >= second.score + 40;
  if (exactMatch && decisivelyAhead) {
    return { status: "found", client: top.lite };
  }
  return {
    status: "ambiguous",
    matches: scored.slice(0, 5).map((r) => r.lite),
  };
}

// Direct fetch by id — used after the operator picks from the
// disambiguation list. Org-scoped so a client.id from another org
// can't be passed in by a malicious caller.
export async function findClientById(
  organizationId: string,
  clientId: string,
): Promise<FindClientResult> {
  const c = await prisma.client.findFirst({
    where: { id: clientId, organizationId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      proposals: {
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: { title: true, updatedAt: true },
      },
    },
  });
  if (!c) return { status: "not-found", hint: clientId };
  const fullName = [c.firstName, c.lastName].filter(Boolean).join(" ").trim();
  return {
    status: "found",
    client: {
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      email: c.email,
      phone: c.phone,
      fullName: fullName || c.email,
      latestProposalTitle: c.proposals[0]?.title ?? null,
      latestProposalUpdatedAt:
        c.proposals[0]?.updatedAt?.toISOString() ?? null,
    },
  };
}

// ─── Proposal loading ───────────────────────────────────────────────────────
//
// Picks the most recent proposal for a given client within the org.
// We could disambiguate here too if a client has multiple active
// proposals, but for v1 the most-recent rule is decisive enough — we
// surface the proposal title in the preview so the operator can spot
// a wrong pick. Multi-proposal disambiguation is a clean v2 addition.

export type LoadedProposal = {
  id: string;
  title: string;
  trackingId: string | null;
  contentJson: Proposal;
  updatedAt: string;
};

export type LoadProposalResult =
  | { status: "found"; proposal: LoadedProposal }
  | { status: "not-found"; clientId: string };

export async function loadLatestProposal(
  organizationId: string,
  clientId: string,
): Promise<LoadProposalResult> {
  const row = await prisma.proposal.findFirst({
    where: { organizationId, clientId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      trackingId: true,
      contentJson: true,
      updatedAt: true,
    },
  });
  if (!row) return { status: "not-found", clientId };
  return {
    status: "found",
    proposal: {
      id: row.id,
      title: row.title ?? "Untitled proposal",
      trackingId: row.trackingId ?? null,
      contentJson: row.contentJson as unknown as Proposal,
      updatedAt: row.updatedAt.toISOString(),
    },
  };
}

// ─── Day extraction ─────────────────────────────────────────────────────────
//
// Given a loaded Proposal and the requested day numbers, return the
// matching Day rows in order. Missing day numbers fail loud — the
// operator gets a clear "Day 8 doesn't exist on this 5-day proposal"
// instead of a partial send.

export type ExtractDaysResult =
  | { status: "ok"; days: Day[]; warnings: string[] }
  | { status: "missing-days"; missing: number[]; available: number };

export function extractDays(
  proposal: LoadedProposal,
  requestedDays: number[],
): ExtractDaysResult {
  const allDays = Array.isArray(proposal.contentJson?.days)
    ? proposal.contentJson.days
    : [];
  const dedupedRequest = Array.from(new Set(requestedDays.filter((n) => Number.isInteger(n) && n > 0))).sort((a, b) => a - b);
  if (dedupedRequest.length === 0) {
    return { status: "missing-days", missing: requestedDays, available: allDays.length };
  }

  const found: Day[] = [];
  const missing: number[] = [];
  for (const n of dedupedRequest) {
    const day = allDays.find((d) => d.dayNumber === n);
    if (day) found.push(day);
    else missing.push(n);
  }
  if (missing.length > 0) {
    return { status: "missing-days", missing, available: allDays.length };
  }

  // Surface "this looks incomplete" warnings — operator sees them
  // before sending. We don't fail; an operator drafting a proposal
  // may want to send a placeholder day to a client for input.
  const warnings: string[] = [];
  for (const d of found) {
    const narrative = (d.description ?? "").trim();
    if (narrative.length === 0) {
      warnings.push(`Day ${d.dayNumber} has no narrative yet.`);
    }
    if (!d.destination?.trim()) {
      warnings.push(`Day ${d.dayNumber} has no destination set.`);
    }
  }
  return { status: "ok", days: found, warnings };
}
