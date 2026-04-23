import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { nanoid } from "@/lib/nanoid";
import type { TierKey } from "@/lib/types";

// ─── Proposal importer ─────────────────────────────────────────────────────
//
// Takes a chunk of raw text (pasted by the operator or extracted by the
// browser from a PDF) and returns a structured proposal skeleton the
// client can drop into /studio. The job is EXTRACTION, not generation:
// preserve the operator's prose verbatim wherever possible. This is the
// wedge against Safariportal / Safari Office / Wetu — "your last five
// proposals, beautiful in ten minutes."
//
// Design choices:
//   • Client sends pre-extracted text, not the PDF binary. Sensitive
//     guest data (names, flight numbers, pricing) never hits our logs.
//   • Org's real property library is passed as slot-indexed cards so
//     Claude can match camp references to existing Property rows. No
//     library match → keep the camp as free-text (operator can add it
//     to their library later).
//   • Output is a loose ExtractedProposal, not a full Proposal. The
//     client merges it into a fresh buildBlankProposal() scaffold and
//     POSTs via /api/proposals like any other draft.

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
const MAX_SOURCE_CHARS = 60_000;
const MAX_LIBRARY = 120;

type LibrarySlot = {
  slot: number;
  id: string;
  name: string;
  location: string;
  country: string | null;
  propertyClass: string | null;
  summary: string;
};

