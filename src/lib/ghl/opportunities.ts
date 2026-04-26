import "server-only";
import type { GhlClient, LogContext, StageKey } from "./client";

// ─── GoHighLevel — opportunities ──────────────────────────────────────────
//
// Pipeline ops. Phase 2 calls `createOpportunity` after the contact is
// upserted; status transitions on Request flip through
// `moveOpportunityToStage`, which looks up the per-org stage ID from
// `Organization.ghlStageIds`.
//
// `pipelineId` and `pipelineStageId` default from the org config so
// callers don't have to thread them through every call site.

export type GhlOpportunityStatus = "open" | "won" | "lost" | "abandoned";

export type GhlOpportunity = {
  id: string;
  pipelineId: string;
  pipelineStageId: string;
  status: GhlOpportunityStatus;
  monetaryValue: number;
  contactId: string;
  name: string;
  source?: string;
};

export type CreateOpportunityInput = {
  contactId: string;
  name: string;
  /** Defaults to org's `ghlPipelineId`. */
  pipelineId?: string;
  /** Defaults to the "new" stage from `ghlStageIds`. */
  pipelineStageId?: string;
  status?: GhlOpportunityStatus;
  monetaryValue?: number;
  source?: string;
};

type OppCtx = Pick<LogContext, "entityType" | "entityId">;

export async function createOpportunity(
  client: GhlClient,
  input: CreateOpportunityInput,
  ctx?: OppCtx,
): Promise<GhlOpportunity> {
  const pipelineId = input.pipelineId ?? client.config.pipelineId;
  if (!pipelineId) {
    throw new Error(
      "GHL: no pipelineId configured for organization (set Organization.ghlPipelineId).",
    );
  }
  const stageId = input.pipelineStageId ?? client.config.stageIds?.new;
  if (!stageId) {
    throw new Error(
      "GHL: no 'new' stage configured (set Organization.ghlStageIds.new).",
    );
  }
  const res = await client.request<{ opportunity?: GhlOpportunity } & GhlOpportunity>(
    "/opportunities/",
    {
      method: "POST",
      body: {
        locationId: client.config.locationId,
        pipelineId,
        pipelineStageId: stageId,
        contactId: input.contactId,
        name: input.name,
        status: input.status ?? "open",
        monetaryValue: input.monetaryValue ?? 0,
        source: input.source ?? "Safari Studio",
      },
      log: { action: "createOpportunity", ...ctx },
    },
  );
  return res.opportunity ?? (res as GhlOpportunity);
}

export type UpdateOpportunityInput = {
  pipelineStageId?: string;
  status?: GhlOpportunityStatus;
  monetaryValue?: number;
  name?: string;
};

export async function updateOpportunity(
  client: GhlClient,
  opportunityId: string,
  input: UpdateOpportunityInput,
  ctx?: OppCtx,
): Promise<GhlOpportunity> {
  const res = await client.request<{ opportunity?: GhlOpportunity } & GhlOpportunity>(
    `/opportunities/${opportunityId}`,
    {
      method: "PUT",
      body: input,
      log: {
        action: "updateOpportunity",
        entityType: ctx?.entityType ?? "ghl_opportunity",
        entityId: ctx?.entityId ?? opportunityId,
      },
    },
  );
  return res.opportunity ?? (res as GhlOpportunity);
}

/** Move an opportunity to the stage that maps to a Safari Studio
 *  request status. The status → "won" / "lost" / "open" projection
 *  matches what GHL displays in the Kanban summary. The audit log
 *  records the per-stage action ("moveOpportunity:booked" etc.) so the
 *  admin retry view can group transitions cleanly. */
export async function moveOpportunityToStage(
  client: GhlClient,
  opportunityId: string,
  stageKey: StageKey,
  monetaryValue?: number,
  ctx?: OppCtx,
): Promise<GhlOpportunity> {
  const stageId = client.config.stageIds?.[stageKey];
  if (!stageId) {
    throw new Error(
      `GHL: no '${stageKey}' stage configured for organization (Organization.ghlStageIds.${stageKey}).`,
    );
  }
  const status: GhlOpportunityStatus =
    stageKey === "booked" ? "won" : stageKey === "not_booked" ? "lost" : "open";
  const body: UpdateOpportunityInput = {
    pipelineStageId: stageId,
    status,
    ...(monetaryValue !== undefined ? { monetaryValue } : {}),
  };
  const res = await client.request<{ opportunity?: GhlOpportunity } & GhlOpportunity>(
    `/opportunities/${opportunityId}`,
    {
      method: "PUT",
      body,
      log: {
        action: `moveOpportunity:${stageKey}`,
        entityType: ctx?.entityType ?? "ghl_opportunity",
        entityId: ctx?.entityId ?? opportunityId,
      },
    },
  );
  return res.opportunity ?? (res as GhlOpportunity);
}

export async function getOpportunity(
  client: GhlClient,
  opportunityId: string,
  ctx?: OppCtx,
): Promise<GhlOpportunity> {
  const res = await client.request<{ opportunity?: GhlOpportunity } & GhlOpportunity>(
    `/opportunities/${opportunityId}`,
    {
      method: "GET",
      log: {
        action: "getOpportunity",
        entityType: ctx?.entityType ?? "ghl_opportunity",
        entityId: ctx?.entityId ?? opportunityId,
      },
    },
  );
  return res.opportunity ?? (res as GhlOpportunity);
}
