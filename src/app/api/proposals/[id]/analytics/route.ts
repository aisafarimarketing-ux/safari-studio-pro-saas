import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import type { Day, Proposal, Section, SectionType } from "@/lib/types";

// ─── Per-proposal analytics aggregation ────────────────────────────────────
//
// GET /api/proposals/:id/analytics
//
// Turns raw ProposalViewEvent rows into the "what closes" view the
// operator sees in the editor. Distinct from /views (which returns
// per-session detail) — this is the cross-session summary that tells
// the operator where their clients actually spend time and where they
// bail.
//
// Response:
//   totalViews, uniqueSessions, lastViewedAt, medianSessionSeconds
//   sections[]: per-section aggregates, ordered by proposal flow
//   headline: {
//     mostEngaging:   section with highest average dwell
//     topDropOff:     section where sessions most often stopped
//   }
//
// Section IDs are resolved back to their user-readable labels using the
// proposal's own contentJson so the UI renders "Day 3 · Maasai Mara"
// instead of "day-abc123".

const SECTION_TYPE_LABELS: Record<SectionType, string> = {
  operatorHeader: "Header",
  cover: "Cover",
  personalNote: "Personal note",
  greeting: "Welcome",
  tripSummary: "Overview",
  itineraryTable: "Itinerary",
  map: "Map",
  dayJourney: "Day Journey",
  propertyShowcase: "Properties",
  pricing: "Pricing",
  inclusions: "Inclusions",
  practicalInfo: "Practical info",
  closing: "Departure",
  gallery: "Gallery",
  footer: "Footer",
  customText: "Custom",
  quote: "Quote",
  divider: "Divider",
  spacer: "Spacer",
};

