import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { buildBrandDNAPromptSection, brandDNAHasContent } from "@/lib/brandDNAPrompt";

// ─── Default style — applies whether or not Brand DNA is set ────────────────
//
// These rules are the floor. Brand DNA *layers on top* of them via the system
// prompt; when a Brand DNA voice signal contradicts a default rule, the Brand
// DNA wins (the layering text is explicit about that). When Brand DNA is
// absent, generation behaves exactly as it did before this integration.

const STYLE_RULES = `Writing rules (non-negotiable defaults):
- Never use "stunning", "breathtaking", "amazing", "world-class", "luxurious", "incredible", or "unforgettable".
- Be specific and location-aware. Name the region, the camp, the road, the season, the wildlife behaviour — not generic adjectives.
- Warm, expert tone: like a seasoned East African guide writing to a guest. Confident, grounded, never salesy.
- Prefer concrete sensory detail (light, sound, smell, terrain) over abstract praise.
- Keep copy tight. No filler. No exclamation marks.`;

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

type Body = {
  task?: "title" | "day" | "greeting" | "freeform";
  prompt?: string;
  context?: Record<string, unknown>;
};

function buildPrompt(body: Body): string {
  const { task = "freeform", prompt = "", context = {} } = body;
  const ctx = JSON.stringify(context, null, 2);

  switch (task) {
    case "title":
      return `Write a single short proposal title (max 8 words) for this safari.
Return ONLY the title text. No quotes, no preamble, no explanation.

Context:
${ctx}`;
    case "day":
      return `Write a 2-3 sentence day narrative for a safari proposal.
Ground it in the specific destination and activities in the context.
Return ONLY the narrative paragraph.

Context:
${ctx}`;
    case "greeting":
      return `Write a warm 3-4 sentence greeting paragraph to open a safari proposal for this client.
Return ONLY the greeting paragraph.

Context:
${ctx}`;
    default:
      return `${prompt}\n\nContext:\n${ctx}`;
  }
}

export async function POST(req: Request) {
  // Tenant context — needed to resolve the org's Brand DNA. We don't 409 here
  // (org-less users shouldn't reach this route under normal middleware), but
  // we tolerate a missing org and fall back to the default style.
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 500 }
    );
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Brand DNA — best-effort. A DB error here must not break generation.
  let brandDNASection = "";
  let brandDNAUsed = false;
  if (ctx.organization) {
    try {
      const profile = await prisma.brandDNAProfile.findUnique({
        where: { organizationId: ctx.organization.id },
      });
      brandDNASection = buildBrandDNAPromptSection(profile);
      brandDNAUsed = brandDNAHasContent(profile);
    } catch (err) {
      console.warn("[AI] Brand DNA load failed; falling back to defaults:", err);
    }
  }

  const systemText = STYLE_RULES + brandDNASection;

  const client = new Anthropic({ apiKey });

  // Build the system block. We always pass the array form so we can attach
  // cache_control — the Brand DNA section is per-org and stable, so a single
  // breakpoint here gives us a high cache-hit rate for repeat generations
  // from the same org. Empty / tiny Brand DNA won't actually cache (below
  // the model's minimum), and that's fine — there's nothing to amortise.
  const system: Anthropic.TextBlockParam[] = [
    {
      type: "text",
      text: systemText,
      cache_control: { type: "ephemeral" },
    },
  ];

  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system,
      messages: [{ role: "user", content: buildPrompt(body) }],
    });

    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    return NextResponse.json({
      text,
      meta: {
        brandDNA: brandDNAUsed,
        cacheRead: msg.usage.cache_read_input_tokens ?? 0,
        cacheWrite: msg.usage.cache_creation_input_tokens ?? 0,
        inputTokens: msg.usage.input_tokens,
        outputTokens: msg.usage.output_tokens,
      },
    });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: "AI is rate-limited; please retry in a moment." },
        { status: 429 },
      );
    }
    if (err instanceof Anthropic.APIError) {
      console.error("[AI] Anthropic error:", err.status, err.message);
      return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error("[AI] Unexpected error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
