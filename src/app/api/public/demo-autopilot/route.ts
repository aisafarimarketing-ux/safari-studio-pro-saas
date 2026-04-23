import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { STARTER_LIBRARY } from "@/lib/starterLibrary";
import { nanoid } from "@/lib/nanoid";
import type { Day, PracticalCard, TierKey } from "@/lib/types";

// ─── Public demo autopilot ─────────────────────────────────────────────────
//
// Zero-auth, zero-DB, optimised-for-speed draft endpoint powering /demo.
// Contract with the UI:
//
//   In  — { enquiry: "…raw client email or brief…" }
//   Out — { trip: {…extracted intent…}, draft: {…full proposal draft…} }
//
// Speed is the whole product here. The pitch is "sent proposal in under
// five minutes" — a demo that takes five minutes to load kills the sale.
// We aggressively shrink what Claude produces and fill everything else
// server-side with reasonable East-Africa defaults the operator can swap
// later:
//
//   • Claude drafts only the sections where personalisation matters:
//     trip extraction, cover tagline, greeting body, per-day prose,
//     pricing tiers, closing. Everything else is defaulted.
//   • Day prose is intentionally short (1-2 sentences).
//   • Claude returns *slot numbers*, not camp names — the client-side
//     hydrate step uses those to pull images from STARTER_LIBRARY.
//   • max_tokens is 2500 (down from 7000). With cached system prompt
//     target TTFT < 3s, full response < 25s for a 10-day trip.
//
// Safety rails unchanged: 3 drafts / IP / hour, 300 / global / 24h,
// enquiry clamped to 4000 chars, MVP in-memory buckets.

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

// ─── Rate limiting ─────────────────────────────────────────────────────────

type IPBucket = { count: number; windowStart: number };
const PER_IP_LIMIT = 3;
const PER_IP_WINDOW_MS = 60 * 60 * 1000;
const GLOBAL_DAILY_CAP = 300;
const GLOBAL_WINDOW_MS = 24 * 60 * 60 * 1000;

const ipBuckets = new Map<string, IPBucket>();
let globalBucket: IPBucket = { count: 0, windowStart: Date.now() };

function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

function checkRateLimit(ip: string): { ok: true } | { ok: false; reason: string; retryAfterSec: number } {
  const now = Date.now();

  if (now - globalBucket.windowStart > GLOBAL_WINDOW_MS) {
    globalBucket = { count: 0, windowStart: now };
  }
  if (globalBucket.count >= GLOBAL_DAILY_CAP) {
    const retryAfterSec = Math.ceil((globalBucket.windowStart + GLOBAL_WINDOW_MS - now) / 1000);
    return {
      ok: false,
      reason: "The demo is busy — please try again later, or sign up for a free account to keep going.",
      retryAfterSec,
    };
  }

  const bucket = ipBuckets.get(ip);
  if (!bucket || now - bucket.windowStart > PER_IP_WINDOW_MS) {
    ipBuckets.set(ip, { count: 1, windowStart: now });
    globalBucket.count += 1;
    return { ok: true };
  }
  if (bucket.count >= PER_IP_LIMIT) {
    const retryAfterSec = Math.ceil((bucket.windowStart + PER_IP_WINDOW_MS - now) / 1000);
    return {
      ok: false,
      reason: `You've drafted ${PER_IP_LIMIT} proposals in the last hour — sign up for a free account to keep going.`,
      retryAfterSec,
    };
  }
  bucket.count += 1;
  globalBucket.count += 1;
  return { ok: true };
}

// ─── Library mapping ───────────────────────────────────────────────────────

type LibrarySlot = {
  slot: number;
  name: string;
  location: string;
  country: string;
  class: string;
  summary: string;
  tags: string[];
};

const DEMO_LIBRARY: LibrarySlot[] = STARTER_LIBRARY.map((p, i) => ({
  slot: i,
  name: p.name,
  location: p.locationName,
  country: p.country,
  class: p.propertyClass,
  summary: p.shortSummary.slice(0, 160),
  tags: p.tags.slice(0, 2),
}));

// ─── Prompt ────────────────────────────────────────────────────────────────
// Deliberately compact. The system prompt is cache_control:"ephemeral"
// so the wire cost is paid once and reused across drafts within a
// 5-minute window — good for marketing spikes.

