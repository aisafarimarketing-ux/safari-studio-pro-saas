import "server-only";
import { prisma } from "@/lib/prisma";
import type { Proposal, TierKey } from "@/lib/types";

// ─── Booking Operations — orchestration logic ──────────────────────────────
//
// Pure derivation + a single bounded query. The PATCH route writes
// nextActionAt + attemptCount; this module reads the current row +
// the org's recent proposal data and tells the operator what to do
// next. Deterministic, no LLM, no auto-actions.

export type NextActionKind =
  | "send_initial"        // status=not_sent
  | "awaiting_reply"      // status=sent, before nextActionAt
  | "send_followup"       // status=sent, due (24h)
  | "send_urgent"         // status=sent, due AND attemptCount >= 2 (48h+)
  | "send_followup_now"   // status=follow_up_needed (operator already flagged)
  | "mark_outcome"        // status=replied
  | "tell_client"         // status=available
  | "offer_alternatives"  // status=not_available
  | "none";               // resolved + told client, nothing to do

export type NextAction = {
  kind: NextActionKind;
  /** Operator-facing one-line hint shown under the property card. */
  hint: string;
};

export type RowForAction = {
  status: string;
  sentAt: Date | null;
  nextActionAt: Date | null;
  attemptCount: number;
};

export function deriveNextAction(row: RowForAction, now: Date = new Date()): NextAction {
  const nowMs = now.getTime();
  switch (row.status) {
    case "not_sent":
      return { kind: "send_initial", hint: "Send the draft to start the check." };
    case "sent": {
      const due =
        row.nextActionAt !== null && row.nextActionAt.getTime() <= nowMs;
      if (!due) return { kind: "awaiting_reply", hint: "Awaiting reply." };
      // attemptCount === 1 means initial sent, no follow-ups yet.
      if (row.attemptCount <= 1) {
        return {
          kind: "send_followup",
          hint: "It's been over 24h — a gentle follow-up is suggested.",
        };
      }
      return {
        kind: "send_urgent",
        hint: "Still no reply — a firmer note is appropriate now.",
      };
    }
    case "follow_up_needed":
      return {
        kind: "send_followup_now",
        hint: "Send the follow-up message you flagged.",
      };
    case "replied":
      return { kind: "mark_outcome", hint: "Mark Available or Not available." };
    case "available":
      return {
        kind: "tell_client",
        hint: "Tell the client this part is locked in.",
      };
    case "not_available":
      return {
        kind: "offer_alternatives",
        hint: "Try an alternative or update the client.",
      };
    default:
      return { kind: "none", hint: "" };
  }
}

// ─── Alternative property suggestion ────────────────────────────────────────
//
// When a property comes back not_available, the operator wants to know
// "what else fits this region at this tier?". Source: the org's own
// recent proposal contentJson — the camps the operator has already
// curated and used. No external data, no library lookup, no LLM. We
// dedupe by camp name, count occurrences as a popularity signal, and
// return the top 2.
//
// Bounded query (50 most-recent proposals) keeps cost predictable.
// Skipping the proposal we're working on prevents the same-camp
// suggestion from leaking back as an alternative to itself.

export type AlternativeSuggestion = {
  name: string;
  destination: string | null;
  /** How many proposal-days reference this camp at the matching
   *  tier — surfaced as a soft popularity signal in the UI. */
  occurrences: number;
};

export async function findAlternativeProperties(input: {
  organizationId: string;
  destination: string | null;
  tierKey: string | null;
  excludeName: string;
  excludeProposalId?: string | null;
}): Promise<AlternativeSuggestion[]> {
  const tierKey = (input.tierKey === "classic" || input.tierKey === "premier" || input.tierKey === "signature")
    ? (input.tierKey as TierKey)
    : null;
  if (!tierKey || !input.destination) return [];

  const rows = await prisma.proposal.findMany({
    where: {
      organizationId: input.organizationId,
      ...(input.excludeProposalId ? { id: { not: input.excludeProposalId } } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: { contentJson: true },
  });

  const targetDest = input.destination.trim().toLowerCase();
  const excludeLower = input.excludeName.trim().toLowerCase();
  const counts = new Map<string, AlternativeSuggestion>();

  for (const row of rows) {
    const proposal = row.contentJson as unknown as Proposal | null;
    if (!proposal || !Array.isArray(proposal.days)) continue;
    for (const day of proposal.days) {
      const camp = day?.tiers?.[tierKey]?.camp?.trim();
      if (!camp) continue;
      if (camp.toLowerCase() === excludeLower) continue;
      const dest = day.destination?.trim() || "";
      if (dest.toLowerCase() !== targetDest) continue;
      const key = camp.toLowerCase();
      const existing = counts.get(key);
      if (existing) {
        existing.occurrences += 1;
      } else {
        counts.set(key, {
          name: camp,
          destination: dest || null,
          occurrences: 1,
        });
      }
    }
  }

  // Sort by popularity desc; fall back to alphabetical for stable
  // ordering across calls. Cap at 2 — the v1 spec is intentionally
  // narrow ("offer 2 alternatives") to keep operator decisions easy.
  return Array.from(counts.values())
    .sort((a, b) => {
      if (b.occurrences !== a.occurrences) return b.occurrences - a.occurrences;
      return a.name.localeCompare(b.name);
    })
    .slice(0, 2);
}

// ─── Follow-up scheduling helpers ──────────────────────────────────────────
//
// Centralises the cadence so the PATCH route, the orchestrate route,
// and any future UI hint share one source of truth. 24h between
// initial and first follow-up; another 24h between first and second
// (so 48h after initial = "urgent"). After two follow-ups the row
// stays in "send_urgent" until the operator marks an outcome — we
// don't escalate further automatically.

export const FOLLOWUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

export function nextActionAfterSend(now: Date): Date {
  return new Date(now.getTime() + FOLLOWUP_INTERVAL_MS);
}
