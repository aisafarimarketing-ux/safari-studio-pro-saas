import "server-only";
import { prisma } from "@/lib/prisma";
import { sendEmail, renderBrandedEmail } from "@/lib/mailer";

// Notification dispatch. Two triggers today — new request received, and
// request assigned to a user. Both honour the per-user OrgMembership
// notificationPrefs flags the Profile settings page exposes.
//
// Non-blocking: every call is wrapped in try/catch so a mailer hiccup
// never surfaces as a 500 on the action the user just took.

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/+$/, "");

type PrefKey = "newRequest" | "requestAssigned";

async function recipientsForOrg(
  organizationId: string,
  prefKey: PrefKey,
  opts: { excludeUserId?: string } = {},
): Promise<{ email: string; name: string | null; userId: string }[]> {
  const memberships = await prisma.orgMembership.findMany({
    where: { organizationId },
    include: { user: { select: { id: true, email: true, name: true } } },
  });
  return memberships
    .filter((m) => opts.excludeUserId ? m.userId !== opts.excludeUserId : true)
    .filter((m) => {
      // Default = opt-in: if prefs haven't been set we assume the user
      // wants notifications. Matches the defaults shown in the Profile UI.
      const prefs = (m.notificationPrefs as { [k: string]: unknown } | null) ?? null;
      const v = prefs ? prefs[prefKey] : undefined;
      return v === undefined ? true : Boolean(v);
    })
    .filter((m) => Boolean(m.user?.email))
    .map((m) => ({ email: m.user!.email as string, name: m.user!.name ?? null, userId: m.userId }));
}

function requestUrl(requestId: string): string {
  if (!APP_URL) return `/requests/${requestId}`;
  return `${APP_URL}/requests/${requestId}`;
}

// ─── New request received ─────────────────────────────────────────────────

export async function notifyNewRequest(params: {
  organizationId: string;
  requestId: string;
  referenceNumber: string;
  createdByUserId: string;
  clientName: string | null;
  clientEmail: string;
  source: string | null;
  tripSummary?: string | null;
}): Promise<void> {
  try {
    const recipients = await recipientsForOrg(params.organizationId, "newRequest", {
      excludeUserId: params.createdByUserId,
    });
    if (recipients.length === 0) return;

    const body = `
      <p>A new request just landed in your inbox.</p>
      <table cellpadding="0" cellspacing="0" role="presentation" style="margin-top:14px;font-size:14px;color:rgba(0,0,0,0.75);">
        <tr><td style="padding:4px 12px 4px 0;color:rgba(0,0,0,0.5);">Reference</td><td style="padding:4px 0;font-weight:600;">#${escapeHtml(params.referenceNumber)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:rgba(0,0,0,0.5);">Client</td><td style="padding:4px 0;">${escapeHtml(params.clientName ?? params.clientEmail)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:rgba(0,0,0,0.5);">Email</td><td style="padding:4px 0;">${escapeHtml(params.clientEmail)}</td></tr>
        ${params.source ? `<tr><td style="padding:4px 12px 4px 0;color:rgba(0,0,0,0.5);">Source</td><td style="padding:4px 0;">${escapeHtml(params.source)}</td></tr>` : ""}
        ${params.tripSummary ? `<tr><td style="padding:4px 12px 4px 0;color:rgba(0,0,0,0.5);">Trip</td><td style="padding:4px 0;">${escapeHtml(params.tripSummary)}</td></tr>` : ""}
      </table>`;

    const html = renderBrandedEmail({
      title: `New request · #${params.referenceNumber}`,
      preview: `New enquiry from ${params.clientName ?? params.clientEmail}`,
      body,
      ctaLabel: "Open the request",
      ctaHref: requestUrl(params.requestId),
    });

    // Fan out as individual sends so delivery failures are isolated.
    await Promise.all(
      recipients.map((r) =>
        sendEmail({
          to: r.email,
          subject: `New request · ${params.clientName ?? params.clientEmail}`,
          html,
        }),
      ),
    );
  } catch (err) {
    console.warn("[notifications] notifyNewRequest failed:", err);
  }
}

