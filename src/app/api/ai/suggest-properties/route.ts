import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { rankProperties } from "@/lib/propertyRanking";
import { buildBrandDNAPromptSection } from "@/lib/brandDNAPrompt";
import { LUXURY_VOICE_BANS } from "@/lib/aiVoice";
import { MEAL_PLANS } from "@/lib/properties";

// POST /api/ai/suggest-properties
//
// The third pillar of the AI-tools triad — Smart Property Suggestions.
// Where Fill Blanks drafts narrative and Tone Shift rewrites it, this
// endpoint picks WHICH lodge fills which day, drawing exclusively from
// the operator's own property library.
//
// Why this exists:
//   Operators told us property-picking is the slowest part of building
//   a proposal. Junior consultants don't yet know which of the org's
//   200 lodges fits a "luxury / quiet / Mara Day 3" slot. The library
//   already has Brand-DNA-aware ranking — this endpoint adds the AI
//   layer that reads the trip's vibe (subtitle / description / theme)
//   AND enforces cadence rules ("don't put two pool-heavy lodges
//   back-to-back") that pure deterministic ranking can't.
//
// Library-only by design. We send Claude a CANDIDATE LIST per day
// (top deterministically-ranked options from the library, with their
// real fields — class, suitability, amenities, location). Claude
// chooses ONE per day and explains why. We validate every pick is in
// the candidate list before returning, so the model can never invent
// a lodge that doesn't exist in the operator's library.
//
// Response shape — per day, ready to drop into the proposal:
//   { dayId, libraryPropertyId, propertyName, reasoning, snapshot }
// where `snapshot` is the same Partial<ProposalProperty> shape that
// DayPropertyPicker emits, so the dialog can dispatch through the
// existing addPropertyFromLibrary code path.

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

const STYLE_RULES = `Operator copy rules (non-negotiable — apply to your reasoning text):

${LUXURY_VOICE_BANS}

VOICE: Operator brief, not brochure. One sentence per pick. Lead with the concrete reason ("quiet conservancy edge — pairs with the reflective pace you described").`;

interface IncomingDay {
  id: string;
  dayNumber: number;
  destination: string;
  country?: string;
  subtitle?: string;
  description?: string;
  currentCamp?: string;
}

interface Body {
  trip?: {
    title?: string;
    destinations?: string[];
    nights?: number;
    tripStyle?: string;
    arrivalDate?: string;
  };
  client?: {
    guestNames?: string;
  };
  days?: IncomingDay[];
  /** Active tier — drives the operator's tier-bias hint to Claude
   *  ("they're building the luxury column, prefer luxury class"). */
  activeTier?: "classic" | "premier" | "signature";
  /** When true, repick every day even if they already have a camp.
   *  Default false: only suggest for days with no camp set. */
  repickAll?: boolean;
}

const VALID_TIER = new Set(["classic", "premier", "signature"]);

