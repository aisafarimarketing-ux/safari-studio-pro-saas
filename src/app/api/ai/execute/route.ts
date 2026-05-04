import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { logSuggestion } from "@/lib/aiLog";
import {
  derivePricingContext,
  extractDays,
  findClient,
  findClientById,
  loadLatestProposal,
  type ClientLite,
  type LoadedProposal,
} from "@/lib/executionTools";
import {
  formatPreviewSnippet,
  formatPricingSnippet,
  formatProposalDaysSnippet,
} from "@/lib/executionFormat";
import {
  PREVIEW_ITINERARY_IDS,
  getPreviewItinerary,
  type PreviewItineraryId,
} from "@/lib/previewItineraries";
import { friendlyConsultantName } from "@/lib/consultantIdentity";
import type { PricingData, TierKey } from "@/lib/types";

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

The operator types a command; you choose ONE tool and call it with parsed parameters. You never generate client-visible content. You never call any tool outside the available list.

Available tools:

1. send_proposal_days
   For commands referencing specific days of a client's existing proposal.
   - "send Jennifer day 2 and 3" → { clientHint: "Jennifer", days: [2, 3] }
   - "send Jennifer days 2 to 4" → { clientHint: "Jennifer", days: [2, 3, 4] }
   - "share day 5 with the Mara family" → { clientHint: "Mara family", days: [5] }
   - "send Collins first two days via email" → { clientHint: "Collins", days: [1, 2], channel: "email" }

2. send_preview_itinerary
   For early-stage commands that share a sample / typical / preview itinerary — when the client doesn't have a proposal yet.
   - "send a typical 5 day safari to Jennifer" → { clientHint: "Jennifer", itineraryType: "5-day-safari" }
   - "share a sample 3 day safari with Lilian" → { clientHint: "Lilian", itineraryType: "3-day-safari" }
   - "send a honeymoon safari preview to Mara" → { clientHint: "Mara", itineraryType: "honeymoon-safari" }
   - "share the 7 day safari with Collins" → { clientHint: "Collins", itineraryType: "7-day-safari" }
   itineraryType values: "3-day-safari", "5-day-safari", "7-day-safari", "honeymoon-safari".

3. send_pricing_summary
   For commands that share a structured pricing breakdown of a client's existing proposal.
   - "send pricing to Lilian" → { clientHint: "Lilian" }
   - "whatsapp Jennifer pricing" → { clientHint: "Jennifer", channel: "whatsapp" }
   - "share cost breakdown with Collins" → { clientHint: "Collins" }
   - "email the price breakdown to Mara" → { clientHint: "Mara", channel: "email" }
   - "send Jennifer the cost summary" → { clientHint: "Jennifer" }
   Trigger words: "pricing", "price", "cost", "breakdown", "cost summary".

