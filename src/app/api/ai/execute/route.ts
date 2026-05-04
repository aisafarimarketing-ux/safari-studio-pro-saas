import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { logSuggestion } from "@/lib/aiLog";
import {
  extractDays,
  findClient,
  findClientById,
  loadLatestProposal,
  type ClientLite,
} from "@/lib/executionTools";
import { formatProposalDaysSnippet } from "@/lib/executionFormat";
import { friendlyConsultantName } from "@/lib/consultantIdentity";
import type { TierKey } from "@/lib/types";

// POST /api/ai/execute
//
// The Execution AI's single endpoint. v1 supports ONE action:
// send_proposal_days. The flow:
//
//   1. Anthropic tool-use parses the operator's command into a
//      typed intent { clientHint, days, channel? }. Forced via
//      tool_choice so the model can't return free text.
//   2. Server-side deterministic resolution: find client → load
//      most-recent proposal → extract requested days. Each step
//      surfaces a typed result; ambiguity bubbles up as
//      needs_disambiguation, missing data as error, incomplete
//      content as warnings on a still-ready response.
//   3. Format the snippet (WhatsApp text or email HTML) using the
//      existing brand-safe templates. The AI never produces
//      client-visible content.
//   4. Log to AISuggestion (kind="execution") for audit / debug,
//      then return the preview + suggestionId so the dashboard
//      can open the FollowUpPanel with a prefilled draft.
//
// Body shape:
//   { command: string, clientId?: string }
//   clientId is supplied on the second round trip after the
//   operator picks from the disambiguation list — server still
//   validates the id is in the operator's org.

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

const SYSTEM_PROMPT = `You are the command parser for Safari Studio's Execution AI.

The operator types a command; you call the send_proposal_days tool with parsed parameters. You never generate client-visible content. You never call any tool other than send_proposal_days.

Examples — exact day list extraction is critical:
- "send Jennifer day 2 and 3" → { clientHint: "Jennifer", days: [2, 3] }
- "send Jennifer days 2 to 4" → { clientHint: "Jennifer", days: [2, 3, 4] }
- "share day 5 with the Mara family" → { clientHint: "Mara family", days: [5] }
- "send Collins first two days via email" → { clientHint: "Collins", days: [1, 2], channel: "email" }
- "whatsapp Jennifer day 3" → { clientHint: "Jennifer", days: [3], channel: "whatsapp" }

Rules:
- Always pass the client reference verbatim into clientHint. Server-side resolution handles matching.
- Days are 1-indexed integers.
- Omit channel unless the operator explicitly mentioned WhatsApp or email — server picks the operator's preferred channel otherwise.
- If the command is not a request to send specific days from a proposal, do NOT call the tool. Return text explaining what was unclear.`;

const TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: "send_proposal_days",
    description:
      "Send specific days from a client's most recent proposal as a snippet via WhatsApp or email.",
    input_schema: {
      type: "object",
      properties: {
        clientHint: {
          type: "string",
          description:
            "How the operator referred to the client. Pass through verbatim — entity resolution happens server-side.",
        },
        days: {
          type: "array",
          items: { type: "integer", minimum: 1, maximum: 99 },
          description:
            "Day numbers requested. e.g. [2, 3] for 'day 2 and 3'.",
        },
        channel: {
          type: "string",
          enum: ["whatsapp", "email"],
          description:
            "Channel the operator explicitly mentioned. Omit if not specified.",
        },
      },
      required: ["clientHint", "days"],
    },
  },
];

type Body = {
  command?: string;
  clientId?: string;
};

type ExecuteResponse =
  | {
      status: "ready";
      suggestionId: string;
      command: string;
      intent: ParsedIntent;
      client: ClientLite;
      proposal: {
        id: string;
        title: string;
        trackingId: string | null;
        updatedAt: string;
      };
      channel: "whatsapp" | "email";
      preview: { text: string; html: string; subject: string };
      warnings: string[];
    }
  | {
      status: "needs_disambiguation";
      command: string;
      intent: ParsedIntent;
      matches: ClientLite[];
    }
  | {
      status: "error";
      command: string;
      message: string;
      hint?: string;
    };

