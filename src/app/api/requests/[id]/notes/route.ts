import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { recordActivity } from "@/lib/activity";

// /api/requests/[id]/notes — append a user note to a request's activity
// feed. System notes (status changes, assignments) are written by the
// parent route's PATCH handler; this endpoint is for operator-authored
// notes only. Posting also counts as a first-reply if the request is
// still in "new" status without a firstReplyAt stamp.

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ctx.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }
  if (!ctx.orgActive) {
    return NextResponse.json({ error: "Account suspended", code: "ORG_SUSPENDED" }, { status: 402 });
  }

  const { id } = await params;
  let body: { body?: string };
  try {
    body = (await req.json()) as { body?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const text = body?.body?.trim();
  if (!text) return NextResponse.json({ error: "body is required" }, { status: 400 });

  const request = await prisma.request.findFirst({
    where: { id, organizationId: ctx.organization.id },
    select: { id: true, firstReplyAt: true },
  });
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const now = new Date();
  const note = await prisma.requestNote.create({
    data: {
      requestId: request.id,
      authorUserId: ctx.user.id,
      kind: "user",
      body: text.slice(0, 4000),
    },
    include: { author: { select: { id: true, name: true, email: true } } },
  });

  // Bump lastActivityAt; stamp first-reply if the feed was empty.
  await prisma.request.update({
    where: { id: request.id },
    data: {
      lastActivityAt: now,
      ...(request.firstReplyAt ? {} : { firstReplyAt: now }),
    },
  });

  await recordActivity({
    userId: ctx.user.id,
    organizationId: ctx.organization.id,
    type: "postNote",
    targetType: "request",
    targetId: request.id,
  });

  return NextResponse.json({ note }, { status: 201 });
}
