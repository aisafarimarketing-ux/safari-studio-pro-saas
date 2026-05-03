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
// All errors are caught and logged. Returns a structured result so the
// reserve route can surface the delivery status honestly to the client
// — we don't claim "sent" in the dialog when the mailer was actually
// skipped because RESEND_API_KEY isn't set.
//
// Reservation persistence is independent of this function — by the
// time we run, the row is already saved.

export type ReservationDeliveryResult =
  | {
      status: "sent";
      to: string;
      cc: string | null;
    }
  | {
      status: "skipped";
      /** Why the mailer no-op'd. "mailer-not-configured" means
       *  RESEND_API_KEY or MAIL_FROM is missing on the server. */
      reason: "mailer-not-configured";
      to: string;
      cc: string | null;
    }
  | {
      status: "no-recipient";
      reason: "no-consultant-or-owner-email";
    }
  | {
      status: "failed";
      reason: string;
      to: string;
      cc: string | null;
    };

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
}): Promise<ReservationDeliveryResult> {
  const tag = `[notifications] reservationReceived(${params.reservationId})`;

  // Loud env-check upfront so the cause shows up in Railway logs
  // before anything else. If RESEND_API_KEY or MAIL_FROM is missing,
  // the mailer will skip — and the operator will keep wondering why
  // emails never arrive. Make the missing config impossible to miss.
  const hasResendKey = Boolean(process.env.RESEND_API_KEY?.trim());
  const hasMailFrom = Boolean(process.env.MAIL_FROM?.trim());
  if (!hasResendKey || !hasMailFrom) {
    console.warn(
      `${tag} mailer config incomplete — `
        + `RESEND_API_KEY=${hasResendKey ? "set" : "MISSING"} `
        + `MAIL_FROM=${hasMailFrom ? "set" : "MISSING"}. `
        + `Set both as Railway environment variables to enable delivery.`,
    );
  }

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
      consultantEmailPresent: Boolean(consultantEmail),
      ownerEmailPresent: Boolean(ownerEmail),
    });

    if (!to) {
      console.warn(
        `${tag} no consultant or owner email available — reservation persisted but no email sent.`,
        { organizationId: params.organizationId, proposalId: params.proposalId },
      );
      return { status: "no-recipient", reason: "no-consultant-or-owner-email" };
    }

    // Subject uses the caller-supplied tracking id ("PRO-2026-0042"
    // for proposals created after the trackingId column landed; the
    // legacy id.slice(-8) format for older rows). The consultant name
    // lands in parentheses so a mail-rule sort-by-consultant works
    // even when subjects render differently across clients.
    const trackingId = params.trackingId;
    const tripTitle = params.proposalTitle?.trim() || "Untitled proposal";
    const consultantLabel = params.consultantName?.trim() || "Unassigned";
    const firstName = params.clientName.split(/\s+/)[0] || params.clientName;
    const subject =
      `🔥 [Reservation #${trackingId}] ${params.clientName} ready to confirm — ${tripTitle}`;

    // Pull the activity summary so the signal line reflects what the
    // client actually did pre-booking (Viewed pricing, Tapped
    // itinerary, etc.) rather than a static string. Best-effort —
    // missing summary just means the signal line shows the booking
    // submission alone.
    const summary = await prisma.proposalActivitySummary.findUnique({
      where: { proposalId: params.proposalId },
      select: {
        priceViewed: true,
        itineraryClicked: true,
        clickedReservation: true,
      },
    });
    const signals: string[] = [];
    if (summary?.priceViewed) signals.push("Viewed pricing");
    if (summary?.itineraryClicked) signals.push("Tapped itinerary");
    if (summary?.clickedReservation) signals.push("Started booking form");
    signals.push("Submitted reservation");
    const signalText = signals.join(" + ");

    const arrival = params.arrivalDate.toISOString().slice(0, 10);
    const departure = params.departureDate.toISOString().slice(0, 10);
    const tripNights = Math.max(
      1,
      Math.round(
        (params.departureDate.getTime() - params.arrivalDate.getTime()) /
          86_400_000,
      ),
    );

    const studioUrl = APP_URL
      ? `${APP_URL}/studio/${params.proposalId}`
      : `/studio/${params.proposalId}`;
    const dashboardUrl = APP_URL ? `${APP_URL}/dashboard` : `/dashboard`;

    // Re-usable section header — small uppercase eyebrow above each
    // grouped block. Inline so every email client renders it.
    const sectionLabel = (label: string) =>
      `<div style="font-size:10.5px;color:rgba(0,0,0,0.45);font-weight:700;letter-spacing:0.22em;text-transform:uppercase;margin:22px 0 8px;">${escapeHtml(label)}</div>`;
    const row = (label: string, value: string) =>
      `<tr>
        <td style="padding:4px 14px 4px 0;color:rgba(0,0,0,0.5);vertical-align:top;white-space:nowrap;font-size:13.5px;">${escapeHtml(label)}</td>
        <td style="padding:4px 0;color:rgba(0,0,0,0.85);font-weight:500;white-space:pre-wrap;font-size:13.5px;">${escapeHtml(value)}</td>
      </tr>`;

    // Body — sales-alert structure: subtext → priority block →
    // grouped sections (Trip / Client / Context) → next-step block →
    // dual CTAs. No data-dump table; each section answers one
    // question the consultant has when this lands.
    const body = `
      <!-- Subtext -->
      <p style="margin:0 0 18px;color:rgba(0,0,0,0.7);font-size:14.5px;line-height:1.55;">
        ${escapeHtml(firstName)} just submitted a booking request and is waiting for confirmation.
      </p>

      <!-- Priority block -->
      <table cellpadding="0" cellspacing="0" role="presentation" style="background:#fef2f2;border:1px solid rgba(220,38,38,0.22);border-left:4px solid #dc2626;border-radius:10px;width:100%;margin:0 0 6px;">
        <tr>
          <td style="padding:14px 18px;">
            <div style="font-size:10.5px;color:#991b1b;font-weight:700;letter-spacing:0.20em;text-transform:uppercase;margin-bottom:8px;">
              <span style="display:inline-block;background:linear-gradient(135deg,#dc2626 0%,#991b1b 100%);color:#fff;padding:3px 8px;border-radius:4px;letter-spacing:0.18em;margin-right:6px;">Status · Very hot</span>
            </div>
            <table cellpadding="0" cellspacing="0" role="presentation" style="font-size:13px;color:rgba(0,0,0,0.78);">
              <tr><td style="padding:2px 12px 2px 0;color:rgba(0,0,0,0.55);font-weight:600;white-space:nowrap;">Signal</td><td style="padding:2px 0;">${escapeHtml(signalText)}</td></tr>
              <tr><td style="padding:2px 12px 2px 0;color:rgba(0,0,0,0.55);font-weight:600;white-space:nowrap;">Timing</td><td style="padding:2px 0;">Just now</td></tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- Trip -->
      ${sectionLabel("Trip")}
      <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;">
        ${row("Proposal", tripTitle)}
        ${row("Tracking", `#${trackingId}`)}
        ${row("Dates", `${arrival} → ${departure} · ${tripNights} ${tripNights === 1 ? "night" : "nights"}`)}
        ${row("Travelers", params.travelers || "—")}
      </table>

      <!-- Client -->
      ${sectionLabel("Client")}
      <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;">
        ${row("Name", params.clientName)}
        ${row("Phone", params.clientPhone)}
        ${row("Email", params.clientEmail)}
        ${row("Nationality", params.nationality || "—")}
      </table>

      <!-- Context -->
      ${sectionLabel("Context")}
      <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;">
        ${row("Consultant", consultantLabel)}
        ${row("Reservation ID", params.reservationId)}
        ${params.notes ? row("Notes", params.notes) : ""}
      </table>

      <!-- Next step -->
      <table cellpadding="0" cellspacing="0" role="presentation" style="background:#f0fdf4;border:1px solid rgba(22,163,74,0.22);border-left:4px solid #16a34a;border-radius:10px;width:100%;margin:24px 0 6px;">
        <tr>
          <td style="padding:14px 18px;">
            <div style="font-size:10.5px;color:#166534;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;margin-bottom:8px;">
              Next step
            </div>
            <ul style="margin:0;padding-left:20px;font-size:13px;color:rgba(0,0,0,0.8);line-height:1.6;">
              <li>Send payment instructions or confirm availability immediately.</li>
              <li>Follow up within 1–2 hours for highest conversion.</li>
            </ul>
          </td>
        </tr>
      </table>

      <!-- CTAs -->
      <table cellpadding="0" cellspacing="0" role="presentation" style="margin:22px 0 0;">
        <tr>
          <td style="padding-right:6px;">
            <a href="${escapeHtml(studioUrl)}" style="display:inline-block;background:#1b3a2d;color:#ffffff;text-decoration:none;font-size:13.5px;font-weight:700;padding:12px 22px;border-radius:8px;letter-spacing:0.005em;">
              Confirm booking →
            </a>
          </td>
          <td>
            <a href="${escapeHtml(dashboardUrl)}" style="display:inline-block;color:#1b3a2d;text-decoration:none;font-size:13px;font-weight:600;padding:12px 14px;">
              View full activity →
            </a>
          </td>
        </tr>
      </table>`;

    const html = renderBrandedEmail({
      title: "🔥 New reservation request — ready to confirm",
      preview: `${params.clientName} just submitted a booking — ${tripTitle}`,
      body,
      // CTAs are inline in the body so the consultant sees both
      // "Confirm booking" and "View full activity" without scrolling.
      // Override the default footer with the conversion nudge.
      footer:
        "Clients who receive a response within 1 hour are far more likely to book.",
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
      return { status: "skipped", reason: "mailer-not-configured", to, cc };
    }
    if (!result.ok) {
      console.warn(`${tag} send failed:`, result.error, { to, cc });
      return {
        status: "failed",
        reason: result.error ?? "unknown",
        to,
        cc,
      };
    }
    console.log(`${tag} sent`, { to, cc });
    return { status: "sent", to, cc };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "unknown";
    console.warn(`${tag} unexpected error:`, err);
    return { status: "failed", reason, to: "", cc: null };
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
