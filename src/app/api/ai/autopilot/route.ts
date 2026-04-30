import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { buildBrandDNAPromptSection } from "@/lib/brandDNAPrompt";
import { nanoid } from "@/lib/nanoid";
import { orderDestinations, countryOf } from "@/lib/destinationOrdering";
import { classifyStop } from "@/lib/safariRoutingRules";
import { pickBrandImageForDestination, type BrandImage } from "@/lib/brandDNA";
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
//
// ─── Day-generation rules — DO NOT RELAX WITHOUT OPERATOR SIGN-OFF ──────
//
// Each rule below was added because the previous behaviour produced a
// real complaint from the operator. Don't unwind these when refactoring.
//
//   1. ARRIVAL AND DEPARTURE ARE ALWAYS GATEWAYS.
//      Day 1 snaps to the FIRST gateway in `destinations`; the last day
//      snaps to the LAST gateway. Gateways live in safariRoutingRules.ts
//      (Arusha, Nairobi, Kilimanjaro, Zanzibar, Stone Town, Mombasa,
//      Diani, Kigali, Entebbe, Kampala, Dar es Salaam). Parks
//      (Tarangire, Manyara, Serengeti, Mara, Amboseli, Ngorongoro, etc.)
//      can NEVER be a trip endpoint. The snap fires unconditionally —
//      don't gate on "only if AI's pick isn't in the allowed list"
//      (that's how Lake-Manyara-as-last-day slipped through).
//
//   2. COUNTRY RESOLVES FROM THE DESTINATION ORDERING TABLE.
//      `country: stringOr(d.country, "") || countryOf(destination) || ""`.
//      No hardcoded fallback. The previous "Kenya" default was stamping
//      Tanzanian destinations as Kenyan whenever the AI omitted country.
//
//   3. NEVER FABRICATE PHANTOM DAYS.
//      If the AI returns fewer days than `nights`, console.warn and
//      skip — don't `while (draftDays.length < nights) draftDays.push({})`.
//      Empty {} slots feed the modulo-cycle destination fallback and
//      produce nonsense rows like "Day 7 · Lake Manyara, Kenya" on a
//      Zanzibar-ending trip.
//
// Memory anchor: ~/.claude/.../memory/map_and_routing_rules.md
// ─────────────────────────────────────────────────────────────────────────

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
  momentOfDay?: string;
  driveTimeBefore?: string;
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

