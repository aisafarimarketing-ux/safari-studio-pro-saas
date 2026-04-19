import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";

// POST /api/proposals/:id/pdf — calls the configured PDF render service
// (a separate Railway service running Playwright; see /pdf-service) with
// the public /p/:id/print URL and pipes the rendered PDF back to the
// caller as a download.
//
// Tenant-scoped: only members of the proposal's organization can trigger
// a render (the print URL itself is public, but we still gate the export
// button so suspended/wrong-org users can't use the costly endpoint).

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!auth.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }
  if (!auth.orgActive) {
    return NextResponse.json({ error: "Account suspended", code: "ORG_SUSPENDED" }, { status: 402 });
  }

  // Tenant guard
  const proposal = await prisma.proposal.findUnique({
    where: { id },
    select: { id: true, title: true, organizationId: true },
  });
  if (!proposal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (proposal.organizationId !== auth.organization.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const renderUrl = process.env.PDF_RENDER_URL?.trim();
  const secret = process.env.PDF_SHARED_SECRET?.trim();
  const base =
    process.env.PUBLIC_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_BASE_URL?.trim() ||
    "";

  // Helpful, specific 503s so the UI can say exactly what's missing.
  if (!renderUrl) {
    return NextResponse.json(
      {
        error: "PDF_RENDER_URL is not set on this deployment.",
        code: "PDF_NOT_CONFIGURED",
        missing: "PDF_RENDER_URL",
      },
      { status: 503 },
    );
  }
  if (!secret) {
    return NextResponse.json(
      {
        error: "PDF_SHARED_SECRET is not set on this deployment.",
        code: "PDF_NOT_CONFIGURED",
        missing: "PDF_SHARED_SECRET",
      },
      { status: 503 },
    );
  }
  if (!base) {
    return NextResponse.json(
      {
        error:
          "PUBLIC_BASE_URL is not set — the sidecar wouldn't know which URL to render.",
        code: "PDF_NOT_CONFIGURED",
        missing: "PUBLIC_BASE_URL",
      },
      { status: 503 },
    );
  }

  const printUrl = `${base.replace(/\/$/, "")}/p/${id}/print`;

  const filename = sanitizeFilename(`${proposal.title || "proposal"}.pdf`);

  let pdfRes: Response;
  try {
    pdfRes = await fetch(`${renderUrl.replace(/\/$/, "")}/pdf`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ url: printUrl, filename }),
    });
  } catch (err) {
    console.error("[pdf] render service unreachable:", err);
    return NextResponse.json(
      { error: "PDF service is unreachable. Try again shortly." },
      { status: 502 },
    );
  }

  if (!pdfRes.ok) {
    const text = await pdfRes.text().catch(() => "");
    console.error("[pdf] render failed:", pdfRes.status, text.slice(0, 400));
    // Forward the sidecar's actual error message so the UI can show
    // something more useful than "PDF render failed (500)".
    let detail = "";
    try {
      const parsed = JSON.parse(text) as { error?: string };
      detail = parsed.error ?? "";
    } catch {
      detail = text.slice(0, 200);
    }
    return NextResponse.json(
      {
        error: `PDF render failed (${pdfRes.status})${detail ? `: ${detail}` : ""}`,
        sidecarStatus: pdfRes.status,
        sidecarMessage: detail || undefined,
        printUrl,
      },
      { status: 502 },
    );
  }

  // Stream the PDF back to the caller.
  const blob = await pdfRes.arrayBuffer();
  return new NextResponse(blob, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(blob.byteLength),
    },
  });
}

function sanitizeFilename(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80) || "proposal.pdf";
}
