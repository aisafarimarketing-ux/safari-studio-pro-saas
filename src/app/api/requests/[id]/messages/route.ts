import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";

// ─── GET /api/requests/:id/messages ────────────────────────────────────────
//
// Conversation thread for a request — chronological message list with
// inbound + outbound interleaved. Side effect: marks all unread inbound
// messages on the thread as read (sets readAt = now) so the dashboard
// unread badge clears when the operator opens the thread.

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!auth.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }

  const { id } = await ctx.params;

  // Tenant scope — request must belong to caller's org.
  const request = await prisma.request.findFirst({
    where: { id, organizationId: auth.organization.id },
    select: { id: true },
  });
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const messages = await prisma.message.findMany({
    where: {
      organizationId: auth.organization.id,
      requestId: request.id,
    },
    orderBy: { createdAt: "asc" },
  });

  // Mark inbound messages on this thread as read. Idempotent — already-
  // read rows skip via readAt: null filter. Don't await this update so
  // the response doesn't wait on it; correctness still holds because
  // the next call returns the same dataset minus readAt nulls.
  void prisma.message.updateMany({
    where: {
      organizationId: auth.organization.id,
      requestId: request.id,
      direction: "inbound",
      readAt: null,
    },
    data: { readAt: new Date() },
  });

  return NextResponse.json({ messages });
}