const SYSTEM_PROMPT = `You draft safari proposals. One client enquiry in → one personalised JSON proposal out.

STEP 1 — extract trip intent from the enquiry:
guestNames (best guess, never "Dear Guest"), adults (int, default 2), children (int, default 0), nights (int, clamp 5-12), destinations (ordered list of real East African places mentioned or sensibly implied), tripStyle ("Luxury"|"Mid-range"|"Classic"), origin (country or ""), operatorNote (one-line special request or "").

STEP 2 — draft the proposal using ONLY the library provided. Reference camps by integer slot, never by name.

RULES:
- Address guests by the extracted name. Never generic.
- Day 1 uses the FIRST destination. The last day uses either the first (gateway return) or the last destination (beach/extension).
- Distribute internal destinations geographically. No one-night transit loops.
- Match picks to style: Luxury → favour lodge/luxury class; Mid-range → balanced; Classic → tented/no-frills.
- Operator voice: brief, factual, confident. One adjective per noun. No exclamation marks, no rhetorical questions.
- BANNED words (hard block): stunning, breathtaking, amazing, incredible, unforgettable, magical, magnificent, luxurious, iconic, lush, vibrant, pristine, picturesque, idyllic, nestled, tucked, hidden gem, immerse, escape, embark, indulge, "memories to last a lifetime". Never open with "Whether you're…" or "From X to Y,".

OUTPUT — JSON only, no fences, no preamble:
{
  "trip": { "guestNames": "…", "adults": 2, "children": 0, "nights": 7, "destinations": ["…"], "tripStyle": "Mid-range", "origin": "…", "operatorNote": "…" },
  "cover": { "tagline": "≤14 words, names the trip's signature." },
  "greeting": { "body": "3-4 sentences. OPEN with guest names. Reference one real destination. End on an invitation." },
  "days": [
    { "destination": "…", "country": "…", "description": "ONE or TWO short factual sentences. Lead with a fact.", "tierSlots": { "classic": 3, "premier": 7, "signature": 12 } }
  ],
  "pricing": {
    "classic":   { "pricePerPerson": "4,500" },
    "premier":   { "pricePerPerson": "6,800" },
    "signature": { "pricePerPerson": "9,200" }
  },
  "closing": { "quote": "≤14 words, grounded.", "signOff": "3-4 sentences, addresses guests by name, ends on a next step." }
}

PRICING — estimate per-person USD (whole hundreds). Classic: $300-$500/night × nights × 1.35. Premier: $550-$900/night × nights × 1.4. Signature: $1,000-$2,000/night × nights × 1.4. Format "4,500" with comma.

DAY COUNT — generate EXACTLY trip.nights days in the "days" array. Never fewer.

TIER SLOTS — must be valid integers in [0, ${DEMO_LIBRARY.length - 1}] or -1 if nothing suitable. Do not invent slots.`;

// ─── Handler ───────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(ip);
  if (!rl.ok) {
    return NextResponse.json(
      { error: rl.reason, code: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": `${rl.retryAfterSec}` } },
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI is temporarily unavailable." }, { status: 503 });
  }

  let body: { enquiry?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const enquiry = (body?.enquiry ?? "").toString().trim().slice(0, 4000);
  if (!enquiry || enquiry.length < 20) {
    return NextResponse.json(
      { error: "Paste a client enquiry — at least a sentence or two." },
      { status: 400 },
    );
  }

  const userText = `Client enquiry:
"""
${enquiry}
"""

Library (slot → camp):
${JSON.stringify(DEMO_LIBRARY)}

Return ONLY the JSON object.`;

  const anth = new Anthropic({ apiKey });

  let raw = "";
  try {
    const msg = await anth.messages.create({
      model: MODEL,
      max_tokens: 2500,
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: userText }],
    });
    raw = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "AI is rate-limited; please retry in a minute." }, { status: 429 });
    }
    if (err instanceof Anthropic.APIError) {
      console.error("[DEMO-AUTOPILOT] Anthropic error:", err.status, err.message);
      return NextResponse.json({ error: "AI draft failed — please retry." }, { status: 502 });
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error("[DEMO-AUTOPILOT] Unexpected:", message);
    return NextResponse.json({ error: "AI draft failed — please retry." }, { status: 500 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFences(raw));
  } catch {
    console.error("[DEMO-AUTOPILOT] Could not parse:", raw.slice(0, 400));
    return NextResponse.json({ error: "AI returned malformed output. Please retry." }, { status: 502 });
  }

  const response = shapeResponse(parsed);
  if (!response) {
    return NextResponse.json({ error: "AI returned an incomplete draft. Please retry." }, { status: 502 });
  }

  return NextResponse.json(response);
}

// ─── Response shaping ──────────────────────────────────────────────────────
// The client receives a fully-populated draft it can merge straight into a
// blank proposal — including tier slot numbers per day so the UI can pull
// images and build a properties[] array from STARTER_LIBRARY.

