// authFetch — fetch wrapper that recovers from transient Clerk 401s.
//
// Why this exists:
//   Clerk JWTs are short-lived (60s) and auto-refreshed by the
//   client SDK. A fetch that fires DURING a refresh sees a stale
//   cookie and returns 401, even though the user is still legitimately
//   signed in. The previous "wait 1500ms and retry once" approach
//   surfaced as random red save errors that confused operators and
//   their clients.
//
//   This helper retries 401s with exponential backoff (1.5s, 4s, 10s)
//   so a slow refresh has time to land, and only fires the global
//   auth-expired event when EVERY retry has been exhausted.
//
// Usage:
//   const res = await authFetch("/api/proposals", { method: "POST", body });
//   // res is the final Response. 401-during-refresh is invisible.

const BACKOFF_MS = [1500, 4000, 10000];

export interface AuthFetchOptions extends RequestInit {
  /** When true, dispatch the global auth-expired event after all
   *  retries fail. Defaults to true for primary save / upload flows;
   *  set false for low-priority background pings that shouldn't
   *  trigger banners on flaky connections. */
  signalExpired?: boolean;
}

export async function authFetch(
  input: string,
  init: AuthFetchOptions = {},
): Promise<Response> {
  const { signalExpired = true, ...rest } = init;
  let res = await fetch(input, rest);
  if (res.status !== 401) return res;

  for (const delay of BACKOFF_MS) {
    await new Promise((r) => setTimeout(r, delay));
    res = await fetch(input, rest);
    if (res.status !== 401) return res;
  }

  // All retries exhausted. The session is genuinely expired.
  if (signalExpired && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("safari-studio:auth-expired"));
  }
  return res;
}