type ParsedIntent = {
  clientHint: string;
  days: number[];
  channel: "whatsapp" | "email" | null;
};

export async function POST(req: Request): Promise<NextResponse<ExecuteResponse>> {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json(
      { status: "error", command: "", message: "Not authenticated." },
      { status: 401 },
    );
  }
  if (!ctx.organization) {
    return NextResponse.json(
      { status: "error", command: "", message: "No active organization." },
      { status: 409 },
    );
  }
  if (!ctx.orgActive) {
    return NextResponse.json(
      { status: "error", command: "", message: "Account suspended." },
      { status: 402 },
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { status: "error", command: "", message: "ANTHROPIC_API_KEY not configured." },
      { status: 500 },
    );
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { status: "error", command: "", message: "Invalid JSON." },
      { status: 400 },
    );
  }
  const command = body.command?.trim() ?? "";
  const explicitClientId = body.clientId?.trim();
  if (!command) {
    return NextResponse.json(
      { status: "error", command, message: "Command is required." },
      { status: 400 },
    );
  }
  if (command.length > 400) {
    return NextResponse.json(
      { status: "error", command, message: "Command is too long." },
      { status: 400 },
    );
  }

  // ── Step 1 — parse the command via Anthropic tool-use ────────────────
  const intent = await parseIntent(apiKey, command);
  if (!intent) {
    return NextResponse.json({
      status: "error",
      command,
      message:
        "I couldn't parse that as a send-days command. Try: \"send Jennifer day 2 and 3\".",
    });
  }

  // ── Step 2 — resolve client ──────────────────────────────────────────
  const orgId = ctx.organization.id;
  const clientResult = explicitClientId
    ? await findClientById(orgId, explicitClientId)
    : await findClient(orgId, intent.clientHint);

  if (clientResult.status === "not-found") {
    return NextResponse.json({
      status: "error",
      command,
      message: `No client matches "${intent.clientHint}". Try a different name or part of the email.`,
    });
  }
  if (clientResult.status === "ambiguous") {
    return NextResponse.json({
      status: "needs_disambiguation",
      command,
      intent,
      matches: clientResult.matches,
    });
  }
  const client = clientResult.client;

  // ── Step 3 — load most recent proposal ───────────────────────────────
  const proposalResult = await loadLatestProposal(orgId, client.id);
  if (proposalResult.status === "not-found") {
    return NextResponse.json({
      status: "error",
      command,
      message: `${client.fullName} has no proposals on file yet. Create one before sending day snippets.`,
    });
  }
  const proposal = proposalResult.proposal;

  // ── Step 4 — extract requested days ──────────────────────────────────
  const daysResult = extractDays(proposal, intent.days);
  if (daysResult.status === "missing-days") {
    return NextResponse.json({
      status: "error",
      command,
      message: `Day ${daysResult.missing.join(", ")} ${
        daysResult.missing.length === 1 ? "doesn't exist" : "don't exist"
      } on ${client.fullName}'s proposal (${daysResult.available} ${
        daysResult.available === 1 ? "day" : "days"
      } total).`,
    });
  }

  // ── Step 5 — pick channel ────────────────────────────────────────────
  // Explicit channel wins; otherwise prefer phone (WhatsApp) when
  // available; otherwise email; otherwise refuse.
  let channel: "whatsapp" | "email";
  if (intent.channel === "whatsapp") {
    if (!client.phone) {
      return NextResponse.json({
        status: "error",
        command,
        message: `${client.fullName} has no phone number on file — can't send via WhatsApp.`,
      });
    }
    channel = "whatsapp";
  } else if (intent.channel === "email") {
    channel = "email";
  } else if (client.phone) {
    channel = "whatsapp";
  } else if (client.email) {
    channel = "email";
  } else {
    return NextResponse.json({
      status: "error",
      command,
      message: `${client.fullName} has no phone or email on file.`,
    });
  }

  // ── Step 6 — format snippet (deterministic) ──────────────────────────
  const operatorFirstName =
    friendlyConsultantName({ name: ctx.user.name, email: ctx.user.email }).split(/\s+/)[0] || null;
  const snippet = formatProposalDaysSnippet({
    days: daysResult.days,
    channel,
    clientFirstName: client.firstName?.trim() || client.fullName.split(/\s+/)[0] || "there",
    tripTitle: proposal.title,
    activeTier: (proposal.contentJson?.activeTier as TierKey) || "premier",
    operatorFirstName,
  });

  // ── Step 7 — log + return preview ────────────────────────────────────
  // Output is the channel-appropriate body — text for WhatsApp,
  // text-alternative for email so the FollowUpPanel textarea displays
  // a coherent operator-editable string. The HTML variant rides along
  // in the response for the eventual email send path; we don't store
  // it on AISuggestion.output (the textarea drives the send anyway).
  const logged = await logSuggestion({
    organizationId: orgId,
    userId: ctx.user.id,
    kind: "execution",
    targetType: "proposal",
    targetId: proposal.id,
    input: {
      command,
      intent: { ...intent, channel: intent.channel },
      resolved: {
        clientId: client.id,
        clientName: client.fullName,
        proposalId: proposal.id,
        proposalTitle: proposal.title,
        days: intent.days,
        channel,
      },
      warnings: daysResult.warnings,
    },
    output: snippet.text,
  });
  const suggestionId = logged?.id;
  if (!suggestionId) {
    // Hard fail — the dashboard needs the suggestionId to wire the
    // sentAt update. A logging miss is rare (best-effort) but blocks
    // the audit trail, so refuse rather than send blind.
    return NextResponse.json({
      status: "error",
      command,
      message: "Couldn't log the action. Try again in a moment.",
    });
  }

  // Persist channel on the row so /api/suggestions/[id]/sent and the
  // dashboard's draft surface know which channel this suggestion is
  // for. logSuggestion doesn't accept channel directly (legacy
  // shape); patch it here.
  await prisma.aISuggestion.update({
    where: { id: suggestionId },
    data: { channel },
  });

  return NextResponse.json({
    status: "ready",
    suggestionId,
    command,
    intent,
    client,
    proposal: {
      id: proposal.id,
      title: proposal.title,
      trackingId: proposal.trackingId,
      updatedAt: proposal.updatedAt,
    },
    channel,
    preview: snippet,
    warnings: daysResult.warnings,
  });
}

