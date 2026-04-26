import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Server-side activity logger. Call from any mutation route that changes
// org state so the admin timeline has a reliable record. Never throws —
// an activity-log hiccup shouldn't surface as a 500 on the actual mutation.
//
// Stays fire-and-forget when the caller doesn't await; the Prisma create
// returns a promise the caller can await when ordering matters.

export type ActivityType =
  | "signin"
  | "signout"
  | "viewRequest"
  | "createRequest"
  | "assignRequest"
  | "changeStatus"
  | "postNote"
  | "createQuote"
  | "sendQuote"
  | "editProposal"
  | "archiveProperty"
  | "editBrandDNA"
  | "viewLibrary"
  | "viewTeam"
  | "messageSent"
  | "messageReceived";

export async function recordActivity(params: {
  userId: string;
  organizationId: string;
  type: ActivityType;
  targetType?: "request" | "proposal" | "property" | "client" | "brand_dna" | "message";
  targetId?: string;
  detail?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.activityEvent.create({
      data: {
        userId: params.userId,
        organizationId: params.organizationId,
        type: params.type,
        targetType: params.targetType ?? null,
        targetId: params.targetId ?? null,
        detail: (params.detail ?? Prisma.DbNull) as Prisma.InputJsonValue | typeof Prisma.DbNull,
      },
    });
  } catch (err) {
    console.warn("[activity] record failed:", err);
  }
}
