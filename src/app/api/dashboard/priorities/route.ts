import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { score, needsFollowup, atRisk, type ScoringSignals, type PriorityScore } from "@/lib/dealScoring";

// ─── GET /api/dashboard/priorities ─────────────────────────────────────────
//
// Powers the "Today's Priorities" section. Pulls every non-terminal
// Request for the org plus the engagement signals, runs the scoring
// algorithm, and returns the top N along with summary metrics.
//
// All computation is per-org and on-demand — no denormalised score
// columns. The data volume is bounded by the request count, which is
// in the low hundreds even for active operators.
//
// Query params:
//   ?filter = all | hot | needs-followup | unread   (default: all)
//   ?limit  = N (default 25, max 50)

const ACTIVE_STATUSES = ["new", "working", "open"];
const TIER_KEYS = new Set(["classic", "premier", "signature"]);

type Filter = "all" | "hot" | "needs-followup" | "unread";

export async function GET(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ctx.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }

  const url = new URL(req.url);
  const filter: Filter = (url.searchParams.get("filter") as Filter) ?? "all";
  const limit = clampInt(url.searchParams.get("limit"), 1, 50, 25);
  const orgId = ctx.organization.id;
  const nowIso = new Date().toISOString();

  // ── Pull every active request with the joins we need to score it ────────
  // tasks: filter to OPEN (doneAt null) — drives the "Mark done" affordance
  // on each priority card and the "Task active" badge.
  const requests = await prisma.request.findMany({
    where: { organizationId: orgId, status: { in: ACTIVE_STATUSES } },
    include: {
      client: {
        select: {
          id: true, firstName: true, lastName: true, email: true, country: true,
        },
      },
      proposals: {
        orderBy: { updatedAt: "desc" },
        select: {
          id: true, title: true, status: true, contentJson: true, createdAt: true, updatedAt: true,
          deposits: { where: { status: "paid" }, select: { id: true } },
          reservations: { select: { id: true } },
          views: {
            select: {
              viewCount: true, totalSeconds: true,
              events: { select: { sectionId: true, kind: true } },
            },
          },
        },
        take: 5, // most recent quotes — only the latest is used
      },
      tasks: {
        where: { doneAt: null },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          actionType: true,
          priorityLevel: true,
          dueAt: true,
          auto: true,
          createdAt: true,
        },
      },
      _count: {
        select: {
          messages: true,
        },
      },
    },
  });

  if (requests.length === 0) {
    return NextResponse.json({
      summary: emptySummary(),
      filterCounts: { all: 0, hot: 0, "needs-followup": 0, unread: 0 },
      priorities: [],
    });
  }

  const requestIds = requests.map((r) => r.id);

  // ── Aggregate message counts per request in two roundtrips: one for
  //    inbound + outbound + unread, one for last-inbound timestamps.
  const [messageCounts, lastInboundRows] = await Promise.all([
    prisma.message.groupBy({
      by: ["requestId", "direction"],
      where: { organizationId: orgId, requestId: { in: requestIds } },
      _count: { _all: true },
    }),
    // Latest inbound per request — group + max(createdAt).
    prisma.message.groupBy({
      by: ["requestId"],
      where: {
        organizationId: orgId,
        requestId: { in: requestIds },
        direction: "inbound",
      },
      _max: { createdAt: true },
    }),
  ]);

  // Unread inbound — count rows with readAt = null.
  const unreadCounts = await prisma.message.groupBy({
    by: ["requestId"],
    where: {
      organizationId: orgId,
      requestId: { in: requestIds },
      direction: "inbound",
      readAt: null,
    },
    _count: { _all: true },
  });

  // Index roundtrip results by requestId for O(1) lookup.
  const inboundByRequest = new Map<string, number>();
  const outboundByRequest = new Map<string, number>();
  for (const row of messageCounts) {
    if (!row.requestId) continue;
    const map = row.direction === "inbound" ? inboundByRequest : outboundByRequest;
    map.set(row.requestId, row._count._all);
  }
  const unreadByRequest = new Map<string, number>();
  for (const row of unreadCounts) {
    if (row.requestId) unreadByRequest.set(row.requestId, row._count._all);
  }
  const lastInboundByRequest = new Map<string, string>();
  for (const row of lastInboundRows) {
    if (row.requestId && row._max.createdAt) {
      lastInboundByRequest.set(row.requestId, row._max.createdAt.toISOString());
    }
  }

  // ── Score every request, drop terminals, build the response shape ──────
  const scored = requests
    .map((r) => buildPriority(r, {
      inboundMessages: inboundByRequest.get(r.id) ?? 0,
      outboundMessages: outboundByRequest.get(r.id) ?? 0,
      unreadInboundMessages: unreadByRequest.get(r.id) ?? 0,
      lastInboundIso: lastInboundByRequest.get(r.id) ?? null,
      nowIso,
    }))
    .filter((p): p is NonNullable<typeof p> => p !== null);

  // ── Compute filter counts BEFORE applying the user's filter, so the
  //    UI tab counts stay stable across selections. ──────────────────────
  const filterCounts = {
    all: scored.length,
    hot: scored.filter((p) => p.score.label === "hot").length,
    "needs-followup": scored.filter((p) => p.needsFollowup).length,
    unread: scored.filter((p) => p.unreadCount > 0).length,
  };

  // Summary metrics — computed off the full set, not the filtered slice.
  const hotPriorities = scored.filter((p) => p.score.label === "hot");
  const atRiskPriorities = scored.filter((p) => p.atRisk);
  const summary = {
    hotDealsCount: hotPriorities.length,
    hotDealsValueCents: sum(hotPriorities.map((p) => p.valueCents)),
    pipelineAtRiskValueCents: sum(atRiskPriorities.map((p) => p.valueCents)),
    pipelineAtRiskCount: atRiskPriorities.length,
    unreadMessages: scored.reduce((acc, p) => acc + p.unreadCount, 0),
    followupsDueCount: scored.filter((p) => p.needsFollowup).length,
    totalActiveValueCents: sum(scored.map((p) => p.valueCents)),
    currency: scored.find((p) => p.currency)?.currency ?? "USD",
  };

  // ── Apply the filter, sort by score desc, slice to the limit ──────────
  let filtered = scored;
  if (filter === "hot") filtered = scored.filter((p) => p.score.label === "hot");
  else if (filter === "needs-followup") filtered = scored.filter((p) => p.needsFollowup);
  else if (filter === "unread") filtered = scored.filter((p) => p.unreadCount > 0);

  filtered.sort((a, b) => {
    // Primary: score desc. Secondary: urgent action first. Tertiary:
    // unread count desc.
    if (b.score.total !== a.score.total) return b.score.total - a.score.total;
    if (b.score.nextAction.urgent !== a.score.nextAction.urgent) {
      return b.score.nextAction.urgent ? 1 : -1;
    }
    return b.unreadCount - a.unreadCount;
  });

  return NextResponse.json({
    summary,
    filterCounts,
    priorities: filtered.slice(0, limit),
  });
}

