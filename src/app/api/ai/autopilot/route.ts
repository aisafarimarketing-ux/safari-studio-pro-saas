import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { buildBrandDNAPromptSection } from "@/lib/brandDNAPrompt";
import { nanoid } from "@/lib/nanoid";
import type { Day, TierKey } from "@/lib/types";

// AI autopilot — given a Trip Setup proposal (title, dates, nights,
// destinations, style, notes) plus the org's property library + Brand DNA,
// returns a complete draft: per-day destinations + narratives + per-tier
// camp picks chosen from the library only. The caller merges the result
// into the proposal it just created and saves again before routing the user
// into the editor.
//
// Library-only guarantee: Claude is shown the property list with stable
// integer slots and must return slot indices, not free-form names. We map
// indices back to library properties on the server. Anything out of range
// is dropped.

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

const STYLE_RULES = `Operator copy rules (non-negotiable):

BAN — never use these words, or any close variant:
- Adjective clichés: stunning, breathtaking, amazing, incredible, unforgettable, magical, magnificent, awe-inspiring, world-class, luxurious, luxe, iconic, ultimate, lush, vibrant, verdant, pristine, picturesque, idyllic.
- Marketing verbs: discover, immerse yourself, escape (to), unwind, embark on, indulge, "experience the magic", "step into".
- Brochure phrases: nestled in, tucked away, hidden gem, dotted with, paradise, rolling savannahs, rich biodiversity, "sights and sounds", "the perfect blend of".
- AI tells: "Whether you're…", "From X to Y, …", "ensures", openings that introduce the destination as the hero.
- Closers: "memories to last a lifetime", "a journey to remember".
- No exclamation marks. No rhetorical questions.

VOICE: Operator brief, not brochure. Confident, specific, unfussy. Lead with a fact (place name, time, distance, season, behaviour). Default to short, declarative sentences. One adjective per noun, max.`;

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

type AutopilotResponse = {
  days?: AutopilotDayOut[];
  inclusions?: string[];
  exclusions?: string[];
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

  const systemText = STYLE_RULES + brandDNASection + `

You are drafting a full safari itinerary for a travel operator. Output JSON only — no preamble, no markdown fences, no commentary.

You MUST pick camps only from the property library provided in the user message. Refer to each pick by its integer "slot" number, never by name. If the library is empty for a tier, omit that tier — do not invent.

The JSON shape:
{
  "days": [
    {
      "destination": "Place name",
      "country": "Country",
      "subtitle": "One short line (≤8 words) — optional",
      "description": "2-3 grounded sentences. No clichés.",
      "board": "Full board" | "Half board" | "B&B" | "All inclusive",
      "highlights": ["short bullet", "short bullet"],
      "tiers": {
        "classic":   { "slot": 3, "note": "optional short note" },
        "premier":   { "slot": 7, "note": "" },
        "signature": { "slot": 12, "note": "" }
      }
    }
  ],
  "inclusions": ["short line", "short line", ...],
  "exclusions": ["short line", "short line", ...]
}

Rules:
- Generate exactly the number of days the user asks for.
- Spread destinations across the days sensibly (no single-night camps unless the trip demands it; transit days OK).
- Pick different camps across nights when the library supports it.
- Match the trip style: luxury → favour higher propertyClass, mid-range → balanced, classic → no-frills.
- inclusions / exclusions: 4-8 short lines each, drawn from typical East African operator lists.`;

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
    library,
  };

  const userText = `Generate a complete draft for this trip. Return ONLY the JSON object described in the system prompt.

Input:
${JSON.stringify(userPayload, null, 2)}`;

  const client = new Anthropic({ apiKey });

  let raw = "";
  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 8192,
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

  // ── Map Claude's draft → real Day[] / Property[] using the library ──────
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
    highlights: Array.isArray(d.highlights) ? d.highlights.filter((h): h is string => typeof h === "string").slice(0, 5) : undefined,
    tiers: {
      classic: pickTier(d.tiers?.classic, library),
      premier: pickTier(d.tiers?.premier, library),
      signature: pickTier(d.tiers?.signature, library),
    },
  }));

  const inclusions = Array.isArray(parsed.inclusions)
    ? parsed.inclusions.filter((s): s is string => typeof s === "string").slice(0, 12)
    : [];
  const exclusions = Array.isArray(parsed.exclusions)
    ? parsed.exclusions.filter((s): s is string => typeof s === "string").slice(0, 12)
    : [];

  return NextResponse.json({ days, inclusions, exclusions });
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
};

function stringOr(v: unknown, fallback: string): string {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

function stripFences(text: string): string {
  // Tolerate the occasional stray ```json … ``` fence even with strict
  // instructions otherwise.
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
