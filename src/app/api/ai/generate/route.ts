import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Anthropic from "@anthropic-ai/sdk";

// Writing-style contract enforced on every AI response.
const STYLE_RULES = `Writing rules (non-negotiable):
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
  const { userId } = await auth();
  if (!userId) {
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

  const client = new Anthropic({ apiKey });

  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: STYLE_RULES,
      messages: [{ role: "user", content: buildPrompt(body) }],
    });
    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return NextResponse.json({ text });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[AI] Anthropic error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
