import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { buildBrandDNAPromptSection } from "@/lib/brandDNAPrompt";
import { logSuggestion } from "@/lib/aiLog";

// POST /api/ai/follow-up
//
// Generates a draft follow-up message the operator can review and send
// manually. Reads the proposal's engagement signals (last event, view
// count, reservation flow markers) plus Brand DNA so the draft sounds
// native and references what the client actually did.
//
// Scope: caller must be authenticated to an org and must own the
// proposal (proposal.userId === ctx.user.id) OR be an owner / admin.
// Plain members can't generate follow-ups for other consultants'
// pipelines.
//
// Body: { proposalId: string, channel?: "whatsapp" | "email", instructions?: string }
// Returns: { draft: string, channel: "whatsapp" | "email", suggestionId?: string }

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

const SYSTEM_RULES = `You are drafting a single follow-up message from a safari operator to a prospective client. The message will be reviewed by the operator before sending — never address the operator, never explain what you're doing, just write the message.

Style — non-negotiable:
- Short. Two paragraphs maximum. Three for genuinely complex situations.
- No marketing fluff. Bans: "stunning", "amazing", "incredible", "unforgettable", "magical", "luxe", "iconic", "ultimate", "discover", "embark on", "memories to last a lifetime", exclamation marks, rhetorical questions.
- Reference what the client actually did (viewed pricing, reopened the proposal, etc.) when the signal is concrete. Skip the signal entirely if it's noisy or stale (>2 weeks).
- One specific next step at the end — a question they can answer in one line, or a small commitment ("would Tuesday work for a 10-min call?").
- WhatsApp: drop the "Dear / Hi" formality, lead with the first name, casual tone but still operator-precise.
- Email: subject line first, then a blank line, then the body. Subject line must be concrete (no "Following up" or "Just checking in").

Return ONLY the message body (or "Subject: …\\n\\nbody" for email). No preamble, no markdown, no quotes around the output.`;

type Channel = "whatsapp" | "email";

