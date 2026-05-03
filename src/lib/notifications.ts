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

// ─── Reservation received (client booking from /p/[id]) ──────────────────
//
// Fires when a ProposalReservation row is created via the public reserve
// endpoint. Routes the notification to the consultant who owns the
// proposal with a CC to the org owner so the booking is visible across
// the team without surfacing it to the client.
//
// Failsafe rules:
//   • consultant email present  → TO consultant, CC owner (when distinct)
//   • consultant email missing  → TO owner only
//   • owner email missing       → TO consultant only (no CC)
//   • both missing              → log + no-op, never throw
//
// All errors are caught and logged. The reservation row is already
// persisted by the time this runs — the response to the client never
// depends on email delivery.

export async function notifyReservationReceived(params: {
  organizationId: string;
  proposalId: string;
  /** Display tracking id — either the persisted Proposal.trackingId
   *  ("PRO-2026-0042") or the legacy id.slice(-8) fallback for
   *  proposals created before that column landed. The caller should
   *  resolve this via displayTrackingId(proposal) so legacy and new
   *  proposals look identical in the email subject. */
  trackingId: string;
  proposalTitle: string | null;
  reservationId: string;
  /** Email of the consultant who owns the proposal (proposal.user.email). */
  consultantEmail: string | null;
  consultantName: string | null;
  // Reservation fields — passed in rather than re-queried so the caller
  // can hand over what it already has from the create() response.
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  nationality: string | null;
  arrivalDate: Date;
  departureDate: Date;
  travelers: string;
  notes: string | null;
}): Promise<void> {
  const tag = `[notifications] reservationReceived(${params.reservationId})`;
  try {
    // Resolve the org owner via OrgMembership(role="owner"). There can
    // be multiple owners; we take the first by createdAt for stability.
    // Falls back to null when an org has no owner row (legacy / pre-
    // membership data) so the failsafe rules below kick in.
    const ownerMembership = await prisma.orgMembership.findFirst({
      where: { organizationId: params.organizationId, role: "owner" },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { email: true, name: true } } },
    });
    const ownerEmail = ownerMembership?.user?.email?.trim() || null;

    const consultantEmail = params.consultantEmail?.trim() || null;

    // Apply the failsafe routing rules.
    let to: string | null = null;
    let cc: string | null = null;
    if (consultantEmail) {
      to = consultantEmail;
      // CC owner only when distinct from the consultant — avoids
      // duplicate delivery to the same inbox when the consultant IS
      // the owner.
      cc = ownerEmail && ownerEmail.toLowerCase() !== consultantEmail.toLowerCase()
        ? ownerEmail
        : null;
    } else if (ownerEmail) {
      to = ownerEmail;
    }

    console.log(`${tag} routing →`, {
      to,
      cc,
      replyTo: consultantEmail,
      proposalId: params.proposalId,
    });

    if (!to) {
      console.warn(
        `${tag} no consultant or owner email available — reservation persisted but no email sent.`,
        { organizationId: params.organizationId, proposalId: params.proposalId },
      );
      return;
    }

    // Subject uses the caller-supplied tracking id ("PRO-2026-0042"
    // for proposals created after the trackingId column landed; the
    // legacy id.slice(-8) format for older rows). The consultant name
    // lands in parentheses so a mail-rule sort-by-consultant works
    // even when subjects render differently across clients.
    const trackingId = params.trackingId;
    const tripTitle = params.proposalTitle?.trim() || "Untitled proposal";
    const consultantLabel = params.consultantName?.trim() || "Unassigned";
    const subject =
      `[Reservation #${trackingId}] ${tripTitle} — ${params.clientName} ` +
      `(Consultant: ${consultantLabel})`;

    // Body — clean dl-style table inside the branded shell so every
    // field is scannable at a glance. Dates render in the server's TZ
    // as ISO date strings (YYYY-MM-DD) since the form captured them
    // that way and we don't want timezone drift in an internal email.
    const arrival = params.arrivalDate.toISOString().slice(0, 10);
    const departure = params.departureDate.toISOString().slice(0, 10);
    const rows: Array<[string, string]> = [
      ["Tracking", `#${trackingId}`],
      ["Reservation ID", params.reservationId],
      ["Proposal", tripTitle],
      ["Consultant", consultantLabel],
      ["Client", params.clientName],
      ["Phone", params.clientPhone],
      ["Email", params.clientEmail],
      ["Nationality", params.nationality || "—"],
      ["Arrival", arrival],
      ["Departure", departure],
      ["Travelers", params.travelers || "—"],
      ["Notes", params.notes || "—"],
    ];
    const body = `
      <p>A client just submitted a reservation request from their proposal.</p>
      <table cellpadding="0" cellspacing="0" role="presentation" style="margin-top:14px;font-size:14px;color:rgba(0,0,0,0.78);">
        ${rows
          .map(
            ([label, value]) => `
        <tr>
          <td style="padding:5px 14px 5px 0;color:rgba(0,0,0,0.5);vertical-align:top;white-space:nowrap;">${escapeHtml(label)}</td>
          <td style="padding:5px 0;font-weight:500;white-space:pre-wrap;">${escapeHtml(value)}</td>
        </tr>`,
          )
          .join("")}
      </table>
      <p style="margin-top:18px;color:rgba(0,0,0,0.55);font-size:13px;">
        Reach out within 24 hours to confirm availability — that&apos;s the promise the client saw on the
        booking screen.
      </p>`;

    const ctaHref = APP_URL
      ? `${APP_URL}/studio/${params.proposalId}`
      : `/studio/${params.proposalId}`;
    const html = renderBrandedEmail({
      title: `Reservation · ${params.clientName}`,
      preview: `New booking from ${params.clientName} for ${tripTitle}`,
      body,
      ctaLabel: "View in Safari Studio",
      ctaHref,
    });

    const result = await sendEmail({
      to,
      cc: cc ?? undefined,
      subject,
      html,
      // Reply-To threads any reply from the operator's inbox back
      // to the consultant directly, even when the email came TO the
      // owner. When the consultant has no email we drop Reply-To and
      // let MAIL_REPLY_TO env handle the default.
      replyTo: consultantEmail ?? undefined,
    });

    if (result.skipped) {
      console.log(`${tag} mailer not configured — would have sent to`, { to, cc });
    } else if (!result.ok) {
      console.warn(`${tag} send failed:`, result.error, { to, cc });
    } else {
      console.log(`${tag} sent`, { to, cc });
    }
  } catch (err) {
    console.warn(`${tag} unexpected error:`, err);
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