type ClaudeOut = {
  trip?: {
    guestNames?: unknown;
    adults?: unknown;
    children?: unknown;
    nights?: unknown;
    destinations?: unknown;
    tripStyle?: unknown;
    origin?: unknown;
    operatorNote?: unknown;
  };
  cover?: { tagline?: unknown };
  greeting?: { body?: unknown };
  days?: Array<{
    destination?: unknown;
    country?: unknown;
    description?: unknown;
    tierSlots?: Partial<Record<TierKey, unknown>>;
  }>;
  pricing?: Partial<Record<TierKey, { pricePerPerson?: unknown }>>;
  closing?: { quote?: unknown; signOff?: unknown };
};

export type DemoDayOut = Day & {
  // Parallel to Day.tiers but carries the starter-library slot indices so
  // the client hydrate step can pull images from STARTER_LIBRARY.
  tierSlots: { classic: number; premier: number; signature: number };
};

function shapeResponse(parsed: unknown): {
  trip: {
    guestNames: string;
    adults: number;
    children: number;
    nights: number;
    destinations: string[];
    tripStyle: string;
    origin: string;
    operatorNote: string;
  };
  draft: {
    cover: { tagline: string };
    greeting: { body: string };
    closing: { quote: string; signOff: string };
    map: { caption: string };
    days: DemoDayOut[];
    inclusions: string[];
    exclusions: string[];
    practicalInfo: PracticalCard[];
    pricing: {
      classic: { label: string; pricePerPerson: string; currency: string; highlighted: boolean };
      premier: { label: string; pricePerPerson: string; currency: string; highlighted: boolean };
      signature: { label: string; pricePerPerson: string; currency: string; highlighted: boolean };
      notes?: string;
    };
  };
} | null {
  if (!parsed || typeof parsed !== "object") return null;
  const p = parsed as ClaudeOut;
  if (!p.trip || !p.days) return null;

  const t = p.trip;
  const nights = clampInt(toNumber(t.nights, 7), 5, 12);
  const destinations = toStringArray(t.destinations, 8).filter((d) => d.length > 0);
  const tripStyleRaw = String(t.tripStyle ?? "").trim();
  const tripStyle = ["Luxury", "Mid-range", "Classic"].includes(tripStyleRaw) ? tripStyleRaw : "Mid-range";

  const trip = {
    guestNames: toString(t.guestNames, "Our guests").slice(0, 80),
    adults: clampInt(toNumber(t.adults, 2), 1, 20),
    children: clampInt(toNumber(t.children, 0), 0, 20),
    nights,
    destinations: destinations.length > 0 ? destinations : ["Maasai Mara", "Serengeti"],
    tripStyle,
    origin: toString(t.origin, "").slice(0, 60),
    operatorNote: toString(t.operatorNote, "").slice(0, 200),
  };

  const claudeDays = Array.isArray(p.days) ? p.days.slice(0, nights) : [];
  while (claudeDays.length < nights) claudeDays.push({});

  const days: DemoDayOut[] = claudeDays.map((dd, idx) => {
    const classicSlot = resolveSlot(dd.tierSlots?.classic);
    const premierSlot = resolveSlot(dd.tierSlots?.premier);
    const signatureSlot = resolveSlot(dd.tierSlots?.signature);
    return {
      id: nanoid(),
      dayNumber: idx + 1,
      destination: toString(dd.destination, trip.destinations[idx % trip.destinations.length] ?? "Destination"),
      country: toString(dd.country, "Kenya"),
      description: toString(dd.description, ""),
      board: "Full board",
      tiers: {
        classic: resolveTier(classicSlot),
        premier: resolveTier(premierSlot),
        signature: resolveTier(signatureSlot),
      },
      tierSlots: {
        classic: classicSlot,
        premier: premierSlot,
        signature: signatureSlot,
      },
    };
  });

  // Clamp Day 1 and last day to the extracted destinations list.
  if (trip.destinations.length > 0 && days.length > 0) {
    const norm = (s: string) => s.trim().toLowerCase();
    const allowed = new Set(trip.destinations.map(norm));
    if (!allowed.has(norm(days[0].destination))) days[0].destination = trip.destinations[0];
    const last = days[days.length - 1];
    if (!allowed.has(norm(last.destination))) last.destination = trip.destinations[trip.destinations.length - 1];
  }

  const pricing = normalisePricing(p.pricing, tripStyle);

  return {
    trip,
    draft: {
      cover: { tagline: toString(p.cover?.tagline, "").slice(0, 160) },
      greeting: { body: toString(p.greeting?.body, "").slice(0, 1200) },
      closing: {
        quote: toString(p.closing?.quote, "").slice(0, 160),
        signOff: toString(p.closing?.signOff, "").slice(0, 800),
      },
      map: { caption: `Your route across ${formatCountryList(trip.destinations)}` },
      days,
      inclusions: DEFAULT_INCLUSIONS,
      exclusions: DEFAULT_EXCLUSIONS,
      practicalInfo: defaultPracticalInfo(trip.origin),
      pricing,
    },
  };
}

