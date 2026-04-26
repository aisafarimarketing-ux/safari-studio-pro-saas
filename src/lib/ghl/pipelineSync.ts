import "server-only";
import { prisma } from "@/lib/prisma";
import { getGhlClient, type StageKey } from "./client";
import { upsertContact, type GhlContactInput } from "./contacts";
import { createOpportunity, moveOpportunityToStage } from "./opportunities";

// ─── Pipeline sync — Request → GHL contact + opportunity ─────────────────
//
// Two fire-and-forget entry points consumed by the Request API routes:
//
//   syncRequestCreated(id)  — runs after POST /api/requests. Upserts the
//                             contact, creates the opportunity, persists
//                             the resulting IDs back on Client and
//                             Request. Idempotent — safe to retry.
//
//   syncRequestStatus(id)   — runs after PATCH /api/requests/[id] (and
//                             the bulk-status action). Moves the
//                             opportunity to the stage that maps to the
//                             current Request.status. If the opportunity
//                             doesn't exist yet (org connected GHL
//                             after the request was created), this
//                             falls through to syncRequestCreated.
//
// Neither function throws. Failures land in IntegrationLog (written by
// the underlying client.ts wrapper) so the create/patch flow is never
// broken by a GHL outage. A retry endpoint can scoop pending rows
// later — see Phase 2 spec, "allow retry later".

// ── Status → stage-key mapping ───────────────────────────────────────────
//
// Internal Request statuses and how they map to the per-org GHL pipeline
// stage keys (Organization.ghlStageIds):
//
//   new        → "new"            ← initial inbound
//   working    → "working"        ← operator actively quoting
//   open       → "proposal_sent"  ← proposal shared with client
//   booked     → "booked"         ← client confirmed (won)
//   completed  → "booked"         ← trip finished (still won, terminal)
//   not_booked → "not_booked"     ← lost

const STATUS_TO_STAGE: Record<string, StageKey> = {
  new: "new",
  working: "working",
  open: "proposal_sent",
  booked: "booked",
  completed: "booked",
  not_booked: "not_booked",
};

export function statusToStageKey(status: string): StageKey | null {
  return STATUS_TO_STAGE[status] ?? null;
}

// ─── syncRequestCreated ─────────────────────────────────────────────────

export async function syncRequestCreated(requestId: string): Promise<void> {
  try {
    const ctx = await loadSyncContext(requestId);
    if (!ctx) return;
    const { request, client, ghl } = ctx;

    // Step 1: ensure the GHL contact exists. Upsert is keyed on email
    // by GHL, so re-running this is safe.
    let ghlContactId = client.ghlContactId;
    if (!ghlContactId) {
      const contact = await upsertContact(ghl, buildContactInput(client, request), {
        entityType: "request",
        entityId: request.id,
      });
      ghlContactId = contact.id;
      await prisma.client.update({
        where: { id: client.id },
        data: { ghlContactId },
      });
    }

    // Step 2: ensure the GHL opportunity exists. We don't recreate when
    // ghlOpportunityId is already set — that's an admin-tool concern.
    if (!request.ghlOpportunityId) {
      const stageKey = statusToStageKey(request.status) ?? "new";
      const stageId = ghl.config.stageIds?.[stageKey];
      if (!stageId || !ghl.config.pipelineId) {
        // Pipeline / stage IDs aren't configured. Contact is synced but
        // the opportunity has to wait. We log so the admin retry view
        // can surface it.
        await logSkip(ghl.organizationId, request.id, "syncRequestCreated:missingPipelineConfig",
          `pipelineId=${ghl.config.pipelineId ?? "null"} stage[${stageKey}]=${stageId ?? "null"}`);
        return;
      }
      const monetaryValue = await deriveEstimatedValue(request.id);
      const fullName = formatFullName(client) || client.email;
      const opp = await createOpportunity(
        ghl,
        {
          contactId: ghlContactId,
          name: `${request.referenceNumber} — ${fullName}`,
          pipelineStageId: stageId,
          monetaryValue,
          status: "open",
          source: "Safari Studio",
        },
        { entityType: "request", entityId: request.id },
      );
      await prisma.request.update({
        where: { id: request.id },
        data: {
          ghlOpportunityId: opp.id,
          ghlStageId: opp.pipelineStageId,
        },
      });
    }
  } catch (err) {
    // The underlying client.ts wrote a failed IntegrationLog row already.
    // Surfacing the error here would break the parent API flow; we
    // deliberately swallow it.
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[ghl] syncRequestCreated(${requestId}) failed:`, msg);
  }
}

// ─── syncRequestStatus ──────────────────────────────────────────────────

export async function syncRequestStatus(requestId: string): Promise<void> {
  try {
    const ctx = await loadSyncContext(requestId);
    if (!ctx) return;
    const { request, ghl } = ctx;

    // No opportunity yet — fall back to the create flow. Most likely
    // the org connected GHL after this request was already in motion.
    if (!request.ghlOpportunityId) {
      await syncRequestCreated(requestId);
      return;
    }

    const stageKey = statusToStageKey(request.status);
    if (!stageKey) {
      await logSkip(ghl.organizationId, request.id, "syncRequestStatus:unknownStatus",
        `Unknown Request.status='${request.status}'`);
      return;
    }
    const stageId = ghl.config.stageIds?.[stageKey];
    if (!stageId) {
      await logSkip(ghl.organizationId, request.id, "syncRequestStatus:missingStage",
        `stage[${stageKey}] not configured`);
      return;
    }

    const monetaryValue = await deriveEstimatedValue(request.id);
    const opp = await moveOpportunityToStage(
      ghl,
      request.ghlOpportunityId,
      stageKey,
      monetaryValue,
      { entityType: "request", entityId: request.id },
    );
    await prisma.request.update({
      where: { id: request.id },
      data: { ghlStageId: opp.pipelineStageId },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[ghl] syncRequestStatus(${requestId}) failed:`, msg);
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────

async function loadSyncContext(requestId: string) {
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    include: { client: true },
  });
  if (!request || !request.client) return null;
  const ghl = await getGhlClient(request.organizationId);
  if (!ghl) return null; // GHL not configured for this org — no-op.
  return { request, client: request.client, ghl };
}

