import "server-only";
import type { GhlClient, LogContext, WorkflowKey } from "./client";

// ─── GoHighLevel — workflow triggers ──────────────────────────────────────
//
// Adds a contact to a workflow with structured custom data. The
// workflow itself is built in GHL (proposal-sent follow-up sequence,
// deposit-paid confirmation, etc.); we only feed it the triggering
// event + payload.
//
// Phase 3 wires the four canonical events:
//   proposal_sent · proposal_viewed · deposit_paid · reservation_followup

type WfCtx = Pick<LogContext, "entityType" | "entityId">;

/** Add a contact to a workflow.
 *
 *  `workflow` accepts either:
 *    - a stable WorkflowKey ("proposal_sent" etc.) — looked up in the
 *      org's `ghlWorkflowIds` map. Use this everywhere it fits;
 *    - a raw GHL workflow ID — escape hatch for one-off triggers
 *      (e.g. an admin tool firing a custom workflow).
 */
export async function triggerWorkflow(
  client: GhlClient,
  contactId: string,
  workflow: WorkflowKey | string,
  customData: Record<string, unknown> = {},
  ctx?: WfCtx,
): Promise<void> {
  const workflowId = resolveWorkflowId(client, workflow);
  if (!workflowId) {
    throw new Error(
      `GHL: no workflow id mapped for '${workflow}' (set Organization.ghlWorkflowIds.${workflow}).`,
    );
  }
  await client.request<unknown>(`/contacts/${contactId}/workflow/${workflowId}`, {
    method: "POST",
    body: Object.keys(customData).length > 0 ? { customData } : {},
    log: { action: `triggerWorkflow:${workflow}`, ...ctx },
  });
}

/** Remove a contact from a workflow — useful when a Request changes
 *  state mid-sequence and the running follow-up cadence is no longer
 *  appropriate (e.g. client booked while the "proposal viewed" nudge
 *  workflow is still firing). */
export async function removeFromWorkflow(
  client: GhlClient,
  contactId: string,
  workflow: WorkflowKey | string,
  ctx?: WfCtx,
): Promise<void> {
  const workflowId = resolveWorkflowId(client, workflow);
  if (!workflowId) {
    throw new Error(
      `GHL: no workflow id mapped for '${workflow}' (set Organization.ghlWorkflowIds.${workflow}).`,
    );
  }
  await client.request<unknown>(
    `/contacts/${contactId}/workflow/${workflowId}`,
    {
      method: "DELETE",
      log: { action: `removeFromWorkflow:${workflow}`, ...ctx },
    },
  );
}

function resolveWorkflowId(client: GhlClient, workflow: string): string | null {
  const mapped = client.config.workflowIds?.[workflow];
  if (mapped) return mapped;
  // If the caller passed a raw GHL workflow ID instead of a stable key,
  // assume it's already a real ID. GHL workflow IDs are 24+ hex chars,
  // so a plain key like "proposal_sent" won't match a workflow on its
  // own and `mapped` would be null — caller error surfaced via the
  // null return.
  if (/^[A-Za-z0-9_-]{20,}$/.test(workflow)) return workflow;
  return null;
}
