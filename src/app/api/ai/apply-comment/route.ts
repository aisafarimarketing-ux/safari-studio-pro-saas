import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { buildBrandDNAPromptSection } from "@/lib/brandDNAPrompt";
import { LUXURY_VOICE_DISCIPLINE } from "@/lib/aiVoice";

// POST /api/ai/apply-comment
//
// The marquee differentiator. Client leaves a comment on the share
// link ("Can we swap the Mara for Tsavo and make Day 5 more
// relaxed?"). Operator clicks "✦ Apply with AI" on that comment.
// We pass the comment + a structured slice of the proposal to
// Claude and return a typed PATCH the editor applies in one shot.
//
// Why this is hard for a CMS competitor to clone:
//   • Their proposal data is unstructured HTML/blocks. We have
//     proposal.days[] and proposal.properties[] with stable IDs and
//     typed fields. Patches reference those IDs directly.
//   • The model sees the WHOLE trip (every day's narrative, every
//     property's description), so the rewrites stay coherent across
//     fields — Day 5 changes ripple naturally to the surrounding
//     days' transition language.
//   • Operators retain veto: every edit shows up in a diff modal
//     they confirm before anything writes.
//
// Returned patch shape — keep this stable; the client switches on
// `type` to dispatch to the right store action:
//
//   {
//     summary: string,             // 1-2 sentence operator-facing
//                                  // summary of what was changed
//     edits: [
//       { type: "dayDescription",   dayId: string, newText: string },
//       { type: "daySubtitle",      dayId: string, newText: string },
//       { type: "dayHighlights",    dayId: string, newText: string[] },
//       { type: "propertyDescription", propertyId: string, newText: string },
//       { type: "propertyWhyChose",    propertyId: string, newText: string },
//       { type: "closingLetter",    newText: string },
//       { type: "closingHeadline",  newText: string },
//       { type: "personalNoteBody", newText: string },
//     ]
//   }

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

const STYLE_RULES = `Operator copy rules (non-negotiable):

${LUXURY_VOICE_DISCIPLINE}`;

interface IncomingDay {
  id: string;
  dayNumber: number;
  destination: string;
  subtitle?: string;
  description: string;
  highlights?: string[];
}

interface IncomingProperty {
  id: string;
  name: string;
  location: string;
  description: string;
  whyWeChoseThis: string;
}

interface Body {
  comment?: string;
  trip?: {
    title?: string;
    destinations?: string[];
    nights?: number;
    tripStyle?: string;
  };
  client?: {
    guestNames?: string;
  };
  days?: IncomingDay[];
  properties?: IncomingProperty[];
  closing?: {
    headline?: string;
    letter?: string;
  };
  personalNote?: {
    body?: string;
  };
}

type Edit =
  | { type: "dayDescription"; dayId: string; newText: string }
  | { type: "daySubtitle"; dayId: string; newText: string }
  | { type: "dayHighlights"; dayId: string; newText: string[] }
  | { type: "propertyDescription"; propertyId: string; newText: string }
  | { type: "propertyWhyChose"; propertyId: string; newText: string }
  | { type: "closingLetter"; newText: string }
  | { type: "closingHeadline"; newText: string }
  | { type: "personalNoteBody"; newText: string };

