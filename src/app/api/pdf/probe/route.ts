import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";

// GET /api/pdf/probe
//
// End-to-end PDF setup doctor. Returns a report of:
//   1. Whether the print URL (built from PUBLIC_BASE_URL + a real proposal
//      ID) is reachable at all, and what status code it returns to a
//      plain server-side fetch.
//   2. Whether the sidecar's /diag endpoint can load the same URL using
//      Playwright — that picks up client-side issues the plain fetch
//      misses (SPA route failing, JS error, etc.).
//
// Use this when `/api/pdf/status` says configured+reachable but actual
// PDF downloads fail.

export async function GET(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ctx.organization) return NextResponse.json({ error: "No active organization" }, { status: 409 });

  const renderUrl = process.env.PDF_RENDER_URL?.trim();
  const secret = process.env.PDF_SHARED_SECRET?.trim();
  const base = process.env.PUBLIC_BASE_URL?.trim() || process.env.NEXT_PUBLIC_BASE_URL?.trim() || "";

  // Pick the newest proposal we're allowed to see, so we can probe a real print URL.
  const latest = await prisma.proposal.findFirst({
    where: { organizationId: ctx.organization.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });

  if (!latest) {
    return NextResponse.json({ error: "No proposals available to probe" }, { status: 400 });
  }

  const normalisedBase = /^https?:\/\//i.test(base)
    ? base.replace(/\/$/, "")
    : base
      ? `https://${base.replace(/\/$/, "")}`
      : new URL(req.url).origin;
  const printUrl = `${normalisedBase}/p/${latest.id}/print`;

  // 1) Plain server-side fetch.
  const plain: Record<string, unknown> = { url: printUrl };
  try {
    const r = await fetch(printUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    plain.status = r.status;
    plain.contentType = r.headers.get("content-type");
    plain.ok = r.ok;
    const text = await r.text().catch(() => "");
    plain.bodyBytes = text.length;
    plain.bodyPreview = text.slice(0, 240);
  } catch (err) {
    plain.ok = false;
    plain.error = err instanceof Error ? err.message : String(err);
  }

  // 2) Sidecar /diag run.
  const diag: Record<string, unknown> = {};
  if (!renderUrl || !secret) {
    diag.skipped = "PDF_RENDER_URL or PDF_SHARED_SECRET not set";
  } else {
    try {
      const r = await fetch(`${renderUrl.replace(/\/$/, "")}/diag`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify({ url: printUrl }),
        signal: AbortSignal.timeout(45_000),
      });
      diag.sidecarStatus = r.status;
      const text = await r.text();
      try {
        diag.body = JSON.parse(text);
      } catch {
        diag.body = text.slice(0, 400);
      }
    } catch (err) {
      diag.error = err instanceof Error ? err.message : String(err);
    }
  }

  return NextResponse.json({
    printUrl,
    env: {
      PDF_RENDER_URL: renderUrl ? "(set)" : "(missing)",
      PDF_SHARED_SECRET: secret ? "(set)" : "(missing)",
      PUBLIC_BASE_URL: base || "(missing)",
    },
    plainFetch: plain,
    sidecarDiag: diag,
  });
}
