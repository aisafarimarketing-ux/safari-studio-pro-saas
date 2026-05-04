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
  /** Direct proposal pointer when the candidate was resolved via a
   *  ProposalReservation row or via Proposal.contentJson.client.guestNames
   *  (i.e. no Prisma Client row exists for this person). When set, the
   *  /execute route MUST use this proposalId directly and skip
   *  loadLatestProposal — there is no Client row to call it against. */
  resolvedProposalId?: string;
  /** Where the match came from. Surfaced in the disambiguation picker
   *  as a small badge ("from booking" / "from proposal draft") so the
   *  operator can tell apart "Jennifer who has a Client row" from
   *  "Jennifer who only exists on a reservation". */
  source: "client" | "reservation" | "proposal-content";
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

  // Score Client-row candidates.
  const clientScored = Array.from(candidates.values())
    .map((c) => scoreCandidate(c, trimmed, tokens))
    .filter((r) => r.score > 0);

  // ── Source 2 — ProposalReservation ──────────────────────────────────
  // Booked clients show up here even when there's no Client row (the
  // reservation form persists firstName + lastName + email + phone
  // directly on ProposalReservation). Surface them so commands like
  // "send Jennifer N Morris day 2 and 3" resolve when Jennifer only
  // exists as a reservation row. Wrapped so a Prisma blip on this
  // table doesn't crash the whole resolver — we still have Sources
  // 1 and 3 as fallbacks.
  let reservationCandidates: { lite: ClientLite; score: number }[] = [];
  try {
    reservationCandidates = await findReservationCandidates(
      organizationId,
      tokens,
      trimmed,
    );
  } catch (err) {
    console.warn("[execute] reservation source failed:", err);
  }

  // ── Source 3 — Proposal.contentJson.client.guestNames ───────────────
  // Catches proposals drafted with a guest name but no linked Client
  // row (manual editor, demo seed, import). Uses Postgres JSON path
  // filtering via Prisma's path operator. Defensively wrapped — JSON
  // path filter syntax can vary across Prisma + Postgres versions and
  // we'd rather degrade to "no contentJson source" than crash.
  let contentCandidates: { lite: ClientLite; score: number }[] = [];
  try {
    contentCandidates = await findContentCandidates(
      organizationId,
      tokens,
      trimmed,
    );
  } catch (err) {
    console.warn("[execute] content source failed:", err);
  }

  // Merge + dedupe. Reservation/content matches that share a
  // proposalId with a Client-row match are skipped (the Client row
  // wins because we know more about that person). Otherwise, both
  // surface.
  const seenProposalIds = new Set(
    clientScored
      .map((r) => r.lite.latestProposalUpdatedAt && (r.lite as ClientLite & { _proposalId?: string })._proposalId)
      .filter((id): id is string => Boolean(id)),
  );
  const allScored = [...clientScored];
  for (const r of [...reservationCandidates, ...contentCandidates]) {
    const pid = r.lite.resolvedProposalId;
    if (pid && seenProposalIds.has(pid)) continue;
    if (pid) seenProposalIds.add(pid);
    allScored.push(r);
  }
  const scored = allScored
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
    source: "client",
  };
  return { lite, score };
}

