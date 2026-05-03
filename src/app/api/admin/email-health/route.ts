import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { isMailerConfigured, sendEmail } from "@/lib/mailer";

// GET /api/admin/email-health
//
// Diagnostic endpoint for the reservation email pipeline. Owners +
// admins can hit this in the browser to see exactly why a booking
// notification didn't arrive — without needing to grep server logs.
//
// Returns:
//   config        — RESEND_API_KEY + MAIL_FROM presence (booleans only —
//                   the actual key value is never exposed). The MAIL_FROM
//                   sender + domain are shown so you can verify the
//                   sender is the one you verified in Resend.
//   org           — owner count + their emails (visible only to owners /
//                   admins of the same org).
//   recentReservations — last 3 ProposalReservation rows with the
//                        consultant + assigned-user emails the notifier
//                        would have routed to.
//
// Optional: ?test=1 sends a real test email to the caller's own email
// so you can verify end-to-end deliverability without involving a
// client booking. Returns the mailer's structured result.

export async function GET(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ctx.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return NextResponse.json(
      { error: "Owner or admin required to view email health." },
      { status: 403 },
    );
  }

  const url = new URL(req.url);
  const wantTest = url.searchParams.get("test") === "1";

  const resendKeySet = Boolean(process.env.RESEND_API_KEY?.trim());
  const mailFromRaw = (process.env.MAIL_FROM || "").trim();
  const mailFromSet = Boolean(mailFromRaw);
  // Extract the sender's email + domain from MAIL_FROM. Accepts either
  // bare "user@domain" or "Display Name <user@domain>".
  const mailFromDomain = (() => {
    const m = mailFromRaw.match(/<?([^<>@\s]+)@([^<>\s]+)>?$/);
    return m?.[2] ?? null;
  })();

  // Owners for this org. The notifier picks the first by createdAt as
  // the CC target; multiple owners get listed here in the same order.
  const owners = await prisma.orgMembership.findMany({
    where: { organizationId: ctx.organization.id, role: "owner" },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { email: true, name: true } } },
  });
  const ownerInfo = owners.map((o) => ({
    email: o.user?.email ?? null,
    name: o.user?.name ?? null,
    hasEmail: Boolean(o.user?.email?.trim()),
  }));
  const primaryOwnerEmail = ownerInfo.find((o) => o.hasEmail)?.email ?? null;

  // Most recent reservations + the routing the notifier would have
  // resolved for each. Lets the operator see "this booking would have
  // gone to <x>, CC <y>" and immediately spot a missing-email case.
  const recentReservations = await prisma.proposalReservation.findMany({
    where: { organizationId: ctx.organization.id },
    orderBy: { createdAt: "desc" },
    take: 3,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      createdAt: true,
      assignedUser: { select: { email: true, name: true } },
      proposal: {
        select: {
          title: true,
          trackingId: true,
          user: { select: { email: true, name: true } },
        },
      },
    },
  });

  const reservations = recentReservations.map((r) => {
    const consultantEmail = r.proposal?.user?.email?.trim() || null;
    const assignedEmail = r.assignedUser?.email?.trim() || null;
    // Mirror the notifier's failsafe rules so the diagnostic shows
    // exactly the same routing the reserve route would have used.
    const routeTo = consultantEmail || primaryOwnerEmail || null;
    const routeCc =
      consultantEmail &&
      primaryOwnerEmail &&
      primaryOwnerEmail.toLowerCase() !== consultantEmail.toLowerCase()
        ? primaryOwnerEmail
        : null;
    return {
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      clientName: `${r.firstName} ${r.lastName}`.trim(),
      proposal: r.proposal
        ? { title: r.proposal.title, trackingId: r.proposal.trackingId }
        : null,
      consultant: r.proposal?.user
        ? { email: consultantEmail, name: r.proposal.user.name }
        : null,
      assignedUser: r.assignedUser
        ? { email: assignedEmail, name: r.assignedUser.name }
        : null,
      wouldRoute: { to: routeTo, cc: routeCc },
    };
  });

  // Optional: fire a real test email to the caller. Useful for
  // confirming end-to-end deliverability without making a client
  // booking. Returns the mailer's structured result (ok / skipped /
  // failed) plus the recipient.
  let testResult:
    | null
    | {
        attempted: boolean;
        sentTo?: string;
        ok?: boolean;
        skipped?: boolean;
        error?: string;
      } = null;
  if (wantTest) {
    if (!ctx.user.email) {
      testResult = {
        attempted: false,
        error: "Your User row has no email on file — can't send a test.",
      };
    } else if (!isMailerConfigured()) {
      testResult = {
        attempted: false,
        skipped: true,
        error:
          "Mailer not configured — set RESEND_API_KEY and MAIL_FROM as Railway environment variables.",
      };
    } else {
      const r = await sendEmail({
        to: ctx.user.email,
        subject: "Safari Studio — email health check",
        html: `
          <p>If you received this email, your Safari Studio mailer is configured correctly and reservation notifications should reach you.</p>
          <p style="color:rgba(0,0,0,0.55);font-size:13px;margin-top:18px;">
            Sent from <code>${escapeHtml(mailFromRaw)}</code> · ${new Date().toISOString()}
          </p>`,
      });
      testResult = {
        attempted: true,
        sentTo: ctx.user.email,
        ok: r.ok,
        skipped: r.skipped,
        error: r.error,
      };
    }
  }

  return NextResponse.json({
    config: {
      resendKeySet,
      mailFromSet,
      mailFromValue: mailFromSet ? mailFromRaw : null,
      mailFromDomain,
    },
    org: {
      id: ctx.organization.id,
      name: ctx.organization.name,
      ownerCount: owners.length,
      ownersWithEmail: ownerInfo.filter((o) => o.hasEmail).length,
      owners: ownerInfo,
      primaryOwnerEmail,
    },
    recentReservations: reservations,
    test: testResult,
    // One-line summary of what to fix first. Surfaces the most-likely
    // blocker so the user doesn't have to interpret the raw fields.
    diagnosis: diagnose({
      resendKeySet,
      mailFromSet,
      ownersWithEmail: ownerInfo.filter((o) => o.hasEmail).length,
      consultantEmailsMissingOnRecent: reservations.filter(
        (r) => !r.consultant?.email,
      ).length,
    }),
  });
}

function diagnose(input: {
  resendKeySet: boolean;
  mailFromSet: boolean;
  ownersWithEmail: number;
  consultantEmailsMissingOnRecent: number;
}): string {
  if (!input.resendKeySet || !input.mailFromSet) {
    return (
      "Mailer not configured. Set RESEND_API_KEY and MAIL_FROM in Railway → " +
      "Variables, redeploy, then retest. Until you do, the reserve route " +
      'persists the booking but skips email — the dialog will show "received" ' +
      'rather than "sent".'
    );
  }
  if (input.ownersWithEmail === 0 && input.consultantEmailsMissingOnRecent > 0) {
    return (
      "Mailer is configured, but the consultant on recent proposals has no " +
      "email and no org owner has an email either — the notifier has nowhere " +
      "to route. Check Settings → Team / Your profile to fill these in."
    );
  }
  if (input.consultantEmailsMissingOnRecent > 0) {
    return (
      "Mailer is configured. Some recent reservations show no consultant email " +
      "but an owner email is available — they'll route to the owner. Fill in " +
      "the consultant's profile email so it routes correctly."
    );
  }
  return (
    "Mailer + recipients look healthy. If you still aren't receiving the email, " +
    "verify the MAIL_FROM domain is verified in Resend, then hit " +
    "/api/admin/email-health?test=1 to fire a test email to your own address."
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