// ─── buildPriority — turn a Request row into a scored priority ────────────

type RequestWithJoins = Awaited<ReturnType<typeof prisma.request.findMany>>[number];

function buildPriority(
  r: RequestWithJoins & {
    client: {
      id: string; firstName: string | null; lastName: string | null; email: string; country: string | null;
    } | null;
    proposals: Array<{
      id: string; title: string; status: string; contentJson: unknown;
      createdAt: Date; updatedAt: Date;
      deposits: { id: string }[];
      reservations: { id: string }[];
      views: Array<{
        viewCount: number;
        totalSeconds: number;
        events: { sectionId: string | null; kind: string }[];
      }>;
    }>;
    tasks: Array<{
      id: string; title: string; actionType: string | null;
      priorityLevel: string | null; dueAt: Date | null; auto: boolean;
      createdAt: Date;
    }>;
  },
  ctx: {
    inboundMessages: number;
    outboundMessages: number;
    unreadInboundMessages: number;
    lastInboundIso: string | null;
    nowIso: string;
  },
) {
  const proposal = r.proposals[0]; // most-recent
  const hasProposal = !!proposal;
  const proposalSent = !!proposal && (proposal.status === "sent" || proposal.status === "accepted");

  // Aggregate engagement signals from the proposal's view rows.
  let totalViews = 0;
  let totalDwellSeconds = 0;
  let pricingViewed = false;
  if (proposal) {
    for (const v of proposal.views) {
      totalViews += v.viewCount ?? 0;
      totalDwellSeconds += v.totalSeconds ?? 0;
      for (const evt of v.events) {
        if (evt.sectionId && evt.sectionId.toLowerCase().includes("pricing")) {
          pricingViewed = true;
          break;
        }
      }
    }
  }

  const depositPaid = !!proposal && proposal.deposits.length > 0;
  const hasReservation = !!proposal && proposal.reservations.length > 0;
  const { valueCents, currency } = deriveValue(proposal?.contentJson);

  const signals: ScoringSignals = {
    status: r.status,
    hasProposal,
    proposalSent,
    totalViews,
    totalDwellSeconds,
    pricingViewed,
    inboundMessages: ctx.inboundMessages,
    outboundMessages: ctx.outboundMessages,
    unreadInboundMessages: ctx.unreadInboundMessages,
    lastActivityIso: r.lastActivityAt.toISOString(),
    proposalSentIso: proposalSent ? proposal!.updatedAt.toISOString() : null,
    lastInboundIso: ctx.lastInboundIso,
    depositPaid,
    hasReservation,
    valueCents,
  };

  const s: PriorityScore | null = score(signals, ctx.nowIso);
  if (!s) return null;

  const clientName = r.client
    ? [r.client.firstName, r.client.lastName].filter(Boolean).join(" ").trim() || r.client.email
    : "Unknown";

  // Match an open task to the current next-action. We look for an exact
  // actionType match first (the operator clicked "Add task" on this
  // exact recommendation); fall back to any open task so the card
  // still shows "Mark done" / "Task active" when the operator added
  // something manually from the request page.
  const activeTaskExact = r.tasks.find((t) => t.actionType === s.nextAction.type) ?? null;
  const activeTaskAny = activeTaskExact ?? r.tasks[0] ?? null;
  const activeTask = activeTaskAny
    ? {
        id: activeTaskAny.id,
        title: activeTaskAny.title,
        actionType: activeTaskAny.actionType,
        priorityLevel: activeTaskAny.priorityLevel,
        dueAt: activeTaskAny.dueAt?.toISOString() ?? null,
        auto: activeTaskAny.auto,
        matchesNextAction: !!activeTaskExact,
      }
    : null;

  // Pick a "last activity preview" — prefer the last inbound message
  // (we surface that we have unread context), then status, then created.
  const lastActivityKind: "message" | "view" | "status" = ctx.lastInboundIso
    ? "message"
    : totalViews > 0
      ? "view"
      : "status";

  return {
    requestId: r.id,
    referenceNumber: r.referenceNumber,
    status: r.status,
    clientId: r.client?.id ?? null,
    clientName,
    clientEmail: r.client?.email ?? null,
    clientCountry: r.client?.country ?? null,
    proposalId: proposal?.id ?? null,
    proposalTitle: proposal?.title ?? null,
    valueCents,
    currency,
    score: s,
    engagement: {
      views: totalViews,
      totalSeconds: totalDwellSeconds,
      pricingViewed,
      inboundMessages: ctx.inboundMessages,
      outboundMessages: ctx.outboundMessages,
    },
    unreadCount: ctx.unreadInboundMessages,
    lastActivityIso: r.lastActivityAt.toISOString(),
    lastActivityKind,
    needsFollowup: needsFollowup(s, signals, ctx.nowIso),
    atRisk: atRisk(s, signals, ctx.nowIso),
    activeTask,
  };
}

