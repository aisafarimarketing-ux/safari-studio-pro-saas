import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";

// GET /api/requests/export?format=csv — download the tenant-scoped
// request list as CSV. Respects the same status + assignee filters as
// the inbox list endpoint so "what you see" matches "what you export".
//
// Columns were chosen to be spreadsheet-friendly for a tour-operator
// bookkeeper: reference, stage, dates, client + contact, trip summary,
// handler, source. No JSON blobs.

const OPEN_STAGES = ["new", "working", "open"];

export async function GET(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return new Response("Not authenticated", { status: 401 });
  if (!ctx.organization) return new Response("No active organization", { status: 409 });

  const url = new URL(req.url);
  const statusParams = url.searchParams.getAll("status").filter(Boolean);
  const assignee = url.searchParams.get("assignedToUserId");

  const whereStatus: { status?: { in: string[] } } = {};
  if (statusParams.length > 0 && !statusParams.includes("all")) {
    whereStatus.status = { in: statusParams };
  } else if (statusParams.length === 0) {
    whereStatus.status = { in: OPEN_STAGES };
  }

  const whereAssignee: { assignedToUserId?: string | null } = {};
  if (assignee === "me") whereAssignee.assignedToUserId = ctx.user.id;
  else if (assignee === "unassigned") whereAssignee.assignedToUserId = null;
  else if (assignee) whereAssignee.assignedToUserId = assignee;

  const rows = await prisma.request.findMany({
    where: { organizationId: ctx.organization.id, ...whereStatus, ...whereAssignee },
    include: {
      client: true,
      assignedTo: { select: { name: true, email: true } },
    },
    orderBy: { receivedAt: "desc" },
  });

  const headers = [
    "Reference", "Stage", "Received", "Last activity", "Source", "Source detail",
    "Handler", "Handler email",
    "Client name", "Client email", "Client phone", "Country", "Language",
    "Nights", "Travelers", "Style", "Destinations", "Dates", "Operator note",
  ];

  const lines: string[] = [headers.map(csvCell).join(",")];

  for (const r of rows) {
    const brief = (r.tripBrief as Record<string, unknown> | null) ?? {};
    const destinations = Array.isArray(brief.destinations) ? (brief.destinations as string[]).join(" / ") : "";
    const fullName = [r.client?.firstName, r.client?.lastName].filter(Boolean).join(" ").trim() || r.client?.email || "";
    lines.push([
      r.referenceNumber,
      r.status,
      isoDate(r.receivedAt),
      isoDate(r.lastActivityAt),
      r.source ?? "",
      r.sourceDetail ?? "",
      r.assignedTo?.name ?? "",
      r.assignedTo?.email ?? "",
      fullName,
      r.client?.email ?? "",
      r.client?.phone ?? "",
      r.client?.country ?? "",
      r.client?.preferredLanguage ?? "",
      numOrEmpty(brief.nights),
      numOrEmpty(brief.travelers),
      strOrEmpty(brief.style),
      destinations,
      strOrEmpty(brief.dates),
      strOrEmpty(brief.operatorNote),
    ].map(csvCell).join(","));
  }

  const filename = `requests-${isoDate(new Date())}.csv`;
  return new Response(lines.join("\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

// ─── Formatters ───────────────────────────────────────────────────────────

function csvCell(v: unknown): string {
  const s = String(v ?? "");
  // Escape if contains comma, quote, newline, or leading/trailing whitespace.
  if (/[",\n\r]/.test(s) || /^\s|\s$/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function isoDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function numOrEmpty(v: unknown): string {
  return typeof v === "number" ? String(v) : "";
}

function strOrEmpty(v: unknown): string {
  return typeof v === "string" ? v : "";
}