// Pricing tier types removed — the AI no longer produces pricing.
// See zeroedPricing() near the bottom of this file: pricing is built
// server-side from the tripStyle (for the highlighted-tier flag) with
// empty pricePerPerson values. Operator types real numbers in the
// editor after the draft lands.

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
    "Submit the personalised safari proposal data. Call this exactly once with all the proposal sections filled in. The `days` array is REQUIRED — it is the heart of the proposal, never return an empty array. If you are running short on output budget, prioritise filling `days[]` over the cosmetic prose blocks (cover/quote/closing).",
  input_schema: {
    type: "object",
    required: ["days"],
    // Property order matters here. Anthropic serialises tool_use input
    // in declaration order, and we were running out of max_tokens
    // mid-output on heavy proposals — the model wrote rich prose for
    // cover/greeting/closing first, then never reached days[]. Forcing
    // days to be FIRST in the schema means the model writes them
    // before it can blow the budget on cosmetic prose. Lists with no
    // length cap (inclusions, exclusions) follow days for the same
    // reason. Cosmetic single-string fields go last — easy to truncate
    // if budget gets tight.
    properties: {
      days: {
        type: "array",
        // Force at least one day item — `required: ["days"]` only
        // enforces the key's presence, so the AI was satisfying it
        // with `days: []` on heavy multi-constraint prompts (schedule
        // + pace + interests + routines combined). minItems makes the
        // tool validation reject empty arrays so the model must fill.
        minItems: 1,
        items: {
          type: "object",
          // Each day must at minimum carry a destination + description
          // — those are the structural fields downstream code depends
          // on (day card render, map labels, pricing nights count).
          required: ["destination", "description"],
          properties: {
            destination: { type: "string" },
            country: { type: "string" },
            subtitle: { type: "string" },
            description: { type: "string" },
            // Editorial pull-quote — ONE evocative line, 8-14 words,
            // present tense, sensory specifics. Surfaces above the
            // narrative as the day's hook. No clichés ("magical",
            // "unforgettable"), no exclamation marks. Optional —
            // operators can fill in via the AI button if blank.
            momentOfDay: { type: "string" },
            // How the traveller arrives at this day's location from
            // the previous one. Free-form short text, e.g.
            // "→ 2.5 hr scenic drive · Manyara to Tarangire". Day 1
            // has no preceding day — this is unused there.
            driveTimeBefore: { type: "string" },
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
      // Cosmetic single-string fields LAST — written after days,
      // inclusions, exclusions, and practicalInfo. The model serialises
      // tool_use input in property-declaration order; if max_tokens is
      // hit while writing prose, the structural lists above are
      // already complete and the proposal still works. Operator can
      // refresh the prose blocks via the per-section AI Write button.
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
      // Pricing intentionally OMITTED from the AI tool schema.
      // Operator brief: pricing is filled in by hand after generation —
      // the AI's $/night × nights × markup guess was always wrong and
      // operators overrode 100% of the time. Removing the field saves
      // ~300 output tokens per call and stops anchoring the operator
      // on a fictional number. Server returns zeroed price tiers
      // instead so the proposal still has a valid pricing block; see
      // zeroedPricing() in the merge step.
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

  // ── Stops vs destinations ──────────────────────────────────────────────
  // New trip-setup flow ships an explicit per-stop schedule on
  // proposal.trip.stops: ordered destinations with explicit nights,
  // optional per-tier pre-picked properties, and optional pre-picked
  // hero images. When stops is present we honour the operator's
  // ordering exactly — no orderDestinations() reshuffle. The flat
  // destinations[] is derived from stops for back-compat.
  //
  // Older proposals (and the in-editor "Regenerate" flow) still pass
  // a flat destinations[] — that path falls back to the legacy
  // orderDestinations() reshuffle so the AI's day allocation stays
  // sensible without the operator-supplied schedule.
  const inputStops = Array.isArray(proposal.trip?.stops)
    ? (proposal.trip.stops as InputStop[]).filter((s) => !!s?.destination?.trim() && (s.nights ?? 0) > 0)
    : [];
  const destinations = inputStops.length > 0
    ? inputStops.map((s) => s.destination.trim())
    : orderDestinations(
        (proposal.trip?.destinations ?? []).filter((d): d is string => !!d?.trim()),
      );
  const tripStyle = proposal.trip?.tripStyle?.trim() || "Mid-range";
  const notes = proposal.trip?.operatorNote?.trim() || "";
  // Pace knob — relaxed/balanced/packed. Passed to the AI to scale
  // optional-activity volume + transfer density. Defaults to balanced
  // for old proposals or proposals where the operator skipped the
  // control.
  const pace = ((): "relaxed" | "balanced" | "packed" => {
    const raw = proposal.trip?.pace;
    return raw === "relaxed" || raw === "balanced" || raw === "packed" ? raw : "balanced";
  })();
  // Client interests — multi-select chips. Empty array = AI stays
  // neutral. Used to bias optional-activity selection and lodge picks
  // (e.g., "Birding" → birding-focused camps).
  const interests = Array.isArray(proposal.trip?.interests)
    ? (proposal.trip.interests as string[]).filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    : [];
  const arrivalRoutine = proposal.trip?.arrivalRoutine?.trim() || "";
  const departureRoutine = proposal.trip?.departureRoutine?.trim() || "";
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
  // Loaded once for two purposes:
  //   1. buildBrandDNAPromptSection — voice/tone/banned-words guidance
  //      injected into the system prompt.
  //   2. imageLibrary — used after generation to auto-pick a hero image
  //      per day from the operator's tagged location library, mirroring
  //      the behaviour of /api/proposals/from-template (clone path).
  //      Without this the autopilot path produced day cards with empty
  //      heroes; from-template clones came in fully wired. Now both
  //      paths behave identically.
  let brandDNASection = "";
  let brandImageLibrary: BrandImage[] = [];
  try {
    const profile = await prisma.brandDNAProfile.findUnique({
      where: { organizationId: ctx.organization.id },
    });
    brandDNASection = buildBrandDNAPromptSection(profile);
    brandImageLibrary = (profile?.imageLibrary as BrandImage[] | null) ?? [];
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
    "body": "Four parts in 4-6 sentences total. (1) Greet by FIRST NAME ONLY — never use the surname or full name (e.g. 'Sam, ...' not 'Sam Kombe, ...'). When there are multiple guests, use only first names ('Sam and Lily, ...'). (2) Thank them for choosing the operator's company by name. (3) Tell them why this trip and timing is a strong choice — be specific to the destinations and the season they're travelling, not generic praise. (4) Set expectations — what they'll experience, in concrete sensory terms (animals, landscapes, moments), without overselling. End on an invitation, never a sales pitch. No clichés ('trip of a lifetime', 'magical', 'unforgettable')."
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

DAYS — THE SINGLE MOST IMPORTANT FIELD:
- The "days" array MUST be non-empty. days.length MUST equal trip.nights exactly.
- This is non-negotiable. A response with empty days[] fails validation and produces a useless proposal — operators have to start over. NEVER return an empty days[] array.
- The schema is ordered so days appears FIRST. Write it first, completely, before any cosmetic prose. Do not skip ahead to cover/greeting/closing — those come later in the schema for a reason.
- If you are running short on output budget after days+lists, write SHORT cosmetic prose (one-sentence cover.tagline, two-sentence closing.signOff). It is fine for cosmetic prose to be terse — operators can refresh those via the per-section AI Write button.

WHEN trip.writingPlan IS PROVIDED (array of {night, destination}):
- writingPlan tells you which destination to write about for each night. It's a writing guide, NOT the days output.
- You MUST produce one entry in days[] for each entry in writingPlan. days.length === writingPlan.length.
- Concretely: writingPlan has 7 entries → you write a days[] array with 7 entries. days[0].destination = writingPlan[0].destination ("Arusha"), days[0].description = your narrative for night 1 in Arusha, etc.
- For every night in writingPlan, fill: destination, country, description, momentOfDay, board, highlights, optionalActivities, tiers, driveTimeBefore.
- Do NOT confuse writingPlan with the output. writingPlan is the input outline. days[] is what you WRITE.

WHEN trip.writingPlan IS NOT PROVIDED:
- Distribute the destinations across the requested number of days yourself. No single-night stops unless the trip demands it.

CAMP PICKS:
- Pick different camps across nights when the library supports it.
- Match the trip style: luxury → favour higher propertyClass, mid-range → balanced, classic → no-frills.

PACE (trip.pace):
- "relaxed" — 1 optional activity per day on average, slower mornings, fewer transfers per day, lean narrative on rest + camp time.
- "balanced" — 2 optionals on game-drive days, 1 on transfer / arrival days. Default.
- "packed" — 3-4 optionals on full days, narratives reference back-to-back activities. Avoid suggesting downtime.

INTERESTS (trip.interests):
- When present, bias optional activities AND tier-pick notes toward the listed interests. Examples: "Birding" → birding hides, named species, walking guides; "Photography" → camp vehicles with bean bags / hides, golden-hour timing; "Family" → family-friendly camps, pool, kid programs; "Honeymoon" → private dinners, sunset moments, secluded settings; "Cultural" → village visits, named guides, craft cooperatives.
- Don't shoehorn — only weave in interest cues that genuinely belong to that day's destination.

ARRIVAL ROUTINE (trip.arrivalRoutine):
- When set, the operator has prescribed Day 1's routine. You MUST mirror it in days[0].description (lead paragraph) and days[0].highlights. Don't invent a game drive on Day 1 if the operator says "welcome dinner". Don't swap the named hotel for a different one.
- When not set, write Day 1 as a sensible arrival day for the gateway destination.

DEPARTURE ROUTINE (trip.departureRoutine):
- When set, the operator has prescribed the LAST day's routine. Apply the same constraint as arrivalRoutine — last day's narrative reflects the operator's scripted close.
- When not set, write the last day as a sensible transfer + departure day.

DAY MOMENT-OF-THE-DAY (momentOfDay):
- For EVERY day, write ONE editorial pull-quote — 8 to 14 words, present tense, sensory specifics. This is the day's hook for skim-readers.
- Examples of the right register: "Lions hunting at dawn — reserved seats at the Sunrise Hide." / "The crater rim at first light, before the trucks arrive." / "A walking safari with a Maasai guide, tracks fresh from last night."
- NO clichés ("magical", "unforgettable", "breathtaking", "trip of a lifetime"). NO exclamation marks. NO question marks. NO quotation marks (it renders italic).
- Present tense only — the reader is anticipating, not remembering.
- Lean on the day's actual content: the destination's signature thing, a time-of-day moment, a sensory detail. Different angle each day so a multi-day trip doesn't read repetitive.

DRIVE-TIME / TRANSFER (driveTimeBefore):
- For every day EXCEPT day 1, write a short transfer caption describing how the traveller arrives from the previous day's location.
- Format: "→ {duration} {mode} · {from} to {to}". Examples: "→ 2.5 hr scenic drive · Manyara to Tarangire" / "✈ 1 hr flight · Arusha to Zanzibar" / "→ 30 min transfer · Lake Manyara to Ngorongoro Crater rim".
- Drive time is realistic for the actual geography (don't invent — Tarangire to Manyara is ~1.5 hr, Serengeti to Arusha airstrip is ~1 hr fly or ~8 hr drive).
- Use → for road, ✈ for flight. Keep the whole caption under 100 chars.
- Day 1 has no preceding day — leave its driveTimeBefore empty/missing.

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

  // ── Day schedule ───────────────────────────────────────────────────────
  // When operator-supplied stops are present, build a deterministic
  // day → destination schedule from them. We give this to the AI as
  // an explicit constraint so the model only writes the narrative —
  // it can't reorder destinations or change which day stops where.
  // Also captures the operator's per-stop pre-pick property ids and
  // hero image URLs so we can apply those after the AI returns.
  // ScheduleEntry type is defined once at module scope (see bottom)
  // because it's also part of the ProcessContext bundle threaded
  // through processParsedResponse() and buildAutopilotStream().
  const schedule: ScheduleEntry[] = [];
  if (inputStops.length > 0) {
    let day = 1;
    for (const stop of inputStops) {
      const stopNights = Math.max(0, Math.floor(stop.nights));
      for (let i = 0; i < stopNights && day <= nights; i++) {
        schedule.push({
          dayNumber: day,
          destination: stop.destination.trim(),
          propertyByTier: stop.propertyByTier,
          heroImageUrl: stop.heroImageUrl,
        });
        day++;
      }
    }
  }

  // Build a per-night itinerary outline the AI uses as its writing
  // guide. Renamed from "schedule" because the model was reading
  // "schedule provided" as "days are already defined, no need to
  // populate days[]" and returning empty arrays. The new framing —
  // "writingPlan" — is unambiguous: this is a list of nights the AI
  // must write narrative for.
  const writingPlan = schedule.map(({ dayNumber, destination }) => ({
    night: dayNumber,
    destination,
  }));

  const userPayload = {
    trip: {
      title: proposal.metadata?.title || proposal.trip?.title || "Safari",
      nights,
      destinations,
      // Per-night writing guide — when present, days[N-1] MUST exist
      // and have destination matching writingPlan[N-1].destination.
      // Field renamed from "schedule" to avoid the AI mis-reading
      // it as "days are already done".
      writingPlan: writingPlan.length > 0 ? writingPlan : undefined,
      tripStyle,
      pace,
      interests: interests.length > 0 ? interests : undefined,
      arrivalRoutine: arrivalRoutine || undefined,
      departureRoutine: departureRoutine || undefined,
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

  // ── AI call — streaming or one-shot ────────────────────────────────────
  // Detect Accept: text/event-stream on the request to pick which mode
  // to use. Streaming returns Server-Sent Events with per-day progress
  // so the operator's loading screen renders days as they arrive
  // instead of staring at a 30-90s spinner. One-shot returns a single
  // JSON response — used by the editor's in-page Regenerate flow and
  // any caller that doesn't want streaming.
  const wantsStream = req.headers.get("accept")?.includes("text/event-stream") ?? false;

  // Context bundle threaded through processParsedResponse() — both the
  // streaming and one-shot paths share the post-processing code.
  const processCtx: ProcessContext = {
    nights,
    destinations,
    schedule,
    brandImageLibrary,
    library,
    organizationId: ctx.organization.id,
    tripStyle,
  };

  // Streaming path — wraps the same Anthropic call in a ReadableStream
  // and emits per-day events as the model writes them.
  if (wantsStream) {
    const sseStream = buildAutopilotStream({
      anth,
      model: MODEL,
      systemText,
      userText,
      tool: SUBMIT_PROPOSAL_TOOL,
      processCtx,
    });
    return new Response(sseStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        // Disable Nginx / Vercel buffering so chunks reach the client
        // immediately. Without this, SSE chunks pile up in the proxy
        // until the connection ends and the streaming UI is silent.
        "X-Accel-Buffering": "no",
      },
    });
  }

  // ── One-shot path (returns one JSON response) ─────────────────────────
  //
  // Implementation note: even though the caller wants a single JSON
  // payload, we use anth.messages.stream() under the hood instead of
  // .create(). At max_tokens = 32K the SDK refuses .create() with
  // "Streaming is required for operations that may take longer than
  // 10 minutes" — Anthropic's safeguard against hung connections. The
  // stream API has no such cap; we just await its finalMessage() and
  // return synchronously to the caller. From the caller's perspective
  // nothing changed — they still get one JSON body.
  //
  // The actual SSE streaming branch (when the client passes
  // Accept: text/event-stream) is handled above and emits per-day
  // events as the model writes; this branch is for anyone who wants
  // the raw aggregated output (editor's Regenerate, sample import).

  let parsed: AutopilotResponse;
  const startedAt = Date.now();
  console.log(`[AUTOPILOT] start · model=${MODEL} · destinations=${destinations.length} · libraryProps=${library.length} · nights=${nights}`);
  try {
    const stream = anth.messages.stream(
      {
        model: MODEL,
        // Sonnet 4-5 supports 64K output. 32K gives complex multi-
        // country itineraries (10+ destinations, 14+ nights) plenty of
        // room to fill days, lists, and prose without truncation.
        max_tokens: 32000,
        system: [
          { type: "text", text: systemText, cache_control: { type: "ephemeral" } },
        ],
        messages: [{ role: "user", content: userText }],
        tools: [SUBMIT_PROPOSAL_TOOL],
        tool_choice: { type: "tool", name: "submit_proposal" },
      },
      { timeout: 600_000 },
    );

    const finalMessage = await stream.finalMessage();
    const elapsedMs = Date.now() - startedAt;
    console.log(`[AUTOPILOT] anthropic done in ${elapsedMs}ms · in_tokens=${finalMessage.usage?.input_tokens ?? "?"} · out_tokens=${finalMessage.usage?.output_tokens ?? "?"} · stop_reason=${finalMessage.stop_reason ?? "?"}`);

    const toolUse = finalMessage.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "submit_proposal",
    );
    if (!toolUse) {
      console.error("[AUTOPILOT] no tool_use block in response. content kinds:", finalMessage.content.map((b) => b.type));
      return NextResponse.json(
        { error: "AI didn't return structured output. Try again." },
        { status: 502 },
      );
    }
    parsed = toolUse.input as AutopilotResponse;
    // Diagnostic: log the parsed-output shape. Surfaces 0-days bugs
    // and over-budget truncation early.
    console.log(
      `[AUTOPILOT] parsed shape · keys=${Object.keys(parsed).join(",")} · days.len=${Array.isArray(parsed.days) ? parsed.days.length : "not-array"} · greeting=${parsed.greeting?.body ? "set" : "empty"} · cover=${parsed.cover?.tagline ? "set" : "empty"}`,
    );
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

  const result = await processParsedResponse(parsed, processCtx);
  return NextResponse.json(result);
}

// ─── Streaming + post-processing helpers ─────────────────────────────────

// Bundled context that travels from the request handler down into the
// stream callback and the post-processing helper. Avoids passing a
// dozen positional args.
type ProcessContext = {
  nights: number;
  destinations: string[];
  schedule: ScheduleEntry[];
  brandImageLibrary: BrandImage[];
  library: LibraryProperty[];
  organizationId: string;
  tripStyle: string;
};

type ScheduleEntry = {
  dayNumber: number;
  destination: string;
  propertyByTier?: Partial<Record<TierKey, string>>;
  heroImageUrl?: string;
};

// Turn the Anthropic-parsed AI output into the full response object
// the client merges into the proposal store. Identical post-processing
// for the streaming and one-shot paths — both call this once the AI's
// final tool_use input is in hand.
async function processParsedResponse(
  parsed: AutopilotResponse,
  pctx: ProcessContext,
): Promise<{
  cover: { tagline: string };
  greeting: { body: string };
  closing: { quote: string; signOff: string };
  map: { caption: string };
  quote: { quote: string; attribution: string };
  trip: { destinations: string[] };
  days: Day[];
  inclusions: string[];
  exclusions: string[];
  practicalInfo: Array<{ id: string; title: string; body: string; icon: string }>;
  pricing: ReturnType<typeof zeroedPricing>;
  properties: Array<Record<string, unknown>>;
}> {
  const { nights, destinations, schedule, brandImageLibrary, library, organizationId, tripStyle } = pctx;

  // ── Map Claude's draft → concrete shapes the proposal store consumes ────
  // Take the first `nights` items the AI gave us and trust those. Don't
  // pad with empty {} slots — that used to fabricate phantom days that
  // hit broken fallbacks (cycling through input destinations, hardcoded
  // "Kenya" country) and produced rows like "Day 7: Lake Manyara, Kenya"
  // for a trip ending in Zanzibar. If the AI under-delivered, log it
  // and let the operator add days manually rather than ship junk.
  const draftDays = Array.isArray(parsed.days) ? parsed.days.slice(0, nights) : [];
  if (draftDays.length < nights) {
    console.warn(
      `[autopilot] AI returned ${draftDays.length} days for a ${nights}-night trip; ` +
      `not padding with empty days (would produce invalid country/destination data).`,
    );
  }

  // Pick the destination for a given day-index. Mid-trip days fall back
  // to a cycle through the input destinations; the LAST day specifically
  // falls back to the operator's intended endpoint (destinations[-1]),
  // not the modulo cycle, so a 7th day in a 5-destination trip ending in
  // Zanzibar doesn't snap back to "Lake Manyara".
  const totalDays = draftDays.length;
  const fallbackDestinationFor = (idx: number): string => {
    if (destinations.length === 0) return "New Destination";
    const isLast = idx === totalDays - 1;
    if (isLast) return destinations[destinations.length - 1];
    return destinations[idx % destinations.length];
  };

  const days: Day[] = draftDays.map((d, idx) => {
    const destination = stringOr(d.destination, fallbackDestinationFor(idx));
    // Country: use what the AI returned, else look up the destination's
    // country from the East-African ordering table, else fall back to
    // empty string. The hardcoded "Kenya" default is gone — it stamped
    // Tanzanian destinations as Kenyan whenever the AI omitted country.
    const country = stringOr(d.country, "") || countryOf(destination) || "";
    return {
      id: nanoid(),
      dayNumber: idx + 1,
      destination,
      country,
      subtitle: stringOr(d.subtitle, "") || undefined,
      description: stringOr(d.description, ""),
      // Editorial pull-quote — clamped to 200 chars so a chatty AI
      // can't write a paragraph here. Operators edit inline or
      // click the AI button to redraft.
      momentOfDay: stringOr(d.momentOfDay, "").slice(0, 200) || undefined,
      // Drive-time chip text — clamped to 120 chars. Day 1 ignores
      // this field (no preceding day), but storing it is harmless.
      driveTimeBefore: stringOr(d.driveTimeBefore, "").slice(0, 120) || undefined,
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
    };
  });

  // ── Apply operator schedule (when stops were provided) ────────────
  // The schedule is the source of truth — override AI-picked
  // destinations with the operator's locked plan. Country re-derives
  // from the destination so a swap from "Lake Manyara" to "Maasai
  // Mara" updates both fields atomically.
  if (schedule.length > 0) {
    for (const entry of schedule) {
      const idx = entry.dayNumber - 1;
      if (idx < 0 || idx >= days.length) continue;
      const day = days[idx];
      day.destination = entry.destination;
      day.country = countryOf(entry.destination) || day.country;
      // Per-stop hero image — applied here so it wins over the
      // brand-DNA auto-pick further down. Operator's explicit choice
      // beats any inferred default.
      if (entry.heroImageUrl) {
        day.heroImageUrl = entry.heroImageUrl;
      }
      // Per-stop pre-picked properties — override the AI's slot
      // pick for any tier the operator pinned. Tiers the operator
      // didn't pin keep whatever the AI chose.
      if (entry.propertyByTier) {
        for (const tier of ["classic", "premier", "signature"] as const) {
          const propertyId = entry.propertyByTier[tier];
          if (!propertyId) continue;
          const libEntry = library.find((p) => p.id === propertyId);
          if (!libEntry) continue;
          day.tiers[tier] = {
            camp: libEntry.name,
            location: libEntry.location || libEntry.country || "",
            note: day.tiers[tier]?.note ?? "",
          };
        }
      }
    }
  }

  // Clamp Day 1 + last day to the operator's intended ARRIVAL and
  // DEPARTURE points. Real safaris fly in and out of *gateway* cities
  // (Arusha, Nairobi, Zanzibar, Stone Town, Kilimanjaro, Entebbe,
  // Kigali, Mombasa, Diani) — never national parks.
  //
  // SKIPPED when an operator schedule is present: the schedule is the
  // source of truth and the operator may legitimately want a non-
  // gateway endpoint (e.g., a beach extension ending at Diani isn't
  // a gateway by safari rules but is intentional). Legacy flat-list
  // proposals still get the gateway clamp.
  if (schedule.length === 0 && destinations.length > 0 && days.length > 0) {
    const arrivalGateway =
      destinations.find((d) => classifyStop(d) === "gateway") || destinations[0];
    const departureGateway =
      [...destinations].reverse().find((d) => classifyStop(d) === "gateway") ||
      arrivalGateway;

    days[0].destination = arrivalGateway;
    days[0].country = countryOf(arrivalGateway) || days[0].country;
    const last = days[days.length - 1];
    last.destination = departureGateway;
    last.country = countryOf(departureGateway) || last.country;
  }

  // Day hero auto-pick — for any day whose destination matches a
  // location-tagged image in the operator's Brand DNA library, set
  // heroImageUrl to that image. Mirrors the from-template clone path
  // so autopilot proposals arrive in the editor with hero images
  // already wired instead of empty grey placeholders. Operator can
  // still override per day inside the editor.
  if (brandImageLibrary.length > 0) {
    for (const day of days) {
      if (day.heroImageUrl) continue;
      const dest = day.destination?.trim() ?? "";
      if (!dest) continue;
      const match = pickBrandImageForDestination(brandImageLibrary, dest);
      if (match) day.heroImageUrl = match.url;
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

  // Zeroed pricing — operator types real numbers in the editor after
  // the AI draft lands. The shape stays so PricingSection renders the
  // tier scaffolding; pricePerPerson is left empty for the operator
  // to fill. The trip-style match still drives which tier is the
  // "highlighted" one so the visual hierarchy is right by default.
  const pricing = zeroedPricing(tripStyle);

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
      where: { id: { in: pickedIds }, organizationId },
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
    // property appears in the active (style-matched) tier, falling
    // back to whatever tier has a camp picked. The active tier comes
    // from tripStyle (luxury → signature, classic → classic, else
    // premier). Previous version derived it from parsed.pricing which
    // is no longer in the AI output — the tripStyle path is what we
    // use everywhere else now.
    const styleLower = tripStyle.toLowerCase();
    const activeTier: TierKey = styleLower.includes("luxury")
      ? "signature"
      : styleLower.includes("classic")
        ? "classic"
        : "premier";
    const nightsByName = new Map<string, number>();
    for (const d of days) {
      const name =
        d.tiers?.[activeTier]?.camp ??
        d.tiers?.classic?.camp ??
        d.tiers?.premier?.camp ??
        d.tiers?.signature?.camp ??
        "";
      if (!name) continue;
      nightsByName.set(name, (nightsByName.get(name) ?? 0) + 1);
    }

    // URL filter — admit ANY non-empty URL (http/https/data/relative,
    // any size). Earlier 250KB cap on data URLs left some legacy
    // properties with no photos at all. Slice limits below
    // (6 gallery, 4 per room) plus the autosave size guard
    // (recompresses oversize payloads) bound total bytes without
    // dropping individual images.
    //
    // Net: every property with at least one image now renders that
    // image on day cards + accommodation. Operators with VERY large
    // legacy data URLs may hit the autosave size cap which prompts
    // its existing recompression flow.
    const isUseableUrl = (u: string | null | undefined): u is string => !!u;
    const MAX_GALLERY_PER_PROPERTY = 6;
    const MAX_IMAGES_PER_ROOM = 4;

    propertySnapshots = fullProps.map((p) => {
      const safeImages = p.images.filter((i) => isUseableUrl(i.url));
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
            .filter(isUseableUrl)
            .slice(0, MAX_IMAGES_PER_ROOM),
        })),
      };
    });
  }

  return {
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
  };
}

// ─── Streaming response builder ───────────────────────────────────────────
//
// Wraps anth.messages.stream() in a Server-Sent Events ReadableStream.
// As Claude writes the tool_use input, the SDK emits `inputJson` events
// with the partial parsed JSON — we watch jsonSnapshot.days.length and
// emit a `day-progress` SSE event for each completed day. After
// stream.finalMessage() resolves, we run the same post-processing as
// the one-shot path and emit a final `done` event with the full result.
//
// SSE event types this stream emits:
//   day-progress  — one per day as it appears in the AI's tool_use input.
//                   Payload: { dayNumber, destination, country, description? }
//   done          — terminal event with the complete response object that
//                   one-shot mode would have returned.
//   error         — terminal event when something fails. Payload: { error }
//
// The client must parse SSE chunks (CRLF-separated `event:` / `data:` lines).
// On `done` it saves + redirects; on `error` it surfaces the message in the
// dialog; on `day-progress` it appends to the in-flight day-cards display.
function buildAutopilotStream(opts: {
  anth: Anthropic;
  model: string;
  systemText: string;
  userText: string;
  tool: Anthropic.Tool;
  processCtx: ProcessContext;
}): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(payload));
      };

      const startedAt = Date.now();
      console.log(
        `[AUTOPILOT/stream] start · model=${opts.model} · destinations=${opts.processCtx.destinations.length} · libraryProps=${opts.processCtx.library.length} · nights=${opts.processCtx.nights}`,
      );

      try {
        // Open the streaming Anthropic call. The SDK accumulates JSON
        // deltas into a parsed snapshot we can read on each chunk.
        const stream = opts.anth.messages.stream(
          {
            model: opts.model,
            max_tokens: 32000,
            system: [
              { type: "text", text: opts.systemText, cache_control: { type: "ephemeral" } },
            ],
            messages: [{ role: "user", content: opts.userText }],
            tools: [opts.tool],
            tool_choice: { type: "tool", name: "submit_proposal" },
          },
          { timeout: 90_000 },
        );

        // Track which days we've already announced so we don't re-emit
        // the same day on every delta. The SDK gives us the FULL parsed
        // snapshot on each delta; we diff against the last emitted
        // length and emit only the newly-appeared days.
        //
        // Important: the LAST item in days[] is being actively written
        // and may be incomplete. We hold it back until the next day
        // appears (proving the previous one is done) or the stream
        // closes. This avoids streaming a half-written description.
        let lastEmittedIndex = -1;
        stream.on("inputJson", (_partial, snapshot) => {
          if (typeof snapshot !== "object" || snapshot === null) return;
          const snap = snapshot as { days?: AutopilotDayOut[] };
          const days = Array.isArray(snap.days) ? snap.days : [];
          // Emit each day up to days.length - 2 (last is still being
          // written). Index 0..len-2 inclusive.
          while (lastEmittedIndex < days.length - 2) {
            lastEmittedIndex++;
            const d = days[lastEmittedIndex];
            if (!d) continue;
            send("day-progress", {
              dayNumber: lastEmittedIndex + 1,
              destination: typeof d.destination === "string" ? d.destination : "",
              country: typeof d.country === "string" ? d.country : "",
              description: typeof d.description === "string" ? d.description.slice(0, 240) : "",
            });
          }
        });

        const finalMessage = await stream.finalMessage();
        const elapsedMs = Date.now() - startedAt;
        console.log(
          `[AUTOPILOT/stream] anthropic done in ${elapsedMs}ms · in_tokens=${finalMessage.usage?.input_tokens ?? "?"} · out_tokens=${finalMessage.usage?.output_tokens ?? "?"} · stop_reason=${finalMessage.stop_reason ?? "?"}`,
        );

        const toolUse = finalMessage.content.find(
          (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "submit_proposal",
        );
        if (!toolUse) {
          send("error", { error: "AI didn't return structured output. Try again." });
          controller.close();
          return;
        }

        const parsed = toolUse.input as AutopilotResponse;

        // Diagnostic: log what the AI actually produced, with key
        // metrics. When operators report "0 days" we need this to
        // figure out whether the AI under-produced, the schema's
        // minItems rejected the response, or the post-processing
        // dropped them. The full input is too verbose for logs;
        // surface just the shape.
        console.log(
          `[AUTOPILOT/stream] parsed shape · keys=${Object.keys(parsed).join(",")} · days.len=${Array.isArray(parsed.days) ? parsed.days.length : "not-array"} · greeting=${parsed.greeting?.body ? "set" : "empty"} · cover=${parsed.cover?.tagline ? "set" : "empty"}`,
        );

        // Catch up — emit any final days we held back. The watch loop
        // above stops at length-2; if length is N, we still owe the
        // operator the (N-1)th index.
        const finalDays = Array.isArray(parsed.days) ? parsed.days : [];
        while (lastEmittedIndex < finalDays.length - 1) {
          lastEmittedIndex++;
          const d = finalDays[lastEmittedIndex];
          if (!d) continue;
          send("day-progress", {
            dayNumber: lastEmittedIndex + 1,
            destination: typeof d.destination === "string" ? d.destination : "",
            country: typeof d.country === "string" ? d.country : "",
            description: typeof d.description === "string" ? d.description.slice(0, 240) : "",
          });
        }

        // Run the same post-processing as the one-shot path — applies
        // operator schedule, gateway clamp, brand-DNA hero pick, builds
        // property snapshots from Prisma.
        const result = await processParsedResponse(parsed, opts.processCtx);
        send("done", result);
        controller.close();
      } catch (err) {
        const elapsedMs = Date.now() - startedAt;
        console.error(`[AUTOPILOT/stream] failed after ${elapsedMs}ms · model=${opts.model}`);
        const message =
          err instanceof Anthropic.RateLimitError
            ? "AI is rate-limited; please retry."
            : err instanceof Anthropic.APIError
              ? err.message
              : err instanceof Error
                ? err.message
                : String(err);
        send("error", { error: message });
        controller.close();
      }
    },
  });
}

