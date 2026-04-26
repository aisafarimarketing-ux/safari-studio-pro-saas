import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { triggerProposalViewed } from "@/lib/ghl/workflowEvents";

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
  const proposal = await prisma.proposal.findUnique({
    where: { id },
    select: { id: true },
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
  const kind =
    body.kind === "open" || body.kind === "section" || body.kind === "close"
      ? body.kind
      : null;
  if (!kind) return NextResponse.json({ error: "invalid kind" }, { status: 400 });

  const sectionId = typeof body.sectionId === "string" ? body.sectionId.slice(0, 64) : null;
  const dwellSeconds =
    typeof body.dwellSeconds === "number" && Number.isFinite(body.dwellSeconds)
      ? Math.max(0, Math.min(3600, Math.round(body.dwellSeconds)))
      : null;

  const userAgent = req.headers.get("user-agent")?.slice(0, 512) ?? null;
  const referrer = req.headers.get("referer")?.slice(0, 512) ?? null;
  // Vercel / Railway often set "cf-ipcountry" or "x-vercel-ip-country".
  const country =
    req.headers.get("cf-ipcountry")
    ?? req.headers.get("x-vercel-ip-country")
    ?? null;

  // Upsert the view row. sessionStorage-issued sessionIds mean reload = same
  // session, new tab = possibly new session (we accept that inflation).
  const now = new Date();
  const view = await prisma.proposalView.upsert({
    where: { proposalId_sessionId: { proposalId: id, sessionId } },
    create: {
      proposalId: id,
      sessionId,
      userAgent,
      referrer,
      country,
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

  await prisma.proposalViewEvent.create({
    data: {
      viewId: view.id,
      kind,
      sectionId,
      dwellSeconds,
    },
  });

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
