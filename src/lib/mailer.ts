import "server-only";

// Transactional email adapter. Uses Resend (https://resend.com) when
// RESEND_API_KEY is set; no-ops otherwise so local dev and un-keyed
// deploys keep working without crashing — matches the same pattern as
// the Supabase Storage fallback we built for image uploads.
//
// Env vars:
//   RESEND_API_KEY        Resend secret key (re_...)
//   MAIL_FROM             "Safari Studio <noreply@yourdomain.tld>" — verified sender
//   MAIL_REPLY_TO         optional, for human replies to route back
//
// When these aren't configured we log the intended send and move on.
// Callers should never await this — it's fire-and-forget; wrap in the
// `sendEmail` helper below which swallows all errors.

export type SendEmailInput = {
  to: string | string[];
  /** Optional CC recipients. Resend forwards this verbatim — same
   *  delivery semantics as the To field, just listed in the visible
   *  Cc header so all recipients can see who else got the message. */
  cc?: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
};

export function isMailerConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.MAIL_FROM?.trim());
}

export async function sendEmail(input: SendEmailInput): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  if (!isMailerConfigured()) {
    // Intentional console so Railway logs show what would have been sent.
    console.log("[mailer] skipping — RESEND_API_KEY / MAIL_FROM not set. Would send:", {
      to: input.to,
      cc: input.cc,
      subject: input.subject,
    });
    return { ok: true, skipped: true };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.RESEND_API_KEY!.trim()}`,
      },
      body: JSON.stringify({
        from: process.env.MAIL_FROM!.trim(),
        to: Array.isArray(input.to) ? input.to : [input.to],
        cc: input.cc
          ? (Array.isArray(input.cc) ? input.cc : [input.cc])
          : undefined,
        subject: input.subject,
        html: input.html,
        text: input.text,
        reply_to: input.replyTo || process.env.MAIL_REPLY_TO?.trim() || undefined,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.warn("[mailer] Resend returned non-OK:", res.status, detail.slice(0, 200));
      return { ok: false, error: `Resend HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    console.warn("[mailer] send failed:", err);
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}

// ─── Template helpers ──────────────────────────────────────────────────────

export function renderBrandedEmail({
  title,
  preview,
  body,
  ctaLabel,
  ctaHref,
  footer,
}: {
  title: string;
  preview: string;
  body: string;
  ctaLabel?: string;
  ctaHref?: string;
  footer?: string;
}): string {
  // Plain, inlined styles — most email clients ignore <style> tags in <head>.
  // Kept minimal so the template works across Gmail, Outlook, Apple Mail.
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f8f5ef;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a1a;">
    <div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(preview)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8f5ef;padding:40px 20px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:12px;border:1px solid rgba(0,0,0,0.08);overflow:hidden;">
            <tr>
              <td style="padding:28px 32px 20px;border-bottom:1px solid rgba(0,0,0,0.06);">
                <div style="font-family:'Playfair Display',Georgia,serif;font-size:22px;font-weight:700;color:#1b3a2d;letter-spacing:-0.01em;">
                  Safari Studio
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px 8px;">
                <h1 style="margin:0 0 14px;font-family:'Playfair Display',Georgia,serif;font-size:22px;font-weight:600;color:rgba(0,0,0,0.88);line-height:1.2;">${escapeHtml(title)}</h1>
                <div style="font-size:15px;line-height:1.6;color:rgba(0,0,0,0.75);">
                  ${body}
                </div>
              </td>
            </tr>
            ${ctaHref && ctaLabel ? `
            <tr>
              <td style="padding:12px 32px 32px;">
                <a href="${escapeHtml(ctaHref)}" style="display:inline-block;background:#1b3a2d;color:#ffffff;text-decoration:none;font-size:13px;font-weight:600;padding:12px 22px;border-radius:999px;">
                  ${escapeHtml(ctaLabel)}
                </a>
              </td>
            </tr>` : ""}
            <tr>
              <td style="padding:20px 32px;border-top:1px solid rgba(0,0,0,0.06);font-size:12px;color:rgba(0,0,0,0.45);">
                ${escapeHtml(footer ?? "You can manage your notification preferences from Settings → Your profile.")}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
