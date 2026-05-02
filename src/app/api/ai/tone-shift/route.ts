import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { buildBrandDNAPromptSection } from "@/lib/brandDNAPrompt";

// POST /api/ai/tone-shift
//
// Batch tone-rewrite for an entire proposal. The single-field
// /api/ai/rewrite endpoint is designed for inline selection edits;
// this is the proposal-wide pass that operators trigger from the
// toolbar to make a whole proposal sound (say) more luxurious or
// more adventurous in one click.
//
// Why a separate endpoint instead of looping /api/ai/rewrite:
//   • Cost — one Claude call instead of 10-20 sequential calls.
//   • Voice consistency — the model sees every narrative field in
//     one context and keeps the voice unified across cover, days,
//     properties, closing.
//   • Latency — single 8-15s call, not a 60-90s sequential ladder.
//
// The shared style rules + Brand DNA + tone prompts come from the
// same source as /api/ai/rewrite so both endpoints stay in lockstep.

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

const STYLE_RULES = `Operator copy rules (non-negotiable — these are the floor; brand voice may shift register but never relaxes these bans):

BAN — never use these words, or any close variant:
- Adjective clichés: stunning, breathtaking, amazing, incredible, unforgettable, magical, magnificent, awe-inspiring, world-class, luxurious, luxe, iconic, ultimate, lush, vibrant, verdant, pristine, picturesque, idyllic.
- Marketing verbs: discover, immerse yourself, escape (to), unwind, embark on, indulge, "experience the magic", "step into".
- Brochure phrases: nestled in, tucked away, hidden gem, dotted with, paradise, rolling savannahs, rich biodiversity, "sights and sounds", "the perfect blend of", "a true testament to".
- AI tells: "Whether you're…", "From X to Y, …", "ensures", openings that introduce the destination as the hero.
- Closers: "memories to last a lifetime", "a journey to remember", any flourish ending.
- No exclamation marks. No rhetorical questions.

VOICE: Operator brief, not brochure. Confident, specific, unfussy. Short declarative sentences. One adjective per noun. Lead with facts.`;

const TONE_PROMPTS: Record<string, string> = {
  warm:
    "Write with warmth. Imagine you know the clients personally. Allow a single personal aside when the context supports it — no sycophancy, no over-politeness.",
  editorial:
    "Write with editorial rhythm — slightly longer sentences, one or two sensory details. Still grounded; no purple prose. Magazine-feature voice.",
  adventurous:
    "Write with quiet adventure. Lean on action verbs, the geography, the wildlife. Concrete enough to feel earned. Never bombastic.",
  luxury:
    "Write with measured luxury. Specific service details (private guides, helicopter access, signature dishes) over adjectives. Confidence without showing off.",
  brief:
    "Write briefly. Short sentences. Maximum one adjective per noun. Drop filler. If the context is thin, write less.",
  playful:
    "Write with a light, dry wit — understated, never cheesy. Operator voice with a smile, not jokes.",
  formal:
    "Write formally. Full sentences, no contractions, measured distance. Never stiff.",
};

const INTENSITY_HINTS: Record<string, string> = {
  subtle:
    "Apply the tone with a light touch. The text should still sound like the same operator, just with this voice colouring it.",
  strong:
    "Apply the tone with conviction. Reshape sentence structure where needed. The voice should be unmistakable.",
};

interface IncomingField {
  key: string;
  text: string;
}

interface OutgoingField {
  key: string;
  newText: string;
}

interface Body {
  tone?: string;
  intensity?: "subtle" | "strong";
  fields?: IncomingField[];
  context?: {
    tripTitle?: string;
    destinations?: string[];
    nights?: number;
    tripStyle?: string;
    clientName?: string;
  };
}