// ─── deriveValue — proposal pricing × pax in cents + currency ─────────────

function deriveValue(contentJson: unknown): { valueCents: number; currency: string } {
  if (!contentJson || typeof contentJson !== "object") {
    return { valueCents: 0, currency: "USD" };
  }
  const c = contentJson as {
    pricing?: Record<string, { pricePerPerson?: string; currency?: string }>;
    activeTier?: string;
    client?: { pax?: string };
  };
  const tierKey = c.activeTier && TIER_KEYS.has(c.activeTier) ? c.activeTier : "premier";
  const tier = c.pricing?.[tierKey];
  const perPerson = parsePerPerson(tier?.pricePerPerson);
  const currency = (tier?.currency || "USD").toUpperCase();
  if (perPerson <= 0) return { valueCents: 0, currency };
  const pax = parsePax(c.client?.pax);
  const dollars = perPerson * (pax > 0 ? pax : 1);
  return { valueCents: Math.round(dollars * 100), currency };
}

function parsePerPerson(raw: string | undefined): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/[^\d.]/g, "");
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function parsePax(raw: string | undefined): number {
  if (!raw) return 0;
  const nums = raw.match(/\d+/g);
  if (!nums) return 0;
  let total = 0;
  let seen = false;
  for (const n of nums) {
    const num = Number.parseInt(n, 10);
    if (!Number.isFinite(num)) continue;
    if (!seen) { total = num; seen = true; continue; }
    if (total < 20 && num <= 12) { total += num; break; }
    break;
  }
  return total;
}

// ─── Misc ──────────────────────────────────────────────────────────────────

function sum(ns: number[]): number {
  return ns.reduce((a, b) => a + b, 0);
}

function emptySummary() {
  return {
    hotDealsCount: 0,
    hotDealsValueCents: 0,
    pipelineAtRiskValueCents: 0,
    pipelineAtRiskCount: 0,
    unreadMessages: 0,
    followupsDueCount: 0,
    totalActiveValueCents: 0,
    currency: "USD",
  };
}

function clampInt(v: string | null, min: number, max: number, fallback: number): number {
  if (!v) return fallback;
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}
