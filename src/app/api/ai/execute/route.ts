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
  type LoadedProposal,
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
  /** Set when the operator picked a Client-row match from the
   *  disambiguation list. Server uses findClientById + loadLatestProposal. */
  clientId?: string;
  /** Set when the operator picked a reservation / proposal-content
   *  match — those synthesise a "client" without a Prisma Client row,
   *  so the route loads the linked proposal directly and skips the
   *  Client lookup entirely. */
  proposalId?: string;
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
  const explicitProposalId = body.proposalId?.trim();
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
    console.warn(`[execute] intent-parse failed: command="${command}"`);
    return NextResponse.json({
      status: "error",
      command,
      message:
        "I couldn't parse that as a send-days command. Try: \"send Jennifer day 2 and 3\".",
    });
  }

  // ── Step 2 — resolve target ──────────────────────────────────────────
  // Three resolution paths, in priority order:
  //   1. Operator already picked a proposal directly from a
  //      reservation/contentJson disambiguation hit → use that
  //      proposalId, build a minimal client lite from the proposal.
  //   2. Operator picked a Client-row match from disambiguation →
  //      findClientById + loadLatestProposal.
  //   3. Fresh command → findClient (which now searches Client rows
  //      AND ProposalReservations AND Proposal.contentJson).
  const orgId = ctx.organization.id;
  let client: ClientLite;
  let proposal: LoadedProposal;

  if (explicitProposalId) {
    const directProposal = await loadProposalDirect(orgId, explicitProposalId);
    if (!directProposal) {
      return NextResponse.json({
        status: "error",
        command,
        message: "That proposal isn't accessible.",
      });
    }
    proposal = directProposal.proposal;
    client = directProposal.client;
  } else if (explicitClientId) {
    const clientResult = await findClientById(orgId, explicitClientId);
    if (clientResult.status === "not-found") {
      return NextResponse.json({
        status: "error",
        command,
        message: "That client isn't accessible.",
      });
    }
    if (clientResult.status === "ambiguous") {
      // findClientById can't return ambiguous (single id) — narrow.
      return NextResponse.json({
        status: "error",
        command,
        message: "Client lookup conflict.",
      });
    }
    client = clientResult.client;

    const proposalResult = await loadLatestProposal(orgId, client.id);
    if (proposalResult.status === "not-found") {
      return NextResponse.json({
        status: "error",
        command,
        message: `${client.fullName} has no proposals on file yet. Create one before sending day snippets.`,
      });
    }
    proposal = proposalResult.proposal;
  } else {
    const fresh = await findClient(orgId, intent.clientHint);
    console.log(
      `[execute] resolution · hint="${intent.clientHint}" · status=${fresh.status} · ` +
        (fresh.status === "found"
          ? `client=${fresh.client.fullName} (source=${fresh.client.source})`
          : fresh.status === "ambiguous"
            ? `matches=${fresh.matches.length}`
            : "no-match"),
    );
    if (fresh.status === "not-found") {
      return NextResponse.json({
        status: "error",
        command,
        message: `No client matches "${intent.clientHint}". Try a different name, the email, or part of the booking.`,
      });
    }
    if (fresh.status === "ambiguous") {
      return NextResponse.json({
        status: "needs_disambiguation",
        command,
        intent,
        matches: fresh.matches,
      });
    }
    client = fresh.client;

    // Source-aware proposal load. Reservation/contentJson hits carry
    // a direct resolvedProposalId; Client-row hits need
    // loadLatestProposal because the Client may have multiple
    // proposals.
    if (client.resolvedProposalId) {
      const directProposal = await loadProposalDirect(orgId, client.resolvedProposalId);
      if (!directProposal) {
        return NextResponse.json({
          status: "error",
          command,
          message: `Couldn't load the proposal linked to ${client.fullName}.`,
        });
      }
      proposal = directProposal.proposal;
      // Keep the client lite returned from findClient — its source
      // tag and contact info beat the synthesised one.
    } else {
      const proposalResult = await loadLatestProposal(orgId, client.id);
      if (proposalResult.status === "not-found") {
        return NextResponse.json({
          status: "error",
          command,
          message: `${client.fullName} has no proposals on file yet. Create one before sending day snippets.`,
        });
      }
      proposal = proposalResult.proposal;
    }
  }

  // ── Step 4 — extract requested days ──────────────────────────────────
  const daysResult = extractDays(proposal, intent.days);
  if (daysResult.status === "missing-days") {
    if (daysResult.available === 0) {
      // The proposal exists but has no day-by-day itinerary. This is
      // a real state — proposals created from a request without a
      // duration can land here. Surface it specifically so the
      // operator opens the proposal and adds days, rather than
      // assuming the system is broken.
      return NextResponse.json({
        status: "error",
        command,
        message: `${client.fullName}'s proposal "${proposal.title}" has no day-by-day itinerary yet. Open the proposal and add days first.`,
      });
    }
    return NextResponse.json({
      status: "error",
      command,
      message: `Day ${daysResult.missing.join(", ")} ${
        daysResult.missing.length === 1 ? "doesn't exist" : "don't exist"
      } on ${client.fullName}'s proposal "${proposal.title}" (${daysResult.available} ${
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

// Force tool_use. The model MUST emit a send_proposal_days tool call;
// it cannot wriggle out by returning free text. If the command genuinely
// can't be expressed as send-days, the tool call will arrive with empty
// days or empty clientHint and the downstream validation here returns
// null. The caller's "couldn't parse" error then fires.
//
// Note on tool_choice: the SDK's typed `tool_choice` overload supports
// { type: "tool", name } to mandate a specific tool. This is the
// production lever for "the AI must always parse, never editorialise".
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
      tool_choice: { type: "tool", name: "send_proposal_days" },
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
      console.log(
        `[execute] parsed intent · clientHint="${clientHint}" · days=[${days.join(",")}] · channel=${channel ?? "(unset)"}`,
      );
      if (!clientHint || days.length === 0) return null;
      return { clientHint, days, channel };
    }
  }
  return null;
}

// Direct proposal loader for reservation / proposal-content matches —
// or for any disambiguation pick that pre-resolved the target proposal.
// Synthesises a ClientLite from whichever source has the most info
// (linked Client > ProposalReservation > contentJson.client). Returns
// null when the proposal isn't accessible (wrong org, deleted, etc.).
async function loadProposalDirect(
  organizationId: string,
  proposalId: string,
): Promise<{ proposal: LoadedProposal; client: ClientLite } | null> {
  const row = await prisma.proposal.findFirst({
    where: { id: proposalId, organizationId },
    select: {
      id: true,
      title: true,
      trackingId: true,
      contentJson: true,
      updatedAt: true,
      client: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
      // Note the relation name: Proposal has both `reservations`
      // (legacy Reservation model, no firstName/lastName) AND
      // `proposalReservations` (current ProposalReservation model
      // populated by the share-view booking form). We need the latter.
      proposalReservations: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
    },
  });
  if (!row) return null;

  const proposal: LoadedProposal = {
    id: row.id,
    title: row.title ?? "Untitled proposal",
    trackingId: row.trackingId ?? null,
    contentJson: row.contentJson as unknown as LoadedProposal["contentJson"],
    updatedAt: row.updatedAt.toISOString(),
  };

  // Build the ClientLite from the most-informative source available.
  const linkedClient = row.client;
  const lastReservation = row.proposalReservations[0];
  const guestNames =
    typeof (row.contentJson as Record<string, unknown> | null)?.client === "object"
      ? ((row.contentJson as { client?: { guestNames?: unknown } }).client?.guestNames as string | undefined) ?? null
      : null;

  let firstName: string | null = null;
  let lastName: string | null = null;
  let email = "";
  let phone: string | null = null;
  let source: ClientLite["source"] = "client";

  if (linkedClient) {
    firstName = linkedClient.firstName;
    lastName = linkedClient.lastName;
    email = linkedClient.email;
    phone = linkedClient.phone;
    source = "client";
  } else if (lastReservation) {
    firstName = lastReservation.firstName;
    lastName = lastReservation.lastName;
    email = lastReservation.email;
    phone = lastReservation.phone;
    source = "reservation";
  } else if (guestNames) {
    const [f, ...rest] = guestNames.split(/\s+/);
    firstName = f || null;
    lastName = rest.join(" ").trim() || null;
    source = "proposal-content";
  }
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim() || guestNames || email || "Unknown";

  const client: ClientLite = {
    id: linkedClient?.id ?? `proposal:${row.id}`,
    firstName,
    lastName,
    email,
    phone,
    fullName,
    latestProposalTitle: proposal.title,
    latestProposalUpdatedAt: proposal.updatedAt,
    resolvedProposalId: row.id,
    source,
  };
  return { proposal, client };
}

