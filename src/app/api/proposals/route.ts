import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { planProposalLimit, planLabel, type PlanKey } from "@/lib/billing/plans";
import { nextProposalTrackingId } from "@/lib/proposalTracking";

// Enforce the monthly proposal limit tied to the org's paid plan. Returns
// a 402 response when the limit is hit; otherwise null. Trial / pilot
// lifecycle orgs bypass this — super-admin governs their quotas via
// tierExpiresAt and the kill switch.
async function enforceProposalLimit(
  organizationId: string,
  plan: string,
  tier: string,
): Promise<NextResponse | null> {
  if (tier === "pilot" || tier === "trial") return null;
  const limit = planProposalLimit(plan as PlanKey);
  if (!Number.isFinite(limit)) return null;
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - 30);
  const count = await prisma.proposal.count({
    where: { organizationId, createdAt: { gte: windowStart } },
  });
  if (count < limit) return null;
  return NextResponse.json(
    {
      error: `You've reached the ${planLabel(plan as PlanKey)} plan limit of ${limit} proposals in a 30-day window. Upgrade to keep going.`,
      code: "PROPOSAL_LIMIT_REACHED",
      planLimit: limit,
      usage: count,
    },
    { status: 402 },
  );
}

// GET /api/proposals — list proposals for the caller's active organization
// (newest first). 409 if the caller has no active organization; the UI
// routes through /select-organization in that case.
export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ctx.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }
  if (!ctx.orgActive) {
    return NextResponse.json({ error: "Account suspended", code: "ORG_SUSPENDED" }, { status: 402 });
  }

  // Listing endpoint MUST stay slim — `contentJson` selection was
  // pulling the entire proposal payload for every row in the org
  // (10s-100s of MB on image-heavy proposals) just to extract the
  // client name. Critical: do NOT add `contentJson` back to this
  // select.
  //
  // The clientName field is intentionally null in the listing now —
  // showing the proposal title is enough to recognise rows. If we
  // need it back, add a top-level `clientName` column on the Proposal
  // model and write to it on every save (cheap projection at write
  // time, free at read time). Earlier $queryRaw attempt with
  // Postgres' JSON path operator turned out to error 500 on this
  // deployment, so reverting to the simple safe path.
  const rows = await prisma.proposal.findMany({
    where: { organizationId: ctx.organization.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      updatedAt: true,
      createdAt: true,
    },
  });

  const proposals = rows.map((r) => ({
    id: r.id,
    title: r.title,
    status: r.status,
    updatedAt: r.updatedAt,
    createdAt: r.createdAt,
    clientName: null,
  }));
  return NextResponse.json({ proposals });
}

// POST /api/proposals — upsert by client-provided proposal.id within the
// caller's active organization.
//   Body: { proposal: <full Proposal object> }
//   Create if new; update (ownership + tenant-scoped) if existing.
export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ctx.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }
  if (!ctx.orgActive) {
    return NextResponse.json({ error: "Account suspended", code: "ORG_SUSPENDED" }, { status: 402 });
  }

  // Read the raw body so we can a) report size in diagnostics and b)
  // surface the real parse failure instead of a generic "Invalid JSON".
  let raw = "";
  try {
    raw = await req.text();
  } catch (err) {
    console.error("[proposals.POST] body read failed:", err);
    return NextResponse.json(
      { error: "Could not read request body" },
      { status: 400 },
    );
  }

  let body: { proposal?: { id?: string; metadata?: { title?: string; status?: string } } };
  try {
    body = JSON.parse(raw);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error(
      "[proposals.POST] JSON parse failed:",
      detail,
      "· size=",
      raw.length,
      "bytes · first 200 chars:",
      raw.slice(0, 200),
    );
    return NextResponse.json(
      {
        error: `Invalid JSON: ${detail}`,
        bytes: raw.length,
        // Hint the caller to inspect the payload shape — useful when
        // images or long narratives push the body over a proxy limit.
      },
      { status: 400 },
    );
  }

  const proposal = body?.proposal;
  if (!proposal?.id) {
    return NextResponse.json({ error: "proposal.id is required" }, { status: 400 });
  }

  const title = proposal.metadata?.title || "Untitled Proposal";
  const status = proposal.metadata?.status || "draft";

  // Tenant guard: reject if an existing row belongs to a different org.
  const existing = await prisma.proposal.findUnique({
    where: { id: proposal.id },
    select: { userId: true, organizationId: true },
  });
  if (existing && existing.organizationId && existing.organizationId !== ctx.organization.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Plan proposal-count enforcement. Only triggers on CREATE — saving
  // (upserting) an existing proposal is always allowed so an operator
  // mid-edit on their last allowed proposal can keep working. `trial`
  // and `pilot` lifecycles skip the check (handled by super-admin).
  if (!existing) {
    const limitError = await enforceProposalLimit(ctx.organization.id, ctx.organization.plan, ctx.organization.tier);
    if (limitError) return limitError;
  }

  // Allocate a human-readable trackingId on first create only — saves
  // (subsequent upserts) preserve the existing id. Best-effort: if the
  // counter increment fails, the proposal still saves with a null
  // trackingId and the displayTrackingId() helper falls back to the
  // legacy id.slice(-8) format wherever the id is rendered.
  let trackingId: string | undefined;
  if (!existing) {
    try {
      trackingId = await nextProposalTrackingId(ctx.organization.id);
    } catch (err) {
      console.warn("[proposals] trackingId allocation failed:", err);
    }
  }

  const saved = await prisma.proposal.upsert({
    where: { id: proposal.id },
    create: {
      id: proposal.id,
      userId: ctx.user.id,
      organizationId: ctx.organization.id,
      title,
      status,
      contentJson: proposal as object,
      ...(trackingId ? { trackingId } : {}),
    },
    update: {
      title,
      status,
      organizationId: ctx.organization.id,
      contentJson: proposal as object,
    },
    select: { id: true, title: true, trackingId: true, updatedAt: true },
  });
  return NextResponse.json({ proposal: saved });
}
