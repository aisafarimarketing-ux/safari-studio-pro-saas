// ─── Proposal value extraction ───────────────────────────────────────────
//
// Importable from BOTH server and client: extractProposalValueCents
// runs in API routes for rollups, formatMoneyCompact runs in the
// client TeamSupervisionPage + AnalyticsPage. No Prisma / no Node
// APIs — just pure JSON-to-money math, so no "server-only" guard.
//
// Pulls a money value out of a Proposal.contentJson blob so analytics
// + team-page rollups can show pipeline $ without a dedicated column.
//
// Reads:
//   contentJson.client.adults / .children — traveller counts
//   contentJson.activeTier                — selected tier key
//   contentJson.pricing[tier].pricePerPerson — adult price (string)
//   contentJson.pricing[tier].childPrice     — child price (optional)
//   contentJson.pricing[tier].currency       — display currency
//
// Defensive throughout — a malformed blob returns { cents: 0,
// currency: "USD" }, which the caller can surface as "—" or omit
// from totals. Never throws.

export type ProposalValue = { cents: number; currency: string };

export function extractProposalValueCents(content: unknown): ProposalValue {
  if (!content || typeof content !== "object") {
    return { cents: 0, currency: "USD" };
  }
  const obj = content as Record<string, unknown>;
  try {
    const client = (obj.client as Record<string, unknown>) ?? {};
    const adults = numberish(client.adults);
    const children = numberish(client.children);

    const activeTier = typeof obj.activeTier === "string" ? obj.activeTier : "classic";
    const pricing = (obj.pricing as Record<string, unknown>) ?? {};
    const tier = (pricing[activeTier] as Record<string, unknown>) ?? {};

    const adultPrice = numberish(tier.pricePerPerson);
    const childPrice = numberish(tier.childPrice);
    const currency = typeof tier.currency === "string" ? tier.currency : "USD";

    const total = adults * adultPrice + children * childPrice;
    return { cents: Math.round(total * 100), currency };
  } catch {
    return { cents: 0, currency: "USD" };
  }
}

// Format helper for compact pipeline-value displays. "$24K" / "$1.2M".
// Falls back to a plain number for tiny values so "$240" still reads
// fine.
export function formatMoneyCompact(cents: number, currency: string): string {
  if (!Number.isFinite(cents) || cents <= 0) return `${symbolFor(currency)}0`;
  const dollars = cents / 100;
  if (dollars >= 1_000_000) {
    return `${symbolFor(currency)}${(dollars / 1_000_000).toFixed(dollars >= 10_000_000 ? 0 : 1)}M`;
  }
  if (dollars >= 1_000) {
    return `${symbolFor(currency)}${(dollars / 1_000).toFixed(dollars >= 10_000 ? 0 : 1)}K`;
  }
  return `${symbolFor(currency)}${Math.round(dollars).toLocaleString()}`;
}

function symbolFor(currency: string): string {
  switch (currency.toUpperCase()) {
    case "USD": return "$";
    case "EUR": return "€";
    case "GBP": return "£";
    case "KES": return "KSh ";
    case "TZS": return "TSh ";
    case "ZAR": return "R ";
    default: return `${currency} `;
  }
}

// Best-effort numeric coercion. Strings, numbers, null, undefined all
// land at a finite number or 0.
function numberish(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/[^0-9.\-]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}
