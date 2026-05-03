import "server-only";
import { prisma } from "@/lib/prisma";
import { getGhlClientFromOrg, type GhlClient, type WorkflowKey } from "./client";
import { triggerWorkflow } from "./workflows";
import { upsertContact, addContactTags, type GhlContactInput } from "./contacts";

// ─── Workflow event triggers — Phase 3 ────────────────────────────────────
//
// Four fire-and-forget orchestrators that map a Safari Studio event to a
// GHL workflow run. Each one:
//
//   1. Loads the entity + its org from the DB
//   2. Resolves the org's GHL client (no-op if not configured)
//   3. Resolves the GHL contact (upserts on the fly when needed)
//   4. Builds the structured customData payload
//   5. Calls triggerWorkflow against the per-org workflow ID map
//
// All four functions never throw. The underlying client.ts wrapper logs
// every API call to IntegrationLog (success or failure); orchestrator
// errors land in console.warn + an IntegrationLog skip row when the
// workflow id isn't mapped.

// Same fallback as src/lib/notifications.ts — prefer NEXT_PUBLIC_APP_URL,
// fall back to PUBLIC_BASE_URL, and only accept absolute http(s) values.
// Anything else returns "" so callers can suppress the URL rather than
// ship a relative href into a third-party workflow.
const APP_URL = ((): string => {
  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.PUBLIC_BASE_URL,
  ];
  for (const raw of candidates) {
    const v = (raw || "").trim().replace(/\/+$/, "");
    if (!v) continue;
    if (!/^https?:\/\//i.test(v)) continue;
    return v;
  }
  return "";
})();

function proposalShareUrl(proposalId: string): string {
  if (APP_URL) return `${APP_URL}/p/${proposalId}`;
  // No public origin configured. Returning a relative path would put a
  // broken link into the GHL workflow's customData; logging once per
  // call surfaces the misconfig in Railway logs without throwing.
  console.warn(
    `[ghl/workflowEvents] APP_URL missing — proposalShareUrl(${proposalId}) fell back to relative path. Set NEXT_PUBLIC_APP_URL or PUBLIC_BASE_URL.`,
  );
  return `/p/${proposalId}`;
}

// ─── 1. proposal_sent ─────────────────────────────────────────────────────
//
// Fires from POST /api/proposals/[id]/share when the proposal flips from
// "draft" to "sent" for the first time. Auto-syncs the contact if the
// linked Client doesn't have ghlContactId yet (handles blank-canvas
// proposals where Phase 2 sync never ran).

export async function triggerProposalSent(proposalId: string): Promise<void> {
  try {
    const data = await loadProposalContext(proposalId);
    if (!data) return;
    const { ghl, proposal, client, request } = data;

    let contactId = client.ghlContactId;
    if (!contactId) {
      const contact = await upsertContact(
        ghl,
        buildContactInputFromClient(client, request?.id),
        { entityType: "proposal", entityId: proposalId },
      );
      contactId = contact.id;
      await prisma.client.update({
        where: { id: client.id },
        data: { ghlContactId: contactId },
      });
    }

    const content = readProposalContent(proposal.contentJson);
    const customData = {
      proposal_link: proposalShareUrl(proposalId),
      proposal_title: proposal.title,
      proposal_total: deriveProposalTotal(content),
      proposal_total_cents: deriveProposalTotalCents(content),
      currency: deriveCurrency(content),
      trip_dates: deriveTripDates(content),
      destinations: deriveDestinations(content),
      request_id: request?.id ?? null,
      reference_number: request?.referenceNumber ?? null,
      client_name: formatClientName(client),
    };

    const triggered = await tryTriggerWorkflow(
      ghl,
      contactId,
      "proposal_sent",
      customData,
      { entityType: "proposal", entityId: proposalId },
    );
    if (triggered) {
      // Tag the contact too — GHL workflows often key off tag-added events.
      void addContactTags(ghl, contactId, ["proposal-sent"], {
        entityType: "proposal",
        entityId: proposalId,
      });
    }
  } catch (err) {
    swallow("triggerProposalSent", proposalId, err);
  }
}

// ─── 2. proposal_viewed ───────────────────────────────────────────────────
//
// Fires from /api/public/proposals/[id]/track on the FIRST view of a
// proposal (detected at the call site). Includes whatever engagement
// data is available at trigger time so the workflow can branch on
// scoring without a follow-up API call.