// ─── Request assigned to a user ───────────────────────────────────────────

export async function notifyAssignment(params: {
  organizationId: string;
  requestId: string;
  referenceNumber: string;
  assigneeUserId: string;
  assignerUserId: string;
  clientName: string | null;
  clientEmail: string;
  tripSummary?: string | null;
}): Promise<void> {
  try {
    // Don't email the assigner themselves.
    if (params.assigneeUserId === params.assignerUserId) return;

    const membership = await prisma.orgMembership.findUnique({
      where: {
        userId_organizationId: { userId: params.assigneeUserId, organizationId: params.organizationId },
      },
      include: { user: { select: { id: true, email: true, name: true } } },
    });
    if (!membership?.user?.email) return;

    const prefs = (membership.notificationPrefs as { requestAssigned?: boolean } | null) ?? null;
    const wantsPing = prefs?.requestAssigned === undefined ? true : Boolean(prefs.requestAssigned);
    if (!wantsPing) return;

    const assigner = await prisma.user.findUnique({
      where: { id: params.assignerUserId },
      select: { name: true, email: true },
    });
    const assignerName = assigner?.name || assigner?.email || "A teammate";

    const body = `
      <p>${escapeHtml(assignerName)} assigned a request to you.</p>
      <table cellpadding="0" cellspacing="0" role="presentation" style="margin-top:14px;font-size:14px;color:rgba(0,0,0,0.75);">
        <tr><td style="padding:4px 12px 4px 0;color:rgba(0,0,0,0.5);">Reference</td><td style="padding:4px 0;font-weight:600;">#${escapeHtml(params.referenceNumber)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:rgba(0,0,0,0.5);">Client</td><td style="padding:4px 0;">${escapeHtml(params.clientName ?? params.clientEmail)}</td></tr>
        ${params.tripSummary ? `<tr><td style="padding:4px 12px 4px 0;color:rgba(0,0,0,0.5);">Trip</td><td style="padding:4px 0;">${escapeHtml(params.tripSummary)}</td></tr>` : ""}
      </table>`;

    const html = renderBrandedEmail({
      title: `Assigned to you · #${params.referenceNumber}`,
      preview: `${assignerName} assigned ${params.clientName ?? params.clientEmail} to you`,
      body,
      ctaLabel: "Open the request",
      ctaHref: requestUrl(params.requestId),
    });

    await sendEmail({
      to: membership.user.email,
      subject: `Assigned · ${params.clientName ?? params.clientEmail}`,
      html,
    });
  } catch (err) {
    console.warn("[notifications] notifyAssignment failed:", err);
  }
}

// ─── Overdue nudge (used by the /api/cron/overdue endpoint) ───────────────

export async function notifyOverdue(params: {
  organizationId: string;
  requestId: string;
  referenceNumber: string;
  assigneeUserId: string;
  hoursStale: number;
  clientName: string | null;
}): Promise<void> {
  try {
    const membership = await prisma.orgMembership.findUnique({
      where: {
        userId_organizationId: { userId: params.assigneeUserId, organizationId: params.organizationId },
      },
      include: { user: { select: { email: true } } },
    });
    if (!membership?.user?.email) return;

    const body = `
      <p>Request <strong>#${escapeHtml(params.referenceNumber)}</strong> for ${escapeHtml(params.clientName ?? "your client")} hasn&apos;t moved in ${params.hoursStale} hours.</p>
      <p style="color:rgba(0,0,0,0.55);font-size:13.5px;">If it&apos;s waiting on them, leave a note so the timeline reflects that. If it&apos;s on your desk, pick it up.</p>`;

    const html = renderBrandedEmail({
      title: `Overdue · #${params.referenceNumber}`,
      preview: `A request assigned to you has been quiet for ${params.hoursStale}h`,
      body,
      ctaLabel: "Open the request",
      ctaHref: requestUrl(params.requestId),
    });

    await sendEmail({
      to: membership.user.email,
      subject: `Overdue · #${params.referenceNumber}`,
      html,
    });
  } catch (err) {
    console.warn("[notifications] notifyOverdue failed:", err);
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