// Force tool_use; never accept free text. If the model returns text
// (because the command isn't parseable as a send-days request), we
// return null and the caller surfaces a clear "couldn't parse" error.
async function parseIntent(
  apiKey: string,
  command: string,
): Promise<ParsedIntent | null> {
  const client = new Anthropic({ apiKey });
  let msg: Anthropic.Messages.Message;
  try {
    msg = await client.messages.create({
      model: MODEL,
      max_tokens: 400,
      // tool_choice forces the model to emit a tool_use block; if the
      // command can't fit, the model can still return text that we
      // detect below.
      tool_choice: { type: "auto" },
      tools: TOOLS,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: command }],
    });
  } catch (err) {
    console.warn("[ai/execute] Anthropic error:", err);
    return null;
  }

  for (const block of msg.content) {
    if (block.type === "tool_use" && block.name === "send_proposal_days") {
      const input = block.input as Record<string, unknown> | null;
      if (!input) return null;
      const clientHint = typeof input.clientHint === "string" ? input.clientHint.trim() : "";
      const daysRaw = Array.isArray(input.days) ? input.days : [];
      const days = daysRaw
        .map((d) => (typeof d === "number" ? Math.floor(d) : NaN))
        .filter((n) => Number.isFinite(n) && n > 0);
      const channelRaw = typeof input.channel === "string" ? input.channel : null;
      const channel: "whatsapp" | "email" | null =
        channelRaw === "whatsapp" || channelRaw === "email" ? channelRaw : null;
      if (!clientHint || days.length === 0) return null;
      return { clientHint, days, channel };
    }
  }
  return null;
}
