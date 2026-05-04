import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { triggerProposalViewed } from "@/lib/ghl/workflowEvents";
import {
  recordProposalEvent,
  type ProposalEventType,
} from "@/lib/proposalActivity";

// POST /api/public/proposals/:id/track
//   Body: { sessionId, kind: "open" | "section" | "close",
//           sectionId?, dwellSeconds? }
//
// Anonymous — no auth. Rate-limiting is not implemented; malicious traffic
// can only inflate someone else's own proposal metrics (no sensitive data
// is returned). If abuse becomes a real problem we can add per-IP limits.
//
// Session bookkeeping: we upsert the ProposalView row keyed on
// (proposalId, sessionId). The first POST creates the row with viewCount=1;
// subsequent POSTs for the same session bump viewCount + lastViewedAt and
// accumulate totalSeconds from any "section" / "close" events.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  // Proposal must exist (avoid enumeration via this endpoint).
  // Pull the org + client links so the activity layer can attribute
  // the event to the right tenant + contact without a second query.
  const proposal = await prisma.proposal.findUnique({
    where: { id },
    select: { id: true, organizationId: true, clientId: true },
  });
  if (!proposal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const sessionId = typeof body.sessionId === "string" ? body.sessionId.slice(0, 64) : "";
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }
  // Two parallel taxonomies share this endpoint:
  //   • Session-scoped engagement: open / section / close — used by
  //     ProposalView (one row per anonymous viewer session).
  //   • Org-level activity: proposal_viewed / proposal_scrolled /
  //     itinerary_clicked / price_viewed / reservation_started /
  //     reservation_completed — used by ProposalEvent +
  //     ProposalActivitySummary (org-level "what's hot today").
  // "open" is the legacy spelling for the first session view; we
  // accept both names and normalise "open" → "proposal_viewed" when
  // writing to the org-level log so older /p/[id] clients keep
  // working without a frontend release.
  const ALLOWED_KINDS = [
    "open",
    "section",
    "close",
    "proposal_viewed",
    "proposal_scrolled",
    "itinerary_clicked",
    "price_viewed",
    "reservation_started",
    "reservation_completed",
  ] as const;
  type Kind = (typeof ALLOWED_KINDS)[number];
  const kind: Kind | null = (ALLOWED_KINDS as readonly string[]).includes(
    body.kind as string,
  )
    ? (body.kind as Kind)
    : null;
  if (!kind) return NextResponse.json({ error: "invalid kind" }, { status: 400 });

  const sectionId = typeof body.sectionId === "string" ? body.sectionId.slice(0, 64) : null;
  // Section type comes from data-section-type on the share view.
  // Whitelisted to a small fixed set so the column can't get polluted
  // with arbitrary strings — Inspector AI keys off these names when
  // aggregating dwell.
  const ALLOWED_SECTION_TYPES = new Set([
    "cover",
    "intro",
    "dayJourney",
    "itineraryTable",
    "map",
    "pricing",
    "lodge",
    "reservation",
    "contact",
    "footer",
  ]);
  const sectionType =
    typeof body.sectionType === "string" && ALLOWED_SECTION_TYPES.has(body.sectionType)
      ? body.sectionType
      : null;
  const dwellSeconds =
    typeof body.dwellSeconds === "number" && Number.isFinite(body.dwellSeconds)
      ? Math.max(0, Math.min(3600, Math.round(body.dwellSeconds)))
      : null;
  const scrollDepthPct =
    typeof body.scrollDepthPct === "number" && Number.isFinite(body.scrollDepthPct)
      ? Math.max(0, Math.min(100, Math.round(body.scrollDepthPct)))
      : null;
  // Caller-supplied metadata for org-level event kinds. Plain object
  // only (no arrays / primitives), capped to a small set of keys we
  // actually surface. Untrusted input — sanitised before it lands in
  // ProposalEvent.metadata so a chatty client can't bloat the JSONB
  // column or sneak in PII.
  const callerMetadata = sanitiseMetadata(body.metadata);

  const userAgent = req.headers.get("user-agent")?.slice(0, 512) ?? null;
  const referrer = req.headers.get("referer")?.slice(0, 512) ?? null;
  // Vercel / Railway often set "cf-ipcountry" or "x-vercel-ip-country".
  const country =
    req.headers.get("cf-ipcountry")
    ?? req.headers.get("x-vercel-ip-country")
    ?? null;

  // Session-scoped kinds drive the legacy ProposalView accumulator. Org-
  // level event kinds (proposal_viewed, proposal_scrolled, etc.) feed
  // the new ProposalEvent log instead.
  const SESSION_KINDS = new Set(["open", "section", "close"]);
  const isSessionKind = SESSION_KINDS.has(kind);

  const now = new Date();
  if (isSessionKind) {
    // Upsert the view row. sessionStorage-issued sessionIds mean reload =
    // same session, new tab = possibly new session (we accept that
    // inflation).
    const view = await prisma.proposalView.upsert({
      where: { proposalId_sessionId: { proposalId: id, sessionId } },
      create: {
        proposalId: id,
        sessionId,
        userAgent,
        referrer,
        country,
        scrollDepthPct,
      },
      update: {
        lastViewedAt: now,
        // Bump viewCount only on "open" kinds (tab reload / new session start).
        ...(kind === "open" ? { viewCount: { increment: 1 } } : {}),
        // Accumulate dwell on section / close events.
        ...(dwellSeconds && (kind === "section" || kind === "close")
          ? { totalSeconds: { increment: dwellSeconds } }
          : {}),
      },
    });

    // scrollDepthPct is monotonic per session — only bump when the new
    // value is higher than what we already have. Using a separate
    // update keeps the upsert above readable; the row was just created
    // or fetched so the second roundtrip is on a hot row.
    if (scrollDepthPct !== null && scrollDepthPct > (view.scrollDepthPct ?? 0)) {
      await prisma.proposalView.update({
        where: { id: view.id },
        data: { scrollDepthPct },
      });
    }

    await prisma.proposalViewEvent.create({
      data: {
        viewId: view.id,
        kind,
        sectionId,
        sectionType,
        dwellSeconds,
      },
    });
  }

  // ── Org-level activity log ──────────────────────────────────────────────
  // Map the wire kind to a ProposalEventType; "open" carries forward as
  // proposal_viewed so older clients populate the new tables too.
  // Section / close are session-only — they never become org-level
  // activity events.
  const activityType: ProposalEventType | null = (() => {
    switch (kind) {
      case "open": return "proposal_viewed";
      case "proposal_viewed": return "proposal_viewed";
      case "proposal_scrolled": return "proposal_scrolled";
      case "itinerary_clicked": return "itinerary_clicked";
      case "price_viewed": return "price_viewed";
      case "reservation_started": return "reservation_started";
      // reservation_completed is written authoritatively by the reserve
      // route; we ignore it here so the dashboard score doesn't double-
      // count when the dialog also fires it via track.
      case "reservation_completed": return null;
      default: return null;
    }
  })();

  if (activityType && proposal.organizationId) {
    try {
      await recordProposalEvent({
        organizationId: proposal.organizationId,
        proposalId: id,
        clientId: proposal.clientId ?? null,
        eventType: activityType,
        metadata: {
          sessionId,
          ...(sectionId ? { sectionId } : {}),
          ...(dwellSeconds ? { dwellSeconds } : {}),
          ...callerMetadata,
        },
      });
    } catch (err) {
      // Activity is best-effort: a failure here mustn't 500 the
      // tracker. The session-scoped ProposalView log is already
      // persisted, so engagement metrics survive even when the
      // activity layer is broken.
      console.warn("[track] recordProposalEvent failed:", err, { proposalId: id, kind });
    }
  }

  // First-view detection — only on "open" kinds. We count ProposalView
  // rows for this proposal AFTER the upsert; if exactly one exists, the
  // row we just created is the first ever view. Fire the GHL
  // `proposal_viewed` workflow once. Fire-and-forget; never block the
  // tracking response.
  if (kind === "open") {
    const sessionCount = await prisma.proposalView.count({ where: { proposalId: id } });
    if (sessionCount === 1) {
      void triggerProposalViewed(id);
    }
  }

  return NextResponse.json({ ok: true });
}

// Whitelist + cap metadata coming from the public client. The ViewTracker
// only sends a small fixed set of keys (section, dayNumber, destination)
// so anything else is dropped silently. Strings are length-clamped;
// numbers must be finite.
function sanitiseMetadata(input: unknown): Record<string, string | number> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const ALLOWED = new Set(["section", "dayNumber", "destination"]);
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (!ALLOWED.has(k)) continue;
    if (typeof v === "string") {
      const t = v.trim();
      if (t.length > 0) out[k] = t.slice(0, 120);
    } else if (typeof v === "number" && Number.isFinite(v)) {
      out[k] = v;
    }
  }
  return out;
}