const MAX_FIELDS = 50; // cap so a deeply-customised proposal doesn't blow the token budget.
const MAX_FIELD_LENGTH = 2000; // truncate any single field defensively.
const MAX_TOTAL_INPUT = 30_000; // string-length cap across all input fields.

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
  if (!apiKey)
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 500 },
    );

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const tone = (body.tone ?? "").toLowerCase();
  if (!tone || !TONE_PROMPTS[tone]) {
    return NextResponse.json(
      { error: `tone is required and must be one of: ${Object.keys(TONE_PROMPTS).join(", ")}` },
      { status: 400 },
    );
  }
  const intensity = body.intensity === "strong" ? "strong" : "subtle";

  const rawFields = Array.isArray(body.fields) ? body.fields : [];
  const fields = rawFields
    .filter((f): f is IncomingField => !!f && typeof f.key === "string" && typeof f.text === "string")
    .map((f) => ({ key: f.key, text: f.text.trim() }))
    .filter((f) => f.text.length > 0)
    .slice(0, MAX_FIELDS)
    .map((f) => ({
      key: f.key,
      text: f.text.length > MAX_FIELD_LENGTH ? f.text.slice(0, MAX_FIELD_LENGTH) : f.text,
    }));
  if (fields.length === 0) {
    return NextResponse.json({ error: "fields is required (at least one non-empty)" }, { status: 400 });
  }
  const totalLen = fields.reduce((sum, f) => sum + f.text.length, 0);
  if (totalLen > MAX_TOTAL_INPUT) {
    return NextResponse.json(
      { error: `total input too long (${totalLen} chars; max ${MAX_TOTAL_INPUT})` },
      { status: 400 },
    );
  }

  // Brand DNA — best effort.
  let brandDNASection = "";
  try {
    const profile = await prisma.brandDNAProfile.findUnique({
      where: { organizationId: ctx.organization.id },
    });
    brandDNASection = buildBrandDNAPromptSection(profile);
  } catch (err) {
    console.warn("[AI/tone-shift] Brand DNA load failed:", err);
  }

  const toneLine = TONE_PROMPTS[tone];
  const intensityLine = INTENSITY_HINTS[intensity];

  const systemText = `${STYLE_RULES}${brandDNASection}

You are rewriting an entire safari proposal in a target tone. The operator has selected:

  Tone: ${tone}
  Intensity: ${intensity}

Tone direction: ${toneLine}
Intensity direction: ${intensityLine}

You will receive a JSON array of fields, each with a stable key and the original text. For every field, return a rewritten version that:
  • Preserves every concrete fact (place names, dates, people, prices, lodge names, drive times, flight info, days numbered).
  • Applies the target tone consistently across all fields — the rewritten proposal should sound like one author wrote the whole thing in the target voice.
  • Never lengthens by more than 15%. Tighten where you can.
  • Never inserts cliché bans listed above.
  • Returns the same array shape — every input key maps to one output key.

Return ONLY a JSON object with this exact shape:

{
  "fields": [
    { "key": "<the same key>", "newText": "<rewritten>" },
    ...
  ]
}

No preamble. No markdown fences. No explanation. Just the JSON.`;

  const contextSummary = body.context
    ? `Trip context (use as background; don't restate verbatim):\n${JSON.stringify(body.context, null, 2)}`
    : "";

  const userText = [
    contextSummary,
    `Fields to rewrite (rewrite each, preserve facts, target tone "${tone}" at ${intensity} intensity):`,
    JSON.stringify({ fields }, null, 2),
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

    const parsed = parseFieldsResponse(raw);
    if (!parsed) {
      console.error("[AI/tone-shift] Couldn't parse model output:\n", raw);
      return NextResponse.json(
        { error: "AI returned an unexpected format. Please try again." },
        { status: 502 },
      );
    }

    // Defensive: only return fields that match an input key. Drop
    // anything the model hallucinated, and fall through to original
    // text for any input field the model omitted.
    const inputKeys = new Set(fields.map((f) => f.key));
    const safe: OutgoingField[] = parsed
      .filter((f) => inputKeys.has(f.key) && typeof f.newText === "string")
      .map((f) => ({ key: f.key, newText: f.newText.trim() }))
      .filter((f) => f.newText.length > 0);

    return NextResponse.json({
      fields: safe,
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
      console.error("[AI/tone-shift] Anthropic error:", err.status, err.message);
      return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error("[AI/tone-shift] Unexpected error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Best-effort JSON extraction. Models sometimes wrap JSON in markdown
// fences despite instructions otherwise. We unwrap fences and try to
// find the first {…} block before parsing.
function parseFieldsResponse(raw: string): OutgoingField[] | null {
  let body = raw.trim();
  // Strip ```json … ``` or ``` … ``` fences if present.
  const fenceMatch = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(body);
  if (fenceMatch) body = fenceMatch[1].trim();
  // Find the first { and last } — covers cases where the model added
  // a one-line "Here's the JSON:" preamble we'd otherwise reject.
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  const slice = body.slice(start, end + 1);
  try {
    const obj = JSON.parse(slice);
    if (!obj || !Array.isArray(obj.fields)) return null;
    return obj.fields;
  } catch {
    return null;
  }
}
