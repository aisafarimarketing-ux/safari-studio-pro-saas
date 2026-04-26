import "server-only";
import type { Organization } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// ─── GoHighLevel HTTP client ───────────────────────────────────────────────
//
// Per-org credentials, single retry-aware request wrapper, every call
// audited to IntegrationLog. The service layer (contacts/opportunities/
// messages/workflows) goes through this — never call fetch() directly.
//
// Architecture rules (enforced by convention, see Phase 1 prompt):
//   1. Server-only. Importing this file from a client component will fail.
//   2. Per-org. `getGhlClient(orgId)` reads credentials from the
//      Organization row; returns null when the org hasn't connected GHL.
//      Callers must handle null as a no-op, never as an error.
//   3. Append-only audit. Every request writes one IntegrationLog row
//      regardless of success/failure. Logging failures must NEVER throw
//      out of this wrapper.
//   4. Idempotent retries. 408 / 425 / 429 / 5xx retried up to 3 times
//      with exponential backoff. Other failures fail fast.

const GHL_BASE_URL = "https://services.leadconnectorhq.com";
const GHL_VERSION_HEADER = "2021-07-28";

const RETRY_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 400;

// ── Types ────────────────────────────────────────────────────────────────

export type GhlConfig = {
  accessToken: string;
  locationId: string;
  pipelineId?: string;
  stageIds?: Record<string, string>;
  workflowIds?: Record<string, string>;
};

/** Stable mapping from internal Request status to a key in `ghlStageIds`.
 *  The `ghlStageIds` JSON on Organization is keyed by these strings. */
export const STAGE_KEYS = ["new", "working", "proposal_sent", "booked", "not_booked"] as const;
export type StageKey = (typeof STAGE_KEYS)[number];

/** Stable mapping from internal event to a key in `ghlWorkflowIds`. */
export const WORKFLOW_KEYS = [
  "proposal_sent",
  "proposal_viewed",
  "deposit_paid",
  "reservation_followup",
] as const;
export type WorkflowKey = (typeof WORKFLOW_KEYS)[number];

export type LogContext = {
  /** Short verb identifying the operation, e.g. "createContact",
   *  "moveOpportunity", "triggerWorkflow:proposal_sent". */
  action: string;
  /** Local entity that triggered this call — for filtering the log. */
  entityType?: string;
  entityId?: string;
};

export type GhlRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  log: LogContext;
};

export type GhlClient = {
  config: GhlConfig;
  organizationId: string;
  /** Low-level escape hatch. Prefer the typed wrappers in
   *  contacts/opportunities/messages/workflows. */
  request<T = unknown>(path: string, opts: GhlRequestOptions): Promise<T>;
};

// ── Errors ───────────────────────────────────────────────────────────────

export class GhlError extends Error {
  status?: number;
  body?: unknown;
  constructor(message: string, opts?: { status?: number; body?: unknown }) {
    super(message);
    this.name = "GhlError";
    this.status = opts?.status;
    this.body = opts?.body;
  }
}

// ── Config helpers ───────────────────────────────────────────────────────

/** Returns true when the org has at least token + location configured.
 *  The pipeline/stage/workflow IDs are checked at the call site so a
 *  partially-configured org can still sync contacts even if pipeline
 *  routing isn't wired yet. */
export function isGhlConfigured(
  org: Pick<Organization, "ghlAccessToken" | "ghlLocationId">,
): boolean {
  return !!(org.ghlAccessToken && org.ghlLocationId);
}

export function readGhlConfig(org: Organization): GhlConfig | null {
  if (!org.ghlAccessToken || !org.ghlLocationId) return null;
  return {
    accessToken: org.ghlAccessToken,
    locationId: org.ghlLocationId,
    pipelineId: org.ghlPipelineId ?? undefined,
    stageIds: parseStringMap(org.ghlStageIds),
    workflowIds: parseStringMap(org.ghlWorkflowIds),
  };
}

function parseStringMap(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== "object") return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "string" && v.length > 0) out[k] = v;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

// ── Factory ──────────────────────────────────────────────────────────────

/** Loads the org and returns a typed client. Returns null when GHL isn't
 *  configured for the org — callers must treat that as a no-op, not an
 *  error. */
export async function getGhlClient(
  organizationId: string,
): Promise<GhlClient | null> {
  const org = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!org) return null;
  const config = readGhlConfig(org);
  if (!config) return null;
  return makeClient(config, organizationId);
}