type Body = {
  proposalId?: string;
  channel?: Channel;
  /** Optional operator-supplied direction for the draft. */
  instructions?: string;
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
  const proposalId = body.proposalId?.trim();
  if (!proposalId) {
    return NextResponse.json({ error: "proposalId required" }, { status: 400 });
  }
  const channel: Channel = body.channel === "email" ? "email" : "whatsapp";
  const instructions = body.instructions?.trim().slice(0, 800) || "";

  // Pull the proposal + activity summary + linked client + consultant in
  // one round trip. Best-effort on the summary — proposals without an
  // active summary fall through to "no engagement signals" copy.
  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    select: {
      id: true,
      organizationId: true,
      userId: true,
      title: true,
      trackingId: true,
      contentJson: true,
      user: { select: { id: true, name: true, email: true } },
      client: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
      activitySummary: {
        select: {
          lastEventAt: true,
          lastEventType: true,
          viewedCount: true,
          itineraryClicked: true,
          priceViewed: true,
          clickedReservation: true,
          reservationCompleted: true,
          engagementScore: true,
          status: true,
          nextAction: true,
        },
      },
    },
  });

  if (!proposal || proposal.organizationId !== ctx.organization.id) {
    return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  }
  const isOwnerOrAdmin = ctx.role === "owner" || ctx.role === "admin";
  const isAssignee = proposal.userId === ctx.user.id;
  if (!isOwnerOrAdmin && !isAssignee) {
    return NextResponse.json({ error: "Not authorised for this proposal" }, { status: 403 });
  }

  // Pull Brand DNA (best-effort).
  let brandDNASection = "";
  try {
    const profile = await prisma.brandDNAProfile.findUnique({
      where: { organizationId: ctx.organization.id },
    });
    brandDNASection = buildBrandDNAPromptSection(profile);
  } catch (err) {
    console.warn("[AI/follow-up] Brand DNA load failed:", err);
  }

  const clientFirstName =
    proposal.client?.firstName?.trim() ||
    extractClientNameFromContent(proposal.contentJson) ||
    "there";
  const consultantName = proposal.user?.name?.trim() || null;
  const tripTitle = proposal.title?.trim() || "the proposal";
  const summary = proposal.activitySummary;
  const signalLines = formatSignals(summary);
  const channelLabel = channel === "email" ? "Email" : "WhatsApp";

  const userPrompt = [
    `Channel: ${channelLabel}`,
    `Client first name: ${clientFirstName}`,
    consultantName ? `Operator's name (sender): ${consultantName}` : "",
    `Trip title: ${tripTitle}`,
    "",
    "Engagement signals (use only what's actually relevant; older or weak signals can be ignored):",
    signalLines || "- No tracked engagement yet.",
    summary?.nextAction
      ? `\nThe dashboard's static next-action recommendation is: "${summary.nextAction}". Use this as a hint for what the operator wants to push toward, not as copy to repeat.`
      : "",
    instructions ? `\nOperator's direction for this specific draft:\n${instructions}` : "",
    "",
    "Draft the follow-up now.",
  ]
    .filter(Boolean)
    .join("\n");

  const client = new Anthropic({ apiKey });

  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 700,
      system: [
        {
          type: "text",
          text: SYSTEM_RULES + brandDNASection,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userPrompt }],
    });
    const draft = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    // Log the suggestion for the audit trail. Best-effort — never blocks.
    const logged = await logSuggestion({
      organizationId: ctx.organization.id,
      userId: ctx.user.id,
      kind: "follow-up",
      targetType: "proposal",
      targetId: proposal.id,
      input: {
        channel,
        clientFirstName,
        signals: summary
          ? {
              lastEventType: summary.lastEventType,
              lastEventAt: summary.lastEventAt?.toISOString() ?? null,
              viewedCount: summary.viewedCount,
              itineraryClicked: summary.itineraryClicked,
              priceViewed: summary.priceViewed,
              clickedReservation: summary.clickedReservation,
              reservationCompleted: summary.reservationCompleted,
              engagementScore: summary.engagementScore,
              status: summary.status,
              nextAction: summary.nextAction,
            }
          : null,
        instructions: instructions || null,
      },
      output: draft,
    });

    return NextResponse.json({
      draft,
      channel,
      suggestionId: logged?.id ?? null,
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
      console.error("[AI/follow-up] Anthropic error:", err.status, err.message);
      return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error("[AI/follow-up] Unexpected error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Best-effort extraction of a client first name from the proposal's
// contentJson blob — the contentJson.client.guestNames slot can carry
// "Jennifer & Collins" or just one name. Used as a fallback when no
// linked Client row exists.
function extractClientNameFromContent(content: unknown): string | null {
  if (!content || typeof content !== "object") return null;
  const obj = content as Record<string, unknown>;
  const c = obj.client as Record<string, unknown> | undefined;
  const names = typeof c?.guestNames === "string" ? c.guestNames : "";
  if (!names) return null;
  const first = names.split(/[,&]/)[0]?.trim().split(/\s+/)[0] || "";
  return first || null;
}

type Summary = {
  lastEventAt: Date | null;
  lastEventType: string | null;
  viewedCount: number;
  itineraryClicked: boolean;
  priceViewed: boolean;
  clickedReservation: boolean;
  reservationCompleted: boolean;
  engagementScore: number;
  status: string;
  nextAction: string;
};

function formatSignals(summary: Summary | null | undefined): string {
  if (!summary) return "";
  const lines: string[] = [];
  if (summary.viewedCount > 0) {
    lines.push(`- Opened the proposal ${summary.viewedCount} time${summary.viewedCount === 1 ? "" : "s"}.`);
  }
  if (summary.priceViewed) lines.push("- Spent time on the pricing section.");
  if (summary.itineraryClicked) lines.push("- Tapped through the day-by-day itinerary.");
  if (summary.clickedReservation) lines.push("- Opened the reservation form but didn't submit.");
  if (summary.reservationCompleted) {
    lines.push("- Already submitted a reservation — this follow-up is post-booking.");
  }
  if (summary.lastEventAt) {
    const ageMs = Date.now() - summary.lastEventAt.getTime();
    const days = Math.floor(ageMs / 86_400_000);
    const hours = Math.floor(ageMs / 3_600_000);
    if (days >= 1) lines.push(`- Last activity: ${days} day${days === 1 ? "" : "s"} ago (${summary.lastEventType ?? "unknown event"}).`);
    else if (hours >= 1) lines.push(`- Last activity: ${hours} hour${hours === 1 ? "" : "s"} ago (${summary.lastEventType ?? "unknown event"}).`);
    else lines.push(`- Last activity: under an hour ago (${summary.lastEventType ?? "unknown event"}).`);
  }
  lines.push(`- Engagement score: ${summary.engagementScore} (status: ${summary.status}).`);
  return lines.join("\n");
}
