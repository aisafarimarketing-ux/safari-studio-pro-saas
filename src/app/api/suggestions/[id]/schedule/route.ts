import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import {
  AUTO_SEND_DEFAULT_DELAY_MS,
  canAutoSend,
  classifyMomentum,
} from "@/lib/dealMomentum";

// POST   /api/suggestions/[id]/schedule  — schedule an auto-send.
// DELETE /api/suggestions/[id]/schedule  — cancel a scheduled auto-send.
//
// POST body: { delayMs?: number }
//   delayMs — overrides the default 12-minute window. Clamped to
//   60..30*60 seconds so a careless caller can't ship an immediate or
//   absurdly delayed schedule.
//
// Server-side conditions are re-validated at schedule time via
// canAutoSend(); a follow-up validation runs again at fire time inside
// /api/suggestions/[id]/auto-send so a deal that cools in the
// intervening minutes doesn't auto-fire anyway.

const MIN_DELAY_MS = 60 * 1000;
const MAX_DELAY_MS = 30 * 60 * 1000;

type Body = { delayMs?: number };

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!auth.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "Suggestion id required" }, { status: 400 });

  const row = await prisma.aISuggestion.findUnique({
    where: { id },
    select: {
      id: true,
      organizationId: true,
      userId: true,
      kind: true,
      targetType: true,
      targetId: true,
      channel: true,
      sentAt: true,
      autoSent: true,
    },
  });
  if (!row || row.organizationId !== auth.organization.id) {
    return NextResponse.json({ error: "Suggestion not found" }, { status: 404 });
  }
  if (row.kind !== "follow-up" || row.targetType !== "proposal") {
    return NextResponse.json(
      { error: "Auto-send only applies to proposal follow-ups." },
      { status: 400 },
    );
  }
  if (row.sentAt || row.autoSent) {
    return NextResponse.json(
      { error: "This suggestion was already sent." },
      { status: 409 },
    );
  }
  const isOwnerOrAdmin = auth.role === "owner" || auth.role === "admin";
  const isAuthor = row.userId === auth.user.id;
  if (!isOwnerOrAdmin && !isAuthor) {
    return NextResponse.json({ error: "Not authorised" }, { status: 403 });
  }

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    /* empty body is fine */
  }
  const requested = typeof body.delayMs === "number" ? body.delayMs : AUTO_SEND_DEFAULT_DELAY_MS;
  const delayMs = Math.max(MIN_DELAY_MS, Math.min(MAX_DELAY_MS, requested));

  // Re-load the activity summary + last sent timestamp + linked client
  // so we can run the spec's safety conditions server-side. The client
  // already pre-validates via canAutoSend on the dashboard, but this
  // is the authoritative gate.
  const proposal = await prisma.proposal.findUnique({
    where: { id: row.targetId },
    select: {
      id: true,
      organizationId: true,
      client: { select: { email: true, phone: true } },
      activitySummary: {
        select: {
          lastEventAt: true,
          lastEventType: true,
          priceViewed: true,
          clickedReservation: true,
          reservationCompleted: true,
        },
      },
    },
  });
  if (!proposal || proposal.organizationId !== auth.organization.id) {
    return NextResponse.json({ error: "Linked proposal not found" }, { status: 404 });
  }
  const summary = proposal.activitySummary;

  const lastSent = await prisma.aISuggestion.findFirst({
    where: {
      organizationId: auth.organization.id,
      kind: "follow-up",
      targetType: "proposal",
      targetId: proposal.id,
      sentAt: { not: null },
    },
    orderBy: { sentAt: "desc" },
    select: { sentAt: true },
  });

  const momentum = classifyMomentum({
    lastEventAt: summary?.lastEventAt ?? null,
    lastEventType: summary?.lastEventType ?? null,
    lastOperatorMessageAt: lastSent?.sentAt ?? null,
    reservationCompleted: summary?.reservationCompleted ?? false,
    priceViewed: summary?.priceViewed ?? false,
    clickedReservation: summary?.clickedReservation ?? false,
  });

  const decision = canAutoSend({
    momentum: momentum.momentum,
    lastEventAt: summary?.lastEventAt ?? null,
    lastEventType: summary?.lastEventType ?? null,
    priceViewed: summary?.priceViewed ?? false,
    clickedReservation: summary?.clickedReservation ?? false,
    reservationCompleted: summary?.reservationCompleted ?? false,
    lastOperatorMessageAt: lastSent?.sentAt ?? null,
    // Reply tracking isn't wired yet — pass null so canAutoSend's
    // reply gate is a no-op. When the inbound webhook lands we'll
    // populate this.
    lastClientReplyAt: null,
    channel: row.channel === "email" ? "email" : row.channel === "whatsapp" ? "whatsapp" : null,
  });
  if (!decision.ok) {
    return NextResponse.json({ error: decision.reason }, { status: 422 });
  }

  // Channel-specific contact check — WhatsApp needs a phone, Email
  // needs an email. The decision above already rejects an empty
  // channel; here we enforce the contact method actually exists.
  const channel = row.channel === "whatsapp" ? "whatsapp" : row.channel === "email" ? "email" : null;
  if (channel === "whatsapp" && !proposal.client?.phone?.trim()) {
    return NextResponse.json(
      { error: "Client has no WhatsApp number — add one to enable auto-send." },
      { status: 422 },
    );
  }
  if (channel === "email" && !proposal.client?.email?.trim()) {
    return NextResponse.json(
      { error: "Client has no email on file — cannot auto-send." },
      { status: 422 },
    );
  }

  const fireAt = new Date(Date.now() + delayMs);
  const updated = await prisma.aISuggestion.update({
    where: { id: row.id },
    data: { autoSendScheduledFor: fireAt },
    select: { id: true, autoSendScheduledFor: true, channel: true },
  });

  return NextResponse.json({
    ok: true,
    suggestion: updated,
    fireAt: fireAt.toISOString(),
    delayMs,
  });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!auth.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "Suggestion id required" }, { status: 400 });

  const row = await prisma.aISuggestion.findUnique({
    where: { id },
    select: { id: true, organizationId: true, userId: true },
  });
  if (!row || row.organizationId !== auth.organization.id) {
    return NextResponse.json({ error: "Suggestion not found" }, { status: 404 });
  }
  const isOwnerOrAdmin = auth.role === "owner" || auth.role === "admin";
  const isAuthor = row.userId === auth.user.id;
  if (!isOwnerOrAdmin && !isAuthor) {
    return NextResponse.json({ error: "Not authorised" }, { status: 403 });
  }

  await prisma.aISuggestion.update({
    where: { id: row.id },
    data: { autoSendScheduledFor: null },
  });

  return NextResponse.json({ ok: true });
}
