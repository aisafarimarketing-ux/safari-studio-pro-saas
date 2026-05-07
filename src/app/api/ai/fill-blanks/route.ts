import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { buildBrandDNAPromptSection } from "@/lib/brandDNAPrompt";
import { LUXURY_VOICE_DISCIPLINE } from "@/lib/aiVoice";

// POST /api/ai/fill-blanks
//
// Operator's "magic wand". Takes a proposal that's mostly empty (just
// destinations + dates + maybe a property pick per day) and returns
// a typed patch filling the missing narrative fields:
//
//   • day.subtitle         (short phase label — "Arrival & first
//                            game drive")
//   • day.description      (multi-paragraph narrative)
//   • day.highlights[]     (3-5 short bullets)
//   • property.description (about-the-property paragraph)
//   • property.whyWeChoseThis (one-line standfirst)
//   • closing.letter       (closing message)
//   • personalNote.body    (personal-note opening letter)
//
// Differs from /api/ai/tone-shift (which rewrites EXISTING text) and
// /api/ai/apply-comment (which patches against a client comment). This
// one synthesises FROM SCRATCH for blank fields, using the trip's
// destinations + days + properties as context. Operator types
// minimum input, AI fills the rest, operator reviews and edits.
//
// The patch uses the same edit-type vocabulary as apply-comment so
// the dialog can dispatch through the same code path.

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

const STYLE_RULES = `Operator copy rules (non-negotiable):

${LUXURY_VOICE_DISCIPLINE}`;

interface IncomingDay {
  id: string;
  dayNumber: number;
  destination: string;
  country?: string;
  subtitle?: string;
  description?: string;
  highlights?: string[];
  campName?: string;
}

interface IncomingProperty {
  id: string;
  name: string;
  location: string;
  description?: string;
  whyWeChoseThis?: string;
  amenities?: string[];
  propertyClass?: string;
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
  properties?: IncomingProperty[];
  closing?: {
    letterEmpty?: boolean;
  };
  personalNote?: {
    bodyEmpty?: boolean;
  };
  /** When true, also generate fields that ALREADY have content
   *  (effectively a "regenerate everything" pass). Default false:
   *  only fill empties. */
  rewriteAll?: boolean;
}

type Edit =
  | { type: "dayDescription"; dayId: string; newText: string }
  | { type: "daySubtitle"; dayId: string; newText: string }
  | { type: "dayHighlights"; dayId: string; newText: string[] }
  | { type: "propertyDescription"; propertyId: string; newText: string }
  | { type: "propertyWhyChose"; propertyId: string; newText: string }
  | { type: "closingLetter"; newText: string }
  | { type: "personalNoteBody"; newText: string };