// ─── Helpers ───────────────────────────────────────────────────────────────

type ProposalInput = {
  metadata?: { title?: string };
  trip?: {
    title?: string;
    nights?: number;
    destinations?: string[];
    stops?: InputStop[];
    tripStyle?: string;
    operatorNote?: string;
    arrivalDate?: string;
    departureDate?: string;
    pace?: string;
    interests?: string[];
    arrivalRoutine?: string;
    departureRoutine?: string;
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

type InputStop = {
  id?: string;
  destination: string;
  nights: number;
  heroImageUrl?: string;
  propertyByTier?: Partial<Record<TierKey, string>>;
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

// Zeroed pricing scaffold — see comment at the call site. Returns the
// same shape the editor's PricingSection consumes (three tiers + notes)
// but with empty pricePerPerson strings for the operator to fill in.
// The highlighted tier is derived from tripStyle so the section's
// visual emphasis matches the operator's chosen tier from day one.
function zeroedPricing(tripStyle: string): {
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
  const empty = (label: string, highlighted: boolean) => ({
    label,
    pricePerPerson: "",
    currency: "USD",
    highlighted,
  });
  return {
    classic: empty("Classic", highlightedTier === "classic"),
    premier: empty("Premier", highlightedTier === "premier"),
    signature: empty("Signature", highlightedTier === "signature"),
  };
}
