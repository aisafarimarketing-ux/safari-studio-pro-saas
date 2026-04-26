import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { getGhlClient } from "@/lib/ghl/client";
import {
  sendEmailMessage,
  sendSmsMessage,
  sendWhatsAppMessage,
} from "@/lib/ghl/messages";
import { upsertContact } from "@/lib/ghl/contacts";
import { recordActivity } from "@/lib/activity";

// ─── POST /api/messages/send ───────────────────────────────────────────────
//
// Outbound message — operator types in the Conversation panel, hits send.
//
// Flow per Phase 4 spec:
//   1. Validate org + client/request ownership
//   2. Persist a draft Message row in OUR DB (source of truth)
//   3. Send via GHL conversations API (transport)
//   4. On success, flip status → "sent" + stamp ghlMessageId / ghlConversationId
//   5. On failure, flip status → "failed" — never throw out of the route
//
// Auto-upserts the GHL contact when the linked Client doesn't have
// ghlContactId yet (matches the auto-sync behaviour in Phase 3's
// triggerProposalSent).

const VALID_CHANNELS = new Set(["email", "sms", "whatsapp"]);

type Body = {
  requestId?: string;
  clientId?: string;
  channel?: string;
  subject?: string;
  body?: string;
};

export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ctx.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }
  if (!ctx.orgActive) {
    return NextResponse.json({ error: "Account suspended", code: "ORG_SUSPENDED" }, { status: 402 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const channel = body.channel?.trim().toLowerCase();
  if (!channel || !VALID_CHANNELS.has(channel)) {
    return NextResponse.json(
      { error: "channel must be one of: email, sms, whatsapp" },
      { status: 400 },
    );
  }
  const messageBody = body.body?.trim();
  if (!messageBody) {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }
  const subject = body.subject?.trim() || null;
  if (channel === "email" && !subject) {
    return NextResponse.json({ error: "subject is required for email" }, { status: 400 });
  }

  const clientId = body.clientId?.trim();
  if (!clientId) {
    return NextResponse.json({ error: "clientId is required" }, { status: 400 });
  }
  const requestId = body.requestId?.trim() || null;

  // Validate ownership — client must belong to org, request (if given)
  // must belong to org AND link to that client.
  const client = await prisma.client.findFirst({
    where: { id: clientId, organizationId: ctx.organization.id },
  });
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }
  if (requestId) {
    const request = await prisma.request.findFirst({
      where: { id: requestId, organizationId: ctx.organization.id, clientId: client.id },
      select: { id: true },
    });
    if (!request) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }
  }

  // Channel-specific contact validation.
  if ((channel === "sms" || channel === "whatsapp") && !client.phone) {
    return NextResponse.json(
      { error: `Client has no phone number on file — required for ${channel}.` },
      { status: 400 },
    );
  }
  if (channel === "email" && !client.email) {
    return NextResponse.json({ error: "Client has no email on file." }, { status: 400 });
  }

  // ── Step 1: persist the draft. Source of truth — every message lands
  //    here first, GHL is just transport.
  const draft = await prisma.message.create({
    data: {
      organizationId: ctx.organization.id,
      requestId,
      clientId: client.id,
      direction: "outbound",
      channel,
      subject,
      body: messageBody,
      status: "draft",
      provider: "ghl",
    },
  });

  // ── Step 2: resolve GHL client. Without it, we keep the draft so the
  //    operator can retry once GHL is connected; surface the reason.
  const ghl = await getGhlClient(ctx.organization.id);
  if (!ghl) {
    await prisma.message.update({
      where: { id: draft.id },
      data: { status: "failed" },
    });
    return NextResponse.json(
      {
        message: { ...draft, status: "failed" },
        error: "GHL is not connected for this organisation. Add credentials in settings before sending.",
      },
      { status: 200 },
    );
  }

  // ── Step 3: ensure the GHL contact exists. Auto-upsert on the fly so
  //    blank-canvas clients (Phase 2 sync hasn't run) don't dead-end.
  let ghlContactId = client.ghlContactId;
  if (!ghlContactId) {
    try {
      const contact = await upsertContact(
        ghl,
        {
          firstName: client.firstName ?? undefined,
          lastName: client.lastName ?? undefined,
          name: [client.firstName, client.lastName].filter(Boolean).join(" ").trim() || client.email,
          email: client.email,
          phone: client.phone ?? undefined,
          source: "Safari Studio",
          tags: ["safari-studio"],
        },
        { entityType: "message", entityId: draft.id },
      );
      ghlContactId = contact.id;
      await prisma.client.update({
        where: { id: client.id },
        data: { ghlContactId },
      });
    } catch (err) {
      console.warn("[messages.send] auto-upsert contact failed:", err);
      await prisma.message.update({
        where: { id: draft.id },
        data: { status: "failed" },
      });
      return NextResponse.json(
        { message: { ...draft, status: "failed" }, error: "Failed to sync contact to GHL." },
        { status: 200 },
      );
    }
  }

  // ── Step 4: send via the right GHL channel.
  try {
    const operatorEmail = ctx.user.email?.trim();
    let result;
    if (channel === "email") {
      if (!operatorEmail) {
        throw new Error("Your user profile has no email — set one before sending email.");
      }
      result = await sendEmailMessage(
        ghl,
        {
          contactId: ghlContactId,
          emailFrom: operatorEmail,
          emailTo: client.email,
          subject: subject ?? "",
          message: messageBody,
          html: messageBody,
        },
        { entityType: "message", entityId: draft.id },
      );
    } else if (channel === "sms") {
      result = await sendSmsMessage(
        ghl,
        { contactId: ghlContactId, message: messageBody },
        { entityType: "message", entityId: draft.id },
      );
    } else {
      result = await sendWhatsAppMessage(
        ghl,
        { contactId: ghlContactId, message: messageBody },
        { entityType: "message", entityId: draft.id },
      );
    }

    // ── Step 5: success — stamp IDs and bump request lastActivityAt
    const updated = await prisma.message.update({
      where: { id: draft.id },
      data: {
        status: "sent",
        ghlMessageId: result.messageId || null,
        ghlConversationId: result.conversationId || null,
      },
    });
    if (requestId) {
      await prisma.request.update({
        where: { id: requestId },
        data: { lastActivityAt: new Date() },
      });
    }

    // Activity feed entry — the dashboard's recent-activity tile reads
    // from this. Fire-and-forget; an audit-log failure must not turn a
    // successful send into a failure response.
    void recordActivity({
      userId: ctx.user.id,
      organizationId: ctx.organization.id,
      type: "messageSent",
      targetType: "message",
      targetId: updated.id,
      detail: { channel, requestId, clientId: client.id },
    });

    return NextResponse.json({ message: updated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[messages.send] GHL send failed (${draft.id}):`, msg);
    const failed = await prisma.message.update({
      where: { id: draft.id },
      data: { status: "failed" },
    });
    return NextResponse.json(
      { message: failed, error: msg },
      { status: 200 },
    );
  }
}