/** Same as `getGhlClient` but takes the Organization row directly — saves
 *  a DB round-trip when the caller has already loaded it. */
export function getGhlClientFromOrg(org: Organization): GhlClient | null {
  const config = readGhlConfig(org);
  if (!config) return null;
  return makeClient(config, org.id);
}

function makeClient(config: GhlConfig, organizationId: string): GhlClient {
  return {
    config,
    organizationId,
    async request<T>(path: string, opts: GhlRequestOptions): Promise<T> {
      return ghlRequest<T>(config, path, organizationId, opts);
    },
  };
}

// ── Core request ─────────────────────────────────────────────────────────

async function ghlRequest<T>(
  config: GhlConfig,
  path: string,
  organizationId: string,
  opts: GhlRequestOptions,
): Promise<T> {
  const url = new URL(GHL_BASE_URL + path);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }

  const init: RequestInit = {
    method: opts.method ?? "GET",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      Version: GHL_VERSION_HEADER,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  };

  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url.toString(), init);
      const text = await res.text();
      const parsed = text ? safeJsonParse(text) : null;

      if (!res.ok) {
        // Retry transient failures with exponential backoff.
        if (RETRY_STATUS.has(res.status) && attempt < MAX_ATTEMPTS) {
          await sleep(BASE_DELAY_MS * 2 ** (attempt - 1));
          continue;
        }
        await writeLog({
          organizationId,
          ...opts.log,
          status: "failed",
          requestPayload: opts.body ?? null,
          responsePayload: parsed,
          errorMessage: `${res.status} ${res.statusText}`,
          attemptCount: attempt,
        });
        throw new GhlError(
          `GHL ${opts.method ?? "GET"} ${path} → ${res.status} ${res.statusText}`,
          { status: res.status, body: parsed },
        );
      }

      await writeLog({
        organizationId,
        ...opts.log,
        status: "success",
        requestPayload: opts.body ?? null,
        responsePayload: parsed,
        errorMessage: null,
        attemptCount: attempt,
      });
      return parsed as T;
    } catch (err) {
      // Already a GhlError — bubble (we logged it above).
      if (err instanceof GhlError) throw err;
      lastErr = err;
      // Network / fetch failure — same retry policy as transient HTTP.
      if (attempt < MAX_ATTEMPTS) {
        await sleep(BASE_DELAY_MS * 2 ** (attempt - 1));
        continue;
      }
      const msg = err instanceof Error ? err.message : String(err);
      await writeLog({
        organizationId,
        ...opts.log,
        status: "failed",
        requestPayload: opts.body ?? null,
        responsePayload: null,
        errorMessage: msg,
        attemptCount: attempt,
      });
      throw new GhlError(`GHL request to ${path} failed: ${msg}`);
    }
  }

  // Unreachable in practice — the loop either returns or throws — but
  // keeps TypeScript happy without an `as never`.
  throw new GhlError(
    `GHL request to ${path} exhausted retries: ${String(lastErr)}`,
  );
}

// ── Audit log ────────────────────────────────────────────────────────────

async function writeLog(args: {
  organizationId: string;
  action: string;
  entityType?: string;
  entityId?: string;
  status: "success" | "failed" | "pending";
  requestPayload: unknown;
  responsePayload: unknown;
  errorMessage: string | null;
  attemptCount: number;
}): Promise<void> {
  try {
    await prisma.integrationLog.create({
      data: {
        organizationId: args.organizationId,
        provider: "ghl",
        action: args.action,
        entityType: args.entityType ?? null,
        entityId: args.entityId ?? null,
        status: args.status,
        requestPayload: toJsonOrNull(args.requestPayload),
        responsePayload: toJsonOrNull(args.responsePayload),
        errorMessage: args.errorMessage ?? null,
        attemptCount: args.attemptCount,
      },
    });
  } catch (err) {
    // Logging is best-effort. A failing log write must NEVER mask the
    // underlying API outcome to the caller.
    console.warn("[ghl] failed to write IntegrationLog:", err);
  }
}

function toJsonOrNull(v: unknown): import("@prisma/client").Prisma.InputJsonValue | undefined {
  if (v === null || v === undefined) return undefined;
  // Prisma accepts plain objects / arrays / primitives. Re-encode to
  // strip anything that wouldn't round-trip (Date → ISO string, etc.).
  try {
    return JSON.parse(JSON.stringify(v));
  } catch {
    return undefined;
  }
}

// ── Utilities ────────────────────────────────────────────────────────────

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}