// ─── Defaults (the bits we cut from Claude's output) ───────────────────────
// Safe East-Africa boilerplate. Operators obviously edit these; the demo
// is about the AI sections that demonstrate value — this is table stakes.

const DEFAULT_INCLUSIONS: string[] = [
  "Private 4x4 safari vehicle with professional guide",
  "All park and conservancy fees",
  "All accommodation as listed",
  "All meals on safari (full board)",
  "Airport transfers on arrival and departure",
  "Bottled water, soft drinks and local beer on safari",
  "Bush picnics and sundowners where noted",
];

const DEFAULT_EXCLUSIONS: string[] = [
  "International flights",
  "Kenya / Tanzania visas and entry fees",
  "Yellow-fever vaccination (where required)",
  "Travel and medical insurance",
  "Premium spirits, wines and champagnes",
  "Gratuities to drivers, guides and camp staff",
  "Personal shopping and optional activities",
];

function defaultPracticalInfo(origin: string): PracticalCard[] {
  const flightBody =
    origin && origin.toLowerCase().includes("united kingdom")
      ? "Direct flights from London to Nairobi run nightly (~8h); Nairobi to Dar or Kilimanjaro is a short regional hop."
      : origin && origin.toLowerCase().match(/united states|usa|america/)
        ? "From most US hubs, one stop via Doha, Amsterdam or London — allow 18–24 hours in transit."
        : "Most international routes connect through Amsterdam, Doha, Istanbul or Dubai before Nairobi or Kilimanjaro.";
  return [
    {
      id: nanoid(),
      title: "Visas",
      body: "Kenya and Tanzania are e-visa. Apply online 7+ days before travel. Single-entry visas are the norm; an East Africa tourist visa covers Kenya / Uganda / Rwanda on one document.",
      icon: "🛂",
    },
    {
      id: nanoid(),
      title: "Flights",
      body: flightBody,
      icon: "✈",
    },
    {
      id: nanoid(),
      title: "Health",
      body: "Yellow-fever certificate required if arriving from a yellow-fever country. Malaria cover recommended. Bring prescription meds in original packaging.",
      icon: "💉",
    },
    {
      id: nanoid(),
      title: "Packing",
      body: "Neutral colours on safari (no bright white, no camouflage). Layers for cool mornings and evenings. Closed walking shoes. A soft duffel beats a hard case for bush-plane transfers.",
      icon: "🎒",
    },
  ];
}

function formatCountryList(destinations: string[]): string {
  if (destinations.length === 0) return "East Africa";
  if (destinations.length === 1) return destinations[0];
  return destinations.slice(0, 4).join(" · ");
}

// ─── Primitives ────────────────────────────────────────────────────────────

function resolveSlot(raw: unknown): number {
  if (typeof raw === "number" && Number.isInteger(raw)) return raw;
  if (typeof raw === "string") {
    const n = parseInt(raw, 10);
    if (Number.isInteger(n)) return n;
  }
  return -1;
}

function resolveTier(slot: number): { camp: string; location: string; note: string } {
  if (slot < 0 || slot >= DEMO_LIBRARY.length) return { camp: "", location: "", note: "" };
  const prop = DEMO_LIBRARY[slot];
  return {
    camp: prop.name,
    location: prop.location || prop.country,
    note: "",
  };
}

function normalisePricing(
  raw: ClaudeOut["pricing"],
  tripStyle: string,
): {
  classic: { label: string; pricePerPerson: string; currency: string; highlighted: boolean };
  premier: { label: string; pricePerPerson: string; currency: string; highlighted: boolean };
  signature: { label: string; pricePerPerson: string; currency: string; highlighted: boolean };
  notes?: string;
} {
  const styleLower = tripStyle.toLowerCase();
  const highlightedTier: TierKey = styleLower.includes("luxury")
    ? "signature"
    : styleLower.includes("classic")
      ? "classic"
      : "premier";

  const pick = (tierRaw: unknown, label: string, highlighted: boolean) => {
    const r = (tierRaw ?? {}) as { pricePerPerson?: unknown };
    return {
      label,
      pricePerPerson: toString(r.pricePerPerson, "").slice(0, 20),
      currency: "USD",
      highlighted,
    };
  };

  return {
    classic: pick(raw?.classic, "Classic", highlightedTier === "classic"),
    premier: pick(raw?.premier, "Premier", highlightedTier === "premier"),
    signature: pick(raw?.signature, "Signature", highlightedTier === "signature"),
  };
}

function toString(v: unknown, fallback: string): string {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

function toNumber(v: unknown, fallback: number): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseInt(v, 10);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function toStringArray(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .map((s) => s.trim().slice(0, 200))
    .slice(0, max);
}

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function stripFences(text: string): string {
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(text.trim());
  return fence ? fence[1].trim() : text.trim();
}