// ─── Source 2 — ProposalReservation ─────────────────────────────────────
//
// The reservation form persists the booking client's contact info
// directly on the ProposalReservation row. There may not be a Client
// row for them. This source ensures "send [booking client] day X"
// resolves when the operator references someone who only exists as
// a booking submission.
async function findReservationCandidates(
  organizationId: string,
  tokens: string[],
  rawHint: string,
): Promise<{ lite: ClientLite; score: number }[]> {
  // Build the WHERE based on token count. Multi-token uses startsWith
  // on first/last; single-token uses a contains-search across first/
  // last/email. Mirrors the Client-row strategy above.
  const where = (() => {
    if (tokens.length >= 2) {
      return {
        organizationId,
        AND: [
          { firstName: { startsWith: tokens[0], mode: "insensitive" as const } },
          { lastName: {
            startsWith: tokens[tokens.length - 1],
            mode: "insensitive" as const,
          } },
        ],
      };
    }
    const t = tokens[0];
    return {
      organizationId,
      OR: [
        { firstName: { contains: t, mode: "insensitive" as const } },
        { lastName: { contains: t, mode: "insensitive" as const } },
        { email: { contains: t, mode: "insensitive" as const } },
      ],
    };
  })();

  const rows = await prisma.proposalReservation.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 6,
    select: {
      id: true,
      proposalId: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      createdAt: true,
      proposal: {
        select: { id: true, title: true, updatedAt: true },
      },
    },
  });

  return rows.map((r) => {
    const fullName = `${r.firstName} ${r.lastName}`.trim();
    const firstLower = (r.firstName ?? "").toLowerCase();
    const lastLower = (r.lastName ?? "").toLowerCase();
    const emailLower = (r.email ?? "").toLowerCase();
    let score = 0;
    if (tokens.length >= 2) {
      const ft = tokens[0];
      const lt = tokens[tokens.length - 1];
      if (firstLower === ft && lastLower === lt) score += 200;
      else if (firstLower.startsWith(ft) && lastLower.startsWith(lt)) score += 130;
    }
    for (const t of tokens) {
      if (firstLower === t) score += 100;
      if (lastLower === t) score += 90;
      if (firstLower.startsWith(t)) score += 30;
      if (lastLower.startsWith(t)) score += 28;
      if (emailLower.includes(t)) score += 4;
    }
    if (fullName.toLowerCase() === rawHint.toLowerCase()) score += 50;

    const lite: ClientLite = {
      // Synthetic id — never used to look up a Client row. The
      // resolvedProposalId is what the route uses.
      id: `reservation:${r.id}`,
      firstName: r.firstName,
      lastName: r.lastName,
      email: r.email,
      phone: r.phone,
      fullName: fullName || r.email,
      latestProposalTitle: r.proposal?.title ?? null,
      latestProposalUpdatedAt:
        r.proposal?.updatedAt?.toISOString() ?? r.createdAt.toISOString(),
      resolvedProposalId: r.proposalId,
      source: "reservation",
    };
    return { lite, score };
  });
}

// ─── Source 3 — Proposal.contentJson.client.guestNames ──────────────────
//
// Manual / imported / demo proposals often carry the guest's name only
// in the contentJson blob (no Client / ProposalReservation row). Search
// via Postgres' JSON path operator through Prisma.
async function findContentCandidates(
  organizationId: string,
  tokens: string[],
  rawHint: string,
): Promise<{ lite: ClientLite; score: number }[]> {
  // The path filter does a case-sensitive contains by default; we
  // OR over each token plus the raw hint to catch case variations.
  // Bounded `take` keeps this cheap even on orgs with many proposals.
  const orConditions = [];
  for (const t of tokens) {
    orConditions.push({
      contentJson: {
        path: ["client", "guestNames"],
        string_contains: t,
      },
    });
    orConditions.push({
      contentJson: {
        path: ["client", "guestNames"],
        string_contains: t.charAt(0).toUpperCase() + t.slice(1),
      },
    });
  }
  if (orConditions.length === 0) return [];

  let rows: Array<{
    id: string;
    title: string | null;
    updatedAt: Date;
    contentJson: unknown;
  }> = [];
  try {
    rows = await prisma.proposal.findMany({
      where: {
        organizationId,
        // Skip proposals already linked to a Client row — those land
        // via Source 1. This source is specifically for the gap.
        clientId: null,
        OR: orConditions,
      },
      orderBy: { updatedAt: "desc" },
      take: 6,
      select: {
        id: true,
        title: true,
        updatedAt: true,
        contentJson: true,
      },
    });
  } catch (err) {
    // JSON path filters can vary by Postgres version / Prisma adapter.
    // Fail soft — we still have Sources 1 and 2.
    console.warn("[execute] contentJson search failed:", err);
    return [];
  }

  return rows
    .map((r) => {
      const guestNames = extractGuestNames(r.contentJson);
      if (!guestNames) return null;
      const guestLower = guestNames.toLowerCase();
      const rawLower = rawHint.toLowerCase();
      let score = 0;

      if (tokens.length >= 2) {
        // For multi-token, only score if the guestNames contains
        // first AND last token. Avoids spurious "Jennifer & Collins"
        // matching on a hint of "Jennifer Smith".
        const ft = tokens[0];
        const lt = tokens[tokens.length - 1];
        if (guestLower.includes(ft) && guestLower.includes(lt)) {
          if (guestLower === `${ft} ${lt}`) score += 200;
          else if (guestLower.startsWith(`${ft} `)) score += 150;
          else score += 100;
        }
      }
      for (const t of tokens) {
        if (guestLower === t) score += 100;
        if (guestLower.startsWith(`${t} `)) score += 50;
        if (guestLower.includes(t)) score += 20;
      }
      if (guestLower === rawLower) score += 30;
      if (score === 0) return null;

      // Best-effort name split on first space.
      const [firstName, ...rest] = guestNames.split(/\s+/);
      const lastName = rest.join(" ").trim() || null;

      const lite: ClientLite = {
        id: `proposal-content:${r.id}`,
        firstName: firstName || null,
        lastName,
        email: "",
        phone: null,
        fullName: guestNames,
        latestProposalTitle: r.title ?? "Untitled proposal",
        latestProposalUpdatedAt: r.updatedAt.toISOString(),
        resolvedProposalId: r.id,
        source: "proposal-content",
      };
      return { lite, score };
    })
    .filter((r): r is { lite: ClientLite; score: number } => r !== null);
}

