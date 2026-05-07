import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { nanoid } from "@/lib/nanoid";
import { LUXURY_VOICE_BANS } from "@/lib/aiVoice";
import type { Day, Proposal, TierKey } from "@/lib/types";

// ─── Rebuild-to-a-budget ────────────────────────────────────────────────────
//
// POST /api/ai/rebuild-budget
//
// The operator has a proposal priced at $X. The client comes back
// wanting $Y. One click: the AI swaps lodges (picking from the org's
// real library), rewrites day narratives to match the new tier, and
// returns refreshed pricing plus a before/after summary the UI can show
// in a preview-and-accept modal.
//
// Preserved explicitly:
//   client + trip meta (guests, dates, destinations, origin, style)
//   proposal.properties (the editor's library copy)
//   cover, greeting, inclusions, exclusions, practical info, map caption
//
// Changed:
//   per-day tier picks + per-day description
//   pricing tiers (all three recomputed to the new shape)
//   optional closing.signOff (if the prior version mentioned price)
//
// This mirrors the autopilot endpoint's shape where possible so the
// client can reuse mergeAutopilotIntoProposal with a thin wrapper.

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
const MAX_LIBRARY = 80;

type LibrarySlot = {
  slot: number;
  name: string;
  location: string;
  country: string | null;
  propertyClass: string | null;
  summary: string;
  rateBand: RateBand; // server-computed hint for Claude
};

// Rate bands are coarse directional hints — we don't pretend to know
// real rates. "Level" is a 1-5 scale Claude can compare against a
// target without anchoring on specific numbers.
type RateBand = {
  level: 1 | 2 | 3 | 4 | 5;
  label: string;
};

const CLASS_TO_BAND: Record<string, RateBand> = {
  camp:           { level: 2, label: "value" },
  tented_camp:    { level: 2, label: "value" },
  mobile_camp:    { level: 4, label: "premium specialty" },
  lodge:          { level: 3, label: "mid" },
  boutique_hotel: { level: 4, label: "premium" },
  villa:          { level: 5, label: "top" },
  houseboat:      { level: 3, label: "mid" },
  treehouse:      { level: 4, label: "premium" },
  other:          { level: 3, label: "mid" },
};

function rateBandFor(propertyClass: string | null | undefined): RateBand {
  if (!propertyClass) return { level: 3, label: "mid" };
  return CLASS_TO_BAND[propertyClass] ?? { level: 3, label: "mid" };
}

// ─── Prompt ────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You rebuild safari proposals to a new per-person budget.

INPUT: the current proposal (guests, destinations, nights, current per-day camp picks, current pricing) + the operator's property library (slot-indexed with rate band hints) + the target price-per-person for the highlighted tier.

GOAL: swap camps and rewrite day narratives so the highlighted tier lands close to the target, while the other two tiers scale sensibly around it. Preserve everything else.

HARD RULES:
  • Keep destinations + country + day count + nights per destination EXACTLY. Do not move the trip around.
  • Match picks to the new budget band — camp rate bands are 1 (value) through 5 (top). Pick combinations whose bands roughly match: target <$5k/pp → band 2-3; $5-9k → band 3-4; $9k+ → band 4-5.
  • Preserve the guests' names, dates, origin, special occasion — you're only changing the trip shape at the camp level.
  • Rewrite each day.description to match the NEW tier. If going down-market, drop "infinity pool" / "private butler" / "ultra-luxury" type detail; lead with specific, grounded facts. If going up-market, add detail proportionally but never brochure clichés.
  • Library only. Refer to camps by integer slot, never by name. If the library has nothing suitable for a tier on a given day, set {"slot": -1} — do not invent.

OPERATOR VOICE RULES:
${LUXURY_VOICE_BANS}

OUTPUT — JSON only, no preamble, no markdown fences:
{
  "pricing": {
    "classic":   { "label": "Classic",   "pricePerPerson": "3,800", "currency": "USD", "highlighted": false },
    "premier":   { "label": "Premier",   "pricePerPerson": "6,500", "currency": "USD", "highlighted": true  },
    "signature": { "label": "Signature", "pricePerPerson": "9,800", "currency": "USD", "highlighted": false },
    "notes": ""
  },
  "days": [
    {
      "dayNumber": 1,
      "description": "Rewritten 2-3 sentence narrative to match the new tier.",
      "tiers": {
        "classic":   { "slot": 5,  "note": "" },
        "premier":   { "slot": 12, "note": "" },
        "signature": { "slot": 3,  "note": "" }
      }
    }
  ],
  "closing": { "signOff": "" },
  "rebuild": {
    "notes": "One short sentence about what you did — e.g. 'Downshifted Mara + Serengeti to mid-tier, kept Zanzibar signature', or 'Target unachievable without cutting destinations — best attempt shown.'"
  }
}

PRICING:
  The highlighted tier should land within ±10% of the target. The other two tiers scale: classic ≈ target × 0.55-0.65, signature ≈ target × 1.35-1.55. All whole hundreds (e.g. "6,500"), comma-formatted, no symbol.