const SYSTEM_PROMPT = `You extract structured safari proposal data from raw text — typically a PDF export from Safariportal, Safari Office, Wetu, or a Word document the operator has pasted in. Your one job is FAITHFUL EXTRACTION.

HARD RULES:
  • Extract facts that appear in the source. Do NOT invent.
  • If a field isn't present in the source, leave it empty or omit.
  • PRESERVE the operator's prose verbatim. Do NOT rewrite, summarise, or "improve" sentences. Copy them across unchanged wherever a field wants prose.
  • If the source has multiple accommodation options per day (tiered pricing), map them to classic / premier / signature in ascending cost order. If the source only has one option, populate the matching tier and leave the others empty.
  • Match each camp the source mentions to the library (by integer slot) when a plausible match exists — same name or close variant. Unmatched camps stay as free-text.
  • Prices: copy exact figures. Do NOT convert currencies. If the source shows "USD 6,450 pp" → pricePerPerson "6,450", currency "USD".

OUTPUT — JSON only, no preamble, no markdown fences. Any field may be omitted if the source doesn't contain it.

{
  "client": {
    "guestNames": "",
    "adults": 0,
    "children": 0,
    "origin": "",
    "rooming": "",
    "arrivalFlight": "",
    "departureFlight": "",
    "dietary": "",
    "specialOccasion": ""
  },
  "trip": {
    "title": "",
    "subtitle": "",
    "dates": "",
    "arrivalDate": "",
    "departureDate": "",
    "nights": 0,
    "destinations": [],
    "tripStyle": "",
    "operatorNote": ""
  },
  "days": [
    {
      "dayNumber": 1,
      "destination": "",
      "country": "",
      "subtitle": "",
      "description": "",
      "board": "",
      "highlights": [],
      "tiers": {
        "classic":   { "librarySlot": -1, "campName": "", "location": "", "note": "" },
        "premier":   { "librarySlot": -1, "campName": "", "location": "", "note": "" },
        "signature": { "librarySlot": -1, "campName": "", "location": "", "note": "" }
      }
    }
  ],
  "pricing": {
    "classic":   { "label": "Classic",   "pricePerPerson": "", "currency": "USD" },
    "premier":   { "label": "Premier",   "pricePerPerson": "", "currency": "USD" },
    "signature": { "label": "Signature", "pricePerPerson": "", "currency": "USD" },
    "notes": ""
  },
  "inclusions": [],
  "exclusions": [],
  "practicalInfo": [
    { "title": "", "body": "", "icon": "" }
  ],
  "cover":    { "tagline": "" },
  "greeting": { "body": "" },
  "closing":  { "quote": "", "signOff": "" }
}

LIBRARY MATCHING:
  "librarySlot" must be a valid integer in [0, LIBRARY_LEN - 1] or -1 if no match.
  Prefer an exact-ish name match over a close-location match — "Cottar's 1920s" in the source matches library slot for "Cottar's 1920s Safari Camp" even if the library has other Mara camps.

DAY COUNT:
  Output exactly one day entry per night the source describes. Don't skip days; don't merge multi-night stays into one entry. If the source writes "Day 3-5: Serengeti" as a single block, expand it into three day entries with the same destination.`;

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

  let body: { source?: string; sourceFormat?: "pdf" | "text" };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const source = (body?.source ?? "").toString().trim();
  const sourceFormat = body?.sourceFormat === "pdf" ? "pdf" : "text";
  if (source.length < 80) {
    return NextResponse.json(
      { error: "Source is too short to extract anything meaningful." },
      { status: 400 },
    );
  }
  const clamped = source.length > MAX_SOURCE_CHARS ? source.slice(0, MAX_SOURCE_CHARS) : source;

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
  const library: LibrarySlot[] = properties.map((p, i) => ({
    slot: i,
    id: p.id,
    name: p.name,
    location: p.location?.name ?? "",
    country: p.location?.country ?? null,
    propertyClass: p.propertyClass,
    summary: (p.shortSummary ?? "").slice(0, 180),
  }));

  const systemText = SYSTEM_PROMPT.replace("LIBRARY_LEN", String(library.length));

  const userText = `Source format: ${sourceFormat}
Library size: ${library.length}

LIBRARY:
${JSON.stringify(library.map(({ id: _id, ...rest }) => rest))}

SOURCE TEXT:
"""
${clamped}
"""

Return ONLY the JSON object.`;

  const anth = new Anthropic({ apiKey });

  let raw = "";
  try {
    const msg = await anth.messages.create({
      model: MODEL,
      max_tokens: 8000,
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
      console.error("[IMPORT] Anthropic error:", err.status, err.message);
      return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error("[IMPORT] Unexpected error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFences(raw));
  } catch {
    console.error("[IMPORT] Could not parse:", raw.slice(0, 400));
    return NextResponse.json({ error: "Couldn't parse AI response. Please retry." }, { status: 502 });
  }

  const shaped = shapeResponse(parsed, library);
  if (!shaped) {
    return NextResponse.json({ error: "AI returned an incomplete extraction. Please retry." }, { status: 502 });
  }
  return NextResponse.json(shaped);
}

// ─── Response shaping ──────────────────────────────────────────────────────
// Normalises Claude's output into a stable ExtractedProposal the /import
// UI can consume. Library slots are resolved to real property IDs here so
// the client never has to know about the slot indirection.

type ExtractedTierPick = {
  librarySlot: number;
  propertyId: string | null;
  campName: string;
  location: string;
  note: string;
};

type ExtractedDay = {
  dayNumber: number;
  destination: string;
  country: string;
  subtitle: string;
  description: string;
  board: string;
  highlights: string[];
  tiers: Record<TierKey, ExtractedTierPick>;
};

type ExtractedProposal = {
  client: {
    guestNames: string;
    adults: number;
    children: number;
    origin: string;
    rooming: string;
    arrivalFlight: string;
    departureFlight: string;
    dietary: string;
    specialOccasion: string;
  };
  trip: {
    title: string;
    subtitle: string;
    dates: string;
    arrivalDate: string;
    departureDate: string;
    nights: number;
    destinations: string[];
    tripStyle: string;
    operatorNote: string;
  };
  days: ExtractedDay[];
  pricing: {
    classic: { label: string; pricePerPerson: string; currency: string };
    premier: { label: string; pricePerPerson: string; currency: string };
    signature: { label: string; pricePerPerson: string; currency: string };
    notes: string;
  };
  inclusions: string[];
  exclusions: string[];
  practicalInfo: { id: string; title: string; body: string; icon: string }[];
  cover: { tagline: string };
  greeting: { body: string };
  closing: { quote: string; signOff: string };
  // Debug surface — camps the model saw but couldn't match to the library.
  unmatchedCamps: string[];
};

type ClaudeIn = Record<string, unknown>;

function shapeResponse(parsed: unknown, library: LibrarySlot[]): ExtractedProposal | null {
  if (!parsed || typeof parsed !== "object") return null;
  const p = parsed as ClaudeIn;

  const rawClient = (p.client as ClaudeIn | undefined) ?? {};
  const rawTrip = (p.trip as ClaudeIn | undefined) ?? {};
  const rawPricing = (p.pricing as ClaudeIn | undefined) ?? {};
  const rawDays = Array.isArray(p.days) ? (p.days as ClaudeIn[]) : [];
  const rawPractical = Array.isArray(p.practicalInfo) ? (p.practicalInfo as ClaudeIn[]) : [];

  const unmatchedCamps = new Set<string>();

  const tierFor = (raw: ClaudeIn | undefined): ExtractedTierPick => {
    const slot = typeof raw?.librarySlot === "number" ? raw.librarySlot : -1;
    const prop = slot >= 0 && slot < library.length ? library[slot] : null;
    const campName = toString(raw?.campName, "");
    if (!prop && campName) unmatchedCamps.add(campName);
    return {
      librarySlot: prop ? slot : -1,
      propertyId: prop?.id ?? null,
      campName: prop ? prop.name : campName,
      location: toString(raw?.location, prop?.location ?? ""),
      note: toString(raw?.note, ""),
    };
  };

  const days: ExtractedDay[] = rawDays.slice(0, 30).map((d, idx) => {
    const rawTiers = (d.tiers as ClaudeIn | undefined) ?? {};
    return {
      dayNumber: typeof d.dayNumber === "number" ? d.dayNumber : idx + 1,
      destination: toString(d.destination, ""),
      country: toString(d.country, ""),
      subtitle: toString(d.subtitle, ""),
      description: toString(d.description, ""),
      board: toString(d.board, ""),
      highlights: toStringArray(d.highlights, 6),
      tiers: {
        classic: tierFor(rawTiers.classic as ClaudeIn | undefined),
        premier: tierFor(rawTiers.premier as ClaudeIn | undefined),
        signature: tierFor(rawTiers.signature as ClaudeIn | undefined),
      },
    };
  });

  const practicalInfo = rawPractical
    .slice(0, 10)
    .map((c) => ({
      id: nanoid(),
      title: toString(c.title, "").slice(0, 60),
      body: toString(c.body, "").slice(0, 1200),
      icon: toString(c.icon, "ℹ").slice(0, 4),
    }))
    .filter((c) => c.body.length > 0);

  const pricing = {
    classic: normaliseTier(rawPricing.classic as ClaudeIn | undefined, "Classic"),
    premier: normaliseTier(rawPricing.premier as ClaudeIn | undefined, "Premier"),
    signature: normaliseTier(rawPricing.signature as ClaudeIn | undefined, "Signature"),
    notes: toString(rawPricing.notes, "").slice(0, 500),
  };

  return {
    client: {
      guestNames: toString(rawClient.guestNames, "").slice(0, 120),
      adults: clampInt(toNumber(rawClient.adults, 0), 0, 30),
      children: clampInt(toNumber(rawClient.children, 0), 0, 20),
      origin: toString(rawClient.origin, "").slice(0, 80),
      rooming: toString(rawClient.rooming, "").slice(0, 200),
      arrivalFlight: toString(rawClient.arrivalFlight, "").slice(0, 120),
      departureFlight: toString(rawClient.departureFlight, "").slice(0, 120),
      dietary: toString(rawClient.dietary, "").slice(0, 200),
      specialOccasion: toString(rawClient.specialOccasion, "").slice(0, 200),
    },
    trip: {
      title: toString(rawTrip.title, "").slice(0, 200),
      subtitle: toString(rawTrip.subtitle, "").slice(0, 200),
      dates: toString(rawTrip.dates, "").slice(0, 80),
      arrivalDate: toString(rawTrip.arrivalDate, "").slice(0, 20),
      departureDate: toString(rawTrip.departureDate, "").slice(0, 20),
      nights: clampInt(toNumber(rawTrip.nights, days.length || 0), 0, 60),
      destinations: toStringArray(rawTrip.destinations, 20),
      tripStyle: toString(rawTrip.tripStyle, "").slice(0, 60),
      operatorNote: toString(rawTrip.operatorNote, "").slice(0, 500),
    },
    days,
    pricing,
    inclusions: toStringArray(p.inclusions, 20).map((s) => s.slice(0, 240)),
    exclusions: toStringArray(p.exclusions, 20).map((s) => s.slice(0, 240)),
    practicalInfo,
    cover: { tagline: toString((p.cover as ClaudeIn | undefined)?.tagline, "").slice(0, 200) },
    greeting: { body: toString((p.greeting as ClaudeIn | undefined)?.body, "").slice(0, 2000) },
    closing: {
      quote: toString((p.closing as ClaudeIn | undefined)?.quote, "").slice(0, 200),
      signOff: toString((p.closing as ClaudeIn | undefined)?.signOff, "").slice(0, 1200),
    },
    unmatchedCamps: Array.from(unmatchedCamps).slice(0, 30),
  };
}

function normaliseTier(
  raw: ClaudeIn | undefined,
  defaultLabel: string,
): { label: string; pricePerPerson: string; currency: string } {
  return {
    label: toString(raw?.label, defaultLabel).slice(0, 40),
    pricePerPerson: toString(raw?.pricePerPerson, "").slice(0, 20),
    currency: toString(raw?.currency, "USD").slice(0, 6),
  };
}

// ─── Primitives ────────────────────────────────────────────────────────────

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
    .map((s) => s.trim())
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
