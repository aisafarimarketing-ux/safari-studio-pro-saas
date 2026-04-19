import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";

// GET /api/pdf/status
//
// Tells the editor UI whether the high-fidelity PDF render path is wired up:
//   { configured: boolean, reachable: boolean, message: string }
//
// configured  — all three env vars are present (PDF_RENDER_URL,
//               PDF_SHARED_SECRET, and a base URL).
// reachable   — a HEAD/GET to the sidecar root returned 200 recently.
// message     — human-readable explanation surfaced in the export dialog.
//
// Not public: requires the caller to be signed in. We don't care about
// tenant scope for this probe — the info is environment-level.

type Probe = { configured: boolean; reachable: boolean; message: string };

const CACHE_TTL_MS = 30_000;
let cached: { at: number; value: Probe } | null = null;

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return NextResponse.json(cached.value);
  }

  const renderUrl = process.env.PDF_RENDER_URL?.trim();
  const secret = process.env.PDF_SHARED_SECRET?.trim();
  const base =
    process.env.PUBLIC_BASE_URL?.trim() || process.env.NEXT_PUBLIC_BASE_URL?.trim();

  if (!renderUrl) {
    return respond({
      configured: false,
      reachable: false,
      message: "PDF_RENDER_URL is not set on this deployment.",
    });
  }
  if (!secret) {
    return respond({
      configured: false,
      reachable: false,
      message: "PDF_SHARED_SECRET is not set on this deployment.",
    });
  }
  if (!base) {
    return respond({
      configured: false,
      reachable: false,
      message:
        "PUBLIC_BASE_URL is not set — the sidecar would not know which URL to render.",
    });
  }

  // Probe the sidecar root (GET / returns {"status":"ok", ...}).
  try {
    const res = await fetch(renderUrl.replace(/\/$/, ""), {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(3500),
    });
    if (!res.ok) {
      return respond({
        configured: true,
        reachable: false,
        message: `PDF service responded with HTTP ${res.status}. Check the sidecar deploy logs.`,
      });
    }
  } catch (err) {
    return respond({
      configured: true,
      reachable: false,
      message: `PDF service is not reachable at ${renderUrl}: ${err instanceof Error ? err.message : "network error"}.`,
    });
  }

  return respond({
    configured: true,
    reachable: true,
    message: "PDF service is configured and reachable.",
  });
}

function respond(value: Probe) {
  cached = { at: Date.now(), value };
  return NextResponse.json(value);
}
