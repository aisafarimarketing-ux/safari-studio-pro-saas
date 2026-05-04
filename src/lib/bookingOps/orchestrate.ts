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
// Centralises the cadence so the PATCH route + orchestrate route +
// any future UI share one source of truth. The cadence widens on
// each step so a property that's already had a gentle nudge gets
// breathing room before the urgent note.
//
//   attempt 1 (initial sent)        → next action in 24h
//   attempt 2+ (any follow-up sent) → next action in 48h
//
// "attemptJustCompleted" is the value that was just written — i.e.
// pass 1 right after the initial send, pass 2 right after the first
// follow-up dispatch, and so on. Beyond attempt 2 we keep the same
// 48h spacing rather than escalating further; the orchestrate hint
// already flags the row as "send_urgent" once attemptCount ≥ 2.

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function computeNextActionAt(
  attemptJustCompleted: number,
  now: Date,
): Date {
  const intervalMs = attemptJustCompleted <= 1 ? ONE_DAY_MS : 2 * ONE_DAY_MS;
  return new Date(now.getTime() + intervalMs);
}

// ─── Coarse-grained suggestedAction ────────────────────────────────────────
//
// Three-state derivation that downstream surfaces (counts, filters,
// future dashboards) can pivot on without re-implementing the time
// math. Distinct from `nextAction.kind` which is finer-grained for
// the UI hint copy.
//
//   "follow_up"      — status=sent AND nextActionAt is in the past
//   "switch"         — status=not_available (find an alternative)
//   "confirm_client" — status=available (tell the client)
//   null             — nothing actionable right now
//
// status="follow_up_needed" also returns "follow_up" — the operator
// has explicitly flagged the row for a nudge, so the bucket matches.

export type SuggestedAction = "follow_up" | "switch" | "confirm_client" | null;

export function deriveSuggestedAction(
  row: { status: string; nextActionAt: Date | null },
  now: Date = new Date(),
): SuggestedAction {
  if (row.status === "available") return "confirm_client";
  if (row.status === "not_available") return "switch";
  if (row.status === "follow_up_needed") return "follow_up";
  if (row.status === "sent") {
    if (row.nextActionAt && row.nextActionAt.getTime() <= now.getTime()) {
      return "follow_up";
    }
  }
  return null;
}