export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ctx.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }
  if (!ctx.orgActive) {
    return NextResponse.json(
      { error: "Account suspended", code: "ORG_SUSPENDED" },
      { status: 402 },
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 500 },
    );
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const days = Array.isArray(body.days) ? body.days : [];
  if (days.length === 0) {
    return NextResponse.json({
      summary: "No days to suggest properties for.",
      picks: [],
      meta: { inputTokens: 0, outputTokens: 0, cacheRead: 0 },
    });
  }
  const repickAll = !!body.repickAll;
  const activeTier = VALID_TIER.has(body.activeTier ?? "")
    ? (body.activeTier as "classic" | "premier" | "signature")
    : "classic";

  // Filter to days that need suggestions. When `repickAll` is false we
  // skip days that already have a camp — the operator only wants to
  // fill the empties. (The dialog separately offers a "repick all" mode.)
  const targetDays = days.filter((d) =>
    repickAll ? true : !d.currentCamp?.trim(),
  );
  if (targetDays.length === 0) {
    return NextResponse.json({
      summary: "Every day already has a property assigned.",
      picks: [],
      meta: { inputTokens: 0, outputTokens: 0, cacheRead: 0 },
    });
  }

  // ── Load library + Brand DNA once ─────────────────────────────────────
  // We hit the DB twice (locations + properties), then rank in-memory
  // per day. Cheaper than N location-filtered queries.

  const orgId = ctx.organization.id;

  const [locations, allProperties, brandDNA] = await Promise.all([
    prisma.location.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true, country: true },
    }),
    prisma.property.findMany({
      where: { organizationId: orgId, archived: false },
      include: {
        location: { select: { id: true, name: true, country: true } },
        images: {
          orderBy: [{ isCover: "desc" }, { order: "asc" }],
          select: { id: true, url: true, isCover: true, order: true },
        },
        rooms: {
          select: {
            id: true,
            name: true,
            bedConfig: true,
            description: true,
            imageUrls: true,
          },
        },
        customSections: {
          where: { visible: true },
          orderBy: { order: "asc" },
          select: { id: true, title: true, body: true, order: true },
        },
        tags: { include: { tag: { select: { id: true, name: true } } } },
      },
    }),
    prisma.brandDNAProfile.findUnique({
      where: { organizationId: orgId },
      include: { propertyPreferences: true },
    }),
  ]);

  if (allProperties.length === 0) {
    return NextResponse.json({
      summary:
        "Your property library is empty. Add lodges in the Library before using Smart Suggestions.",
      picks: [],
      meta: { inputTokens: 0, outputTokens: 0, cacheRead: 0 },
    });
  }

  // ── Rank candidates per day ───────────────────────────────────────────
  // For each target day, find the location id by name match, then run
  // the deterministic ranker. Take the top ~6 to send to Claude — small
  // enough to keep prompts cheap, big enough to give Claude real choice.

  // The deterministic ranker returns its results typed as
  // `RankableProperty` (a slimmer Prisma row). We pass in the full
  // include-shape array, so the same objects come back — cast to the
  // richer local type so we can use `customSections`, `rooms`, etc.
  // when building snapshots.
  type FullProperty = (typeof allProperties)[number];
  const CANDIDATES_PER_DAY = 6;
  const candidatesByDay = new Map<string, FullProperty[]>();

  for (const d of targetDays) {
    const destLc = d.destination.trim().toLowerCase();
    const matchedLoc = destLc
      ? locations.find((l) => l.name.toLowerCase() === destLc)
      : null;

    const ranked = rankProperties(
      allProperties,
      { locationId: matchedLoc?.id ?? null },
      {
        brandDNA: brandDNA
          ? { tierBias: brandDNA.tierBias, styleBias: brandDNA.styleBias }
          : null,
        propertyPreferences: brandDNA?.propertyPreferences ?? [],
      },
    );

    let candidates: FullProperty[] = ranked
      .slice(0, CANDIDATES_PER_DAY)
      .map((r) => r.property as FullProperty);
    // Fall back to org-wide ranked list when the destination match
    // produces nothing — better to suggest a not-quite-on-location
    // lodge than to leave the day empty. Operator can repick.
    if (candidates.length === 0 && matchedLoc) {
      candidates = rankProperties(allProperties, { locationId: null }, {
        brandDNA: brandDNA
          ? { tierBias: brandDNA.tierBias, styleBias: brandDNA.styleBias }
          : null,
        propertyPreferences: brandDNA?.propertyPreferences ?? [],
      })
        .slice(0, CANDIDATES_PER_DAY)
        .map((r) => r.property as FullProperty);
    }
    candidatesByDay.set(d.id, candidates);
  }

  // Properties Claude is allowed to pick from (union across all days).
  // We send a single property catalog to the model, then per-day lists
  // of candidate IDs — saves tokens and avoids dumping the same
  // property record multiple times when it's a candidate for several
  // days.
  const candidateUnion = new Map<string, FullProperty>();
  for (const list of candidatesByDay.values()) {
    for (const p of list) candidateUnion.set(p.id, p);
  }
  const validPropertyIds = new Set(candidateUnion.keys());

  // ── Build the prompt ──────────────────────────────────────────────────

  const brandDNASection = buildBrandDNAPromptSection(brandDNA);

  const propertyCatalog = Array.from(candidateUnion.values()).map((p) => ({
    id: p.id,
    name: p.name,
    propertyClass: p.propertyClass,
    location: p.location
      ? p.location.country
        ? `${p.location.name}, ${p.location.country}`
        : p.location.name
      : null,
    shortSummary: p.shortSummary,
    whatMakesSpecial: truncate(p.whatMakesSpecial, 280),
    suitability: p.suitability,
    amenities: p.amenities?.slice(0, 12),
    suggestedNights: p.suggestedNights,
    totalRooms: p.totalRooms,
  }));

  const dayBriefs = targetDays.map((d) => ({
    dayId: d.id,
    dayNumber: d.dayNumber,
    destination: d.destination,
    country: d.country ?? null,
    subtitle: d.subtitle ?? null,
    description: truncate(d.description, 320),
    candidateIds: (candidatesByDay.get(d.id) ?? []).map((p) => p.id),
  }));

  const systemText = `${STYLE_RULES}${brandDNASection}

You are an operator's property-pick assistant. The operator has a multi-day safari proposal and needs to assign ONE lodge from THEIR library to each day. You receive:
  • Trip metadata (title, destinations, nights, style)
  • Active tier the operator is currently building (classic / premier / signature)
  • A property CATALOG — every lodge that's a viable candidate, with its facts
  • Per-day BRIEFS with destination, vibe (subtitle + description), and the candidateIds it can be picked from

Rules:
1. NEVER pick a property whose id isn't in that day's candidateIds list.
2. One lodge per day. You MAY repeat the same lodge across consecutive days only if the destination is identical AND the brief implies a multi-night stay.
3. CADENCE — if you pick a high-energy lodge (game-drive heavy, mobile camp) for one day, prefer a slower-paced one the next. If the operator wrote "reflective pace" or "honeymoon", lean quiet/exclusive even if a louder lodge is also a candidate.
4. TIER alignment — the activeTier hints what the operator wants in this column (classic = entry, premier = mid, signature = top). Match property class to the tier when candidates allow.
5. REASONING — one sentence per pick, ≤ 22 words, operator-voice. Reference the day's actual content ("quiet conservancy fit for the slower Day 5 you wrote") not generic praise.

Return ONLY a JSON object with this exact shape:

{
  "summary": "<one sentence describing the overall picking strategy>",
  "picks": [
    { "dayId": "<id from the briefs>", "propertyId": "<id from candidateIds>", "reasoning": "<one sentence>" }
  ]
}

No fences, no preamble. Just the JSON.`;

  const userText = [
    body.trip ? `TRIP:\n${JSON.stringify(body.trip, null, 2)}` : "",
    body.client ? `CLIENT:\n${JSON.stringify(body.client, null, 2)}` : "",
    `ACTIVE TIER: ${activeTier}`,
    `PROPERTY CATALOG (${propertyCatalog.length} candidates):\n${JSON.stringify(propertyCatalog, null, 2)}`,
    `DAY BRIEFS (${dayBriefs.length} days):\n${JSON.stringify(dayBriefs, null, 2)}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const client = new Anthropic({ apiKey });

  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: [
        { type: "text", text: systemText, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: userText }],
    });

    const raw = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    const parsed = parseResponse(raw);
    if (!parsed) {
      console.error("[AI/suggest-properties] Couldn't parse model output:\n", raw);
      return NextResponse.json(
        { error: "AI returned an unexpected format. Please try again." },
        { status: 502 },
      );
    }

    // Validate every pick: dayId must be a target day; propertyId must
    // be in that day's candidate set. Drop anything that isn't — the
    // model is forbidden from inventing lodges, and we enforce it.
    const targetDayIds = new Set(targetDays.map((d) => d.id));
    const safePicks: Array<{
      dayId: string;
      libraryPropertyId: string;
      propertyName: string;
      reasoning: string;
      snapshot: Record<string, unknown>;
      alternatives: Array<{ id: string; name: string }>;
    }> = [];

    for (const pick of parsed.picks) {
      if (!pick || typeof pick.dayId !== "string" || typeof pick.propertyId !== "string") continue;
      if (!targetDayIds.has(pick.dayId)) continue;
      if (!validPropertyIds.has(pick.propertyId)) continue;
      const candidatesForDay = candidatesByDay.get(pick.dayId) ?? [];
      if (!candidatesForDay.some((c) => c.id === pick.propertyId)) continue;

      const property = candidateUnion.get(pick.propertyId);
      if (!property) continue;

      const snapshot = buildSnapshotFromLibrary(property);

      safePicks.push({
        dayId: pick.dayId,
        libraryPropertyId: property.id,
        propertyName: property.name,
        reasoning: typeof pick.reasoning === "string" ? pick.reasoning.trim() : "",
        snapshot,
        // Show the operator the next 3 alternatives in the dialog so
        // they can switch picks without rerunning the AI.
        alternatives: candidatesForDay
          .filter((c) => c.id !== property.id)
          .slice(0, 3)
          .map((c) => ({ id: c.id, name: c.name })),
      });
    }

    return NextResponse.json({
      summary:
        parsed.summary ||
        `Suggested ${safePicks.length} ${safePicks.length === 1 ? "property" : "properties"}.`,
      picks: safePicks,
      // Include the catalog so the dialog can let the operator swap
      // a pick for one of the alternatives without a follow-up fetch.
      catalog: Object.fromEntries(
        Array.from(candidateUnion.entries()).map(([id, p]) => [
          id,
          {
            name: p.name,
            propertyClass: p.propertyClass,
            location: p.location
              ? p.location.country
                ? `${p.location.name}, ${p.location.country}`
                : p.location.name
              : null,
            snapshot: buildSnapshotFromLibrary(p),
          },
        ]),
      ),
      meta: {
        inputTokens: msg.usage.input_tokens,
        outputTokens: msg.usage.output_tokens,
        cacheRead: msg.usage.cache_read_input_tokens ?? 0,
      },
    });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "AI is rate-limited; please retry." }, { status: 429 });
    }
    if (err instanceof Anthropic.APIError) {
      console.error("[AI/suggest-properties] Anthropic error:", err.status, err.message);
      return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error("[AI/suggest-properties] Unexpected error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────

interface RawPick {
  dayId?: string;
  propertyId?: string;
  reasoning?: string;
}

function parseResponse(raw: string): { summary: string; picks: RawPick[] } | null {
  let body = raw.trim();
  const fenceMatch = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(body);
  if (fenceMatch) body = fenceMatch[1].trim();
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  const slice = body.slice(start, end + 1);
  try {
    const obj = JSON.parse(slice);
    if (!obj || !Array.isArray(obj.picks)) return null;
    return {
      summary: typeof obj.summary === "string" ? obj.summary : "",
      picks: obj.picks as RawPick[],
    };
  } catch {
    return null;
  }
}

// Build the same Partial<ProposalProperty> shape that DayPropertyPicker
// emits so the dialog can dispatch through the existing
// addPropertyFromLibrary code path. Keeping this server-side means
// shared snapshot logic and we get the freshest images straight from
// the DB (no risk of stale cached payloads bleeding through).
type PropertyWithJoins = {
  id: string;
  name: string;
  propertyClass: string | null;
  shortSummary: string | null;
  whatMakesSpecial: string | null;
  whyWeChoose: string | null;
  amenities: string[];
  mealPlan: string | null;
  suggestedNights: number | null;
  suitability: string[];
  checkInTime: string | null;
  checkOutTime: string | null;
  totalRooms: number | null;
  spokenLanguages: string[];
  specialInterests: string[];
  funFactsVisible: boolean;
  rooms: {
    id: string;
    name: string;
    bedConfig: string | null;
    description: string | null;
    imageUrls: string[];
  }[];
  customSections: {
    id: string;
    title: string;
    body: string | null;
    order: number;
  }[];
  location: { id: string; name: string; country: string | null } | null;
  images: { id: string; url: string; isCover: boolean; order: number }[];
};

function buildSnapshotFromLibrary(p: PropertyWithJoins): Record<string, unknown> {
  const sorted = [...(p.images ?? [])].sort(
    (a, b) => Number(!!b.isCover) - Number(!!a.isCover) || (a.order ?? 0) - (b.order ?? 0),
  );
  const lead = sorted[0]?.url;
  const gallery = sorted.map((i) => i.url);
  const location = p.location
    ? p.location.country
      ? `${p.location.name}, ${p.location.country}`
      : p.location.name
    : "";

  return {
    libraryPropertyId: p.id,
    name: p.name,
    location,
    shortDesc: p.shortSummary ?? "",
    description: p.whatMakesSpecial ?? "",
    whyWeChoseThis: p.whyWeChoose ?? "",
    amenities: p.amenities ?? [],
    mealPlan: p.mealPlan
      ? MEAL_PLANS.find((m) => m.id === p.mealPlan)?.label ?? p.mealPlan
      : "Full board",
    nights: p.suggestedNights ?? 2,
    leadImageUrl: lead,
    galleryUrls: gallery,
    propertyClass: p.propertyClass ?? undefined,
    suitability: p.suitability ?? [],
    checkInTime: p.checkInTime ?? undefined,
    checkOutTime: p.checkOutTime ?? undefined,
    totalRooms: p.totalRooms ?? undefined,
    spokenLanguages: p.spokenLanguages ?? [],
    specialInterests: p.specialInterests ?? [],
    funFactsVisible: p.funFactsVisible ?? true,
    rooms: (p.rooms ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      bedConfig: r.bedConfig ?? "",
      description: r.description ?? "",
      imageUrls: r.imageUrls ?? [],
    })),
    customSections: (p.customSections ?? [])
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((s) => ({
        id: s.id,
        title: s.title,
        body: s.body ?? "",
        order: s.order ?? 0,
      })),
  };
}

function truncate(s: string | null | undefined, max: number): string | null {
  if (!s) return null;
  const trimmed = s.trim();
  if (!trimmed) return null;
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max - 1) + "…";
}
