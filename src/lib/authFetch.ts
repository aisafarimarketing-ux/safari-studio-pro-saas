// authFetch — fetch wrapper that recovers from transient Clerk 401s.
//
// Why this exists:
//   Clerk JWTs are short-lived (60s) and auto-refreshed by the
//   client SDK. A fetch that fires DURING a refresh sees a stale
//   cookie and returns 401, even though the user is still legitimately
//   signed in. This helper retries 401s with exponential backoff so a
//   slow refresh has time to land before we surface the failure.
//
// Operator brief: the previous "session expired" banner + 60s
// keep-alive ping flooded the operator's console with 401s and
// alarmed clients seeing the page over their shoulder. The banner
// is gone; this helper now retries silently and returns the final
// Response. The auto-save toast in EditorToolbar handles the rare
// case where every retry fails so the operator sees a single
// targeted error instead of a constant top-of-page warning.
//
// Usage:
//   const res = await authFetch("/api/proposals", { method: "POST", body });
//   // res is the final Response. 401-during-refresh is invisible.

const BACKOFF_MS = [1500, 4000, 10000];

export type AuthFetchOptions = RequestInit;

export async function authFetch(
  input: string,
  init: AuthFetchOptions = {},
): Promise<Response> {
  let res = await fetch(input, init);
  if (res.status !== 401) return res;

  for (const delay of BACKOFF_MS) {
    await new Promise((r) => setTimeout(r, delay));
    res = await fetch(input, init);
    if (res.status !== 401) return res;
  }

  // All retries exhausted. The session is genuinely expired. The
  // caller (auto-save / upload helpers) surfaces this through its
  // own error UI; we no longer dispatch a global event because the
  // page-wide banner that listened for it is gone.
  return res;
}
