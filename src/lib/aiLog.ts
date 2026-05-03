import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Append-only log for operator-facing AI drafts. Every "draft for me"
// surface (follow-up, reservation summary, future hot-deal next action)
// calls logSuggestion when the model returns a result, before the
// payload is shown to the operator. The row carries the input slice,
// the generated text, and a status the UI can flip when the operator
// applies / dismisses the draft.
//
// Best-effort by design — a logging failure must NEVER block the
// caller from returning the suggestion to the operator. We swallow and
// warn on error.

export type LogSuggestionInput = {
  organizationId: string;
  userId: string | null;
  kind: string;
  targetType: string;
  targetId: string;
  input?: Prisma.InputJsonValue;
  output: string;
};

export async function logSuggestion(
  data: LogSuggestionInput,
): Promise<{ id: string } | null> {
  try {
    const row = await prisma.aISuggestion.create({
      data: {
        organizationId: data.organizationId,
        userId: data.userId ?? null,
        kind: data.kind,
        targetType: data.targetType,
        targetId: data.targetId,
        input: data.input ?? Prisma.JsonNull,
        output: data.output,
      },
      select: { id: true },
    });
    return row;
  } catch (err) {
    console.warn("[aiLog] logSuggestion failed:", err, {
      kind: data.kind,
      targetType: data.targetType,
      targetId: data.targetId,
    });
    return null;
  }
}
