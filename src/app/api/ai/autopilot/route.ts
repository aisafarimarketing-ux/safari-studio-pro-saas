import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { buildBrandDNAPromptSection } from "@/lib/brandDNAPrompt";
import { nanoid } from "@/lib/nanoid";
import { orderDestinations } from "@/lib/destinationOrdering";
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

// Defaults to claude-sonnet-4-5-20250929 — Sonnet 4.5, dated
// 2025-09-29. This is the production-stable Sonnet that the user
// confirmed is on their Anthropic account. Earlier attempts at
// claude-haiku-4-5-20251001 (model ID not usable on their account)
// and claude-sonnet-4-6 (the un-dated alias, slower) caused Generate
// to either time out or take 4+ minutes. Sonnet 4.5 with date suffix
// is the right balance: fast enough to be usable, stable, and
// definitely available.
//
// Override at deploy time via ANTHROPIC_MODEL env var on Railway.
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5-20250929";

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
  optionalActivities?: AutopilotOptionalActivity[];
  tiers?: Partial<Record<TierKey, { slot?: number; note?: string }>>;
};

type AutopilotOptionalActivity = {
  title?: string;
  location?: string;
  timeOfDay?: string;
  description?: string;
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

// ─── submit_proposal tool ────────────────────────────────────────────────
//
// Tool-use forces the model to return data matching this schema —
// Anthropic's API guarantees `tool_use.input` is valid JSON of this
// shape, so we never have to parse free-text. Eliminates the entire
// "AI returned malformed output" failure mode that plagued Haiku in
// free-text mode.
//
// Schema mirrors AutopilotResponse. All fields optional — the route's
// downstream normalisers handle missing values gracefully.

const SUBMIT_PROPOSAL_TOOL: Anthropic.Tool = {
  name: "submit_proposal",
  description:
    "Submit the personalised safari proposal data. Call this exactly once with all the proposal sections filled in.",
  input_schema: {
    type: "object",
    properties: {
      cover: {
        type: "object",
        properties: { tagline: { type: "string" } },
      },
      greeting: {
        type: "object",
        properties: { body: { type: "string" } },
      },
      closing: {
        type: "object",
        properties: {
          quote: { type: "string" },
          signOff: { type: "string" },
        },
      },
      map: {
        type: "object",
        properties: { caption: { type: "string" } },
      },
      quote: {
        type: "object",
        properties: {
          quote: { type: "string" },
          attribution: { type: "string" },
        },
      },
      days: {
        type: "array",
        items: {
          type: "object",
          properties: {
            destination: { type: "string" },
            country: { type: "string" },
            subtitle: { type: "string" },
            description: { type: "string" },
            board: { type: "string" },
            highlights: { type: "array", items: { type: "string" } },
            optionalActivities: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  location: { type: "string" },
                  timeOfDay: { type: "string" },
                  description: { type: "string" },
                },
              },
            },
            tiers: {
              type: "object",
              properties: {
                classic: {
                  type: "object",
                  properties: {
                    slot: { type: "number" },
                    note: { type: "string" },
                  },
                },
                premier: {
                  type: "object",
                  properties: {
                    slot: { type: "number" },
                    note: { type: "string" },
                  },
                },
                signature: {
                  type: "object",
                  properties: {
                    slot: { type: "number" },
                    note: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
      inclusions: { type: "array", items: { type: "string" } },
      exclusions: { type: "array", items: { type: "string" } },
      practicalInfo: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            body: { type: "string" },
            icon: { type: "string" },
          },
        },
      },
      pricing: {
        type: "object",
        properties: {
          classic: {
            type: "object",
            properties: {
              label: { type: "string" },
              pricePerPerson: { type: "string" },
              currency: { type: "string" },
              highlighted: { type: "boolean" },
            },
          },
          premier: {
            type: "object",
            properties: {
              label: { type: "string" },
              pricePerPerson: { type: "string" },
              currency: { type: "string" },
              highlighted: { type: "boolean" },
            },
          },
          signature: {
            type: "object",
            properties: {
              label: { type: "string" },
              pricePerPerson: { type: "string" },
              currency: { type: "string" },
              highlighted: { type: "boolean" },
            },
          },
          notes: { type: "string" },
        },
      },
    },
  },
};

// Top-level wrapper: catches ANY error from the handler so the
// client always gets a JSON body with a descriptive `error` field.
// Without this, an unhandled exception (Prisma schema mismatch,
// brandDNA throw, type assertion fail) would bubble to Next's
// default 500 page — which is HTML, not JSON, and the client's
// catch block can't extract a useful message. The user just sees
// "HTTP 500" with no clue what went wrong.
export async function POST(req: Request) {
  try {
    return await handleAutopilot(req);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[AUTOPILOT] UNHANDLED EXCEPTION:", message);
    if (stack) console.error("[AUTOPILOT] stack:", stack);
    return NextResponse.json(
      { error: `Autopilot crashed: ${message}` },
      { status: 500 },
    );
  }
}

async function handleAutopilot(req: Request): Promise<Response> {
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
  // Reorder destinations into the typical safari sequence before drafting.
  // Operators often type stops in any order ("Serengeti, Tarangire, Arusha");
  // we route them through gateway → inner → coast so Day 1 lands at a
  // sensible arrival city and the journey makes geographic sense. The
  // editor can still override day-by-day after generation.
  const destinations = orderDestinations(
    (proposal.trip?.destinations ?? []).filter((d): d is string => !!d?.trim()),
  );
  const tripStyle = proposal.trip?.tripStyle?.trim() || "Mid-range";
  const notes = proposal.trip?.operatorNote?.trim() || "";
  const guestNames = proposal.client?.guestNames?.trim() || "";
  const adults = Number(proposal.client?.adults ?? 0) || 0;
  const children = Number(proposal.client?.children ?? 0) || 0;
  const origin = proposal.client?.origin?.trim() || "";
  const consultantName = proposal.operator?.consultantName?.trim() || "";
  const companyName = proposal.operator?.companyName?.trim() || "";

  // ── Library snapshot ────────────────────────────────────────────────────
  // Cap aggressively to keep the prompt small. The model only picks
  // 1-3 properties per day, so a library of 20 (recently updated)
  // is plenty. Each summary at 100 chars retains the distinguishing
  // pitch ("on a working coffee estate", "tented camp on the
  // Mara") without paying for the full marketing copy in tokens.
  //
  // These cuts drop ~25% off the prompt-processing time. To go
  // further, switch ANTHROPIC_MODEL env var to Haiku — see
  // claude-haiku-4-5-20251015 for ~3x speedup (full proposal
  // typically renders in 15-30s on Haiku vs 60-150s on Sonnet).
  const LIBRARY_TAKE = 20;
  const SUMMARY_MAX_CHARS = 100;
  const properties = await prisma.property.findMany({
    where: { organizationId: ctx.organization.id, archived: false },
    select: {
      id: true, name: true, propertyClass: true, shortSummary: true,
      location: { select: { name: true, country: true } },
      tags: { include: { tag: { select: { name: true } } } },
    },
    orderBy: { updatedAt: "desc" },
    take: LIBRARY_TAKE,
  });
  const library: LibraryProperty[] = properties.map((p, i) => ({
    slot: i,
    id: p.id,
    name: p.name,
    location: p.location?.name ?? "",
    country: p.location?.country ?? null,
    propertyClass: p.propertyClass,
    shortSummary: (p.shortSummary ?? "").slice(0, SUMMARY_MAX_CHARS),
    tags: p.tags.map((t) => t.tag.name).slice(0, 6),
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

You are drafting a COMPLETE, personalised safari proposal. Fill every section listed below.

CRITICAL OUTPUT RULES — non-negotiable:
- Your entire response MUST be a single JSON object.
- The very first character is "{" and the very last character is "}".
- No greeting, no "Here's…", no "Sure thing,…", no "I've drafted…".
- No closing remarks after the JSON.
- No markdown code fences anywhere (no triple backticks before or after).
- No commentary inline. No comments inside the JSON either.
- All strings must be properly escaped JSON (use \\" inside strings, \\n for newlines).

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
      "description": "Lead line + supporting paragraphs separated by blank lines. The first paragraph is one sentence — the day's headline action — and MUST end on the named place wrapped in **double-asterisk bold**, e.g. '…drive southwestwards to **Tarangire National Park**.' Then 1–3 supporting paragraphs of grounded prose, also wrapping any park / region / camp names in **bold**. No clichés.",
      "board": "Full board" | "Half board" | "B&B" | "All inclusive",
      "highlights": ["short bullet", "short bullet"],
      "optionalActivities": [
        { "title": "Short activity name", "location": "Where it happens", "timeOfDay": "Morning" | "Afternoon" | "Evening" | "All Day", "description": "Optional 1-sentence note (≤25 words), or empty string" }
      ],
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

OPTIONAL ACTIVITIES:
- Produce 2–4 optional add-ons per day that genuinely belong to the day's destination. Real, specific things — named walks, named viewpoints, cultural visits, cooking classes, balloon safaris, hot springs, bike rides — not generic filler.
- Each title is a short noun phrase (≤8 words). Each location is the named place it happens at (will be bolded in the UI). timeOfDay must be one of: Morning, Afternoon, Evening, All Day.
- Do NOT include price — the operator sets prices manually.
- Arrival days, departure days, and long-transit days can have fewer optionals (1–2 is fine). Game-drive days in iconic parks should have 3–4.

FIRST AND LAST DAYS ARE FIXED POINTS — no exceptions:
- Day 1 MUST use the FIRST destination in the input "destinations" list. This is the arrival gateway (usually Arusha, Nairobi, or similar). Never invent a different Day 1 city.
- The LAST day MUST use either (a) the LAST destination in the input list, or (b) the FIRST destination (return to gateway for departure). Pick whichever is more realistic for the trip shape — a beach extension ends on the beach; a classic safari loop returns to the gateway.
- Never introduce a destination on Day 1 or the last day that is not in the input list.
- Internal days (2 through N-1) distribute the remaining input destinations in a geographically sensible order. Do NOT repeat the same destination as a one-night stop between other destinations — that's not how real safaris route.

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

  const userText = `Generate the complete personalised proposal draft for these guests. Use every detail. You MUST return the result by calling the submit_proposal tool — do not write the JSON in a free-text response.

Input:
${JSON.stringify(userPayload, null, 2)}`;

  const anth = new Anthropic({ apiKey });

  // ── Tool-use API ──
  // Switched from free-text JSON to a forced tool call. Anthropic
  // guarantees that `tool_use.input` matches the input_schema below,
  // so we never have to JSON.parse model text again — eliminating
  // the entire "AI returned malformed output" failure mode.
  // submit_proposal_tool defined at module scope; see proposalToolSchema().

  let parsed: AutopilotResponse;
  const startedAt = Date.now();
  console.log(`[AUTOPILOT] start · model=${MODEL} · destinations=${destinations.length} · libraryProps=${library.length} · nights=${nights}`);
  try {
    const msg = await anth.messages.create(
      {
        model: MODEL,
        max_tokens: 8000,
        system: [
          { type: "text", text: systemText, cache_control: { type: "ephemeral" } },
        ],
        messages: [{ role: "user", content: userText }],
        tools: [SUBMIT_PROPOSAL_TOOL],
        tool_choice: { type: "tool", name: "submit_proposal" },
      },
      { timeout: 90_000 },
    );
    const elapsedMs = Date.now() - startedAt;
    console.log(`[AUTOPILOT] anthropic done in ${elapsedMs}ms · in_tokens=${msg.usage?.input_tokens ?? "?"} · out_tokens=${msg.usage?.output_tokens ?? "?"} · stop_reason=${msg.stop_reason ?? "?"}`);

    const toolUse = msg.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "submit_proposal",
    );
    if (!toolUse) {
      console.error("[AUTOPILOT] no tool_use block in response. content kinds:", msg.content.map((b) => b.type));
      return NextResponse.json(
        { error: "AI didn't return structured output. Try again." },
        { status: 502 },
      );
    }
    parsed = toolUse.input as AutopilotResponse;
  } catch (err) {
    const elapsedMs = Date.now() - startedAt;
    console.error(`[AUTOPILOT] anthropic failed after ${elapsedMs}ms · model=${MODEL}`);
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
    optionalActivities: pickOptionalActivities(d.optionalActivities),
    tiers: {
      classic: pickTier(d.tiers?.classic, library),
      premier: pickTier(d.tiers?.premier, library),
      signature: pickTier(d.tiers?.signature, library),
    },
  }));

  // Clamp Day 1 and the last day to the operator's input destination list.
  // The prompt already asks for this, but a belt-and-braces normalisation
  // stops the model from inventing "Day 7: Tarangire" when the trip shape
  // is Arusha → Tarangire → Serengeti → Ngorongoro → Zanzibar. If the
  // model's pick isn't in the input list, snap: Day 1 → first destination,
  // last day → last destination.
  if (destinations.length > 0 && days.length > 0) {
    const norm = (s: string) => s.trim().toLowerCase();
    const allowed = new Set(destinations.map(norm));
    if (!allowed.has(norm(days[0].destination))) {
      days[0].destination = destinations[0];
    }
    const last = days[days.length - 1];
    if (!allowed.has(norm(last.destination))) {
      last.destination = destinations[destinations.length - 1];
    }
  }

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

  // ── Property snapshots ──────────────────────────────────────────────
  // Days[].tiers carry only the camp NAME — the proposal-level
  // properties[] array is what PropertyShowcaseSection actually
  // renders. Without populating it, the proposal opened in the
  // editor with an empty "Your accommodations" section even though
  // every day showed a camp pick. Fix: collect every unique slot
  // picked across all tiers, fetch the full Property record + images,
  // and map into the shape proposal.properties[] expects.
  const pickedSlotIndices = new Set<number>();
  for (const d of days) {
    for (const t of ["classic", "premier", "signature"] as const) {
      const slot = d.tiers?.[t]?.camp ? library.findIndex((p) => p.name === d.tiers[t].camp) : -1;
      if (slot >= 0) pickedSlotIndices.add(slot);
    }
  }
  const pickedIds = Array.from(pickedSlotIndices)
    .map((s) => library[s]?.id)
    .filter((id): id is string => !!id);

  let propertySnapshots: Array<Record<string, unknown>> = [];
  if (pickedIds.length > 0) {
    // Tight projection — earlier version used `include: { rooms: ... }`
    // (no select), which fetched every Room field including potentially
    // large imageUrls arrays. On orgs with several picked properties,
    // this routinely exceeded Postgres' 8s statement_timeout and
    // crashed the autopilot route with "cancelling statement due to
    // statement timeout". Switched to explicit selects + capped
    // images and rooms at the SQL level so the query always returns
    // in well under a second regardless of property complexity.
    const fullProps = await prisma.property.findMany({
      where: { id: { in: pickedIds }, organizationId: ctx.organization.id },
      select: {
        id: true,
        name: true,
        shortSummary: true,
        whatMakesSpecial: true,
        whyWeChoose: true,
        amenities: true,
        mealPlan: true,
        suggestedNights: true,
        checkInTime: true,
        checkOutTime: true,
        totalRooms: true,
        spokenLanguages: true,
        specialInterests: true,
        location: { select: { name: true, country: true } },
        images: {
          orderBy: { order: "asc" },
          select: { url: true, isCover: true },
          take: 8,
        },
        rooms: {
          orderBy: { order: "asc" },
          select: {
            id: true,
            name: true,
            bedConfig: true,
            description: true,
            imageUrls: true,
          },
          take: 6,
        },
      },
    });
    // Order by the pick order so the showcase reads in itinerary
    // sequence rather than DB-update order.
    const idOrder = new Map(pickedIds.map((id, i) => [id, i] as const));
    fullProps.sort((a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0));

    // How many nights per property — sum across days where that
    // property appears in any tier. Conservative: counts the day for
    // every tier-match, but typical proposals have only one tier
    // chosen per day so this matches reality.
    const nightsByName = new Map<string, number>();
    for (const d of days) {
      const name = d.tiers?.[(parsed.pricing && Object.keys(parsed.pricing).find((k) => k !== "notes")) as "classic" | "premier" | "signature" || "premier"]?.camp
        ?? d.tiers?.classic?.camp ?? d.tiers?.premier?.camp ?? d.tiers?.signature?.camp ?? "";
      if (!name) continue;
      nightsByName.set(name, (nightsByName.get(name) ?? 0) + 1);
    }

    // URL-shape filter: keep https/http URLs, drop data: URLs. Old
    // properties uploaded before Supabase Storage was configured may
    // still carry inline base64 images — including those inline blows
    // the proposal payload past Next's body-size limit and the merged
    // save fails silently, leaving the editor opening on a blank first
    // save. The Property record itself still has the data URL for the
    // editor's per-property views; only the snapshot embedded in the
    // proposal is trimmed.
    const isSafeUrl = (u: string | null | undefined): u is string =>
      !!u && (u.startsWith("http://") || u.startsWith("https://") || u.startsWith("/"));
    const MAX_GALLERY_PER_PROPERTY = 6;
    const MAX_IMAGES_PER_ROOM = 4;

    propertySnapshots = fullProps.map((p) => {
      const safeImages = p.images.filter((i) => isSafeUrl(i.url));
      const cover = safeImages.find((i) => i.isCover) ?? safeImages[0];
      const galleryUrls = safeImages
        .map((i) => i.url)
        .slice(0, MAX_GALLERY_PER_PROPERTY);
      return {
        id: p.id,
        name: p.name,
        location:
          [p.location?.name, p.location?.country].filter(Boolean).join(", ") || "",
        shortDesc: p.shortSummary ?? "",
        description: p.whatMakesSpecial ?? "",
        whyWeChoseThis: p.whyWeChoose ?? "",
        amenities: p.amenities ?? [],
        mealPlan: p.mealPlan ?? "",
        roomType: "",
        nights: nightsByName.get(p.name) ?? p.suggestedNights ?? 1,
        leadImageUrl: cover?.url ?? "",
        galleryUrls,
        checkInTime: p.checkInTime ?? undefined,
        checkOutTime: p.checkOutTime ?? undefined,
        totalRooms: p.totalRooms ?? undefined,
        spokenLanguages: p.spokenLanguages ?? [],
        specialInterests: p.specialInterests ?? [],
        rooms: p.rooms.map((r) => ({
          id: r.id,
          name: r.name,
          bedConfig: r.bedConfig ?? undefined,
          description: r.description ?? undefined,
          imageUrls: (r.imageUrls ?? [])
            .filter(isSafeUrl)
            .slice(0, MAX_IMAGES_PER_ROOM),
        })),
      };
    });
  }

  return NextResponse.json({
    cover,
    greeting,
    closing,
    map,
    quote,
    trip: { destinations },
    days,
    inclusions,
    exclusions,
    practicalInfo,
    pricing,
    properties: propertySnapshots,
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

const ALLOWED_TIME_OF_DAY = new Set(["Morning", "Afternoon", "Evening", "All Day"]);

function pickOptionalActivities(
  raw: AutopilotOptionalActivity[] | undefined,
): import("@/lib/types").OptionalActivity[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const cleaned = raw
    .map((a) => {
      const title = stringOr(a?.title, "").slice(0, 80);
      if (!title) return null;
      const rawTime = stringOr(a?.timeOfDay, "");
      const timeOfDay = ALLOWED_TIME_OF_DAY.has(rawTime) ? rawTime : "Morning";
      return {
        id: nanoid(),
        title,
        location: stringOr(a?.location, "").slice(0, 80) || undefined,
        timeOfDay,
        description: stringOr(a?.description, "").slice(0, 240) || undefined,
      };
    })
    .filter((a): a is NonNullable<typeof a> => a !== null)
    .slice(0, 6);
  return cleaned.length > 0 ? cleaned : undefined;
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
