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

const STYLE_RULES = `Operator copy rules (non-negotiable — these are the floor; brand voice may shift register but never relaxes these bans):

BAN — never use these words, or any close variant:
- Adjective clichés: stunning, breathtaking, amazing, incredible, unforgettable, magical, magnificent, awe-inspiring, world-class, luxurious, luxe, iconic, ultimate, lush, vibrant, verdant, pristine, picturesque, idyllic.
- Marketing verbs: discover, immerse yourself, escape (to), unwind, embark on, indulge, "experience the magic", "step into".
- Brochure phrases: nestled in, tucked away, hidden gem, dotted with, paradise, rolling savannahs, rich biodiversity, "sights and sounds", "the perfect blend of", "a true testament to".
- AI tells: "Whether you're…", "From X to Y, …", "ensures", openings that introduce the destination as the hero ("The Masai Mara is…").
- Closers: "memories to last a lifetime", "a journey to remember", "your dream safari awaits", any flourish ending.
- No exclamation marks. No rhetorical questions.

VOICE:
- Operator brief, not brochure. Like writing to a colleague who already knows the ground.
- Confident, specific, unfussy. Plain English over poetic English.
- One adjective per noun, max. Cut the second.
- Lead with a fact — a place name, a time, a distance, a named feature, a behaviour, a season. Adjectives are only allowed after a fact has earned them.
- Default to short, declarative sentences. Vary rhythm only when the content earns it.

GROUND IT:
- Use the names and specifics in the provided context: camp, region, conservancy, road, season, guide, client, dates, activities. Pull from the context, never invent.
- Operator-trust details (board basis, flight time, vehicle, tent count, head guide name) are gold when the context has them — use them.
- If the context is thin, write less rather than fill space with praise. Two grounded sentences beat four padded ones.

DON'T:
- Don't moralise about wildlife or culture.
- Don't open with the destination as hero.
- Don't end with a flourish.
- Don't address the reader as "you'll discover" / "you'll experience" / "you'll find".`;

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
      return `Write a single short proposal title for this safari (max 8 words).
Use a specific anchor — client name, destination, season, or trip style. Avoid generic phrasing like "Safari Adventure", "African Dream Trip", "East African Escape".
Return ONLY the title text. No quotes, no preamble, no explanation.

Context:
${ctx}`;
    case "day":
      return `Write a 2-3 sentence day narrative for a safari proposal.
Open with a concrete observation — a time, terrain feature, season, conservancy/region name, or wildlife behaviour. Not the destination as hero, not an adjective.
Use named camps, regions, conservancies, board basis, and activities from the context. Skip what isn't there. Don't fabricate camp names, guides, or experiences.
If the context is thin, write less.
Return ONLY the narrative paragraph.

Context:
${ctx}`;
    case "greeting":
      return `Write a 3-4 sentence opening greeting for a safari proposal.
Address the named guests directly. State what the proposal is — destination(s), nights, season — using only what the context provides.
Sound like an operator who already knows the trip and the client, not a sales letter. One welcome line is enough; the rest is anchor and intent.
End on a human note (e.g. invite their notes), not a flourish.
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
