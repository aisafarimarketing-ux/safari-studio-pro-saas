import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { sendEmail, isMailerConfigured } from "@/lib/mailer";
import { canAutoSend, classifyMomentum } from "@/lib/dealMomentum";

// POST /api/suggestions/[id]/auto-send
//
// Fires the auto-follow-up. Called by the dashboard's countdown when
// it hits zero — re-validates every spec condition server-side, then
// dispatches the message via Resend (email channel only in v1).
//
// On success, the row picks up:
//   autoSent: true, sentAt = now, status = "applied", outcome = "sent"
//
// On a failed condition, returns 422 with the reason. On a mailer
// failure, returns 500 with the error from the Resend HTTP API.
//
// The dashboard re-fetches /api/dashboard/activity after this returns
// so the card flips to "Auto-follow-up sent" without a manual reload.

export async function POST(
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

  if (!isMailerConfigured()) {
    return NextResponse.json(
      {
        error:
          "Mailer not configured — set RESEND_API_KEY and MAIL_FROM in Railway environment.",
      },
      { status: 500 },
    );
  }

  const row = await prisma.aISuggestion.findUnique({
    where: { id },
    select: {
      id: true,
      organizationId: true,
      userId: true,
      kind: true,
      targetType: true,
      targetId: true,
      output: true,
      channel: true,
      sentAt: true,
      autoSent: true,
      autoSendScheduledFor: true,
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
  if (!row.autoSendScheduledFor) {
    return NextResponse.json(
      { error: "No auto-send schedule on this suggestion." },
      { status: 422 },
    );
  }
  const isOwnerOrAdmin = auth.role === "owner" || auth.role === "admin";
  const isAuthor = row.userId === auth.user.id;
  if (!isOwnerOrAdmin && !isAuthor) {
    return NextResponse.json({ error: "Not authorised" }, { status: 403 });
  }

  // Re-load the proposal + activity summary + last sent. Conditions
  // can shift between schedule time and fire time (operator might have
  // sent manually, status might have cooled, client might have
  // started reservation) — the spec calls these out explicitly under
  // "SAFETY".
  const proposal = await prisma.proposal.findUnique({
    where: { id: row.targetId },
    select: {
      id: true,
      organizationId: true,
      title: true,
      client: {
        select: { firstName: true, lastName: true, email: true },
      },
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
  const clientEmail = proposal.client?.email?.trim();
  if (!clientEmail) {
    await prisma.aISuggestion.update({
      where: { id: row.id },
      data: { autoSendScheduledFor: null },
    });
    return NextResponse.json(
      { error: "Client has no email on file — auto-send cancelled." },
      { status: 422 },
    );
  }

  const lastSent = await prisma.aISuggestion.findFirst({
    where: {
      organizationId: auth.organization.id,
      kind: "follow-up",
      targetType: "proposal",
      targetId: proposal.id,
      sentAt: { not: null },
      id: { not: row.id },
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
    lastClientReplyAt: null,
    channel: row.channel === "email" ? "email" : row.channel === "whatsapp" ? "whatsapp" : null,
  });
  if (!decision.ok) {
    // Conditions changed — abort cleanly. Drop the schedule so the
    // dashboard doesn't try again on the next poll.
    await prisma.aISuggestion.update({
      where: { id: row.id },
      data: { autoSendScheduledFor: null },
    });
    return NextResponse.json({ error: decision.reason, aborted: true }, { status: 422 });
  }

  // Build the email. The model's draft uses the "Subject: ...\n\nbody"
  // shape when channel === "email"; parse it back so the Resend
  // request can carry a real subject line.
  const parsed = parseEmailDraft(row.output);
  const fullName = [
    proposal.client?.firstName,
    proposal.client?.lastName,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
  const replyTo = await resolveOperatorEmail(auth.organization.id, row.userId);

  const result = await sendEmail({
    to: clientEmail,
    subject: parsed.subject,
    text: parsed.body,
    html: bodyToHtml(parsed.body),
    replyTo: replyTo ?? undefined,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error ?? "Mailer failed", skipped: result.skipped ?? false },
      { status: 500 },
    );
  }

  const updated = await prisma.aISuggestion.update({
    where: { id: row.id },
    data: {
      autoSent: true,
      sentAt: new Date(),
      autoSendScheduledFor: null,
      channel: "email",
      status: "applied",
      appliedAt: new Date(),
      outcome: "sent",
    },
    select: {
      id: true,
      autoSent: true,
      sentAt: true,
      channel: true,
      output: true,
    },
  });

  console.log(
    `[autoSend] dispatched suggestion ${row.id} → ${clientEmail} (proposal ${proposal.id}, fullName="${fullName}")`,
  );

  return NextResponse.json({
    ok: true,
    suggestion: updated,
  });
}

function parseEmailDraft(draft: string): { subject: string; body: string } {
  const m = /^subject:\s*([^\n]+)\n\n([\s\S]+)$/i.exec(draft);
  return {
    subject: m?.[1]?.trim() || "Following up on your safari proposal",
    body: m?.[2]?.trim() || draft,
  };
}

// Tiny text-to-HTML so the Resend request carries both shapes. We keep
// this basic — preserve paragraph breaks, escape entities, no
// markdown. Auto-sent messages should look like an email a human
// drafted, not a marketing campaign.
function bodyToHtml(body: string): string {
  const escaped = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const paragraphs = escaped
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;line-height:1.55;color:#0a1411;">${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:14.5px;color:#0a1411;">${paragraphs}</div>`;
}

async function resolveOperatorEmail(
  organizationId: string,
  userId: string | null,
): Promise<string | null> {
  // Reply-to is the consultant who owns the suggestion (so client
  // replies thread back to them, not to the no-reply MAIL_FROM).
  // Falls back to the org owner when the suggestion's author has no
  // email row, mirroring src/lib/notifications.ts routing.
  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    const email = user?.email?.trim();
    if (email) return email;
  }
  const owner = await prisma.orgMembership.findFirst({
    where: { organizationId, role: "owner" },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { email: true } } },
  });
  return owner?.user?.email?.trim() || null;
}
