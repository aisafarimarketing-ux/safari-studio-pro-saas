import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthContext } from "@/lib/currentUser";
import { logSuggestion } from "@/lib/aiLog";

// POST /api/ai/decide
//
// The intent-driven decision engine. Given the client's current
// state — their latest message, whether a proposal exists, recent
// activity, days since last reply — return ONE action + reason +
// message. The model reads the operator's playbook (encoded in
// SYSTEM_PROMPT) and chooses; the server validates + logs.
//
// Distinct from /api/ai/execute:
//   • execute  → operator typed a specific command, server resolves
//                a client and renders a deterministic snippet.
//   • decide   → operator (or future inbox integration) hands over
//                the client's message + state, server picks the
//                right action and drafts the response.
//
// Output is operator-reviewable. Nothing is auto-sent. The shape is
// the literal JSON the spec mandates so callers can switch on
// `action` and surface `message` in the FollowUpPanel preview.

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

// ── System prompt — the operator's decision playbook ─────────────────
//
// Kept verbatim from the operator-supplied spec so the discipline
// stays auditable: anyone reading the file sees the rules the model
// is following. Edits to the rubric live here, in source control,
// not in a database table or runtime config.

const SYSTEM_PROMPT = `You are the decision engine for a safari sales assistant.

Your job is to decide WHAT action to take and WHAT message to send, based on the client's current intent.

You are not a generic assistant. You do not follow sequences. You do not continue patterns. You only act based on what the client needs right now.

## CORE PRINCIPLE

Always decide based on: "What is the client trying to figure out right now?"

Never decide based on:
- what was sent last
- "next step" logic
- internal system states (VERY_HOT, COOLING, etc.)

## PRIORITY ORDER (IMPORTANT)

When multiple signals exist, resolve in this order:

1. PRICING (strongest intent)
2. SNIPPET (explicit question)
3. PREVIEW (only if no proposal exists)
4. NONE

Higher priority always overrides lower.

## AVAILABLE ACTIONS

You must choose exactly one:

1. PREVIEW — send a short sample safari (pre-proposal only)
2. SNIPPET — answer a specific question or clarify one aspect
3. PRICING — send a clear pricing breakdown
4. NONE    — send nothing

## DECISION RULES

### 1. PRICING (highest priority)
If ANY of these are true:
- client mentions price / cost / budget
- lastClientActivity indicates pricing interest
- client is comparing or hesitating after proposal
Then → action = PRICING.

### 2. SNIPPET (explicit question only)
If clientMessage contains a clear question OR client shows confusion about a specific part:
Then → action = SNIPPET.
Rules:
- Must directly answer the question.
- One idea only.
- No "Day sequence" messaging.
- No repeating full proposal.

### 3. PREVIEW (only before proposal exists)
If proposalExists = false AND no pricing signal AND no specific question:
Then → action = PREVIEW.
Reason: client needs a first understanding of the trip.

### 4. AFTER PROPOSAL EXISTS
If proposalExists = true:
Allowed actions:
- PRICING (clarify or unblock)
- SNIPPET (only if answering a direct question)
Otherwise → NONE.
Strictly DO NOT: send previews, resend itinerary content, send "day-based" snippets.

### 5. QUIET CLIENT
If proposalExists = true AND daysSinceLastReply >= 2 AND no pricing signal AND no question:
Then → action = NONE. Do not nudge without a reason.

### 6. COLD / EARLY LEAD
If proposalExists = false AND no interaction or very early stage:
Then → action = PREVIEW.

## MESSAGE STYLE RULES

All messages must:
- be calm and human
- be short and clear
- contain no hype
- contain no emojis
- contain no exclamation marks
- sound like a real operator typing on WhatsApp

Avoid: long explanations, marketing language, repeating full itineraries unless PREVIEW.

## MESSAGE GUIDELINES PER ACTION

PREVIEW: short intro; concrete feel of the trip; 3–5 lines max; NOT a full itinerary.
SNIPPET: direct answer; one idea only; resolves confusion.
PRICING: total (if available); per person (if available); inclusions; exclusions; end with a simple adjustment offer.
NONE: message = null.

## FINAL CHECK

Before returning, ask: "Does this reduce friction or increase clarity right now?"
If not → return NONE.

You will be given the input as JSON. Call the decide_next_action tool exactly once with your structured choice.`;

// Tool schema — forces structured output. tool_choice: "tool" with
// the matching name guarantees the model can't return free text;
// the only path back is a valid call.

const TOOL: Anthropic.Messages.Tool = {
  name: "decide_next_action",
  description:
    "Choose exactly one action and write the message (or omit message for NONE).",
  input_schema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["PREVIEW", "SNIPPET", "PRICING", "NONE"],
        description: "The single action to take.",
      },
      reason: {
        type: "string",
        description:
          "Short explanation of client intent (one short sentence).",
      },
      message: {
        type: "string",
        description:
          "The exact message to send, or empty string when action is NONE.",
      },
    },
    required: ["action", "reason", "message"],
  },
};

type Body = {
  clientMessage?: string | null;
  proposalExists?: boolean;
  lastClientActivity?: string | null;
  daysSinceLastReply?: number;
  /** Optional — when set, the audit row attaches to this client. */
  clientId?: string;
  /** Optional — when set, the audit row attaches to this proposal. */
  proposalId?: string;
};

type DecideResponse =
  | {
      status: "ok";
      action: "PREVIEW" | "SNIPPET" | "PRICING" | "NONE";
      reason: string;
      /** Null when action is NONE; string otherwise. */
      message: string | null;
      /** Audit log row id. Operator can dispatch / review via the
       *  existing FollowUpPanel by passing this through the same
       *  ss:openFollowUp event surface execute uses. */
      suggestionId: string | null;
    }
  | { status: "error"; message: string };

