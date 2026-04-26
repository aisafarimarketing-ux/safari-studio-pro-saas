import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";

// ─── GET /api/search?q=... ─────────────────────────────────────────────────
//
// Org-wide command-palette search. Tenant-scoped, queries five entity
// tables in parallel, returns the top N of each with a normalised
// shape (type, title, subtitle, href) the palette UI can render
// without per-type branching.
//
// Backed by Postgres ILIKE via Prisma `contains: ..., mode: insensitive`.
// Cheap enough for the volumes operators have today; if data grows,
// we'll swap to pg_trgm or full-text search.

const MIN_QUERY_LENGTH = 2;
const PER_TYPE_LIMIT = 5;

export type SearchResult = {
  id: string;
  type: "client" | "request" | "proposal" | "reservation" | "property";
  title: string;
  subtitle: string;
  href: string;
  meta?: string; // optional right-side label (e.g. status, country)
};

export async function GET(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ctx.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  if (q.length < MIN_QUERY_LENGTH) {
    return NextResponse.json({ q, results: emptyGroups() });
  }
  // Reject pathological queries up front.
  if (q.length > 100) {
    return NextResponse.json({ error: "Query too long" }, { status: 400 });
  }

  const orgId = ctx.organization.id;

  const [clients, requests, proposals, reservations, properties] = await Promise.all([
    prisma.client.findMany({
      where: {
        organizationId: orgId,
        OR: [
          { email: { contains: q, mode: "insensitive" } },
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
          { country: { contains: q, mode: "insensitive" } },
        ],
      },
      take: PER_TYPE_LIMIT,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true, firstName: true, lastName: true, email: true, country: true,
      },
    }),
    prisma.request.findMany({
      where: {
        organizationId: orgId,
        OR: [
          { referenceNumber: { contains: q, mode: "insensitive" } },
          { originalMessage: { contains: q, mode: "insensitive" } },
          { client: { email: { contains: q, mode: "insensitive" } } },
          { client: { firstName: { contains: q, mode: "insensitive" } } },
          { client: { lastName: { contains: q, mode: "insensitive" } } },
        ],
      },
      take: PER_TYPE_LIMIT,
      orderBy: { lastActivityAt: "desc" },
      select: {
        id: true, referenceNumber: true, status: true,
        client: { select: { firstName: true, lastName: true, email: true } },
      },
    }),
    prisma.proposal.findMany({
      where: {
        organizationId: orgId,
        title: { contains: q, mode: "insensitive" },
      },
      take: PER_TYPE_LIMIT,
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, status: true, updatedAt: true },
    }),
    prisma.reservation.findMany({
      where: {
        organizationId: orgId,
        OR: [
          { campName: { contains: q, mode: "insensitive" } },
          { guestName: { contains: q, mode: "insensitive" } },
          { reservationsEmail: { contains: q, mode: "insensitive" } },
        ],
      },
      take: PER_TYPE_LIMIT,
      orderBy: { createdAt: "desc" },
      select: {
        id: true, campName: true, guestName: true, status: true,
        startDate: true, endDate: true,
      },
    }),
    prisma.property.findMany({
      where: {
        organizationId: orgId,
        archived: false,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { location: { name: { contains: q, mode: "insensitive" } } },
          { location: { country: { contains: q, mode: "insensitive" } } },
        ],
      },
      take: PER_TYPE_LIMIT,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true, name: true, propertyClass: true,
        location: { select: { name: true, country: true } },
      },
    }),
  ]);

  const results = {
    clients: clients.map((c): SearchResult => {
      const name = [c.firstName, c.lastName].filter(Boolean).join(" ").trim();
      return {
        id: c.id,
        type: "client",
        title: name || c.email,
        subtitle: name ? c.email : (c.country ?? "Client"),
        href: `/clients/${c.id}`,
        meta: c.country ?? undefined,
      };
    }),
    requests: requests.map((r): SearchResult => {
      const clientName = [r.client?.firstName, r.client?.lastName]
        .filter(Boolean)
        .join(" ")
        .trim();
      return {
        id: r.id,
        type: "request",
        title: `#${r.referenceNumber}`,
        subtitle: clientName || r.client?.email || "Unknown client",
        href: `/requests/${r.id}`,
        meta: r.status,
      };
    }),
    proposals: proposals.map((p): SearchResult => ({
      id: p.id,
      type: "proposal",
      title: p.title || "Untitled proposal",
      subtitle: `Last edited ${formatRelative(p.updatedAt)}`,
      href: `/studio/${p.id}`,
      meta: p.status,
    })),
    reservations: reservations.map((r): SearchResult => ({
      id: r.id,
      type: "reservation",
      title: r.campName,
      subtitle: `${r.guestName} · ${formatDateRange(r.startDate, r.endDate)}`,
      href: `/reservations`,
      meta: r.status,
    })),
    properties: properties.map((p): SearchResult => ({
      id: p.id,
      type: "property",
      title: p.name,
      subtitle: [p.location?.name, p.location?.country].filter(Boolean).join(" · ") || "—",
      href: `/properties/${p.id}`,
      meta: p.propertyClass ?? undefined,
    })),
  };

  return NextResponse.json({ q, results });
}

function emptyGroups() {
  return { clients: [], requests: [], proposals: [], reservations: [], properties: [] };
}

function formatRelative(d: Date): string {
  const diff = Date.now() - d.getTime();
  if (diff < 3_600_000) return `${Math.max(1, Math.floor(diff / 60_000))}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatDateRange(start: Date, end: Date): string {
  const s = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const e = end.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${s} – ${e}`;
}
