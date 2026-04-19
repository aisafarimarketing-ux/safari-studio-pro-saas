import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { buildBrandDNAPromptSection } from "@/lib/brandDNAPrompt";
import { nanoid } from "@/lib/nanoid";
import type { Day, TierKey } from "@/lib/types";

// AI autopilot — given a Trip Setup proposal (guest names, dates, nights,
// destinations, style, notes) plus the org's property library + Brand DNA,
// returns a complete, personalised draft for every section of the proposal:
//
//   cover tagline · greeting body · closing quote + sign-off ·
//   map caption · per-day destinations + narratives + tier picks ·
//   inclusions / exclusions · practical-info cards · pricing tiers.
//
// Personalisation is explicit — every paragraph must address the named
// guests directly, reference the real destinations, use the travel style,
// and (when provided) the guest's origin to shape practical advice.
//
// Library-only guarantee: Claude is shown the property list with stable
// integer slots and must return slot indices, not free-form names. We map
// indices back to library properties on the server. Out-of-range → dropped.

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

const STYLE_RULES = `Operator copy rules (non-negotiable):

BAN — never use these words, or any close variant:
- Adjective clichés: stunning, breathtaking, amazing, incredible, unforgettable, magical, magnificent, awe-inspiring, world-class, luxurious, luxe, iconic, ultimate, lush, vibrant, verdant, pristine, picturesque, idyllic.
- Marketing verbs: discover, immerse yourself, escape (to), unwind, embark on, indulge, "experience the magic", "step into".
- Brochure phrases: nestled in, tucked away, hidden gem, dotted with, paradise, rolling savannahs, rich biodiversity, "sights and sounds", "the perfect blend of".
- AI tells: "Whether you're…", "From X to Y, …", "ensures", openings that introduce the destination as the hero.
- Closers: "memories to last a lifetime", "a journey to remember", any flourish ending.
- No exclamation marks. No rhetorical questions.

VOICE: Operator brief, not brochure. Confident, specific, unfussy. Lead with a fact. Short declarative sentences. One adjective per noun, max.`;

const PERSONALISATION_RULES = `PERSONALISATION — every section below must feel hand-written for these specific guests:
- Address the guests by their exact name as given (never "dear guest" or "dear traveller").
- Reference the real destinations and real nights by name, not generic language.
- Use the trip style (luxury / mid-range / classic) to shape tone and detail depth.
- If origin country is given, use it to shape practical-info cards (flight time, jetlag, visa advice that actually applies).
- If the operator note mentions an occasion (anniversary, honeymoon, kids, first safari) — weave it in naturally, once, without overdoing.
- Write for conversion. The greeting and closing are the two highest-stakes paragraphs — make them warm, specific, and end the sale quietly with a clear next step or invitation.`;

type LibraryProperty = {
  slot: number;
  id: string;
  name: string;
  location: string;
  country: string | null;
  propertyClass: string | null;
  shortSummary: string;
  tags: string[];
};

type AutopilotDayOut = {
  destination?: string;
  country?: string;
  subtitle?: string;
  description?: string;
  board?: string;
  highlights?: string[];
  tiers?: Partial<Record<TierKey, { slot?: number; note?: string }>>;
};

type AutopilotPracticalCard = {
  title?: string;
  body?: string;
  icon?: string;
};

type AutopilotPricingTier = {
  label?: string;
  pricePerPerson?: string;
  currency?: string;
  highlighted?: boolean;
};

