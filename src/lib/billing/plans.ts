// ─── Billing plans ──────────────────────────────────────────────────────────
//
// Canonical plan definitions + limits. The shape matches what the public
// /pricing page advertises. When the operator subscribes via Paystack,
// Organization.plan is set to one of these keys.
//
// Amounts are in US cents (what Paystack expects for USD transactions).
// Plan codes live in env (PAYSTACK_PLAN_*_CODE) and get created once in
// the Paystack dashboard — they map one-to-one to the keys below.

export type PlanKey = "none" | "consultant" | "explorer" | "operator";

export type PlanDefinition = {
  key: PlanKey;
  label: string;
  pricePerMonthUSD: number;      // human-readable
  pricePerMonthCents: number;    // what Paystack charges
  proposalsPerMonth: number;     // Infinity for unlimited
  seats: number;                 // Infinity for unlimited
  brandDNAFull: boolean;
  priorityAI: boolean;
  advancedExports: boolean;
  /** Env var name holding the Paystack plan_code — populated per deployment. */
  paystackPlanCodeEnv: string;
};

export const PLANS: Record<Exclude<PlanKey, "none">, PlanDefinition> = {
  consultant: {
    key: "consultant",
    label: "Consultant",
    pricePerMonthUSD: 29,
    pricePerMonthCents: 2900,
    proposalsPerMonth: 3,
    seats: 1,
    brandDNAFull: false,
    priorityAI: false,
    advancedExports: false,
    paystackPlanCodeEnv: "PAYSTACK_PLAN_CONSULTANT_CODE",
  },
  explorer: {
    key: "explorer",
    label: "Explorer",
    pricePerMonthUSD: 50,
    pricePerMonthCents: 5000,
    proposalsPerMonth: 10,
    seats: 1,
    brandDNAFull: false,
    priorityAI: false,
    advancedExports: false,
    paystackPlanCodeEnv: "PAYSTACK_PLAN_EXPLORER_CODE",
  },
  operator: {
    key: "operator",
    label: "Operator",
    pricePerMonthUSD: 100,
    pricePerMonthCents: 10000,
    proposalsPerMonth: Number.POSITIVE_INFINITY,
    seats: 5,
    brandDNAFull: true,
    priorityAI: true,
    advancedExports: true,
    paystackPlanCodeEnv: "PAYSTACK_PLAN_OPERATOR_CODE",
  },
};

export function planLabel(plan: PlanKey): string {
  if (plan === "none") return "No plan";
  return PLANS[plan].label;
}

export function planProposalLimit(plan: PlanKey): number {
  if (plan === "none") return 0;
  return PLANS[plan].proposalsPerMonth;
}

export function planSeatLimit(plan: PlanKey): number {
  if (plan === "none") return 1;
  return PLANS[plan].seats;
}

export function isValidPlanKey(v: string): v is Exclude<PlanKey, "none"> {
  return v === "consultant" || v === "explorer" || v === "operator";
}

export function resolvePaystackPlanCode(plan: Exclude<PlanKey, "none">): string | null {
  const envKey = PLANS[plan].paystackPlanCodeEnv;
  const code = process.env[envKey]?.trim();
  return code && code.length > 0 ? code : null;
}