type SectionAggregate = {
  sectionId: string;
  label: string;
  kind: "section" | "day";
  order: number;
  sessionsEngaged: number;
  totalDwellSeconds: number;
  avgDwellSeconds: number;
  dropOffCount: number;
  dropOffRate: number;
};

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!auth.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }

  const { id } = await ctx.params;

  // Tenant-scoped fetch — operator can only analyse their own proposals.
  const proposal = await prisma.proposal.findFirst({
    where: { id, organizationId: auth.organization.id },
    select: { id: true, contentJson: true },
  });
  if (!proposal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const content = proposal.contentJson as Proposal | null;
  const labelResolver = buildLabelResolver(content);

  const views = await prisma.proposalView.findMany({
    where: { proposalId: id },
    orderBy: { lastViewedAt: "desc" },
    include: {
      events: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (views.length === 0) {
    return NextResponse.json({
      totalViews: 0,
      uniqueSessions: 0,
      lastViewedAt: null,
      medianSessionSeconds: 0,
      sections: [],
      headline: null,
    });
  }

  // ── Aggregate per section across all sessions ──────────────────────────
  type Accum = {
    sectionId: string;
    totalDwell: number;
    sessionIds: Set<string>;
    dropOffCount: number;
  };
  const accum = new Map<string, Accum>();

  const getAccum = (sectionId: string): Accum => {
    let a = accum.get(sectionId);
    if (!a) {
      a = { sectionId, totalDwell: 0, sessionIds: new Set(), dropOffCount: 0 };
      accum.set(sectionId, a);
    }
    return a;
  };

  const sessionSeconds: number[] = [];

  for (const view of views) {
    sessionSeconds.push(view.totalSeconds);

    // Accumulate per-session: only count distinct sessions per section once.
    const sessionSectionDwell = new Map<string, number>();
    let lastEngagedSection: string | null = null;

    for (const ev of view.events) {
      if (!ev.sectionId) continue;
      if (ev.kind !== "section" && ev.kind !== "close") continue;
      const dwell = ev.dwellSeconds ?? 0;
      if (dwell <= 0) continue;
      sessionSectionDwell.set(
        ev.sectionId,
        (sessionSectionDwell.get(ev.sectionId) ?? 0) + dwell,
      );
      lastEngagedSection = ev.sectionId;
    }

    for (const [sectionId, dwell] of sessionSectionDwell.entries()) {
      const a = getAccum(sectionId);
      a.totalDwell += dwell;
      a.sessionIds.add(view.sessionId);
    }

    if (lastEngagedSection) {
      getAccum(lastEngagedSection).dropOffCount += 1;
    }
  }

  const sections: SectionAggregate[] = Array.from(accum.values()).map((a) => {
    const sessionsEngaged = a.sessionIds.size;
    const resolved = labelResolver(a.sectionId);
    return {
      sectionId: a.sectionId,
      label: resolved.label,
      kind: resolved.kind,
      order: resolved.order,
      sessionsEngaged,
      totalDwellSeconds: a.totalDwell,
      avgDwellSeconds: sessionsEngaged > 0 ? Math.round(a.totalDwell / sessionsEngaged) : 0,
      dropOffCount: a.dropOffCount,
      dropOffRate: views.length > 0 ? a.dropOffCount / views.length : 0,
    };
  });

  // Sort by the proposal's own flow so the operator reads top-to-bottom.
  sections.sort((a, b) => a.order - b.order);

  // ── Headline signals ──────────────────────────────────────────────────
  const engaged = sections.filter((s) => s.sessionsEngaged > 0);
  const mostEngaging = engaged.reduce<SectionAggregate | null>(
    (best, s) => (!best || s.avgDwellSeconds > best.avgDwellSeconds ? s : best),
    null,
  );
  const topDropOff = sections.reduce<SectionAggregate | null>(
    (best, s) => (!best || s.dropOffCount > best.dropOffCount ? s : best),
    null,
  );

  const totalViews = views.reduce((sum, v) => sum + v.viewCount, 0);

  return NextResponse.json({
    totalViews,
    uniqueSessions: views.length,
    lastViewedAt: views[0]?.lastViewedAt ?? null,
    medianSessionSeconds: median(sessionSeconds),
    sections,
    headline: mostEngaging
      ? {
          mostEngaging: {
            label: mostEngaging.label,
            avgDwellSeconds: mostEngaging.avgDwellSeconds,
            sessions: mostEngaging.sessionsEngaged,
          },
          topDropOff:
            topDropOff && topDropOff.dropOffCount >= 2
              ? {
                  label: topDropOff.label,
                  dropOffCount: topDropOff.dropOffCount,
                  dropOffRate: topDropOff.dropOffRate,
                }
              : null,
        }
      : null,
  });
}

// ─── Label resolution ──────────────────────────────────────────────────────
//
// Tracker event sectionIds follow two conventions set by the share-view
// DOM anchors (/p/[id]):
//   "section-<id>"  → proposal.sections by id
//   "day-<id>"      → proposal.days by id
//
// We resolve both to readable labels + a sort-order so the aggregate list
// reads in the same order the client saw the proposal.

function buildLabelResolver(proposal: Proposal | null) {
  const sectionsById = new Map<string, { section: Section; order: number }>();
  const daysById = new Map<string, { day: Day; order: number }>();
  let dayJourneyOrder = 0;

  if (proposal) {
    const sortedSections = [...proposal.sections].sort((a, b) => a.order - b.order);
    sortedSections.forEach((s, i) => {
      sectionsById.set(s.id, { section: s, order: i });
      if (s.type === "dayJourney") dayJourneyOrder = i;
    });
    const sortedDays = [...proposal.days].sort((a, b) => a.dayNumber - b.dayNumber);
    sortedDays.forEach((d, i) => {
      // Day cards sort as sub-positions of the dayJourney section so they
      // appear in the right place in the aggregate list.
      daysById.set(d.id, { day: d, order: dayJourneyOrder + (i + 1) / 1000 });
    });
  }

  return function resolve(
    sectionId: string,
  ): { label: string; kind: "section" | "day"; order: number } {
    if (sectionId.startsWith("section-")) {
      const id = sectionId.slice("section-".length);
      const hit = sectionsById.get(id);
      if (hit) {
        return {
          label: SECTION_TYPE_LABELS[hit.section.type] ?? hit.section.type,
          kind: "section",
          order: hit.order,
        };
      }
      return { label: "Section", kind: "section", order: 9999 };
    }
    if (sectionId.startsWith("day-")) {
      const id = sectionId.slice("day-".length);
      const hit = daysById.get(id);
      if (hit) {
        const destination = hit.day.destination?.trim() || `Day ${hit.day.dayNumber}`;
        return {
          label: `Day ${hit.day.dayNumber} · ${destination}`,
          kind: "day",
          order: hit.order,
        };
      }
      return { label: "Day", kind: "day", order: 9999 };
    }
    return { label: sectionId, kind: "section", order: 9999 };
  };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
}