export async function triggerProposalViewed(proposalId: string): Promise<void> {
  try {
    const data = await loadProposalContext(proposalId);
    if (!data) return;
    const { ghl, proposal, client, request } = data;

    if (!client.ghlContactId) {
      // Contact never synced — nothing to attach to. Log + skip so this
      // surfaces in the retry view rather than failing silently.
      await logSkip(ghl.organizationId, "proposal", proposalId,
        "triggerProposalViewed:noContactId",
        "Client has no ghlContactId — Phase 2 sync hasn't run for this proposal's request.");
      return;
    }

    const stats = await prisma.proposalView.aggregate({
      where: { proposalId },
      _sum: { viewCount: true, totalSeconds: true },
      _count: { _all: true },
    });
    const viewCount = stats._sum.viewCount ?? 1;
    const totalSeconds = stats._sum.totalSeconds ?? 0;
    const sessionCount = stats._count._all;

    const content = readProposalContent(proposal.contentJson);
    const customData = {
      proposal_link: proposalShareUrl(proposalId),
      proposal_title: proposal.title,
      view_count: viewCount,
      session_count: sessionCount,
      total_seconds: totalSeconds,
      engagement_score: scoreEngagement(viewCount, totalSeconds),
      destinations: deriveDestinations(content),
      request_id: request?.id ?? null,
      reference_number: request?.referenceNumber ?? null,
      client_name: formatClientName(client),
    };

    await tryTriggerWorkflow(
      ghl,
      client.ghlContactId,
      "proposal_viewed",
      customData,
      { entityType: "proposal", entityId: proposalId },
    );
  } catch (err) {
    swallow("triggerProposalViewed", proposalId, err);
  }
}

// ─── 3. deposit_paid ──────────────────────────────────────────────────────
//
// Fires from the Paystack webhook after a deposit charge.success. The
// payload includes the per-deposit and aggregated totals so the GHL
// workflow can fork between "first deposit / partial" and "balance
// settled" cases without a callback.

export async function triggerDepositPaid(depositId: string): Promise<void> {
  try {
    const deposit = await prisma.proposalDeposit.findUnique({
      where: { id: depositId },
      include: {
        proposal: {
          include: { client: true, request: true, organization: true },
        },
      },
    });
    if (!deposit?.proposal) return;
    const { proposal } = deposit;
    if (!proposal.organization) return;

    const ghl = getGhlClientFromOrg(proposal.organization);
    if (!ghl) return;
    if (!proposal.client?.ghlContactId) {
      await logSkip(proposal.organization.id, "deposit", depositId,
        "triggerDepositPaid:noContactId",
        "Proposal client has no ghlContactId.");
      return;
    }

    // Roll up paid deposits for accurate balance reporting.
    const paidAggregate = await prisma.proposalDeposit.aggregate({
      where: { proposalId: proposal.id, status: "paid" },
      _sum: { amountInCents: true },
    });
    const totalPaidCents = paidAggregate._sum.amountInCents ?? 0;
    const content = readProposalContent(proposal.contentJson);
    const proposalTotalCents = deriveProposalTotalCents(content);
    const balanceCents = Math.max(0, proposalTotalCents - totalPaidCents);
    const currency = deposit.currency || deriveCurrency(content);

    const customData = {
      proposal_link: proposalShareUrl(proposal.id),
      proposal_title: proposal.title,
      amount_paid: formatCurrency(deposit.amountInCents, currency),
      amount_paid_cents: deposit.amountInCents,
      currency,
      total_paid: formatCurrency(totalPaidCents, currency),
      total_paid_cents: totalPaidCents,
      proposal_total: formatCurrency(proposalTotalCents, currency),
      proposal_total_cents: proposalTotalCents,
      balance_due: balanceCents > 0 ? formatCurrency(balanceCents, currency) : `${currency} 0`,
      balance_due_cents: balanceCents,
      paystack_reference: deposit.paystackReference,
      payer_name: deposit.payerName ?? null,
      payer_email: deposit.payerEmail,
      client_name: formatClientName(proposal.client),
      request_id: proposal.request?.id ?? null,
      reference_number: proposal.request?.referenceNumber ?? null,
    };

    await tryTriggerWorkflow(
      ghl,
      proposal.client.ghlContactId,
      "deposit_paid",
      customData,
      { entityType: "deposit", entityId: depositId },
    );
  } catch (err) {
    swallow("triggerDepositPaid", depositId, err);
  }
}

