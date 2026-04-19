import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { buildBrandDNAPromptSection } from "@/lib/brandDNAPrompt";

// POST /api/ai/rewrite
//
// One endpoint for every inline AI action in the editor:
//   mode: "write"     — generate fresh copy from a prompt + context
//   mode: "rewrite"   — take the user's existing text and rewrite it
//   mode: "shorten"   — same but tighter
//   mode: "lengthen"  — same but a touch longer (never padded)
//   mode: "tone"      — rewrite in a specific tone (warm / formal / brief / witty)
//
// Works on arbitrary text — we pass through whatever the caller sends,
// apply the shared style rules + Brand DNA, and return a single rewritten
// string. The caller decides what to do with the text (replace selection,
// fill a section, etc.).

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
  warm: "Write with warmth. Imagine you know the clients personally. Allow a single personal aside when the context supports it — no sycophancy, no over-politeness.",
  formal: "Write formally. Full sentences, no contractions, measured distance. Never stiff.",
  brief: "Write briefly. Short sentences. Maximum one adjective per noun. If the context is thin, write less.",
  playful: "Write with a light, dry wit — understated, never cheesy. Operator voice with a smile, not jokes.",
  poetic: "Write with an editorial rhythm — slightly longer sentences, one or two sensory details. Still grounded; no purple prose.",
};

const LENGTH_HINTS: Record<string, string> = {
  shorter: "Cut 30-50% of the length. Preserve every concrete fact (place names, dates, activities). Drop filler.",
  same: "Match the original length as closely as possible.",
  longer: "Add one grounded detail or fact. Don't pad. Don't repeat. Never exceed 60% more than the original.",
};

type Mode = "write" | "rewrite" | "shorten" | "lengthen" | "tone";

type Body = {
  mode?: Mode;
  text?: string;        // existing text (rewrite / shorten / lengthen / tone)
  prompt?: string;      // what to write about (write mode) or extra direction
  tone?: string;        // one of TONE_PROMPTS keys
  length?: string;      // "shorter" | "same" | "longer"
  // Scoped context — caller sends whatever is relevant. Useful fields:
  //   clientName, destinations, nights, tripStyle, sectionKind
  context?: Record<string, unknown>;
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
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const mode: Mode = body.mode ?? "rewrite";
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const promptExtra = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const tone = (body.tone ?? "").toLowerCase();
  const length = (body.length ?? "").toLowerCase();

  if (mode !== "write" && !text) {
    return NextResponse.json({ error: "text is required for rewrite/shorten/lengthen/tone" }, { status: 400 });
  }
  if (text.length > 4000) {
    return NextResponse.json({ error: "text too long (max 4000 chars)" }, { status: 400 });
  }

  // Brand DNA — best-effort.
  let brandDNASection = "";
  try {
    const profile = await prisma.brandDNAProfile.findUnique({
      where: { organizationId: ctx.organization.id },
    });
    brandDNASection = buildBrandDNAPromptSection(profile);
  } catch (err) {
    console.warn("[AI/rewrite] Brand DNA load failed:", err);
  }

  const modeInstructions = buildModeInstructions(mode, tone, length);
  const contextBlock = body.context
    ? `Context (use if relevant; ignore fields that don't help):\n${JSON.stringify(body.context, null, 2)}`
    : "";

  const systemText = STYLE_RULES + brandDNASection + `

${modeInstructions}

Return ONLY the rewritten text. No preamble like "Here's the rewrite:". No markdown fences. No bullet points unless the original used bullets. Preserve the author's own people/place names unless they're spelt inconsistently.`;

  const userText = buildUserMessage(mode, text, promptExtra, contextBlock);

  const client = new Anthropic({ apiKey });

  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: [
        { type: "text", text: systemText, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: userText }],
    });
    const out = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    return NextResponse.json({
      text: stripWrappingQuotes(out),
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
      console.error("[AI/rewrite] Anthropic error:", err.status, err.message);
      return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error("[AI/rewrite] Unexpected error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function buildModeInstructions(mode: Mode, tone: string, length: string): string {
  const toneLine = tone && TONE_PROMPTS[tone] ? TONE_PROMPTS[tone] : "";
  const lengthLine = length && LENGTH_HINTS[length] ? LENGTH_HINTS[length] : "";

  switch (mode) {
    case "write":
      return [
        "You are drafting a new paragraph for a safari proposal.",
        toneLine,
        lengthLine || "Keep it as long as the prompt and context justify — no more.",
      ].filter(Boolean).join("\n");
    case "shorten":
      return [
        "Rewrite the text below to be tighter. Preserve every concrete fact (place names, dates, people, activities).",
        toneLine,
        LENGTH_HINTS.shorter,
      ].filter(Boolean).join("\n");
    case "lengthen":
      return [
        "Rewrite the text below with one additional grounded detail — something the operator would actually know. Never pad.",
        toneLine,
        LENGTH_HINTS.longer,
      ].filter(Boolean).join("\n");
    case "tone":
      return [
        "Rewrite the text below, shifting the tone to the setting below. Preserve all facts.",
        toneLine || TONE_PROMPTS.warm,
        lengthLine || LENGTH_HINTS.same,
      ].filter(Boolean).join("\n");
    case "rewrite":
    default:
      return [
        "Rewrite the text below. Keep every fact (place names, dates, activities). Improve rhythm, trim any cliché, tighten openings.",
        toneLine,
        lengthLine,
      ].filter(Boolean).join("\n");
  }
}

function buildUserMessage(mode: Mode, text: string, extra: string, contextBlock: string): string {
  if (mode === "write") {
    return [
      extra || "Write a paragraph for this section.",
      contextBlock,
    ].filter(Boolean).join("\n\n");
  }
  return [
    contextBlock,
    extra ? `Additional direction:\n${extra}` : "",
    `Text to rewrite:\n"""\n${text}\n"""`,
  ].filter(Boolean).join("\n\n");
}

function stripWrappingQuotes(s: string): string {
  // Models sometimes return the rewrite inside """ … """ even though we
  // told them not to. Strip matched wrappers.
  const m = /^"""\s*([\s\S]*?)\s*"""$/.exec(s);
  if (m) return m[1].trim();
  const q = /^"([\s\S]*)"$/.exec(s);
  if (q) return q[1].trim();
  return s;
}