const VALID_TYPES = new Set([
  "dayDescription",
  "daySubtitle",
  "dayHighlights",
  "propertyDescription",
  "propertyWhyChose",
  "closingLetter",
  "closingHeadline",
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

  const comment = (body.comment ?? "").trim();
  if (!comment) {
    return NextResponse.json({ error: "comment is required" }, { status: 400 });
  }
  if (comment.length > 2000) {
    return NextResponse.json({ error: "comment too long (max 2000 chars)" }, { status: 400 });
  }

  const days = Array.isArray(body.days) ? body.days : [];
  const properties = Array.isArray(body.properties) ? body.properties : [];

  // Brand DNA
  let brandDNASection = "";
  try {
    const profile = await prisma.brandDNAProfile.findUnique({
      where: { organizationId: ctx.organization.id },
    });
    brandDNASection = buildBrandDNAPromptSection(profile);
  } catch (err) {
    console.warn("[AI/apply-comment] Brand DNA load failed:", err);
  }

  const knownDayIds = new Set(days.map((d) => d.id));
  const knownPropertyIds = new Set(properties.map((p) => p.id));

  const systemText = `${STYLE_RULES}${brandDNASection}

You are an operator's editing assistant. The CLIENT just left a comment on a safari proposal. Your job is to produce a TYPED PATCH the editor will apply.

Read the client's comment and the current proposal slice. Decide which fields need to change to address the client's request, while preserving every fact NOT mentioned in the comment. If the comment is small (one sentence), the patch should be small (1-3 edits). If the comment is sweeping ("make the whole trip more luxurious"), the patch may touch every narrative field.

What you can change — these are the ONLY allowed edit types. Use the exact dayId / propertyId values from the input:

  • dayDescription      — rewrite a day's prose narrative
  • daySubtitle         — rewrite a day's short subtitle / phase label
  • dayHighlights       — replace a day's highlights array (3-5 short bullets)
  • propertyDescription — rewrite a property's "About" paragraph
  • propertyWhyChose    — rewrite a property's "Why we chose this" line
  • closingLetter       — rewrite the closing letter
  • closingHeadline     — rewrite the closing headline
  • personalNoteBody    — rewrite the personal-note opening letter

What you CANNOT do:
  • Add or remove days. (Operator handles structural changes manually.)
  • Add or remove properties. (Operator handles those.)
  • Rename properties or destinations.
  • Change prices, dates, lodge assignments, or any factual field.
  • Invent details not present in the input or the client's comment.

Voice: keep the operator's voice (the BAN list above is non-negotiable). Each rewrite stays the same length or shorter — never pad.

Return ONLY a JSON object with this exact shape:

{
  "summary": "<1-2 sentences describing what changed>",
  "edits": [
    { "type": "<one of the allowed types>", "dayId": "<id>" or "propertyId": "<id>" or neither, "newText": "<rewritten text>" }
  ]
}

For dayHighlights, "newText" is an ARRAY of strings; for everything else it's a single string. No markdown fences, no preamble, no explanation. Just the JSON.`;

  const userText = [
    `CLIENT COMMENT:\n"""\n${comment}\n"""`,
    body.trip
      ? `TRIP:\n${JSON.stringify(body.trip, null, 2)}`
      : "",
    body.client
      ? `CLIENT:\n${JSON.stringify(body.client, null, 2)}`
      : "",
    `DAYS (${days.length}):\n${JSON.stringify(days, null, 2)}`,
    `PROPERTIES (${properties.length}):\n${JSON.stringify(properties, null, 2)}`,
    body.closing
      ? `CLOSING:\n${JSON.stringify(body.closing, null, 2)}`
      : "",
    body.personalNote
      ? `PERSONAL NOTE:\n${JSON.stringify(body.personalNote, null, 2)}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const client = new Anthropic({ apiKey });

  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 6000,
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
      console.error("[AI/apply-comment] Couldn't parse model output:\n", raw);
      return NextResponse.json(
        { error: "AI returned an unexpected format. Please try again." },
        { status: 502 },
      );
    }

    // Defensive: drop any edit that doesn't reference a known id, or
    // uses a type we don't support. Prevents the editor from crashing
    // on a hallucinated dayId.
    const safe: Edit[] = [];
    for (const e of parsed.edits) {
      if (!e || typeof e.type !== "string" || !VALID_TYPES.has(e.type)) continue;
      const t = e.type;
      // Day-targeted edits must reference a known day id.
      if (t === "dayDescription" || t === "daySubtitle" || t === "dayHighlights") {
        if (typeof e.dayId !== "string" || !knownDayIds.has(e.dayId)) continue;
      }
      // Property-targeted edits must reference a known property id.
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
        case "closingHeadline":
          safe.push({ type: "closingHeadline", newText });
          break;
        case "personalNoteBody":
          safe.push({ type: "personalNoteBody", newText });
          break;
      }
    }

    return NextResponse.json({
      summary: parsed.summary || "Applied the requested changes.",
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
      console.error("[AI/apply-comment] Anthropic error:", err.status, err.message);
      return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error("[AI/apply-comment] Unexpected error:", message);
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