// ─── 4. reservation_followup ──────────────────────────────────────────────
//
// Fires from PATCH /api/reservations/[id] when status flips to "sent".
// Targets a SUPPLIER contact in GHL — not the client — so the workflow
// can drive automated reminder cadence at the camp/lodge inbox. The
// supplier contact is upserted by reservationsEmail and tagged
// "supplier" + "lodge" so it's filterable separately from the
// operator's leads.

export async function triggerReservationFollowup(reservationId: string): Promise<void> {
  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        organization: true,
        proposal: { include: { client: true, request: true } },
      },
    });
    if (!reservation || !reservation.organization) return;
    const ghl = getGhlClientFromOrg(reservation.organization);
    if (!ghl) return;

    const supplierContact = await upsertContact(
      ghl,
      {
        email: reservation.reservationsEmail,
        name: reservation.campName,
        source: "Safari Studio",
        tags: ["safari-studio", "supplier", "lodge"],
        customFields: [
          { key: "supplier_property_name", field_value: reservation.campName },
        ],
      },
      { entityType: "reservation", entityId: reservation.id },
    );

    const customData = {
      reservation_id: reservation.id,
      property_name: reservation.campName,
      check_in: toIsoDate(reservation.startDate),
      check_out: toIsoDate(reservation.endDate),
      guest_name: reservation.guestName,
      adults: reservation.adults,
      children: reservation.children,
      room_config: reservation.roomConfig ?? null,
      notes: reservation.notes ?? null,
      held_until: reservation.heldUntil ? toIsoDate(reservation.heldUntil) : null,
      proposal_link: reservation.proposalId
        ? proposalShareUrl(reservation.proposalId)
        : null,
      request_id: reservation.proposal?.request?.id ?? null,
      reference_number: reservation.proposal?.request?.referenceNumber ?? null,
      client_name: reservation.proposal?.client
        ? formatClientName(reservation.proposal.client)
        : null,
    };

    const triggered = await tryTriggerWorkflow(
      ghl,
      supplierContact.id,
      "reservation_followup",
      customData,
      { entityType: "reservation", entityId: reservation.id },
    );

    if (triggered) {
      // Stamp the supplier-contact id on the reservation as a proxy for
      // "followup workflow has been triggered for this row" — ghlMessageId
      // is reused here to mark the linkage; the proper messaging linkage
      // will come in Phase 4 when outbound messages get their own row.
      await prisma.reservation.update({
        where: { id: reservation.id },
        data: { ghlMessageId: `supplier-contact:${supplierContact.id}` },
      });
    }
  } catch (err) {
    swallow("triggerReservationFollowup", reservationId, err);
  }
}

// ─── Shared helpers ───────────────────────────────────────────────────────

type ProposalContext = NonNullable<Awaited<ReturnType<typeof loadProposalContext>>>;

async function loadProposalContext(proposalId: string) {
  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    include: { client: true, request: true, organization: true },
  });
  if (!proposal || !proposal.client || !proposal.organization) return null;
  const ghl = getGhlClientFromOrg(proposal.organization);
  if (!ghl) return null;
  return {
    proposal,
    client: proposal.client,
    request: proposal.request,
    ghl,
  };
}

/** Pre-checks that the workflow id is mapped on the org and triggers
 *  through the typed wrapper. When the mapping is missing, writes one
 *  IntegrationLog row and returns false so the caller can skip side
 *  effects (tagging etc.). Mirrors the "log + skip" rule from the
 *  Phase 3 spec. */
async function tryTriggerWorkflow(
  ghl: GhlClient,
  contactId: string,
  workflowKey: WorkflowKey,
  customData: Record<string, unknown>,
  ctx: { entityType?: string; entityId?: string },
): Promise<boolean> {
  const workflowId = ghl.config.workflowIds?.[workflowKey];
  if (!workflowId) {
    await logSkip(
      ghl.organizationId,
      ctx.entityType,
      ctx.entityId,
      `triggerWorkflow:${workflowKey}:skip`,
      `Workflow id not mapped (Organization.ghlWorkflowIds.${workflowKey})`,
    );
    return false;
  }
  await triggerWorkflow(ghl, contactId, workflowKey, customData, ctx);
  return true;
}

type ClientLike = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
  ghlContactId: string | null;
};

