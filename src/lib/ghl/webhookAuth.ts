import "server-only";
import crypto from "crypto";

// ─── GHL inbound-webhook authentication ────────────────────────────────────
//
// GHL workflow builder lets operators add custom headers to outbound
// webhook actions. The simplest robust auth is a static Bearer token —
// operators copy GHL_WEBHOOK_SECRET into the workflow's
//   Authorization: Bearer <secret>
// header. We compare in constant time on receipt.
//
// When the secret is unset (typical in dev), we accept all calls and
// flag the open-door reason in the response so it surfaces in logs.

export function verifyGhlWebhook(headers: Headers): { ok: boolean; reason?: string } {
  const secret = process.env.GHL_WEBHOOK_SECRET;
  if (!secret) {
    // Dev convenience — operators haven't configured a secret yet.
    return { ok: true, reason: "secret-not-configured" };
  }
  const auth = headers.get("authorization");
  if (!auth || !auth.toLowerCase().startsWith("bearer ")) {
    return { ok: false, reason: "missing-bearer" };
  }
  const provided = auth.slice(7).trim();
  if (provided.length !== secret.length) {
    return { ok: false, reason: "length-mismatch" };
  }
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return crypto.timingSafeEqual(a, b) ? { ok: true } : { ok: false, reason: "mismatch" };
}
