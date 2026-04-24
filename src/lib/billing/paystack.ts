import crypto from "crypto";

// ─── Paystack API client ────────────────────────────────────────────────────
//
// Thin wrapper around the Paystack REST API. We use the secret key for
// all server calls; the public key is only for frontend checkout (not
// used here — we hand off to Paystack's hosted checkout_url).
//
// Why not the @paystack/inline-js SDK? Hosted checkout keeps the card
// form off our domain entirely (no PCI scope), and redirect flows are
// easier to debug than inline.

const API_BASE = "https://api.paystack.co";

export function paystackSecretKey(): string | null {
  const k = process.env.PAYSTACK_SECRET_KEY?.trim();
  return k && k.length > 0 ? k : null;
}

type InitTransactionInput = {
  email: string;
  amountInCents: number;
  currency?: "USD" | "KES" | "NGN" | "GHS" | "ZAR";
  planCode?: string;              // subscribe to a plan — Paystack auto-charges
  callbackUrl?: string;            // Paystack redirects here after payment
  metadata?: Record<string, unknown>;
  reference?: string;              // optional idempotency key
};

type InitTransactionResponse = {
  status: boolean;
  message: string;
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
};

export async function initTransaction(input: InitTransactionInput): Promise<InitTransactionResponse["data"]> {
  const key = paystackSecretKey();
  if (!key) throw new Error("PAYSTACK_SECRET_KEY not configured");

  const body = {
    email: input.email,
    amount: input.amountInCents,
    currency: input.currency ?? "USD",
    ...(input.planCode ? { plan: input.planCode } : {}),
    ...(input.callbackUrl ? { callback_url: input.callbackUrl } : {}),
    ...(input.metadata ? { metadata: input.metadata } : {}),
    ...(input.reference ? { reference: input.reference } : {}),
  };

  const res = await fetch(`${API_BASE}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as InitTransactionResponse;
  if (!res.ok || !json.status) {
    throw new Error(json.message || `Paystack init failed (HTTP ${res.status})`);
  }
  return json.data;
}

type VerifyTransactionResponse = {
  status: boolean;
  message: string;
  data: {
    amount: number;
    currency: string;
    status: string; // "success" | "abandoned" | "failed"
    reference: string;
    customer: { email: string; customer_code: string };
    plan?: string | null;
    metadata?: Record<string, unknown>;
    authorization?: { authorization_code: string } | null;
  };
};

export async function verifyTransaction(reference: string): Promise<VerifyTransactionResponse["data"]> {
  const key = paystackSecretKey();
  if (!key) throw new Error("PAYSTACK_SECRET_KEY not configured");
  const res = await fetch(`${API_BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  const json = (await res.json()) as VerifyTransactionResponse;
  if (!res.ok || !json.status) {
    throw new Error(json.message || `Paystack verify failed (HTTP ${res.status})`);
  }
  return json.data;
}

// ─── Subscription disable (server-side, no email-token dance) ──────────────
// Paystack's POST /subscription/disable requires BOTH subscription_code
// and email_token. The token comes from the subscription object — we
// store it on the Organization row when the subscription webhook fires
// so we can cancel without the customer-email round trip.

type DisableSubscriptionInput = {
  subscriptionCode: string;
  emailToken: string;
};

export async function disableSubscription({ subscriptionCode, emailToken }: DisableSubscriptionInput): Promise<void> {
  const key = paystackSecretKey();
  if (!key) throw new Error("PAYSTACK_SECRET_KEY not configured");
  const res = await fetch(`${API_BASE}/subscription/disable`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ code: subscriptionCode, token: emailToken }),
  });
  const json = (await res.json()) as { status: boolean; message?: string };
  if (!res.ok || !json.status) {
    // Don't throw on "already disabled" — treat as success idempotently.
    if (json.message && json.message.toLowerCase().includes("already")) return;
    throw new Error(json.message || `Paystack disable failed (HTTP ${res.status})`);
  }
}

// ─── Webhook signature verification ────────────────────────────────────────
// Paystack signs webhook bodies with HMAC-SHA512 using the merchant's
// secret key. We verify before trusting any event.

export function verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!signatureHeader) return false;
  const key = paystackSecretKey();
  if (!key) return false;
  const expected = crypto.createHmac("sha512", key).update(rawBody).digest("hex");
  // Timing-safe compare — lengths differ only on bad signatures.
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signatureHeader, "hex"));
  } catch {
    return false;
  }
}