function extractGuestNames(contentJson: unknown): string | null {
  if (!contentJson || typeof contentJson !== "object") return null;
  const c = (contentJson as Record<string, unknown>).client;
  if (!c || typeof c !== "object") return null;
  const g = (c as Record<string, unknown>).guestNames;
  if (typeof g !== "string") return null;
  const trimmed = g.trim();
  return trimmed.length > 0 ? trimmed : null;
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
      source: "client",
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

// ─── Pricing context derivation ─────────────────────────────────────────────
//
// Reads the share-view behaviour signals for one proposal and bucks
// them into one of three contexts the pricing formatter uses to pick
// its reassurance line. Tiny single-purpose query — meant to be
// called inline from /api/ai/execute right before formatPricingSnippet.
//
// Buckets (priority order):
//   "hesitation"  — pricing dwell ≥60s. They've been on the price
//                   page long enough that the operator's first
//                   instinct is right: this is a "what fits me"
//                   conversation.
//   "comparison"  — pricing was viewed (priceViewed flag fired) OR
//                   any non-zero pricing dwell exists. Quick scan
//                   pattern; reassurance frames the breakdown as a
//                   structure-explainer.
//   "confusion"   — no pricing engagement signal at all (the deck
//                   was opened but pricing was never reached, OR no
//                   share-view sessions exist yet). Reassurance
//                   leans into "happy to clarify".
//   null          — no proposal activity row at all (just-created
//                   proposal). Caller defaults to "comparison".

export type PricingContext = "hesitation" | "comparison" | "confusion" | null;

const PRICING_HESITATION_DWELL_S = 60;

export async function derivePricingContext(
  organizationId: string,
  proposalId: string,
): Promise<PricingContext> {
  // Two cheap queries: per-proposal pricing-dwell sum + the
  // priceViewed flag from the activity summary. Org-scope guard on
  // the summary side stays consistent with everything else in this
  // module — never trust caller-supplied proposalId alone.
  const [events, summary] = await Promise.all([
    prisma.proposalViewEvent.findMany({
      where: {
        view: { proposalId },
        sectionType: "pricing",
        kind: { in: ["section", "close"] },
        dwellSeconds: { not: null },
      },
      select: { dwellSeconds: true },
      take: 200,
    }),
    prisma.proposalActivitySummary.findUnique({
      where: { proposalId },
      select: { priceViewed: true, organizationId: true, viewedCount: true },
    }),
  ]);
  // Cross-org guard: if the activity summary exists but for a
  // different org, treat as no signal. Nothing here returns the
  // proposal's content, but staying paranoid keeps the call safe to
  // share across surfaces.
  if (summary && summary.organizationId !== organizationId) return null;
  if (!summary) return null;

  const totalPricingDwell = events.reduce(
    (sum, e) => sum + (e.dwellSeconds ?? 0),
    0,
  );
  if (totalPricingDwell >= PRICING_HESITATION_DWELL_S) return "hesitation";
  if (summary.priceViewed || totalPricingDwell > 0) return "comparison";
  if (summary.viewedCount > 0) return "confusion";
  return null;
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
