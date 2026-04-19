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

  const renderUrl = process.env.PDF_RENDER_URL;
  const secret = process.env.PDF_SHARED_SECRET;
  if (!renderUrl || !secret) {
    return NextResponse.json(
      {
        error:
          "PDF export is not configured on this server. Deploy the pdf-service sidecar and set PDF_RENDER_URL + PDF_SHARED_SECRET.",
        code: "PDF_NOT_CONFIGURED",
      },
      { status: 503 },
    );
  }

  // Resolve the absolute public URL of the print page. Prefer an explicit
  // PUBLIC_BASE_URL (Railway/Vercel deployments often need it), then fall
  // back to the request origin.
  const base =
    process.env.PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    new URL(_req.url).origin;
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
    return NextResponse.json(
      { error: `PDF render failed (${pdfRes.status})` },
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