type ClientLike = {
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
};

function formatFullName(client: ClientLike): string {
  return [client.firstName, client.lastName].filter(Boolean).join(" ").trim();
}

function buildContactInput(
  client: ClientLike,
  request: { id: string; tripBrief: unknown },
): GhlContactInput {
  const fullName = formatFullName(client);
  return {
    firstName: client.firstName ?? undefined,
    lastName: client.lastName ?? undefined,
    name: fullName || client.email,
    email: client.email,
    phone: client.phone ?? undefined,
    source: "Safari Studio",
    tags: ["safari-studio", "new-request"],
    customFields: [
      { key: "safari_request_id", field_value: request.id },
      { key: "preferred_destination", field_value: summariseDestinations(request.tripBrief) },
      { key: "travel_dates", field_value: summariseDates(request.tripBrief) },
    ],
  };
}

function summariseDestinations(tripBrief: unknown): string {
  if (!tripBrief || typeof tripBrief !== "object") return "";
  const brief = tripBrief as Record<string, unknown>;
  if (Array.isArray(brief.destinations)) {
    return (brief.destinations as unknown[])
      .filter((d): d is string => typeof d === "string")
      .join(", ");
  }
  return "";
}

function summariseDates(tripBrief: unknown): string {
  if (!tripBrief || typeof tripBrief !== "object") return "";
  const brief = tripBrief as Record<string, unknown>;
  if (typeof brief.dates === "string" && brief.dates.trim()) return brief.dates;
  if (typeof brief.travelDates === "string" && brief.travelDates.trim()) return brief.travelDates;
  if (typeof brief.arrivalDate === "string" && typeof brief.departureDate === "string") {
    return `${brief.arrivalDate} – ${brief.departureDate}`;
  }
  if (typeof brief.nights === "number") return `${brief.nights} nights`;
  return "";
}

/** Estimated value = (proposal active-tier per-person) × pax. Falls back
 *  to 0 when no proposal has been drafted yet, or when the price string
 *  on the active tier doesn't parse. Reads the most-recently-updated
 *  proposal linked to this request. */
async function deriveEstimatedValue(requestId: string): Promise<number> {
  const proposal = await prisma.proposal.findFirst({
    where: { requestId },
    orderBy: { updatedAt: "desc" },
    select: { contentJson: true },
  });
  if (!proposal?.contentJson) return 0;

  type TierPrice = { pricePerPerson?: string };
  type ProposalContent = {
    pricing?: { classic?: TierPrice; premier?: TierPrice; signature?: TierPrice };
    activeTier?: string;
    client?: { pax?: string };
  };
  const content = proposal.contentJson as ProposalContent;
  const tier = content.activeTier ?? "premier";
  const tierKey = tier === "classic" || tier === "premier" || tier === "signature" ? tier : "premier";
  const perPerson = parsePerPerson(content.pricing?.[tierKey]?.pricePerPerson);
  if (perPerson <= 0) return 0;
  const pax = parsePax(content.client?.pax);
  return Math.round(perPerson * (pax > 0 ? pax : 1));
}

function parsePerPerson(raw: string | undefined): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/[^\d.]/g, "");
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function parsePax(raw: string | undefined): number {
  if (!raw) return 0;
  const nums = raw.match(/\d+/g);
  if (!nums) return 0;
  let total = 0;
  let seenHeadcount = false;
  for (const n of nums) {
    const num = Number.parseInt(n, 10);
    if (!Number.isFinite(num)) continue;
    if (!seenHeadcount) {
      total = num;
      seenHeadcount = true;
      continue;
    }
    if (total < 20 && num <= 12) {
      total += num;
      break;
    }
    break;
  }
  return total;
}

async function logSkip(
  organizationId: string,
  requestId: string,
  action: string,
  errorMessage: string,
): Promise<void> {
  try {
    await prisma.integrationLog.create({
      data: {
        organizationId,
        provider: "ghl",
        action,
        entityType: "request",
        entityId: requestId,
        status: "failed",
        errorMessage,
      },
    });
  } catch (err) {
    console.warn(`[ghl] failed to write skip log:`, err);
  }
}
