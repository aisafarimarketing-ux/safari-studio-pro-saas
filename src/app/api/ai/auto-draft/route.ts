import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { buildBrandDNAPromptSection } from "@/lib/brandDNAPrompt";
import { classifyMomentum } from "@/lib/dealMomentum";

// POST /api/ai/auto-draft
//
// The Deal Momentum System's draft cache. Returns the most recent
// follow-up draft for { proposalId, channel } if one was generated in
// the last 6 hours and hasn't been sent yet — otherwise generates a
// fresh one, logs it, and returns that. Idempotent enough to be
// called eagerly on dashboard load (pre-warming) and again at click
// time (the panel re-fetches in case anything updated).
//
// Body: { proposalId: string, channel?: "whatsapp" | "email", instructions?: string, force?: boolean }
// Returns: { draft, channel, suggestionId, momentum, suggestedAction, cached: boolean }
//
// Auth: same as /api/ai/follow-up — owner/admin OR the consultant
// who owns the proposal.

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
const CACHE_WINDOW_MS = 6 * 60 * 60 * 1000;

const SYSTEM_RULES = `You are drafting a single follow-up message from a safari operator to a prospective client. The message will be reviewed by the operator before sending — never address the operator, never explain what you're doing, just write the message.

Style — non-negotiable:
- Short. 3 to 6 lines.
- Personal: use the client's first name, the destination(s), the dates.
- Confident, not pushy. Move the client forward with one clear next step.
- No marketing fluff. Bans: "stunning", "amazing", "incredible", "unforgettable", "magical", "luxe", "iconic", "ultimate", "discover", "embark on", exclamation marks, rhetorical questions.
- WhatsApp: drop the "Dear / Hi" formality, lead with the first name, casual but operator-precise.
- Email: subject line first, then a blank line, then the body. Subject must be concrete (no "Following up" or "Just checking in").

If the suggested action is ASK_QUESTION (rather than SEND_NOW), the message should ask the client a question instead of pushing them to book — clarify a detail, surface a concern, offer a quick call.

Return ONLY the message body (or "Subject: …\\n\\nbody" for email). No preamble, no markdown, no quotes around the output.`;

type Channel = "whatsapp" | "email";

type Body = {
  proposalId?: string;
  channel?: Channel;
  instructions?: string;
  /** Force a fresh generation even if a cached draft is still valid. */
  force?: boolean;
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
  const force = Boolean(body.force);
  const instructions = body.instructions?.trim().slice(0, 800) || "";

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
        select: { firstName: true, lastName: true, email: true, phone: true },
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

  const summary = proposal.activitySummary;
  // Compute lastOperatorMessageAt from the most recent SENT suggestion
  // for this proposal+channel. Used both by the momentum classifier and
  // the cache check so we never re-pitch a client we just messaged.
  const lastSent = await prisma.aISuggestion.findFirst({
    where: {
      organizationId: ctx.organization.id,
      kind: "follow-up",
      targetType: "proposal",
      targetId: proposal.id,
      sentAt: { not: null },
    },
    orderBy: { sentAt: "desc" },
    select: { sentAt: true, channel: true },
  });
  const momentum = classifyMomentum({
    lastEventAt: summary?.lastEventAt ?? null,
    lastEventType: summary?.lastEventType ?? null,
    lastOperatorMessageAt: lastSent?.sentAt ?? null,
    reservationCompleted: summary?.reservationCompleted ?? false,
    priceViewed: summary?.priceViewed ?? false,
    clickedReservation: summary?.clickedReservation ?? false,
  });

  // Cache check — return the latest unsent draft for this {proposal,
  // channel} when it's still fresh and the caller didn't force.
  if (!force && !instructions) {
    const cached = await prisma.aISuggestion.findFirst({
      where: {
        organizationId: ctx.organization.id,
        kind: "follow-up",
        targetType: "proposal",
        targetId: proposal.id,
        channel,
        sentAt: null,
        createdAt: { gt: new Date(Date.now() - CACHE_WINDOW_MS) },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, output: true, channel: true, createdAt: true },
    });
    if (cached) {
      return NextResponse.json({
        draft: cached.output,
        channel: cached.channel ?? channel,
        suggestionId: cached.id,
        momentum: momentum.momentum,
        suggestedAction: momentum.suggestedAction,
        momentumReason: momentum.reason,
        cached: true,
      });
    }
  }

  // Brand DNA — best-effort.
  let brandDNASection = "";
  try {
    const profile = await prisma.brandDNAProfile.findUnique({
      where: { organizationId: ctx.organization.id },
    });
    brandDNASection = buildBrandDNAPromptSection(profile);
  } catch (err) {
    console.warn("[AI/auto-draft] Brand DNA load failed:", err);
  }

  const clientFirstName =
    proposal.client?.firstName?.trim() ||
    extractClientNameFromContent(proposal.contentJson) ||
    "there";
  const consultantName = proposal.user?.name?.trim() || null;
  const tripTitle = proposal.title?.trim() || "the proposal";
  const channelLabel = channel === "email" ? "Email" : "WhatsApp";

  const userPrompt = [
    `Channel: ${channelLabel}`,
    `Suggested action: ${momentum.suggestedAction}`,
    `Momentum: ${momentum.momentum}`,
    `Client first name: ${clientFirstName}`,
    consultantName ? `Operator's name (sender): ${consultantName}` : "",
    `Trip title: ${tripTitle}`,
    "",
    "Engagement signals:",
    formatSignals(summary) || "- No tracked engagement yet.",
    summary?.nextAction
      ? `\nDashboard next-action hint: "${summary.nextAction}".`
      : "",
    instructions ? `\nOperator's direction for this draft:\n${instructions}` : "",
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

    const logged = await prisma.aISuggestion.create({
      data: {
        organizationId: ctx.organization.id,
        userId: ctx.user.id,
        kind: "follow-up",
        targetType: "proposal",
        targetId: proposal.id,
        channel,
        output: draft,
        input: {
          channel,
          momentum: momentum.momentum,
          suggestedAction: momentum.suggestedAction,
          reason: momentum.reason,
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
      },
      select: { id: true },
    });

    return NextResponse.json({
      draft,
      channel,
      suggestionId: logged.id,
      momentum: momentum.momentum,
      suggestedAction: momentum.suggestedAction,
      momentumReason: momentum.reason,
      cached: false,
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
      console.error("[AI/auto-draft] Anthropic error:", err.status, err.message);
      return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error("[AI/auto-draft] Unexpected error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

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
  if (summary.reservationCompleted) lines.push("- Already submitted a reservation — this follow-up is post-booking.");
  if (summary.lastEventAt) {
    const ageMs = Date.now() - summary.lastEventAt.getTime();
    const days = Math.floor(ageMs / 86_400_000);
    const hours = Math.floor(ageMs / 3_600_000);
    const mins = Math.floor(ageMs / 60_000);
    const ago =
      mins < 60 ? `${mins} min ago` : hours < 24 ? `${hours} h ago` : `${days} d ago`;
    lines.push(`- Last activity: ${ago} (${summary.lastEventType ?? "unknown event"}).`);
  }
  lines.push(`- Engagement score: ${summary.engagementScore} (status: ${summary.status}).`);
  return lines.join("\n");
}