const VALID_TYPES = new Set([
  "dayDescription",
  "daySubtitle",
  "dayHighlights",
  "propertyDescription",
  "propertyWhyChose",
  "closingLetter",
  "personalNoteBody",
]);

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
  const properties = Array.isArray(body.properties) ? body.properties : [];

  // Identify what's blank — only those fields go in the prompt's
  // "fields to fill" list. Saves tokens and keeps the model
  // focused. Honours `rewriteAll` for a full-pass regenerate.
  const rewriteAll = !!body.rewriteAll;
  type Slot =
    | { kind: "daySubtitle"; dayId: string }
    | { kind: "dayDescription"; dayId: string }
    | { kind: "dayHighlights"; dayId: string }
    | { kind: "propertyDescription"; propertyId: string }
    | { kind: "propertyWhyChose"; propertyId: string }
    | { kind: "closingLetter" }
    | { kind: "personalNoteBody" };
  const slots: Slot[] = [];
  for (const d of days) {
    if (rewriteAll || !d.subtitle?.trim()) slots.push({ kind: "daySubtitle", dayId: d.id });
    if (rewriteAll || !d.description?.trim()) slots.push({ kind: "dayDescription", dayId: d.id });
    if (rewriteAll || (d.highlights ?? []).length === 0) {
      slots.push({ kind: "dayHighlights", dayId: d.id });
    }
  }
  for (const p of properties) {
    if (rewriteAll || !p.description?.trim()) {
      slots.push({ kind: "propertyDescription", propertyId: p.id });
    }
    if (rewriteAll || !p.whyWeChoseThis?.trim()) {
      slots.push({ kind: "propertyWhyChose", propertyId: p.id });
    }
  }
  if (rewriteAll || body.closing?.letterEmpty) {
    slots.push({ kind: "closingLetter" });
  }
  if (rewriteAll || body.personalNote?.bodyEmpty) {
    slots.push({ kind: "personalNoteBody" });
  }

  if (slots.length === 0) {
    return NextResponse.json({
      summary: "Nothing to fill — every narrative field is already populated.",
      edits: [],
      meta: { inputTokens: 0, outputTokens: 0, cacheRead: 0 },
    });
  }

  const knownDayIds = new Set(days.map((d) => d.id));
  const knownPropertyIds = new Set(properties.map((p) => p.id));

  let brandDNASection = "";
  try {
    const profile = await prisma.brandDNAProfile.findUnique({
      where: { organizationId: ctx.organization.id },
    });
    brandDNASection = buildBrandDNAPromptSection(profile);
  } catch (err) {
    console.warn("[AI/fill-blanks] Brand DNA load failed:", err);
  }

  const systemText = `${STYLE_RULES}${brandDNASection}

You are an operator's drafting assistant. The operator has set up a safari proposal with destinations, dates, days, and property picks — but most of the narrative fields are blank. Your job is to fill the BLANK fields based on the existing structured context.

You will receive:
  • Trip metadata (title, destinations, nights, style, dates)
  • Client info
  • Days (with their destinations + property assignments + any existing text)
  • Properties (with names, locations, and any existing description)
  • A list of SLOTS to fill — fields that are currently blank

Generate copy for EVERY slot. Each slot maps to one edit:

  daySubtitle      → 3-6 word phase label ("Arrival & first game drive")
  dayDescription   → 2-4 short paragraphs of operator-voice narrative.
                      Lead with the day's structure (drive / fly / activity).
                      Reference real geography. No flourishes.
  dayHighlights    → 3-5 short bullets, each ≤ 12 words. Concrete activities,
                      not adjectives.
  propertyDescription → 2-3 paragraphs about the property (setting,
                         service, character). Operator-voice, factual.
  propertyWhyChose → ONE line, ≤ 25 words. Why this lodge for these guests.
  closingLetter    → 2-3 short paragraphs. Warm but unfussy. End with the
                      next step.
  personalNoteBody → 2-3 short paragraphs introducing the proposal.
                      Address the client by name when known.

Cross-day continuity: when generating multiple day descriptions, keep the
arc coherent — Day 5 should reference what happened in Day 4 if relevant
(transfer, accumulating context). Don't restate the trip title every day.

Return ONLY a JSON object with this exact shape:

{
  "summary": "<one sentence on what was filled>",
  "edits": [
    {
      "type": "<one of: dayDescription, daySubtitle, dayHighlights, propertyDescription, propertyWhyChose, closingLetter, personalNoteBody>",
      "dayId": "<id>" or "propertyId": "<id>" or neither,
      "newText": "<string, or array of strings for dayHighlights>"
    }
  ]
}

No fences, no preamble. Just the JSON.`;

  const userText = [
    body.trip ? `TRIP:\n${JSON.stringify(body.trip, null, 2)}` : "",
    body.client ? `CLIENT:\n${JSON.stringify(body.client, null, 2)}` : "",
    `DAYS:\n${JSON.stringify(days, null, 2)}`,
    `PROPERTIES:\n${JSON.stringify(properties, null, 2)}`,
    `SLOTS TO FILL (${slots.length}):\n${JSON.stringify(slots, null, 2)}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const client = new Anthropic({ apiKey });

  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
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
      console.error("[AI/fill-blanks] Couldn't parse model output:\n", raw);
      return NextResponse.json(
        { error: "AI returned an unexpected format. Please try again." },
        { status: 502 },
      );
    }

    const safe: Edit[] = [];
    for (const e of parsed.edits) {
      if (!e || typeof e.type !== "string" || !VALID_TYPES.has(e.type)) continue;
      const t = e.type;
      if (t === "dayDescription" || t === "daySubtitle" || t === "dayHighlights") {
        if (typeof e.dayId !== "string" || !knownDayIds.has(e.dayId)) continue;
      }
      if (t === "propertyDescription" || t === "propertyWhyChose") {
        if (typeof e.propertyId !== "string" || !knownPropertyIds.has(e.propertyId)) continue;
      }
      if (t === "dayHighlights") {
        if (!Array.isArray(e.newText)) continue;
        const arr = e.newText
          .filter((s): s is string => typeof s === "string")
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
        if (arr.length === 0) continue;
        safe.push({ type: "dayHighlights", dayId: e.dayId as string, newText: arr });
        continue;
      }
      if (typeof e.newText !== "string" || !e.newText.trim()) continue;
      const newText = e.newText.trim();
      switch (t) {
        case "dayDescription":
          safe.push({ type: "dayDescription", dayId: e.dayId as string, newText });
          break;
        case "daySubtitle":
          safe.push({ type: "daySubtitle", dayId: e.dayId as string, newText });
          break;
        case "propertyDescription":
          safe.push({
            type: "propertyDescription",
            propertyId: e.propertyId as string,
            newText,
          });
          break;
        case "propertyWhyChose":
          safe.push({
            type: "propertyWhyChose",
            propertyId: e.propertyId as string,
            newText,
          });
          break;
        case "closingLetter":
          safe.push({ type: "closingLetter", newText });
          break;
        case "personalNoteBody":
          safe.push({ type: "personalNoteBody", newText });
          break;
      }
    }

    return NextResponse.json({
      summary: parsed.summary || `Filled ${safe.length} blank fields.`,
      edits: safe,
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
      console.error("[AI/fill-blanks] Anthropic error:", err.status, err.message);
      return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error("[AI/fill-blanks] Unexpected error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

interface RawEdit {
  type?: string;
  dayId?: string;
  propertyId?: string;
  newText?: string | string[];
}

function parseResponse(raw: string): { summary: string; edits: RawEdit[] } | null {
  let body = raw.trim();
  const fenceMatch = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(body);
  if (fenceMatch) body = fenceMatch[1].trim();
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  const slice = body.slice(start, end + 1);
  try {
    const obj = JSON.parse(slice);
    if (!obj || !Array.isArray(obj.edits)) return null;
    return {
      summary: typeof obj.summary === "string" ? obj.summary : "",
      edits: obj.edits as RawEdit[],
    };
  } catch {
    return null;
  }
}