function formatClientName(client: ClientLike): string {
  const full = [client.firstName, client.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  return full || client.email;
}

function buildContactInputFromClient(
  client: ClientLike,
  requestId: string | null = null,
): GhlContactInput {
  const customFields = [];
  if (requestId) {
    customFields.push({ key: "safari_request_id", field_value: requestId });
  }
  return {
    firstName: client.firstName ?? undefined,
    lastName: client.lastName ?? undefined,
    name: formatClientName(client),
    email: client.email,
    phone: client.phone ?? undefined,
    source: "Safari Studio",
    tags: ["safari-studio"],
    customFields: customFields.length > 0 ? customFields : undefined,
  };
}

// ── Proposal contentJson parsing — defensive, tolerates old / malformed shapes

type ProposalContentLite = {
  pricing?: {
    classic?: { pricePerPerson?: string; currency?: string };
    premier?: { pricePerPerson?: string; currency?: string };
    signature?: { pricePerPerson?: string; currency?: string };
  };
  activeTier?: string;
  client?: { pax?: string };
  trip?: {
    dates?: string;
    arrivalDate?: string;
    departureDate?: string;
    nights?: number;
    destinations?: string[];
  };
};

function readProposalContent(json: unknown): ProposalContentLite {
  if (!json || typeof json !== "object") return {};
  return json as ProposalContentLite;
}

function deriveProposalTotalCents(content: ProposalContentLite): number {
  const tierKey = (content.activeTier === "classic" || content.activeTier === "signature")
    ? content.activeTier
    : "premier";
  const tier = content.pricing?.[tierKey];
  const perPerson = parsePerPerson(tier?.pricePerPerson);
  if (perPerson <= 0) return 0;
  const pax = parsePax(content.client?.pax);
  const dollars = perPerson * (pax > 0 ? pax : 1);
  return Math.round(dollars * 100);
}

function deriveProposalTotal(content: ProposalContentLite): string {
  const cents = deriveProposalTotalCents(content);
  if (cents <= 0) return "";
  return formatCurrency(cents, deriveCurrency(content));
}

function deriveCurrency(content: ProposalContentLite): string {
  const tierKey = (content.activeTier === "classic" || content.activeTier === "signature")
    ? content.activeTier
    : "premier";
  return (content.pricing?.[tierKey]?.currency || "USD").toUpperCase();
}

function deriveTripDates(content: ProposalContentLite): string {
  const t = content.trip ?? {};
  if (typeof t.dates === "string" && t.dates.trim()) return t.dates;
  if (typeof t.arrivalDate === "string" && typeof t.departureDate === "string") {
    return `${t.arrivalDate} – ${t.departureDate}`;
  }
  if (typeof t.nights === "number") return `${t.nights} nights`;
  return "";
}

function deriveDestinations(content: ProposalContentLite): string {
  const dests = content.trip?.destinations;
  if (!Array.isArray(dests)) return "";
  return dests.filter((d): d is string => typeof d === "string").join(", ");
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
    if (!seenHeadcount) { total = num; seenHeadcount = true; continue; }
    if (total < 20 && num <= 12) { total += num; break; }
    break;
  }
  return total;
}

// ── Engagement scoring — coarse heuristic, 0–100

function scoreEngagement(viewCount: number, totalSeconds: number): number {
  // 5 points per repeat view, 0.5 points per second of dwell, capped at 100.
  // Tuned so a single 2-minute open ≈ 60 (≥120s = "high"), and a 5-minute
  // re-opening session lands well above the high-engagement threshold.
  const score = totalSeconds * 0.5 + viewCount * 5;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function formatCurrency(cents: number, currency: string): string {
  const major = cents / 100;
  const formatted = major.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${currency} ${formatted}`;
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function logSkip(
  organizationId: string,
  entityType: string | undefined,
  entityId: string | undefined,
  action: string,
  errorMessage: string,
): Promise<void> {
  try {
    await prisma.integrationLog.create({
      data: {
        organizationId,
        provider: "ghl",
        action,
        entityType: entityType ?? null,
        entityId: entityId ?? null,
        status: "failed",
        errorMessage,
      },
    });
  } catch (err) {
    console.warn("[ghl] failed to write skip log:", err);
  }
}

function swallow(fn: string, id: string, err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  console.warn(`[ghl] ${fn}(${id}) failed:`, msg);
}

// Re-export the loader for tests / admin tools that want the same context.
export { loadProposalContext };
export type { ProposalContext };
