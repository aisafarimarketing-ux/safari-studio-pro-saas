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

// Normalise a name hint into a list of lowercase tokens. Strips
// punctuation (commas, periods — including middle-initial dots),
// collapses whitespace, and splits. Unicode-aware so non-ASCII names
// (Sørensen, Müller, etc.) tokenize correctly.
function normalizeNameTokens(hint: string): string[] {
  return hint
    .toLowerCase()
    .replace(/[^\p{L}\p{N}@.\s]/gu, " ") // keep @ and . for email-like hints, strip everything else
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

// Case-insensitive lookup against firstName, lastName, email, and the
// concatenated full name. We deliberately avoid fuzzy matching
// (Levenshtein etc.) — the spec calls for fail-loud over guess-silent.
// Multiple matches get bubbled up as "ambiguous" so the operator picks.
//
// Token-aware routing:
//   1 token  → contains-search across firstName / lastName / email.
//              Handles "Morris" / "Jennifer" / "jennifer.morris@…".
//   2+ tokens → first-token vs firstName + last-token vs lastName.
//              Middle tokens (e.g. "N" in "Jennifer N Morris") are
//              ignored. Matches "Jennifer Morris" and
//              "Jennifer N Morris" to the same client.
//
// Both paths produce a unified scored list, then pass through the
// same decisive-match / ambiguity branching. Scores are tuned so that
// a multi-token first+last EXACT match dominates a single-token
// substring hit — picking up "Jennifer Morris" over a generic "Morris"
// candidate that also has a matching email substring.
export async function findClient(
  organizationId: string,
  hint: string,
): Promise<FindClientResult> {
  const trimmed = hint.trim();
  if (!trimmed) return { status: "not-found", hint: "(empty hint)" };

  const tokens = normalizeNameTokens(trimmed);
  if (tokens.length === 0) return { status: "not-found", hint: trimmed };

  // Two-stage candidate gather. First the precise multi-token query
  // (when applicable); fall back to the generous single-token search
  // when that returns nothing or when the hint is single-token to
  // begin with. We dedupe by client.id when both queries fire.
  const candidates = new Map<string, RawCandidate>();

  if (tokens.length >= 2) {
    const firstToken = tokens[0];
    const lastToken = tokens[tokens.length - 1];
    const multiTokenRows = await prisma.client.findMany({
      where: {
        organizationId,
        AND: [
          { firstName: { startsWith: firstToken, mode: "insensitive" } },
          { lastName: { startsWith: lastToken, mode: "insensitive" } },
        ],
      },
      select: clientSelect,
      take: 6,
    });
    for (const row of multiTokenRows) {
      candidates.set(row.id, row);
    }
  }

  // Always run the single-token contains-search too — covers the
  // single-token case directly, AND acts as a fallback when the
  // multi-token query returned nothing (e.g. operator wrote
  // "Mr Morris" — "mr" doesn't match a firstName, but "Morris"
  // alone would still surface the right client). Bound by `take`
  // so a generic hint can't fan out.
  const fallbackHint = tokens.length === 1 ? tokens[0] : trimmed;
  const containsRows = await prisma.client.findMany({
    where: {
      organizationId,
      OR: [
        { firstName: { contains: fallbackHint, mode: "insensitive" } },
        { lastName: { contains: fallbackHint, mode: "insensitive" } },
        { email: { contains: fallbackHint, mode: "insensitive" } },
      ],
    },
    select: clientSelect,
    take: 6,
  });
  for (const row of containsRows) {
    if (!candidates.has(row.id)) candidates.set(row.id, row);
  }

  // Score every candidate against the original hint + tokens.
  const scored = Array.from(candidates.values())
    .map((c) => scoreCandidate(c, trimmed, tokens))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return { status: "not-found", hint: trimmed };
  }
  if (scored.length === 1) {
    return { status: "found", client: scored[0].lite };
  }
  // If the top score is meaningfully ahead AND that top is an exact
  // first-name / full-name / first+last match, pick it. Otherwise
  // surface the picker. The threshold is intentionally conservative
  // — we'd rather ask than auto-pick.
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

// ─── Internal scoring helpers ───────────────────────────────────────────

type RawCandidate = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
  proposals: { title: string | null; updatedAt: Date }[];
};

const clientSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  proposals: {
    orderBy: { updatedAt: "desc" } as const,
    take: 1,
    select: { title: true, updatedAt: true },
  },
};

function scoreCandidate(
  c: RawCandidate,
  rawHint: string,
  tokens: string[],
): { lite: ClientLite; score: number } {
  const fullName = [c.firstName, c.lastName].filter(Boolean).join(" ").trim();
  const firstLower = (c.firstName ?? "").toLowerCase();
  const lastLower = (c.lastName ?? "").toLowerCase();
  const fullLower = fullName.toLowerCase();
  const emailLower = c.email.toLowerCase();
  const rawLower = rawHint.toLowerCase();

  let score = 0;

  // Multi-token (first+last) signals dominate. "Jennifer Morris" and
  // "Jennifer N Morris" both produce ["jennifer", "morris"] effectively
  // for first+last and both should hit ~200 against a Jennifer Morris
  // record.
  if (tokens.length >= 2) {
    const firstToken = tokens[0];
    const lastToken = tokens[tokens.length - 1];
    const firstExact = firstLower === firstToken;
    const lastExact = lastLower === lastToken;
    const firstStarts = firstLower.startsWith(firstToken);
    const lastStarts = lastLower.startsWith(lastToken);

    if (firstExact && lastExact) score += 200;
    else if (firstExact && lastStarts) score += 170;
    else if (firstStarts && lastExact) score += 170;
    else if (firstStarts && lastStarts) score += 130;

    // Soft credit when the entire hint (with middle tokens preserved)
    // appears in the email — covers operators referring to a client by
    // a familiar email handle.
    if (emailLower.includes(rawLower)) score += 5;
  }

  // Single-token style scoring (also applies as a baseline for
  // multi-token hints — covers the "Morris" alone case).
  for (const t of tokens) {
    if (firstLower === t) score += 100;
    else if (lastLower === t) score += 90;
    else if (fullLower === t) score += 95;
    if (firstLower.startsWith(t)) score += 30;
    if (lastLower.startsWith(t)) score += 28;
    if (firstLower.includes(t)) score += 12;
    if (lastLower.includes(t)) score += 11;
    if (emailLower.includes(t)) score += 4;
  }
  // De-dup score: if the operator typed the full name verbatim
  // ("jennifer morris"), surface the exact-fullName bonus so the
  // picker doesn't fire on a tied second match.
  if (fullLower === tokens.join(" ")) score += 50;

  const lite: ClientLite = {
    id: c.id,
    firstName: c.firstName,
    lastName: c.lastName,
    email: c.email,
    phone: c.phone,
    fullName: fullName || c.email,
    latestProposalTitle: c.proposals[0]?.title ?? null,
    latestProposalUpdatedAt: c.proposals[0]?.updatedAt?.toISOString() ?? null,
  };
  return { lite, score };
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
