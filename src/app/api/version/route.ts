import { NextResponse } from "next/server";

// ─── GET /api/version ──────────────────────────────────────────────────────
//
// Public, unauthenticated. Returns whatever build/commit/deployment the
// running container thinks it is. Useful when Railway has been silently
// failing builds — hitting this endpoint after a push tells the operator
// whether their commit is live or whether they're still on yesterday's
// container.
//
// Most fields below come from Railway's auto-injected env vars (see
// https://docs.railway.com/reference/variables). NODE_ENV + uptime are
// always available; the rest may be empty when running locally.

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = (globalThis as unknown as { __SS_BOOT_TIME__?: number }).__SS_BOOT_TIME__;
  if (!startedAt) {
    (globalThis as unknown as { __SS_BOOT_TIME__: number }).__SS_BOOT_TIME__ = Date.now();
  }

  const bootMs = (globalThis as unknown as { __SS_BOOT_TIME__: number }).__SS_BOOT_TIME__;
  const uptimeSec = Math.round((Date.now() - bootMs) / 1000);

  const commit = process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) ?? null;
  const commitFull = process.env.RAILWAY_GIT_COMMIT_SHA ?? null;
  const branch = process.env.RAILWAY_GIT_BRANCH ?? null;
  const message = process.env.RAILWAY_GIT_COMMIT_MESSAGE ?? null;
  const deploymentId = process.env.RAILWAY_DEPLOYMENT_ID ?? null;
  const projectId = process.env.RAILWAY_PROJECT_ID ?? null;
  const serviceId = process.env.RAILWAY_SERVICE_ID ?? null;

  return NextResponse.json({
    ok: true,
    nodeEnv: process.env.NODE_ENV ?? "development",
    uptimeSec,
    bootedAt: new Date(bootMs).toISOString(),
    railway: {
      commit,
      commitFull,
      branch,
      message,
      deploymentId,
      projectId,
      serviceId,
    },
  });
}
