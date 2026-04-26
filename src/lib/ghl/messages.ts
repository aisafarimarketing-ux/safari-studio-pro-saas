import "server-only";
import type { GhlClient, LogContext } from "./client";

// ─── GoHighLevel — conversations / messages ───────────────────────────────
//
// Outgoing message wrappers. Phase 4 calls these from the inbox composer
// and from the reservation-followup flow; Phase 1 only ships the typed
// surface so callers compile cleanly.
//
// Inbound messages don't go through here — they arrive via the
// /api/webhooks/ghl/messages endpoint built in Phase 4.

export type GhlMessageType = "Email" | "SMS" | "WhatsApp";

export type SendEmailInput = {
  contactId: string;
  /** Sender email. Must match a verified domain in the org's GHL
   *  workspace — operator's free-mail address won't pass GHL's send
   *  policy. Phase 4 will validate before send. */
  emailFrom: string;
  emailTo: string;
  subject: string;
  /** HTML body. When omitted, GHL falls back to `message` as plain text. */
  html?: string;
  /** Plain-text body. Always include — used as the fallback view in
   *  email clients that block HTML. */
  message?: string;
};

export type SendSmsInput = {
  contactId: string;
  message: string;
};

export type SendWhatsAppInput = {
  contactId: string;
  message: string;
};

/** GHL returns slightly different shapes depending on plan. We
 *  normalise to the two IDs the rest of the system actually uses. */
export type GhlMessageResult = {
  conversationId: string;
  messageId: string;
};

type MsgCtx = Pick<LogContext, "entityType" | "entityId">;

export async function sendEmailMessage(
  client: GhlClient,
  input: SendEmailInput,
  ctx?: MsgCtx,
): Promise<GhlMessageResult> {
  const raw = await client.request<RawMessageResponse>("/conversations/messages", {
    method: "POST",
    body: { type: "Email" satisfies GhlMessageType, ...input },
    log: { action: "sendEmail", ...ctx },
  });
  return normaliseResult(raw);
}

export async function sendSmsMessage(
  client: GhlClient,
  input: SendSmsInput,
  ctx?: MsgCtx,
): Promise<GhlMessageResult> {
  const raw = await client.request<RawMessageResponse>("/conversations/messages", {
    method: "POST",
    body: { type: "SMS" satisfies GhlMessageType, ...input },
    log: { action: "sendSms", ...ctx },
  });
  return normaliseResult(raw);
}

export async function sendWhatsAppMessage(
  client: GhlClient,
  input: SendWhatsAppInput,
  ctx?: MsgCtx,
): Promise<GhlMessageResult> {
  const raw = await client.request<RawMessageResponse>("/conversations/messages", {
    method: "POST",
    body: { type: "WhatsApp" satisfies GhlMessageType, ...input },
    log: { action: "sendWhatsApp", ...ctx },
  });
  return normaliseResult(raw);
}

// ── Internal ────────────────────────────────────────────────────────────

type RawMessageResponse = {
  conversationId?: string;
  messageId?: string;
  msg?: string;
  // Some GHL plans nest the IDs.
  data?: { conversationId?: string; messageId?: string };
};

function normaliseResult(raw: RawMessageResponse): GhlMessageResult {
  const conversationId = raw.conversationId ?? raw.data?.conversationId ?? "";
  const messageId = raw.messageId ?? raw.data?.messageId ?? "";
  return { conversationId, messageId };
}
