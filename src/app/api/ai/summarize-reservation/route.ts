import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { buildBrandDNAPromptSection } from "@/lib/brandDNAPrompt";
import { logSuggestion } from "@/lib/aiLog";

// POST /api/ai/summarize-reservation
//
// Returns a 2–3 line concierge brief on a reservation so the
// consultant can scan it on a phone before opening the full record.
// Reads the reservation, the linked proposal, and any associated
// inbox messages (system snapshots + later operator/client replies),
// applies Brand DNA tone, and returns plain prose — no labels, no
// bullets, no JSON.
//
// Scope: caller must be authenticated to the org that owns the
// reservation. Owners / admins / the assigned consultant all see it.
//
// Body: { reservationId: string }
// Returns: { brief: string, suggestionId?: string }

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

const SYSTEM_RULES = `You are summarising a single safari reservation for the consultant who'll handle it. The summary is read on a phone before the consultant opens the booking — it should give them everything they need to make a fast, confident first reply.

Style:
- Two short sentences, three at most. Plain prose, no bullet points, no labels, no markdown.
- Lead with the most decision-useful fact (urgency, special requirement, or unusual party shape). Generic facts that fit on the existing dashboard chips (dates, headcount) only earn space if they're relevant to next steps.
- Concierge register: confident, specific, never breathless.
- If the notes flag something the consultant must address before confirming (allergy, mobility, kids' ages, flight constraint, deposit timing), surface it explicitly.
- If there's nothing notable, say so plainly — "Standard request, no flags." is a perfectly good summary.
- Bans: "stunning", "amazing", "incredible", "magical", "luxe", "ultimate", "discover", exclamation marks.

Return ONLY the summary text. No preamble, no quotes, no markdown.`;

type Body = { reservationId?: string };

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
  const reservationId = body.reservationId?.trim();
  if (!reservationId) {
    return NextResponse.json({ error: "reservationId required" }, { status: 400 });
  }

  const reservation = await prisma.proposalReservation.findUnique({
    where: { id: reservationId },
    select: {
      id: true,
      organizationId: true,
      assignedUserId: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      nationality: true,
      arrivalDate: true,
      departureDate: true,
      travelers: true,
      notes: true,
      status: true,
      createdAt: true,
      proposal: {
        select: {
          id: true,
          title: true,
          trackingId: true,
          requestId: true,
          clientId: true,
          contentJson: true,
        },
      },
    },
  });
  if (!reservation || reservation.organizationId !== ctx.organization.id) {
    return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
  }

  const isOwnerOrAdmin = ctx.role === "owner" || ctx.role === "admin";
  const isAssignee = reservation.assignedUserId === ctx.user.id;
  if (!isOwnerOrAdmin && !isAssignee) {
    return NextResponse.json({ error: "Not authorised for this reservation" }, { status: 403 });
  }

  // Pull the linked request/client message thread so the brief can
  // pick up later context (e.g. operator replies, client follow-ups
  // after the original submission). Capped at 6 most recent so the
  // prompt stays bounded.
  let messages: { direction: string; channel: string; body: string; createdAt: Date }[] = [];
  if (reservation.proposal?.requestId || reservation.proposal?.clientId) {
    const where = [
      reservation.proposal.requestId
        ? { requestId: reservation.proposal.requestId }
        : null,
      reservation.proposal.clientId
        ? { clientId: reservation.proposal.clientId }
        : null,
    ].filter((w): w is NonNullable<typeof w> => w !== null);
    if (where.length > 0) {
      messages = await prisma.message.findMany({
        where: {
          organizationId: ctx.organization.id,
          OR: where,
        },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          direction: true,
          channel: true,
          body: true,
          createdAt: true,
        },
      });
    }
  }

  let brandDNASection = "";
  try {
    const profile = await prisma.brandDNAProfile.findUnique({
      where: { organizationId: ctx.organization.id },
    });
    brandDNASection = buildBrandDNAPromptSection(profile);
  } catch (err) {
    console.warn("[AI/summarize-reservation] Brand DNA load failed:", err);
  }

  const fullName = `${reservation.firstName} ${reservation.lastName}`.trim();
  const arrival = reservation.arrivalDate.toISOString().slice(0, 10);
  const departure = reservation.departureDate.toISOString().slice(0, 10);
  const submittedAgoMin = Math.max(
    0,
    Math.floor((Date.now() - reservation.createdAt.getTime()) / 60_000),
  );

  const messageBlock =
    messages.length > 0
      ? messages
          .slice()
          .reverse()
          .map((m) => {
            const ageMin = Math.max(
              0,
              Math.floor((Date.now() - m.createdAt.getTime()) / 60_000),
            );
            return `[${m.direction} · ${m.channel} · ${ageMin}m ago]\n${truncate(m.body, 600)}`;
          })
          .join("\n\n")
      : "";

  const userPrompt = [
    `Reservation submitted ${submittedAgoMin}m ago.`,
    `Client: ${fullName} (${reservation.email}, ${reservation.phone}).`,
    reservation.nationality ? `Nationality: ${reservation.nationality}.` : "",
    `Trip: ${reservation.proposal?.title?.trim() || "(untitled proposal)"} — ${arrival} → ${departure}.`,
    reservation.travelers ? `Travellers: ${reservation.travelers}.` : "",
    reservation.notes
      ? `Client notes:\n"""\n${truncate(reservation.notes, 1500)}\n"""`
      : "Client notes: none.",
    messageBlock
      ? `\nRelated thread (most recent last):\n${messageBlock}`
      : "",
    "",
    "Summarise this reservation now.",
  ]
    .filter(Boolean)
    .join("\n");

  const client = new Anthropic({ apiKey });

  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 400,
      system: [
        {
          type: "text",
          text: SYSTEM_RULES + brandDNASection,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userPrompt }],
    });
    const brief = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    const logged = await logSuggestion({
      organizationId: ctx.organization.id,
      userId: ctx.user.id,
      kind: "reservation-summary",
      targetType: "reservation",
      targetId: reservation.id,
      input: {
        clientName: fullName,
        arrival,
        departure,
        hasNotes: Boolean(reservation.notes),
        threadMessages: messages.length,
      },
      output: brief,
    });

    return NextResponse.json({
      brief,
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
      console.error("[AI/summarize-reservation] Anthropic error:", err.status, err.message);
      return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error("[AI/summarize-reservation] Unexpected error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}
