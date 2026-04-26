import "server-only";
import type { GhlClient, LogContext } from "./client";

// ─── GoHighLevel — contacts ───────────────────────────────────────────────
//
// Thin typed wrappers over /contacts/. Phase 2 calls `upsertContact`
// from the Request-creation flow; the returned `id` becomes
// Client.ghlContactId.

export type GhlCustomField = {
  /** GHL accepts either `key` (the field's machine name) or `id` (the
   *  field UUID). We standardise on `key` because it survives a GHL
   *  workspace rebuild without our DB needing a remap. */
  key: string;
  field_value: string | number | boolean;
};

export type GhlContactInput = {
  firstName?: string;
  lastName?: string;
  /** Display name. GHL prefers firstName/lastName when present, falls
   *  back to `name` for single-name contacts. */
  name?: string;
  email?: string;
  phone?: string;
  source?: string;
  tags?: string[];
  customFields?: GhlCustomField[];
};

export type GhlContact = {
  id: string;
  locationId?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  phone?: string;
  tags?: string[];
  customFields?: GhlCustomField[];
};

type ContactCtx = Pick<LogContext, "entityType" | "entityId">;

/** Idempotent create-or-update keyed by email (and locationId). The
 *  preferred entry point — Safari Studio dedupes clients by email so
 *  this matches our model. */
export async function upsertContact(
  client: GhlClient,
  input: GhlContactInput,
  ctx?: ContactCtx,
): Promise<GhlContact> {
  const res = await client.request<{ contact?: GhlContact } & GhlContact>(
    "/contacts/upsert",
    {
      method: "POST",
      body: { ...input, locationId: client.config.locationId },
      log: { action: "upsertContact", ...ctx },
    },
  );
  // GHL returns either `{ contact: {...} }` or the contact at the root
  // depending on plan. Normalise so callers don't have to care.
  return res.contact ?? (res as GhlContact);
}

/** Strict create. Use only when you know the contact doesn't exist —
 *  otherwise prefer `upsertContact`. */
export async function createContact(
  client: GhlClient,
  input: GhlContactInput,
  ctx?: ContactCtx,
): Promise<GhlContact> {
  const res = await client.request<{ contact?: GhlContact } & GhlContact>(
    "/contacts/",
    {
      method: "POST",
      body: { ...input, locationId: client.config.locationId },
      log: { action: "createContact", ...ctx },
    },
  );
  return res.contact ?? (res as GhlContact);
}

export async function updateContact(
  client: GhlClient,
  contactId: string,
  input: Partial<GhlContactInput>,
  ctx?: ContactCtx,
): Promise<GhlContact> {
  const res = await client.request<{ contact?: GhlContact } & GhlContact>(
    `/contacts/${contactId}`,
    {
      method: "PUT",
      body: input,
      log: {
        action: "updateContact",
        entityType: ctx?.entityType ?? "ghl_contact",
        entityId: ctx?.entityId ?? contactId,
      },
    },
  );
  return res.contact ?? (res as GhlContact);
}

/** Add tags incrementally without overwriting existing ones. */
export async function addContactTags(
  client: GhlClient,
  contactId: string,
  tags: string[],
  ctx?: ContactCtx,
): Promise<void> {
  if (tags.length === 0) return;
  await client.request<unknown>(`/contacts/${contactId}/tags`, {
    method: "POST",
    body: { tags },
    log: {
      action: "addContactTags",
      entityType: ctx?.entityType ?? "ghl_contact",
      entityId: ctx?.entityId ?? contactId,
    },
  });
}
