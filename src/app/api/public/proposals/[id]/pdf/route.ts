import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/public/proposals/:id/pdf — unauthenticated PDF render.
// Same security model as GET /api/public/proposals/:id: anyone with the
// nanoid can read the proposal, so they can also download it as a PDF.
// Used by the share-view ("Download Quote" CTA) which is consumed by
// guests who don't have an org session.

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const proposal = await prisma.proposal.findUnique({
    where: { id },
    select: { id: true, title: true },
  });
  if (!proposal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const renderUrl = process.env.PDF_RENDER_URL?.trim();
  const secret = process.env.PDF_SHARED_SECRET?.trim();
  const base =
    process.env.PUBLIC_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_BASE_URL?.trim() ||
    "";

  if (!renderUrl || !secret || !base) {
    return NextResponse.json(
      { error: "PDF service is not configured on this deployment.", code: "PDF_NOT_CONFIGURED" },
      { status: 503 },
    );
  }

  const normalisedBase = /^https?:\/\//i.test(base)
    ? base.replace(/\/$/, "")
    : `https://${base.replace(/\/$/, "")}`;
  const printUrl = `${normalisedBase}/p/${id}/print`;
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
    console.error("[public-pdf] render service unreachable:", err);
    return NextResponse.json(
      { error: "PDF service is unreachable. Try again shortly." },
      { status: 502 },
    );
  }

  if (!pdfRes.ok) {
    const text = await pdfRes.text().catch(() => "");
    console.error("[public-pdf] render failed:", pdfRes.status, text.slice(0, 400));
    let detail = "";
    try {
      const parsed = JSON.parse(text) as { error?: string };
      detail = parsed.error ?? "";
    } catch {
      detail = text.slice(0, 200);
    }
    return NextResponse.json(
      { error: `PDF render failed (${pdfRes.status})${detail ? `: ${detail}` : ""}` },
      { status: 502 },
    );
  }

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