CLOSING:
  Only output closing.signOff if the rewrite requires it (e.g. the prior sign-off mentioned the old price). Otherwise leave empty string.

DAYS:
  Output exactly one entry per day in dayNumber order. Do not skip days. Do not change the destination — only the camps and the prose.`;

// ─── Handler ───────────────────────────────────────────────────────────────

type IncomingProposal = {
  days?: Day[];
  client?: Proposal["client"];
  trip?: Proposal["trip"];
  pricing?: Proposal["pricing"];
};

export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ctx.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }
  if (!ctx.orgActive) {
    return NextResponse.json({ error: "Account suspended", code: "ORG_SUSPENDED" }, { status: 402 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
  }

  let body: {
    proposal?: IncomingProposal;
    targetPricePerPerson?: number;
    targetCurrency?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const proposal = body?.proposal;
  if (!proposal || !Array.isArray(proposal.days) || proposal.days.length === 0) {
    return NextResponse.json({ error: "proposal with days[] is required" }, { status: 400 });
  }

  const target = Number(body.targetPricePerPerson ?? 0);
  if (!Number.isFinite(target) || target < 500 || target > 100000) {
    return NextResponse.json(
      { error: "targetPricePerPerson must be between 500 and 100000" },
      { status: 400 },
    );
  }

  // ── Org library snapshot ─────────────────────────────────────────────
  const properties = await prisma.property.findMany({
    where: { organizationId: ctx.organization.id, archived: false },
    select: {
      id: true, name: true, propertyClass: true, shortSummary: true,
      location: { select: { name: true, country: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: MAX_LIBRARY,
  });

  if (properties.length === 0) {
    return NextResponse.json(
      { error: "Your property library is empty — add a few camps first so the AI has something to pick from." },
      { status: 400 },
    );
  }

  const library: LibrarySlot[] = properties.map((p, i) => ({
    slot: i,
    name: p.name,
    location: p.location?.name ?? "",
    country: p.location?.country ?? null,
    propertyClass: p.propertyClass,
    summary: (p.shortSummary ?? "").slice(0, 160),
    rateBand: rateBandFor(p.propertyClass),
  }));

  // ── Snapshot of what we're changing, for the before-state summary ───
  const beforeByDay = proposal.days.map((d) => ({
    dayNumber: d.dayNumber,
    destination: d.destination,
    campsByTier: {
      classic: d.tiers?.classic?.camp ?? "",
      premier: d.tiers?.premier?.camp ?? "",
      signature: d.tiers?.signature?.camp ?? "",
    },
  }));
  const beforePricing = {
    classic: proposal.pricing?.classic?.pricePerPerson ?? "",
    premier: proposal.pricing?.premier?.pricePerPerson ?? "",
    signature: proposal.pricing?.signature?.pricePerPerson ?? "",
  };

  // ── Build the user payload — compact, no fat ───────────────────────
  const userPayload = {
    targetPricePerPerson: target,
    targetCurrency: (body.targetCurrency ?? "USD").slice(0, 6),
    trip: {
      nights: proposal.trip?.nights ?? proposal.days.length,
      destinations: proposal.trip?.destinations ?? [],
      tripStyle: proposal.trip?.tripStyle ?? "",
    },
    client: {
      guestNames: proposal.client?.guestNames ?? "",
      adults: proposal.client?.adults ?? 2,
      children: proposal.client?.children ?? 0,
    },
    currentDays: proposal.days.map((d) => ({
      dayNumber: d.dayNumber,
      destination: d.destination,
      country: d.country,
      tiers: {
        classic: d.tiers?.classic?.camp ?? "",
        premier: d.tiers?.premier?.camp ?? "",
        signature: d.tiers?.signature?.camp ?? "",
      },
    })),
    currentPricing: beforePricing,
    library,
  };

  const anth = new Anthropic({ apiKey });

  let raw = "";
  try {
    const msg = await anth.messages.create({
      model: MODEL,
      max_tokens: 5000,
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      messages: [
        {
          role: "user",
          content: `Rebuild this proposal to the new budget. Return ONLY the JSON.

