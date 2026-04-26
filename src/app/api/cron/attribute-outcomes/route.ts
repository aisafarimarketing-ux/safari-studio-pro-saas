import { NextResponse } from "next/server";
import { sweepNoResponseTasks } from "@/lib/outcomeAttribution";

// GET /api/cron/attribute-outcomes — daily sweep that walks pending
// task outcomes whose attribution window has elapsed without a booking
// and marks them "no_response". Conversions are stamped in real time
// by attributeBookedRequest() (called from PATCH /api/requests/[id]),
// so this endpoint only handles the long-tail.
//
// Auth: Bearer CRON_SECRET — matches the other cron endpoints
// (/api/cron/overdue, /api/cron/billing-grace).
//
// Recommended cadence: once per hour. The job is idempotent and
// bounded (BATCH_LIMIT per run); running it more than once a day
// just smooths the work.

const BATCH_LIMIT = 500;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const auth = req.headers.get("authorization") ?? "";
  const provided = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await sweepNoResponseTasks({ limit: BATCH_LIMIT });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron-attribute-outcomes] failed:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
