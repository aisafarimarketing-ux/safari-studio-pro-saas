import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { buildBrandDNAPromptSection } from "@/lib/brandDNAPrompt";

// POST /api/ai/property-content
//
// Given a property name + location + class, returns:
//   {
//     shortSummary: string,   // ≤ 280 chars
//     whatMakesSpecial: string,
//     whyWeChoose: string,
//     amenities: string[],    // 5–10 items
//     suggestedSuitability: string[],  // ids from SUITABILITY
//     suggestedNights: number          // 1–5
//   }
//
// Operator uses this to one-click fill a property in the library without
// hunting for copy. All output is grounded in the real property when the
// model knows it; when it doesn't, it falls back to generic-but-plausible
// content for that class + region, which the operator then edits.

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

const STYLE_RULES = `Operator copy rules (non-negotiable):

BAN — never use: stunning, breathtaking, amazing, incredible, unforgettable, magical, iconic, ultimate, lush, vibrant, verdant, pristine, picturesque, idyllic, luxurious, luxe, immerse yourself, escape to, unwind, indulge, discover, "the perfect blend of", "a true testament to", "nestled in", "tucked away", "hidden gem", exclamation marks, rhetorical questions.

VOICE: Operator brief, not brochure. Confident, specific, unfussy. Short sentences. One adjective per noun. Lead with facts, not adjectives. Don't open with the property as hero ("Mara Plains Camp is…" ← bad). Don't end with flourishes.`;

type Body = {
  propertyName?: string;
  propertyClass?: string;
  locationName?: string;
  country?: string;
  region?: string;
};

type PropertyContentOut = {
  shortSummary: string;
  whatMakesSpecial: string;
  whyWeChoose: string;
  amenities: string[];
  suggestedSuitability: string[];
  suggestedNights: number;
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

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = body.propertyName?.trim();
  if (!name) {
    return NextResponse.json({ error: "propertyName is required" }, { status: 400 });
  }

  // Best-effort Brand DNA context — never blocks generation.
  let brandDNASection = "";
  try {
    const profile = await prisma.brandDNAProfile.findUnique({
      where: { organizationId: ctx.organization.id },
    });
    brandDNASection = buildBrandDNAPromptSection(profile);
  } catch (err) {
    console.warn("[AI/property] Brand DNA load failed:", err);
  }

  const systemText = STYLE_RULES + brandDNASection + `

You are filling a safari property library entry. Output JSON only — no preamble, no markdown fences.

Shape:
{
  "shortSummary": "≤ 280 chars. One or two facts: tent/room count, signature feature, region. No adjectives stacked.",
  "whatMakesSpecial": "2-3 sentences. The concrete, non-generic reason. Could be location (conservancy name, river frontage), design (founder, architect), access (private airstrip, behind-the-scenes), or wildlife (leopard density, rhino sanctuary). Ground it.",
  "whyWeChoose": "2-3 sentences. Operator's pick rationale — what kind of guest this is right for and why. This is the operator's voice, not marketing copy.",
  "amenities": ["6-10 items. Short nouns. Things a property actually has: pool, spa, Wi-Fi, private plunge pool, sundowner deck, massage, library, kids' programme, fire pit, guided walks, spa treatments."],
  "suggestedSuitability": ["Pick 2-4 ids from: families, honeymoon, first_time, experienced, photography, small_groups, large_groups, kids_under_12, accessible, solo"],
  "suggestedNights": 2-4 integer — typical length of stay for this type of camp
}

If you recognise the property by name, use its real facts. If not, produce plausible content for this class + region that the operator can refine. Either way, stay within the voice rules.`;

  const userPayload = {
    property: {
      name,
      class: body.propertyClass || "unknown",
      location: body.locationName || "",
      country: body.country || "",
      region: body.region || "",
    },
  };

  const userText = `Fill the property library entry for the property below. Return ONLY the JSON object described in the system prompt.

Input:
${JSON.stringify(userPayload, null, 2)}`;

  const client = new Anthropic({ apiKey });

  let raw = "";
  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
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
      console.error("[AI/property] Anthropic error:", err.status, err.message);
      return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error("[AI/property] Unexpected error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  let parsed: Partial<PropertyContentOut>;
  try {
    parsed = JSON.parse(stripFences(raw));
  } catch {
    console.error("[AI/property] Malformed model output:", raw.slice(0, 400));
    return NextResponse.json({ error: "AI returned malformed output. Try again." }, { status: 502 });
  }

  const result: PropertyContentOut = {
    shortSummary: cleanString(parsed.shortSummary, 280),
    whatMakesSpecial: cleanString(parsed.whatMakesSpecial, 600),
    whyWeChoose: cleanString(parsed.whyWeChoose, 600),
    amenities: cleanStringArray(parsed.amenities, 12),
    suggestedSuitability: cleanStringArray(parsed.suggestedSuitability, 5),
    suggestedNights: cleanInt(parsed.suggestedNights, 1, 7, 3),
  };

  return NextResponse.json({ content: result });
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function stripFences(text: string): string {
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(text.trim());
  return fence ? fence[1].trim() : text.trim();
}

function cleanString(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, max);
}

function cleanStringArray(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .map((s) => s.trim())
    .slice(0, max);
}

function cleanInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseInt(v, 10) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}