${JSON.stringify(userPayload)}`,
        },
      ],
    });
    raw = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "AI is rate-limited; please retry." }, { status: 429 });
    }
    if (err instanceof Anthropic.APIError) {
      console.error("[REBUILD] Anthropic error:", err.status, err.message);
      return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error("[REBUILD] Unexpected error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFences(raw));
  } catch {
    console.error("[REBUILD] Could not parse:", raw.slice(0, 400));
    return NextResponse.json({ error: "AI returned malformed output. Please retry." }, { status: 502 });
  }

  const shaped = shapeResponse(parsed, library, beforeByDay, beforePricing);
  if (!shaped) {
    return NextResponse.json({ error: "AI returned an incomplete rebuild. Please retry." }, { status: 502 });
  }
  return NextResponse.json(shaped);
}

// ─── Response shaping ──────────────────────────────────────────────────────

type ClaudeOut = {
  pricing?: {
    classic?: { label?: unknown; pricePerPerson?: unknown; currency?: unknown; highlighted?: unknown };
    premier?: { label?: unknown; pricePerPerson?: unknown; currency?: unknown; highlighted?: unknown };
    signature?: { label?: unknown; pricePerPerson?: unknown; currency?: unknown; highlighted?: unknown };
    notes?: unknown;
  };
  days?: Array<{
    dayNumber?: unknown;
    description?: unknown;
    tiers?: Partial<Record<TierKey, { slot?: unknown; note?: unknown }>>;
  }>;
  closing?: { signOff?: unknown };
  rebuild?: { notes?: unknown };
};

function shapeResponse(
  parsed: unknown,
  library: LibrarySlot[],
  beforeByDay: { dayNumber: number; destination: string; campsByTier: Record<TierKey, string> }[],
  beforePricing: Record<TierKey, string>,
) {
  if (!parsed || typeof parsed !== "object") return null;
  const p = parsed as ClaudeOut;

  const rawDays = Array.isArray(p.days) ? p.days : [];
  if (rawDays.length === 0) return null;

  const resolveTier = (pick: { slot?: unknown; note?: unknown } | undefined) => {
    const slot = typeof pick?.slot === "number" ? pick.slot : -1;
    if (slot < 0 || slot >= library.length) return { camp: "", location: "", note: "", slot: -1 };
    const prop = library[slot];
    return {
      camp: prop.name,
      location: prop.location || prop.country || "",
      note: toString(pick?.note, ""),
      slot,
    };
  };

  const days = rawDays.map((d, idx) => {
    const dayNumber = typeof d.dayNumber === "number" ? d.dayNumber : idx + 1;
    const source = beforeByDay.find((b) => b.dayNumber === dayNumber) ?? beforeByDay[idx];
    const tiers = {
      classic: resolveTier(d.tiers?.classic),
      premier: resolveTier(d.tiers?.premier),
      signature: resolveTier(d.tiers?.signature),
    };
    return {
      dayNumber,
      destination: source?.destination ?? "",
      description: toString(d.description, ""),
      tiers,
    };
  });

  const pricing = {
    classic: normaliseTier(p.pricing?.classic, "Classic", false),
    premier: normaliseTier(p.pricing?.premier, "Premier", true),
    signature: normaliseTier(p.pricing?.signature, "Signature", false),
    notes: toString(p.pricing?.notes, ""),
  };

  // ── Build the before/after swap summary for the UI preview ────────
  const swaps: {
    dayNumber: number;
    destination: string;
    tier: TierKey;
    before: string;
    after: string;
  }[] = [];
  for (const d of days) {
    const source = beforeByDay.find((b) => b.dayNumber === d.dayNumber);
    if (!source) continue;
    for (const tier of ["classic", "premier", "signature"] as const) {
      const before = source.campsByTier[tier];
      const after = d.tiers[tier].camp;
      if (before !== after && (before || after)) {
        swaps.push({ dayNumber: d.dayNumber, destination: d.destination, tier, before, after });
      }
    }
  }

  return {
    pricing,
    // Emit full-shape Day entries so the client can replace proposal.days wholesale.
    days: days.map((d): Day => ({
      id: nanoid(),
      dayNumber: d.dayNumber,
      destination: d.destination,
      country: "", // preserved client-side from the source proposal
      description: d.description,
      board: "Full board",
      tiers: {
        classic: { camp: d.tiers.classic.camp, location: d.tiers.classic.location, note: d.tiers.classic.note },
        premier: { camp: d.tiers.premier.camp, location: d.tiers.premier.location, note: d.tiers.premier.note },
        signature: { camp: d.tiers.signature.camp, location: d.tiers.signature.location, note: d.tiers.signature.note },
      },
    })),
    closing: { signOff: toString(p.closing?.signOff, "") },
    rebuild: {
      notes: toString(p.rebuild?.notes, "").slice(0, 240),
      beforePricing,
      afterPricing: {
        classic: pricing.classic.pricePerPerson,
        premier: pricing.premier.pricePerPerson,
        signature: pricing.signature.pricePerPerson,
      },
      swaps,
    },
  };
}

type RawPricingTier = {
  label?: unknown;
  pricePerPerson?: unknown;
  currency?: unknown;
  highlighted?: unknown;
};

function normaliseTier(
  raw: RawPricingTier | undefined,
  defaultLabel: string,
  highlighted: boolean,
) {
  const r = raw ?? {};
  return {
    label: toString(r.label, defaultLabel).slice(0, 40),
    pricePerPerson: toString(r.pricePerPerson, "").slice(0, 20),
    currency: toString(r.currency, "USD").slice(0, 6),
    highlighted,
  };
}

// ─── Primitives ────────────────────────────────────────────────────────────

function toString(v: unknown, fallback: string): string {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

function stripFences(text: string): string {
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(text.trim());
  return fence ? fence[1].trim() : text.trim();
}
