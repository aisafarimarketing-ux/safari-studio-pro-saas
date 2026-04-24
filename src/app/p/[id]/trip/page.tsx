import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TripApp } from "@/components/proposal-share/TripApp";
import type { Proposal } from "@/lib/types";

// ─── /p/[id]/trip ───────────────────────────────────────────────────────────
//
// The traveler's trip app — a mobile-first, read-only view of the
// booked proposal meant to live on the client's phone before, during,
// and after the safari. Distinct from /p/[id] (the sales proposal)
// in both tone and shape: /p is magazine-quality marketing; /trip is
// a practical itinerary + contacts app.
//
// Access model for MVP: same public URL as the proposal. Same tenet
// applies — anyone with the id already has read access via /api/
// public/proposals/:id; exposing a traveler-friendly view of that
// data is strictly additive. When a proposal status is "draft" we
// still serve the trip view for operator preview purposes.

export const metadata = {
  title: "Your safari — trip details",
  robots: { index: false },
};

export default async function TripAppPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const row = await prisma.proposal.findUnique({
    where: { id },
    select: { id: true, contentJson: true, updatedAt: true },
  });
  if (!row) notFound();

  const proposal = row.contentJson as Proposal | null;
  if (!proposal) notFound();

  return <TripApp id={id} proposal={proposal} />;
}
