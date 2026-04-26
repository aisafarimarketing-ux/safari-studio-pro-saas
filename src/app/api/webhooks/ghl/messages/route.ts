import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyGhlWebhook } from "@/lib/ghl/webhookAuth";

// ─── POST /api/webhooks/ghl/messages ───────────────────────────────────────
//
// Inbound message webhook fired by GHL when a contact replies on any
// channel. Public endpoint — middleware excludes /api/webhooks via
// isOrgAgnosticRoute. Authenticated via Bearer token (see webhookAuth.ts).
//
// Idempotency: every inbound row is keyed on Message.ghlMessageId
// (unique). Repeated deliveries upsert into the same row instead of
// duplicating — GHL can deliver the same event twice without harm.
//
// Tenant routing: the payload's locationId resolves to one
// Organization.ghlLocationId. When the locationId doesn't match any
// org we 200 anyway (so GHL stops retrying) and log the orphan.
//
// Payload shape — defensive parsing because GHL nests differently
// across SMS / Email / WhatsApp:
//   {
//     locationId, contactId, conversationId, messageId,
//     messageType: "Email" | "SMS" | "WhatsApp" | "Call",
//     direction: "inbound",
//     body, subject?,
//     dateAdded?
//   }

const VALID_CHANNELS = new Set(["email", "sms", "whatsapp", "call"]);

export async function POST(req: Request) {
  // Verify the bearer token before reading the body so we don't burn
  // CPU on unsigned traffic.
  const auth = verifyGhlWebhook(req.headers);
  if (!auth.ok) {
    console.warn("[ghl-webhook] auth failed:", auth.reason);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data = unwrap(payload);
  const locationId = pickString(data, ["locationId", "location_id"]);
  const contactId = pickString(data, ["contactId", "contact_id"]);
  const conversationId = pickString(data, ["conversationId", "conversation_id"]);
  const ghlMessageId = pickString(data, ["messageId", "message_id", "id"]);
  const rawType = pickString(data, ["messageType", "type", "channel"]) ?? "";
  const channel = rawType.toLowerCase();
  const body = pickString(data, ["body", "message", "text"]) ?? "";
  const subject = pickString(data, ["subject"]);
  const direction =
    (pickString(data, ["direction"]) ?? "inbound").toLowerCase();

  if (!locationId) {
    console.warn("[ghl-webhook] missing locationId; payload keys:", Object.keys(data));
    return NextResponse.json({ ok: true, ignored: "no-location" });
  }
  if (!contactId) {
    return NextResponse.json({ ok: true, ignored: "no-contact" });
  }
  if (!ghlMessageId) {
    return NextResponse.json({ ok: true, ignored: "no-message-id" });
  }
  if (direction !== "inbound") {
    // Outbound echoes from GHL when the operator sent a message via the
    // GHL UI directly — we already have those rows when sent through
    // /api/messages/send, and we don't sync the GHL-UI-only path.
    return NextResponse.json({ ok: true, ignored: "outbound-echo" });
  }
  if (!VALID_CHANNELS.has(channel)) {
    return NextResponse.json({ ok: true, ignored: `unknown-channel:${channel}` });
  }

  // ── Tenant routing ─────────────────────────────────────────────────────
  const org = await prisma.organization.findFirst({
    where: { ghlLocationId: locationId },
    select: { id: true },
  });
  if (!org) {
    console.warn("[ghl-webhook] no org matched locationId:", locationId);
    // 200 so GHL doesn't retry — this is a misconfiguration, not a
    // transient error.
    return NextResponse.json({ ok: true, ignored: "org-not-found" });
  }

  // ── Find the client by ghlContactId ────────────────────────────────────
  const client = await prisma.client.findFirst({
    where: { organizationId: org.id, ghlContactId: contactId },
    select: { id: true },
  });
  if (!client) {
    // Inbound for an unknown contact — log and 200. Most likely the
    // contact was synced manually in GHL. Future: auto-create a Client.
    await prisma.integrationLog.create({
      data: {
        organizationId: org.id,
        provider: "ghl",
        action: "inboundMessage:noClient",
        entityType: "ghl_contact",
        entityId: contactId,
        status: "failed",
        errorMessage: "Inbound message for a GHL contact not yet linked to a Client.",
        requestPayload: data as Prisma.InputJsonValue,
      },
    }).catch(() => {});
    return NextResponse.json({ ok: true, ignored: "client-not-found" });
  }

  // ── Find the latest active request for the client ─────────────────────
  // "active" = not in a terminal status. If none exists, fall back to
  // the most recent request of any status. If still none, store the
  // message with requestId=null (still linked to client).
  const activeRequest = await prisma.request.findFirst({
    where: {
      organizationId: org.id,
      clientId: client.id,
      status: { in: ["new", "working", "open"] },
    },
    orderBy: { lastActivityAt: "desc" },
    select: { id: true },
  });
  const fallbackRequest = activeRequest
    ? null
    : await prisma.request.findFirst({
        where: { organizationId: org.id, clientId: client.id },
        orderBy: { lastActivityAt: "desc" },
        select: { id: true },
      });
  const requestId = activeRequest?.id ?? fallbackRequest?.id ?? null;

  // ── Idempotent upsert ─────────────────────────────────────────────────
  // ghlMessageId is unique, so if the same event redelivers we update
  // in place rather than create a duplicate row.
  const existing = await prisma.message.findUnique({
    where: { ghlMessageId },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ ok: true, deduped: true, messageId: existing.id });
  }

  const message = await prisma.message.create({
    data: {
      organizationId: org.id,
      requestId,
      clientId: client.id,
      direction: "inbound",
      channel,
      subject: subject ?? null,
      body,
      status: "received",
      provider: "ghl",
      ghlMessageId,
      ghlConversationId: conversationId ?? null,
    },
  });

  // ── Side effects: bump request activity, mark not-booked-status as
  //    "active" (operator clearly has something to follow up), log to
  //    activity feed.
  if (requestId) {
    await prisma.request.update({
      where: { id: requestId },
      data: { lastActivityAt: new Date() },
    });
  }
  // Activity feed entry — webhook is system-driven so we attribute it
  // to the org's first member (alphabetical-by-membership creation).
  // The Message row is itself the source of truth for the inbound
  // event; the activity log is a secondary feed for the dashboard.
  // If no member exists we skip the row cleanly.
  const attributableUserId = await firstMemberUserId(org.id);
  if (attributableUserId) {
    await prisma.activityEvent
      .create({
        data: {
          organizationId: org.id,
          userId: attributableUserId,
          type: "messageReceived",
          targetType: "message",
          targetId: message.id,
          detail: {
            channel,
            requestId,
            clientId: client.id,
            ghlConversationId: conversationId ?? null,
          },
        },
      })
      .catch((err) => {
        console.warn("[ghl-webhook] activity log failed:", err);
      });
  }

  return NextResponse.json({ ok: true, messageId: message.id });
}

// ── Helpers ────────────────────────────────────────────────────────────────

function unwrap(payload: Record<string, unknown>): Record<string, unknown> {
  // GHL sometimes wraps the actual event in a `data` envelope.
  if (payload && typeof payload === "object" && "data" in payload && typeof payload.data === "object" && payload.data) {
    return payload.data as Record<string, unknown>;
  }
  return payload;
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

async function firstMemberUserId(orgId: string): Promise<string | null> {
  const m = await prisma.orgMembership.findFirst({
    where: { organizationId: orgId },
    orderBy: { createdAt: "asc" },
    select: { userId: true },
  });
  return m?.userId ?? null;
}
