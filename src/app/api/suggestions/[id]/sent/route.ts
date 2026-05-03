import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";

// POST   /api/suggestions/[id]/sent — mark an AISuggestion as sent.
// DELETE /api/suggestions/[id]/sent — undo (clear sentAt) for the 5s
//                                     undo grace window in the toast.
//
// Body (POST): { channel?: "whatsapp" | "email", text?: string }
//   - If text is supplied, it overwrites the suggestion's output. The
//     edit panel sends the latest operator-edited copy here so the
//     audit trail captures what actually went out (not the original
//     model draft).
//
// Auth: caller must be authenticated to the org that owns the
// suggestion. Owners / admins / the user who originally created the
// suggestion all qualify.

type Body = {
  channel?: "whatsapp" | "email";
  text?: string;
};

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!auth.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "Suggestion id required" }, { status: 400 });

  const row = await prisma.aISuggestion.findUnique({
    where: { id },
    select: {
      id: true,
      organizationId: true,
      userId: true,
      kind: true,
      targetType: true,
      targetId: true,
    },
  });
  if (!row || row.organizationId !== auth.organization.id) {
    return NextResponse.json({ error: "Suggestion not found" }, { status: 404 });
  }
  const isOwnerOrAdmin = auth.role === "owner" || auth.role === "admin";
  const isAuthor = row.userId === auth.user.id;
  if (!isOwnerOrAdmin && !isAuthor) {
    return NextResponse.json({ error: "Not authorised" }, { status: 403 });
  }

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    /* empty body is fine */
  }
  const channel = body.channel === "email" ? "email" : "whatsapp";
  const text = typeof body.text === "string" ? body.text.trim() : "";

  const updated = await prisma.aISuggestion.update({
    where: { id: row.id },
    data: {
      sentAt: new Date(),
      status: "applied",
      appliedAt: new Date(),
      channel,
      outcome: "sent",
      ...(text ? { output: text } : {}),
    },
    select: {
      id: true,
      sentAt: true,
      channel: true,
      output: true,
    },
  });

  return NextResponse.json({ ok: true, suggestion: updated });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!auth.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "Suggestion id required" }, { status: 400 });

  const row = await prisma.aISuggestion.findUnique({
    where: { id },
    select: { id: true, organizationId: true, userId: true },
  });
  if (!row || row.organizationId !== auth.organization.id) {
    return NextResponse.json({ error: "Suggestion not found" }, { status: 404 });
  }
  const isOwnerOrAdmin = auth.role === "owner" || auth.role === "admin";
  const isAuthor = row.userId === auth.user.id;
  if (!isOwnerOrAdmin && !isAuthor) {
    return NextResponse.json({ error: "Not authorised" }, { status: 403 });
  }

  await prisma.aISuggestion.update({
    where: { id: row.id },
    data: {
      sentAt: null,
      status: "pending",
      appliedAt: null,
      outcome: null,
    },
  });

  return NextResponse.json({ ok: true });
}