type AutopilotResponse = {
  cover?: { tagline?: string };
  greeting?: { body?: string };
  closing?: { quote?: string; signOff?: string };
  map?: { caption?: string };
  quote?: { quote?: string; attribution?: string };
  days?: AutopilotDayOut[];
  inclusions?: string[];
  exclusions?: string[];
  practicalInfo?: AutopilotPracticalCard[];
  pricing?: {
    classic?: AutopilotPricingTier;
    premier?: AutopilotPricingTier;
    signature?: AutopilotPricingTier;
    notes?: string;
  };
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

  let body: { proposal?: ProposalInput };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const proposal = body?.proposal;
  if (!proposal) {
    return NextResponse.json({ error: "proposal is required" }, { status: 400 });
  }

  const nights = Math.max(1, Math.min(60, Number(proposal.trip?.nights ?? 0) || 7));
  const destinations = (proposal.trip?.destinations ?? []).filter((d): d is string => !!d?.trim());
  const tripStyle = proposal.trip?.tripStyle?.trim() || "Mid-range";
  const notes = proposal.trip?.operatorNote?.trim() || "";
  const guestNames = proposal.client?.guestNames?.trim() || "";
  const adults = Number(proposal.client?.adults ?? 0) || 0;
  const children = Number(proposal.client?.children ?? 0) || 0;
  const origin = proposal.client?.origin?.trim() || "";
  const consultantName = proposal.operator?.consultantName?.trim() || "";
  const companyName = proposal.operator?.companyName?.trim() || "";

  // ── Library snapshot ────────────────────────────────────────────────────
  const properties = await prisma.property.findMany({
    where: { organizationId: ctx.organization.id, archived: false },
    select: {
      id: true, name: true, propertyClass: true, shortSummary: true,
      location: { select: { name: true, country: true } },
      tags: { include: { tag: { select: { name: true } } } },
    },
    orderBy: { updatedAt: "desc" },
    take: 80,
  });
  const library: LibraryProperty[] = properties.map((p, i) => ({
    slot: i,
    id: p.id,
    name: p.name,
    location: p.location?.name ?? "",
    country: p.location?.country ?? null,
    propertyClass: p.propertyClass,
    shortSummary: (p.shortSummary ?? "").slice(0, 280),
    tags: p.tags.map((t) => t.tag.name),
  }));

  // ── Brand DNA ───────────────────────────────────────────────────────────
  let brandDNASection = "";
  try {
    const profile = await prisma.brandDNAProfile.findUnique({
      where: { organizationId: ctx.organization.id },
    });
    brandDNASection = buildBrandDNAPromptSection(profile);
  } catch (err) {
    console.warn("[AUTOPILOT] Brand DNA load failed:", err);
  }

  const systemText =
    STYLE_RULES +
    "\n\n" +
    PERSONALISATION_RULES +
    brandDNASection +
    `

You are drafting a COMPLETE, personalised safari proposal. Fill every section listed below. Output JSON only — no preamble, no markdown fences, no commentary.

You MUST pick camps only from the property library provided. Refer to each pick by its integer "slot" number, never by name. If the library is empty for a tier, set that tier to {"slot": -1} — do not invent.

The JSON shape (all keys required unless marked optional):
{
  "cover": {
    "tagline": "One sentence. Names the destinations or the trip's signature. 8-14 words. Not a cliché."
  },
  "greeting": {
    "body": "3-4 sentences. OPEN with the guests' names. Reference one specific destination or activity. Mention the nights. End on an invitation — not a sales pitch. Never generic."
  },
  "days": [
    {
      "destination": "Place name",
      "country": "Country",
      "subtitle": "One short line (≤8 words) — optional, can be empty string",
      "description": "2-3 grounded sentences. Open with a fact: a distance, a time, a named feature. No clichés.",
      "board": "Full board" | "Half board" | "B&B" | "All inclusive",
      "highlights": ["short bullet", "short bullet"],
      "tiers": {
        "classic":   { "slot": 3, "note": "optional short note" },
        "premier":   { "slot": 7, "note": "" },
        "signature": { "slot": 12, "note": "" }
      }
    }
  ],
  "inclusions": ["short line", …],        // 5-9 items
  "exclusions": ["short line", …],        // 4-7 items
  "practicalInfo": [
    { "title": "Visas", "body": "2-3 sentence note — use the guests' origin country if given.", "icon": "🛂" },
    { "title": "Flights", "body": "…", "icon": "✈" },
    { "title": "Health & vaccinations", "body": "…", "icon": "💉" },
    { "title": "Packing", "body": "…", "icon": "🎒" },
    { "title": "Climate & season", "body": "…", "icon": "☀" },
    { "title": "Currency & tipping", "body": "…", "icon": "💳" }
  ],
  "pricing": {
    "classic":   { "label": "Classic",   "pricePerPerson": "4,500", "currency": "USD", "highlighted": false },
    "premier":   { "label": "Premier",   "pricePerPerson": "6,800", "currency": "USD", "highlighted": true  },
    "signature": { "label": "Signature", "pricePerPerson": "9,200", "currency": "USD", "highlighted": false },
    "notes": "Short 1-2 sentence note about validity, deposit, or what affects price. No exclamation marks."
  },
  "closing": {
    "quote": "One short, grounded line — not a cliché, not a flourish. ≤ 14 words.",
    "signOff": "3-4 sentences, personal. Addresses the guests by name. Invites their notes / feedback. Ends on a next step (e.g., 'tell me what to adjust' / 'I'll hold these dates for 7 days')."
  },
  "map": { "caption": "Short caption for the route map, ≤ 10 words." },
  "quote": {
    "quote": "A pull-quote for a standalone quote block. Different from the closing quote — grounded in a specific place or moment from THIS itinerary. One sentence, ≤ 18 words. No clichés.",
    "attribution": "Guide, camp, or destination the line is rooted in — e.g. 'Angama Mara' or 'A Kenyan proverb'. Short."
  }
}

PRICING ESTIMATION:
- Estimate per-person prices in whole hundreds (USD). Base it on the trip style and the typical rack rate of the picked camps:
  - classic (value): roughly $300-$500/night base range × nights × 1.35
  - mid-range / premier: roughly $550-$900/night × nights × 1.4
  - luxury / signature: roughly $1,000-$2,000/night × nights × 1.4
- Format as "4,500" with a comma — no currency symbol in the string.
- Mark "highlighted": true on the tier that matches the trip style the operator asked for.

DAYS:
- Generate exactly the number of days the user asks for.
- Spread the destinations across the days sensibly (no single-night stops unless the trip demands it).
- Pick different camps across nights when the library supports it.
- Match the trip style: luxury → favour higher propertyClass, mid-range → balanced, classic → no-frills.

PRACTICAL INFO:
- Use real facts: Kenya and Tanzania e-visa, yellow-fever certificate rules, typical Nairobi/Dar flights from the guest's origin when known, season-specific packing.
- Short, specific. 2-3 sentences each. No filler.`;

  const userPayload = {
    trip: {
      title: proposal.metadata?.title || proposal.trip?.title || "Safari",
      nights,
      destinations,
      tripStyle,
      operatorNote: notes,
      arrivalDate: proposal.trip?.arrivalDate,
      departureDate: proposal.trip?.departureDate,
    },
    client: { guestNames, adults, children, origin },
    operator: { consultantName, companyName },
    library,
  };

  const userText = `Generate the complete personalised proposal draft for these guests. Use every detail. Return ONLY the JSON object described in the system prompt.

Input:
${JSON.stringify(userPayload, null, 2)}`;

  const anth = new Anthropic({ apiKey });

  let raw = "";
  try {
    const msg = await anth.messages.create({
      model: MODEL,
      max_tokens: 12000,
      system: [
        { type: "text", text: systemText, cache_control: { type: "ephemeral" } },
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
      return NextResponse.json({ error: "AI is rate-limited; please retry." }, { status: 429 });
    }
    if (err instanceof Anthropic.APIError) {
      console.error("[AUTOPILOT] Anthropic error:", err.status, err.message);
      return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error("[AUTOPILOT] Unexpected error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  let parsed: AutopilotResponse;
  try {
    parsed = JSON.parse(stripFences(raw));
  } catch {
    console.error("[AUTOPILOT] Could not parse model output:", raw.slice(0, 400));
    return NextResponse.json({ error: "AI returned malformed output. Try again." }, { status: 502 });
  }

  // ── Map Claude's draft → concrete shapes the proposal store consumes ────
  const draftDays = Array.isArray(parsed.days) ? parsed.days.slice(0, nights) : [];
  while (draftDays.length < nights) draftDays.push({});

  const days: Day[] = draftDays.map((d, idx) => ({
    id: nanoid(),
    dayNumber: idx + 1,
    destination: stringOr(d.destination, destinations[idx % Math.max(destinations.length, 1)] || "New Destination"),
    country: stringOr(d.country, "Kenya"),
    subtitle: stringOr(d.subtitle, "") || undefined,
    description: stringOr(d.description, ""),
    board: stringOr(d.board, "Full board"),
    highlights: Array.isArray(d.highlights)
      ? d.highlights.filter((h): h is string => typeof h === "string").slice(0, 5)
      : undefined,
    tiers: {
      classic: pickTier(d.tiers?.classic, library),
      premier: pickTier(d.tiers?.premier, library),
      signature: pickTier(d.tiers?.signature, library),
    },
  }));

  const inclusions = stringArray(parsed.inclusions, 12);
  const exclusions = stringArray(parsed.exclusions, 12);

  const practicalInfo = Array.isArray(parsed.practicalInfo)
    ? parsed.practicalInfo
        .slice(0, 8)
        .map((c) => ({
          id: nanoid(),
          title: stringOr(c.title, "").slice(0, 60) || "Topic",
          body: stringOr(c.body, "").slice(0, 800),
          icon: stringOr(c.icon, "ℹ").slice(0, 4),
        }))
        .filter((c) => c.body.length > 0)
    : [];

  const pricing = normalisePricing(parsed.pricing, tripStyle);

  const cover = { tagline: stringOr(parsed.cover?.tagline, "").slice(0, 160) };
  const greeting = { body: stringOr(parsed.greeting?.body, "").slice(0, 1200) };
  const closing = {
    quote: stringOr(parsed.closing?.quote, "").slice(0, 160),
    signOff: stringOr(parsed.closing?.signOff, "").slice(0, 800),
  };
  const map = { caption: stringOr(parsed.map?.caption, "").slice(0, 80) };
  const quote = {
    quote: stringOr(parsed.quote?.quote, "").slice(0, 200),
    attribution: stringOr(parsed.quote?.attribution, "").slice(0, 80),
  };

  return NextResponse.json({
    cover,
    greeting,
    closing,
    map,
    quote,
    days,
    inclusions,
    exclusions,
    practicalInfo,
    pricing,
  });
}

// ─── Helpers ───────────────────────────────────────────────────────────────

type ProposalInput = {
  metadata?: { title?: string };
  trip?: {
    title?: string;
    nights?: number;
    destinations?: string[];
    tripStyle?: string;
    operatorNote?: string;
    arrivalDate?: string;
    departureDate?: string;
  };
  client?: {
    guestNames?: string;
    adults?: number;
    children?: number;
    origin?: string;
  };
  operator?: {
    consultantName?: string;
    companyName?: string;
  };
};

function stringOr(v: unknown, fallback: string): string {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

function stringArray(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .map((s) => s.trim().slice(0, 200))
    .slice(0, max);
}

function stripFences(text: string): string {
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(text.trim());
  return fence ? fence[1].trim() : text.trim();
}

function pickTier(
  pick: { slot?: number; note?: string } | undefined,
  library: LibraryProperty[],
): { camp: string; location: string; note: string } {
  const slot = typeof pick?.slot === "number" ? pick.slot : -1;
  const prop = library[slot];
  if (!prop) return { camp: "", location: "", note: "" };
  return {
    camp: prop.name,
    location: prop.location || prop.country || "",
    note: typeof pick?.note === "string" ? pick.note : "",
  };
}

function normalisePricing(
  raw: AutopilotResponse["pricing"] | undefined,
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
  const tiers: TierKey[] = ["classic", "premier", "signature"];
  const defaults: Record<TierKey, string> = { classic: "Classic", premier: "Premier", signature: "Signature" };

  const built = {
    classic: normaliseTier(raw?.classic, defaults.classic, highlightedTier === "classic"),
    premier: normaliseTier(raw?.premier, defaults.premier, highlightedTier === "premier"),
    signature: normaliseTier(raw?.signature, defaults.signature, highlightedTier === "signature"),
  };

  // Enforce exactly one highlighted tier — the style-matched one.
  for (const t of tiers) built[t].highlighted = t === highlightedTier;

  return {
    ...built,
    notes: stringOr(raw?.notes, "").slice(0, 500) || undefined,
  };
}

function normaliseTier(
  raw: AutopilotPricingTier | undefined,
  defaultLabel: string,
  highlighted: boolean,
): { label: string; pricePerPerson: string; currency: string; highlighted: boolean } {
  return {
    label: stringOr(raw?.label, defaultLabel).slice(0, 40),
    pricePerPerson: stringOr(raw?.pricePerPerson, "").slice(0, 20),
    currency: stringOr(raw?.currency, "USD").slice(0, 6),
    highlighted,
  };
}