export async function POST(req: Request): Promise<NextResponse<DecideResponse>> {
  // Top-level guard mirrors /api/ai/execute — any uncaught exception
  // returns structured JSON so the caller never has to interpret a
  // bare 5xx HTML page.
  try {
    return await runDecide(req);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[ai/decide] UNHANDLED:", err);
    return NextResponse.json(
      { status: "error", message: `Server error: ${message}` },
      { status: 500 },
    );
  }
}

async function runDecide(req: Request): Promise<NextResponse<DecideResponse>> {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json(
      { status: "error", message: "Not authenticated." },
      { status: 401 },
    );
  }
  if (!ctx.organization) {
    return NextResponse.json(
      { status: "error", message: "No active organization." },
      { status: 409 },
    );
  }
  if (!ctx.orgActive) {
    return NextResponse.json(
      { status: "error", message: "Account suspended." },
      { status: 402 },
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { status: "error", message: "ANTHROPIC_API_KEY not configured." },
      { status: 500 },
    );
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { status: "error", message: "Invalid JSON." },
      { status: 400 },
    );
  }

  // Normalise + validate the inputs. Defensive defaults match the
  // spec: clientMessage may be null when there's no fresh inbound,
  // lastClientActivity falls back to "unknown", daysSinceLastReply
  // floors at 0.
  const clientMessage =
    typeof body.clientMessage === "string" && body.clientMessage.trim().length > 0
      ? body.clientMessage.trim().slice(0, 2000)
      : null;
  const proposalExists = body.proposalExists === true;
  const lastClientActivity =
    typeof body.lastClientActivity === "string" && body.lastClientActivity.trim().length > 0
      ? body.lastClientActivity.trim().slice(0, 200)
      : "unknown";
  const daysSinceLastReply =
    typeof body.daysSinceLastReply === "number" &&
    Number.isFinite(body.daysSinceLastReply)
      ? Math.max(0, Math.floor(body.daysSinceLastReply))
      : 0;

  // ── Render the input block as structured JSON the model can
  //    parse cleanly. Wrapping in a fenced JSON block avoids any
  //    ambiguity about which characters are part of the input.
  const userMessage = JSON.stringify(
    {
      clientMessage,
      proposalExists,
      lastClientActivity,
      daysSinceLastReply,
    },
    null,
    2,
  );

  const client = new Anthropic({ apiKey });
  let msg: Anthropic.Messages.Message;
  try {
    msg = await client.messages.create({
      model: MODEL,
      max_tokens: 600,
      tool_choice: { type: "tool", name: "decide_next_action" },
      tools: [TOOL],
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Input:\n\`\`\`json\n${userMessage}\n\`\`\``,
        },
      ],
    });
  } catch (err) {
    console.warn("[ai/decide] Anthropic error:", err);
    return NextResponse.json(
      {
        status: "error",
        message: "Decision engine is temporarily unavailable.",
      },
      { status: 502 },
    );
  }

  const toolUse = msg.content.find(
    (block): block is Anthropic.Messages.ToolUseBlock =>
      block.type === "tool_use" && block.name === "decide_next_action",
  );
  if (!toolUse) {
    return NextResponse.json(
      {
        status: "error",
        message: "Decision engine returned no choice — try again.",
      },
      { status: 502 },
    );
  }

  const input = toolUse.input as Record<string, unknown> | null;
  if (!input) {
    return NextResponse.json(
      { status: "error", message: "Decision engine returned empty payload." },
      { status: 502 },
    );
  }

  const actionRaw = typeof input.action === "string" ? input.action : "";
  const action = (
    ["PREVIEW", "SNIPPET", "PRICING", "NONE"] as const
  ).find((a) => a === actionRaw);
  if (!action) {
    return NextResponse.json(
      {
        status: "error",
        message: `Decision engine returned invalid action "${actionRaw}".`,
      },
      { status: 502 },
    );
  }
  const reason =
    typeof input.reason === "string" ? input.reason.trim().slice(0, 280) : "";
  const messageRaw =
    typeof input.message === "string" ? input.message.trim().slice(0, 4000) : "";
  // NONE → null per the spec. Empty-string messages on non-NONE
  // actions also collapse to null (the spec calls those "do not
  // send"; we don't surface a phantom empty message).
  const message =
    action === "NONE" || messageRaw.length === 0 ? null : messageRaw;

  // ── Audit log — same store as the rest of Studio AI's decisions.
  //    Best-effort: a logging miss doesn't fail the call, only emits
  //    a console warning so the operator still gets their answer.
  let suggestionId: string | null = null;
  try {
    const targetType = body.proposalId
      ? "proposal"
      : body.clientId
        ? "client"
        : "ad-hoc";
    const targetId = body.proposalId ?? body.clientId ?? "decide";
    const logged = await logSuggestion({
      organizationId: ctx.organization.id,
      userId: ctx.user.id,
      kind: "decision",
      targetType,
      targetId,
      input: {
        clientMessage,
        proposalExists,
        lastClientActivity,
        daysSinceLastReply,
      },
      output: JSON.stringify({ action, reason, message }),
    });
    suggestionId = logged?.id ?? null;
  } catch (err) {
    console.warn("[ai/decide] logSuggestion failed:", err);
  }

  return NextResponse.json({
    status: "ok",
    action,
    reason,
    message,
    suggestionId,
  });
}