Rules:
- Always pass the client reference verbatim into clientHint. Server-side resolution handles matching.
- send_proposal_days: days are 1-indexed integers.
- send_preview_itinerary: pick the itineraryType that best matches the operator's wording. When the operator says "5 day safari", pick "5-day-safari". When they say "honeymoon" anywhere, pick "honeymoon-safari".
- Pick send_proposal_days when the operator names specific day numbers AND the wording suggests an existing proposal.
- Pick send_preview_itinerary when the wording is "typical", "sample", "preview", "what does ... look like", or when the duration is given without specific day numbers.
- Pick send_pricing_summary when the operator asks to send pricing / cost / price breakdown without naming day numbers. If they ask for both pricing AND specific days, prefer send_proposal_days — the operator can run the pricing command separately afterwards.
- Omit channel unless the operator explicitly mentioned WhatsApp or email — server picks the operator's preferred channel otherwise.
- If the command fits no tool, do NOT call any. Return text explaining what was unclear.`;

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
  {
    name: "send_preview_itinerary",
    description:
      "Send a canonical preview itinerary (3-day, 5-day, 7-day, honeymoon) to a client when they don't yet have a proposal. Used for early-stage exploration commands.",
    input_schema: {
      type: "object",
      properties: {
        clientHint: {
          type: "string",
          description:
            "How the operator referred to the client. Pass through verbatim.",
        },
        itineraryType: {
          type: "string",
          enum: PREVIEW_ITINERARY_IDS as unknown as string[],
          description:
            "Which canonical itinerary to send. 3-day-safari, 5-day-safari, 7-day-safari, or honeymoon-safari.",
        },
        channel: {
          type: "string",
          enum: ["whatsapp", "email"],
          description:
            "Channel the operator explicitly mentioned. Omit if not specified.",
        },
      },
      required: ["clientHint", "itineraryType"],
    },
  },
  {
    name: "send_pricing_summary",
    description:
      "Send a structured pricing breakdown (per-person price, what's included, what's not, notes) for a client's existing proposal via WhatsApp or email.",
    input_schema: {
      type: "object",
      properties: {
        clientHint: {
          type: "string",
          description:
            "How the operator referred to the client. Pass through verbatim.",
        },
        channel: {
          type: "string",
          enum: ["whatsapp", "email"],
          description:
            "Channel the operator explicitly mentioned. Omit if not specified.",
        },
      },
      required: ["clientHint"],
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
      /** Set when the ready response is for a preview-itinerary
       *  send. The dashboard uses this to swap the FollowUpPanel
       *  header eyebrow ("Safari Studio AI · Preview" vs
       *  "...Follow-up") and the context strip. */
      previewItineraryLabel?: string;
      /** Set when the ready response is a pricing-summary send.
       *  Drives the same FollowUpPanel header swap — eyebrow +
       *  context strip — without needing the dashboard to inspect
       *  intent.kind directly. */
      pricingSummary?: boolean;
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

type ParsedIntent =
  | {
      kind: "send_proposal_days";
      clientHint: string;
      days: number[];
      channel: "whatsapp" | "email" | null;
    }
  | {
      kind: "send_preview_itinerary";
      clientHint: string;
      itineraryType: PreviewItineraryId;
      channel: "whatsapp" | "email" | null;
    }
  | {
      kind: "send_pricing_summary";
      clientHint: string;
      channel: "whatsapp" | "email" | null;
    };

export async function POST(req: Request): Promise<NextResponse<ExecuteResponse>> {
  // Top-level guard: any unhandled exception in the body below is
  // caught here and returned as JSON 500 with the error message
  // surfaced to the dashboard. Without this, a thrown error bubbles
  // up and Railway/Next responds with a bare 503 the operator can't
  // act on. The console.error path also writes the full stack to
  // the Railway logs so we can diagnose post-hoc.
  try {
    return await runExecute(req);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[ai/execute] UNHANDLED:", err);
    return NextResponse.json(
      { status: "error", command: "", message: `Server error: ${message}` },
      { status: 500 },
    );
  }
}

async function runExecute(req: Request): Promise<NextResponse<ExecuteResponse>> {
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

  console.log(
    `[execute] start · org=${ctx.organization.id} · user=${ctx.user.id} · command="${command}" · ` +
      `explicit=${explicitProposalId ? `proposal:${explicitProposalId}` : explicitClientId ? `client:${explicitClientId}` : "(none)"}`,
  );

  // ── Step 1 — parse the command via Anthropic tool-use ────────────────
  const intent = await parseIntent(apiKey, command);
  if (!intent) {
    console.warn(`[execute] intent-parse failed: command="${command}"`);
    return NextResponse.json({
      status: "error",
      command,
      message:
        "I couldn't parse that. Try: \"send Jennifer day 2 and 3\" or \"send a 5 day safari to Jennifer\".",
    });
  }

  // ── Step 2 — resolve client ──────────────────────────────────────────
  // Same three resolution paths regardless of intent kind:
  //   1. explicitProposalId (only used by send_proposal_days flow when
  //      the operator picked a reservation / contentJson match from
  //      the disambiguation list).
  //   2. explicitClientId (Client-row pick from disambiguation).
  //   3. Fresh hint → findClient (Client rows + reservations + proposal
  //      contentJson).
  const orgId = ctx.organization.id;
  let client: ClientLite;
  let proposalForDays: LoadedProposal | null = null;

  if (
    explicitProposalId &&
    (intent.kind === "send_proposal_days" || intent.kind === "send_pricing_summary")
  ) {
    const directProposal = await loadProposalDirect(orgId, explicitProposalId);
    if (!directProposal) {
      return NextResponse.json({
        status: "error",
        command,
        message: "That proposal isn't accessible.",
      });
    }
    proposalForDays = directProposal.proposal;
    client = directProposal.client;
  } else if (explicitClientId) {
    const clientResult = await findClientById(orgId, explicitClientId);
    if (clientResult.status !== "found") {
      return NextResponse.json({
        status: "error",
        command,
        message: "That client isn't accessible.",
      });
    }
    client = clientResult.client;
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
  }

  // ── Step 3 — branch on intent kind ───────────────────────────────────
  const channel = pickChannel(intent.channel, client);
  if (channel === "no-phone") {
    return NextResponse.json({
      status: "error",
      command,
      message: `${client.fullName} has no phone number on file — can't send via WhatsApp.`,
    });
  }
  if (channel === "no-contact") {
    return NextResponse.json({
      status: "error",
      command,
      message: `${client.fullName} has no phone or email on file.`,
    });
  }

  const operatorFirstName =
    friendlyConsultantName({ name: ctx.user.name, email: ctx.user.email }).split(/\s+/)[0] || null;
  const clientFirstName =
    client.firstName?.trim() || client.fullName.split(/\s+/)[0] || "there";

  // ─── PREVIEW-ITINERARY branch ────────────────────────────────────────
  if (intent.kind === "send_preview_itinerary") {
    const itinerary = getPreviewItinerary(intent.itineraryType);
    if (!itinerary) {
      return NextResponse.json({
        status: "error",
        command,
        message: `Unknown itinerary type "${intent.itineraryType}".`,
      });
    }
    const snippet = formatPreviewSnippet({
      days: itinerary.days,
      channel,
      itineraryPhrase: itinerary.phrase,
      itineraryLabel: itinerary.label,
      clientFirstName,
      operatorFirstName,
    });

    const logged = await logSuggestion({
      organizationId: orgId,
      userId: ctx.user.id,
      kind: "preview-itinerary",
      // No proposal context for previews — target the canonical itinerary
      // itself so the audit row remains queryable.
      targetType: "preview",
      targetId: itinerary.id,
      input: {
        command,
        intent: { ...intent },
        resolved: {
          clientId: client.id,
          clientName: client.fullName,
          itineraryType: itinerary.id,
          itineraryLabel: itinerary.label,
          channel,
        },
      },
      output: snippet.text,
    });
    const suggestionId = logged?.id;
    if (!suggestionId) {
      return NextResponse.json({
        status: "error",
        command,
        message: "Couldn't log the action. Try again in a moment.",
      });
    }
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
        // Synthetic proposal payload — preview previews don't have a
        // real Proposal row. The dashboard's FollowUpPanel skips
        // proposalId-dependent code paths in prefilled mode, so
        // populating with the itinerary id keeps the response shape
        // stable.
        id: itinerary.id,
        title: `${itinerary.label} preview`,
        trackingId: null,
        updatedAt: new Date().toISOString(),
      },
      channel,
      preview: snippet,
      warnings: [],
      previewItineraryLabel: itinerary.label,
    });
  }

  // ─── SEND_PRICING_SUMMARY branch ─────────────────────────────────────
  // Same proposal-load pattern as send_proposal_days, then the pricing
  // formatter renders the breakdown deterministically. No content is
  // ever LLM-generated — only the operator's own pricing data, formatted.
  if (intent.kind === "send_pricing_summary") {
    let proposalForPricing = proposalForDays;
    if (!proposalForPricing) {
      if (client.resolvedProposalId) {
        const directProposal = await loadProposalDirect(orgId, client.resolvedProposalId);
        if (!directProposal) {
          return NextResponse.json({
            status: "error",
            command,
            message: `Couldn't load the proposal linked to ${client.fullName}.`,
          });
        }
        proposalForPricing = directProposal.proposal;
      } else {
        const proposalResult = await loadLatestProposal(orgId, client.id);
        if (proposalResult.status === "not-found") {
          return NextResponse.json({
            status: "error",
            command,
            message: `${client.fullName} has no proposals on file yet. Create one before sending a pricing summary.`,
          });
        }
        proposalForPricing = proposalResult.proposal;
      }
    }
    const proposal = proposalForPricing;
    const content = proposal.contentJson;
    const pricing = (content?.pricing ?? null) as PricingData | null;
    if (!pricing) {
      return NextResponse.json({
        status: "error",
        command,
        message: `${client.fullName}'s proposal "${proposal.title}" has no pricing set yet. Open the proposal and add pricing first.`,
      });
    }
    const activeTier = (content?.activeTier as TierKey) || "premier";
    const headlineTier = pricing[activeTier];
    if (!headlineTier?.pricePerPerson?.trim()) {
      return NextResponse.json({
        status: "error",
        command,
        message: `${client.fullName}'s proposal "${proposal.title}" has no per-person price set on the active tier.`,
      });
    }
    const inclusions = Array.isArray(content?.inclusions) ? content.inclusions : [];
    const exclusions = Array.isArray(content?.exclusions) ? content.exclusions : [];
    // Adults drives the total computation (per-person × adults).
    // contentJson.client.adults is `number | undefined`; treat anything
    // non-numeric or non-positive as "unknown" — formatter falls back
    // to a per-person-only headline.
    const adults =
      typeof content?.client?.adults === "number" && content.client.adults > 0
        ? content.client.adults
        : null;
    const nights =
      typeof content?.trip?.nights === "number" && content.trip.nights > 0
        ? content.trip.nights
        : null;

    // Derive the reassurance context from the proposal's share-view
    // behaviour. Best-effort — a query failure here can't hold up
    // the send; the formatter falls back to the "comparison" copy
    // when context is null.
    let context: Awaited<ReturnType<typeof derivePricingContext>> = null;
    try {
      context = await derivePricingContext(orgId, proposal.id);
    } catch (err) {
      console.warn("[execute] derivePricingContext failed:", err);
    }

    const snippet = formatPricingSnippet({
      channel,
      clientFirstName,
      tripTitle: proposal.title,
      pricing,
      activeTier,
      inclusions,
      exclusions,
      adults,
      nights,
      context,
      operatorFirstName,
    });

    const logged = await logSuggestion({
      organizationId: orgId,
      userId: ctx.user.id,
      // Same kind as day-snippet sends so the dashboard's
      // "lastSentByProposal" guard + the booking-credit query both
      // see pricing dispatches without code changes. The intent
      // discriminator inside `input` distinguishes the two when a
      // future surface needs to.
      kind: "execution",
      targetType: "proposal",
      targetId: proposal.id,
      input: {
        command,
        intent: { ...intent },
        resolved: {
          clientId: client.id,
          clientName: client.fullName,
          proposalId: proposal.id,
          proposalTitle: proposal.title,
          activeTier,
          channel,
        },
        warnings: [],
      },
      output: snippet.text,
    });
    const suggestionId = logged?.id;
    if (!suggestionId) {
      return NextResponse.json({
        status: "error",
        command,
        message: "Couldn't log the action. Try again in a moment.",
      });
    }
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
      warnings: [],
      pricingSummary: true,
    });
  }

  // ─── SEND_PROPOSAL_DAYS branch ───────────────────────────────────────
  // Source-aware proposal load when we don't already have one from
  // the explicit-proposal path above.
  if (!proposalForDays) {
    if (client.resolvedProposalId) {
      const directProposal = await loadProposalDirect(orgId, client.resolvedProposalId);
      if (!directProposal) {
        return NextResponse.json({
          status: "error",
          command,
          message: `Couldn't load the proposal linked to ${client.fullName}.`,
        });
      }
      proposalForDays = directProposal.proposal;
    } else {
      const proposalResult = await loadLatestProposal(orgId, client.id);
      if (proposalResult.status === "not-found") {
        return NextResponse.json({
          status: "error",
          command,
          message: `${client.fullName} has no proposals on file yet. Create one before sending day snippets.`,
        });
      }
      proposalForDays = proposalResult.proposal;
    }
  }
  const proposal = proposalForDays;

  const daysResult = extractDays(proposal, intent.days);
  if (daysResult.status === "missing-days") {
    if (daysResult.available === 0) {
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

  const snippet = formatProposalDaysSnippet({
    days: daysResult.days,
    channel,
    clientFirstName,
    tripTitle: proposal.title,
    activeTier: (proposal.contentJson?.activeTier as TierKey) || "premier",
    operatorFirstName,
  });

  const logged = await logSuggestion({
    organizationId: orgId,
    userId: ctx.user.id,
    kind: "execution",
    targetType: "proposal",
    targetId: proposal.id,
    input: {
      command,
      intent: { ...intent },
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

// Channel selection — explicit intent wins; otherwise WhatsApp
// preferred (phone exists), email fallback. Returns sentinel strings
// for the two error cases so the route can fire specific messages.
function pickChannel(
  intentChannel: "whatsapp" | "email" | null,
  client: ClientLite,
): "whatsapp" | "email" | "no-phone" | "no-contact" {
  if (intentChannel === "whatsapp") {
    return client.phone ? "whatsapp" : "no-phone";
  }
  if (intentChannel === "email") return "email";
  if (client.phone) return "whatsapp";
  if (client.email) return "email";
  return "no-contact";
}

// Force tool_use. The model MUST emit one of the available tool
// calls; it cannot wriggle out by returning free text. tool_choice
// "any" means the model picks between send_proposal_days and
// send_preview_itinerary based on the command shape. If the command
// genuinely can't be expressed as either, the call arrives with
// empty clientHint / days / itineraryType and downstream validation
// returns null — the caller's "couldn't parse" error then fires.
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
      tool_choice: { type: "any" },
      tools: TOOLS,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: command }],
    });
  } catch (err) {
    console.warn("[ai/execute] Anthropic error:", err);
    return null;
  }

  for (const block of msg.content) {
    if (block.type !== "tool_use") continue;
    const input = block.input as Record<string, unknown> | null;
    if (!input) continue;
    const clientHint =
      typeof input.clientHint === "string" ? input.clientHint.trim() : "";
    if (!clientHint) continue;
    const channelRaw = typeof input.channel === "string" ? input.channel : null;
    const channel: "whatsapp" | "email" | null =
      channelRaw === "whatsapp" || channelRaw === "email" ? channelRaw : null;

    if (block.name === "send_proposal_days") {
      const daysRaw = Array.isArray(input.days) ? input.days : [];
      const days = daysRaw
        .map((d) => (typeof d === "number" ? Math.floor(d) : NaN))
        .filter((n) => Number.isFinite(n) && n > 0);
      console.log(
        `[execute] parsed intent · kind=send_proposal_days · clientHint="${clientHint}" · days=[${days.join(",")}] · channel=${channel ?? "(unset)"}`,
      );
      if (days.length === 0) return null;
      return { kind: "send_proposal_days", clientHint, days, channel };
    }

    if (block.name === "send_preview_itinerary") {
      const itineraryRaw =
        typeof input.itineraryType === "string" ? input.itineraryType : "";
      if (!(PREVIEW_ITINERARY_IDS as string[]).includes(itineraryRaw)) {
        console.warn(
          `[execute] preview-itinerary tool call had unknown itineraryType: "${itineraryRaw}"`,
        );
        return null;
      }
      const itineraryType = itineraryRaw as PreviewItineraryId;
      console.log(
        `[execute] parsed intent · kind=send_preview_itinerary · clientHint="${clientHint}" · itineraryType=${itineraryType} · channel=${channel ?? "(unset)"}`,
      );
      return { kind: "send_preview_itinerary", clientHint, itineraryType, channel };
    }

    if (block.name === "send_pricing_summary") {
      console.log(
        `[execute] parsed intent · kind=send_pricing_summary · clientHint="${clientHint}" · channel=${channel ?? "(unset)"}`,
      );
      return { kind: "send_pricing_summary", clientHint, channel };
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

